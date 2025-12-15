import { useState, useCallback, useMemo, memo } from 'react'
import { 
  Wrench,
  ArrowRightLeft,
  Copy,
  Trash2,
  Lock,
  Unlock,
  Key,
  Hash,
  FileCode,
  Globe,
  Binary,
  RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'
import CryptoJS from 'crypto-js'

type ToolType = 'base64' | 'url' | 'unicode' | 'hex' | 'html' | 'aes' | 'md5' | 'sha'

interface Tool {
  id: ToolType
  name: string
  icon: React.ElementType
  description: string
  hasKey?: boolean
  modes?: string[]
}

const tools: Tool[] = [
  { id: 'base64', name: 'Base64', icon: FileCode, description: 'Base64 编码/解码' },
  { id: 'url', name: 'URL', icon: Globe, description: 'URL 编码/解码' },
  { id: 'unicode', name: 'Unicode', icon: Hash, description: 'Unicode 编码/解码' },
  { id: 'hex', name: 'Hex', icon: Binary, description: '十六进制 编码/解码' },
  { id: 'html', name: 'HTML', icon: FileCode, description: 'HTML 实体 编码/解码' },
  { id: 'aes', name: 'AES', icon: Lock, description: 'AES 加密/解密', hasKey: true, modes: ['CBC', 'ECB', 'CFB', 'OFB', 'CTR'] },
  { id: 'md5', name: 'MD5', icon: Key, description: 'MD5 哈希（单向）' },
  { id: 'sha', name: 'SHA', icon: Key, description: 'SHA 哈希（单向）', modes: ['SHA1', 'SHA256', 'SHA512'] },
]

// 工具按钮组件
const ToolButton = memo(({ 
  tool, 
  isActive, 
  onClick 
}: { 
  tool: Tool; 
  isActive: boolean; 
  onClick: () => void;
}) => {
  const Icon = tool.icon
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-fast
                ${isActive 
                  ? 'bg-gradient-to-r from-cyber-600/30 to-violet-600/20 text-cyber-400 border border-cyber-500/50' 
                  : 'bg-dark-800/50 text-dark-400 border border-dark-700 hover:border-dark-600 hover:text-dark-200'
                }`}
    >
      <Icon className="w-4 h-4" />
      <span>{tool.name}</span>
    </button>
  )
})

ToolButton.displayName = 'ToolButton'

// 快捷按钮组件
const QuickButton = memo(({ 
  title, 
  desc, 
  onClick,
  color = 'cyber'
}: { 
  title: string; 
  desc: string; 
  onClick: () => void;
  color?: 'cyber' | 'violet' | 'accent';
}) => {
  const borderColors = {
    cyber: 'hover:border-cyber-500/50',
    violet: 'hover:border-violet-500/50',
    accent: 'hover:border-accent-500/50',
  }
  
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-lg bg-dark-700/50 hover:bg-dark-700 border border-dark-600 
               ${borderColors[color]} transition-fast text-left`}
    >
      <div className="text-sm text-white">{title}</div>
      <div className="text-xs text-dark-500">{desc}</div>
    </button>
  )
})

QuickButton.displayName = 'QuickButton'

