import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, CheckSquare, Calendar, DollarSign, Lightbulb,
  FlaskConical, ClipboardList, BarChart3, Dumbbell, Download,
  Menu, X, Zap,
  ChevronLeft, ChevronRight, Settings, FolderKanban
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { ErrorBoundary } from './ErrorBoundary';
import LyriaDailyQuotePopup from './LyriaDailyQuotePopup';

const LyriaIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s5-3 5-8-5-10-5-10-5 5-5 10 5 8 5 8z" />
    <path d="M12 22s8-3 8-10c0-4-3-6-3-6s-1 4-5 6" />
    <path d="M12 22s-8-3-8-10c0-4 3-6 3-6s1 4 5 6" />
  </svg>
);

const navGroups = [
  {
    label: '',
    items: [ { to: '/', icon: LayoutDashboard, label: 'Dashboard' } ]
  },
  {
    label: 'Execução',
    items: [
      { to: '/tarefas', icon: CheckSquare, label: 'Tarefas' },
      { to: '/projetos', icon: FolderKanban, label: 'Projetos' },
      { to: '/calendario', icon: Calendar, label: 'Calendário' }
    ]
  },
  {
    label: 'Conhecimento',
    items: [
      { to: '/aprendizados', icon: Lightbulb, label: 'Aprendizados' },
      { to: '/experimentos', icon: FlaskConical, label: 'Experimentos' }
    ]
  },
  {
    label: 'Análise',
    items: [
      { to: '/financas', icon: DollarSign, label: 'Finanças' },
      { to: '/desempenho', icon: BarChart3, label: 'Desempenho' },
      { to: '/revisao', icon: ClipboardList, label: 'Revisão Semanal' }
    ]
  },
  {
    label: 'Outros',
    items: [
      { to: '/treino', icon: Dumbbell, label: 'Treino' }
    ]
  }
];

const mobileNavItems = navGroups.flatMap(g => g.items).slice(0, 5);

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const appState = useApp();

  useEffect(() => {
    // Migrate cp_theme
    let savedTheme = localStorage.getItem('cp_theme') || 'dark-purple-premium';
    if (savedTheme && !savedTheme.includes('-premium')) {
      savedTheme = `${savedTheme}-premium`;
      localStorage.setItem('cp_theme', savedTheme);
    }
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Migrate cp_accent
    let savedAccent = localStorage.getItem('cp_accent') || 'purple-premium';
    if (savedAccent && !savedAccent.endsWith('-premium')) {
      savedAccent = `${savedAccent}-premium`;
      localStorage.setItem('cp_accent', savedAccent);
    }
    document.documentElement.setAttribute('data-accent', savedAccent);
  }, []);



  return (
    <div className="app-layout">
      {/* Premium Atmospheric Background */}
      <div className="atmospheric-container">
        <div className="atmospheric-glow-1" />
        <div className="atmospheric-glow-2" />
      </div>

      {/* Mobile Header */}
      <div className="mobile-header">
        <button className="btn-icon" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', height: '28px' }}>
          <LyriaIcon size={20} />
          <span style={{ fontWeight: 600, fontSize: 'var(--fs-md)', lineHeight: '1', display: 'flex', alignItems: 'center' }}>Lyria</span>
        </div>
        <div style={{ width: 22 }} />
      </div>

      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''} ${collapsed ? 'collapsed' : ''}`} style={{ width: collapsed ? '60px' : 'var(--sidebar-width)' }}>
        <div 
          className="sidebar-logo" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            flexDirection: collapsed ? 'column' : 'row',
            justifyContent: collapsed ? 'center' : 'space-between',
            gap: collapsed ? 'var(--sp-3)' : 'var(--sp-2)',
            height: collapsed ? 'auto' : '80px',
            padding: collapsed ? 'var(--sp-6) 0' : '0 var(--sp-5)'
          }}
        >
          <div className="logo-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LyriaIcon size={collapsed ? 26 : 28} />
          </div>
          
          {!collapsed ? (
            <>
              <h2 style={{ 
                fontSize: 'var(--fs-lg)', 
                flex: 1, 
                lineHeight: '1', 
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                letterSpacing: '-0.01em'
              }}>
                Lyria
              </h2>
              <button 
                className="btn btn-ghost btn-sm" 
                onClick={() => setCollapsed(true)} 
                title="Ocultar categorias"
                style={{ padding: '4px' }}
              >
                <ChevronLeft size={16} />
              </button>
            </>
          ) : (
            <button 
              className="btn btn-ghost btn-sm" 
              onClick={() => setCollapsed(false)} 
              title="Expandir categorias"
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>
        <nav className="sidebar-nav" style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingBottom: 'var(--sp-4)' }}>
          {navGroups.map((group, index) => (
            <div key={`group-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
              {group.label && !collapsed && (
                <div style={{ 
                  fontSize: '10px', 
                  fontWeight: 600, 
                  color: 'var(--text-tertiary)', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.05em', 
                  padding: 'var(--sp-4) var(--sp-4) var(--sp-2) var(--sp-4)',
                  opacity: 0.6
                }}>
                  {group.label}
                </div>
              )}
              {group.label && collapsed && (
                <div style={{ height: 1, background: 'var(--border-soft)', margin: 'var(--sp-4) var(--sp-2)', opacity: 0.3 }} />
              )}
              
              {group.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => isActive ? 'active' : ''}
                  onClick={() => setMobileOpen(false)}
                >
                  <item.icon size={20} style={{ minWidth: 20 }} />
                  {!collapsed && <span style={{ marginLeft: 'var(--sp-1)' }}>{item.label}</span>}
                </NavLink>
              ))}
            </div>
          ))}

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', opacity: 0.8 }}>
            <NavLink
              to="/configuracoes"
              className={({ isActive }) => isActive ? 'active' : ''}
              onClick={() => setMobileOpen(false)}
            >
              <Settings size={20} style={{ minWidth: 20 }} />
              {!collapsed && <span style={{ marginLeft: 'var(--sp-1)' }}>Configurações</span>}
            </NavLink>
          </div>
        </nav>

      </aside>

      {/* Main Content */}
      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div style={{ flex: 1 }}>
          <ErrorBoundary key={location.pathname}>
            {children}
          </ErrorBoundary>
        </div>
        <footer style={{ 
          textAlign: 'center', 
          padding: 'var(--sp-10) 0 var(--sp-6)', 
          fontSize: '12px', 
          color: 'var(--text-secondary)', 
          opacity: 0.8,
          letterSpacing: '0.03em',
          backdropFilter: 'blur(10px)',
        }}>
          @ Lyria by Kauã
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

      {/* Lyria Daily Quote Popup */}
      <LyriaDailyQuotePopup />
    </div>
  );
}
