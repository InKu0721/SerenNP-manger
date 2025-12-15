import { useState, useEffect, useMemo } from 'react'
import { 
  Square, 
  Target, 
  FileCode2,
  Loader,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Activity,
  Search
} from 'lucide-react'
import { POCTemplate, ScanStatus } from '../types'
import toast from 'react-hot-toast'

interface ScannerProps {
  onViewResult?: (scanId: string) => void;
}

const MAX_DISPLAY = 100 // 最多显示100个模板

function Scanner({ onViewResult }: ScannerProps) {
  const [targets, setTargets] = useState('')
  const [templates, setTemplates] = useState<POCTemplate[]>([])
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([])
  const [activeScans, setActiveScans] = useState<ScanStatus[]>([])
  const [scanning, setScanning] = useState(false)
  const [expandedScans, setExpandedScans] = useState<string[]>([])
  const [templateSearch, setTemplateSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTemplates()
    loadScans()
  }, [])

  // 获取所有分类
  const categories = useMemo(() => {
    const cats = new Set<string>()
    templates.forEach(t => {
      if (t.category) cats.add(t.category)
    })
    return Array.from(cats).sort()
  }, [templates])

  // 过滤后的模板（使用 useMemo 避免重复计算）
  const filteredTemplates = useMemo(() => {
    let filtered = templates
    
    // 按分类过滤
    if (categoryFilter) {
      filtered = filtered.filter(t => t.category === categoryFilter)
    }
    
    // 按搜索词过滤
    if (templateSearch.trim()) {
      const search = templateSearch.toLowerCase()
      filtered = filtered.filter(t => 
        t.name?.toLowerCase().includes(search) ||
        t.id?.toLowerCase().includes(search) ||
        t.severity?.toLowerCase().includes(search)
      )
    }
    
    return filtered.slice(0, MAX_DISPLAY)
  }, [templates, templateSearch, categoryFilter])
  
  // 当前过滤条件下的所有模板ID（用于全选）
  const allFilteredIds = useMemo(() => {
    let filtered = templates
    if (categoryFilter) {
      filtered = filtered.filter(t => t.category === categoryFilter)
    }
    if (templateSearch.trim()) {
      const search = templateSearch.toLowerCase()
      filtered = filtered.filter(t => 
        t.name?.toLowerCase().includes(search) ||
        t.id?.toLowerCase().includes(search) ||
        t.severity?.toLowerCase().includes(search)
      )
    }
    return filtered.map(t => t.id)
  }, [templates, templateSearch, categoryFilter])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      if (window.go?.main?.App?.GetAllPOCs) {
        const data = await window.go.main.App.GetAllPOCs()
        setTemplates(data || [])
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const loadScans = async () => {
    try {
      if (window.go?.main?.App?.GetAllScans) {
        const data = await window.go.main.App.GetAllScans()
        setActiveScans(data || [])
      }
    } catch (error) {
      console.error(error)
    }
  }

  const handleStartScan = async () => {
    const targetList = targets
      .split('\n')
      .map(t => t.trim())
      .filter(t => t.length > 0)

    if (targetList.length === 0) {
      toast.error('请输入至少一个目标')
      return
    }

    if (selectedTemplates.length === 0) {
      toast.error('请选择至少一个模板')
      return
    }

    setScanning(true)
    try {
      if (window.go?.main?.App?.StartScan) {
        const scanId = await window.go.main.App.StartScan({
          targets: targetList,
          templateIds: selectedTemplates,
          options: {
            concurrency: 10,
            timeout: 30,
            rateLimit: 100,
            bulkSize: 25,
            headless: false,
          },
        })
        toast.success(`扫描已启动`)
        setExpandedScans(prev => [...prev, scanId])
        loadScans()
      }
    } catch (error: any) {
      toast.error('启动扫描失败: ' + (error?.message || '未知错误'))
    } finally {
      setScanning(false)
    }
  }

  const handleStopScan = async (scanId: string) => {
    try {
      if (window.go?.main?.App?.StopScan) {
        await window.go.main.App.StopScan(scanId)
        toast.success('扫描已停止')
        loadScans()
      }
    } catch (error) {
      toast.error('停止扫描失败')
    }
  }

  const toggleTemplate = (id: string) => {
    setSelectedTemplates(prev => 
      prev.includes(id) 
        ? prev.filter(t => t !== id)
        : [...prev, id]
    )
  }

  // 全选当前过滤条件下的所有模板（不限于显示的100个）
  const selectAllFiltered = () => {
    const allSelected = allFilteredIds.every(id => selectedTemplates.includes(id))
    if (allSelected) {
      setSelectedTemplates(prev => prev.filter(id => !allFilteredIds.includes(id)))
    } else {
      setSelectedTemplates(prev => [...new Set([...prev, ...allFilteredIds])])
    }
  }
  
  // 全选所有本地模板
  const selectAllTemplates = () => {
    if (selectedTemplates.length === templates.length) {
      setSelectedTemplates([])
    } else {
      setSelectedTemplates(templates.map(t => t.id))
    }
  }

  const toggleScanExpand = (scanId: string) => {
    setExpandedScans(prev => 
      prev.includes(scanId)
        ? prev.filter(id => id !== scanId)
        : [...prev, scanId]
    )
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader className="w-5 h-5 text-cyber-400 animate-spin" />
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-400" />
      case 'stopped':
        return <Square className="w-5 h-5 text-yellow-400" />
      default:
        return <Clock className="w-5 h-5 text-dark-400" />
    }
  }

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      running: '扫描中',
      completed: '已完成',
      failed: '失败',
      stopped: '已停止',
      pending: '等待中',
    }
    return texts[status] || status
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-cyber-400 bg-cyber-500/20'
      case 'completed': return 'text-green-400 bg-green-500/20'
      case 'failed': return 'text-red-400 bg-red-500/20'
      case 'stopped': return 'text-yellow-400 bg-yellow-500/20'
      default: return 'text-dark-400 bg-dark-600'
    }
  }

  const formatDuration = (startedAt: string, completedAt?: string) => {
    const start = new Date(startedAt).getTime()
    const end = completedAt ? new Date(completedAt).getTime() : Date.now()
    const duration = Math.floor((end - start) / 1000)
    
    if (duration < 60) return `${duration}秒`
    if (duration < 3600) return `${Math.floor(duration / 60)}分${duration % 60}秒`
    return `${Math.floor(duration / 3600)}时${Math.floor((duration % 3600) / 60)}分`
  }

  // 按状态排序：运行中 > 等待中 > 已完成/停止/失败
  const sortedScans = [...activeScans].sort((a, b) => {
    const order: Record<string, number> = { running: 0, pending: 1, completed: 2, stopped: 3, failed: 4 }
    return (order[a.status] || 5) - (order[b.status] || 5)
  })

  return (
    <div className="p-8 space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-display font-bold text-white mb-2">
          漏洞扫描器
        </h1>
        <p className="text-dark-400">
          配置目标和模板，启动漏洞扫描
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 目标配置 */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-cyber-400" />
            <h2 className="text-lg font-semibold text-white">扫描目标</h2>
          </div>
          <p className="text-sm text-dark-400">
            每行输入一个目标 URL 或主机
          </p>
          <textarea
            value={targets}
            onChange={(e) => setTargets(e.target.value)}
            placeholder="https://example.com&#10;https://target.com&#10;192.168.1.1"
            rows={10}
            className="w-full font-mono text-sm resize-none"
          />
          <div className="flex items-center justify-between text-sm text-dark-500">
            <span>目标数量: {targets.split('\n').filter(t => t.trim()).length}</span>
          </div>
        </div>

        {/* 模板选择 */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode2 className="w-5 h-5 text-cyber-400" />
              <h2 className="text-lg font-semibold text-white">选择模板</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAllFiltered}
                className="text-xs px-2 py-1 rounded bg-dark-700 text-cyber-400 hover:bg-dark-600"
              >
                {allFilteredIds.every(id => selectedTemplates.includes(id)) && allFilteredIds.length > 0 
                  ? '取消当前' 
                  : `全选当前 (${allFilteredIds.length})`}
              </button>
              <button
                onClick={selectAllTemplates}
                className="text-xs px-2 py-1 rounded bg-cyber-600 text-white hover:bg-cyber-500"
              >
                {selectedTemplates.length === templates.length && templates.length > 0
                  ? '取消全部' 
                  : `全选全部 (${templates.length})`}
              </button>
            </div>
          </div>
          
          {/* 搜索和分类过滤 */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
              <input
                type="text"
                placeholder="搜索模板..."
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                className="w-full pl-9 py-2 text-sm"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="min-w-[120px] py-2 text-sm"
            >
              <option value="">全部分类</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="h-52 overflow-y-auto space-y-1">
            {loading ? (
              <div className="text-center py-8 text-dark-500">
                <Loader className="w-6 h-6 mx-auto mb-2 animate-spin" />
                <p>加载中...</p>
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-dark-500">
                <FileCode2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>暂无模板</p>
                <p className="text-xs mt-1">请在设置中配置模板目录</p>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-8 text-dark-500">
                <Search className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p>未找到匹配的模板</p>
              </div>
            ) : (
              filteredTemplates.map(template => (
                <label
                  key={template.id}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer
                            transition-colors border text-sm
                            ${selectedTemplates.includes(template.id)
                              ? 'bg-cyber-500/10 border-cyber-500/30'
                              : 'bg-dark-800/50 border-transparent hover:border-dark-600'
                            }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTemplates.includes(template.id)}
                    onChange={() => toggleTemplate(template.id)}
                    className="w-4 h-4 rounded border-dark-600 bg-dark-700 
                             text-cyber-500 focus:ring-cyber-500/50"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-white truncate">
                      {template.name || template.id}
                    </div>
                    <div className="text-xs text-dark-500">
                      {template.severity} · {template.category || 'custom'}
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>
          <div className="flex items-center justify-between text-sm text-dark-500">
            <span>已选择 {selectedTemplates.length} 个模板</span>
            <span>
              {(templateSearch || categoryFilter) 
                ? `筛选 ${allFilteredIds.length} 个，显示 ${filteredTemplates.length}` 
                : `共 ${templates.length} 个`}
              {filteredTemplates.length < allFilteredIds.length && ` (显示前 ${MAX_DISPLAY})`}
            </span>
          </div>
        </div>
      </div>

      {/* 启动按钮 */}
      <div className="flex justify-center">
        <button
          onClick={handleStartScan}
          disabled={scanning || selectedTemplates.length === 0}
          className="btn btn-primary px-12 py-4 text-lg disabled:opacity-50"
        >
          {scanning ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              启动中...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              启动扫描 ({selectedTemplates.length} 个模板)
            </>
          )}
        </button>
      </div>

      {/* 扫描任务列表 */}
      {sortedScans.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyber-400" />
            <h2 className="text-lg font-semibold text-white">扫描任务</h2>
            <span className="text-sm text-dark-500">({sortedScans.length})</span>
          </div>

          {sortedScans.map(scan => (
            <div
              key={scan.id}
              className="card overflow-hidden"
            >
              {/* 扫描头部 */}
              <div 
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-dark-800/30 transition-colors"
                onClick={() => toggleScanExpand(scan.id)}
              >
                <div className="text-dark-500">
                  {expandedScans.includes(scan.id) 
                    ? <ChevronDown className="w-5 h-5" />
                    : <ChevronRight className="w-5 h-5" />
                  }
                </div>
                {getStatusIcon(scan.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-mono text-sm truncate">
                      {scan.id}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(scan.status)}`}>
                      {getStatusText(scan.status)}
                    </span>
                    {scan.found > 0 && (
                      <span className="flex items-center gap-1 text-xs text-orange-400">
                        <AlertTriangle className="w-3 h-3" />
                        {scan.found} 发现
                      </span>
                    )}
                  </div>
                  
                  {/* 进度条 */}
                  {scan.status === 'running' && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-dark-500 mb-1">
                        <span>进度: {scan.completed} / {scan.total}</span>
                        <span>{Math.round(scan.progress)}%</span>
                      </div>
                      <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-cyber-600 to-cyber-400 
                                   transition-all duration-300 rounded-full relative"
                          style={{ width: `${scan.progress}%` }}
                        >
                          <div className="absolute inset-0 bg-white/20 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="text-right text-xs text-dark-500">
                  <div>{formatDuration(scan.startedAt, scan.completedAt)}</div>
                </div>

                {scan.status === 'running' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleStopScan(scan.id); }}
                    className="btn btn-danger btn-sm"
                  >
                    <Square className="w-4 h-4" />
                    停止
                  </button>
                )}

                {scan.status === 'completed' && scan.found > 0 && onViewResult && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onViewResult(scan.id); }}
                    className="btn btn-primary btn-sm"
                  >
                    查看结果
                  </button>
                )}
              </div>

              {/* 展开详情 */}
              {expandedScans.includes(scan.id) && (
                <div className="px-4 pb-4 border-t border-dark-700/50 bg-dark-800/20">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
                    <div className="text-center p-3 rounded-lg bg-dark-800/50">
                      <div className="text-2xl font-bold text-white font-mono">
                        {scan.targets?.length || 0}
                      </div>
                      <div className="text-xs text-dark-500">目标数量</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-dark-800/50">
                      <div className="text-2xl font-bold text-white font-mono">
                        {scan.templateIds?.length || 0}
                      </div>
                      <div className="text-xs text-dark-500">模板数量</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-dark-800/50">
                      <div className="text-2xl font-bold text-cyber-400 font-mono">
                        {scan.completed}
                      </div>
                      <div className="text-xs text-dark-500">已完成</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-dark-800/50">
                      <div className={`text-2xl font-bold font-mono ${scan.found > 0 ? 'text-orange-400' : 'text-dark-400'}`}>
                        {scan.found}
                      </div>
                      <div className="text-xs text-dark-500">发现漏洞</div>
                    </div>
                  </div>

                  {/* 目标列表 */}
                  {scan.targets && scan.targets.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-dark-500 mb-2">扫描目标:</div>
                      <div className="flex flex-wrap gap-2">
                        {scan.targets.slice(0, 5).map((target, i) => (
                          <span key={i} className="text-xs px-2 py-1 rounded bg-dark-700 text-dark-300 font-mono">
                            {target}
                          </span>
                        ))}
                        {scan.targets.length > 5 && (
                          <span className="text-xs text-dark-500">
                            +{scan.targets.length - 5} 更多
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {scan.error && (
                    <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                      {scan.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Scanner