function Tools() {
  const [activeTool, setActiveTool] = useState<ToolType>('base64')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [aesKey, setAesKey] = useState('')
  const [aesIv, setAesIv] = useState('')
  const [aesMode, setAesMode] = useState('CBC')
  const [shaMode, setShaMode] = useState('SHA256')
  const [isProcessing, setIsProcessing] = useState(false)

  const currentTool = useMemo(() => 
    tools.find(t => t.id === activeTool)!, 
    [activeTool]
  )

  // 编解码函数 - 使用 useCallback 缓存
  const base64Encode = useCallback((text: string) => {
    try {
      return btoa(unescape(encodeURIComponent(text)))
    } catch {
      throw new Error('编码失败')
    }
  }, [])

  const base64Decode = useCallback((text: string) => {
    try {
      return decodeURIComponent(escape(atob(text.trim())))
    } catch {
      throw new Error('解码失败：无效的 Base64 字符串')
    }
  }, [])

  const urlEncode = useCallback((text: string) => encodeURIComponent(text), [])
  
  const urlDecode = useCallback((text: string) => {
    try {
      return decodeURIComponent(text)
    } catch {
      throw new Error('解码失败：无效的 URL 编码')
    }
  }, [])

  const unicodeEncode = useCallback((text: string) => {
    return text.split('').map(char => {
      const code = char.charCodeAt(0)
      if (code > 127) {
        return '\\u' + code.toString(16).padStart(4, '0')
      }
      return char
    }).join('')
  }, [])

  const unicodeDecode = useCallback((text: string) => {
    try {
      return text.replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => 
        String.fromCharCode(parseInt(code, 16))
      )
    } catch {
      throw new Error('解码失败')
    }
  }, [])

  const hexEncode = useCallback((text: string) => {
    return Array.from(text).map(char => 
      char.charCodeAt(0).toString(16).padStart(2, '0')
    ).join(' ')
  }, [])

  const hexDecode = useCallback((text: string) => {
    try {
      const hex = text.replace(/\s/g, '')
      let result = ''
      for (let i = 0; i < hex.length; i += 2) {
        result += String.fromCharCode(parseInt(hex.substr(i, 2), 16))
      }
      return result
    } catch {
      throw new Error('解码失败：无效的十六进制')
    }
  }, [])

  const htmlEncode = useCallback((text: string) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }, [])

  const htmlDecode = useCallback((text: string) => {
    const doc = new DOMParser().parseFromString(text, 'text/html')
    return doc.documentElement.textContent || ''
  }, [])

  const aesEncrypt = useCallback((text: string) => {
    if (!aesKey) throw new Error('请输入密钥')
    const key = CryptoJS.enc.Utf8.parse(aesKey.padEnd(16, '0').slice(0, 16))
    const iv = CryptoJS.enc.Utf8.parse((aesIv || aesKey).padEnd(16, '0').slice(0, 16))
    
    const modeMap: Record<string, any> = {
      CBC: CryptoJS.mode.CBC,
      ECB: CryptoJS.mode.ECB,
      CFB: CryptoJS.mode.CFB,
      OFB: CryptoJS.mode.OFB,
      CTR: CryptoJS.mode.CTR,
    }

    const encrypted = CryptoJS.AES.encrypt(text, key, {
      iv: iv,
      mode: modeMap[aesMode],
      padding: CryptoJS.pad.Pkcs7
    })
    return encrypted.toString()
  }, [aesKey, aesIv, aesMode])

  const aesDecrypt = useCallback((text: string) => {
    if (!aesKey) throw new Error('请输入密钥')
    try {
      const key = CryptoJS.enc.Utf8.parse(aesKey.padEnd(16, '0').slice(0, 16))
      const iv = CryptoJS.enc.Utf8.parse((aesIv || aesKey).padEnd(16, '0').slice(0, 16))
      
      const modeMap: Record<string, any> = {
        CBC: CryptoJS.mode.CBC,
        ECB: CryptoJS.mode.ECB,
        CFB: CryptoJS.mode.CFB,
        OFB: CryptoJS.mode.OFB,
        CTR: CryptoJS.mode.CTR,
      }

      const decrypted = CryptoJS.AES.decrypt(text.trim(), key, {
        iv: iv,
        mode: modeMap[aesMode],
        padding: CryptoJS.pad.Pkcs7
      })
      return decrypted.toString(CryptoJS.enc.Utf8)
    } catch {
      throw new Error('解密失败：密钥错误或数据损坏')
    }
  }, [aesKey, aesIv, aesMode])

  const hashMd5 = useCallback((text: string) => CryptoJS.MD5(text).toString(), [])
  
  const hashSha = useCallback((text: string) => {
    switch (shaMode) {
      case 'SHA1': return CryptoJS.SHA1(text).toString()
      case 'SHA256': return CryptoJS.SHA256(text).toString()
      case 'SHA512': return CryptoJS.SHA512(text).toString()
      default: return CryptoJS.SHA256(text).toString()
    }
  }, [shaMode])

  const handleEncode = useCallback(() => {
    if (!input.trim()) {
      toast.error('请输入内容')
      return
    }

    setIsProcessing(true)
    // 使用 requestAnimationFrame 避免阻塞 UI
    requestAnimationFrame(() => {
      try {
        let result = ''
        switch (activeTool) {
          case 'base64': result = base64Encode(input); break
          case 'url': result = urlEncode(input); break
          case 'unicode': result = unicodeEncode(input); break
          case 'hex': result = hexEncode(input); break
          case 'html': result = htmlEncode(input); break
          case 'aes': result = aesEncrypt(input); break
          case 'md5': result = hashMd5(input); break
          case 'sha': result = hashSha(input); break
        }
        setOutput(result)
        toast.success('编码成功')
      } catch (e: any) {
        toast.error(e.message || '编码失败')
      } finally {
        setIsProcessing(false)
      }
    })
  }, [input, activeTool, base64Encode, urlEncode, unicodeEncode, hexEncode, htmlEncode, aesEncrypt, hashMd5, hashSha])

  const handleDecode = useCallback(() => {
    if (!input.trim()) {
      toast.error('请输入内容')
      return
    }

    if (activeTool === 'md5' || activeTool === 'sha') {
      toast.error('哈希算法不支持解码')
      return
    }

    setIsProcessing(true)
    requestAnimationFrame(() => {
      try {
        let result = ''
        switch (activeTool) {
          case 'base64': result = base64Decode(input); break
          case 'url': result = urlDecode(input); break
          case 'unicode': result = unicodeDecode(input); break
          case 'hex': result = hexDecode(input); break
          case 'html': result = htmlDecode(input); break
          case 'aes': result = aesDecrypt(input); break
        }
        setOutput(result)
        toast.success('解码成功')
      } catch (e: any) {
        toast.error(e.message || '解码失败')
      } finally {
        setIsProcessing(false)
      }
    })
  }, [input, activeTool, base64Decode, urlDecode, unicodeDecode, hexDecode, htmlDecode, aesDecrypt])

  const handleSwap = useCallback(() => {
    setInput(output)
    setOutput(input)
  }, [input, output])

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('已复制到剪贴板')
  }, [])

  const handleClear = useCallback(() => {
    setInput('')
    setOutput('')
  }, [])

  const handleToolChange = useCallback((toolId: ToolType) => {
    setActiveTool(toolId)
    setOutput('')
  }, [])

  const isHashTool = activeTool === 'md5' || activeTool === 'sha'

  // 快捷操作
  const handleQuickBase64Encode = useCallback(() => {
    if (!input) return
    setOutput(base64Encode(input))
    toast.success('Base64 编码完成')
  }, [input, base64Encode])

  const handleQuickBase64Decode = useCallback(() => {
    if (!input) return
    try {
      setOutput(base64Decode(input))
      toast.success('Base64 解码完成')
    } catch {
      toast.error('解码失败')
    }
  }, [input, base64Decode])

  const handleQuickUrlEncode = useCallback(() => {
    if (!input) return
    setOutput(urlEncode(input))
    toast.success('URL 编码完成')
  }, [input, urlEncode])

  const handleQuickMd5 = useCallback(() => {
    if (!input) return
    setOutput(hashMd5(input))
    toast.success('MD5 计算完成')
  }, [input, hashMd5])

  return (
    <div className="p-8 space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-display font-bold text-white mb-2 flex items-center gap-3">
          <Wrench className="w-8 h-8 text-cyber-400" />
          编码工具箱
        </h1>
        <p className="text-dark-400">
          支持多种编码方式的加密解密工具
        </p>
      </div>

      {/* 工具选择 */}
      <div className="flex flex-wrap gap-2">
        {tools.map(tool => (
          <ToolButton
            key={tool.id}
            tool={tool}
            isActive={activeTool === tool.id}
            onClick={() => handleToolChange(tool.id)}
          />
        ))}
      </div>

      {/* 当前工具描述 */}
      <div className="card p-4 bg-gradient-to-r from-dark-800/80 to-dark-900/80">
        <div className="flex items-center gap-3">
          {(() => {
            const Icon = currentTool.icon
            return <Icon className="w-6 h-6 text-cyber-400" />
          })()}
          <div>
            <h2 className="text-lg font-semibold text-white">{currentTool.name}</h2>
            <p className="text-sm text-dark-400">{currentTool.description}</p>
          </div>
        </div>
      </div>

      {/* AES 配置 */}
      {activeTool === 'aes' && (
        <div className="card p-4 space-y-4">
          <div className="flex items-center gap-2 text-dark-400 mb-2">
            <Key className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-medium">AES 配置</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-dark-400 mb-1">密钥 (Key) *</label>
              <input
                type="text"
                value={aesKey}
                onChange={(e) => setAesKey(e.target.value)}
                placeholder="输入 16/24/32 位密钥"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-1">偏移量 (IV)</label>
              <input
                type="text"
                value={aesIv}
                onChange={(e) => setAesIv(e.target.value)}
                placeholder="留空则使用密钥"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-1">模式</label>
              <select
                value={aesMode}
                onChange={(e) => setAesMode(e.target.value)}
                className="w-full"
              >
                {currentTool.modes?.map(mode => (
                  <option key={mode} value={mode}>{mode}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* SHA 模式选择 */}
      {activeTool === 'sha' && (
        <div className="card p-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-dark-400">算法:</span>
            {currentTool.modes?.map(mode => (
              <label key={mode} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="sha-mode"
                  value={mode}
                  checked={shaMode === mode}
                  onChange={(e) => setShaMode(e.target.value)}
                  className="w-4 h-4 text-cyber-500"
                />
                <span className={shaMode === mode ? 'text-cyber-400' : 'text-dark-400'}>
                  {mode}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 输入输出区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 输入 */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-dark-400 font-medium">输入</label>
            <div className="flex gap-2">
              <button
                onClick={() => handleCopy(input)}
                className="p-1.5 rounded hover:bg-dark-700 text-dark-500 hover:text-dark-200 transition-fast"
                title="复制"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => setInput('')}
                className="p-1.5 rounded hover:bg-dark-700 text-dark-500 hover:text-dark-200 transition-fast"
                title="清空"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="请输入要处理的内容..."
            rows={10}
            className="w-full font-mono text-sm resize-none"
          />
          <div className="text-xs text-dark-500 text-right">
            {input.length} 字符
          </div>
        </div>

        {/* 输出 */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-dark-400 font-medium">输出</label>
            <div className="flex gap-2">
              <button
                onClick={() => handleCopy(output)}
                className="p-1.5 rounded hover:bg-dark-700 text-dark-500 hover:text-dark-200 transition-fast"
                title="复制"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => setOutput('')}
                className="p-1.5 rounded hover:bg-dark-700 text-dark-500 hover:text-dark-200 transition-fast"
                title="清空"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <textarea
            value={output}
            readOnly
            placeholder="处理结果将显示在这里..."
            rows={10}
            className="w-full font-mono text-sm resize-none bg-dark-900/50"
          />
          <div className="text-xs text-dark-500 text-right">
            {output.length} 字符
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={handleEncode}
          disabled={isProcessing}
          className="btn btn-primary px-8 py-3"
        >
          {isProcessing ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <Lock className="w-5 h-5" />
          )}
          {isHashTool ? '计算哈希' : '编码 / 加密'}
        </button>

        {!isHashTool && (
          <>
            <button
              onClick={handleSwap}
              className="btn btn-secondary p-3"
              title="交换输入输出"
            >
              <ArrowRightLeft className="w-5 h-5" />
            </button>

            <button
              onClick={handleDecode}
              disabled={isProcessing}
              className="btn btn-secondary px-8 py-3"
            >
              {isProcessing ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Unlock className="w-5 h-5" />
              )}
              解码 / 解密
            </button>
          </>
        )}

        <button
          onClick={handleClear}
          className="btn btn-secondary p-3"
          title="清空全部"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* 常用功能快捷入口 */}
      <div className="card p-4">
        <div className="flex items-center gap-2 text-dark-400 mb-4">
          <Hash className="w-4 h-4 text-accent-400" />
          <span className="text-sm font-medium">快捷转换</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickButton 
            title="Base64 编码" 
            desc="文本 → Base64" 
            onClick={handleQuickBase64Encode}
            color="cyber"
          />
          <QuickButton 
            title="Base64 解码" 
            desc="Base64 → 文本" 
            onClick={handleQuickBase64Decode}
            color="cyber"
          />
          <QuickButton 
            title="URL 编码" 
            desc="文本 → URL" 
            onClick={handleQuickUrlEncode}
            color="violet"
          />
          <QuickButton 
            title="MD5 哈希" 
            desc="计算 MD5 值" 
            onClick={handleQuickMd5}
            color="accent"
          />
        </div>
      </div>
    </div>
  )
}

export default memo(Tools)
