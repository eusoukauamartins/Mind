import { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { 
  Gift, Trophy, Plus, Trash2, Edit2, Archive, CheckCircle2, 
  Circle, AlertTriangle, Calendar, Award, DollarSign, Clock, HelpCircle, ArrowRight,
  Pin
} from 'lucide-react';
import { formatCurrency, getToday } from '../utils/helpers';

const CATEGORIES = [
  'Trabalho',
  'Financeiro',
  'Saúde',
  'Casa',
  'Estudos',
  'Lazer',
  'Pessoal',
  'Outro'
];

const PRIORITIES = [
  { value: 'baixa', label: 'Baixa', class: 'baixa' },
  { value: 'média', label: 'Média', class: 'média' },
  { value: 'alta', label: 'Alta', class: 'alta' }
];

const defaultReward = {
  title: '',
  description: '',
  category: 'Outro',
  estimatedValue: '',
  deadline: '',
  redeemAvailableDate: '',
  priority: 'média',
  conditions: [],
  notes: '',
  status: 'em_andamento',
  redeemedAt: '',
  archivedAt: '',
  financialTargetAmount: '',
  financialCurrentAmount: '',
  showOnDashboard: false
};

const SectionEmptyState = ({ message }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--sp-6)',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-md)',
    border: '1px dashed var(--border-soft)',
    color: 'var(--text-tertiary)',
    fontSize: 'var(--fs-sm)',
    textAlign: 'center',
    width: '100%'
  }}>
    {message}
  </div>
);

const getProgressInfo = (rewardOrForm) => {
  const conditions = rewardOrForm.conditions || [];
  const hasFinancialGoal = rewardOrForm.financialTargetAmount !== undefined && 
                           rewardOrForm.financialTargetAmount !== null && 
                           rewardOrForm.financialTargetAmount !== '' &&
                           parseFloat(rewardOrForm.financialTargetAmount) > 0;

  let totalConditions = conditions.length;
  let completedConditions = conditions.filter(c => c.completed).length;

  let isFinancialCompleted = false;
  if (hasFinancialGoal) {
    totalConditions += 1;
    const target = parseFloat(rewardOrForm.financialTargetAmount) || 0;
    const current = parseFloat(rewardOrForm.financialCurrentAmount) || 0;
    if (current >= target) {
      completedConditions += 1;
      isFinancialCompleted = true;
    }
  }

  const progress = totalConditions > 0 ? Math.round((completedConditions / totalConditions) * 100) : 0;

  return {
    progress,
    totalConditions,
    completedConditions,
    hasFinancialGoal,
    isFinancialCompleted
  };
};

