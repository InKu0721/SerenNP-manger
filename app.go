package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"nuclei-poc-manager/internal/models"
	"nuclei-poc-manager/internal/poc"
	"nuclei-poc-manager/internal/scanner"
)

type App struct {
	ctx        context.Context
	pocManager *poc.Manager
	scanner    *scanner.Scanner
	mu         sync.RWMutex
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	homeDir, _ := os.UserHomeDir()
	dataDir := filepath.Join(homeDir, ".nuclei-poc-manager")
	
	// 尝试加载已保存的设置
	settingsPath := filepath.Join(dataDir, "settings.json")
	templatesDir := filepath.Join(dataDir, "templates")
	
	if data, err := os.ReadFile(settingsPath); err == nil {
		var settings models.Settings
		if json.Unmarshal(data, &settings) == nil && settings.TemplatesDir != "" {
			templatesDir = settings.TemplatesDir
		}
	}

	os.MkdirAll(templatesDir, 0755)

	a.pocManager = poc.NewManager(templatesDir)
	a.scanner = scanner.NewScanner()
}

// ReloadTemplates 重新加载模板（当设置改变时调用）
func (a *App) ReloadTemplates(templatesDir string) error {
	if templatesDir == "" {
		return fmt.Errorf("模板目录不能为空")
	}
	
	// 确保目录存在
	if _, err := os.Stat(templatesDir); os.IsNotExist(err) {
		return fmt.Errorf("目录不存在: %s", templatesDir)
	}
	
	a.mu.Lock()
	defer a.mu.Unlock()
	
	a.pocManager = poc.NewManager(templatesDir)
	return nil
}

func (a *App) shutdown(ctx context.Context) {
	if a.scanner != nil {
		a.scanner.Stop()
	}
}

// GetAllPOCs 获取所有POC模板
func (a *App) GetAllPOCs() ([]models.POCTemplate, error) {
	return a.pocManager.GetAll()
}

// GetPOCsPaginated 分页获取POC模板
func (a *App) GetPOCsPaginated(page, pageSize int) (map[string]interface{}, error) {
	templates, total, err := a.pocManager.GetAllPaginated(page, pageSize)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"templates": templates,
		"total":     total,
		"page":      page,
		"pageSize":  pageSize,
	}, nil
}

// GetPOCCount 获取POC总数
func (a *App) GetPOCCount() int {
	return a.pocManager.GetCount()
}

// GetPOCByID 根据ID获取POC
func (a *App) GetPOCByID(id string) (*models.POCTemplate, error) {
	return a.pocManager.GetByID(id)
}

// CreatePOC 创建新的POC模板
func (a *App) CreatePOC(template models.POCTemplate) error {
	template.ID = generateID()
	template.CreatedAt = time.Now()
	template.UpdatedAt = time.Now()
	return a.pocManager.Save(template)
}

// UpdatePOC 更新POC模板
func (a *App) UpdatePOC(template models.POCTemplate) error {
	template.UpdatedAt = time.Now()
	return a.pocManager.Save(template)
}

// DeletePOC 删除POC模板
func (a *App) DeletePOC(id string) error {
	return a.pocManager.Delete(id)
}

// GetCategories 获取所有分类
func (a *App) GetCategories() ([]string, error) {
	catMap := a.pocManager.GetCategoriesWithCount()
	categories := make([]string, 0, len(catMap))
	for cat := range catMap {
		categories = append(categories, cat)
	}
	sort.Strings(categories)
	return categories, nil
}

// GetCategoriesWithCount 获取所有分类及其模板数量
func (a *App) GetCategoriesWithCount() map[string]int {
	return a.pocManager.GetCategoriesWithCount()
}

// GetPOCsByCategory 根据分类获取模板（使用索引，更快）
func (a *App) GetPOCsByCategory(category string) []models.POCTemplate {
	return a.pocManager.GetByCategory(category)
}

// GetPOCsBySeverity 根据严重性获取模板
func (a *App) GetPOCsBySeverity(severity string) []models.POCTemplate {
	return a.pocManager.GetBySeverity(severity)
}

// CreateCategory 创建新分类
func (a *App) CreateCategory(categoryName string) error {
	return a.pocManager.CreateCategory(categoryName)
}

// DeleteCategory 删除分类
func (a *App) DeleteCategory(categoryName string) error {
	return a.pocManager.DeleteCategory(categoryName)
}

// RenameCategory 重命名分类
func (a *App) RenameCategory(oldName, newName string) error {
	return a.pocManager.RenameCategory(oldName, newName)
}

