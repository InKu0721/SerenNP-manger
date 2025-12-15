import { useState, useEffect, useCallback, useMemo } from 'react'
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
  X
} from 'lucide-react'
import { POCTemplate } from '../types'
import toast from 'react-hot-toast'

interface TemplateListProps {
  onEdit: (template: POCTemplate) => void;
  onNew: () => void;
}

const PAGE_SIZE = 50 // 每页显示数量

function TemplateList({ onEdit, onNew }: TemplateListProps) {
  const [allTemplates, setAllTemplates] = useState<POCTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [categoryPage, setCategoryPage] = useState(1) // 分类内分页
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true)
      if (window.go?.main?.App?.GetAllPOCs) {
        const data = await window.go.main.App.GetAllPOCs()
        setAllTemplates(data || [])
      }
    } catch (error) {
      toast.error('加载模板失败')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [])

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

  // 分类列表（按数量排序）
  const sortedCategories = useMemo(() => {
    return Object.entries(templatesByCategory)
      .sort(([, a], [, b]) => b.length - a.length)
  }, [templatesByCategory])

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个模板吗？')) return
    
    try {
      if (window.go?.main?.App?.DeletePOC) {
        await window.go.main.App.DeletePOC(id)
        toast.success('删除成功')
        loadTemplates()
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
          await window.go.main.App.ImportPOC(content)
          toast.success('导入成功')
          loadTemplates()
        }
      } catch (error) {
        toast.error('导入失败: 无效的 YAML 格式')
      }
    }
    input.click()
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
        loadTemplates() // 刷新列表
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
        loadTemplates()
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
            导入
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
          <button onClick={loadTemplates} className="btn btn-secondary">
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
              <div className="divide-y divide-dark-700/50 max-h-[calc(100vh-300px)] overflow-y-auto">
                {sortedCategories.map(([category, catTemplates]) => (
                  <div
                    key={category}
                    className={`group px-4 py-2.5 flex items-center justify-between transition-colors ${
                      selectedCategory === category
                        ? 'bg-cyber-600/20 text-cyber-400'
                        : 'hover:bg-dark-800/50 text-dark-300'
                    }`}
                  >
                    <button
                      onClick={() => handleSelectCategory(category)}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left"
                    >
                      <FolderOpen className={`w-4 h-4 flex-shrink-0 ${
                        selectedCategory === category ? 'text-cyber-400' : 'text-dark-500'
                      }`} />
                      <span className="truncate text-sm">{category}</span>
                    </button>
                    <div className="flex items-center gap-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                        selectedCategory === category
                          ? 'bg-cyber-600/30 text-cyber-300'
                          : 'bg-dark-700 text-dark-500'
                      }`}>
                        {catTemplates.length}
                      </span>
                      {catTemplates.length === 0 && category !== '未分类' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteCategory(category)
                          }}
                          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-dark-700 text-dark-500 hover:text-red-400 transition-all"
                          title="删除空分类"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
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
                分类名称将作为文件夹名称，不能包含特殊字符
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
