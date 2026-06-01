import { useState, useCallback, useMemo } from 'react'
import { 
  Search, 
  Plus, 
  Filter, 
  Edit3, 
  Trash2, 
  Download,
  Upload,
  RefreshCw,
  FolderOpen,
  FolderPlus,
  X,
  ChevronRight,
  ChevronDown,
  Pencil
} from 'lucide-react'
import { POCTemplate } from '../types'
import toast from 'react-hot-toast'

interface TemplateListProps {
  templates: POCTemplate[];
  loading: boolean;
  onEdit: (template: POCTemplate) => void;
  onNew: () => void;
  onRefresh: () => void;
}

const PAGE_SIZE = 50 // 每页显示数量

function TemplateList({ templates: allTemplates, loading, onEdit, onNew, onRefresh }: TemplateListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [categoryPage, setCategoryPage] = useState(1) // 分类内分页
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [showBatchImportModal, setShowBatchImportModal] = useState(false)
  const [batchImportPath, setBatchImportPath] = useState('')
  const [batchImporting, setBatchImporting] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null)
  const [renameCategoryValue, setRenameCategoryValue] = useState('')

  // 过滤后的模板
  const filteredTemplates = useMemo(() => {
    let result = allTemplates
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(t => 
        t.name?.toLowerCase().includes(query) ||
        t.id?.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
      )
    }
    
    if (filterSeverity) {
      result = result.filter(t => t.severity?.toLowerCase() === filterSeverity.toLowerCase())
    }
    
    return result
  }, [allTemplates, searchQuery, filterSeverity])
  
  // 按分类分组的模板
  const templatesByCategory = useMemo(() => {
    const grouped: Record<string, POCTemplate[]> = {}
    filteredTemplates.forEach(t => {
      const cat = t.category || '未分类'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(t)
    })
    return grouped
  }, [filteredTemplates])

  // 构建分类树结构
  interface CategoryNode {
    name: string
    fullPath: string
    count: number
    children: Map<string, CategoryNode>
    level: number
  }

  const categoryTree = useMemo(() => {
    const root = new Map<string, CategoryNode>()
    
    Object.entries(templatesByCategory).forEach(([category, templates]) => {
      // 处理"未分类"特殊 case
      if (category === '未分类') {
        root.set('未分类', {
          name: '未分类',
          fullPath: '未分类',
          count: templates.length,
          children: new Map(),
          level: 0
        })
        return
      }

      const parts = category.split('/')
      let current = root
      
      parts.forEach((part, index) => {
        const fullPath = parts.slice(0, index + 1).join('/')
        
        if (!current.has(part)) {
          current.set(part, {
            name: part,
            fullPath,
            count: 0,
            children: new Map(),
            level: index
          })
        }
        
        const node = current.get(part)!
        if (index === parts.length - 1) {
          // 叶子节点，设置模板数量
          node.count = templates.length
        }
        
        current = node.children
      })
    })
    
    return root
  }, [templatesByCategory])

  // 展开/折叠分类
  const toggleCategory = useCallback((fullPath: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(fullPath)) {
        next.delete(fullPath)
      } else {
        next.add(fullPath)
      }
      return next
    })
  }, [])

  // 重命名分类
  const handleRenameCategory = async (oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) {
      setRenamingCategory(null)
      setRenameCategoryValue('')
      return
    }

    try {
      if (window.go?.main?.App?.RenameCategory) {
        await window.go.main.App.RenameCategory(oldName, newName.trim())
        toast.success('分类重命名成功')
        setRenamingCategory(null)
        setRenameCategoryValue('')
        onRefresh()
      }
    } catch (error: any) {
      toast.error(error?.message || '重命名失败')
    }
  }

  // 开始重命名
  const startRename = useCallback((categoryPath: string) => {
    setRenamingCategory(categoryPath)
    setRenameCategoryValue(categoryPath.split('/').pop() || '')
  }, [])

  // 渲染分类树节点
  const renderCategoryNode = (node: CategoryNode) => {
    const isExpanded = expandedCategories.has(node.fullPath)
    const hasChildren = node.children.size > 0
    const isSelected = selectedCategory === node.fullPath
    const isRenaming = renamingCategory === node.fullPath

    return (
      <div key={node.fullPath}>
        <div
          className={`group px-2 py-1.5 flex items-center justify-between transition-colors ${
            isSelected
              ? 'bg-cyber-600/20 text-cyber-400'
              : 'hover:bg-dark-800/50 text-dark-300'
          }`}
          style={{ paddingLeft: `${8 + node.level * 16}px` }}
        >
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {hasChildren ? (
              <button
                onClick={() => toggleCategory(node.fullPath)}
                className="p-0.5 rounded hover:bg-dark-700 text-dark-500 hover:text-cyber-400 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </button>
            ) : (
              <div className="w-4" />
            )}
            {isRenaming ? (
              <input
                type="text"
                value={renameCategoryValue}
                onChange={(e) => setRenameCategoryValue(e.target.value)}
                onBlur={() => {
                  const parentParts = node.fullPath.split('/').slice(0, -1)
                  const newFullPath = parentParts.length > 0
                    ? `${parentParts.join('/')}/${renameCategoryValue}`
                    : renameCategoryValue
                  handleRenameCategory(node.fullPath, newFullPath)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const parentParts = node.fullPath.split('/').slice(0, -1)
                    const newFullPath = parentParts.length > 0
                      ? `${parentParts.join('/')}/${renameCategoryValue}`
                      : renameCategoryValue
                    handleRenameCategory(node.fullPath, newFullPath)
                  } else if (e.key === 'Escape') {
                    setRenamingCategory(null)
                    setRenameCategoryValue('')
                  }
                }}
                className="flex-1 text-sm bg-dark-700 border border-cyber-500 rounded px-2 py-0.5"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <button
                  onClick={() => handleSelectCategory(node.fullPath)}
                  className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                >
                  <FolderOpen className={`w-3.5 h-3.5 flex-shrink-0 ${
                    isSelected ? 'text-cyber-400' : 'text-dark-500'
                  }`} />
                  <span className="truncate text-sm">{node.name}</span>
                </button>
                <div className="flex items-center gap-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                    isSelected
                      ? 'bg-cyber-600/30 text-cyber-300'
                      : 'bg-dark-700 text-dark-500'
                  }`}>
                    {node.count}
                  </span>
                  {node.fullPath !== '未分类' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        startRename(node.fullPath)
                      }}
                      className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-dark-700 text-dark-500 hover:text-cyber-400 transition-all"
                      title="重命名分类"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                  {node.count === 0 && node.fullPath !== '未分类' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteCategory(node.fullPath)
                      }}
                      className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-dark-700 text-dark-500 hover:text-red-400 transition-all"
                      title="删除空分类"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {Array.from(node.children.values())
              .sort((a, b) => b.count - a.count)
              .map(child => renderCategoryNode(child))}
          </div>
        )}
      </div>
    )
  }


  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个模板吗？')) return
    
    try {
      if (window.go?.main?.App?.DeletePOC) {
        await window.go.main.App.DeletePOC(id)
        toast.success('删除成功')
        onRefresh()
      }
    } catch (error) {
      toast.error('删除失败')
    }
  }

  const handleExport = async (id: string) => {
    try {
      if (window.go?.main?.App?.ExportPOC) {
        const yaml = await window.go.main.App.ExportPOC(id)
        const blob = new Blob([yaml], { type: 'text/yaml' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${id}.yaml`
        a.click()
        URL.revokeObjectURL(url)
        toast.success('导出成功')
      }
    } catch (error) {
      toast.error('导出失败')
    }
  }

  const handleImport = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.yaml,.yml'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      
      const content = await file.text()
      try {
        if (window.go?.main?.App?.ImportPOC) {
          // 如果选择了分类，使用该分类；否则使用模板中的分类
          const category = selectedCategory || undefined
          await window.go.main.App.ImportPOC(content, category)
          toast.success('导入成功')
          onRefresh()
        }
      } catch (error: any) {
        toast.error('导入失败: ' + (error?.message || '无效的 YAML 格式'))
      }
    }
    input.click()
  }

  const handleBatchImport = async () => {
    if (!batchImportPath.trim()) {
      toast.error('请输入文件夹路径')
      return
    }

    setBatchImporting(true)
    try {
      if (window.go?.main?.App?.ImportPOCsFromFolder) {
        const result = await window.go.main.App.ImportPOCsFromFolder(batchImportPath.trim())
        if (result.success > 0) {
          toast.success(`批量导入成功: ${result.success} 个模板`)
        }
        if (result.failed > 0) {
          toast.error(`导入失败: ${result.failed} 个文件`)
          if (result.errors && result.errors.length > 0) {
            console.error('导入错误详情:', result.errors)
          }
        }
        setShowBatchImportModal(false)
        setBatchImportPath('')
        onRefresh()
      }
    } catch (error: any) {
      toast.error('批量导入失败: ' + (error?.message || '未知错误'))
    } finally {
      setBatchImporting(false)
    }
  }

  const getSeverityClass = (severity: string) => {
    const classes: Record<string, string> = {
      critical: 'severity-critical',
      high: 'severity-high',
      medium: 'severity-medium',
      low: 'severity-low',
      info: 'severity-info',
    }
    return classes[severity?.toLowerCase()] || 'severity-info'
  }

  // 当前选中分类的所有模板
  const allCategoryTemplates = selectedCategory 
    ? templatesByCategory[selectedCategory] || []
    : []

  // 分页后的模板（只显示当前页数量）
  const currentTemplates = useMemo(() => {
    return allCategoryTemplates.slice(0, categoryPage * PAGE_SIZE)
  }, [allCategoryTemplates, categoryPage])

  // 是否还有更多模板
  const hasMoreTemplates = currentTemplates.length < allCategoryTemplates.length

  // 选择分类时重置页码
  const handleSelectCategory = useCallback((category: string) => {
    setSelectedCategory(category)
    setCategoryPage(1)
  }, [])

  // 创建新分类
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('请输入分类名称')
      return
    }
    
    try {
      setCreatingCategory(true)
      if (window.go?.main?.App?.CreateCategory) {
        await window.go.main.App.CreateCategory(newCategoryName.trim())
        toast.success('分类创建成功')
        setShowNewCategoryModal(false)
        setNewCategoryName('')
        onRefresh() // 刷新列表
      }
    } catch (error: any) {
      toast.error(error?.message || '创建分类失败')
    } finally {
      setCreatingCategory(false)
    }
  }

  // 删除分类
  const handleDeleteCategory = async (categoryName: string) => {
    if (categoryName === '未分类') {
      toast.error('无法删除此分类')
      return
    }
    
    const count = templatesByCategory[categoryName]?.length || 0
    if (count > 0) {
      toast.error(`分类"${categoryName}"下还有 ${count} 个模板，无法删除`)
      return
    }
    
    if (!confirm(`确定要删除分类"${categoryName}"吗？`)) return
    
    try {
      if (window.go?.main?.App?.DeleteCategory) {
        await window.go.main.App.DeleteCategory(categoryName)
        toast.success('分类已删除')
        if (selectedCategory === categoryName) {
          setSelectedCategory('')
        }
        onRefresh()
      }
    } catch (error: any) {
      toast.error(error?.message || '删除分类失败')
    }
  }

  return (
    <div className="p-8 space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">
            POC 模板管理
          </h1>
          <p className="text-dark-400">
            共 {allTemplates.length} 个模板，{Object.keys(templatesByCategory).length} 个分类
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleImport}
            className="btn btn-secondary"
          >
            <Upload className="w-4 h-4" />
            导入文件
          </button>
          <button
            onClick={() => setShowBatchImportModal(true)}
            className="btn btn-secondary"
          >
            <FolderOpen className="w-4 h-4" />
            批量导入文件夹
          </button>
          <button
            onClick={onNew}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4" />
            新建模板
          </button>
        </div>
      </div>

      {/* 搜索和过滤 */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
            <input
              type="text"
              placeholder="搜索模板名称、描述或 ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setSelectedCategory('')
                setCategoryPage(1)
              }}
              className="w-full pl-10"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Filter className="w-4 h-4" />
            过滤
          </button>
          <button onClick={onRefresh} className="btn btn-secondary">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="flex gap-4 mt-4 pt-4 border-t border-dark-700">
            <select
              value={filterSeverity}
              onChange={(e) => {
                setFilterSeverity(e.target.value)
                setSelectedCategory('')
                setCategoryPage(1)
              }}
              className="min-w-[150px]"
            >
              <option value="">所有严重程度</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Info</option>
            </select>
            <button
              onClick={() => {
                setFilterSeverity('')
                setSearchQuery('')
                setSelectedCategory('')
                setCategoryPage(1)
              }}
              className="text-dark-400 hover:text-dark-200 text-sm"
            >
              清除过滤
            </button>
          </div>
        )}
      </div>

      {/* 分类视图 */}
      {loading ? (
        <div className="card p-12 text-center text-dark-400">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin" />
          <p>加载中...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="card p-12 text-center text-dark-400">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg mb-2">暂无模板</p>
          <p className="text-sm">
            {searchQuery || filterSeverity ? '没有匹配的结果' : '点击"新建模板"开始创建'}
          </p>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* 左侧分类列表 */}
          <div className="w-64 flex-shrink-0">
            <div className="card overflow-hidden sticky top-6">
              <div className="px-4 py-3 bg-dark-800/50 border-b border-dark-700 flex items-center justify-between">
                <span className="font-medium text-white text-sm">分类列表</span>
                <button
                  onClick={() => setShowNewCategoryModal(true)}
                  className="p-1 rounded hover:bg-dark-700 text-dark-400 hover:text-cyber-400 transition-colors"
                  title="新建分类"
                >
                  <FolderPlus className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                {Array.from(categoryTree.values())
                  .sort((a, b) => {
                    // 先按层级排序，再按数量排序
                    if (a.level !== b.level) return a.level - b.level
                    return b.count - a.count
                  })
                  .map(node => renderCategoryNode(node))}
              </div>
            </div>
          </div>

          {/* 右侧模板列表 */}
          <div className="flex-1 min-w-0">
            {selectedCategory ? (
              <div className="card overflow-hidden">
                <div className="px-4 py-3 bg-dark-800/50 border-b border-dark-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-cyber-400" />
                    <span className="font-medium text-white">{selectedCategory}</span>
                    <span className="text-xs text-dark-500 bg-dark-700 px-2 py-0.5 rounded">
                      {currentTemplates.length} / {allCategoryTemplates.length} 个模板
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-dark-700/50 max-h-[calc(100vh-300px)] overflow-y-auto">
                  {currentTemplates.map((template) => (
                    <div 
                      key={template.id}
                      className="px-4 py-3 flex items-center justify-between hover:bg-dark-800/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white truncate">
                            {template.name || template.id}
                          </span>
                          <span className={`tag text-xs ${getSeverityClass(template.severity)}`}>
                            {template.severity || 'info'}
                          </span>
                        </div>
                        <p className="text-sm text-dark-500 truncate mt-0.5">
                          {template.description || '暂无描述'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 ml-4">
                        <button
                          onClick={() => onEdit(template)}
                          className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-cyber-400"
                          title="编辑"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleExport(template.id)}
                          className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-blue-400"
                          title="导出"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(template.id)}
                          className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-red-400"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {/* 加载更多按钮 */}
                  {hasMoreTemplates && (
                    <div className="px-4 py-3 text-center">
                      <button
                        onClick={() => setCategoryPage(p => p + 1)}
                        className="text-sm text-cyber-400 hover:text-cyber-300 transition-colors"
                      >
                        加载更多（已显示 {currentTemplates.length} / {allCategoryTemplates.length}）
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card p-12 text-center text-dark-400">
                <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg mb-2">请选择分类</p>
                <p className="text-sm">从左侧选择一个分类查看模板</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 批量导入文件夹模态框 */}
      {showBatchImportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="card w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">批量导入文件夹</h3>
              <button
                onClick={() => {
                  setShowBatchImportModal(false)
                  setBatchImportPath('')
                }}
                className="p-1 rounded hover:bg-dark-700 text-dark-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div>
              <label className="block text-sm text-dark-400 mb-2">文件夹路径</label>
              <input
                type="text"
                value={batchImportPath}
                onChange={(e) => setBatchImportPath(e.target.value)}
                placeholder="输入文件夹完整路径，如: C:\pocs 或 /home/user/pocs"
                className="w-full font-mono text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleBatchImport()
                  if (e.key === 'Escape') {
                    setShowBatchImportModal(false)
                    setBatchImportPath('')
                  }
                }}
              />
              <p className="text-xs text-dark-500 mt-2">
                将扫描文件夹中的所有 YAML 文件，文件夹名称将作为分类名称
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowBatchImportModal(false)
                  setBatchImportPath('')
                }}
                className="btn btn-secondary"
                disabled={batchImporting}
              >
                取消
              </button>
              <button
                onClick={handleBatchImport}
                disabled={batchImporting || !batchImportPath.trim()}
                className="btn btn-primary"
              >
                {batchImporting ? '导入中...' : '开始导入'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新建分类模态框 */}
      {showNewCategoryModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="card w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">新建分类</h3>
              <button
                onClick={() => {
                  setShowNewCategoryModal(false)
                  setNewCategoryName('')
                }}
                className="p-1 rounded hover:bg-dark-700 text-dark-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div>
              <label className="block text-sm text-dark-400 mb-2">分类名称</label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="输入分类名称..."
                className="w-full"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateCategory()
                  if (e.key === 'Escape') {
                    setShowNewCategoryModal(false)
                    setNewCategoryName('')
                  }
                }}
              />
              <p className="text-xs text-dark-500 mt-2">
                支持多级分类，使用 "/" 分隔，最多三级。例如：Web/SSRF 或 Network/HTTP/GET
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowNewCategoryModal(false)
                  setNewCategoryName('')
                }}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleCreateCategory}
                disabled={creatingCategory || !newCategoryName.trim()}
                className="btn btn-primary"
              >
                {creatingCategory ? '创建中...' : '创建分类'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TemplateList
