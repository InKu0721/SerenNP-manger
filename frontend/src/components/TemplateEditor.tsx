import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { 
  X, 
  Save, 
  AlertCircle, 
  CheckCircle, 
  FileCode2,
  Info,
  Code,
  FileText,
  Plus,
  Trash2,
  Tag,
  User,
  Link,
  AlertTriangle,
  Send,
  Globe,
  ChevronDown,
  ChevronRight,
  Zap
} from 'lucide-react'
import { POCTemplate } from '../types'
import toast from 'react-hot-toast'

interface TemplateEditorProps {
  template: POCTemplate | null;
  onClose: () => void;
  onSave: () => void;
}

type EditorMode = 'visual' | 'code';

interface HttpRequest {
  method: string;
  path: string;
  headers: { key: string; value: string }[];
  body: string;
  rawRequest: string;
  useRaw: boolean;
}

interface Matcher {
  type: 'status' | 'word' | 'regex' | 'binary' | 'dsl';
  condition: 'and' | 'or';
  values: string[];
  part: string;
  negative: boolean;
}

const severityOptions = [
  { value: 'critical', label: 'Critical', color: 'text-red-400 bg-red-500/20' },
  { value: 'high', label: 'High', color: 'text-orange-400 bg-orange-500/20' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-400 bg-yellow-500/20' },
  { value: 'low', label: 'Low', color: 'text-blue-400 bg-blue-500/20' },
  { value: 'info', label: 'Info', color: 'text-cyan-400 bg-cyan-500/20' },
];

const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
const matcherTypes = ['status', 'word', 'regex', 'binary', 'dsl'];
const matcherParts = ['body', 'header', 'all', 'status_code'];

const defaultTemplate = `id: custom-poc-template

info:
  name: Custom POC Template
  author: your-name
  severity: info
  description: Description of the vulnerability
  tags: custom,poc

http:
  - method: GET
    path:
      - "{{BaseURL}}/"
    matchers:
      - type: status
        status:
          - 200
`

function TemplateEditor({ template, onClose, onSave }: TemplateEditorProps) {
  const [mode, setMode] = useState<EditorMode>('visual')
  const [content, setContent] = useState(template?.content || defaultTemplate)
  
  // 元数据字段
  const [pocId, setPocId] = useState(template?.id || 'custom-poc-' + Date.now())
  const [name, setName] = useState(template?.name || '')
  const [author, setAuthor] = useState(template?.author || '')
  const [severity, setSeverity] = useState(template?.severity || 'info')
  const [description, setDescription] = useState(template?.description || '')
  const [category, setCategory] = useState(template?.category || 'custom')
  const [tags, setTags] = useState<string[]>(template?.tags || [])
  const [references, setReferences] = useState<string[]>(template?.reference || [])
  const [newTag, setNewTag] = useState('')
  const [newReference, setNewReference] = useState('')
  
  // HTTP 请求配置
  const [httpRequest, setHttpRequest] = useState<HttpRequest>({
    method: 'GET',
    path: '{{BaseURL}}/',
    headers: [],
    body: '',
    rawRequest: '',
    useRaw: false,
  })
  
  // Matchers 配置
  const [matchers, setMatchers] = useState<Matcher[]>([
    { type: 'status', condition: 'or', values: ['200'], part: 'status_code', negative: false }
  ])
  const [matchersCondition, setMatchersCondition] = useState<'and' | 'or'>('or')
  
  // 展开/折叠状态
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    severity: true,
    description: false,
    tags: false,
    references: false,
    http: true,
    matchers: true,
  })
  
  const [isValid, setIsValid] = useState(true)
  const [validationMessage, setValidationMessage] = useState('')
  const [saving, setSaving] = useState(false)

  // 从 YAML 内容解析
  useEffect(() => {
    if (template?.content) {
      parseYAMLToForm(template.content)
    }
  }, [])

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const parseYAMLToForm = (yaml: string) => {
    try {
      // 解析基本信息
      const idMatch = yaml.match(/^id:\s*(.+)$/m)
      const nameMatch = yaml.match(/name:\s*(.+)$/m)
      const authorMatch = yaml.match(/author:\s*(.+)$/m)
      const severityMatch = yaml.match(/severity:\s*(.+)$/m)
      const descMatch = yaml.match(/description:\s*(.+)$/m)
      const tagsMatch = yaml.match(/tags:\s*(.+)$/m)
      
      if (idMatch) setPocId(idMatch[1].trim())
      if (nameMatch) setName(nameMatch[1].trim())
      if (authorMatch) setAuthor(authorMatch[1].trim())
      if (severityMatch) setSeverity(severityMatch[1].trim().toLowerCase())
      if (descMatch) setDescription(descMatch[1].trim())
      if (tagsMatch) {
        setTags(tagsMatch[1].split(',').map(t => t.trim()).filter(t => t))
      }
      
      // 解析 HTTP 请求
      const methodMatch = yaml.match(/method:\s*(.+)$/m)
      const pathMatch = yaml.match(/path:\s*\n\s*-\s*"?(.+?)"?\s*$/m)
      
      if (methodMatch || pathMatch) {
        setHttpRequest(prev => ({
          ...prev,
          method: methodMatch ? methodMatch[1].trim() : 'GET',
          path: pathMatch ? pathMatch[1].trim() : '{{BaseURL}}/',
        }))
      }
      
      // 解析 raw request
      const rawMatch = yaml.match(/raw:\s*\n\s*-\s*\|[\s\S]*?\n([\s\S]*?)(?=\n\s*\w+:|$)/m)
      if (rawMatch) {
        setHttpRequest(prev => ({
          ...prev,
          useRaw: true,
          rawRequest: rawMatch[1].trim(),
        }))
      }
      
    } catch (e) {
      console.error('解析 YAML 失败:', e)
    }
  }

  const buildYAML = () => {
    let yaml = `id: ${pocId}

info:
  name: ${name || 'Untitled POC'}
  author: ${author || 'anonymous'}
  severity: ${severity}
  description: ${description || 'No description provided'}
  tags: ${tags.join(',')}
`
    
    if (references.length > 0) {
      yaml += `  reference:\n`
      references.forEach(ref => {
        yaml += `    - ${ref}\n`
      })
    }
    
    // HTTP 请求部分
    yaml += `\nhttp:\n`
    
    if (httpRequest.useRaw && httpRequest.rawRequest) {
      yaml += `  - raw:\n`
      yaml += `      - |\n`
      httpRequest.rawRequest.split('\n').forEach(line => {
        yaml += `        ${line}\n`
      })
    } else {
      yaml += `  - method: ${httpRequest.method}\n`
      yaml += `    path:\n`
      yaml += `      - "${httpRequest.path}"\n`
      
      if (httpRequest.headers.length > 0) {
        yaml += `    headers:\n`
        httpRequest.headers.forEach(h => {
          if (h.key && h.value) {
            yaml += `      ${h.key}: ${h.value}\n`
          }
        })
      }
      
      if (httpRequest.body) {
        yaml += `    body: |\n`
        httpRequest.body.split('\n').forEach(line => {
          yaml += `      ${line}\n`
        })
      }
    }
    
    // Matchers
    if (matchers.length > 0) {
      if (matchers.length > 1) {
        yaml += `\n    matchers-condition: ${matchersCondition}\n`
      }
      yaml += `    matchers:\n`
      
      matchers.forEach(matcher => {
        yaml += `      - type: ${matcher.type}\n`
        if (matcher.negative) {
          yaml += `        negative: true\n`
        }
        if (matcher.type === 'status') {
          yaml += `        status:\n`
          matcher.values.forEach(v => {
            yaml += `          - ${v}\n`
          })
        } else if (matcher.type === 'word') {
          yaml += `        part: ${matcher.part}\n`
          yaml += `        words:\n`
          matcher.values.forEach(v => {
            yaml += `          - "${v}"\n`
          })
        } else if (matcher.type === 'regex') {
          yaml += `        part: ${matcher.part}\n`
          yaml += `        regex:\n`
          matcher.values.forEach(v => {
            yaml += `          - "${v}"\n`
          })
        } else if (matcher.type === 'dsl') {
          yaml += `        dsl:\n`
          matcher.values.forEach(v => {
            yaml += `          - "${v}"\n`
          })
        }
      })
    }
    
    return yaml
  }

  const validateYAML = async (yaml: string) => {
    try {
      if (window.go?.main?.App?.ValidatePOCYAML) {
        await window.go.main.App.ValidatePOCYAML(yaml)
        setIsValid(true)
        setValidationMessage('YAML 格式有效')
      }
    } catch (error: any) {
      setIsValid(false)
      setValidationMessage(error?.message || 'YAML 格式无效')
    }
  }

  useEffect(() => {
    if (mode === 'code') {
      setContent(buildYAML())
      validateYAML(content)
    }
  }, [mode])

  useEffect(() => {
    if (mode === 'code') {
      validateYAML(content)
    }
  }, [content])

  // 标签管理
  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }

  // 参考链接管理
  const handleAddReference = () => {
    if (newReference.trim() && !references.includes(newReference.trim())) {
      setReferences([...references, newReference.trim()])
      setNewReference('')
    }
  }

  const handleRemoveReference = (ref: string) => {
    setReferences(references.filter(r => r !== ref))
  }

  // Headers 管理
  const addHeader = () => {
    setHttpRequest(prev => ({
      ...prev,
      headers: [...prev.headers, { key: '', value: '' }]
    }))
  }

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    setHttpRequest(prev => ({
      ...prev,
      headers: prev.headers.map((h, i) => i === index ? { ...h, [field]: value } : h)
    }))
  }

  const removeHeader = (index: number) => {
    setHttpRequest(prev => ({
      ...prev,
      headers: prev.headers.filter((_, i) => i !== index)
    }))
  }

  // Matcher 管理
  const addMatcher = () => {
    setMatchers([...matchers, { 
      type: 'word', 
      condition: 'or', 
      values: [''], 
      part: 'body',
      negative: false 
    }])
  }

  const updateMatcher = (index: number, updates: Partial<Matcher>) => {
    setMatchers(matchers.map((m, i) => i === index ? { ...m, ...updates } : m))
  }

  const removeMatcher = (index: number) => {
    setMatchers(matchers.filter((_, i) => i !== index))
  }

  const addMatcherValue = (matcherIndex: number) => {
    setMatchers(matchers.map((m, i) => 
      i === matcherIndex ? { ...m, values: [...m.values, ''] } : m
    ))
  }

  const updateMatcherValue = (matcherIndex: number, valueIndex: number, value: string) => {
    setMatchers(matchers.map((m, i) => 
      i === matcherIndex 
        ? { ...m, values: m.values.map((v, vi) => vi === valueIndex ? value : v) }
        : m
    ))
  }

  const removeMatcherValue = (matcherIndex: number, valueIndex: number) => {
    setMatchers(matchers.map((m, i) => 
      i === matcherIndex 
        ? { ...m, values: m.values.filter((_, vi) => vi !== valueIndex) }
        : m
    ))
  }

  const handleSave = async () => {
    const finalContent = mode === 'visual' ? buildYAML() : content

    setSaving(true)
    try {
      const templateData: POCTemplate = {
        id: template?.id || pocId,
        name: name,
        author: author,
        severity: severity,
        description: description,
        reference: references,
        tags: tags,
        category: category,
        content: finalContent,
        filePath: template?.filePath || '',
        createdAt: template?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      if (template?.id) {
        if (window.go?.main?.App?.UpdatePOC) {
          await window.go.main.App.UpdatePOC(templateData)
        }
      } else {
        if (window.go?.main?.App?.ImportPOC) {
          await window.go.main.App.ImportPOC(finalContent)
        }
      }
      
      toast.success('保存成功')
      onSave()
    } catch (error: any) {
      toast.error('保存失败: ' + (error?.message || '未知错误'))
    } finally {
      setSaving(false)
    }
  }

  const SectionHeader = ({ 
    title, 
    icon: Icon, 
    section 
  }: { 
    title: string; 
    icon: React.ElementType; 
    section: keyof typeof expandedSections 
  }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between p-4 hover:bg-dark-700/30 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-cyber-400" />
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      {expandedSections[section] ? (
        <ChevronDown className="w-5 h-5 text-dark-400" />
      ) : (
        <ChevronRight className="w-5 h-5 text-dark-400" />
      )}
    </button>
  )

  return (
    <div className="h-full flex flex-col p-8">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 
                     hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyber-500/20 flex items-center justify-center">
              <FileCode2 className="w-5 h-5 text-cyber-400" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-white">
                {template ? '编辑 POC 模板' : '新建 POC 模板'}
              </h1>
              <p className="text-sm text-dark-400">{pocId}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 模式切换 */}
          <div className="flex items-center bg-dark-800 rounded-lg p-1">
            <button
              onClick={() => setMode('visual')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors
                        ${mode === 'visual' 
                          ? 'bg-cyber-500/20 text-cyber-400' 
                          : 'text-dark-400 hover:text-dark-200'}`}
            >
              <FileText className="w-4 h-4" />
              可视化
            </button>
            <button
              onClick={() => setMode('code')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors
                        ${mode === 'code' 
                          ? 'bg-cyber-500/20 text-cyber-400' 
                          : 'text-dark-400 hover:text-dark-200'}`}
            >
              <Code className="w-4 h-4" />
              代码
            </button>
          </div>

          {mode === 'code' && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
                            ${isValid 
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
              {isValid ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span className="max-w-xs truncate">{validationMessage}</span>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || (mode === 'code' && !isValid)}
            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {mode === 'visual' ? (
        /* 可视化编辑模式 */
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* 基本信息 */}
          <div className="card overflow-hidden">
            <SectionHeader title="基本信息" icon={Info} section="basic" />
            {expandedSections.basic && (
              <div className="p-4 pt-0 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-dark-400 mb-1">POC ID *</label>
                  <input
                    type="text"
                    value={pocId}
                    onChange={(e) => setPocId(e.target.value.replace(/\s/g, '-').toLowerCase())}
                    placeholder="例如: CVE-2024-1234"
                    className="w-full font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm text-dark-400 mb-1">名称 *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="漏洞名称"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-dark-400 mb-1">
                    <User className="w-3 h-3 inline mr-1" />作者
                  </label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="你的名字"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-dark-400 mb-1">分类</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="例如: cves, vulnerabilities"
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 严重程度 */}
          <div className="card overflow-hidden">
            <SectionHeader title="严重程度" icon={AlertTriangle} section="severity" />
            {expandedSections.severity && (
              <div className="p-4 pt-0 flex gap-3">
                {severityOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSeverity(opt.value)}
                    className={`px-4 py-2 rounded-lg border transition-all
                              ${severity === opt.value 
                                ? `${opt.color} border-current` 
                                : 'text-dark-400 border-dark-600 hover:border-dark-500'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 漏洞描述 */}
          <div className="card overflow-hidden">
            <SectionHeader title="漏洞描述" icon={FileText} section="description" />
            {expandedSections.description && (
              <div className="p-4 pt-0">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="详细描述这个漏洞..."
                  rows={3}
                  className="w-full resize-none"
                />
              </div>
            )}
          </div>

          {/* HTTP 请求配置 */}
          <div className="card overflow-hidden">
            <SectionHeader title="HTTP 请求 (Payload)" icon={Send} section="http" />
            {expandedSections.http && (
              <div className="p-4 pt-0 space-y-4">
                {/* Raw 模式切换 */}
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={httpRequest.useRaw}
                      onChange={(e) => setHttpRequest(prev => ({ ...prev, useRaw: e.target.checked }))}
                      className="w-4 h-4 rounded border-dark-600 bg-dark-700 text-cyber-500"
                    />
                    <span className="text-dark-300">使用 Raw 请求</span>
                  </label>
                </div>

                {httpRequest.useRaw ? (
                  /* Raw 请求模式 */
                  <div>
                    <label className="block text-sm text-dark-400 mb-1">Raw HTTP 请求</label>
                    <textarea
                      value={httpRequest.rawRequest}
                      onChange={(e) => setHttpRequest(prev => ({ ...prev, rawRequest: e.target.value }))}
                      placeholder={`GET {{BaseURL}}/admin HTTP/1.1\nHost: {{Hostname}}\nUser-Agent: Mozilla/5.0\n\n`}
                      rows={8}
                      className="w-full font-mono text-sm resize-none"
                    />
                  </div>
                ) : (
                  /* 标准模式 */
                  <>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm text-dark-400 mb-1">方法</label>
                        <select
                          value={httpRequest.method}
                          onChange={(e) => setHttpRequest(prev => ({ ...prev, method: e.target.value }))}
                          className="w-full"
                        >
                          {httpMethods.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <label className="block text-sm text-dark-400 mb-1">路径</label>
                        <input
                          type="text"
                          value={httpRequest.path}
                          onChange={(e) => setHttpRequest(prev => ({ ...prev, path: e.target.value }))}
                          placeholder="{{BaseURL}}/api/vulnerable"
                          className="w-full font-mono"
                        />
                      </div>
                    </div>

                    {/* Headers */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm text-dark-400">请求头</label>
                        <button onClick={addHeader} className="text-cyber-400 hover:text-cyber-300 text-sm">
                          <Plus className="w-4 h-4 inline mr-1" />添加
                        </button>
                      </div>
                      {httpRequest.headers.map((header, index) => (
                        <div key={index} className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={header.key}
                            onChange={(e) => updateHeader(index, 'key', e.target.value)}
                            placeholder="Header 名称"
                            className="w-1/3"
                          />
                          <input
                            type="text"
                            value={header.value}
                            onChange={(e) => updateHeader(index, 'value', e.target.value)}
                            placeholder="Header 值"
                            className="flex-1"
                          />
                          <button
                            onClick={() => removeHeader(index)}
                            className="p-2 text-dark-400 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Body */}
                    {['POST', 'PUT', 'PATCH'].includes(httpRequest.method) && (
                      <div>
                        <label className="block text-sm text-dark-400 mb-1">请求体</label>
                        <textarea
                          value={httpRequest.body}
                          onChange={(e) => setHttpRequest(prev => ({ ...prev, body: e.target.value }))}
                          placeholder='{"username":"admin","password":"{{payload}}"}'
                          rows={4}
                          className="w-full font-mono text-sm resize-none"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Matchers */}
          <div className="card overflow-hidden">
            <SectionHeader title="匹配规则 (Matchers)" icon={Zap} section="matchers" />
            {expandedSections.matchers && (
              <div className="p-4 pt-0 space-y-4">
                {matchers.length > 1 && (
                  <div className="flex items-center gap-4">
                    <span className="text-dark-400 text-sm">匹配条件:</span>
                    <select
                      value={matchersCondition}
                      onChange={(e) => setMatchersCondition(e.target.value as 'and' | 'or')}
                      className="w-32"
                    >
                      <option value="and">全部匹配 (AND)</option>
                      <option value="or">任意匹配 (OR)</option>
                    </select>
                  </div>
                )}

                {matchers.map((matcher, matcherIndex) => (
                  <div key={matcherIndex} className="p-4 rounded-lg bg-dark-800/50 border border-dark-700/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-dark-300 font-medium">匹配器 #{matcherIndex + 1}</span>
                      <button
                        onClick={() => removeMatcher(matcherIndex)}
                        className="text-dark-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-dark-500 mb-1">类型</label>
                        <select
                          value={matcher.type}
                          onChange={(e) => updateMatcher(matcherIndex, { type: e.target.value as Matcher['type'] })}
                          className="w-full"
                        >
                          {matcherTypes.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      {matcher.type !== 'status' && (
                        <div>
                          <label className="block text-xs text-dark-500 mb-1">匹配部分</label>
                          <select
                            value={matcher.part}
                            onChange={(e) => updateMatcher(matcherIndex, { part: e.target.value })}
                            className="w-full"
                          >
                            {matcherParts.map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={matcher.negative}
                            onChange={(e) => updateMatcher(matcherIndex, { negative: e.target.checked })}
                            className="w-4 h-4 rounded border-dark-600 bg-dark-700 text-cyber-500"
                          />
                          <span className="text-dark-300 text-sm">反向匹配</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-dark-500">
                          {matcher.type === 'status' ? '状态码' : matcher.type === 'word' ? '关键词' : '表达式'}
                        </label>
                        <button
                          onClick={() => addMatcherValue(matcherIndex)}
                          className="text-cyber-400 hover:text-cyber-300 text-xs"
                        >
                          <Plus className="w-3 h-3 inline mr-1" />添加
                        </button>
                      </div>
                      {matcher.values.map((value, valueIndex) => (
                        <div key={valueIndex} className="flex gap-2 mb-2">
                          <input
                            type={matcher.type === 'status' ? 'number' : 'text'}
                            value={value}
                            onChange={(e) => updateMatcherValue(matcherIndex, valueIndex, e.target.value)}
                            placeholder={
                              matcher.type === 'status' ? '200' :
                              matcher.type === 'word' ? 'admin' :
                              matcher.type === 'regex' ? '.*admin.*' :
                              'contains(body, "error")'
                            }
                            className="flex-1 font-mono text-sm"
                          />
                          {matcher.values.length > 1 && (
                            <button
                              onClick={() => removeMatcherValue(matcherIndex, valueIndex)}
                              className="p-2 text-dark-400 hover:text-red-400"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <button onClick={addMatcher} className="btn btn-secondary w-full">
                  <Plus className="w-4 h-4" />
                  添加匹配器
                </button>
              </div>
            )}
          </div>

          {/* 标签 */}
          <div className="card overflow-hidden">
            <SectionHeader title="标签" icon={Tag} section="tags" />
            {expandedSections.tags && (
              <div className="p-4 pt-0">
                <div className="flex flex-wrap gap-2 mb-3">
                  {tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 px-3 py-1 rounded-full bg-cyber-500/20 text-cyber-400 text-sm">
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-400">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    placeholder="添加标签..."
                    className="flex-1"
                  />
                  <button onClick={handleAddTag} className="btn btn-secondary">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 参考链接 */}
          <div className="card overflow-hidden">
            <SectionHeader title="参考链接" icon={Link} section="references" />
            {expandedSections.references && (
              <div className="p-4 pt-0">
                <div className="space-y-2 mb-3">
                  {references.map((ref, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-dark-800/50">
                      <Globe className="w-4 h-4 text-dark-500 flex-shrink-0" />
                      <span className="flex-1 text-sm text-cyber-400 truncate">{ref}</span>
                      <button onClick={() => handleRemoveReference(ref)} className="p-1 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={newReference}
                    onChange={(e) => setNewReference(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddReference()}
                    placeholder="https://..."
                    className="flex-1"
                  />
                  <button onClick={handleAddReference} className="btn btn-secondary">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* 代码编辑模式 */
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-3 text-dark-500 text-sm">
            <Info className="w-4 h-4" />
            <span>使用标准 Nuclei YAML 格式编写模板</span>
          </div>

          <div className="flex-1 card overflow-hidden monaco-container">
            <Editor
              height="100%"
              defaultLanguage="yaml"
              value={content}
              onChange={(value) => setContent(value || '')}
              theme="vs-dark"
              options={{
                fontSize: 14,
                fontFamily: 'JetBrains Mono, Fira Code, monospace',
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                cursorBlinking: 'smooth',
                smoothScrolling: true,
                padding: { top: 16, bottom: 16 },
              }}
            />
          </div>

          <div className="mt-4 p-4 rounded-lg bg-dark-800/50 border border-dark-700/50">
            <h3 className="text-sm font-medium text-dark-300 mb-2">快速参考</h3>
            <div className="grid grid-cols-4 gap-4 text-xs text-dark-500">
              <div><span className="text-dark-400">变量:</span><br />{'{{BaseURL}}, {{Hostname}}, {{Host}}'}</div>
              <div><span className="text-dark-400">HTTP 方法:</span><br />GET, POST, PUT, DELETE</div>
              <div><span className="text-dark-400">匹配类型:</span><br />status, word, regex, dsl</div>
              <div><span className="text-dark-400">协议:</span><br />http, dns, tcp, ssl</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TemplateEditor
