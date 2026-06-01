package scanner

import (
	"bytes"
	"context"
	"fmt"
	"encoding/json"
	"io"
	"math/rand"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"nuclei-poc-manager/internal/models"

	"gopkg.in/yaml.v3"
)

// —— 常量 ——

const (
	DefaultConcurrency   = 10          // 默认并发数
	DefaultTimeout       = 30          // 默认超时（秒）
	DefaultMaxRedirects  = 10          // 最大重定向次数
	DefaultMaxRespSize   = 1 << 20     // 默认响应体限制 1MB
	DefaultRespTruncate  = 2048        // 响应展示截断长度
	DefaultRateLimit     = 100         // 默认每秒最大请求
	DefaultRetryCount    = 0           // 默认不重试
	MinTargetLen         = 1           // 最短目标长度
	MaxMetadataLines     = 300         // 模板元数据最大读取行数
)

// allowedSchemes 允许的目标 scheme
var allowedSchemes = map[string]bool{
	"http":  true,
	"https": true,
}

// privateCIDRs 内网地址段（SSRF 保护）
var privateCIDRs = []string{
	"127.0.0.0/8",
	"10.0.0.0/8",
	"172.16.0.0/12",
	"192.168.0.0/16",
	"169.254.0.0/16",
	"::1/128",
	"fc00::/7",
	"fe80::/10",
}

var privateNets []*net.IPNet

func init() {
	for _, cidr := range privateCIDRs {
		_, n, err := net.ParseCIDR(cidr)
		if err == nil {
			privateNets = append(privateNets, n)
		}
	}
}

// Scanner 扫描器
type Scanner struct {
	scans    map[string]*ScanJob
	results  map[string][]models.ScanResult
	scansDir string // 扫描结果持久化目录
	mu       sync.RWMutex
}

// ScanJob 扫描任务
type ScanJob struct {
	ID           string
	Status       *models.ScanStatus
	Cancel       context.CancelFunc
	Templates    []models.POCTemplate
	Targets      []string
	TemplatesDir string
	Options      models.ScanOptions
}

// savedScan 持久化的扫描数据
type savedScan struct {
	Status  models.ScanStatus   `json:"status"`
	Results []models.ScanResult `json:"results"`
}

// NewScanner 创建新的扫描器
func NewScanner(scansDir string) *Scanner {
	s := &Scanner{
		scans:    make(map[string]*ScanJob),
		results:  make(map[string][]models.ScanResult),
		scansDir: scansDir,
	}
	// 从磁盘加载历史扫描
	s.loadScansFromDisk()
	return s
}

// loadScansFromDisk 从磁盘加载历史扫描任务
func (s *Scanner) loadScansFromDisk() {
	if s.scansDir == "" {
		return
	}
	os.MkdirAll(s.scansDir, 0755)

	entries, err := os.ReadDir(s.scansDir)
	if err != nil {
		return
	}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		scanID := strings.TrimSuffix(entry.Name(), ".json")
		filePath := filepath.Join(s.scansDir, entry.Name())

		data, err := os.ReadFile(filePath)
		if err != nil {
			continue
		}

		var saved savedScan
		if err := json.Unmarshal(data, &saved); err != nil {
			continue
		}

		// 恢复结果
		s.results[scanID] = saved.Results

		// 恢复状态（无 Cancel 函数，标记为历史任务）
		s.scans[scanID] = &ScanJob{
			ID:           scanID,
			Status:       &saved.Status,
			Cancel:       nil,
			TemplatesDir: s.scansDir,
		}
	}
}

// saveScanToDisk 将扫描结果保存到磁盘
func (s *Scanner) saveScanToDisk(scanID string) {
	if s.scansDir == "" {
		return
	}
	os.MkdirAll(s.scansDir, 0755)

	job, ok := s.scans[scanID]
	if !ok {
		return
	}
	results := s.results[scanID]

	saved := savedScan{
		Status:  *job.Status,
		Results: results,
	}

	data, err := json.MarshalIndent(saved, "", "  ")
	if err != nil {
		return
	}

	filePath := filepath.Join(s.scansDir, scanID+".json")
	os.WriteFile(filePath, data, 0644)
}

