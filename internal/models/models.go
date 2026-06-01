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
	Targets     []string    `json:"targets"`
	TemplateIDs []string    `json:"templateIds"`
	Options     ScanOptions `json:"options"`
	Name        string      `json:"name,omitempty"` // 任务名称
}

// ScanOptions 扫描选项
type ScanOptions struct {
	Concurrency     int    `json:"concurrency"`
	Timeout         int    `json:"timeout"`
	RateLimit       int    `json:"rateLimit"`
	BulkSize        int    `json:"bulkSize"`
	Headless        bool   `json:"headless"`
	MaxResponseSize int    `json:"maxResponseSize"` // 响应体最大读取大小（字节），0=默认1MB
	RetryCount      int    `json:"retryCount"`      // 失败重试次数，0=不重试
	AllowPrivate    bool   `json:"allowPrivate"`     // 是否允许扫描内网地址
	ProxyURL        string `json:"proxyUrl,omitempty"`
}

// ScanStatus 扫描状态
type ScanStatus struct {
	ID           string    `json:"id"`
	Name         string    `json:"name,omitempty"` // 任务名称
	Status       string    `json:"status"`         // pending, running, completed, failed, stopped
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
	Error         string            `json:"error,omitempty"`    // 请求失败原因
	Timestamp     time.Time         `json:"timestamp"`
	Request       string            `json:"request,omitempty"`
	Response      string            `json:"response,omitempty"`
}

// Stats 统计信息
type Stats struct {
	TotalPOCs      int              `json:"totalPocs"`
	TotalScans     int              `json:"totalScans"`
	TotalFindings  int              `json:"totalFindings"`
	SecurityScore  int              `json:"securityScore"`
	ByCategory     map[string]int   `json:"byCategory"`
	BySeverity     map[string]int   `json:"bySeverity"`
	SeverityCounts map[string]int   `json:"severityCounts"`
	RecentScans    []ScanStatus     `json:"recentScans"`
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









