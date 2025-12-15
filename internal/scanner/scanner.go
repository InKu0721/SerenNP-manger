package scanner

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"nuclei-poc-manager/internal/models"
)

// Scanner 扫描器
type Scanner struct {
	scans   map[string]*ScanJob
	results map[string][]models.ScanResult
	mu      sync.RWMutex
}

// ScanJob 扫描任务
type ScanJob struct {
	ID           string
	Status       *models.ScanStatus
	Cancel       context.CancelFunc
	Templates    []models.POCTemplate
	Targets      []string
	TemplatesDir string
}

// NewScanner 创建新的扫描器
func NewScanner() *Scanner {
	return &Scanner{
		scans:   make(map[string]*ScanJob),
		results: make(map[string][]models.ScanResult),
	}
}

// Start 开始扫描
func (s *Scanner) Start(ctx context.Context, targets []string, templates []models.POCTemplate, templatesDir string) (string, error) {
	scanID := fmt.Sprintf("scan_%d", time.Now().UnixNano())

	scanCtx, cancel := context.WithCancel(ctx)

	status := &models.ScanStatus{
		ID:          scanID,
		Status:      "running",
		Total:       len(targets) * len(templates),
		Completed:   0,
		Found:       0,
		StartedAt:   time.Now(),
		Targets:     targets,
		TemplateIDs: make([]string, len(templates)),
	}

	for i, t := range templates {
		status.TemplateIDs[i] = t.ID
	}

	job := &ScanJob{
		ID:           scanID,
		Status:       status,
		Cancel:       cancel,
		Templates:    templates,
		Targets:      targets,
		TemplatesDir: templatesDir,
	}

	s.mu.Lock()
	s.scans[scanID] = job
	s.results[scanID] = []models.ScanResult{}
	s.mu.Unlock()

	go s.runRealScan(scanCtx, job)

	return scanID, nil
}

// runRealScan 执行真实的 HTTP 扫描
func (s *Scanner) runRealScan(ctx context.Context, job *ScanJob) {
	defer func() {
		if r := recover(); r != nil {
			s.mu.Lock()
			job.Status.Status = "failed"
			job.Status.Error = fmt.Sprintf("扫描崩溃: %v", r)
			job.Status.CompletedAt = time.Now()
			s.mu.Unlock()
		}
	}()

	total := len(job.Targets) * len(job.Templates)
	completed := 0

	client := &http.Client{
		Timeout: 30 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return fmt.Errorf("too many redirects")
			}
			return nil
		},
	}

	for _, target := range job.Targets {
		for _, template := range job.Templates {
			select {
			case <-ctx.Done():
				s.mu.Lock()
				job.Status.Status = "stopped"
				job.Status.CompletedAt = time.Now()
				s.mu.Unlock()
				return
			default:
			}

			// 执行真实扫描
			result := s.executeTemplate(ctx, client, target, template)
			if result != nil {
				result.ScanID = job.ID
				s.mu.Lock()
				s.results[job.ID] = append(s.results[job.ID], *result)
				job.Status.Found++
				s.mu.Unlock()
			}

			completed++
			s.mu.Lock()
			job.Status.Completed = completed
			job.Status.Progress = float64(completed) / float64(total) * 100
			s.mu.Unlock()
		}
	}

	s.mu.Lock()
	job.Status.Status = "completed"
	job.Status.Progress = 100
	job.Status.CompletedAt = time.Now()
	s.mu.Unlock()
}