// Start 开始扫描
func (s *Scanner) Start(ctx context.Context, targets []string, templates []models.POCTemplate, templatesDir string, opts models.ScanOptions) (string, error) {
	scanID := fmt.Sprintf("scan_%d", time.Now().UnixNano())

	scanCtx, cancel := context.WithCancel(ctx)

	// 设置默认值
	if opts.Concurrency <= 0 {
		opts.Concurrency = 10
	}
	if opts.Timeout <= 0 {
		opts.Timeout = 30
	}

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
		Options:      opts,
	}

	s.mu.Lock()
	s.scans[scanID] = job
	s.results[scanID] = []models.ScanResult{}
	s.mu.Unlock()

	go s.runRealScan(scanCtx, job)

	return scanID, nil
}

// runRealScan 执行真实的 HTTP 扫描（支持并发、代理、速率限制）
func (s *Scanner) runRealScan(ctx context.Context, job *ScanJob) {
	defer func() {
		if r := recover(); r != nil {
			s.mu.Lock()
			job.Status.Status = "failed"
			job.Status.Error = fmt.Sprintf("扫描崩溃: %v", r)
			job.Status.Progress = 100
			job.Status.CompletedAt = time.Now()
			s.mu.Unlock()
			// 崩溃也保存已收集的结果
			s.saveScanToDisk(job.ID)
		}
	}()

	concurrency := job.Options.Concurrency
	if concurrency <= 0 {
		concurrency = DefaultConcurrency
	}
	timeout := time.Duration(job.Options.Timeout) * time.Second
	if timeout <= 0 {
		timeout = DefaultTimeout * time.Second
	}
	rateLimit := job.Options.RateLimit
	if rateLimit <= 0 {
		rateLimit = DefaultRateLimit
	}

	// 创建 HTTP 传输层（支持代理）
	transport := &http.Transport{
		MaxIdleConns:        concurrency * 2,
		MaxConnsPerHost:     10,
		IdleConnTimeout:     90 * time.Second,
		DisableCompression:  false,
		DisableKeepAlives:   false,
	}

	// 代理设置
	if job.Options.ProxyURL != "" {
		proxyURL, err := url.Parse(job.Options.ProxyURL)
		if err == nil {
			transport.Proxy = http.ProxyURL(proxyURL)
		}
	}

	// 创建 HTTP 客户端
	client := &http.Client{
		Timeout:   timeout,
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= DefaultMaxRedirects {
				return fmt.Errorf("too many redirects")
			}
			return nil
		},
	}

	// 速率限制器（> 500 req/s 则跳过限制，避免过高 CPU 开销）
	var rateLimiter *time.Ticker
	if rateLimit > 0 && rateLimit <= 500 {
		rateLimiter = time.NewTicker(time.Second / time.Duration(rateLimit))
		defer rateLimiter.Stop()
	}

	// 构建所有扫描任务
	type scanTask struct {
		target   string
		template models.POCTemplate
	}
	tasks := make([]scanTask, 0, len(job.Targets)*len(job.Templates))
	for _, target := range job.Targets {
		for _, template := range job.Templates {
			tasks = append(tasks, scanTask{target, template})
		}
	}

	total := len(tasks)
	completed := 0

	// 使用带缓冲但不过大的 channel（concurrency * 16 避免大内存）
	chBuf := concurrency * 16
	if chBuf > len(tasks) {
		chBuf = len(tasks)
	}
	taskCh := make(chan scanTask, chBuf)
	resultCh := make(chan *models.ScanResult, chBuf)

	// 启动 worker goroutines
	var wg sync.WaitGroup
	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				select {
				case <-ctx.Done():
					return
				case task, ok := <-taskCh:
					if !ok {
						return
					}
					// 速率限制（nil 表示无限制）
					if rateLimiter != nil {
						<-rateLimiter.C
					}

					// 允许私有地址检查
					if !job.Options.AllowPrivate {
						if err := validateTarget(task.target); err != nil {
							resultCh <- &models.ScanResult{
								ID:           fmt.Sprintf("%d", time.Now().UnixNano()),
								TemplateID:   task.template.ID,
								TemplateName: task.template.Name,
								Severity:     task.template.Severity,
								Host:         task.target,
								Error:        fmt.Sprintf("目标被拒绝: %v", err),
								Timestamp:    time.Now(),
							}
							continue
						}
					}

					// 执行扫描（支持重试）
					var result *models.ScanResult
					maxRetries := job.Options.RetryCount
					if maxRetries < 0 {
						maxRetries = DefaultRetryCount
					}
					for attempt := 0; attempt <= maxRetries; attempt++ {
						result = s.executeTemplate(ctx, client, task.target, task.template, job.Options.MaxResponseSize)
						if result == nil || result.Error == "" {
							break
						}
						if attempt < maxRetries {
							time.Sleep(time.Duration(attempt+1) * 500 * time.Millisecond)
						}
					}
					select {
					case resultCh <- result:
					case <-ctx.Done():
						return
					}
				}
			}
		}()
	}

	// 发送任务到通道
	go func() {
		for _, task := range tasks {
			select {
			case taskCh <- task:
			case <-ctx.Done():
				close(taskCh)
				return
			}
		}
		close(taskCh)
	}()

	// 等待所有 workers 完成，然后关闭结果通道
	go func() {
		wg.Wait()
		close(resultCh)
	}()

	// 收集结果（仅保存成功匹配 + 错误，非匹配跳过以节省空间）
	for result := range resultCh {
		completed++
		if result != nil && (result.Matched != "" || result.Error != "") {
			result.ScanID = job.ID
			s.mu.Lock()
			s.results[job.ID] = append(s.results[job.ID], *result)
			if result.Matched != "" {
				job.Status.Found++
			}
			s.mu.Unlock()
		}

		s.mu.Lock()
		job.Status.Completed = completed
		job.Status.Progress = float64(completed) / float64(total) * 100
		s.mu.Unlock()
	}

	// 判断最终状态
	s.mu.Lock()
	select {
	case <-ctx.Done():
		job.Status.Status = "stopped"
	default:
		job.Status.Status = "completed"
	}
	job.Status.Progress = 100
	job.Status.CompletedAt = time.Now()
	s.mu.Unlock()

	// 自动保存到磁盘
	s.saveScanToDisk(job.ID)
}

