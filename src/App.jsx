import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useApp } from './contexts/AppContext'
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
import Settings from './pages/Settings'

function App() {
  const { refreshAll } = useApp()

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tarefas" element={<Tasks />} />
        <Route path="/calendario" element={<CalendarPage />} />
        <Route path="/financas" element={<Finance />} />
        <Route path="/aprendizados" element={<Learnings />} />
        <Route path="/experimentos" element={<Experiments />} />
        <Route path="/revisao" element={<WeeklyReview />} />
        <Route path="/desempenho" element={<Performance />} />
        <Route path="/treino" element={<Workout />} />
        <Route path="/exportar" element={<Export />} />
        <Route path="/configuracoes" element={<Settings />} />
      </Routes>
      <QuickAdd />
    </Layout>
  )
}

export default App
