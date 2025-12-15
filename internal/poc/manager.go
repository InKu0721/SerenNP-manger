package poc

import (
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
	}
	m.loadAll()
	return m
}

// GetTemplatesDir 获取模板目录
func (m *Manager) GetTemplatesDir() string {
	return m.templatesDir
}

// loadAll 加载所有模板
func (m *Manager) loadAll() error {
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

		template, err := m.loadFile(path)
		if err != nil {
			return nil
		}

		m.cache[template.ID] = *template
		return nil
	})

	return err
}

// loadFile 加载单个模板文件
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

// GetAll 获取所有模板
func (m *Manager) GetAll() ([]models.POCTemplate, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	templates := make([]models.POCTemplate, 0, len(m.cache))
	for _, t := range m.cache {
		templates = append(templates, t)
	}

	return templates, nil
}

// GetByID 根据ID获取模板
func (m *Manager) GetByID(id string) (*models.POCTemplate, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	template, ok := m.cache[id]
	if !ok {
		return nil, fmt.Errorf("模板不存在: %s", id)
	}

	return &template, nil
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