// executeTemplate 执行单个模板扫描
func (s *Scanner) executeTemplate(ctx context.Context, client *http.Client, target string, template models.POCTemplate) *models.ScanResult {
	// 解析模板内容
	if template.Content == "" && template.FilePath != "" {
		content, err := os.ReadFile(template.FilePath)
		if err != nil {
			return nil
		}
		template.Content = string(content)
	}

	if template.Content == "" {
		return nil
	}

	// 解析 YAML 获取 HTTP 请求配置
	requests := parseHTTPRequests(template.Content)
	if len(requests) == 0 {
		return nil
	}

	// 规范化目标 URL
	if !strings.HasPrefix(target, "http://") && !strings.HasPrefix(target, "https://") {
		target = "http://" + target
	}
	target = strings.TrimSuffix(target, "/")

	for _, reqConfig := range requests {
		// 构建请求 URL
		path := reqConfig.Path
		if path == "" {
			path = "/"
		}
		if !strings.HasPrefix(path, "/") {
			path = "/" + path
		}
		
		// 替换变量
		fullURL := target + path
		fullURL = strings.ReplaceAll(fullURL, "{{BaseURL}}", target)
		fullURL = strings.ReplaceAll(fullURL, "{{RootURL}}", target)
		fullURL = strings.ReplaceAll(fullURL, "{{Hostname}}", extractHostname(target))

		// 构建请求
		method := strings.ToUpper(reqConfig.Method)
		if method == "" {
			method = "GET"
		}

		var bodyReader io.Reader
		body := reqConfig.Body
		body = strings.ReplaceAll(body, "{{BaseURL}}", target)
		body = strings.ReplaceAll(body, "{{RootURL}}", target)
		if body != "" {
			bodyReader = bytes.NewBufferString(body)
		}

		req, err := http.NewRequestWithContext(ctx, method, fullURL, bodyReader)
		if err != nil {
			continue
		}

		// 设置默认 headers
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
		req.Header.Set("Accept", "*/*")
		req.Header.Set("Connection", "close")

		// 设置自定义 headers
		for k, v := range reqConfig.Headers {
			v = strings.ReplaceAll(v, "{{BaseURL}}", target)
			v = strings.ReplaceAll(v, "{{Hostname}}", extractHostname(target))
			req.Header.Set(k, v)
		}

		// 记录请求
		reqStr := formatRequest(req, body)

		// 发送请求
		resp, err := client.Do(req)
		if err != nil {
			continue
		}

		// 读取响应
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024*1024)) // 限制 1MB
		resp.Body.Close()

		respStr := formatResponse(resp, respBody)

		// 检查匹配条件
		matched, matchInfo := checkMatchers(reqConfig.Matchers, resp, respBody)
		if matched {
			return &models.ScanResult{
				ID:           fmt.Sprintf("%d", time.Now().UnixNano()),
				TemplateID:   template.ID,
				TemplateName: template.Name,
				Severity:     template.Severity,
				Host:         target,
				Matched:      matchInfo,
				Timestamp:    time.Now(),
				Request:      reqStr,
				Response:     respStr,
			}
		}
	}

	return nil
}

// HTTPRequest HTTP 请求配置
type HTTPRequest struct {
	Method   string
	Path     string
	Headers  map[string]string
	Body     string
	Matchers []Matcher
}

// Matcher 匹配器
type Matcher struct {
	Type      string   // status, word, regex
	Words     []string
	Status    []int
	Regex     []string
	Part      string // body, header, all
	Condition string // and, or
	Negative  bool
}

// parseHTTPRequests 解析模板中的 HTTP 请求
func parseHTTPRequests(content string) []HTTPRequest {
	var requests []HTTPRequest

	lines := strings.Split(content, "\n")
	inHTTP := false
	inRequest := false
	inMatchers := false
	currentReq := HTTPRequest{
		Headers:  make(map[string]string),
		Matchers: []Matcher{},
	}
	currentMatcher := Matcher{}

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		if strings.HasPrefix(trimmed, "http:") || strings.HasPrefix(trimmed, "requests:") {
			inHTTP = true
			continue
		}

		if !inHTTP {
			continue
		}

		// 检测新的请求块
		if strings.HasPrefix(trimmed, "- method:") || strings.HasPrefix(trimmed, "- raw:") {
			if inRequest && (currentReq.Path != "" || currentReq.Method != "") {
				requests = append(requests, currentReq)
			}
			inRequest = true
			inMatchers = false
			currentReq = HTTPRequest{
				Headers:  make(map[string]string),
				Matchers: []Matcher{},
			}
			if strings.HasPrefix(trimmed, "- method:") {
				currentReq.Method = strings.TrimSpace(strings.TrimPrefix(trimmed, "- method:"))
			}
			continue
		}

		if !inRequest {
			continue
		}

		// 解析请求属性
		if strings.HasPrefix(trimmed, "method:") {
			currentReq.Method = strings.Trim(strings.TrimPrefix(trimmed, "method:"), " \"'")
		} else if strings.HasPrefix(trimmed, "path:") {
			pathStr := strings.TrimPrefix(trimmed, "path:")
			pathStr = strings.Trim(pathStr, " []\"'")
			currentReq.Path = pathStr
		} else if strings.HasPrefix(trimmed, "- \"{{BaseURL}}") || strings.HasPrefix(trimmed, "- '{{BaseURL}}") {
			path := strings.Trim(trimmed, "- \"'")
			path = strings.TrimPrefix(path, "{{BaseURL}}")
			currentReq.Path = path
		} else if strings.HasPrefix(trimmed, "body:") {
			currentReq.Body = strings.Trim(strings.TrimPrefix(trimmed, "body:"), " \"'")
		} else if strings.HasPrefix(trimmed, "matchers:") {
			inMatchers = true
			continue
		} else if strings.HasPrefix(trimmed, "headers:") {
			continue
		} else if inMatchers {
			if strings.HasPrefix(trimmed, "- type:") {
				if currentMatcher.Type != "" {
					currentReq.Matchers = append(currentReq.Matchers, currentMatcher)
				}
				currentMatcher = Matcher{
					Type: strings.Trim(strings.TrimPrefix(trimmed, "- type:"), " \"'"),
				}
			} else if strings.HasPrefix(trimmed, "type:") {
				currentMatcher.Type = strings.Trim(strings.TrimPrefix(trimmed, "type:"), " \"'")
			} else if strings.HasPrefix(trimmed, "status:") {
				statusStr := strings.TrimPrefix(trimmed, "status:")
				statusStr = strings.Trim(statusStr, " []")
				for _, s := range strings.Split(statusStr, ",") {
					var code int
					fmt.Sscanf(strings.TrimSpace(s), "%d", &code)
					if code > 0 {
						currentMatcher.Status = append(currentMatcher.Status, code)
					}
				}
			} else if strings.HasPrefix(trimmed, "words:") {
				continue
			} else if strings.HasPrefix(trimmed, "- \"") || strings.HasPrefix(trimmed, "- '") {
				word := strings.Trim(trimmed, "- \"'")
				currentMatcher.Words = append(currentMatcher.Words, word)
			} else if strings.HasPrefix(trimmed, "part:") {
				currentMatcher.Part = strings.Trim(strings.TrimPrefix(trimmed, "part:"), " \"'")
			} else if strings.HasPrefix(trimmed, "condition:") {
				currentMatcher.Condition = strings.Trim(strings.TrimPrefix(trimmed, "condition:"), " \"'")
			} else if strings.HasPrefix(trimmed, "negative:") {
				currentMatcher.Negative = strings.Contains(trimmed, "true")
			}
		} else if strings.Contains(line, ":") && !strings.HasPrefix(trimmed, "-") && !strings.HasPrefix(trimmed, "#") {
			// 可能是 header
			parts := strings.SplitN(trimmed, ":", 2)
			if len(parts) == 2 {
				key := strings.TrimSpace(parts[0])
				val := strings.Trim(strings.TrimSpace(parts[1]), "\"'")
				if isHeaderKey(key) {
					currentReq.Headers[key] = val
				}
			}
		}
	}

	// 添加最后一个 matcher
	if currentMatcher.Type != "" {
		currentReq.Matchers = append(currentReq.Matchers, currentMatcher)
	}

	// 添加最后一个请求
	if inRequest && (currentReq.Path != "" || currentReq.Method != "" || len(currentReq.Matchers) > 0) {
		if currentReq.Path == "" {
			currentReq.Path = "/"
		}
		requests = append(requests, currentReq)
	}

	return requests
}

func isHeaderKey(key string) bool {
	headers := []string{
		"Content-Type", "Accept", "User-Agent", "Host", "Authorization",
		"Cookie", "Referer", "Origin", "X-Forwarded-For", "X-Real-IP",
		"Content-Length", "Accept-Encoding", "Accept-Language", "Cache-Control",
	}
	keyLower := strings.ToLower(key)
	for _, h := range headers {
		if strings.ToLower(h) == keyLower {
			return true
		}
	}
	return strings.HasPrefix(keyLower, "x-") || strings.HasPrefix(keyLower, "content-")
}

func extractHostname(url string) string {
	url = strings.TrimPrefix(url, "http://")
	url = strings.TrimPrefix(url, "https://")
	parts := strings.Split(url, "/")
	return parts[0]
}

func formatRequest(req *http.Request, body string) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("%s %s HTTP/1.1\n", req.Method, req.URL.RequestURI()))
	sb.WriteString(fmt.Sprintf("Host: %s\n", req.Host))
	for k, v := range req.Header {
		sb.WriteString(fmt.Sprintf("%s: %s\n", k, strings.Join(v, ", ")))
	}
	if body != "" {
		sb.WriteString("\n")
		sb.WriteString(body)
	}
	return sb.String()
}

func formatResponse(resp *http.Response, body []byte) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("HTTP/%d.%d %s\n", resp.ProtoMajor, resp.ProtoMinor, resp.Status))
	for k, v := range resp.Header {
		sb.WriteString(fmt.Sprintf("%s: %s\n", k, strings.Join(v, ", ")))
	}
	sb.WriteString("\n")
	if len(body) > 2048 {
		sb.Write(body[:2048])
		sb.WriteString("\n... (truncated)")
	} else {
		sb.Write(body)
	}
	return sb.String()
}

