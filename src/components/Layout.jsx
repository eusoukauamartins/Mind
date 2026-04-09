import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, CheckSquare, Calendar, DollarSign, Lightbulb,
  FlaskConical, ClipboardList, BarChart3, Dumbbell, Download,
  Menu, X, Zap,
  ChevronLeft, ChevronRight, Settings
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';

const navGroups = [
  // 1
  [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' }
  ],
  // 2
  [
    { to: '/tarefas', icon: CheckSquare, label: 'Tarefas' },
    { to: '/calendario', icon: Calendar, label: 'Calendário' }
  ],
  // 3
  [
    { to: '/financas', icon: DollarSign, label: 'Finanças' },
    { to: '/desempenho', icon: BarChart3, label: 'Desempenho' },
    { to: '/revisao', icon: ClipboardList, label: 'Revisão Semanal' }
  ],
  // 4
  [
    { to: '/aprendizados', icon: Lightbulb, label: 'Aprendizados' },
    { to: '/experimentos', icon: FlaskConical, label: 'Experimentos' }
  ],
  // 5
  [
    { to: '/treino', icon: Dumbbell, label: 'Treino' }
  ],
  // 6
  [
    { to: '/configuracoes', icon: Settings, label: 'Configurações' },
    { to: '/exportar', icon: Download, label: 'Dados & Backup' }
  ]
];

const mobileNavItems = navGroups.flat().slice(0, 5);

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const appState = useApp();

  useEffect(() => {
    const savedTheme = localStorage.getItem('cp_theme') || 'dark-purple';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const handleBackup = () => {
    const data = {
      tasks: appState.tasks,
      finance: appState.finance,
      learnings: appState.learnings,
      experiments: appState.experiments,
      weeklyReviews: appState.weeklyReviews,
      dailyCheckIns: appState.dailyCheckIns,
      timeAllocations: appState.timeAllocations,
      workoutRoutines: appState.workoutRoutines,
      workoutLogs: appState.workoutLogs,
      _metadata: {
        backup_at: new Date().toISOString(),
        app: 'Mind',
      },
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comando_pessoal_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-layout">
      {/* Mobile Header */}
      <div className="mobile-header">
        <button className="btn-icon" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <span style={{ fontWeight: 600, fontSize: 'var(--fs-md)' }}>Mind</span>
        <div style={{ width: 22 }} />
      </div>

      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''} ${collapsed ? 'collapsed' : ''}`} style={{ width: collapsed ? '60px' : 'var(--sidebar-width)' }}>
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between' }}>
          <div className="logo-icon">
            <img src="/favicon.svg" alt="Mind" width={18} height={18} />
          </div>
          {!collapsed && <h2>Mind</h2>}
          <button className="btn btn-ghost btn-sm" onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Mostrar categorias' : 'Ocultar categorias'} style={{ marginLeft: collapsed ? 0 : 'var(--sp-2)' }}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
        <nav className="sidebar-nav">
          {navGroups.map((group, index) => (
            <div key={`group-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
              {group.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => isActive ? 'active' : ''}
                  onClick={() => setMobileOpen(false)}
                >
                  <item.icon size={18} />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              ))}
              {index < navGroups.length - 1 && (
                <div style={{ height: 1, background: 'var(--border-soft)', margin: collapsed ? 'var(--sp-3) var(--sp-1)' : 'var(--sp-3)', opacity: 0.5 }} />
              )}
            </div>
          ))}
        </nav>
        {/* Backup button */}
        <div className="sidebar-footer" style={{ marginTop: 'auto', padding: 'var(--sp-4)' }}>
          <button className="btn btn-primary btn-full" onClick={handleBackup} style={{ width: '100%' }}>
            <Download size={16} style={{ marginRight: 'var(--sp-2)' }} /> Backup Dados
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div style={{ flex: 1 }}>
          {children}
        </div>
        <footer style={{ 
          textAlign: 'center', 
          padding: 'var(--sp-10) 0 var(--sp-6)', 
          fontSize: '12px', 
          color: 'var(--text-secondary)', 
          opacity: 0.7,
          fontWeight: 500,
          letterSpacing: '0.05em',
          userSelect: 'none',
          marginTop: 'auto'
        }}>
          @ Made by Kauã
        </footer>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="mobile-bottom-nav">
        {mobileNavItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => isActive ? 'active' : ''}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 150, display: 'none',
          }}
          className="mobile-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </div>
  );
}
