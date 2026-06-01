import { 
  FileCode2, 
  Radar, 
  Shield, 
  AlertTriangle,
  TrendingUp,
  Clock,
  Zap
} from 'lucide-react'
import { Stats, ViewType } from '../types'
import logoImage from '../assets/logo.jpg'

interface DashboardProps {
  stats: Stats | null;
  onNavigate: (view: ViewType) => void;
}

function Dashboard({ stats, onNavigate }: DashboardProps) {
  const statCards = [
    {
      title: 'POC 模板',
      value: stats?.totalPocs || 0,
      icon: FileCode2,
      color: 'cyber',
      onClick: () => onNavigate('templates'),
    },
    {
      title: '扫描任务',
      value: stats?.totalScans || 0,
      icon: Radar,
      color: 'violet',
      onClick: () => onNavigate('scanner'),
    },
    {
      title: '发现漏洞',
      value: stats?.totalFindings || 0,
      icon: AlertTriangle,
      color: 'accent',
      onClick: () => onNavigate('results'),
    },
    {
      title: '安全评分',
      value: stats?.securityScore || 100,
      icon: Shield,
      color: 'cyber',
      suffix: '%',
    },
  ]

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string; glow: string }> = {
      cyber: {
        bg: 'bg-cyber-500/10',
        text: 'text-cyber-400',
        border: 'border-cyber-500/30',
        glow: 'shadow-cyber-500/20',
      },
      violet: {
        bg: 'bg-violet-500/10',
        text: 'text-violet-400',
        border: 'border-violet-500/30',
        glow: 'shadow-violet-500/20',
      },
      accent: {
        bg: 'bg-accent-500/10',
        text: 'text-accent-400',
        border: 'border-accent-500/30',
        glow: 'shadow-accent-500/20',
      },
    }
    return colors[color] || colors.cyber
  }

  return (
    <div className="p-8 space-y-8">
      {/* 欢迎区域 */}
      <div className="card p-8 bg-gradient-to-r from-dark-800/80 via-cyber-900/20 to-violet-900/20 
                      border border-cyber-500/20 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyber-500/10 to-violet-500/10 
                       rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center gap-6">
          <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-xl 
                          ring-2 ring-cyber-500/30 animate-float">
            <img 
              src={logoImage} 
              alt="SerenNP" 
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold mb-2">
              <span className="bg-gradient-to-r from-cyber-400 via-cyber-300 to-violet-400 
                             bg-clip-text text-transparent">
                欢迎使用 SerenNP Manager
              </span>
            </h1>
            <p className="text-dark-400 text-lg">
              强大的漏洞 POC 管理与扫描平台
            </p>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => {
          const colors = getColorClasses(card.color)
          const Icon = card.icon
          
          return (
            <div
              key={index}
              onClick={card.onClick}
              className={`card p-6 ${card.onClick ? 'cursor-pointer hover:scale-105' : ''} 
                         transition-all duration-300 group border ${colors.border}
                         hover:shadow-lg ${colors.glow}`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl ${colors.bg} ${colors.text} 
                               group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-6 h-6" />
                </div>
                <TrendingUp className="w-5 h-5 text-dark-500" />
              </div>
              <div className={`text-3xl font-bold ${colors.text} font-mono mb-1`}>
                {card.value}{card.suffix}
              </div>
              <div className="text-dark-400 text-sm">{card.title}</div>
            </div>
          )
        })}
      </div>

      {/* 快速操作 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyber-400" />
            快速操作
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => onNavigate('templates')}
              className="p-4 rounded-xl bg-dark-700/50 hover:bg-dark-700 
                       border border-dark-600 hover:border-cyber-500/50
                       transition-all duration-200 text-left group"
            >
              <FileCode2 className="w-8 h-8 text-cyber-400 mb-2 group-hover:scale-110 transition-transform" />
              <div className="font-medium text-white">新建 POC</div>
              <div className="text-sm text-dark-400">创建新的漏洞模板</div>
            </button>
            <button
              onClick={() => onNavigate('scanner')}
              className="p-4 rounded-xl bg-dark-700/50 hover:bg-dark-700 
                       border border-dark-600 hover:border-violet-500/50
                       transition-all duration-200 text-left group"
            >
              <Radar className="w-8 h-8 text-violet-400 mb-2 group-hover:scale-110 transition-transform" />
              <div className="font-medium text-white">启动扫描</div>
              <div className="text-sm text-dark-400">开始新的扫描任务</div>
            </button>
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-violet-400" />
            最近活动
          </h2>
          <div className="space-y-3">
            {stats?.recentScans && stats.recentScans.length > 0 ? (
              stats.recentScans.slice(0, 3).map((scan, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg bg-dark-700/30
                           hover:bg-dark-700/50 transition-colors cursor-pointer"
                  onClick={() => onNavigate('results')}
                >
                  <div className={`w-2 h-2 rounded-full 
                                ${scan.status === 'completed' ? 'bg-cyber-400' : 
                                  scan.status === 'running' ? 'bg-violet-400 animate-pulse' : 
                                  'bg-dark-500'}`} 
                  />
                  <div className="flex-1">
                    <div className="text-sm text-white">{scan.id}</div>
                    <div className="text-xs text-dark-500">
                      {scan.found} 发现 · {scan.status}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-dark-500">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>暂无最近活动</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 分类统计 */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-accent-400" />
          严重程度分布
        </h2>
        <div className="grid grid-cols-5 gap-4">
          {['critical', 'high', 'medium', 'low', 'info'].map((severity) => {
            const count = stats?.severityCounts?.[severity] || 0
            const colors: Record<string, string> = {
              critical: 'bg-accent-500/20 text-accent-400 border-accent-500/30',
              high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
              medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
              low: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
              info: 'bg-cyber-500/20 text-cyber-400 border-cyber-500/30',
            }
            
            return (
              <div 
                key={severity}
                className={`p-4 rounded-xl border ${colors[severity]} text-center`}
              >
                <div className="text-2xl font-bold font-mono">{count}</div>
                <div className="text-xs capitalize opacity-80">{severity}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
