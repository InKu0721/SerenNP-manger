package poc

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"nuclei-poc-manager/internal/models"

	"gopkg.in/yaml.v3"
)

// Manager POC模板管理器
type Manager struct {
	templatesDir string
	cache        map[string]models.POCTemplate
	mu           sync.RWMutex
	loaded       bool
}

// NucleiTemplate Nuclei模板结构（用于解析YAML）
type NucleiTemplate struct {
	ID   string `yaml:"id"`
	Info struct {
		Name        string   `yaml:"name"`
		Author      string   `yaml:"author"`
		Severity    string   `yaml:"severity"`
		Description string   `yaml:"description"`
		Reference   []string `yaml:"reference"`
		Tags        string   `yaml:"tags"`
	} `yaml:"info"`
}

// NewManager 创建新的Manager实例
func NewManager(templatesDir string) *Manager {
	m := &Manager{
		templatesDir: templatesDir,
		cache:        make(map[string]models.POCTemplate),
		loaded:       false,
	}
	// 异步加载，加快启动速度
	go m.loadAllLazy()
	return m
}

// IsLoaded 检查模板是否已加载完成
func (m *Manager) IsLoaded() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.loaded
}

// GetTemplatesDir 获取模板目录
func (m *Manager) GetTemplatesDir() string {
	return m.templatesDir
}

// loadAllLazy 延迟加载所有模板（只加载元数据，不读取完整内容）
func (m *Manager) loadAllLazy() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.cache = make(map[string]models.POCTemplate)

	err := filepath.Walk(m.templatesDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			return nil
		}
		if !strings.HasSuffix(path, ".yaml") && !strings.HasSuffix(path, ".yml") {
			return nil
		}

		// 只加载元数据，不读取完整内容
		template, err := m.loadFileMetadata(path, info)
		if err != nil {
			return nil
		}

		m.cache[template.ID] = *template
		return nil
	})

	m.loaded = true
	return err
}

// loadAll 加载所有模板（兼容旧接口）
func (m *Manager) loadAll() error {
	return m.loadAllLazy()
}

// loadFileMetadata 只加载文件元数据（快速扫描前100行）
func (m *Manager) loadFileMetadata(path string, info os.FileInfo) (*models.POCTemplate, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	// 只读取前100行来解析元数据
	scanner := bufio.NewScanner(file)
	var lines []string
	lineCount := 0
	for scanner.Scan() && lineCount < 100 {
		lines = append(lines, scanner.Text())
		lineCount++
	}

	content := strings.Join(lines, "\n")
	template, err := m.parseYAMLContent(content)
	if err != nil {
		// 如果解析失败，尝试从文件名生成ID
		template = &models.POCTemplate{
			ID:   strings.TrimSuffix(filepath.Base(path), filepath.Ext(path)),
			Name: strings.TrimSuffix(filepath.Base(path), filepath.Ext(path)),
		}
	}

	template.FilePath = path
	// 不存储完整内容，需要时再读取
	template.Content = ""

	// 从路径提取分类
	relPath, _ := filepath.Rel(m.templatesDir, path)
	parts := strings.Split(relPath, string(os.PathSeparator))
	if len(parts) > 1 {
		template.Category = parts[0]
	}

	// 使用传入的文件信息
	if info != nil {
		template.UpdatedAt = info.ModTime()
		template.CreatedAt = info.ModTime()
	}

	return template, nil
}

// loadFile 加载单个模板文件（完整内容）
func (m *Manager) loadFile(path string) (*models.POCTemplate, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	template, err := m.parseYAMLContent(string(content))
	if err != nil {
		return nil, err
	}

	template.FilePath = path
	template.Content = string(content)

	// 从路径提取分类
	relPath, _ := filepath.Rel(m.templatesDir, path)
	parts := strings.Split(relPath, string(os.PathSeparator))
	if len(parts) > 1 {
		template.Category = parts[0]
	}

	// 获取文件修改时间
	info, err := os.Stat(path)
	if err == nil {
		template.UpdatedAt = info.ModTime()
		template.CreatedAt = info.ModTime()
	}

	return template, nil
}

// parseYAMLContent 解析YAML内容
func (m *Manager) parseYAMLContent(content string) (*models.POCTemplate, error) {
	var nt NucleiTemplate
	if err := yaml.Unmarshal([]byte(content), &nt); err != nil {
		return nil, err
	}

	if nt.ID == "" {
		return nil, fmt.Errorf("模板缺少ID字段")
	}

	template := &models.POCTemplate{
		ID:          nt.ID,
		Name:        nt.Info.Name,
		Author:      nt.Info.Author,
		Severity:    nt.Info.Severity,
		Description: nt.Info.Description,
		Reference:   nt.Info.Reference,
		Content:     content,
	}

	if nt.Info.Tags != "" {
		template.Tags = strings.Split(nt.Info.Tags, ",")
		for i := range template.Tags {
			template.Tags[i] = strings.TrimSpace(template.Tags[i])
		}
	}

	return template, nil
}

// ParseYAML 公开的YAML解析方法
func (m *Manager) ParseYAML(content string) (*models.POCTemplate, error) {
	return m.parseYAMLContent(content)
}

// ToYAML 将模板导出为YAML
func (m *Manager) ToYAML(template models.POCTemplate) (string, error) {
	if template.Content != "" {
		return template.Content, nil
	}

	data := map[string]interface{}{
		"id": template.ID,
		"info": map[string]interface{}{
			"name":        template.Name,
			"author":      template.Author,
			"severity":    template.Severity,
			"description": template.Description,
			"tags":        strings.Join(template.Tags, ","),
		},
	}

	if len(template.Reference) > 0 {
		data["info"].(map[string]interface{})["reference"] = template.Reference
	}

	output, err := yaml.Marshal(data)
	if err != nil {
		return "", err
	}

	return string(output), nil
}

// GetAll 获取所有模板（只返回元数据，不包含完整内容）
func (m *Manager) GetAll() ([]models.POCTemplate, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	templates := make([]models.POCTemplate, 0, len(m.cache))
	for _, t := range m.cache {
		templates = append(templates, t)
	}

	return templates, nil
}

// GetAllPaginated 分页获取模板
func (m *Manager) GetAllPaginated(page, pageSize int) ([]models.POCTemplate, int, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	total := len(m.cache)
	templates := make([]models.POCTemplate, 0, pageSize)
	
	i := 0
	start := page * pageSize
	end := start + pageSize
	
	for _, t := range m.cache {
		if i >= start && i < end {
			templates = append(templates, t)
		}
		i++
		if i >= end {
			break
		}
	}

	return templates, total, nil
}

// GetByID 根据ID获取模板（包含完整内容）
func (m *Manager) GetByID(id string) (*models.POCTemplate, error) {
	m.mu.RLock()
	template, ok := m.cache[id]
	m.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("模板不存在: %s", id)
	}

	// 如果没有内容，从文件读取
	if template.Content == "" && template.FilePath != "" {
		content, err := os.ReadFile(template.FilePath)
		if err != nil {
			return nil, err
		}
		template.Content = string(content)
	}

	return &template, nil
}

// GetCount 获取模板总数
func (m *Manager) GetCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.cache)
}

// Save 保存模板
func (m *Manager) Save(template models.POCTemplate) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// 确定保存路径
	var filePath string
	if template.FilePath != "" {
		filePath = template.FilePath
	} else {
		categoryDir := template.Category
		if categoryDir == "" {
			categoryDir = "custom"
		}
		dir := filepath.Join(m.templatesDir, categoryDir)
		os.MkdirAll(dir, 0755)
		filePath = filepath.Join(dir, template.ID+".yaml")
	}

	template.FilePath = filePath

	// 如果没有Content，生成YAML
	if template.Content == "" {
		content, err := m.ToYAML(template)
		if err != nil {
			return err
		}
		template.Content = content
	}

	// 写入文件
	if err := os.WriteFile(filePath, []byte(template.Content), 0644); err != nil {
		return err
	}

	m.cache[template.ID] = template
	return nil
}

// Delete 删除模板
func (m *Manager) Delete(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	template, ok := m.cache[id]
	if !ok {
		return fmt.Errorf("模板不存在: %s", id)
	}

	if template.FilePath != "" {
		if err := os.Remove(template.FilePath); err != nil && !os.IsNotExist(err) {
			return err
		}
	}

	delete(m.cache, id)
	return nil
}

// Refresh 刷新缓存
func (m *Manager) Refresh() error {
	return m.loadAll()
}


