import { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import ProgressRing from '../components/ProgressRing';
import { BarChart3, Zap, Brain, Clock, TrendingUp, Calendar, Save } from 'lucide-react';
import { getToday, isThisWeek, calcDailyScore, formatDate, DAY_NAMES_FULL, isTaskActiveOnDate, isTaskCompleted } from '../utils/helpers';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';

const timeCategories = [
  { key: 'trabalho_produtivo', label: 'Trabalho Produtivo', color: '#6c5ce7' },
  { key: 'estudo', label: 'Estudo', color: '#00cec9' },
  { key: 'testes', label: 'Testes', color: '#74b9ff' },
  { key: 'academia', label: 'Academia', color: '#00b894' },
  { key: 'lazer', label: 'Lazer', color: '#fdcb6e' },
  { key: 'distrações', label: 'Distrações', color: '#e17055' },
  { key: 'perda_de_tempo', label: 'Perda de Tempo', color: '#d63031' },
];

export default function Performance() {
  const { tasks, dailyCheckIns, timeAllocations, createItem, updateItem } = useApp();
  const today = getToday();
  const [tab, setTab] = useState('checkin');

  // Check-in form
  const existingCheckIn = dailyCheckIns.find(c => c.date === today);
  const [checkIn, setCheckIn] = useState({
    dayQuality: existingCheckIn?.dayQuality || '',
    energy: existingCheckIn?.energy || '',
    focus: existingCheckIn?.focus || '',
  });

  // Time allocation form
  const existingAllocations = timeAllocations.filter(t => t.date === today);
  const [hours, setHours] = useState(() => {
    const map = {};
    timeCategories.forEach(c => {
      const existing = existingAllocations.find(a => a.category === c.key);
      map[c.key] = existing ? existing.hours.toString() : '';
    });
    return map;
  });

  const saveCheckIn = () => {
    if (!checkIn.dayQuality) return;
    if (existingCheckIn) {
      updateItem('dailyCheckIns', existingCheckIn.id, { ...checkIn, date: today });
    } else {
      createItem('dailyCheckIns', { ...checkIn, date: today });
    }
  };

  const saveTimeAllocation = () => {
    // Remove existing entries for today
    existingAllocations.forEach(a => {
      updateItem('timeAllocations', a.id, { _deleted: true });
    });
    // Create new entries
    timeCategories.forEach(cat => {
      const h = parseFloat(hours[cat.key]);
      if (h > 0) {
        createItem('timeAllocations', { date: today, category: cat.key, hours: h });
      }
    });
  };

  // Computed metrics
  const metrics = useMemo(() => {
    // Daily score
    const todayTasks = tasks.filter(t => isTaskActiveOnDate(t, today));
    const todayCheckIn = dailyCheckIns.find(c => c.date === today);
    const todayAllocs = timeAllocations.filter(t => t.date === today);
    const dailyScore = calcDailyScore(todayTasks, todayCheckIn, todayAllocs);

    // Task completion
    const tasksCompleted = todayTasks.filter(t => isTaskCompleted(t, new Date(today + 'T12:00:00'))).length;
    const taskTotal = todayTasks.length;
    const completionRate = taskTotal > 0 ? Math.round((tasksCompleted / taskTotal) * 100) : 0;

    // Week data
    const weekScores = [];
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    let bestDay = null, worstDay = null, bestScore = -1, worstScore = 101;

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayTasks = tasks.filter(t => isTaskActiveOnDate(t, dateStr));
      const checkin = dailyCheckIns.find(c => c.date === dateStr);
      const allocs = timeAllocations.filter(t => t.date === dateStr);
      const score = calcDailyScore(dayTasks, checkin, allocs);
      const dayName = dayNames[d.getDay()];
      weekScores.push({ day: dayName, score, date: dateStr });
      if (score > bestScore) { bestScore = score; bestDay = dayName; }
      if (score < worstScore) { worstScore = score; worstDay = dayName; }
    }

    const avgScore = Math.round(weekScores.reduce((s, d) => s + d.score, 0) / 7);

    // Time allocation summary for the week
    const weekAllocs = timeAllocations.filter(t => isThisWeek(t.date));
    const timeDistribution = timeCategories.map(cat => {
      const totalHours = weekAllocs.filter(a => a.category === cat.key).reduce((s, a) => s + a.hours, 0);
      return { name: cat.label, value: Math.round(totalHours * 10) / 10, color: cat.color };
    }).filter(t => t.value > 0);

    // Weekly streak / trend
    const lastWeekScores = [];
    for (let i = 13; i >= 7; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayTasks = tasks.filter(t => isTaskActiveOnDate(t, dateStr));
      const checkin = dailyCheckIns.find(c => c.date === dateStr);
      const allocs = timeAllocations.filter(t => t.date === dateStr);
      lastWeekScores.push(calcDailyScore(dayTasks, checkin, allocs));
    }
    const lastWeekAvg = Math.round(lastWeekScores.reduce((s, v) => s + v, 0) / 7);
    const trend = avgScore - lastWeekAvg;

    return {
      dailyScore, tasksCompleted, taskTotal, completionRate,
      weekScores, avgScore, bestDay, worstDay, bestScore, worstScore,
      timeDistribution, trend, lastWeekAvg,
    };
  }, [tasks, dailyCheckIns, timeAllocations, today]);

  const QualityBtn = ({ value, label, current, onChange }) => (
    <button
      onClick={() => onChange(value)}
      style={{
        padding: 'var(--sp-2) var(--sp-3)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-sm)',
        fontWeight: 500, border: '1px solid', cursor: 'pointer', transition: 'all var(--transition-fast)',
        background: current === value ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
        borderColor: current === value ? 'var(--accent)' : 'var(--border)',
        color: current === value ? 'var(--accent)' : 'var(--text-secondary)',
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Desempenho</h1>
        <p>Check-in diário, alocação de tempo e métricas de performance</p>
      </div>

      <div className="tabs">
        {[
          { key: 'checkin', label: 'Check-in Diário' },
          { key: 'insights', label: 'Insights & Métricas' },
        ].map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'checkin' && (
        <div className="grid grid-2">
          {/* Daily Check-in */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Check-in de Hoje</span>
              <Brain size={16} style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
              <div>
                <label className="form-label" style={{ marginBottom: 'var(--sp-2)' }}>Qualidade do Dia</label>
                <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                  {[{ v: 'ruim', l: '😫 Ruim' }, { v: 'médio', l: '😐 Médio' }, { v: 'bom', l: '🙂 Bom' }, { v: 'excelente', l: '🔥 Excelente' }].map(q => (
                    <QualityBtn key={q.v} value={q.v} label={q.l} current={checkIn.dayQuality} onChange={v => setCheckIn({ ...checkIn, dayQuality: v })} />
                  ))}
                </div>
              </div>
              <div>
                <label className="form-label" style={{ marginBottom: 'var(--sp-2)' }}>Energia</label>
                <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                  {[{ v: 'baixa', l: '🔋 Baixa' }, { v: 'média', l: '⚡ Média' }, { v: 'alta', l: '🚀 Alta' }].map(q => (
                    <QualityBtn key={q.v} value={q.v} label={q.l} current={checkIn.energy} onChange={v => setCheckIn({ ...checkIn, energy: v })} />
                  ))}
                </div>
              </div>
              <div>
                <label className="form-label" style={{ marginBottom: 'var(--sp-2)' }}>Foco</label>
                <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                  {[{ v: 'baixo', l: '😴 Baixo' }, { v: 'médio', l: '🎯 Médio' }, { v: 'alto', l: '🧠 Alto' }].map(q => (
                    <QualityBtn key={q.v} value={q.v} label={q.l} current={checkIn.focus} onChange={v => setCheckIn({ ...checkIn, focus: v })} />
                  ))}
                </div>
              </div>
              <button className="btn btn-primary w-full" onClick={saveCheckIn}>
                <Save size={16} /> {existingCheckIn ? 'Atualizar Check-in' : 'Salvar Check-in'}
              </button>
            </div>
          </div>

          {/* Time Allocation */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Alocação de Tempo</span>
              <Clock size={16} style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {timeCategories.map(cat => (
                <div key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>{cat.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)' }}>
                    <input
                      className="form-input"
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      placeholder="0"
                      value={hours[cat.key]}
                      onChange={e => setHours({ ...hours, [cat.key]: e.target.value })}
                      style={{ width: 70, textAlign: 'center', padding: 'var(--sp-1) var(--sp-2)' }}
                    />
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>h</span>
                  </div>
                </div>
              ))}
              <button className="btn btn-primary w-full" onClick={saveTimeAllocation} style={{ marginTop: 'var(--sp-2)' }}>
                <Save size={16} /> Salvar Horas
              </button>
            </div>
          </div>

          {/* Score Card */}
          <div className="card" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-10)', padding: 'var(--sp-8)' }}>
            <ProgressRing value={metrics.dailyScore} size={100} color="var(--accent)" />
            <div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-1)' }}>Score de Produtividade</div>
              <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 700 }}>{metrics.dailyScore}<span style={{ fontSize: 'var(--fs-md)', color: 'var(--text-tertiary)' }}>/100</span></div>
              <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-2)' }}>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Tarefas: {metrics.tasksCompleted}/{metrics.taskTotal}</span>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Taxa: {metrics.completionRate}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'insights' && (
        <div>
          {/* Status Cards */}
          <div className="grid grid-4" style={{ marginBottom: 'var(--sp-6)' }}>
            <div className="stat-card">
              <span className="stat-label">Média Semanal</span>
              <span className="stat-value" style={{ color: 'var(--accent)' }}>{metrics.avgScore}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Melhor Dia</span>
              <span className="stat-value" style={{ color: 'var(--success)' }}>{metrics.bestDay}</span>
              <span className="stat-sub">{metrics.bestScore} pts</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Pior Dia</span>
              <span className="stat-value" style={{ color: 'var(--danger)' }}>{metrics.worstDay}</span>
              <span className="stat-sub">{metrics.worstScore} pts</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Tendência</span>
              <span className="stat-value" style={{ color: metrics.trend >= 0 ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: 'var(--sp-1)' }}>
                <TrendingUp size={20} style={{ transform: metrics.trend < 0 ? 'rotate(180deg)' : 'none' }} />
                {metrics.trend >= 0 ? '+' : ''}{metrics.trend}
              </span>
              <span className="stat-sub">vs semana anterior ({metrics.lastWeekAvg})</span>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-2" style={{ marginBottom: 'var(--sp-6)' }}>
            <div className="card">
              <div className="card-header"><span className="card-title">Evolução Semanal</span></div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={metrics.weekScores}>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }} />
                  <YAxis domain={[0, 100]} hide />
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={v => `${v} pts`} />
                  <Line type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <div className="card-header"><span className="card-title">Distribuição de Tempo (Semana)</span></div>
              {metrics.timeDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={metrics.timeDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                      {metrics.timeDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={v => `${v}h`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-tertiary)' }}>Registre suas horas para ver a distribuição</p>}
            </div>
          </div>

          {/* Performance Level */}
          <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-8)' }}>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-2)' }}>NÍVEL DE PERFORMANCE SEMANAL</div>
            <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 700, color: 'var(--accent)', marginBottom: 'var(--sp-2)' }}>
              {metrics.avgScore >= 80 ? '🔥 Excelente' : metrics.avgScore >= 60 ? '⚡ Bom' : metrics.avgScore >= 40 ? '🎯 Regular' : '📈 Em Desenvolvimento'}
            </div>
            <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)' }}>
              Produtividade semanal: {metrics.avgScore}% · Tendência: {metrics.trend >= 0 ? '↑' : '↓'} {Math.abs(metrics.trend)} pontos
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
