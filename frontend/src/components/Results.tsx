import { useState, useEffect } from 'react'
import { 
  ClipboardList, 
  AlertTriangle, 
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Copy,
  Search,
  RefreshCw,
  FileCode2,
  ArrowRight,
  Send,
  FileText,
  X
} from 'lucide-react'
import { ScanResult, ScanStatus, POCTemplate } from '../types'
import toast from 'react-hot-toast'

interface ResultsProps {
  initialScanId?: string;
  onViewPOC?: (template: POCTemplate) => void;
}

function Results({ initialScanId, onViewPOC }: ResultsProps) {
  const [scans, setScans] = useState<ScanStatus[]>([])
  const [selectedScan, setSelectedScan] = useState<string>(initialScanId || '')
  const [results, setResults] = useState<ScanResult[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedResult, setExpandedResult] = useState<string | null>(null)
  const [filterSeverity, setFilterSeverity] = useState('')
  const [viewingPacket, setViewingPacket] = useState<ScanResult | null>(null)
  const [packetTab, setPacketTab] = useState<'request' | 'response'>('request')

  useEffect(() => {
    loadScans()
  }, [])

  useEffect(() => {
    if (initialScanId) {
      setSelectedScan(initialScanId)
    }
  }, [initialScanId])

  useEffect(() => {
    if (selectedScan) {
      loadResults(selectedScan)
    }
  }, [selectedScan])

  const loadScans = async () => {
    try {
      if (window.go?.main?.App?.GetAllScans) {
        const data = await window.go.main.App.GetAllScans()
        setScans(data || [])
        if (data && data.length > 0 && !selectedScan) {
          setSelectedScan(data[0].id)
        }
      }
    } catch (error) {
      console.error(error)
    }
  }

  const loadResults = async (scanId: string) => {
    setLoading(true)
    try {
      if (window.go?.main?.App?.GetScanResults) {
        const data = await window.go.main.App.GetScanResults(scanId)
        setResults(data || [])
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewPOC = async (templateId: string) => {
    try {
      if (window.go?.main?.App?.GetPOCByID) {
        const poc = await window.go.main.App.GetPOCByID(templateId)
        if (poc && onViewPOC) {
          onViewPOC(poc)
        }
      }
    } catch (error) {
      toast.error('无法加载 POC 信息')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('已复制到剪贴板')
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

  const getSeverityBgClass = (severity: string) => {
    const classes: Record<string, string> = {
      critical: 'bg-red-500/10 border-red-500/30',
      high: 'bg-orange-500/10 border-orange-500/30',
      medium: 'bg-yellow-500/10 border-yellow-500/30',
      low: 'bg-blue-500/10 border-blue-500/30',
      info: 'bg-cyan-500/10 border-cyan-500/30',
    }
    return classes[severity?.toLowerCase()] || 'bg-cyan-500/10 border-cyan-500/30'
  }

  const filteredResults = filterSeverity
    ? results.filter(r => r.severity?.toLowerCase() === filterSeverity)
    : results

  const severityCounts = results.reduce((acc, r) => {
    const sev = r.severity?.toLowerCase() || 'info'
    acc[sev] = (acc[sev] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="p-8 space-y-6">
      {/* 请求/响应包查看弹窗 */}
      {viewingPacket && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-8">
          <div className="bg-dark-900 border border-dark-700 rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between p-4 border-b border-dark-700">
              <div className="flex items-center gap-3">
                <Send className="w-5 h-5 text-cyber-400" />
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {viewingPacket.templateName || viewingPacket.templateId}
                  </h3>
                  <p className="text-sm text-dark-400">{viewingPacket.host}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingPacket(null)}
                className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab 切换 */}
            <div className="flex border-b border-dark-700">
              <button
                onClick={() => setPacketTab('request')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors
                          ${packetTab === 'request' 
                            ? 'text-cyber-400 border-b-2 border-cyber-400 bg-cyber-500/5' 
                            : 'text-dark-400 hover:text-dark-200'}`}
              >
                <Send className="w-4 h-4 inline mr-2" />
                请求包
              </button>
              <button
                onClick={() => setPacketTab('response')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors
                          ${packetTab === 'response' 
                            ? 'text-cyber-400 border-b-2 border-cyber-400 bg-cyber-500/5' 
                            : 'text-dark-400 hover:text-dark-200'}`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                响应包
              </button>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-auto p-4">
              {packetTab === 'request' ? (
                viewingPacket.request ? (
                  <div className="relative">
                    <button
                      onClick={() => copyToClipboard(viewingPacket.request || '')}
                      className="absolute top-2 right-2 p-2 rounded-lg bg-dark-700 hover:bg-dark-600 
                               text-dark-400 hover:text-white transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <pre className="p-4 rounded-lg bg-dark-950 text-green-400 font-mono text-sm 
                                  overflow-x-auto whitespace-pre-wrap break-all">
                      {viewingPacket.request}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-12 text-dark-500">
                    <Send className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>无请求数据</p>
                  </div>
                )
              ) : (
                viewingPacket.response ? (
                  <div className="relative">
                    <button
                      onClick={() => copyToClipboard(viewingPacket.response || '')}
                      className="absolute top-2 right-2 p-2 rounded-lg bg-dark-700 hover:bg-dark-600 
                               text-dark-400 hover:text-white transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <pre className="p-4 rounded-lg bg-dark-950 text-cyan-400 font-mono text-sm 
                                  overflow-x-auto whitespace-pre-wrap break-all">
                      {viewingPacket.response}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-12 text-dark-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>无响应数据</p>
                  </div>
                )
              )}
            </div>

            {/* 匹配信息 */}
            {viewingPacket.matched && (
              <div className="p-4 border-t border-dark-700 bg-dark-800/50">
                <div className="text-sm text-dark-400 mb-2">匹配内容:</div>
                <code className="block p-3 rounded-lg bg-orange-500/10 text-orange-400 
                               font-mono text-sm border border-orange-500/20">
                  {viewingPacket.matched}
                </code>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">
            扫描结果
          </h1>
          <p className="text-dark-400">
            查看和分析漏洞扫描发现
          </p>
        </div>
        <button 
          onClick={() => { loadScans(); if (selectedScan) loadResults(selectedScan); }}
          className="btn btn-secondary"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {/* 扫描选择和过滤 */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm text-dark-400 mb-1">选择扫描任务</label>
            <select
              value={selectedScan}
              onChange={(e) => setSelectedScan(e.target.value)}
              className="w-full"
            >
              <option value="">选择扫描任务...</option>
              {scans.map(scan => (
                <option key={scan.id} value={scan.id}>
                  {scan.id} - {scan.status} ({scan.found} 发现)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-dark-400 mb-1">严重程度过滤</label>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="min-w-[150px]"
            >
              <option value="">全部</option>
              <option value="critical">Critical ({severityCounts.critical || 0})</option>
              <option value="high">High ({severityCounts.high || 0})</option>
              <option value="medium">Medium ({severityCounts.medium || 0})</option>
              <option value="low">Low ({severityCounts.low || 0})</option>
              <option value="info">Info ({severityCounts.info || 0})</option>
            </select>
          </div>
        </div>
      </div>

      {/* 统计概览 */}
      {results.length > 0 && (
        <div className="grid grid-cols-5 gap-4">
          {['critical', 'high', 'medium', 'low', 'info'].map(severity => (
            <div 
              key={severity}
              onClick={() => setFilterSeverity(filterSeverity === severity ? '' : severity)}
              className={`card p-4 text-center cursor-pointer transition-all
                        ${filterSeverity === severity ? 'ring-2 ring-cyber-500' : 'hover:border-dark-600'}`}
            >
              <div className={`text-2xl font-bold font-mono mb-1
                            ${severity === 'critical' ? 'text-red-400' :
                              severity === 'high' ? 'text-orange-400' :
                              severity === 'medium' ? 'text-yellow-400' :
                              severity === 'low' ? 'text-blue-400' :
                              'text-cyan-400'}`}>
                {severityCounts[severity] || 0}
              </div>
              <div className="text-xs text-dark-500 capitalize">{severity}</div>
            </div>
          ))}
        </div>
      )}

      {/* 结果列表 */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-dark-400">
            <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin" />
            <p>加载中...</p>
          </div>
        ) : !selectedScan ? (
          <div className="p-12 text-center text-dark-400">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg mb-2">请选择扫描任务</p>
            <p className="text-sm">从上方下拉菜单选择要查看的扫描结果</p>
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="p-12 text-center text-dark-400">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg mb-2">暂无发现</p>
            <p className="text-sm">该扫描任务未发现任何漏洞</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-700/50">
            {filteredResults.map((result, index) => (
              <div 
                key={result.id}
                className={`animate-slide-in border-l-4 ${getSeverityBgClass(result.severity).replace('bg-', 'border-').replace('/10', '')}`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* 结果头部 */}
                <div
                  onClick={() => setExpandedResult(
                    expandedResult === result.id ? null : result.id
                  )}
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-dark-800/50 transition-colors"
                >
                  <div className="text-dark-500">
                    {expandedResult === result.id 
                      ? <ChevronDown className="w-5 h-5" />
                      : <ChevronRight className="w-5 h-5" />
                    }
                  </div>
                  <AlertTriangle className={`w-5 h-5
                    ${result.severity?.toLowerCase() === 'critical' ? 'text-red-400' :
                      result.severity?.toLowerCase() === 'high' ? 'text-orange-400' :
                      result.severity?.toLowerCase() === 'medium' ? 'text-yellow-400' :
                      result.severity?.toLowerCase() === 'low' ? 'text-blue-400' :
                      'text-cyan-400'}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium">
                        {result.templateName || result.templateId}
                      </span>
                      <span className={`tag ${getSeverityClass(result.severity)}`}>
                        {result.severity}
                      </span>
                    </div>
                    <div className="text-sm text-dark-400 truncate mt-1">
                      {result.host}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* 查看请求响应包按钮 */}
                    {(result.request || result.response) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setViewingPacket(result); }}
                        className="btn btn-secondary btn-sm"
                        title="查看请求/响应"
                      >
                        <Send className="w-4 h-4" />
                        查看数据包
                      </button>
                    )}
                    <div className="text-xs text-dark-500">
                      {new Date(result.timestamp).toLocaleString('zh-CN')}
                    </div>
                  </div>
                </div>

                {/* 展开详情 */}
                {expandedResult === result.id && (
                  <div className="px-4 pb-4 pl-14 space-y-4 bg-dark-800/30">
                    {/* 匹配信息 */}
                    {result.matched && (
                      <div>
                        <div className="text-sm text-dark-400 mb-2">匹配内容</div>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 p-3 rounded-lg bg-dark-900 text-cyber-400 
                                         font-mono text-sm break-all">
                            {result.matched}
                          </code>
                          <button
                            onClick={() => copyToClipboard(result.matched)}
                            className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 
                                     hover:text-white transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 提取的数据 */}
                    {result.extractedData && Object.keys(result.extractedData).length > 0 && (
                      <div>
                        <div className="text-sm text-dark-400 mb-2">提取数据</div>
                        <div className="space-y-2">
                          {Object.entries(result.extractedData).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-2">
                              <span className="text-dark-500 text-sm">{key}:</span>
                              <code className="px-2 py-1 rounded bg-dark-900 text-dark-200 
                                             font-mono text-sm">
                                {value}
                              </code>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-2 pt-2 flex-wrap">
                      {/* 跳转到 POC */}
                      <button
                        onClick={() => handleViewPOC(result.templateId)}
                        className="btn btn-primary btn-sm"
                      >
                        <FileCode2 className="w-4 h-4" />
                        查看 POC
                        <ArrowRight className="w-4 h-4" />
                      </button>

                      {/* 查看数据包 */}
                      {(result.request || result.response) && (
                        <button
                          onClick={() => setViewingPacket(result)}
                          className="btn btn-secondary btn-sm"
                        >
                          <Send className="w-4 h-4" />
                          请求/响应包
                        </button>
                      )}

                      <a
                        href={result.host}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                      >
                        <ExternalLink className="w-4 h-4" />
                        打开目标
                      </a>
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(result, null, 2))}
                        className="btn btn-secondary btn-sm"
                      >
                        <Copy className="w-4 h-4" />
                        复制详情
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 统计信息 */}
      <div className="flex items-center justify-between text-sm text-dark-500">
        <span>共 {filteredResults.length} 条结果</span>
        {filterSeverity && (
          <button
            onClick={() => setFilterSeverity('')}
            className="text-cyber-400 hover:text-cyber-300"
          >
            清除过滤
          </button>
        )}
      </div>
    </div>
  )
}

export default Results
