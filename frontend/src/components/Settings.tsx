import { useState, useEffect } from 'react'
import { 
  Settings as SettingsIcon, 
  Save, 
  FolderOpen,
  Gauge,
  Globe,
  Monitor,
  RefreshCw
} from 'lucide-react'
import { Settings as SettingsType } from '../types'
import toast from 'react-hot-toast'

function Settings() {
  const [settings, setSettings] = useState<SettingsType>({
    concurrency: 10,
    timeout: 30,
    rateLimit: 100,
    bulkSize: 25,
    templatesDir: '',
    proxyUrl: '',
    headless: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      if (window.go?.main?.App?.LoadSettings) {
        const data = await window.go.main.App.LoadSettings()
        if (data) {
          setSettings(data)
        }
      }
      if (window.go?.main?.App?.GetTemplatesDir) {
        const dir = await window.go.main.App.GetTemplatesDir()
        setSettings(prev => ({ ...prev, templatesDir: dir }))
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (window.go?.main?.App?.SaveSettings) {
        await window.go.main.App.SaveSettings(settings)
        toast.success('设置已保存')
      }
    } catch (error) {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const settingSections = [
    {
      title: '扫描性能',
      icon: Gauge,
      items: [
        {
          key: 'concurrency',
          label: '并发数',
          description: '同时执行的模板数量',
          type: 'number',
          min: 1,
          max: 100,
        },
        {
          key: 'timeout',
          label: '超时时间 (秒)',
          description: '单个请求的超时时间',
          type: 'number',
          min: 1,
          max: 300,
        },
        {
          key: 'rateLimit',
          label: '速率限制',
          description: '每秒最大请求数',
          type: 'number',
          min: 1,
          max: 1000,
        },
        {
          key: 'bulkSize',
          label: '批量大小',
          description: '每批处理的目标数量',
          type: 'number',
          min: 1,
          max: 100,
        },
      ],
    },
    {
      title: '网络设置',
      icon: Globe,
      items: [
        {
          key: 'proxyUrl',
          label: '代理 URL',
          description: 'HTTP/SOCKS5 代理地址 (可选)',
          type: 'text',
          placeholder: 'http://127.0.0.1:8080',
        },
      ],
    },
    {
      title: '浏览器设置',
      icon: Monitor,
      items: [
        {
          key: 'headless',
          label: '无头浏览器',
          description: '启用 headless 模式执行浏览器模板',
          type: 'toggle',
        },
      ],
    },
  ]

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 text-cyber-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">
            系统设置
          </h1>
          <p className="text-dark-400">
            配置扫描器参数和应用选项
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary"
        >
          <Save className="w-4 h-4" />
          {saving ? '保存中...' : '保存设置'}
        </button>
      </div>

      {/* 模板目录 */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-cyber-500/20 flex items-center justify-center">
            <FolderOpen className="w-5 h-5 text-cyber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">模板目录</h2>
            <p className="text-sm text-dark-400">POC 模板存储位置（修改后需重新加载）</p>
          </div>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            value={settings.templatesDir}
            onChange={(e) => setSettings(prev => ({ ...prev, templatesDir: e.target.value }))}
            placeholder="输入模板目录路径"
            className="flex-1 font-mono text-sm"
          />
          <button
            onClick={async () => {
              if (!settings.templatesDir) {
                toast.error('请输入模板目录')
                return
              }
              try {
                if (window.go?.main?.App?.ReloadTemplates) {
                  await window.go.main.App.ReloadTemplates(settings.templatesDir)
                  toast.success('模板已重新加载')
                }
              } catch (error: any) {
                toast.error('加载失败: ' + (error?.message || '目录无效'))
              }
            }}
            className="btn btn-secondary"
          >
            <RefreshCw className="w-4 h-4" />
            重新加载
          </button>
        </div>
        <p className="mt-3 text-xs text-dark-500">
          提示：可设置为 Nuclei 模板目录，如 ~/.local/nuclei-templates 或 C:\Users\xxx\nuclei-templates
        </p>
      </div>

      {/* 设置区块 */}
      {settingSections.map((section) => {
        const Icon = section.icon
        return (
          <div key={section.title} className="card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-cyber-500/20 flex items-center justify-center">
                <Icon className="w-5 h-5 text-cyber-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">{section.title}</h2>
            </div>
            <div className="space-y-6">
              {section.items.map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <div>
                    <label className="text-white font-medium">{item.label}</label>
                    <p className="text-sm text-dark-500">{item.description}</p>
                  </div>
                  <div className="w-48">
                    {item.type === 'number' && (
                      <input
                        type="number"
                        value={settings[item.key as keyof SettingsType] as number}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          [item.key]: parseInt(e.target.value) || 0
                        }))}
                        min={'min' in item ? item.min : undefined}
                        max={'max' in item ? item.max : undefined}
                        className="w-full text-right font-mono"
                      />
                    )}
                    {item.type === 'text' && (
                      <input
                        type="text"
                        value={settings[item.key as keyof SettingsType] as string || ''}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          [item.key]: e.target.value
                        }))}
                        placeholder={'placeholder' in item ? item.placeholder : undefined}
                        className="w-full"
                      />
                    )}
                    {item.type === 'toggle' && (
                      <button
                        onClick={() => setSettings(prev => ({
                          ...prev,
                          [item.key]: !prev[item.key as keyof SettingsType]
                        }))}
                        className={`relative w-14 h-7 rounded-full transition-colors duration-200
                                  ${settings[item.key as keyof SettingsType]
                                    ? 'bg-cyber-500'
                                    : 'bg-dark-700'
                                  }`}
                      >
                        <span
                          className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md
                                    transition-transform duration-200
                                    ${settings[item.key as keyof SettingsType]
                                      ? 'translate-x-8'
                                      : 'translate-x-1'
                                    }`}
                        />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* 关于 */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-cyber-500/20 flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-cyber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">关于</h2>
            <p className="text-sm text-dark-400">Nuclei POC Manager</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-3 rounded-lg bg-dark-800/50">
            <span className="text-dark-500">版本</span>
            <p className="text-white font-mono mt-1">1.0.0</p>
          </div>
          <div className="p-3 rounded-lg bg-dark-800/50">
            <span className="text-dark-500">Nuclei SDK</span>
            <p className="text-white font-mono mt-1">v3.2.0</p>
          </div>
          <div className="p-3 rounded-lg bg-dark-800/50">
            <span className="text-dark-500">框架</span>
            <p className="text-white font-mono mt-1">Wails v2.8.0</p>
          </div>
          <div className="p-3 rounded-lg bg-dark-800/50">
            <span className="text-dark-500">前端</span>
            <p className="text-white font-mono mt-1">React 18 + TypeScript</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings

