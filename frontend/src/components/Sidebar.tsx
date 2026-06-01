import { memo, useCallback, useMemo } from 'react'
import { 
  LayoutDashboard, 
  FileCode2, 
  Radar, 
  ClipboardList, 
  Settings,
  Bug,
  Wrench
} from 'lucide-react'
import { ViewType, Stats } from '../types'
import logoImage from '../assets/logo.jpg'

interface SidebarProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  stats: Stats | null;
}

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: '仪表盘', icon: LayoutDashboard },
  { id: 'templates', label: 'POC 模板', icon: FileCode2 },
  { id: 'scanner', label: '扫描器', icon: Radar },
  { id: 'results', label: '扫描结果', icon: ClipboardList },
  { id: 'tools', label: '编码工具', icon: Wrench },
  { id: 'settings', label: '设置', icon: Settings },
]

// 导航项组件 - 使用 memo 优化
const NavItem = memo(({ 
  item, 
  isActive, 
  onClick, 
  badge 
}: { 
  item: NavItem; 
  isActive: boolean; 
  onClick: () => void;
  badge?: number;
}) => {
  const Icon = item.icon
  
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl 
                 transition-fast group
                 ${isActive 
                   ? 'bg-gradient-to-r from-cyber-600/20 to-violet-500/10 text-cyber-400 border border-cyber-500/30' 
                   : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800/50'
                 }`}
    >
      <Icon className={`w-5 h-5 ${isActive ? 'text-cyber-400' : 'group-hover:scale-110'}`} 
            style={{ transition: 'transform 0.1s ease' }} />
      <span className="font-medium">{item.label}</span>
      
      {badge !== undefined && (
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full 
                        ${isActive ? 'bg-cyber-500/20 text-cyber-400' : 'bg-dark-700 text-dark-400'}`}>
          {badge}
        </span>
      )}
    </button>
  )
})

NavItem.displayName = 'NavItem'

// 统计面板组件 - 使用 memo 优化
const StatsPanel = memo(({ stats }: { stats: Stats | null }) => (
  <div className="card p-4 space-y-3 bg-gradient-to-br from-dark-800/80 to-dark-900/80">
    <div className="flex items-center gap-2 text-dark-400">
      <Bug className="w-4 h-4 text-accent-400" />
      <span className="text-sm">快速统计</span>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div className="text-center">
        <div className="text-2xl font-bold text-cyber-400 font-mono">
          {stats?.totalPocs || 0}
        </div>
        <div className="text-xs text-dark-500">POC 模板</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-accent-400 font-mono">
          {stats?.totalScans || 0}
        </div>
        <div className="text-xs text-dark-500">扫描任务</div>
      </div>
    </div>
  </div>
))

StatsPanel.displayName = 'StatsPanel'

function Sidebar({ currentView, onNavigate, stats }: SidebarProps) {
  // 使用 useCallback 缓存导航处理函数
  const handleNavigate = useCallback((id: ViewType) => {
    onNavigate(id)
  }, [onNavigate])

  // 缓存模板数量
  const templateCount = useMemo(() => stats?.totalPocs, [stats?.totalPocs])

  return (
    <aside className="w-64 bg-dark-900/90 backdrop-blur-md border-r border-dark-700/50 flex flex-col relative z-10">
      {/* Logo 区域 */}
      <div className="wails-drag p-5 border-b border-dark-700/50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg 
                          ring-2 ring-cyber-500/30 animate-float">
            <img 
              src={logoImage} 
              alt="SerenNP" 
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg bg-gradient-to-r from-cyber-400 to-violet-400 
                         bg-clip-text text-transparent tracking-wide">
              SerenNP
            </h1>
            <p className="text-xs text-dark-400 font-mono">Manager</p>
          </div>
        </div>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavItem 
            key={item.id}
            item={item}
            isActive={currentView === item.id}
            onClick={() => handleNavigate(item.id)}
            badge={item.id === 'templates' ? templateCount : undefined}
          />
        ))}
      </nav>

      {/* 底部统计 */}
      <div className="p-4 border-t border-dark-700/50">
        <StatsPanel stats={stats} />
      </div>

      {/* 版本信息 */}
      <div className="p-4 text-center">
        <p className="text-xs text-dark-600 font-mono">v1.0.0</p>
      </div>
    </aside>
  )
}

export default memo(Sidebar)