// SearchPOCs 搜索POC
func (a *App) SearchPOCs(query string, category string, severity string) ([]models.POCTemplate, error) {
	pocs, err := a.pocManager.GetAll()
	if err != nil {
		return nil, err
	}

	var results []models.POCTemplate
	query = strings.ToLower(query)

	for _, p := range pocs {
		if category != "" && p.Category != category {
			continue
		}
		if severity != "" && p.Severity != severity {
			continue
		}
		if query != "" {
			nameMatch := strings.Contains(strings.ToLower(p.Name), query)
			descMatch := strings.Contains(strings.ToLower(p.Description), query)
			idMatch := strings.Contains(strings.ToLower(p.ID), query)
			if !nameMatch && !descMatch && !idMatch {
				continue
			}
		}
		results = append(results, p)
	}

	return results, nil
}

// ImportPOC 导入POC文件（带命名去重处理）
func (a *App) ImportPOC(content string, category string) (*models.POCTemplate, error) {
	template, err := a.pocManager.ParseYAML(content)
	if err != nil {
		return nil, fmt.Errorf("解析YAML失败: %v", err)
	}
	
	// 如果指定了分类，使用指定的分类；否则使用模板中的分类（如果有）
	if category != "" {
		template.Category = category
	} else if template.Category == "" {
		// 如果模板中也没有分类，使用默认分类
		template.Category = "custom"
	}
	
	// 检查同一分类下是否有同名POC，如果有则自动重命名
	if template.Name != "" {
		uniqueName := a.pocManager.GenerateUniqueName(template.Category, template.Name)
		if uniqueName != template.Name {
			// 更新YAML内容中的名称
			template.Name = uniqueName
			// 重新生成YAML内容
			yamlContent, err := a.pocManager.ToYAML(*template)
			if err == nil {
				template.Content = yamlContent
			}
		}
	}
	
	template.ID = generateID()
	template.CreatedAt = time.Now()
	template.UpdatedAt = time.Now()

	if err := a.pocManager.Save(*template); err != nil {
		return nil, err
	}
	return template, nil
}

