import { useState, useEffect, useCallback } from 'react'
import { 
  Search, 
  Plus, 
  Filter, 
  Edit3, 
  Trash2, 
  Download,
  Upload,
  RefreshCw,
  Tag,
  User,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { POCTemplate } from '../types'
import toast from 'react-hot-toast'

interface TemplateListProps {
  onEdit: (template: POCTemplate) => void;
  onNew: () => void;
}

const PAGE_SIZE = 50 // 每页显示数量

function TemplateList({ onEdit, onNew }: TemplateListProps) {
  const [templates, setTemplates] = useState<POCTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    loadTemplates()
    loadCategories()
  }, [])

  useEffect(() => {
    if (searchQuery || filterCategory || filterSeverity) {
      searchTemplates()
    } else {
      loadTemplates()
    }
  }, [searchQuery, filterCategory, filterSeverity, page])

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true)
      // 优先使用分页API
      if (window.go?.main?.App?.GetPOCsPaginated) {
        const result = await window.go.main.App.GetPOCsPaginated(page, PAGE_SIZE)
        setTemplates(result.templates || [])
        setTotal(result.total || 0)
      } else if (window.go?.main?.App?.GetAllPOCs) {
        const data = await window.go.main.App.GetAllPOCs()
        setTemplates(data || [])
        setTotal(data?.length || 0)
      }
    } catch (error) {
      toast.error('加载模板失败')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [page])

  const loadCategories = async () => {
    try {
      if (window.go?.main?.App?.GetCategories) {
        const data = await window.go.main.App.GetCategories()
        setCategories(data || [])
      }
    } catch (error) {
      console.error(error)
    }
  }

  const searchTemplates = async () => {
    try {
      if (window.go?.main?.App?.SearchPOCs) {
        const data = await window.go.main.App.SearchPOCs(
          searchQuery,
          filterCategory,
          filterSeverity
        )
        setTemplates(data || [])
      }
    } catch (error) {
      console.error(error)
    }
  }

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

  return (
    <div className="p-8 space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">
            POC 模板管理
          </h1>
          <p className="text-dark-400">
            管理和编辑您的漏洞检测模板
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
              onChange={(e) => setSearchQuery(e.target.value)}
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
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="min-w-[150px]"
            >
              <option value="">所有分类</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
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
                setFilterCategory('')
                setFilterSeverity('')
                setSearchQuery('')
              }}
              className="text-dark-400 hover:text-dark-200 text-sm"
            >
              清除过滤
            </button>
          </div>
        )}
      </div>

      {/* 模板列表 */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-dark-400">
            <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin" />
            <p>加载中...</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="p-12 text-center text-dark-400">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg mb-2">暂无模板</p>
            <p className="text-sm">点击"新建模板"开始创建</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>严重程度</th>
                <th>分类</th>
                <th>作者</th>
                <th>更新时间</th>
                <th className="w-32">操作</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template, index) => (
                <tr 
                  key={template.id}
                  className="animate-slide-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <td>
                    <div>
                      <div className="font-medium text-white">{template.name || template.id}</div>
                      <div className="text-sm text-dark-500 truncate max-w-md">
                        {template.description || '暂无描述'}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`tag ${getSeverityClass(template.severity)}`}>
                      {template.severity || 'info'}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1 text-dark-400">
                      <Tag className="w-3 h-3" />
                      <span>{template.category || '-'}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1 text-dark-400">
                      <User className="w-3 h-3" />
                      <span>{template.author || '-'}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1 text-dark-500 text-sm">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {template.updatedAt 
                          ? new Date(template.updatedAt).toLocaleDateString('zh-CN')
                          : '-'
                        }
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onEdit(template)}
                        className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 
                                 hover:text-cyber-400 transition-colors"
                        title="编辑"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleExport(template.id)}
                        className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 
                                 hover:text-blue-400 transition-colors"
                        title="导出"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 
                                 hover:text-red-400 transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 分页和统计信息 */}
      <div className="flex items-center justify-between text-sm text-dark-500">
        <span>共 {total} 个模板，当前显示 {templates.length} 个</span>
        <div className="flex items-center gap-4">
          <span>
            {filterCategory || filterSeverity ? '已应用过滤条件' : '显示全部'}
          </span>
          {total > PAGE_SIZE && !searchQuery && !filterCategory && !filterSeverity && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="p-1 rounded hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-dark-400">
                第 {page + 1} / {Math.ceil(total / PAGE_SIZE)} 页
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={(page + 1) * PAGE_SIZE >= total}
                className="p-1 rounded hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TemplateList


