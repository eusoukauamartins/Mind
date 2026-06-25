import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useApp } from './contexts/AppContext'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import QuickAdd from './components/QuickAdd'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import CalendarPage from './pages/CalendarPage'
import Finance from './pages/Finance'
import Learnings from './pages/Learnings'
import Experiments from './pages/Experiments'
import WeeklyReview from './pages/WeeklyReview'
import Performance from './pages/Performance'
import Workout from './pages/Workout'
import Export from './pages/Export'
import Projects from './pages/Projects'
import AuthPage from './pages/AuthPage'
import Recompensas from './pages/Recompensas'
import AIAssistant from './pages/AIAssistant'
import { logMigrationReport } from './lib/migrationDetector'

function App() {
  const { refreshAll } = useApp()
  const { isAuthenticated, loading, isSupabaseConfigured, user } = useAuth()

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      refreshAll()
    }
  }, [loading, isAuthenticated, user, refreshAll])

  // Log migration report after successful auth (dev diagnostics)
  useEffect(() => {
    if (isAuthenticated && isSupabaseConfigured) {
      logMigrationReport()
    }
  }, [isAuthenticated, isSupabaseConfigured])

  // Show loading spinner while checking auth session
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: 'var(--text-secondary)',
        fontSize: 'var(--fs-sm)',
      }}>
        Carregando...
      </div>
    )
  }

  // If Supabase config is missing/invalid, show explicit configuration error
  if (!isSupabaseConfigured) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary, #0d0e12)',
        color: 'var(--text-primary, #ffffff)',
        padding: '20px',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <h2 style={{ color: 'var(--danger, #ff7675)', marginBottom: '10px' }}>Configuração Pendente</h2>
        <p>Supabase não configurado. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.</p>
      </div>
    );
  }

  // If Supabase is configured and user is not authenticated, show auth page
  if (!isAuthenticated) {
    return <AuthPage />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tarefas" element={<Tasks />} />
        <Route path="/projetos" element={<Projects />} />
        <Route path="/calendario" element={<CalendarPage />} />
        <Route path="/financas" element={<Finance />} />
        <Route path="/aprendizados" element={<Learnings />} />
        <Route path="/experimentos" element={<Experiments />} />
        <Route path="/revisao" element={<WeeklyReview />} />
        <Route path="/desempenho" element={<Performance />} />
        <Route path="/treino" element={<Workout />} />
        <Route path="/recompensas" element={<Recompensas />} />
        <Route path="/ia" element={<AIAssistant />} />
        <Route path="/configuracoes" element={<Export />} />
      </Routes>
      <QuickAdd />
    </Layout>
  )
}

export default App
