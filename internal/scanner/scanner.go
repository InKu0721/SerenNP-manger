package scanner

import (
	"context"
	"fmt"
	"math/rand"
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
	ID        string
	Status    *models.ScanStatus
	Cancel    context.CancelFunc
	Templates []models.POCTemplate
	Targets   []string
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
		ID:        scanID,
		Status:    status,
		Cancel:    cancel,
		Templates: templates,
		Targets:   targets,
	}

	s.mu.Lock()
	s.scans[scanID] = job
	s.results[scanID] = []models.ScanResult{}
	s.mu.Unlock()

	go s.runMockScan(scanCtx, job)

	return scanID, nil
}

// runMockScan 模拟扫描（用于测试 UI）
func (s *Scanner) runMockScan(ctx context.Context, job *ScanJob) {
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

			// 模拟扫描延迟
			time.Sleep(time.Millisecond * time.Duration(100+rand.Intn(200)))

			completed++

			// 随机生成一些发现
			if rand.Float32() < 0.3 {
				result := models.ScanResult{
					ID:           fmt.Sprintf("%d", time.Now().UnixNano()),
					ScanID:       job.ID,
					TemplateID:   template.ID,
					TemplateName: template.Name,
					Severity:     template.Severity,
					Host:         target,
					Matched:      fmt.Sprintf("模拟匹配: %s", template.Name),
					Timestamp:    time.Now(),
					Request:      fmt.Sprintf("GET %s HTTP/1.1\nHost: %s\nUser-Agent: Nuclei\n", target, target),
					Response:     "HTTP/1.1 200 OK\nContent-Type: text/html\n\n<html>...</html>",
				}

				s.mu.Lock()
				s.results[job.ID] = append(s.results[job.ID], result)
				job.Status.Found++
				s.mu.Unlock()
			}

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