// executeTemplate 执行单个模板扫描（支持 extractors、变量展开、错误记录）
func (s *Scanner) executeTemplate(ctx context.Context, client *http.Client, target string, template models.POCTemplate, maxResponseSize int) *models.ScanResult {
	// 解析模板内容
	if template.Content == "" && template.FilePath != "" {
		content, err := os.ReadFile(template.FilePath)
		if err != nil {
			return &models.ScanResult{
				ID:           fmt.Sprintf("%d", time.Now().UnixNano()),
				TemplateID:   template.ID,
				TemplateName: template.Name,
				Severity:     template.Severity,
				Host:         target,
				Error:        fmt.Sprintf("读取模板文件失败: %v", err),
				Timestamp:    time.Now(),
			}
		}
		template.Content = string(content)
	}

	if template.Content == "" {
		return &models.ScanResult{
			ID:           fmt.Sprintf("%d", time.Now().UnixNano()),
			TemplateID:   template.ID,
			TemplateName: template.Name,
			Severity:     template.Severity,
			Host:         target,
			Error:        "模板内容为空",
			Timestamp:    time.Now(),
		}
	}

	// 使用 YAML 反序列化解析 HTTP 请求配置
	requests, err := parseHTTPRequestsYAML(template.Content)
	if err != nil || len(requests) == 0 {
		// 回退到旧的行解析器（向后兼容）
		requests = parseHTTPRequestsLegacy(template.Content)
	}
	if len(requests) == 0 {
		return &models.ScanResult{
			ID:           fmt.Sprintf("%d", time.Now().UnixNano()),
			TemplateID:   template.ID,
			TemplateName: template.Name,
			Severity:     template.Severity,
			Host:         target,
			Error:        "无法解析模板中的 HTTP 请求",
			Timestamp:    time.Now(),
		}
	}

	// 规范化目标 URL
	target = normalizeTarget(target)

	// 响应体大小限制
	respLimit := int64(maxResponseSize)
	if respLimit <= 0 {
		respLimit = DefaultMaxRespSize
	}

	for _, reqConfig := range requests {
		// 构建并发送请求
		result := s.sendRequest(ctx, client, target, template, reqConfig, respLimit)
		if result != nil && result.Matched != "" {
			return result
		}
		// 如果请求失败，继续尝试下一个（多步请求链）
	}

	return &models.ScanResult{
		ID:           fmt.Sprintf("%d", time.Now().UnixNano()),
		TemplateID:   template.ID,
		TemplateName: template.Name,
		Severity:     template.Severity,
		Host:         target,
		Error:        "所有请求均未匹配或失败",
		Timestamp:    time.Now(),
	}
}