func checkMatchers(matchers []Matcher, resp *http.Response, body []byte) (bool, string) {
	if len(matchers) == 0 {
		// 没有 matcher，默认检查状态码 200
		if resp.StatusCode == 200 {
			return true, fmt.Sprintf("Status: %d", resp.StatusCode)
		}
		return false, ""
	}

	bodyStr := string(body)
	headerStr := formatHeaders(resp.Header)
	allStr := headerStr + "\n" + bodyStr

	var matchedInfos []string

	for _, m := range matchers {
		matched := false
		info := ""

		switch m.Type {
		case "status":
			for _, code := range m.Status {
				if resp.StatusCode == code {
					matched = true
					info = fmt.Sprintf("Status: %d", code)
					break
				}
			}
		case "word":
			content := bodyStr
			if m.Part == "header" {
				content = headerStr
			} else if m.Part == "all" {
				content = allStr
			}

			if m.Condition == "and" {
				matched = true
				for _, word := range m.Words {
					if !strings.Contains(content, word) {
						matched = false
						break
					}
				}
				if matched {
					info = fmt.Sprintf("Words matched: %v", m.Words)
				}
			} else {
				for _, word := range m.Words {
					if strings.Contains(content, word) {
						matched = true
						info = fmt.Sprintf("Word: %s", word)
						break
					}
				}
			}
		case "regex":
			content := bodyStr
			if m.Part == "header" {
				content = headerStr
			} else if m.Part == "all" {
				content = allStr
			}
			for _, pattern := range m.Regex {
				if matchRegex(content, pattern) {
					matched = true
					info = fmt.Sprintf("Regex: %s", pattern)
					break
				}
			}
		}

		if m.Negative {
			matched = !matched
		}

		if matched {
			matchedInfos = append(matchedInfos, info)
		}
	}

	if len(matchedInfos) > 0 {
		return true, strings.Join(matchedInfos, "; ")
	}
	return false, ""
}

func formatHeaders(headers http.Header) string {
	var sb strings.Builder
	for k, v := range headers {
		sb.WriteString(fmt.Sprintf("%s: %s\n", k, strings.Join(v, ", ")))
	}
	return sb.String()
}

func matchRegex(content, pattern string) bool {
	// 简单的正则匹配，避免复杂依赖
	return strings.Contains(content, pattern)
}

// StopScan 停止扫描
func (s *Scanner) StopScan(scanID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	job, ok := s.scans[scanID]
	if !ok {
		return fmt.Errorf("扫描任务不存在: %s", scanID)
	}

	if job.Cancel != nil {
		job.Cancel()
	}

	job.Status.Status = "stopped"
	job.Status.CompletedAt = time.Now()

	return nil
}

// GetStatus 获取扫描状态
func (s *Scanner) GetStatus(scanID string) (*models.ScanStatus, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	job, ok := s.scans[scanID]
	if !ok {
		return nil, fmt.Errorf("扫描任务不存在: %s", scanID)
	}

	return job.Status, nil
}

// GetResults 获取扫描结果
func (s *Scanner) GetResults(scanID string) ([]models.ScanResult, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	results, ok := s.results[scanID]
	if !ok {
		return nil, fmt.Errorf("扫描任务不存在: %s", scanID)
	}

	return results, nil
}

// GetAllScans 获取所有扫描任务
func (s *Scanner) GetAllScans() ([]models.ScanStatus, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	scans := make([]models.ScanStatus, 0, len(s.scans))
	for _, job := range s.scans {
		scans = append(scans, *job.Status)
	}

	return scans, nil
}

// Stop 停止所有扫描
func (s *Scanner) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, job := range s.scans {
		if job.Cancel != nil && job.Status.Status == "running" {
			job.Cancel()
			job.Status.Status = "stopped"
			job.Status.CompletedAt = time.Now()
		}
	}
}

// GetTemplateFilePath 获取模板文件路径
func GetTemplateFilePath(templatesDir, templateID string) string {
	// 递归查找模板文件
	var result string
	filepath.Walk(templatesDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			return nil
		}
		if strings.HasSuffix(path, ".yaml") || strings.HasSuffix(path, ".yml") {
			base := strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))
			if base == templateID {
				result = path
				return filepath.SkipAll
			}
		}
		return nil
	})
	return result
}
