import { useState, useRef, useEffect } from 'react';
import { Trophy, Target, CheckSquare, TrendingUp } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { isTaskCompleted } from '../utils/helpers';

export default function GoalTracker({ monthlyGoal }) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);
  const { tasks, finance } = useApp();

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Calculate Metrics
  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // Finance Progress this month
  const monthFinance = finance.filter(f => f.date.substring(0, 7) === currentMonthPrefix);
  const income = monthFinance.filter(f => f.type === 'entrada').reduce((s, f) => s + f.amount, 0);
  const mGoal = monthlyGoal || 0;
  const financePercent = mGoal > 0 ? Math.min(100, Math.round((income / mGoal) * 100)) : 0;

  // Task Progress this month
  const monthTasks = tasks.filter(t => (t.scheduledDate || t.dueDate || '').substring(0, 7) === currentMonthPrefix);
  const monthCompletedTasks = monthTasks.filter(t => isTaskCompleted(t)).length;
  const monthTotalTasks = monthTasks.length || 1;
  const taskPercent = Math.round((monthCompletedTasks / monthTotalTasks) * 100);

  // Main financial goal (R$ 500.000)
  const totalIncome = finance.filter(f => f.type === 'entrada').reduce((s, f) => s + f.amount, 0);
  const mainGoal = 500000;
  const mainPercent = Math.min(100, (totalIncome / mainGoal) * 100).toFixed(1);

  return (
    <div style={{ position: 'relative' }} ref={popoverRef}>
      {/* Trigger */}
      <button 
        onClick={() => setOpen(!open)}
        className="card" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 'var(--sp-3)', 
          padding: 'var(--sp-2) var(--sp-3)', 
          borderRadius: 'var(--radius-full)', 
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)'
        }}
      >
        <div style={{ background: 'var(--warning-subtle)', padding: 6, borderRadius: '50%' }}>
          <Trophy size={14} style={{ color: 'var(--warning)' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', width: '100%' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Meta Principal
            </span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--warning)', marginLeft: 'auto' }}>
              {mainPercent}%
            </span>
          </div>
          <div style={{ width: 120, height: 4, background: 'var(--bg-tertiary)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${mainPercent}%`, background: 'var(--warning)', borderRadius: 2 }} />
          </div>
        </div>
      </button>

      {/* Popover */}
      {open && (
        <div 
          className="card shadow-lg" 
          style={{ 
            position: 'absolute', 
            top: 'calc(100% + var(--sp-2))', 
            right: 0, 
            width: 280,
            padding: 'var(--sp-4)',
            zIndex: 100,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)'
          }}
        >
          <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--sp-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Indicadores do Mês
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            
            {/* Meta Financeira do Mês */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-2)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontSize: 'var(--fs-sm)', fontWeight: 500 }}>
                  <Target size={14} style={{ color: 'var(--accent)' }} /> Meta Financeira
                </span>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{financePercent}%</span>
              </div>
              <div style={{ width: '100%', height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${financePercent}%`, background: 'var(--accent)', borderRadius: 3 }} />
              </div>
            </div>

            {/* Produtividade de Tarefas */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-2)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontSize: 'var(--fs-sm)', fontWeight: 500 }}>
                  <CheckSquare size={14} style={{ color: 'var(--teal)' }} /> Produtividade
                </span>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{taskPercent}%</span>
              </div>
              <div style={{ width: '100%', height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${taskPercent}%`, background: 'var(--teal)', borderRadius: 3 }} />
              </div>
              <span style={{ display: 'block', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-1)' }}>
                {monthCompletedTasks} de {monthTasks.length} tarefas
              </span>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