// sendRequest 构建并发送单个 HTTP 请求
func (s *Scanner) sendRequest(ctx context.Context, client *http.Client, target string, template models.POCTemplate, reqConfig HTTPRequest, respLimit int64) *models.ScanResult {
	hostname := extractHostname(target)

	// 展开变量
	path := expandVariables(reqConfig.Path, target, hostname)
	if path == "" {
		path = "/"
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}

	fullURL := target + path
	fullURL = expandVariables(fullURL, target, hostname)

	method := strings.ToUpper(reqConfig.Method)
	if method == "" {
		method = "GET"
	}

	body := expandVariables(reqConfig.Body, target, hostname)
	var bodyReader io.Reader
	if body != "" {
		bodyReader = bytes.NewBufferString(body)
	}

	req, err := http.NewRequestWithContext(ctx, method, fullURL, bodyReader)
	if err != nil {
		return &models.ScanResult{
			ID:           fmt.Sprintf("%d", time.Now().UnixNano()),
			TemplateID:   template.ID,
			TemplateName: template.Name,
			Severity:     template.Severity,
			Host:         target,
			Error:        fmt.Sprintf("构造请求失败: %v", err),
			Timestamp:    time.Now(),
			Request:      fmt.Sprintf("%s %s", method, fullURL),
		}
	}

	// 设置默认 headers
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	req.Header.Set("Accept", "*/*")
	req.Header.Set("Connection", "close")

	// 设置自定义 headers（展开变量）
	for k, v := range reqConfig.Headers {
		v = expandVariables(v, target, hostname)
		req.Header.Set(k, v)
		// 自定义 Host header
		if strings.EqualFold(k, "Host") {
			req.Host = v
		}
	}

	// 记录请求
	reqStr := formatRequest(req, body)

	// 发送请求
	resp, err := client.Do(req)
	if err != nil {
		return &models.ScanResult{
			ID:           fmt.Sprintf("%d", time.Now().UnixNano()),
			TemplateID:   template.ID,
			TemplateName: template.Name,
			Severity:     template.Severity,
			Host:         target,
			Error:        fmt.Sprintf("请求失败: %v", err),
			Timestamp:    time.Now(),
			Request:      reqStr,
		}
	}

	// 读取响应
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, respLimit))
	resp.Body.Close()

	respStr := formatResponse(resp, respBody)

	// 提取数据
	extracted := make(map[string]string)
	for _, ext := range reqConfig.Extractors {
		if data := runExtractor(ext, string(respBody), resp.Header); data != nil {
			for k, v := range data {
				extracted[k] = v
			}
		}
	}

	// 检查匹配条件
	matched, matchInfo := checkMatchers(reqConfig.Matchers, resp, respBody, reqConfig.MatchersCondition)
	if matched {
		return &models.ScanResult{
			ID:            fmt.Sprintf("%d", time.Now().UnixNano()),
			TemplateID:    template.ID,
			TemplateName:  template.Name,
			Severity:      template.Severity,
			Host:          target,
			Matched:       matchInfo,
			ExtractedData: extracted,
			Timestamp:     time.Now(),
			Request:       reqStr,
			Response:      respStr,
		}
	}

	// 未匹配，跳过（仅保存匹配成功的请求/响应包）
	return nil
}