export default function Recompensas() {
  const { rewards, createItem, updateItem } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultReward);
  const [newConditionText, setNewConditionText] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('Todas');

  const today = getToday();

  // Helper date parsing and difference calculation
  const getDaysDiff = (dateStr) => {
    if (!dateStr) return null;
    const tDate = new Date(today + 'T00:00:00');
    const targetDate = new Date(dateStr + 'T00:00:00');
    const diffTime = targetDate - tDate;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Helper: calculate deadline and redeem availability info
  const getRewardTimingInfo = (reward) => {
    const progressInfo = getProgressInfo(reward);
    const progress = progressInfo.progress;
    const is100Percent = progress === 100;
    const deadlineDiff = getDaysDiff(reward.deadline);
    const redeemDiff = getDaysDiff(reward.redeemAvailableDate);

    let deadlineMsg = '';
    let deadlineClass = '';
    let isExpired = false;

    if (reward.deadline) {
      if (deadlineDiff > 0) {
        deadlineMsg = `Faltam ${deadlineDiff} dias`;
        deadlineClass = 'text-info';
      } else if (deadlineDiff === 0) {
        deadlineMsg = 'Vence hoje';
        deadlineClass = 'text-warning';
      } else {
        deadlineMsg = 'Prazo vencido';
        deadlineClass = 'text-danger';
        isExpired = true;
      }
    }

    let redeemMsg = '';
    let isRedeemLockedByDate = false;

    if (is100Percent) {
      if (reward.redeemAvailableDate) {
        if (redeemDiff > 0) {
          redeemMsg = `Disponível para resgate em ${redeemDiff} dias`;
          isRedeemLockedByDate = true;
        } else {
          redeemMsg = 'Pronta para resgatar';
        }
      } else {
        redeemMsg = 'Pronta para resgatar';
      }
    }

    return {
      progress,
      is100Percent,
      deadlineMsg,
      deadlineClass,
      isExpired,
      redeemMsg,
      isRedeemLockedByDate
    };
  };

  // Filter rewards
  const filteredRewards = useMemo(() => {
    return rewards.filter(r => {
      if (categoryFilter !== 'Todas' && r.category !== categoryFilter) return false;
      return true;
    });
  }, [rewards, categoryFilter]);

  // Separate reward sections
  const sections = useMemo(() => {
    const inProgress = [];
    const readyToRedeem = [];
    const redeemed = [];
    const archived = [];

    filteredRewards.forEach(r => {
      if (r.status === 'arquivada') {
        archived.push(r);
      } else if (r.status === 'resgatada') {
        redeemed.push(r);
      } else if (r.status === 'desbloqueada') {
        readyToRedeem.push(r);
      } else {
        inProgress.push(r);
      }
    });

    return { inProgress, readyToRedeem, redeemed, archived };
  }, [filteredRewards]);

  // Metrics
  const metrics = useMemo(() => {
    const active = rewards.filter(r => r.status === 'em_andamento').length;
    const ready = rewards.filter(r => r.status === 'desbloqueada').length;
    const redeemed = rewards.filter(r => r.status === 'resgatada').length;

    // Next Reward: prioritize ready/desbloqueada, then highest progress under 100%
    const activeRewards = rewards.filter(r => r.status === 'em_andamento' || r.status === 'desbloqueada');
    let nextReward = activeRewards.find(r => r.status === 'desbloqueada') || null;
    let nextProgress = nextReward ? 100 : -1;

    if (!nextReward) {
      activeRewards.forEach(r => {
        const progInfo = getProgressInfo(r);
        const prog = progInfo.progress;
        if (prog < 100 && prog > nextProgress) {
          nextProgress = prog;
          nextReward = r;
        }
      });
    }

    return { active, ready, redeemed, nextReward, nextProgress };
  }, [rewards]);

  const handleSubmit = () => {
    if (!form.title) return;
    
    // Auto calculate status on save/edit
    const progressInfo = getProgressInfo(form);
    const progress = progressInfo.progress;
    let finalStatus = form.status;
    if (finalStatus !== 'resgatada' && finalStatus !== 'arquivada') {
      finalStatus = progress === 100 ? 'desbloqueada' : 'em_andamento';
    }

    const payload = {
      ...form,
      estimatedValue: (form.estimatedValue !== undefined && form.estimatedValue !== null && form.estimatedValue !== '') ? parseFloat(form.estimatedValue) : 0,
      financialTargetAmount: (form.financialTargetAmount !== undefined && form.financialTargetAmount !== null && form.financialTargetAmount !== '') ? parseFloat(form.financialTargetAmount) : null,
      financialCurrentAmount: (form.financialCurrentAmount !== undefined && form.financialCurrentAmount !== null && form.financialCurrentAmount !== '') ? parseFloat(form.financialCurrentAmount) : null,
      status: finalStatus
    };

    if (editing) {
      updateItem('rewards', editing, payload);
    } else {
      createItem('rewards', payload);
    }

    setShowModal(false);
    setEditing(null);
    setForm(defaultReward);
    setNewConditionText('');
  };

  const handleEdit = (reward) => {
    setForm({
      ...reward,
      estimatedValue: (reward.estimatedValue !== undefined && reward.estimatedValue !== null) ? String(reward.estimatedValue) : '',
      financialTargetAmount: (reward.financialTargetAmount !== undefined && reward.financialTargetAmount !== null) ? String(reward.financialTargetAmount) : '',
      financialCurrentAmount: (reward.financialCurrentAmount !== undefined && reward.financialCurrentAmount !== null) ? String(reward.financialCurrentAmount) : ''
    });
    setEditing(reward.id);
    setShowModal(true);
  };

  const handleArchive = (reward) => {
    const isCurrentlyArchived = reward.status === 'arquivada';
    if (isCurrentlyArchived) {
      // Restore
      if (reward.redeemedAt) {
        updateItem('rewards', reward.id, { 
          status: 'resgatada', 
          archivedAt: '' 
        });
      } else {
        const progressInfo = getProgressInfo(reward);
        const restoredStatus = progressInfo.progress === 100 ? 'desbloqueada' : 'em_andamento';
        updateItem('rewards', reward.id, { 
          status: restoredStatus, 
          archivedAt: '' 
        });
      }
    } else {
      // Archive
      updateItem('rewards', reward.id, { 
        status: 'arquivada', 
        archivedAt: new Date().toISOString(),
        showOnDashboard: false
      });
    }
  };

  const handleRedeem = (reward) => {
    updateItem('rewards', reward.id, { 
      status: 'resgatada', 
      redeemedAt: new Date().toISOString(),
      showOnDashboard: false
    });
  };

  const handleCancelRedeem = (reward) => {
    const progressInfo = getProgressInfo(reward);
    const restoredStatus = progressInfo.progress === 100 ? 'desbloqueada' : 'em_andamento';
    updateItem('rewards', reward.id, {
      status: restoredStatus,
      redeemedAt: ''
    });
  };

  const handleTogglePin = (reward) => {
    const isCurrentlyPinned = reward.showOnDashboard === true;
    if (!isCurrentlyPinned) {
      const pinnedCount = rewards.filter(r => r.showOnDashboard && r.status !== 'resgatada' && r.status !== 'arquivada').length;
      if (pinnedCount >= 3) {
        alert("Você já selecionou 3 recompensas para a Dashboard.");
        return;
      }
    }
    updateItem('rewards', reward.id, {
      showOnDashboard: !isCurrentlyPinned
    });
  };

  // Checklist updates inside modal
  const addCondition = () => {
    if (!newConditionText.trim()) return;
    const item = {
      id: crypto.randomUUID(),
      text: newConditionText.trim(),
      completed: false,
      completedAt: null
    };
    setForm(prev => ({
      ...prev,
      conditions: [...prev.conditions, item]
    }));
    setNewConditionText('');
  };

  const removeCondition = (id) => {
    setForm(prev => ({
      ...prev,
      conditions: prev.conditions.filter(c => c.id !== id)
    }));
  };

  const toggleCondition = (id) => {
    setForm(prev => ({
      ...prev,
      conditions: prev.conditions.map(c => {
        if (c.id === id) {
          const completed = !c.completed;
          return {
            ...c,
            completed,
            completedAt: completed ? new Date().toISOString() : null
          };
        }
        return c;
      })
    }));
  };

  // Toggle checklist direct on card
  const handleToggleCardCondition = (reward, conditionId) => {
    const updatedConditions = reward.conditions.map(c => {
      if (c.id === conditionId) {
        const completed = !c.completed;
        return {
          ...c,
          completed,
          completedAt: completed ? new Date().toISOString() : null
        };
      }
      return c;
    });

    const rewardWithUpdatedConditions = { ...reward, conditions: updatedConditions };
    const progressInfo = getProgressInfo(rewardWithUpdatedConditions);
    const progress = progressInfo.progress;
    let finalStatus = reward.status;
    if (finalStatus !== 'resgatada' && finalStatus !== 'arquivada') {
      finalStatus = progress === 100 ? 'desbloqueada' : 'em_andamento';
    }

    updateItem('rewards', reward.id, {
      conditions: updatedConditions,
      status: finalStatus
    });
  };

  const renderRewardCard = (reward) => {
    const timing = getRewardTimingInfo(reward);
    const progressInfo = getProgressInfo(reward);
    const statusLabels = {
      em_andamento: 'Em andamento',
      desbloqueada: 'Desbloqueada',
      resgatada: 'Resgatada',
      arquivada: 'Arquivada'
    };

    const isRedeemable = reward.status === 'desbloqueada' && !timing.isRedeemLockedByDate;

    return (
      <div 
        key={reward.id} 
        className="card" 
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100%', 
          minWidth: 0,
          border: reward.status === 'resgatada' 
            ? '1px solid var(--success)' 
            : reward.status === 'desbloqueada' 
              ? '1px solid var(--accent)' 
              : '1px solid var(--border-soft)',
          boxShadow: reward.status === 'resgatada' 
            ? '0 4px 12px rgba(52, 211, 153, 0.08)' 
            : reward.status === 'desbloqueada' 
              ? '0 4px 16px var(--accent-subtle)' 
              : 'none',
          background: reward.status === 'resgatada' 
            ? 'rgba(52, 211, 153, 0.01)' 
            : 'var(--bg-secondary)'
        }}
      >
        {/* Header info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--sp-3)', marginBottom: 'var(--sp-2)' }}>
          <span style={{ 
            fontSize: '10px', 
            color: 'var(--accent)', 
            background: 'var(--accent-subtle)', 
            padding: '2px 8px', 
            borderRadius: 'var(--radius-sm)', 
            fontWeight: 600,
            textTransform: 'uppercase'
          }}>
            {reward.category}
          </span>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
            {reward.status !== 'resgatada' && reward.status !== 'arquivada' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleTogglePin(reward);
                }}
                title={reward.showOnDashboard ? "Remover da Dashboard" : "Mostrar na Dashboard"}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: reward.showOnDashboard ? 'var(--accent)' : 'var(--text-tertiary)',
                  transition: 'color var(--transition-fast)',
                  marginRight: '2px'
                }}
              >
                <Pin size={14} fill={reward.showOnDashboard ? 'currentColor' : 'none'} style={{ transform: reward.showOnDashboard ? 'none' : 'rotate(-45deg)' }} />
              </button>
            )}
            <span className={`badge badge-${reward.priority}`} style={{ fontSize: '9px', textTransform: 'uppercase' }}>
              {reward.priority}
            </span>
            {reward.status === 'resgatada' ? (
              <span style={{ 
                fontSize: '9px', 
                fontWeight: 700,
                color: '#0F1117',
                background: 'var(--success)',
                padding: '2px 8px',
                borderRadius: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {statusLabels[reward.status]}
              </span>
            ) : (
              <span style={{ 
                fontSize: '10px', 
                fontWeight: 600,
                color: 'var(--text-secondary)',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                padding: '2px 6px',
                borderRadius: '4px'
              }}>
                {statusLabels[reward.status]}
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 600, margin: '0 0 var(--sp-1) 0', color: 'var(--text-primary)' }}>
          {reward.title}
        </h3>

        {/* Congratulation Message */}
        {reward.status === 'resgatada' && (
          <div style={{ 
            background: 'var(--success-subtle)', 
            border: '1px solid rgba(52, 211, 153, 0.2)', 
            color: 'var(--success)', 
            padding: 'var(--sp-2) var(--sp-3)', 
            borderRadius: 'var(--radius-md)', 
            fontSize: '11px', 
            fontWeight: 600, 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            marginBottom: 'var(--sp-3)'
          }}>
            <Trophy size={12} style={{ flexShrink: 0 }} />
            <span>Parabéns, você concluiu e resgatou esta recompensa.</span>
          </div>
        )}

        {/* Main Progress area */}
        <div style={{ background: 'var(--bg-tertiary)', padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--fs-xs)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Progresso</span>
            <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{progressInfo.progress}%</span>
          </div>

          <div className="progress-bar-container" style={{ height: '6px', background: 'var(--bg-primary)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ 
              width: `${progressInfo.progress}%`, 
              height: '100%', 
              background: timing.is100Percent ? 'var(--success)' : 'var(--accent)',
              transition: 'width var(--transition-medium)' 
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-tertiary)' }}>
            <span>{progressInfo.completedConditions}/{progressInfo.totalConditions} condições</span>
            {reward.estimatedValue > 0 && (
              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                Custo: {formatCurrency(reward.estimatedValue)}
              </span>
            )}
          </div>

          {/* Financial goal progress on card */}
          {progressInfo.hasFinancialGoal && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderTop: '1px solid var(--border-soft)', paddingTop: '6px', marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                <span>
                  Meta financeira: {formatCurrency(reward.financialCurrentAmount || 0)} / {formatCurrency(reward.financialTargetAmount)}
                </span>
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>
                  {Math.round(((parseFloat(reward.financialCurrentAmount) || 0) / parseFloat(reward.financialTargetAmount)) * 100)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Dates & Status indicators */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', marginBottom: 'var(--sp-4)' }}>
          {/* Deadline Indicator */}
          {reward.deadline && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={12} style={{ color: 'var(--text-tertiary)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>
                Prazo: <strong style={{ color: 'var(--text-primary)' }}>{new Date(reward.deadline + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>
              </span>
              <span className={timing.deadlineClass} style={{ fontWeight: 600, marginLeft: 'auto' }}>
                {timing.deadlineMsg}
              </span>
            </div>
          )}

          {/* Redeem Date indicator */}
          {reward.redeemAvailableDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={12} style={{ color: 'var(--text-tertiary)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>
                Resgatar após: <strong style={{ color: 'var(--text-primary)' }}>{new Date(reward.redeemAvailableDate + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>
              </span>
            </div>
          )}

          {/* Ready to redeem messages */}
          {timing.redeemMsg && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              color: timing.isRedeemLockedByDate ? 'var(--warning)' : 'var(--success)', 
              fontWeight: 600,
              marginTop: '4px',
              background: timing.isRedeemLockedByDate ? 'var(--warning-subtle)' : 'var(--success-subtle)',
              padding: '4px 8px',
              borderRadius: '4px'
            }}>
              <Trophy size={12} />
              <span>{timing.redeemMsg}</span>
            </div>
          )}
        </div>

        {/* Conditions Checklist Preview */}
        {reward.conditions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', maxHeight: '150px', overflowY: 'auto', paddingRight: '4px', marginBottom: 'var(--sp-6)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Condições de Desbloqueio</div>
            {reward.conditions.map(cond => (
              <button 
                key={cond.id} 
                onClick={() => reward.status !== 'resgatada' && reward.status !== 'arquivada' && handleToggleCardCondition(reward, cond.id)}
                disabled={reward.status === 'resgatada' || reward.status === 'arquivada'}
                style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: 'var(--sp-2)', 
                  background: 'none', 
                  border: 'none', 
                  padding: 0,
                  textAlign: 'left',
                  cursor: (reward.status === 'resgatada' || reward.status === 'arquivada') ? 'default' : 'pointer',
                  width: '100%'
                }}
              >
                {cond.completed ? (
                  <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '2px' }} />
                ) : (
                  <Circle size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginTop: '2px' }} />
                )}
                <span style={{ 
                  fontSize: 'var(--fs-sm)', 
                  color: cond.completed ? 'var(--text-tertiary)' : 'var(--text-primary)',
                  textDecoration: cond.completed ? 'line-through' : 'none',
                  lineBreak: 'anywhere'
                }}>
                  {cond.text}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Notes */}
        {reward.notes && (
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontStyle: 'italic', background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-soft)', marginBottom: 'var(--sp-6)' }}>
            Obs: {reward.notes}
          </div>
        )}

        {/* Action buttons footer */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'auto', paddingTop: 'var(--sp-3)', borderTop: '1px solid var(--border-soft)' }}>
          {reward.status === 'arquivada' ? (
            <button 
              className="btn btn-primary" 
              onClick={() => handleArchive(reward)}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <Archive size={14} /> Desarquivar
            </button>
          ) : reward.status === 'resgatada' ? (
            <>
              <button 
                className="btn btn-secondary" 
                onClick={() => handleCancelRedeem(reward)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--danger)' }}
              >
                Cancelar resgate
              </button>
              <button 
                className="btn btn-secondary btn-icon" 
                onClick={() => handleArchive(reward)}
                title="Arquivar"
              >
                <Archive size={14} />
              </button>
            </>
          ) : (
            <>
              {isRedeemable && (
                <button 
                  className="btn btn-success" 
                  onClick={() => handleRedeem(reward)}
                  style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Trophy size={14} /> Resgatar Recompensa
                </button>
              )}
              
              <button 
                className="btn btn-secondary" 
                onClick={() => handleEdit(reward)}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Edit2 size={14} /> {!isRedeemable && 'Editar'}
              </button>

              <button 
                className="btn btn-secondary btn-icon" 
                onClick={() => handleArchive(reward)}
                title="Arquivar"
              >
                <Archive size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
        <div>
          <h1>Recompensas</h1>
          <p>Defina metas pessoais e resgate recompensas ao concluir suas condições.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(defaultReward); setEditing(null); setShowModal(true); }}>
          <Plus size={16} /> Nova Recompensa
        </button>
      </div>

      {/* Metrics Summary Area */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--sp-4)', marginBottom: 'var(--sp-6)' }}>
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Em Andamento</span>
            <div className="stat-icon" style={{ background: 'var(--accent-subtle)' }}>
              <Clock size={18} style={{ color: 'var(--accent)' }} />
            </div>
          </div>
          <span className="stat-value">{metrics.active}</span>
          <span className="stat-sub">Recompensas ativas</span>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Prontas para Resgatar</span>
            <div className="stat-icon" style={{ background: 'var(--success-subtle)' }}>
              <Trophy size={18} style={{ color: 'var(--success)' }} />
            </div>
          </div>
          <span className="stat-value">{metrics.ready}</span>
          <span className="stat-sub">Condições 100% concluídas</span>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Resgatadas</span>
            <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
              <Award size={18} style={{ color: 'rgb(59, 130, 246)' }} />
            </div>
          </div>
          <span className="stat-value">{metrics.redeemed}</span>
          <span className="stat-sub">Prêmios conquistados</span>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Próxima Recompensa</span>
            <div className="stat-icon" style={{ background: 'var(--warning-subtle)' }}>
              <Gift size={18} style={{ color: 'var(--warning)' }} />
            </div>
          </div>
          {metrics.nextReward ? (
            <>
              <span className="stat-value" style={{ fontSize: 'var(--fs-lg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', display: 'block' }}>
                {metrics.nextReward.title}
              </span>
              <span className="stat-sub" style={{ color: 'var(--accent)', fontWeight: 600 }}>{metrics.nextProgress}% concluída</span>
            </>
          ) : (
            <>
              <span className="stat-value" style={{ fontSize: 'var(--fs-md)', color: 'var(--text-tertiary)' }}>Nenhuma ativa</span>
              <span className="stat-sub">Crie uma para começar!</span>
            </>
          )}
        </div>
      </div>

      {/* Filter Options Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-6)', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          <select 
            className="form-select" 
            style={{ width: 'auto', minWidth: '150px' }}
            value={categoryFilter} 
            onChange={e => setCategoryFilter(e.target.value)}
          >
            <option value="Todas">Todas as Categorias</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <button 
            className={`btn ${showArchived ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowArchived(prev => !prev)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Archive size={16} /> {showArchived ? 'Ver Ativas' : 'Ver Arquivadas'}
          </button>
        </div>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
          {filteredRewards.length} recompensa(s) encontrada(s)
        </span>
      </div>

      {/* Grid List of Rewards / Sections */}
      {showArchived ? (
        <div style={{ marginBottom: 'var(--sp-8)' }}>
          <div style={{ marginBottom: 'var(--sp-4)' }}>
            <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <Archive size={18} style={{ color: 'var(--text-secondary)' }} />
              <span>Arquivadas</span>
              <span className="badge badge-secondary" style={{ fontSize: '11px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: '4px' }}>
                {sections.archived.length}
              </span>
            </h2>
          </div>
          {sections.archived.length === 0 ? (
            <SectionEmptyState message="Nenhuma recompensa arquivada." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 'var(--sp-4)' }}>
              {sections.archived.map(reward => renderRewardCard(reward))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-8)' }}>
          {/* Section: Em Andamento */}
          <div>
            <div style={{ marginBottom: 'var(--sp-4)' }}>
              <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <Clock size={18} style={{ color: 'var(--accent)' }} />
                <span>Em Andamento</span>
                <span className="badge badge-secondary" style={{ fontSize: '11px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: '4px' }}>
                  {sections.inProgress.length}
                </span>
              </h2>
            </div>
            {sections.inProgress.length === 0 ? (
              <SectionEmptyState message="Nenhuma recompensa em andamento no momento." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 'var(--sp-4)' }}>
                {sections.inProgress.map(reward => renderRewardCard(reward))}
              </div>
            )}
          </div>

          {/* Section: Prontas para resgatar */}
          <div>
            <div style={{ marginBottom: 'var(--sp-4)' }}>
              <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <Trophy size={18} style={{ color: 'var(--success)' }} />
                <span>Prontas para Resgatar</span>
                <span className="badge" style={{ fontSize: '11px', background: 'var(--success-subtle)', color: 'var(--success)', border: '1px solid var(--success)', padding: '2px 6px', borderRadius: '4px' }}>
                  {sections.readyToRedeem.length}
                </span>
              </h2>
            </div>
            {sections.readyToRedeem.length === 0 ? (
              <SectionEmptyState message="Nenhuma recompensa pronta para resgatar. Continue completando suas condições!" />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 'var(--sp-4)' }}>
                {sections.readyToRedeem.map(reward => renderRewardCard(reward))}
              </div>
            )}
          </div>

          {/* Section: Resgatadas */}
          <div>
            <div style={{ marginBottom: 'var(--sp-4)' }}>
              <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <Award size={18} style={{ color: 'var(--accent)' }} />
                <span>Resgatadas</span>
                <span className="badge" style={{ fontSize: '11px', background: 'rgba(59, 130, 246, 0.1)', color: 'rgb(59, 130, 246)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                  {sections.redeemed.length}
                </span>
              </h2>
            </div>
            {sections.redeemed.length === 0 ? (
              <SectionEmptyState message="Nenhuma recompensa resgatada ainda. A sensação de conquista te espera!" />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 'var(--sp-4)' }}>
                {sections.redeemed.map(reward => renderRewardCard(reward))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <Modal title={editing ? 'Editar Recompensa' : 'Nova Recompensa'} onClose={() => { setShowModal(false); setEditing(null); }}>
          <div className="form-group">
            <label className="form-label">Nome da recompensa *</label>
            <input 
              className="form-input" 
              type="text" 
              placeholder="Ex: Viagem de fim de semana, Comprar monitor novo" 
              value={form.title} 
              onChange={e => setForm({ ...form, title: e.target.value })} 
              autoFocus 
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Categoria *</label>
              <select 
                className="form-select" 
                value={form.category} 
                onChange={e => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Prioridade</label>
              <select 
                className="form-select" 
                value={form.priority} 
                onChange={e => setForm({ ...form, priority: e.target.value })}
              >
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Custo da recompensa (R$)</label>
              <input 
                className="form-input" 
                type="number" 
                placeholder="0,00" 
                value={form.estimatedValue} 
                onChange={e => setForm({ ...form, estimatedValue: e.target.value })} 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Prazo para concluir</label>
              <input 
                className="form-input" 
                type="date" 
                value={form.deadline} 
                onChange={e => setForm({ ...form, deadline: e.target.value })} 
              />
            </div>
          </div>

          {/* Redeem Available Date */}
          <div className="form-group">
            <label className="form-label">Data para resgatar (Bloquear até esta data)</label>
            <input 
              className="form-input" 
              type="date" 
              value={form.redeemAvailableDate} 
              onChange={e => setForm({ ...form, redeemAvailableDate: e.target.value })} 
            />
          </div>

          {/* Show on Dashboard Checkbox */}
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
            <input 
              id="showOnDashboard"
              type="checkbox" 
              checked={form.showOnDashboard || false} 
              onChange={e => {
                const isChecking = e.target.checked;
                if (isChecking) {
                  const pinnedCount = rewards.filter(r => r.showOnDashboard && r.status !== 'resgatada' && r.status !== 'arquivada' && r.id !== editing).length;
                  if (pinnedCount >= 3) {
                    alert("Você já selecionou 3 recompensas para a Dashboard.");
                    return;
                  }
                }
                setForm({ ...form, showOnDashboard: e.target.checked });
              }}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="showOnDashboard" className="form-label" style={{ marginBottom: 0, cursor: 'pointer', fontWeight: 500 }}>
              Mostrar esta recompensa na Dashboard
            </label>
          </div>

          {/* Meta financeira para desbloquear (Opcional) */}
          <div className="form-group" style={{ border: '1px solid var(--border)', padding: 'var(--sp-4)', borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)', marginBottom: 'var(--sp-4)' }}>
            <label className="form-label" style={{ fontWeight: 600, marginBottom: 'var(--sp-3)', display: 'block' }}>
              Meta financeira para desbloquear (Opcional)
            </label>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '11px' }}>Valor alvo (R$)</label>
                <input 
                  className="form-input" 
                  type="number" 
                  placeholder="Ex: 10000" 
                  value={form.financialTargetAmount} 
                  onChange={e => setForm({ ...form, financialTargetAmount: e.target.value })} 
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '11px' }}>Valor atual (R$)</label>
                <input 
                  className="form-input" 
                  type="number" 
                  placeholder="Ex: 3200" 
                  value={form.financialCurrentAmount} 
                  onChange={e => setForm({ ...form, financialCurrentAmount: e.target.value })} 
                />
              </div>
            </div>
          </div>

          {/* Interactive Unlock Conditions Checklist */}
          <div className="form-group" style={{ border: '1px solid var(--border)', padding: 'var(--sp-4)', borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)' }}>
            <label className="form-label" style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
              <span>Condições para Desbloquear</span>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{form.conditions.length} cadastradas</span>
            </label>
            
            {/* Condition List in form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: 'var(--sp-3)', maxHeight: '120px', overflowY: 'auto' }}>
              {form.conditions.map(cond => (
                <div key={cond.id} style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', gap: 'var(--sp-2)', background: 'var(--bg-primary)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-soft)' }}>
                  <button 
                    onClick={() => toggleCondition(cond.id)}
                    style={{ background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                  >
                    {cond.completed ? (
                      <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                    ) : (
                      <Circle size={16} style={{ color: 'var(--text-tertiary)' }} />
                    )}
                  </button>
                  <span style={{ 
                    fontSize: 'var(--fs-sm)', 
                    color: cond.completed ? 'var(--text-tertiary)' : 'var(--text-primary)',
                    textDecoration: cond.completed ? 'line-through' : 'none',
                    flex: 1,
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap'
                  }}>
                    {cond.text}
                  </span>
                  <button 
                    onClick={() => removeCondition(cond.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '2px' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Input to add condition */}
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <input 
                className="form-input" 
                type="text" 
                placeholder="Ex: Faturar R$ 10k este mês" 
                value={newConditionText} 
                onChange={e => setNewConditionText(e.target.value)} 
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCondition(); } }}
              />
              <button className="btn btn-secondary" onClick={addCondition}>Adicionar</button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Observações</label>
            <textarea 
              className="form-textarea" 
              placeholder="Notas adicionais..." 
              value={form.notes} 
              onChange={e => setForm({ ...form, notes: e.target.value })} 
            />
          </div>

          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEditing(null); }}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSubmit}>{editing ? 'Salvar' : 'Criar Recompensa'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
