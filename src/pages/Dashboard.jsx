import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { saveSetting } from '../lib/settingsSync';
import Modal from '../components/Modal';
import {
  DollarSign, TrendingUp, Target, Flame, Clock, ArrowRight, Zap,
  Eye, EyeOff, Settings2, ChevronUp, ChevronDown,
  AlertTriangle, FolderKanban, Check, Gift, Trophy
} from 'lucide-react';
import { formatCurrency, getToday, formatDateShort, isTaskCompleted, isTaskActiveOnDate, getTaskPeriodKey } from '../utils/helpers';

const DEFAULT_LAYOUT = [
  { id: 'focus', label: 'Central de Comando', visible: true, order: 0, fullWidth: true },
  { id: 'projects_overview', label: 'Projetos em Andamento', visible: true, order: 1, fullWidth: false },
  { id: 'finance_snapshot', label: 'Painel Financeiro', visible: true, order: 2, fullWidth: false },
  { id: 'monthly_goal', label: 'Meta Financeira', visible: true, order: 3, fullWidth: false },
  { id: 'rewards_widget', label: 'Próxima Recompensa', visible: true, order: 4, fullWidth: false },
];

export default function Dashboard() {
  const [showFinance, setShowFinance] = useState(true);
  
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

  const { tasks, finance, projects, fixedCosts, rewards, updateItem } = useApp();
  const navigate = useNavigate();
  const today = getToday();

  const handleToggleComplete = (task) => {
    if (task.recurrence === 'diária' || task.recurrence === 'semanal' || task.recurrence === 'mensal') {
      const periodKey = getTaskPeriodKey(task, new Date(today + 'T12:00:00'));
      const history = task.completedDates || [];
      if (history.includes(periodKey)) {
        updateItem('tasks', task.id, { completedDates: history.filter(k => k !== periodKey) });
      } else {
        updateItem('tasks', task.id, { completedDates: [...history, periodKey] });
      }
    } else {
      if (task.status === 'concluída') {
        updateItem('tasks', task.id, { status: 'pendente', completedAt: null });
      } else {
        updateItem('tasks', task.id, { status: 'concluída', completedAt: new Date().toISOString() });
      }
    }
  };

  // Validate layout to ensure no missing default widgets after updates
  useEffect(() => {
    let isModified = false;
    let newLayout = [...layout];

    // Remove any widgets that are not in DEFAULT_LAYOUT
    const validIds = DEFAULT_LAYOUT.map(d => d.id);
    const filteredLayout = newLayout.filter(item => validIds.includes(item.id));
    if (filteredLayout.length !== newLayout.length) {
      newLayout = filteredLayout;
      isModified = true;
    }

    // Add any widgets from DEFAULT_LAYOUT that are missing in newLayout
    DEFAULT_LAYOUT.forEach(defWidget => {
      const existingIdx = newLayout.findIndex(item => item.id === defWidget.id);
      if (existingIdx === -1) {
        const maxOrder = newLayout.length > 0 ? Math.max(...newLayout.map(w => w.order || 0)) : -1;
        newLayout.push({
          ...defWidget,
          order: maxOrder + 1
        });
        isModified = true;
      } else {
        // Ensure properties like label, fullWidth are up to date
        const existing = newLayout[existingIdx];
        if (existing.label !== defWidget.label || existing.fullWidth !== defWidget.fullWidth) {
          newLayout[existingIdx] = {
            ...existing,
            label: defWidget.label,
            fullWidth: defWidget.fullWidth
          };
          isModified = true;
        }
      }
    });

    if (isModified) {
      // Re-assign order sequentially
      newLayout.sort((a, b) => a.order - b.order).forEach((item, index) => {
        item.order = index;
      });
      setLayout(newLayout);
      saveSetting('cp_dashboard_layout', newLayout);
    }
  }, [layout]);

  const saveLayout = (newLayout) => {
    setLayout(newLayout);
    saveSetting('cp_dashboard_layout', newLayout);
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
    const todayDate = new Date();
    todayDate.setHours(0,0,0,0);

    // Today's tasks
    const todayTasks = tasks.filter(t => isTaskActiveOnDate(t, today));
    const todayCompleted = todayTasks.filter(t => isTaskCompleted(t, new Date(today + 'T12:00:00'))).length;

    const getSafeInitialBalance = () => {
      const raw = localStorage.getItem('cp_initial_balance');
      if (!raw) return 0;
      const parsed = parseFloat(String(raw).replace(',', '.'));
      return isNaN(parsed) ? 0 : parsed;
    };
    const initialBalance = getSafeInitialBalance();

    // Current calendar month profit for dashboard financial panel
    const curY = todayDate.getFullYear();
    const curM = String(todayDate.getMonth() + 1).padStart(2, '0');
    const curMonthPrefix = `${curY}-${curM}`;
    const curMonthFinance = finance.filter(f => f && typeof f.date === 'string' && f.date.substring(0, 7) === curMonthPrefix);
    const curMonthIncome = curMonthFinance.filter(f => f.type === 'entrada').reduce((s, f) => s + f.amount, 0);
    const curMonthExpenses = curMonthFinance.filter(f => f.type === 'saída').reduce((s, f) => s + f.amount, 0);
    const monthProfit = curMonthIncome - curMonthExpenses;

    // Financial Goal Calc
    let goalIncome = 0;
    let goalRemainingDays = 0;
    
    let gStart, gEnd;
    
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
      const goalFinance = finance.filter(f => f && typeof f.date === 'string' && f.date >= startStr && f.date <= endStr);
      goalIncome = goalFinance.filter(f => f.type === 'entrada').reduce((s, f) => s + (Number(f.amount) || 0), 0);
      const diffRemaining = Math.ceil((gEnd - todayDate) / (1000 * 60 * 60 * 24));
      goalRemainingDays = Math.max(0, diffRemaining);
    }

    const goalProgress = financialGoal?.value > 0 ? Math.min(100, Math.round((goalIncome / financialGoal.value) * 100)) : 0;
    const goalRemainingValue = Math.max(0, (financialGoal?.value || 0) - goalIncome);

    // Global constraints for balance
    const globalIncome = finance.filter(f => f && f.type === 'entrada').reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const globalExpenses = finance.filter(f => f && f.type === 'saída').reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const currentBankBalance = initialBalance + globalIncome - globalExpenses;

    // Focus Candidates: Top 3 strategic tasks
    const priorityWeight = { alta: 0, média: 1, baixa: 2 };
    const focusCandidates = tasks
      .filter(t =>
        t.status !== 'excluída' &&
        !isTaskCompleted(t) &&
        t.recurrence !== 'diária' &&
        t.recurrence !== 'semanal'
      )
      .sort((a, b) => {
        const pa = priorityWeight[a.priority] ?? 1;
        const pb = priorityWeight[b.priority] ?? 1;
        if (pa !== pb) return pa - pb;
        const da = a.dueDate || '9999-12-31';
        const db = b.dueDate || '9999-12-31';
        if (da !== db) return da.localeCompare(db);
        return (a.order || 0) - (b.order || 0);
      });
    const topFocusTasks = focusCandidates.slice(0, 3);

    // Today's pending tasks (routines or scheduled today)
    const todayPendingTasks = tasks.filter(t => 
      t.status !== 'excluída' &&
      isTaskActiveOnDate(t, today) &&
      !isTaskCompleted(t, new Date(today + 'T12:00:00'))
    );

    // Overdue tasks
    const overdueTasks = tasks.filter(t =>
      t.status !== 'excluída' &&
      !isTaskCompleted(t, new Date(today + 'T12:00:00')) &&
      t.recurrence !== 'diária' &&
      t.recurrence !== 'semanal' &&
      ((t.scheduledDate && t.scheduledDate < today) || (t.dueDate && t.dueDate < today))
    );

    // Active projects list
    const activeProjectsList = (projects || []).filter(p => p.status === 'ativo' || p.status === 'pausado');

    // Pending fixed costs calculation
    let pendingFixedCostsTotal = 0;
    let overdueFixedCostsCount = 0;
    const currentMonthStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}`;

    (fixedCosts || []).forEach(cost => {
      let checkDate = cost.createdAt ? new Date(cost.createdAt) : new Date(todayDate.getFullYear(), todayDate.getMonth() - 3, 1);
      const maxIterations = 24;
      let iterations = 0;
      let costDueDate = null;

      while (iterations < maxIterations) {
        const cy = checkDate.getFullYear();
        const cm = String(checkDate.getMonth() + 1).padStart(2, '0');
        let pk = `${cy}-${cm}`;
        if (cost.recurrence === 'semanal') {
          const tempDate = new Date(checkDate);
          const day = tempDate.getDay();
          const diff = tempDate.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(tempDate.setDate(diff));
          const y = monday.getFullYear();
          const w = Math.ceil((((monday - new Date(y, 0, 1)) / 86400000) + 1) / 7);
          pk = `${y}-W${String(w).padStart(2, '0')}`;
        } else if (cost.recurrence === 'anual') {
          pk = String(cy);
        }

        const isPaidOrSkipped = (cost.paidPeriods || []).includes(pk) || 
                                (cost.skippedPeriods || []).includes(pk);
        
        if (!isPaidOrSkipped) {
          const dy = checkDate.getFullYear();
          const dm = checkDate.getMonth();
          if (cost.recurrence === 'mensal') {
            const daysInMonth = new Date(dy, dm + 1, 0).getDate();
            const dayVal = Math.min(parseInt(cost.dueDay) || 1, daysInMonth);
            costDueDate = new Date(dy, dm, dayVal);
          } else if (cost.recurrence === 'semanal') {
            const currentDayOfWeek = checkDate.getDay();
            const targetDayOfWeek = parseInt(cost.dueDay) || 0;
            const diff = targetDayOfWeek - currentDayOfWeek;
            const d = new Date(checkDate);
            d.setDate(checkDate.getDate() + diff);
            costDueDate = d;
          } else if (cost.recurrence === 'anual') {
            const monthVal = (parseInt(cost.dueMonth) || 1) - 1;
            const daysInMonth = new Date(dy, monthVal + 1, 0).getDate();
            const dayVal = Math.min(parseInt(cost.dueDay) || 1, daysInMonth);
            costDueDate = new Date(dy, monthVal, dayVal);
          }
          break;
        }

        if (cost.recurrence === 'semanal') checkDate.setDate(checkDate.getDate() + 7);
        else if (cost.recurrence === 'anual') checkDate.setFullYear(checkDate.getFullYear() + 1);
        else checkDate.setMonth(checkDate.getMonth() + 1);
        
        iterations++;
      }

      if (costDueDate) {
        costDueDate.setHours(0,0,0,0);
        const dueMonthStr = `${costDueDate.getFullYear()}-${String(costDueDate.getMonth() + 1).padStart(2, '0')}`;
        const startOfCurrentMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);

        if (costDueDate < startOfCurrentMonth || dueMonthStr === currentMonthStr) {
          pendingFixedCostsTotal += cost.amount;
        }

        if (costDueDate < todayDate) {
          overdueFixedCostsCount++;
        }
      }
    });

    const pendingTasks = tasks.filter(t => t.status === 'pendente' || t.status === 'em_andamento').length;

    // Nearest deadline project
    const upcomingProjects = (projects || [])
      .filter(p => (p.status === 'ativo' || p.status === 'pausado') && p.targetDate)
      .sort((a, b) => a.targetDate.localeCompare(b.targetDate));
    const nearestDeadlineProject = upcomingProjects[0] || null;

    return {
      todayCompleted,
      todayTotal: todayTasks.length,
      topFocusTasks,
      todayPendingTasks,
      overdueTasks,
      activeProjectsList,
      currentBankBalance,
      pendingFixedCostsTotal,
      overdueFixedCostsCount,
      goalIncome,
      goalRemainingDays,
      goalProgress,
      goalRemainingValue,
      pendingTasks,
      nearestDeadlineProject,
      monthProfit
    };
  }, [tasks, finance, financialGoal, projects, fixedCosts])

  // Widget Renderers
  const WIDGETS = {
    focus: (
      <div className="card h-100" style={{ minHeight: '380px', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <Zap size={22} style={{ color: 'var(--accent)' }} />
            <span className="card-title" style={{ marginBottom: 0, fontSize: 'var(--fs-lg)' }}>Central de Comando</span>
          </div>
          <span className="badge badge-accent" style={{ fontSize: '12px', padding: '4px 8px' }}>
            {metrics.todayCompleted}/{metrics.todayTotal} Concluídas
          </span>
        </div>

        {/* 1. FOCO ESTRATÉGICO */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Foco Principal Estratégico
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {metrics.topFocusTasks.length > 0 ? (
              metrics.topFocusTasks.map((t) => {
                const isCompleted = isTaskCompleted(t, new Date(today + 'T12:00:00'));
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-2) var(--sp-3)', background: 'var(--accent-subtle)', border: '1px solid var(--accent-glow)', borderRadius: 'var(--radius-md)', transition: 'all var(--transition-fast)' }}>
                    <button
                      className={`checkbox ${isCompleted ? 'checked' : ''}`}
                      onClick={() => handleToggleComplete(t)}
                      style={{ flexShrink: 0, width: 22, height: 22 }}
                    >
                      {isCompleted && <Check size={14} color="white" />}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        fontWeight: 600,
                        fontSize: 'var(--fs-md)',
                        textDecoration: isCompleted ? 'line-through' : 'none',
                        color: isCompleted ? 'var(--text-tertiary)' : 'var(--text-primary)',
                        display: 'block',
                        wordBreak: 'break-word',
                        whiteSpace: 'normal'
                      }}>
                        {t.title}
                      </span>
                    </div>
                    <span className={`badge badge-${t.priority}`} style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                      {t.priority}
                    </span>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: 'var(--sp-3)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>
                Nenhum foco estratégico pendente.
              </div>
            )}
          </div>
        </div>

        {/* 2. ATRASADAS */}
        {metrics.overdueTasks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontSize: '11px', fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <AlertTriangle size={12} /> Tarefas Atrasadas ({metrics.overdueTasks.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {metrics.overdueTasks.map((t) => {
                const isCompleted = isTaskCompleted(t, new Date(today + 'T12:00:00'));
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-2) var(--sp-3)', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: 'var(--radius-md)' }}>
                    <button
                      className={`checkbox ${isCompleted ? 'checked' : ''}`}
                      onClick={() => handleToggleComplete(t)}
                      style={{ flexShrink: 0, width: 22, height: 22 }}
                    >
                      {isCompleted && <Check size={14} color="white" />}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        fontWeight: 500,
                        fontSize: 'var(--fs-sm)',
                        textDecoration: isCompleted ? 'line-through' : 'none',
                        color: isCompleted ? 'var(--text-tertiary)' : 'var(--text-primary)',
                        display: 'block',
                        wordBreak: 'break-word',
                        whiteSpace: 'normal'
                      }}>
                        {t.title}
                      </span>
                    </div>
                    {t.dueDate && (
                      <span style={{ fontSize: '10px', color: 'var(--danger)', fontWeight: 500 }}>
                        {formatDateShort(t.dueDate)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. TAREFAS DE HOJE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', flex: 1 }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Checklist de Hoje
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
            {tasks.filter(t => t.status !== 'excluída' && isTaskActiveOnDate(t, today)).length > 0 ? (
              [...tasks.filter(t => t.status !== 'excluída' && isTaskActiveOnDate(t, today))]
                .sort((a, b) => {
                  const compA = isTaskCompleted(a, new Date(today + 'T12:00:00'));
                  const compB = isTaskCompleted(b, new Date(today + 'T12:00:00'));
                  if (compA !== compB) return compA ? 1 : -1;
                  const priorityVal = { alta: 3, média: 2, baixa: 1 };
                  return (priorityVal[b.priority] || 0) - (priorityVal[a.priority] || 0);
                })
                .map((t) => {
                  const isCompleted = isTaskCompleted(t, new Date(today + 'T12:00:00'));
                  return (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-2) var(--sp-3)', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', opacity: isCompleted ? 0.6 : 1, transition: 'all var(--transition-fast)' }}>
                      <button
                        className={`checkbox ${isCompleted ? 'checked' : ''}`}
                        onClick={() => handleToggleComplete(t)}
                        style={{ flexShrink: 0, width: 22, height: 22 }}
                      >
                        {isCompleted && <Check size={14} color="white" />}
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{
                          fontWeight: 500,
                          fontSize: 'var(--fs-sm)',
                          textDecoration: isCompleted ? 'line-through' : 'none',
                          color: isCompleted ? 'var(--text-tertiary)' : 'var(--text-primary)',
                          display: 'block',
                          wordBreak: 'break-word',
                          whiteSpace: 'normal'
                        }}>
                          {t.title}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                        {t.recurrence && t.recurrence !== 'nenhuma' && (
                          <span style={{ fontSize: '10px', color: 'var(--accent)', background: 'var(--accent-subtle)', padding: '1px 6px', borderRadius: '4px', fontWeight: 500 }}>
                            {t.recurrence}
                          </span>
                        )}
                        <span className={`badge badge-${t.priority}`} style={{ fontSize: '10px' }}>
                          {t.priority}
                        </span>
                      </div>
                    </div>
                  );
                })
            ) : (
              <div style={{ padding: 'var(--sp-4)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', fontStyle: 'italic' }}>
                Nenhuma tarefa ativa para hoje. Todas as rotinas em dia! 🎉
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    projects_overview: (
      <div className="card h-100" onClick={() => navigate('/projetos')} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <FolderKanban size={20} style={{ color: 'var(--accent)' }} />
            <span className="card-title" style={{ marginBottom: 0, fontSize: 'var(--fs-lg)' }}>Projetos em Andamento</span>
          </div>
          <span className="badge badge-accent" style={{ fontSize: '11px', padding: '2px 8px' }}>
            {metrics.activeProjectsList.length} Ativos
          </span>
        </div>

        {/* Projects Stats Bar */}
        <div className="projects-stats-bar" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)', background: 'var(--bg-tertiary)', padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>Status Geral</div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
              {metrics.activeProjectsList.filter(p => p.status === 'ativo').length} Executando
              {metrics.activeProjectsList.filter(p => p.status === 'pausado').length > 0 && 
                ` • ${metrics.activeProjectsList.filter(p => p.status === 'pausado').length} Pausados`
              }
            </div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>Próximo Prazo</div>
            <div className="next-deadline-text" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: metrics.nearestDeadlineProject ? 'var(--accent)' : 'var(--text-tertiary)', marginTop: '2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {metrics.nearestDeadlineProject 
                ? `${metrics.nearestDeadlineProject.title} (${formatDateShort(metrics.nearestDeadlineProject.targetDate)})`
                : 'Nenhum'
              }
            </div>
          </div>
        </div>

        {/* Project List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', flex: 1, maxHeight: '280px', overflowY: 'auto' }}>
          {metrics.activeProjectsList.length > 0 ? (
            metrics.activeProjectsList.map((project) => {
              const completedSub = project.subtasks ? project.subtasks.filter(s => s.completed).length : 0;
              const totalSub = project.subtasks ? project.subtasks.length : 0;
              const progress = totalSub > 0 ? Math.round((completedSub / totalSub) * 100) : 0;
              const isPaused = project.status === 'pausado';

              return (
                <div key={project.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', padding: 'var(--sp-3)', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', opacity: isPaused ? 0.7 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--sp-2)' }}>
                    <div style={{ minWidth: 0 }}>
                      <span className="project-widget-title" style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {project.title}
                      </span>
                      {project.category && (
                        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: '4px', marginTop: '2px', display: 'inline-block' }}>
                          {project.category}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', flexShrink: 0 }}>
                      {isPaused && (
                        <span className="badge badge-warning" style={{ fontSize: '9px', textTransform: 'uppercase', padding: '1px 6px' }}>
                          Pausado
                        </span>
                      )}
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>
                        {progress}%
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <span>Subtarefas</span>
                      <span>{completedSub}/{totalSub}</span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-full)', height: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--teal))', borderRadius: 'var(--radius-full)', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>

                  {project.targetDate && (
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                      Prazo: {formatDateShort(project.targetDate)}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ padding: 'var(--sp-4)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', fontStyle: 'italic', margin: 'auto 0' }}>
              Nenhum projeto em andamento. Crie um projeto para começar! 🚀
            </div>
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
              saveSetting('cp_financialGoal_v2', newVal);
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
                  saveSetting('cp_financialGoal_v2', newVal);
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
                    saveSetting('cp_financialGoal_v2', newVal);
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
                    saveSetting('cp_financialGoal_v2', newVal);
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
    finance_snapshot: (
      <div className="card h-100" onClick={() => navigate('/financas')} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <DollarSign size={20} style={{ color: 'var(--accent)' }} />
            <span className="card-title" style={{ marginBottom: 0, fontSize: 'var(--fs-lg)' }}>Painel Financeiro</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setShowFinance(!showFinance); }} title={showFinance ? 'Ocultar valores' : 'Mostrar valores'}>
            {showFinance ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {metrics.overdueFixedCostsCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)' }}>
            <AlertTriangle size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-primary)', fontWeight: 600 }}>Alerta Financeiro</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
                Você tem {metrics.overdueFixedCostsCount} {metrics.overdueFixedCostsCount === 1 ? 'conta' : 'contas'} fixas em atraso.
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', flex: 1, justifyContent: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--sp-3)', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <TrendingUp size={16} style={{ color: 'var(--income)' }} />
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>Saldo em Conta</span>
            </div>
            <span style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {showFinance ? formatCurrency(metrics.currentBankBalance) : '*****'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--sp-3)', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <Flame size={16} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>Fluxo (Este mês)</span>
            </div>
            <span style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: metrics.monthProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {showFinance ? formatCurrency(metrics.monthProfit) : '*****'}
            </span>
          </div>

          <div 
            onClick={(e) => {
              e.stopPropagation();
              navigate('/financas', { state: { scrollToFixedCosts: true } });
            }}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--sp-3)', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', transition: 'all var(--transition-fast)' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <Clock size={16} style={{ color: 'var(--warning)' }} />
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>Contas do Mês Pendentes</span>
            </div>
            <span style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--warning)' }}>
              {showFinance ? formatCurrency(metrics.pendingFixedCostsTotal) : '*****'}
            </span>
          </div>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'right', marginTop: 'auto' }}>
          * Clique para abrir o módulo financeiro
        </div>
      </div>
    ),
    rewards_widget: (() => {
      const getProgressInfo = (reward) => {
        const conditions = reward.conditions || [];
        const hasFinancialGoal = reward.financialTargetAmount !== undefined && 
                                 reward.financialTargetAmount !== null && 
                                 reward.financialTargetAmount !== '' &&
                                 parseFloat(reward.financialTargetAmount) > 0;

        let total = conditions.length;
        let completed = conditions.filter(c => c.completed).length;

        if (hasFinancialGoal) {
          total += 1;
          const target = parseFloat(reward.financialTargetAmount) || 0;
          const current = parseFloat(reward.financialCurrentAmount) || 0;
          if (current >= target) {
            completed += 1;
          }
        }

        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { total, completed, pct };
      };

      const dashboardRewards = Array.isArray(rewards) ? rewards.filter(r => 
        r.showOnDashboard === true && 
        r.status !== 'resgatada' && 
        r.status !== 'arquivada'
      ) : [];

      const mappedRewards = dashboardRewards.map(r => {
        const info = getProgressInfo(r);
        return {
          reward: r,
          progress: info.pct,
          total: info.total,
          completed: info.completed
        };
      });

      const inProgress = mappedRewards.filter(item => 
        item.reward.status === 'em_andamento' && item.progress < 100
      );
      const ready = mappedRewards.filter(item => 
        item.reward.status === 'desbloqueada' || item.progress === 100
      );

      const priorityWeight = { alta: 3, 'média': 2, baixa: 1 };
      inProgress.sort((a, b) => {
        // 1. priority: alta > média > baixa
        const pA = priorityWeight[a.reward.priority] || 2;
        const pB = priorityWeight[b.reward.priority] || 2;
        if (pA !== pB) return pB - pA;

        // 2. highest progress
        if (a.progress !== b.progress) return b.progress - a.progress;

        // 3. closest deadline if available
        const dA = a.reward.deadline;
        const dB = b.reward.deadline;
        if (dA && dB) {
          if (dA !== dB) return dA.localeCompare(dB);
        } else if (dA) {
          return -1;
        } else if (dB) {
          return 1;
        }

        // 4. newest/createdAt as fallback
        const cA = a.reward.createdAt || '';
        const cB = b.reward.createdAt || '';
        return cB.localeCompare(cA);
      });

      // Sort ready rewards by priority, deadline, and creation date
      ready.sort((a, b) => {
        const pA = priorityWeight[a.reward.priority] || 2;
        const pB = priorityWeight[b.reward.priority] || 2;
        if (pA !== pB) return pB - pA;
        const dA = a.reward.deadline;
        const dB = b.reward.deadline;
        if (dA && dB) {
          if (dA !== dB) return dA.localeCompare(dB);
        } else if (dA) {
          return -1;
        } else if (dB) {
          return 1;
        }
        const cA = a.reward.createdAt || '';
        const cB = b.reward.createdAt || '';
        return cB.localeCompare(cA);
      });

      const sortedItems = [...ready, ...inProgress].slice(0, 3);

      return (
        <div className="card h-100" onClick={() => navigate('/recompensas')} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
              <Gift size={20} style={{ color: 'var(--accent)' }} />
              <span className="card-title" style={{ marginBottom: 0, fontSize: 'var(--fs-lg)' }}>Próximas Recompensas</span>
            </div>
            {dashboardRewards.length > 0 && (
              <span className="badge badge-accent" style={{ fontSize: '11px', padding: '2px 8px' }}>
                {dashboardRewards.length} Selecionadas
              </span>
            )}
          </div>
 
          {sortedItems.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', flex: 1, justifyContent: 'center' }}>
              {sortedItems.map(item => {
                const r = item.reward;
                const progress = item.progress;
                const isReady = r.status === 'desbloqueada' || progress === 100;
                
                return (
                  <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--sp-2)' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.title}>
                          {r.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Categoria: {r.category}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: isReady ? 'var(--success-subtle)' : 'var(--accent-subtle)',
                        color: isReady ? 'var(--success)' : 'var(--accent)',
                        flexShrink: 0
                      }}>
                        {isReady ? 'Resgatar' : 'Em progresso'}
                      </span>
                    </div>

                    <div style={{ background: 'var(--bg-tertiary)', padding: 'var(--sp-2) var(--sp-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-soft)', marginTop: '2px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{progress}% concluído</span>
                        <span style={{ fontWeight: 500, color: 'var(--text-tertiary)' }}>
                          {(() => {
                            const info = getProgressInfo(r);
                            const missing = info.total - info.completed;
                            return missing === 1 ? 'Falta 1 condição' : `Faltam ${missing} condições`;
                          })()}
                        </span>
                      </div>
                      <div style={{ height: '4px', background: 'var(--bg-primary)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: isReady ? 'var(--success)' : 'var(--accent)' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 'var(--sp-3)', padding: 'var(--sp-4)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)', textAlign: 'center' }}>
              <Trophy size={32} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
                Nenhuma recompensa marcada para a Dashboard.
              </div>
            </div>
          )}
 
          <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: 'var(--text-tertiary)', marginTop: 'auto' }}>
            <span>* Clique para ver todas as recompensas</span>
            <ArrowRight size={12} style={{ marginLeft: 'auto' }} />
          </div>
        </div>
      );
    })()
  };

  const activeWidgets = layout.filter(w => w.visible).sort((a, b) => a.order - b.order);

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Dashboard</h1>
          <p>Sua central de comando — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        {/* GoalTracker is hidden from layout but code/data is kept */}
        {/* <GoalTracker monthlyGoal={financialGoal?.value || 0} /> */}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--sp-6)' }}>
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
              className={`dashboard-widget ${widget.fullWidth ? 'full-width' : ''} widget-${widget.id}`}
              style={{ order: widget.order }}
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