// normalizeTarget 规范化目标 URL
func normalizeTarget(target string) string {
	target = strings.TrimSpace(target)
	if !strings.HasPrefix(target, "http://") && !strings.HasPrefix(target, "https://") {
		target = "http://" + target
	}
	target = strings.TrimSuffix(target, "/")
	return target
}

// validateTarget 校验目标 URL（防 SSRF）
func validateTarget(target string) error {
	target = strings.TrimSpace(target)
	if len(target) < MinTargetLen {
		return fmt.Errorf("目标为空")
	}

	// 确保有 scheme
	if !strings.Contains(target, "://") {
		target = "http://" + target
	}

	u, err := url.Parse(target)
	if err != nil {
		return fmt.Errorf("无法解析目标 URL: %v", err)
	}

	// 检查 scheme
	if !allowedSchemes[u.Scheme] {
		return fmt.Errorf("不允许的协议: %s", u.Scheme)
	}

	// 解析 IP
	host := u.Hostname()
	ip := net.ParseIP(host)
	if ip == nil {
		// DNS 解析
		ips, err := net.LookupIP(host)
		if err != nil {
			return nil // DNS 解析失败，允许继续（可能是外网域名）
		}
		if len(ips) == 0 {
			return nil
		}
		ip = ips[0]
	}

	// 检查是否内网地址
	for _, n := range privateNets {
		if n.Contains(ip) {
			return fmt.Errorf("目标为内网地址 (%s)，已拒绝（可启用 AllowPrivate 选项）", ip.String())
		}
	}

	return nil
}

// expandVariables 展开 Nuclei 模板变量
func expandVariables(s string, target, hostname string) string {
	if s == "" {
		return s
	}
	s = strings.ReplaceAll(s, "{{BaseURL}}", target)
	s = strings.ReplaceAll(s, "{{RootURL}}", target)
	s = strings.ReplaceAll(s, "{{Hostname}}", hostname)
	s = strings.ReplaceAll(s, "{{Host}}", hostname)
	s = strings.ReplaceAll(s, "{{Scheme}}", extractScheme(target))

	// 动态变量
	s = strings.ReplaceAll(s, "{{randstr}}", randStr(8))
	s = strings.ReplaceAll(s, "{{randstr_10}}", randStr(10))
	s = strings.ReplaceAll(s, "{{randint}}", fmt.Sprintf("%d", rand.Intn(999999)))
	s = strings.ReplaceAll(s, "{{unix_time}}", fmt.Sprintf("%d", time.Now().Unix()))
	s = strings.ReplaceAll(s, "{{timestamp}}", fmt.Sprintf("%d", time.Now().Unix()))

	return s
}

