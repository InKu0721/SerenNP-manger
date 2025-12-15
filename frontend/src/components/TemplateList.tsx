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
  FolderOpen
} from 'lucide-react'
import { POCTemplate } from '../types'
import toast from 'react-hot-toast'

interface TemplateListProps {
  onEdit: (template: POCTemplate) => void;
  onNew: () => void;
}

function TemplateList({ onEdit, onNew }: TemplateListProps) {
  const [allTemplates, setAllTemplates] = useState<POCTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('')

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

  // 当前选中分类的模板
  const currentTemplates = selectedCategory 
    ? templatesByCategory[selectedCategory] || []
    : []

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
              <div className="px-4 py-3 bg-dark-800/50 border-b border-dark-700">
                <span className="font-medium text-white text-sm">分类列表</span>
              </div>
              <div className="divide-y divide-dark-700/50 max-h-[calc(100vh-300px)] overflow-y-auto">
                {sortedCategories.map(([category, catTemplates]) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`w-full px-4 py-2.5 flex items-center justify-between transition-colors text-left ${
                      selectedCategory === category
                        ? 'bg-cyber-600/20 text-cyber-400'
                        : 'hover:bg-dark-800/50 text-dark-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FolderOpen className={`w-4 h-4 flex-shrink-0 ${
                        selectedCategory === category ? 'text-cyber-400' : 'text-dark-500'
                      }`} />
                      <span className="truncate text-sm">{category}</span>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                      selectedCategory === category
                        ? 'bg-cyber-600/30 text-cyber-300'
                        : 'bg-dark-700 text-dark-500'
                    }`}>
                      {catTemplates.length}
                    </span>
                  </button>
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
                      {currentTemplates.length} 个模板
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
    </div>
  )
}

export default TemplateList
