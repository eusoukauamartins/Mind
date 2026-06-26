import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, CheckSquare, Calendar, DollarSign, Lightbulb,
  FlaskConical, ClipboardList, BarChart3, Dumbbell, Download,
  Menu, X, Zap,
  ChevronLeft, ChevronRight, Settings, FolderKanban, LogOut, Gift, Sparkles
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
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
      { to: '/projetos', icon: FolderKanban, label: 'Projetos' }
    ]
  },
  {
    label: 'Planejamento',
    items: [
      { to: '/calendario', icon: Calendar, label: 'Calendário' }
    ]
  },
  {
    label: 'Conhecimento',
    items: [
      { to: '/aprendizados', icon: Lightbulb, label: 'Aprendizados' }
    ]
  },
  {
    label: 'Análise',
    items: [
      { to: '/financas', icon: DollarSign, label: 'Finanças' }
    ]
  },
  {
    label: 'Progresso',
    items: [
      { to: '/recompensas', icon: Gift, label: 'Recompensas' }
    ]
  },
  {
    label: 'Sistema',
    items: [
      { to: '/ia', icon: Sparkles, label: 'IA Assistant' },
      { to: '/configuracoes', icon: Settings, label: 'Configurações' }
    ]
  }
];

const mobileNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/tarefas', icon: CheckSquare, label: 'Tarefas' },
  { to: '/recompensas', icon: Gift, label: 'Recompensas' },
  { to: '/ia', icon: Sparkles, label: 'IA' },
  { to: '/financas', icon: DollarSign, label: 'Finanças' }
];

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const appState = useApp();
  const { signOut, isSupabaseConfigured: supaConfigured, user } = useAuth();

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
        {user ? (
          <button 
            className="btn-icon" 
            onClick={() => signOut()} 
            title={`Sair (${user.email})`}
            style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <LogOut size={18} />
          </button>
        ) : (
          <div style={{ width: 22 }} />
        )}
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
            <div key={`group-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)', marginTop: group.label === 'Sistema' ? 'auto' : undefined }}>
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

          {/* User indicator & Logout Button */}
          {user && (
            <div style={{ padding: 'var(--sp-2) var(--sp-2) 0', borderTop: '1px solid var(--border-soft)', marginTop: 'var(--sp-2)' }}>
              {!collapsed && (
                <div style={{
                  padding: 'var(--sp-2) var(--sp-4)',
                  fontSize: '11px',
                  color: 'var(--text-tertiary)',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap'
                }} title={user.email}>
                  {user.email}
                </div>
              )}
              <button
                onClick={() => { signOut(); setMobileOpen(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-2)',
                  width: '100%',
                  padding: collapsed ? 'var(--sp-3)' : 'var(--sp-2) var(--sp-4)',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  fontSize: 'var(--fs-sm)',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-md)',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--danger)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                title={collapsed ? `Sair (${user.email})` : "Sair"}
              >
                <LogOut size={18} style={{ minWidth: 18 }} />
                {!collapsed && <span>Sair</span>}
              </button>
            </div>
          )}
        </nav>

      </aside>

      {/* Main Content */}
      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div style={{ flex: 1 }}>
          <ErrorBoundary key={location.pathname}>
            {children}
          </ErrorBoundary>
        </div>
        {location.pathname !== '/ia' && (
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
        )}
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
            zIndex: 150,
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