// randStr 生成随机字符串
func randStr(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

func extractScheme(target string) string {
	if strings.HasPrefix(target, "https://") {
		return "https"
	}
	return "http"
}

// extractHostname 从 URL 中提取主机名
func extractHostname(rawURL string) string {
	rawURL = strings.TrimPrefix(rawURL, "http://")
	rawURL = strings.TrimPrefix(rawURL, "https://")
	parts := strings.Split(rawURL, "/")
	return parts[0]
}

// HTTPRequest HTTP 请求配置
type HTTPRequest struct {
	Method            string
	Path              string
	Headers           map[string]string
	Body              string
	Matchers          []Matcher
	MatchersCondition string    // "and" or "or", 默认为 "or"
	Extractors        []Extractor
}

// Matcher 匹配器
type Matcher struct {
	Type      string   // status, word, regex
	Words     []string
	Status    []int
	Regex     []string
	Part      string // body, header, all
	Condition string // and, or (matcher 内部多个 word/regex 之间的条件)
	Negative  bool
}

// Extractor 数据提取器
type Extractor struct {
	Type   string   // regex, kval, json
	Regex  []string // 正则表达式
	Part   string   // body, header
	KVal   []string // key:value 提取
	Name   string   // 提取器名称
}

// —— YAML 解析结构 ——

// nucleiYAML Nuclei 模板顶层结构
type nucleiYAML struct {
	ID   string `yaml:"id"`
	Info struct {
		Name        string `yaml:"name"`
		Author      string `yaml:"author"`
		Severity    string `yaml:"severity"`
		Description string `yaml:"description"`
		Tags        string `yaml:"tags"`
	} `yaml:"info"`
	HTTP []nucleiHTTPReq `yaml:"http"`
}

// nucleiHTTPReq Nuclei HTTP 请求结构
type nucleiHTTPReq struct {
	Method            string            `yaml:"method"`
	Path              []string          `yaml:"path"`
	Raw               []string          `yaml:"raw"`
	Headers           map[string]string `yaml:"headers"`
	Body              string            `yaml:"body"`
	MatchersCondition string            `yaml:"matchers-condition"`
	Matchers          []nucleiMatcher   `yaml:"matchers"`
	Extractors        []nucleiExtractor `yaml:"extractors"`
}

// nucleiMatcher Nuclei 匹配器结构
type nucleiMatcher struct {
	Type      string   `yaml:"type"`
	Words     []string `yaml:"words"`
	Status    []int    `yaml:"status"`
	Regex     []string `yaml:"regex"`
	Part      string   `yaml:"part"`
	Condition string   `yaml:"condition"`
	Negative  bool     `yaml:"negative"`
}

// nucleiExtractor Nuclei 提取器结构
type nucleiExtractor struct {
	Type  string   `yaml:"type"`
	Regex []string `yaml:"regex"`
	Part  string   `yaml:"part"`
	KVal  []string `yaml:"kval"`
	Name  string   `yaml:"name"`
}

// parseHTTPRequestsYAML 使用 YAML 反序列化解析 HTTP 请求（新解析器）
func parseHTTPRequestsYAML(content string) ([]HTTPRequest, error) {
	var nt nucleiYAML
	if err := yaml.Unmarshal([]byte(content), &nt); err != nil {
		return nil, fmt.Errorf("YAML 解析失败: %w", err)
	}

	var requests []HTTPRequest
	for _, nhr := range nt.HTTP {
		req := HTTPRequest{
			Method:            nhr.Method,
			Headers:           make(map[string]string),
			Matchers:          make([]Matcher, 0),
			MatchersCondition: nhr.MatchersCondition,
		}

		// Headers
		for k, v := range nhr.Headers {
			req.Headers[k] = v
		}

		// Path
		if len(nhr.Path) > 0 {
			req.Path = nhr.Path[0]
		}

		// Method: 如果是 raw 请求，提取首行
		if nhr.Method == "" && len(nhr.Raw) > 0 {
			req.Method, req.Path, req.Headers, req.Body = parseRawRequest(nhr.Raw[0])
		}

		// Body
		if nhr.Body != "" {
			req.Body = nhr.Body
		}

		// Matchers
		for _, nm := range nhr.Matchers {
			req.Matchers = append(req.Matchers, Matcher{
				Type:      nm.Type,
				Words:     nm.Words,
				Status:    nm.Status,
				Regex:     nm.Regex,
				Part:      nm.Part,
				Condition: nm.Condition,
				Negative:  nm.Negative,
			})
		}

		// Extractors
		for _, ne := range nhr.Extractors {
			req.Extractors = append(req.Extractors, Extractor{
				Type:  ne.Type,
				Regex: ne.Regex,
				Part:  ne.Part,
				KVal:  ne.KVal,
				Name:  ne.Name,
			})
		}

		requests = append(requests, req)
	}

	return requests, nil
}

// parseRawRequest 解析 Raw HTTP 请求字符串
func parseRawRequest(raw string) (method, path string, headers map[string]string, body string) {
	headers = make(map[string]string)
	lines := strings.Split(raw, "\n")
	if len(lines) == 0 {
		return
	}

	// 解析请求行: METHOD /path HTTP/1.1
	firstLine := strings.TrimSpace(lines[0])
	parts := strings.SplitN(firstLine, " ", 3)
	if len(parts) >= 2 {
		method = strings.ToUpper(strings.TrimSpace(parts[0]))
		path = strings.TrimSpace(parts[1])
	}

	// 解析 headers 和 body
	inBody := false
	for i := 1; i < len(lines); i++ {
		line := strings.TrimSpace(lines[i])
		if line == "" || line == "\r" {
			inBody = true
			continue
		}
		if !inBody {
			if idx := strings.Index(line, ":"); idx > 0 {
				key := strings.TrimSpace(line[:idx])
				val := strings.TrimSpace(line[idx+1:])
				headers[key] = val
			}
		} else {
			if body != "" {
				body += "\n"
			}
			body += line
		}
	}

	return
}

// runExtractor 执行数据提取
func runExtractor(ext Extractor, body string, headers http.Header) map[string]string {
	result := make(map[string]string)

	switch ext.Type {
	case "regex":
		// 选择匹配内容
		content := body
		if ext.Part == "header" {
			content = formatHeaders(headers)
		}
		for _, pattern := range ext.Regex {
			re, err := regexp.Compile(pattern)
			if err != nil {
				continue
			}
			matches := re.FindStringSubmatch(content)
			if len(matches) > 1 {
				name := ext.Name
				if name == "" {
					name = fmt.Sprintf("extract_%d", len(result))
				}
				result[name] = matches[1]
			}
		}
	case "kval":
		// key:value 提取（从 body 或 headers）
		content := body
		if ext.Part == "header" {
			content = formatHeaders(headers)
		}
		for _, kv := range ext.KVal {
			if idx := strings.Index(content, kv); idx >= 0 {
				name := ext.Name
				if name == "" {
					name = fmt.Sprintf("extract_%d", len(result))
				}
				// 提取 "key: value" 中冒号后的值
				lineEnd := strings.Index(content[idx:], "\n")
				if lineEnd == -1 {
					lineEnd = len(content) - idx
				}
				line := content[idx : idx+lineEnd]
				if colonIdx := strings.Index(line, ":"); colonIdx > 0 {
					result[name] = strings.TrimSpace(line[colonIdx+1:])
				}
			}
		}
	}

	if len(result) == 0 {
		return nil
	}
	return result
}

// parseHTTPRequestsLegacy 旧的逐行解析器（向后兼容）
func parseHTTPRequestsLegacy(content string) []HTTPRequest {
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
		} else if strings.HasPrefix(trimmed, "- \"") || strings.HasPrefix(trimmed, "- '") {
			path := strings.Trim(trimmed, "- \"'")
			path = strings.TrimPrefix(path, "{{BaseURL}}")
			// 如果是其他变量前缀（如 {{RootURL}}），也去掉
			path = strings.TrimPrefix(path, "{{RootURL}}")
			currentReq.Path = path
		} else if strings.HasPrefix(trimmed, "body:") {
			currentReq.Body = strings.Trim(strings.TrimPrefix(trimmed, "body:"), " \"'")
		} else if strings.HasPrefix(trimmed, "matchers-condition:") {
			condStr := strings.Trim(strings.TrimPrefix(trimmed, "matchers-condition:"), " \"'")
			condStr = strings.ToLower(condStr)
			if condStr == "and" || condStr == "or" {
				currentReq.MatchersCondition = condStr
			}
			continue
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

// checkMatchers 检查所有匹配器
// matchersCondition: "and" 表示所有 matcher 都必须匹配, "or"(默认) 表示任一匹配即可
func checkMatchers(matchers []Matcher, resp *http.Response, body []byte, matchersCondition string) (bool, string) {
	if len(matchers) == 0 {
		// 没有 matcher，默认检查状态码 200
		if resp.StatusCode == 200 {
			return true, fmt.Sprintf("Status: %d", resp.StatusCode)
		}
		return false, ""
	}

	if matchersCondition == "" {
		matchersCondition = "or" // 默认 OR
	}

	bodyStr := string(body)
	headerStr := formatHeaders(resp.Header)
	allStr := headerStr + "\n" + bodyStr

	var matchedInfos []string

	for _, m := range matchers {
		matched := checkSingleMatcher(m, resp, bodyStr, headerStr, allStr)

		if m.Negative {
			matched = !matched
		}

		if matched {
			matchedInfos = append(matchedInfos, fmt.Sprintf("Matched: type=%s", m.Type))
		}
	}

	if matchersCondition == "and" {
		// AND: 所有 matcher 都必须匹配
		if len(matchedInfos) == len(matchers) {
			return true, strings.Join(matchedInfos, "; ")
		}
		return false, ""
	}

	// OR: 任一 matcher 匹配即可
	if len(matchedInfos) > 0 {
		return true, strings.Join(matchedInfos, "; ")
	}
	return false, ""
}

// checkSingleMatcher 检查单个匹配器
func checkSingleMatcher(m Matcher, resp *http.Response, bodyStr, headerStr, allStr string) bool {
	switch m.Type {
	case "status":
		for _, code := range m.Status {
			if resp.StatusCode == code {
				return true
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
			for _, word := range m.Words {
				if !strings.Contains(content, word) {
					return false
				}
			}
			return len(m.Words) > 0
		}
		// OR: 任意 word 匹配
		for _, word := range m.Words {
			if strings.Contains(content, word) {
				return true
			}
		}
	case "regex":
		content := bodyStr
		if m.Part == "header" {
			content = headerStr
		} else if m.Part == "all" {
			content = allStr
		}

		if m.Condition == "and" {
			for _, pattern := range m.Regex {
				if !matchRegex(content, pattern) {
					return false
				}
			}
			return len(m.Regex) > 0
		}
		// OR: 任意 regex 匹配
		for _, pattern := range m.Regex {
			if matchRegex(content, pattern) {
				return true
			}
		}
	}
	return false
}

func formatHeaders(headers http.Header) string {
	var sb strings.Builder
	for k, v := range headers {
		sb.WriteString(fmt.Sprintf("%s: %s\n", k, strings.Join(v, ", ")))
	}
	return sb.String()
}

// regexCache 缓存已编译的正则表达式，避免重复编译
var regexCache = sync.Map{}

func matchRegex(content, pattern string) bool {
	if pattern == "" {
		return false
	}

	// 尝试从缓存获取
	if cached, ok := regexCache.Load(pattern); ok {
		return cached.(*regexp.Regexp).MatchString(content)
	}

	// 编译并缓存
	re, err := regexp.Compile(pattern)
	if err != nil {
		// 如果正则编译失败，回退到子串匹配（兼容含特殊字符的简单模式）
		return strings.Contains(content, pattern)
	}
	regexCache.Store(pattern, re)
	return re.MatchString(content)
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
// DeleteScan 删除扫描任务及其结果
func (s *Scanner) DeleteScan(scanID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	job, ok := s.scans[scanID]
	if !ok {
		return fmt.Errorf("扫描任务不存在: %s", scanID)
	}

	// 如果正在运行，先停止
	if job.Cancel != nil && job.Status.Status == "running" {
		job.Cancel()
	}

	delete(s.scans, scanID)
	delete(s.results, scanID)

	// 删除磁盘文件
	if s.scansDir != "" {
		filePath := filepath.Join(s.scansDir, scanID+".json")
		os.Remove(filePath)
	}
	return nil
}

// ExportScanResults 导出扫描结果为 JSON
func (s *Scanner) ExportScanResults(scanID string) (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	results, ok := s.results[scanID]
	if !ok {
		return "", fmt.Errorf("扫描任务不存在: %s", scanID)
	}

	type ExportResult struct {
		TemplateName string `json:"templateName"`
		Severity     string `json:"severity"`
		Host         string `json:"host"`
		Matched      string `json:"matched"`
		Request      string `json:"request,omitempty"`
		Response     string `json:"response,omitempty"`
	}
	exports := make([]ExportResult, 0, len(results))
	for _, r := range results {
		if r.Matched != "" {
			exports = append(exports, ExportResult{
				TemplateName: r.TemplateName,
				Severity:     r.Severity,
				Host:         r.Host,
				Matched:      r.Matched,
				Request:      r.Request,
				Response:     r.Response,
			})
		}
	}

	data, err := json.MarshalIndent(exports, "", "  ")
	if err != nil {
		return "", err
	}
	return string(data), nil
}
