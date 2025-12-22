package models

import "time"

// POCTemplate POC模板结构
type POCTemplate struct {
	ID          string    `json:"id" yaml:"id"`
	Name        string    `json:"name" yaml:"info>name"`
	Author      string    `json:"author" yaml:"info>author"`
	Severity    string    `json:"severity" yaml:"info>severity"`
	Description string    `json:"description" yaml:"info>description"`
	Reference   []string  `json:"reference" yaml:"info>reference"`
	Tags        []string  `json:"tags" yaml:"info>tags"`
	Category    string    `json:"category"`
	Content     string    `json:"content"`
	FilePath    string    `json:"filePath"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// ScanRequest 扫描请求
type ScanRequest struct {
	Targets     []string `json:"targets"`
	TemplateIDs []string `json:"templateIds"`
	Options     ScanOptions `json:"options"`
}

// ScanOptions 扫描选项
type ScanOptions struct {
	Concurrency int  `json:"concurrency"`
	Timeout     int  `json:"timeout"`
	RateLimit   int  `json:"rateLimit"`
	BulkSize    int  `json:"bulkSize"`
	Headless    bool `json:"headless"`
}

// ScanStatus 扫描状态
type ScanStatus struct {
	ID           string    `json:"id"`
	Status       string    `json:"status"` // pending, running, completed, failed, stopped
	Progress     float64   `json:"progress"`
	Total        int       `json:"total"`
	Completed    int       `json:"completed"`
	Found        int       `json:"found"`
	StartedAt    time.Time `json:"startedAt"`
	CompletedAt  time.Time `json:"completedAt,omitempty"`
	Error        string    `json:"error,omitempty"`
	Targets      []string  `json:"targets"`
	TemplateIDs  []string  `json:"templateIds"`
}

// ScanResult 扫描结果
type ScanResult struct {
	ID            string            `json:"id"`
	ScanID        string            `json:"scanId"`
	TemplateID    string            `json:"templateId"`
	TemplateName  string            `json:"templateName"`
	Severity      string            `json:"severity"`
	Host          string            `json:"host"`
	Matched       string            `json:"matched"`
	ExtractedData map[string]string `json:"extractedData,omitempty"`
	Timestamp     time.Time         `json:"timestamp"`
	Request       string            `json:"request,omitempty"`
	Response      string            `json:"response,omitempty"`
}

// Stats 统计信息
type Stats struct {
	TotalPOCs    int            `json:"totalPocs"`
	TotalScans   int            `json:"totalScans"`
	ByCategory   map[string]int `json:"byCategory"`
	BySeverity   map[string]int `json:"bySeverity"`
}

// Settings 应用设置
type Settings struct {
	Concurrency  int    `json:"concurrency"`
	Timeout      int    `json:"timeout"`
	RateLimit    int    `json:"rateLimit"`
	BulkSize     int    `json:"bulkSize"`
	TemplatesDir string `json:"templatesDir"`
	ProxyURL     string `json:"proxyUrl,omitempty"`
	Headless     bool   `json:"headless"`
}









