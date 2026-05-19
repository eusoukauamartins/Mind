import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import ProgressRing from '../components/ProgressRing';
import GoalTracker from '../components/GoalTracker';
import DateFilter from '../components/DateFilter';
import Modal from '../components/Modal';
import {
  CheckSquare, DollarSign, TrendingUp, TrendingDown,
  Calendar, Target, Flame, Clock, ArrowRight, Zap,
  Lightbulb, FlaskConical, Dumbbell,
  Eye, EyeOff, Settings2, ChevronUp, ChevronDown
} from 'lucide-react';
import { formatCurrency, getToday, isToday, isThisWeek, calcDailyScore, formatDateShort, isTaskCompleted, isTaskActiveOnDate, isTaskActiveInWeek } from '../utils/helpers';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

const DEFAULT_LAYOUT = [
  { id: 'focus', label: 'Foco Principal de Hoje', visible: true, order: 0, fullWidth: false },
  { id: 'monthly_goal', label: 'Meta Financeira', visible: true, order: 1, fullWidth: false },
  { id: 'stats', label: 'Métricas Rápidas', visible: true, order: 2, fullWidth: true },
  { id: 'finance_snapshot', label: 'Finanças do Período', visible: true, order: 3, fullWidth: false },
  { id: 'weekly_chart', label: 'Produtividade Semanal', visible: true, order: 4, fullWidth: false },
  { id: 'week_summary', label: 'Resumo do Período', visible: true, order: 5, fullWidth: false },
  { id: 'quick_access', label: 'Acesso Rápido', visible: true, order: 6, fullWidth: false },
];

