import { useState, useEffect, lazy, Suspense, useCallback, memo } from 'react'
import Sidebar from './components/Sidebar'
import { ViewType, POCTemplate, Stats } from './types'
import { Loader } from 'lucide-react'

// 懒加载组件 - 提升首屏加载速度
const Dashboard = lazy(() => import('./components/Dashboard'))
const TemplateList = lazy(() => import('./components/TemplateList'))
const TemplateEditor = lazy(() => import('./components/TemplateEditor'))
const Scanner = lazy(() => import('./components/Scanner'))
const Results = lazy(() => import('./components/Results'))
const Tools = lazy(() => import('./components/Tools'))
const Settings = lazy(() => import('./components/Settings'))

// 加载中组件
const LoadingFallback = memo(() => (
  <div className="flex items-center justify-center h-full">
    <div className="text-center">
      <Loader className="w-8 h-8 text-cyber-400 animate-spin mx-auto mb-3" />
      <p className="text-dark-400">加载中...</p>
    </div>
  </div>
))

// Wails 运行时绑定
declare global {
  interface Window {
    go: {
      main: {
        App: {
          GetAllPOCs: () => Promise<POCTemplate[]>;
          GetPOCsPaginated: (page: number, pageSize: number) => Promise<{ templates: POCTemplate[], total: number, page: number, pageSize: number }>;
          GetPOCCount: () => Promise<number>;
          GetPOCByID: (id: string) => Promise<POCTemplate>;
          CreatePOC: (template: POCTemplate) => Promise<void>;
          UpdatePOC: (template: POCTemplate) => Promise<void>;
          DeletePOC: (id: string) => Promise<void>;
          GetCategories: () => Promise<string[]>;
          GetCategoriesWithCount: () => Promise<Record<string, number>>;
          GetPOCsByCategory: (category: string) => Promise<POCTemplate[]>;
          GetPOCsBySeverity: (severity: string) => Promise<POCTemplate[]>;
          CreateCategory: (categoryName: string) => Promise<void>;
          DeleteCategory: (categoryName: string) => Promise<void>;
          RenameCategory: (oldName: string, newName: string) => Promise<void>;
          SearchPOCs: (query: string, category: string, severity: string) => Promise<POCTemplate[]>;
          ImportPOC: (content: string) => Promise<POCTemplate>;
          ExportPOC: (id: string) => Promise<string>;
          StartScan: (request: any) => Promise<string>;
          StopScan: (scanId: string) => Promise<void>;
          GetScanStatus: (scanId: string) => Promise<any>;
          GetScanResults: (scanId: string) => Promise<any[]>;
          GetAllScans: () => Promise<any[]>;
          ValidatePOCYAML: (content: string) => Promise<void>;
          GetTemplatesDir: () => Promise<string>;
          GetStats: () => Promise<Stats>;
          SaveSettings: (settings: any) => Promise<void>;
          LoadSettings: () => Promise<any>;
          ReloadTemplates: (templatesDir: string) => Promise<void>;
        };
      };
    };
  }
}

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard')
  const [selectedTemplate, setSelectedTemplate] = useState<POCTemplate | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [selectedScanId, setSelectedScanId] = useState<string>('')

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = useCallback(async () => {
    try {
      if (window.go?.main?.App?.GetStats) {
        const data = await window.go.main.App.GetStats()
        setStats(data)
      }
    } catch (error) {
      console.error('加载统计数据失败:', error)
    }
  }, [])

  const handleEditTemplate = useCallback((template: POCTemplate) => {
    setSelectedTemplate(template)
    setIsEditorOpen(true)
  }, [])

  const handleNewTemplate = useCallback(() => {
    setSelectedTemplate(null)
    setIsEditorOpen(true)
  }, [])

  const handleCloseEditor = useCallback(() => {
    setIsEditorOpen(false)
    setSelectedTemplate(null)
    loadStats()
  }, [loadStats])

  // 从扫描器跳转到结果页面
  const handleViewScanResult = useCallback((scanId: string) => {
    setSelectedScanId(scanId)
    setCurrentView('results')
  }, [])

  // 从结果页面跳转到 POC 编辑器
  const handleViewPOC = useCallback((template: POCTemplate) => {
    setSelectedTemplate(template)
    setIsEditorOpen(true)
  }, [])

  const handleNavigate = useCallback((view: ViewType) => {
    setCurrentView(view)
    setIsEditorOpen(false)
    if (view !== 'results') {
      setSelectedScanId('')
    }
  }, [])

  const renderContent = () => {
    if (isEditorOpen) {
      return (
        <TemplateEditor
          template={selectedTemplate}
          onClose={handleCloseEditor}
          onSave={handleCloseEditor}
        />
      )
    }

    switch (currentView) {
      case 'dashboard':
        return <Dashboard stats={stats} onNavigate={setCurrentView} />
      case 'templates':
        return (
          <TemplateList
            onEdit={handleEditTemplate}
            onNew={handleNewTemplate}
          />
        )
      case 'scanner':
        return <Scanner onViewResult={handleViewScanResult} />
      case 'results':
        return (
          <Results 
            initialScanId={selectedScanId}
            onViewPOC={handleViewPOC}
          />
        )
      case 'tools':
        return <Tools />
      case 'settings':
        return <Settings />
      default:
        return <Dashboard stats={stats} onNavigate={setCurrentView} />
    }
  }

  return (
    <div className="flex h-screen bg-dark-950 text-dark-100 overflow-hidden">
      {/* 背景效果 - 使用 GPU 加速 */}
      <div className="fixed inset-0 grid-bg pointer-events-none will-change-transform" />
      <div className="fixed inset-0 bg-gradient-to-br from-cyber-900/10 via-transparent to-violet-900/10 pointer-events-none" />
      
      {/* 装饰性光晕 - GPU 加速 */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyber-500/5 rounded-full blur-3xl pointer-events-none will-change-transform" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none will-change-transform" />
      
      {/* 侧边栏 */}
      <Sidebar 
        currentView={currentView} 
        onNavigate={handleNavigate}
        stats={stats}
      />
      
      {/* 主内容区 */}
      <main className="flex-1 relative overflow-hidden">
        {/* Windows 拖拽区域 */}
        <div className="wails-drag h-8 absolute top-0 left-0 right-0 z-50" />
        
        <div className="h-full overflow-auto pt-8">
          <Suspense fallback={<LoadingFallback />}>
            {renderContent()}
          </Suspense>
        </div>
      </main>
    </div>
  )
}

export default App