// ImportPOCsFromFolder 批量导入文件夹中的POC（按文件夹名称分类）
func (a *App) ImportPOCsFromFolder(folderPath string) (map[string]interface{}, error) {
	// 检查文件夹是否存在
	info, err := os.Stat(folderPath)
	if err != nil {
		return nil, fmt.Errorf("文件夹不存在: %v", err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("路径不是文件夹: %s", folderPath)
	}

	var successCount, failCount int
	var errors []string

	// 获取基础路径，用于计算相对路径
	basePath := folderPath

	// 遍历文件夹中的所有YAML文件
	err = filepath.Walk(folderPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			return nil
		}
		if !strings.HasSuffix(strings.ToLower(path), ".yaml") && !strings.HasSuffix(strings.ToLower(path), ".yml") {
			return nil
		}

		// 计算相对于基础路径的分类路径
		relPath, err := filepath.Rel(basePath, path)
		if err != nil {
			failCount++
			errors = append(errors, fmt.Sprintf("%s: 路径计算失败 - %v", filepath.Base(path), err))
			return nil
		}

		// 从文件路径提取分类（目录结构）
		dirPath := filepath.Dir(relPath)
		var categoryName string
		if dirPath == "." || dirPath == "" {
			// 文件在根目录，使用文件夹名称作为分类
			categoryName = filepath.Base(folderPath)
		} else {
			// 使用目录结构作为多级分类
			parts := strings.Split(dirPath, string(os.PathSeparator))
			// 清理每一级名称
			cleanedParts := make([]string, 0, len(parts))
			invalidChars := `\:*?"<>|`
			for _, part := range parts {
				part = strings.TrimSpace(part)
				if part == "" || part == "." {
					continue
				}
				// 清理特殊字符（保留 "/" 作为分隔符）
				for _, char := range invalidChars {
					part = strings.ReplaceAll(part, string(char), "_")
				}
				if part != "" {
					cleanedParts = append(cleanedParts, part)
				}
			}
			if len(cleanedParts) > 0 {
				categoryName = strings.Join(cleanedParts, "/")
			} else {
				categoryName = filepath.Base(folderPath)
			}
		}

		// 清理分类名称
		categoryName = strings.TrimSpace(categoryName)
		if categoryName == "" {
			categoryName = "imported"
		}

		// 确保分类目录存在
		if err := a.pocManager.CreateCategory(categoryName); err != nil {
			// 如果分类已存在，忽略错误
			if !strings.Contains(err.Error(), "已存在") {
				failCount++
				errors = append(errors, fmt.Sprintf("%s: 创建分类失败 - %v", filepath.Base(path), err))
				return nil
			}
		}

		// 读取文件内容
		content, err := os.ReadFile(path)
		if err != nil {
			failCount++
			errors = append(errors, fmt.Sprintf("%s: 读取失败 - %v", filepath.Base(path), err))
			return nil
		}

		// 导入POC（使用提取的分类路径）
		_, err = a.ImportPOC(string(content), categoryName)
		if err != nil {
			failCount++
			errors = append(errors, fmt.Sprintf("%s: %v", filepath.Base(path), err))
		} else {
			successCount++
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("遍历文件夹失败: %v", err)
	}

	return map[string]interface{}{
		"success": successCount,
		"failed":  failCount,
		"total":   successCount + failCount,
		"errors":  errors,
	}, nil
}

// ExportPOC 导出POC为YAML
func (a *App) ExportPOC(id string) (string, error) {
	template, err := a.pocManager.GetByID(id)
	if err != nil {
		return "", err
	}
	return a.pocManager.ToYAML(*template)
}

// StartScan 开始扫描
func (a *App) StartScan(request models.ScanRequest) (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	var templates []models.POCTemplate
	for _, id := range request.TemplateIDs {
		t, err := a.pocManager.GetByID(id)
		if err != nil {
			continue
		}
		templates = append(templates, *t)
	}

	if len(templates) == 0 {
		return "", fmt.Errorf("没有有效的模板")
	}

	scanID, err := a.scanner.Start(a.ctx, request.Targets, templates, a.pocManager.GetTemplatesDir())
	if err != nil {
		return "", err
	}

	return scanID, nil
}

// StopScan 停止扫描
func (a *App) StopScan(scanID string) error {
	return a.scanner.StopScan(scanID)
}

// GetScanStatus 获取扫描状态
func (a *App) GetScanStatus(scanID string) (*models.ScanStatus, error) {
	return a.scanner.GetStatus(scanID)
}

// GetScanResults 获取扫描结果
func (a *App) GetScanResults(scanID string) ([]models.ScanResult, error) {
	return a.scanner.GetResults(scanID)
}

// GetAllScans 获取所有扫描任务
func (a *App) GetAllScans() ([]models.ScanStatus, error) {
	return a.scanner.GetAllScans()
}

// ValidatePOCYAML 验证POC YAML格式
func (a *App) ValidatePOCYAML(content string) error {
	_, err := a.pocManager.ParseYAML(content)
	return err
}

// GetTemplatesDir 获取模板目录
func (a *App) GetTemplatesDir() string {
	return a.pocManager.GetTemplatesDir()
}

// GetStats 获取统计信息
func (a *App) GetStats() (*models.Stats, error) {
	pocs, err := a.pocManager.GetAll()
	if err != nil {
		return nil, err
	}

	stats := &models.Stats{
		TotalPOCs: len(pocs),
		ByCategory: make(map[string]int),
		BySeverity: make(map[string]int),
	}

	for _, p := range pocs {
		if p.Category != "" {
			stats.ByCategory[p.Category]++
		}
		if p.Severity != "" {
			stats.BySeverity[p.Severity]++
		}
	}

	scans, _ := a.scanner.GetAllScans()
	stats.TotalScans = len(scans)

	return stats, nil
}

func generateID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

// SaveSettings 保存设置
func (a *App) SaveSettings(settings models.Settings) error {
	homeDir, _ := os.UserHomeDir()
	settingsPath := filepath.Join(homeDir, ".nuclei-poc-manager", "settings.json")
	
	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}
	
	return os.WriteFile(settingsPath, data, 0644)
}

// LoadSettings 加载设置
func (a *App) LoadSettings() (*models.Settings, error) {
	homeDir, _ := os.UserHomeDir()
	settingsPath := filepath.Join(homeDir, ".nuclei-poc-manager", "settings.json")
	
	data, err := os.ReadFile(settingsPath)
	if err != nil {
		if os.IsNotExist(err) {
			return &models.Settings{
				Concurrency:  10,
				Timeout:      30,
				RateLimit:    100,
				BulkSize:     25,
				TemplatesDir: a.pocManager.GetTemplatesDir(),
			}, nil
		}
		return nil, err
	}
	
	var settings models.Settings
	if err := json.Unmarshal(data, &settings); err != nil {
		return nil, err
	}
	
	return &settings, nil
}