export default function Dashboard() {
  const [showFinance, setShowFinance] = useState(true);
  const [dateFilter, setDateFilter] = useState({ period: 'Este mês', start: '', end: '' });
  
  const [financialGoal, setFinancialGoal] = useState(() => {
    try {
      const saved = localStorage.getItem('cp_financialGoal_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch(e) { console.error('Error parsing goal:', e); }
    const oldGoal = Number(localStorage.getItem('cp_monthlyGoal')) || 0;
    return { type: 'mensal', value: oldGoal, start: '', end: '' };
  });
  
  // Custom Layout State
  const [layout, setLayout] = useState(() => {
    try {
      const saved = localStorage.getItem('cp_dashboard_layout');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch(e) { console.error('Error parsing layout:', e); }
    return DEFAULT_LAYOUT;
  });
  const [showLayoutModal, setShowLayoutModal] = useState(false);

  const { tasks, finance, dailyCheckIns, timeAllocations, workoutLogs, weeklyReviews } = useApp();
  const navigate = useNavigate();
  const today = getToday();

  // Validate layout to ensure no missing default widgets after updates
  useEffect(() => {
    if (layout.length !== DEFAULT_LAYOUT.length) {
      const merged = DEFAULT_LAYOUT.map(def => {
        const found = layout.find(l => l.id === def.id);
        return found || def;
      });
      setLayout(merged);
    }
  }, []);

  const saveLayout = (newLayout) => {
    setLayout(newLayout);
    localStorage.setItem('cp_dashboard_layout', JSON.stringify(newLayout));
  };

  const moveWidget = (index, direction) => {
    if ((direction === -1 && index === 0) || (direction === 1 && index === layout.length - 1)) return;
    const newLayout = [...layout];
    const temp = newLayout[index];
    newLayout[index] = newLayout[index + direction];
    newLayout[index + direction] = temp;
    
    // Update order property
    newLayout.forEach((item, i) => item.order = i);
    saveLayout(newLayout);
  };

  const toggleWidget = (index) => {
    const newLayout = [...layout];
    newLayout[index].visible = !newLayout[index].visible;
    saveLayout(newLayout);
  };

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

    // Financial Goal Calc
    let goalIncome = 0;
    let goalRemainingDays = 0;
    
    let gStart, gEnd;
    const todayDate = new Date();
    todayDate.setHours(0,0,0,0);
    
    if (financialGoal?.type === 'mensal') {
      const y = todayDate.getFullYear();
      const m = todayDate.getMonth();
      gStart = new Date(y, m, 1);
      gEnd = new Date(y, m + 1, 0);
    } else {
      if (financialGoal?.start && financialGoal?.end) {
        gStart = new Date(financialGoal.start + 'T00:00:00');
        gEnd = new Date(financialGoal.end + 'T00:00:00');
      } else {
        gStart = todayDate;
        gEnd = todayDate;
      }
    }

    if (gStart && gEnd && !isNaN(gStart) && !isNaN(gEnd)) {
      const startStr = gStart.toISOString().split('T')[0];
      const endStr = gEnd.toISOString().split('T')[0];
      const goalFinance = finance.filter(f => f.date >= startStr && f.date <= endStr);
      goalIncome = goalFinance.filter(f => f.type === 'entrada').reduce((s, f) => s + f.amount, 0);
      const diffRemaining = Math.ceil((gEnd - todayDate) / (1000 * 60 * 60 * 24));
      goalRemainingDays = Math.max(0, diffRemaining);
    }

    const goalProgress = financialGoal?.value > 0 ? Math.min(100, Math.round((goalIncome / financialGoal.value) * 100)) : 0;
    const goalRemainingValue = Math.max(0, (financialGoal?.value || 0) - goalIncome);


    // Pending tasks
    const pendingTasks = tasks.filter(t => !isTaskCompleted(t)).length;

    // Focus: Top 3 active tasks based on manual order
    const activeOverall = tasks
      .filter(t => t.status !== 'excluída' && !isTaskCompleted(t))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    const topFocusTasks = activeOverall.slice(0, 3);

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
      periodTrainedDays, pendingTasks, topFocusTasks,
      weekChartData,
      goalIncome, goalRemainingDays, goalProgress, goalRemainingValue,
      latestReview: weeklyReviews[weeklyReviews.length - 1],
    };
  }, [tasks, finance, dailyCheckIns, timeAllocations, workoutLogs, weeklyReviews, dateFilter, financialGoal]);

  // Widget Renderers
  const WIDGETS = {
    focus: (
      <div className="card h-100" style={{ background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--accent-subtle) 100%)', border: '1px solid var(--accent)', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <Target size={20} style={{ color: 'var(--accent)' }} />
          <span className="card-title" style={{ marginBottom: 0 }}>Foco Principal de Hoje</span>
        </div>
        <div style={{ marginTop: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {metrics.topFocusTasks.length > 0 ? (
            metrics.topFocusTasks.map((t, idx) => (
              <div key={t.id || idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-2)' }}>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{idx + 1}.</span>
                <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 'var(--fs-md)' }}>{t.title}</span>
              </div>
            ))
          ) : (
            <p style={{ fontSize: 'var(--fs-md)', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
              Nenhuma tarefa pendente.
            </p>
          )}
        </div>
      </div>
    ),
    monthly_goal: (
      <div className="card card-accent h-100" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <Target size={20} style={{ color: 'var(--success)' }} />
            <span className="card-title" style={{ marginBottom: 0 }}>Meta Financeira</span>
          </div>
          <select 
            className="form-select" 
            style={{ width: 'auto', padding: '4px 24px 4px 8px', fontSize: '11px', height: '24px', background: 'var(--bg-tertiary)', border: 'none' }}
            value={financialGoal?.type || 'mensal'}
            onChange={(e) => {
              const newVal = { ...financialGoal, type: e.target.value };
              setFinancialGoal(newVal);
              localStorage.setItem('cp_financialGoal_v2', JSON.stringify(newVal));
            }}
          >
            <option value="mensal">Mensal</option>
            <option value="personalizado">Personalizado</option>
          </select>
        </div>
        
        <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 120px' }}>
            <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>Valor Alvo</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>R$</span>
              <input 
                type="number" 
                value={financialGoal.value || ''} 
                onChange={(e) => {
                  const newVal = { ...financialGoal, value: Number(e.target.value) };
                  setFinancialGoal(newVal);
                  localStorage.setItem('cp_financialGoal_v2', JSON.stringify(newVal));
                }}
                className="form-input" 
                style={{ paddingLeft: 34, background: 'var(--bg-input)' }} 
                placeholder="0"
              />
            </div>
          </div>

          {financialGoal?.type === 'personalizado' && (
            <>
              <div style={{ flex: '1 1 110px' }}>
                <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>Data Inicial</label>
                <input 
                  type="date" 
                  value={financialGoal.start || ''} 
                  onChange={(e) => {
                    const newVal = { ...financialGoal, start: e.target.value };
                    setFinancialGoal(newVal);
                    localStorage.setItem('cp_financialGoal_v2', JSON.stringify(newVal));
                  }}
                  className="form-input" 
                  style={{ background: 'var(--bg-input)' }} 
                />
              </div>
              <div style={{ flex: '1 1 110px' }}>
                <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>Data Final</label>
                <input 
                  type="date" 
                  value={financialGoal.end || ''} 
                  onChange={(e) => {
                    const newVal = { ...financialGoal, end: e.target.value };
                    setFinancialGoal(newVal);
                    localStorage.setItem('cp_financialGoal_v2', JSON.stringify(newVal));
                  }}
                  className="form-input" 
                  style={{ background: 'var(--bg-input)' }} 
                />
              </div>
            </>
          )}
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                {showFinance ? formatCurrency(metrics.goalIncome) : '*****'}
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: '6px', fontWeight: 500 }}>
                {metrics.goalRemainingValue > 0 ? `Faltam ${formatCurrency(metrics.goalRemainingValue)}` : 'Meta atingida! 🚀'} 
                <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> • {metrics.goalRemainingDays} dias restantes</span>
              </div>
            </div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--success)', opacity: metrics.goalProgress >= 100 ? 1 : 0.8 }}>
              {metrics.goalProgress}%
            </div>
          </div>
          
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', height: 8, overflow: 'hidden' }}>
            <div style={{ width: `${metrics.goalProgress}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--success))', borderRadius: 'var(--radius-full)', transition: 'width 0.6s ease' }} />
          </div>
        </div>
      </div>
    ),
    stats: (
      <div className="grid grid-4 h-100">
        <div className="stat-card" onClick={() => navigate('/tarefas')} style={{ cursor: 'pointer', height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Tarefas Hoje</span>
            <div className="stat-icon" style={{ background: 'var(--accent-subtle)' }}>
              <CheckSquare size={18} style={{ color: 'var(--accent)' }} />
            </div>
          </div>
          <span className="stat-value">{metrics.todayCompleted}/{metrics.todayTotal}</span>
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', height: 4, overflow: 'hidden', marginTop: 'auto' }}>
            <div style={{ width: `${metrics.todayProgress}%`, height: '100%', background: 'var(--accent)', borderRadius: 'var(--radius-full)', transition: 'width 0.6s ease' }} />
          </div>
        </div>

        <div className="stat-card" style={{ height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Score do Dia</span>
            <div className="stat-icon" style={{ background: 'var(--accent-subtle)' }}>
              <Zap size={18} style={{ color: 'var(--accent)' }} />
            </div>
          </div>
          <span className="stat-value" style={{ marginTop: 'auto' }}>{metrics.dailyScore}<span style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)' }}>/100</span></span>
          <span className="stat-sub">Produtividade diária</span>
        </div>

        <div className="stat-card" style={{ height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Pendentes</span>
            <div className="stat-icon" style={{ background: 'var(--warning-subtle)' }}>
              <Clock size={18} style={{ color: 'var(--warning)' }} />
            </div>
          </div>
          <span className="stat-value" style={{ marginTop: 'auto' }}>{metrics.pendingTasks}</span>
          <span className="stat-sub">tarefas no backlog</span>
        </div>

        <div className="stat-card" onClick={() => navigate('/treino')} style={{ cursor: 'pointer', height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Treinos do Período</span>
            <div className="stat-icon" style={{ background: 'var(--success-subtle)' }}>
              <Dumbbell size={18} style={{ color: 'var(--success)' }} />
            </div>
          </div>
          <span className="stat-value" style={{ marginTop: 'auto' }}>{metrics.periodTrainedDays} <span style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', fontWeight: 400 }}>dias</span></span>
          <span className="stat-sub">concluídos no período</span>
        </div>
      </div>
    ),
    finance_snapshot: (
      <div className="card h-100" onClick={() => navigate('/financas')} style={{ cursor: 'pointer', height: '100%' }}>
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
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
            <span style={{ fontWeight: 600, fontSize: 'var(--fs-base)' }}>Lucro</span>
            <span style={{ fontWeight: 700, fontSize: 'var(--fs-xl)', color: metrics.periodProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {showFinance ? formatCurrency(metrics.periodProfit) : '*****'}
            </span>
          </div>
        </div>
      </div>
    ),
    weekly_chart: (
      <div className="card h-100">
        <div className="card-header">
          <span className="card-title">Produtividade Semanal</span>
          <Flame size={16} style={{ color: 'var(--accent)' }} />
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
    ),
    week_summary: (
      <div className="card h-100">
        <div className="card-header">
          <span className="card-title">Resumo do Período</span>
          <Calendar size={16} style={{ color: 'var(--accent)' }} />
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
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', height: 6, overflow: 'hidden', marginTop: 'auto' }}>
            <div style={{ width: `${metrics.periodProgress}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--teal))', borderRadius: 'var(--radius-full)', transition: 'width 0.6s ease' }} />
          </div>
        </div>
      </div>
    ),
    quick_access: (
      <div className="card h-100">
        <div className="card-header">
          <span className="card-title">Acesso Rápido</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)' }}>
          {[
            { icon: CheckSquare, label: 'Tarefas', path: '/tarefas', color: 'var(--accent)' },
            { icon: DollarSign, label: 'Finanças', path: '/financas', color: 'var(--accent)' },
            { icon: Lightbulb, label: 'Aprendizados', path: '/aprendizados', color: 'var(--accent)' },
            { icon: FlaskConical, label: 'Experimentos', path: '/experimentos', color: 'var(--accent)' },
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
    )
  };

  const activeWidgets = layout.filter(w => w.visible).sort((a, b) => a.order - b.order);

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Dashboard</h1>
          <p>Sua central de comando — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <GoalTracker monthlyGoal={financialGoal?.value || 0} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-6)' }}>
        <DateFilter onChange={setDateFilter} />
        <button className="btn btn-secondary" onClick={() => setShowLayoutModal(true)}>
          <Settings2 size={16} /> Personalizar
        </button>
      </div>

      {/* Dynamic Main Grid */}
      <div className="dashboard-grid">
        {activeWidgets.map(widget => {
          const WidgetComponent = WIDGETS[widget.id];
          if (!WidgetComponent) return null;
          return (
            <div 
              key={widget.id} 
              className={`dashboard-widget ${widget.fullWidth ? 'full-width' : ''}`}
            >
              {WidgetComponent}
            </div>
          );
        })}
      </div>

      {/* Customize Layout Modal */}
      {showLayoutModal && (
        <Modal title="Personalizar Dashboard" onClose={() => setShowLayoutModal(false)}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-4)' }}>
            Reorganize os widgets ou oculte os que não deseja ver.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {layout.sort((a,b) => a.order - b.order).map((widget, index) => (
              <div key={widget.id} className="widget-list-item" style={{ opacity: widget.visible ? 1 : 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button 
                      className="btn-icon btn-ghost" 
                      style={{ padding: '2px' }} 
                      onClick={() => moveWidget(index, -1)}
                      disabled={index === 0}
                    >
                      <ChevronUp size={16} style={{ opacity: index === 0 ? 0.3 : 1 }} />
                    </button>
                    <button 
                      className="btn-icon btn-ghost" 
                      style={{ padding: '2px' }} 
                      onClick={() => moveWidget(index, 1)}
                      disabled={index === layout.length - 1}
                    >
                      <ChevronDown size={16} style={{ opacity: index === layout.length - 1 ? 0.3 : 1 }} />
                    </button>
                  </div>
                  <span style={{ fontWeight: 500 }}>{widget.label}</span>
                </div>
                <button 
                  className="btn-icon" 
                  style={{ background: widget.visible ? 'var(--accent-subtle)' : 'var(--bg-tertiary)', color: widget.visible ? 'var(--accent)' : 'var(--text-tertiary)' }}
                  onClick={() => toggleWidget(index)}
                  title={widget.visible ? 'Ocultar widget' : 'Mostrar widget'}
                >
                  {widget.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
            ))}
          </div>
          <div className="form-actions" style={{ marginTop: 'var(--sp-6)' }}>
            <button className="btn btn-primary" onClick={() => setShowLayoutModal(false)}>Concluir</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
