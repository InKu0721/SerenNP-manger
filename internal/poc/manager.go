package poc

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"nuclei-poc-manager/internal/models"

	"gopkg.in/yaml.v3"
)

// Manager POC模板管理器
type Manager struct {
	templatesDir    string
	cache           map[string]models.POCTemplate     // 主缓存: ID -> Template
	categoryIndex   map[string][]string               // 分类索引: Category -> []ID
	severityIndex   map[string][]string               // 严重性索引: Severity -> []ID
	mu              sync.RWMutex
	loaded          bool
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
		templatesDir:  templatesDir,
		cache:         make(map[string]models.POCTemplate),
		categoryIndex: make(map[string][]string),
		severityIndex: make(map[string][]string),
		loaded:        false,
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

	// 重置所有缓存和索引
	m.cache = make(map[string]models.POCTemplate)
	m.categoryIndex = make(map[string][]string)
	m.severityIndex = make(map[string][]string)

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

		// 存入主缓存
		m.cache[template.ID] = *template
		
		// 更新分类索引
		cat := template.Category
		if cat == "" {
			cat = "未分类"
		}
		m.categoryIndex[cat] = append(m.categoryIndex[cat], template.ID)
		
		// 更新严重性索引
		sev := template.Severity
		if sev == "" {
			sev = "info"
		}
		m.severityIndex[sev] = append(m.severityIndex[sev], template.ID)
		
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

	// 从路径提取分类（支持多级分类，最多三级）
	relPath, _ := filepath.Rel(m.templatesDir, path)
	parts := strings.Split(relPath, string(os.PathSeparator))
	if len(parts) > 1 {
		// 最多取前三级作为分类路径
		maxLevels := 3
		if len(parts)-1 < maxLevels {
			maxLevels = len(parts) - 1
		}
		categoryParts := parts[:maxLevels]
		template.Category = strings.Join(categoryParts, "/")
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

	// 从路径提取分类（支持多级分类，最多三级）
	relPath, _ := filepath.Rel(m.templatesDir, path)
	parts := strings.Split(relPath, string(os.PathSeparator))
	if len(parts) > 1 {
		// 最多取前三级作为分类路径
		maxLevels := 3
		if len(parts)-1 < maxLevels {
			maxLevels = len(parts) - 1
		}
		categoryParts := parts[:maxLevels]
		template.Category = strings.Join(categoryParts, "/")
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

	// 获取旧模板（用于更新索引）
	oldTemplate, existed := m.cache[template.ID]

	// 确定保存路径（支持多级分类）
	var filePath string
	if template.FilePath != "" {
		filePath = template.FilePath
	} else {
		categoryDir := template.Category
		if categoryDir == "" {
			categoryDir = "custom"
		}
		// 将分类路径转换为目录路径（支持多级）
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

	// 更新缓存
	m.cache[template.ID] = template

	// 更新分类索引
	newCat := template.Category
	if newCat == "" {
		newCat = "未分类"
	}
	
	if existed {
		oldCat := oldTemplate.Category
		if oldCat == "" {
			oldCat = "未分类"
		}
		// 如果分类变了，从旧索引移除
		if oldCat != newCat {
			m.removeFromIndex(m.categoryIndex, oldCat, template.ID)
			m.categoryIndex[newCat] = append(m.categoryIndex[newCat], template.ID)
		}
		// 更新严重性索引
		oldSev := oldTemplate.Severity
		if oldSev == "" {
			oldSev = "info"
		}
		newSev := template.Severity
		if newSev == "" {
			newSev = "info"
		}
		if oldSev != newSev {
			m.removeFromIndex(m.severityIndex, oldSev, template.ID)
			m.severityIndex[newSev] = append(m.severityIndex[newSev], template.ID)
		}
	} else {
		// 新模板，添加到索引
		m.categoryIndex[newCat] = append(m.categoryIndex[newCat], template.ID)
		newSev := template.Severity
		if newSev == "" {
			newSev = "info"
		}
		m.severityIndex[newSev] = append(m.severityIndex[newSev], template.ID)
	}

	return nil
}

// removeFromIndex 从索引中移除ID
func (m *Manager) removeFromIndex(index map[string][]string, key, id string) {
	if ids, ok := index[key]; ok {
		for i, v := range ids {
			if v == id {
				index[key] = append(ids[:i], ids[i+1:]...)
				break
			}
		}
	}
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

	// 从索引中移除
	cat := template.Category
	if cat == "" {
		cat = "未分类"
	}
	m.removeFromIndex(m.categoryIndex, cat, id)
	
	sev := template.Severity
	if sev == "" {
		sev = "info"
	}
	m.removeFromIndex(m.severityIndex, sev, id)

	delete(m.cache, id)
	return nil
}

// Refresh 刷新缓存
func (m *Manager) Refresh() error {
	return m.loadAll()
}

// GetByCategory 根据分类快速获取模板（使用索引）
func (m *Manager) GetByCategory(category string) []models.POCTemplate {
	m.mu.RLock()
	defer m.mu.RUnlock()

	ids, ok := m.categoryIndex[category]
	if !ok {
		return nil
	}

	templates := make([]models.POCTemplate, 0, len(ids))
	for _, id := range ids {
		if t, ok := m.cache[id]; ok {
			templates = append(templates, t)
		}
	}
	return templates
}

// GetBySeverity 根据严重性快速获取模板（使用索引）
func (m *Manager) GetBySeverity(severity string) []models.POCTemplate {
	m.mu.RLock()
	defer m.mu.RUnlock()

	ids, ok := m.severityIndex[severity]
	if !ok {
		return nil
	}

	templates := make([]models.POCTemplate, 0, len(ids))
	for _, id := range ids {
		if t, ok := m.cache[id]; ok {
			templates = append(templates, t)
		}
	}
	return templates
}

// GetCategoriesWithCount 获取所有分类及其模板数量
func (m *Manager) GetCategoriesWithCount() map[string]int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make(map[string]int)
	for cat, ids := range m.categoryIndex {
		result[cat] = len(ids)
	}
	return result
}

// CreateCategory 创建新分类（支持多级分类，使用 "/" 分隔）
func (m *Manager) CreateCategory(categoryName string) error {
	if categoryName == "" {
		return fmt.Errorf("分类名称不能为空")
	}

	// 检查分类名是否合法（允许 "/" 作为分隔符，但不能包含其他特殊字符）
	invalidChars := `\:*?"<>|`
	for _, char := range invalidChars {
		if strings.ContainsRune(categoryName, char) {
			return fmt.Errorf("分类名称不能包含特殊字符: %c", char)
		}
	}

	// 检查分类层级（最多三级）
	parts := strings.Split(categoryName, "/")
	if len(parts) > 3 {
		return fmt.Errorf("分类最多支持三级，当前: %d 级", len(parts))
	}

	// 检查每一级名称是否合法
	for i, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			return fmt.Errorf("分类名称第 %d 级不能为空", i+1)
		}
		if strings.ContainsAny(part, invalidChars) {
			return fmt.Errorf("分类名称第 %d 级包含非法字符", i+1)
		}
	}

	// 将分类路径转换为目录路径
	categoryDir := filepath.Join(m.templatesDir, categoryName)
	
	// 检查目录是否已存在
	if _, err := os.Stat(categoryDir); err == nil {
		return fmt.Errorf("分类已存在: %s", categoryName)
	}

	// 创建多级目录
	if err := os.MkdirAll(categoryDir, 0755); err != nil {
		return fmt.Errorf("创建分类目录失败: %v", err)
	}

	// 更新索引（即使目录为空也要记录）
	m.mu.Lock()
	if _, ok := m.categoryIndex[categoryName]; !ok {
		m.categoryIndex[categoryName] = []string{}
	}
	m.mu.Unlock()

	return nil
}

// DeleteCategory 删除分类（仅删除空分类）
func (m *Manager) DeleteCategory(categoryName string) error {
	if categoryName == "" || categoryName == "未分类" {
		return fmt.Errorf("无法删除此分类")
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	// 检查分类是否有模板
	if ids, ok := m.categoryIndex[categoryName]; ok && len(ids) > 0 {
		return fmt.Errorf("分类不为空，无法删除")
	}

	categoryDir := filepath.Join(m.templatesDir, categoryName)
	
	// 删除目录
	if err := os.Remove(categoryDir); err != nil {
		return fmt.Errorf("删除分类目录失败: %v", err)
	}

	// 从索引中移除
	delete(m.categoryIndex, categoryName)

	return nil
}

// CheckDuplicateName 检查同一分类下是否存在同名POC
func (m *Manager) CheckDuplicateName(category, name string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	cat := category
	if cat == "" {
		cat = "未分类"
	}

	ids, ok := m.categoryIndex[cat]
	if !ok {
		return false
	}

	for _, id := range ids {
		if t, ok := m.cache[id]; ok {
			if t.Name == name {
				return true
			}
		}
	}

	return false
}

// GenerateUniqueName 生成唯一名称（如果已存在则添加数字后缀）
func (m *Manager) GenerateUniqueName(category, name string) string {
	if !m.CheckDuplicateName(category, name) {
		return name
	}

	baseName := name
	for i := 1; i < 1000; i++ {
		newName := fmt.Sprintf("%s_%d", baseName, i)
		if !m.CheckDuplicateName(category, newName) {
			return newName
		}
	}

	// 如果1000个都重复了，使用时间戳
	return fmt.Sprintf("%s_%d", baseName, time.Now().Unix())
}

// RenameCategory 重命名分类（支持多级分类）
func (m *Manager) RenameCategory(oldName, newName string) error {
	if oldName == "" || newName == "" {
		return fmt.Errorf("分类名称不能为空")
	}
	if oldName == "未分类" {
		return fmt.Errorf("无法重命名此分类")
	}

	// 检查新分类名是否合法（允许 "/" 作为分隔符）
	invalidChars := `\:*?"<>|`
	for _, char := range invalidChars {
		if strings.ContainsRune(newName, char) {
			return fmt.Errorf("分类名称不能包含特殊字符: %c", char)
		}
	}

	// 检查分类层级（最多三级）
	parts := strings.Split(newName, "/")
	if len(parts) > 3 {
		return fmt.Errorf("分类最多支持三级，当前: %d 级", len(parts))
	}

	// 检查每一级名称是否合法
	for i, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			return fmt.Errorf("分类名称第 %d 级不能为空", i+1)
		}
		if strings.ContainsAny(part, invalidChars) {
			return fmt.Errorf("分类名称第 %d 级包含非法字符", i+1)
		}
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	oldDir := filepath.Join(m.templatesDir, oldName)
	newDir := filepath.Join(m.templatesDir, newName)

	// 检查旧目录是否存在
	if _, err := os.Stat(oldDir); os.IsNotExist(err) {
		return fmt.Errorf("分类不存在: %s", oldName)
	}

	// 检查新目录是否已存在
	if _, err := os.Stat(newDir); err == nil {
		return fmt.Errorf("目标分类已存在: %s", newName)
	}

	// 重命名目录
	if err := os.Rename(oldDir, newDir); err != nil {
		return fmt.Errorf("重命名失败: %v", err)
	}

	// 更新索引
	if ids, ok := m.categoryIndex[oldName]; ok {
		m.categoryIndex[newName] = ids
		delete(m.categoryIndex, oldName)

		// 更新缓存中模板的分类和路径
		for _, id := range ids {
			if t, ok := m.cache[id]; ok {
				t.Category = newName
				// 更新文件路径
				t.FilePath = strings.Replace(t.FilePath, oldDir, newDir, 1)
				m.cache[id] = t
			}
		}
	}

	return nil
}

