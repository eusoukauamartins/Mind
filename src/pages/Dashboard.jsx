import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import ProgressRing from '../components/ProgressRing';
import GoalTracker from '../components/GoalTracker';
import DateFilter from '../components/DateFilter';
import {
  CheckSquare, DollarSign, TrendingUp, TrendingDown,
  Calendar, Target, Flame, Clock, ArrowRight, Zap,
  Lightbulb, FlaskConical, Dumbbell,
  Eye, EyeOff
} from 'lucide-react';
import { formatCurrency, getToday, isToday, isThisWeek, calcDailyScore, formatDateShort, isTaskCompleted, isTaskActiveOnDate, isTaskActiveInWeek } from '../utils/helpers';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

export default function Dashboard() {
  const [showFinance, setShowFinance] = useState(true);
  const [dateFilter, setDateFilter] = useState({ period: 'Este mês', start: '', end: '' });
  const [monthlyGoal, setMonthlyGoal] = useState(() => Number(localStorage.getItem('cp_monthlyGoal')) || 0);
  const [monthlyGoalNote, setMonthlyGoalNote] = useState(() => localStorage.getItem('cp_monthlyGoalNote') || '');
  const { tasks, finance, dailyCheckIns, timeAllocations, workoutLogs, weeklyReviews } = useApp();
  const navigate = useNavigate();
  const today = getToday();

  const metrics = useMemo(() => {
    // Today's tasks
    const todayTasks = tasks.filter(t => isTaskActiveOnDate(t, today));
    const todayCompleted = todayTasks.filter(t => isTaskCompleted(t, new Date(today + 'T12:00:00'))).length;
    const todayTotal = todayTasks.length || 1;
    const todayProgress = Math.round((todayCompleted / todayTotal) * 100);

    // Period tasks
    let periodCompleted = 0;
    let periodTotal = 0;
    let periodTrainedDays = 0;

    if (dateFilter.start && dateFilter.end) {
      let sd = new Date(dateFilter.start + 'T00:00:00');
      let ed = new Date(dateFilter.end + 'T00:00:00');
      const diffDays = Math.ceil(Math.abs(ed - sd) / (1000 * 60 * 60 * 24));
      const capDays = Math.min(diffDays, 100); 

      for(let i = 0; i <= capDays; i++) {
        const d = new Date(sd);
        d.setDate(d.getDate() + i);
        const ds = d.toISOString().split('T')[0];
        
        const dayTasks = tasks.filter(t => isTaskActiveOnDate(t, ds));
        periodTotal += dayTasks.length;
        periodCompleted += dayTasks.filter(t => isTaskCompleted(t, new Date(ds + 'T12:00:00'))).length;

        if (workoutLogs.some(w => w.date === ds && w.didTrain)) {
          periodTrainedDays++;
        }
      }
    }
    const periodProgress = Math.round((periodCompleted / (periodTotal || 1)) * 100);

    // Daily score
    const todayCheckIn = dailyCheckIns.find(c => c.date === today);
    const todayAllocations = timeAllocations.filter(t => t.date === today);
    const dailyScore = calcDailyScore(todayTasks, todayCheckIn, todayAllocations);

    // Finance (Period)
    let periodIncome = 0;
    let periodExpenses = 0;
    let periodProfit = 0;
    if (dateFilter.start && dateFilter.end) {
      const periodFinance = finance.filter(f => f.date >= dateFilter.start && f.date <= dateFilter.end);
      periodIncome = periodFinance.filter(f => f.type === 'entrada').reduce((s, f) => s + f.amount, 0);
      periodExpenses = periodFinance.filter(f => f.type === 'saída').reduce((s, f) => s + f.amount, 0);
      periodProfit = periodIncome - periodExpenses;
    }


    // Pending tasks
    const pendingTasks = tasks.filter(t => !isTaskCompleted(t)).length;

    // Focus
    const todayHighPriority = todayTasks.filter(t => t.priority === 'alta' && !isTaskCompleted(t, new Date(today + 'T12:00:00')));
    const mainFocus = todayHighPriority[0]?.title || todayTasks.find(t => !isTaskCompleted(t, new Date(today + 'T12:00:00')))?.title || 'Nenhuma tarefa agendada';

    // Week chart data (last 7 days)
    const weekChartData = [];
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayTasks = tasks.filter(t => isTaskActiveOnDate(t, dateStr));
      const completed = dayTasks.filter(t => isTaskCompleted(t, new Date(dateStr + 'T12:00:00'))).length;
      const checkin = dailyCheckIns.find(c => c.date === dateStr);
      const allocs = timeAllocations.filter(t => t.date === dateStr);
      const score = calcDailyScore(dayTasks, checkin, allocs);
      weekChartData.push({
        day: dayNames[d.getDay()],
        score,
        tarefas: completed,
      });
    }

    return {
      todayCompleted, todayTotal: todayTasks.length, todayProgress, dailyScore,
      periodCompleted, periodTotal, periodProgress,
      periodIncome, periodExpenses, periodProfit,
      periodTrainedDays, pendingTasks, mainFocus,
      weekChartData,
      latestReview: weeklyReviews[weeklyReviews.length - 1],
    };
  }, [tasks, finance, dailyCheckIns, timeAllocations, workoutLogs, weeklyReviews, dateFilter]);

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Dashboard</h1>
          <p>Sua central de comando — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <GoalTracker monthlyGoal={monthlyGoal} />
      </div>

      <DateFilter onChange={setDateFilter} />

      {/* Main Focus & Monthly Goal */}
      <div className="grid grid-2" style={{ marginBottom: 'var(--sp-6)' }}>
        <div className="card" style={{ background: 'linear-gradient(135deg, var(--bg-tertiary) 0%, var(--accent-subtle) 100%)', borderColor: 'var(--accent-glow)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <Target size={20} style={{ color: 'var(--accent)' }} />
            <span className="card-title" style={{ marginBottom: 0 }}>Foco Principal de Hoje</span>
          </div>
          <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, marginTop: 'var(--sp-3)' }}>
            {metrics.mainFocus}
          </p>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <DollarSign size={20} style={{ color: 'var(--success)' }} />
            <span className="card-title" style={{ marginBottom: 0 }}>Meta Financeira do Mês</span>
          </div>
          
          <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>Valor da Meta</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>R$</span>
                <input 
                  type="number" 
                  value={monthlyGoal || ''} 
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setMonthlyGoal(val);
                    localStorage.setItem('cp_monthlyGoal', val);
                  }}
                  className="form-input" 
                  style={{ paddingLeft: 34, background: 'var(--bg-input)' }} 
                  placeholder="Ex: 5000"
                />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>Estratégia / Notas</label>
              <input 
                value={monthlyGoalNote} 
                onChange={(e) => {
                  const val = e.target.value;
                  setMonthlyGoalNote(val);
                  localStorage.setItem('cp_monthlyGoalNote', val);
                }}
                className="form-input" 
                style={{ background: 'var(--bg-input)' }} 
                placeholder="Plano de ação pago este mês..."
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Progresso (Global do Mês): <strong style={{ color: 'var(--text-primary)' }}>{showFinance ? formatCurrency(metrics.periodIncome) : '*****'}</strong> / {showFinance ? formatCurrency(monthlyGoal) : '*****'}</span>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--accent)' }}>
              {monthlyGoal > 0 ? Math.min(100, Math.round((metrics.periodIncome / monthlyGoal) * 100)) : 0}%
            </span>
          </div>
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', height: 6, overflow: 'hidden' }}>
            <div style={{ width: `${monthlyGoal > 0 ? Math.min(100, (metrics.periodIncome / monthlyGoal) * 100) : 0}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--teal))', borderRadius: 'var(--radius-full)', transition: 'width 0.6s ease' }} />
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-4" style={{ marginBottom: 'var(--sp-6)' }}>
        <div className="stat-card" onClick={() => navigate('/tarefas')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Tarefas Hoje</span>
            <div className="stat-icon" style={{ background: 'var(--accent-subtle)' }}>
              <CheckSquare size={18} style={{ color: 'var(--accent)' }} />
            </div>
          </div>
          <span className="stat-value">{metrics.todayCompleted}/{metrics.todayTotal}</span>
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', height: 4, overflow: 'hidden' }}>
            <div style={{ width: `${metrics.todayProgress}%`, height: '100%', background: 'var(--accent)', borderRadius: 'var(--radius-full)', transition: 'width 0.6s ease' }} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Score do Dia</span>
            <div className="stat-icon" style={{ background: 'var(--teal-subtle)' }}>
              <Zap size={18} style={{ color: 'var(--teal)' }} />
            </div>
          </div>
          <span className="stat-value">{metrics.dailyScore}<span style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)' }}>/100</span></span>
          <span className="stat-sub">Produtividade diária</span>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Pendentes</span>
            <div className="stat-icon" style={{ background: 'var(--warning-subtle)' }}>
              <Clock size={18} style={{ color: 'var(--warning)' }} />
            </div>
          </div>
          <span className="stat-value">{metrics.pendingTasks}</span>
          <span className="stat-sub">tarefas no backlog</span>
        </div>

        <div className="stat-card" onClick={() => navigate('/treino')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Treinos do Período</span>
            <div className="stat-icon" style={{ background: 'var(--success-subtle)' }}>
              <Dumbbell size={18} style={{ color: 'var(--success)' }} />
            </div>
          </div>
          <span className="stat-value">{metrics.periodTrainedDays} <span style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', fontWeight: 400 }}>dias</span></span>
          <span className="stat-sub">concluídos no período</span>
        </div>
      </div>

      {/* Finance + Week Chart */}
      <div className="grid grid-2" style={{ marginBottom: 'var(--sp-6)' }}>
        {/* Finance Snapshot */}
        <div className="card" onClick={() => navigate('/financas')} style={{ cursor: 'pointer' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title">Finanças do Período</span>
            <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setShowFinance(!showFinance); }} title={showFinance ? 'Ocultar valores' : 'Mostrar valores'}>
              {showFinance ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <TrendingUp size={16} style={{ color: 'var(--income)' }} />
                <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>Receita</span>
              </div>
              <span style={{ color: 'var(--income)', fontWeight: 600 }}>{showFinance ? formatCurrency(metrics.periodIncome) : '*****'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <TrendingDown size={16} style={{ color: 'var(--expense)' }} />
                <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>Despesas</span>
              </div>
              <span style={{ color: 'var(--expense)', fontWeight: 600 }}>{showFinance ? formatCurrency(metrics.periodExpenses) : '*****'}</span>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 'var(--fs-base)' }}>Lucro</span>
              <span style={{ fontWeight: 700, fontSize: 'var(--fs-xl)', color: metrics.periodProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {showFinance ? formatCurrency(metrics.periodProfit) : '*****'}
              </span>
            </div>

          </div>
        </div>

        {/* Weekly Chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Produtividade Semanal</span>
            <Flame size={16} style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={metrics.weekChartData}>
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }} />
              <YAxis hide domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'var(--text-primary)' }}
                formatter={(v, name) => [name === 'score' ? `${v} pts` : `${v} tarefas`, name === 'score' ? 'Score' : 'Concluídas']}
              />
              <Bar dataKey="score" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Week Summary + Quick Links */}
      <div className="grid grid-2" style={{ marginBottom: 'var(--sp-6)' }}>
        {/* Week Summary */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Resumo do Período</span>
            <Calendar size={16} style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>Tarefas concluídas</span>
              <span style={{ fontWeight: 600 }}>{metrics.periodCompleted}/{metrics.periodTotal}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>Progresso no período</span>
              <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{metrics.periodProgress}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>Treinos realizados</span>
              <span style={{ fontWeight: 600 }}>{metrics.periodTrainedDays} dias</span>
            </div>
            <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', height: 6, overflow: 'hidden', marginTop: 'var(--sp-2)' }}>
              <div style={{ width: `${metrics.periodProgress}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--teal))', borderRadius: 'var(--radius-full)', transition: 'width 0.6s ease' }} />
            </div>
          </div>
        </div>

        {/* Quick Access */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Acesso Rápido</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)' }}>
            {[
              { icon: CheckSquare, label: 'Tarefas', path: '/tarefas', color: 'var(--accent)' },
              { icon: DollarSign, label: 'Finanças', path: '/financas', color: 'var(--success)' },
              { icon: Lightbulb, label: 'Aprendizados', path: '/aprendizados', color: 'var(--warning)' },
              { icon: FlaskConical, label: 'Experimentos', path: '/experimentos', color: 'var(--info)' },
            ].map(item => (
              <button
                key={item.path}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: 'var(--sp-3)' }}
                onClick={() => navigate(item.path)}
              >
                <item.icon size={16} style={{ color: item.color }} />
                {item.label}
                <ArrowRight size={14} style={{ marginLeft: 'auto', color: 'var(--text-tertiary)' }} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
