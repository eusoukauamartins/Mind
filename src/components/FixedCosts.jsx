import { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import Modal from './Modal';
import { 
  Plus, Wifi, Home, Users, CreditCard, Zap, Package, 
  FileText, Cpu, Briefcase, DollarSign, Calendar, Clock, 
  Check, ArrowRight, Edit, Trash2, HelpCircle, SkipForward, AlertTriangle
} from 'lucide-react';
import { formatCurrency, formatDate, getToday, getWeekRef } from '../utils/helpers';

// Preset Categories with Icons
const CATEGORIES_CONFIG = {
  'Internet': { icon: Wifi, color: '#4D8DFF' },
  'Aluguel': { icon: Home, color: '#A29BFE' },
  'Funcionários': { icon: Users, color: '#00B894' },
  'Assinaturas': { icon: CreditCard, color: '#00CEC9' },
  'Energia': { icon: Zap, color: '#F6C453' },
  'Fornecedores': { icon: Package, color: '#E17055' },
  'Impostos': { icon: FileText, color: '#D63031' },
  'Software': { icon: Cpu, color: '#FD79A8' },
  'Serviços': { icon: Briefcase, color: '#0984E3' },
  'Outros': { icon: DollarSign, color: '#636E72' }
};

const defaultForm = {
  title: '',
  amount: '',
  recurrence: 'mensal',
  dueDay: '5',
  dueMonth: '1',
  category: 'Internet',
  notes: ''
};

export default function FixedCosts() {
  const { fixedCosts, finance, createItem, updateItem, deleteItem } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);

  // Helper: Get period key based on recurrence
  const getPeriodKey = (cost, date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    if (cost.recurrence === 'semanal') {
      return getWeekRef(date);
    } else if (cost.recurrence === 'anual') {
      return String(y);
    } else {
      return `${y}-${m}`; // 'mensal'
    }
  };

  // Helper: Get due date for a given period date
  const getDueDateForPeriod = (cost, date = new Date()) => {
    const y = date.getFullYear();
    const m = date.getMonth(); // 0-11
    
    if (cost.recurrence === 'mensal') {
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const day = Math.min(parseInt(cost.dueDay) || 1, daysInMonth);
      return new Date(y, m, day);
    } else if (cost.recurrence === 'semanal') {
      // Find Sunday of the week
      const currentDayOfWeek = date.getDay(); // 0-6
      const targetDayOfWeek = parseInt(cost.dueDay) || 0; // 0-6
      const diff = targetDayOfWeek - currentDayOfWeek;
      const d = new Date(date);
      d.setDate(date.getDate() + diff);
      return d;
    } else if (cost.recurrence === 'anual') {
      const month = (parseInt(cost.dueMonth) || 1) - 1; // 0-11
      const daysInMonth = new Date(y, month + 1, 0).getDate();
      const day = Math.min(parseInt(cost.dueDay) || 1, daysInMonth);
      return new Date(y, month, day);
    }
    return new Date();
  };

  // Helper: Get check start date (created date or fallback)
  const getStartDateForChecks = (cost) => {
    if (cost.createdAt) {
      return new Date(cost.createdAt);
    }
    // Fallback to 3 months ago
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d;
  };

  // Helper: Calculate next due date and active period key recursively from the start
  const getNextPeriodAndDate = (cost) => {
    let checkDate = getStartDateForChecks(cost);
    
    // We loop and advance checkDate until we find a period that is NOT paid and NOT skipped.
    const maxIterations = 24; // 2 years limit
    let iterations = 0;
    
    while (iterations < maxIterations) {
      const periodKey = getPeriodKey(cost, checkDate);
      const isPaidOrSkipped = (cost.paidPeriods || []).includes(periodKey) || 
                              (cost.skippedPeriods || []).includes(periodKey);
      
      if (!isPaidOrSkipped) {
        const dueDate = getDueDateForPeriod(cost, checkDate);
        return { dueDate, periodKey, isPaid: false };
      }
      
      // Advance checkDate by one cycle
      if (cost.recurrence === 'semanal') {
        checkDate.setDate(checkDate.getDate() + 7);
      } else if (cost.recurrence === 'anual') {
        checkDate.setFullYear(checkDate.getFullYear() + 1);
      } else {
        // 'mensal'
        checkDate.setMonth(checkDate.getMonth() + 1);
      }
      iterations++;
    }
    
    // Fallback
    const fallbackDate = new Date();
    const fallbackKey = getPeriodKey(cost, fallbackDate);
    const dueDate = getDueDateForPeriod(cost, fallbackDate);
    return { dueDate, periodKey: fallbackKey, isPaid: false };
  };

  // Process Costs with Details & Sorting
  const processedCosts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (fixedCosts || []).map(cost => {
      const { dueDate, periodKey } = getNextPeriodAndDate(cost);
      
      const dueDateTime = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      const todayTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const diffTime = dueDateTime - todayTime;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Check if current calendar period key is paid/skipped
      const currentPeriodKey = getPeriodKey(cost, new Date());
      const isPaid = (cost.paidPeriods || []).includes(currentPeriodKey) || 
                     (cost.skippedPeriods || []).includes(currentPeriodKey);

      let status = 'pendente';
      if (isPaid) {
        status = 'pago';
      } else if (diffDays < 0) {
        status = 'atrasado';
      } else if (diffDays <= 3) {
        status = 'duesoon';
      }

      return {
        ...cost,
        dueDate,
        periodKey, // Target period key to pay
        diffDays,
        status,
        isPaid
      };
    }).sort((a, b) => {
      const statusWeight = { 'atrasado': 4, 'duesoon': 3, 'pendente': 2, 'pago': 1 };
      if (statusWeight[a.status] !== statusWeight[b.status]) {
        return statusWeight[b.status] - statusWeight[a.status];
      }
      return a.dueDate - b.dueDate;
    });
  }, [fixedCosts]);

  // Projections calculations
  const projections = useMemo(() => {
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    // Get current global bank balance
    const getSafeInitialBalance = () => {
      const raw = localStorage.getItem('cp_initial_balance');
      if (!raw) return 0;
      const parsed = parseFloat(String(raw).replace(',', '.'));
      return isNaN(parsed) ? 0 : parsed;
    };
    const initialBalance = getSafeInitialBalance();
    const globalIncome = finance.filter(f => f && f.type === 'entrada').reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const globalExpenses = finance.filter(f => f && f.type === 'saída').reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const currentBankBalance = initialBalance + globalIncome - globalExpenses;

    // Calculate pending fixed costs for the CURRENT active calendar month and overdue costs
    let totalPendingAmount = 0;
    
    (fixedCosts || []).forEach(cost => {
      const { dueDate } = getNextPeriodAndDate(cost);
      
      // Check if current calendar period key is paid/skipped
      const currentPeriodKey = getPeriodKey(cost, today);
      const isPaid = (cost.paidPeriods || []).includes(currentPeriodKey) || 
                     (cost.skippedPeriods || []).includes(currentPeriodKey);

      if (!isPaid) {
        const dueMonthStr = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;
        const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        // Count as pending if due in the current month OR if it is overdue from a previous month!
        if (dueDate < startOfCurrentMonth || dueMonthStr === currentMonthStr) {
          totalPendingAmount += cost.amount;
        }
      }
    });

    const projectedBalance = currentBankBalance - totalPendingAmount;

    return {
      currentBankBalance,
      totalPendingAmount,
      projectedBalance
    };
  }, [fixedCosts, finance]);

  // Actions
  const handleMarkAsPaid = (cost) => {
    const periodKey = cost.periodKey;

    // 1. Memory Verification
    if ((cost.paidPeriods || []).includes(periodKey)) {
      alert('Este custo já está marcado como pago para este período.');
      return;
    }

    // 2. Database History Verification (Safety anti-duplication logic)
    const alreadyRegistered = finance.some(t => t.fixedCostId === cost.id && t.periodKey === periodKey);
    if (alreadyRegistered) {
      // Synchronize in-memory array if it was missing for some reason
      const currentPaid = cost.paidPeriods || [];
      updateItem('fixedCosts', cost.id, {
        paidPeriods: [...currentPaid, periodKey]
      });
      alert('Transação financeira já registrada no histórico para este período! O status visual foi atualizado.');
      return;
    }

    // Create Expense transaction in global state
    const expenseEntry = {
      type: 'saída',
      amount: parseFloat(cost.amount),
      category: cost.category || 'Outros',
      expenseClass: 'Fixo',
      subcategory: 'Custo Fixo',
      source: cost.title,
      date: getToday(),
      notes: cost.notes ? `${cost.notes} (Período: ${periodKey})` : `Pagamento do custo fixo (Período: ${periodKey})`,
      fixedCostId: cost.id,
      periodKey: periodKey
    };

    // Safe execution
    createItem('finance', expenseEntry);
    
    // Save to cost paidPeriods
    const currentPaid = cost.paidPeriods || [];
    updateItem('fixedCosts', cost.id, {
      paidPeriods: [...currentPaid, periodKey]
    });
  };

  const handleSkipMonth = (cost) => {
    const periodKey = cost.periodKey;
    const currentSkipped = cost.skippedPeriods || [];
    
    updateItem('fixedCosts', cost.id, {
      skippedPeriods: [...currentSkipped, periodKey]
    });
  };

  const handleUndoPayment = (cost) => {
    const currentPeriodKey = getPeriodKey(cost, new Date());
    
    // 1. Revert Paid State
    if ((cost.paidPeriods || []).includes(currentPeriodKey)) {
      // Find the associated transaction in global finance history and delete it safely
      const linkedTransaction = finance.find(t => t.fixedCostId === cost.id && t.periodKey === currentPeriodKey);
      if (linkedTransaction) {
        deleteItem('finance', linkedTransaction.id);
      }
      
      const newPaidPeriods = (cost.paidPeriods || []).filter(p => p !== currentPeriodKey);
      updateItem('fixedCosts', cost.id, {
        paidPeriods: newPaidPeriods
      });
    }
    
    // 2. Revert Skipped State
    if ((cost.skippedPeriods || []).includes(currentPeriodKey)) {
      const newSkippedPeriods = (cost.skippedPeriods || []).filter(p => p !== currentPeriodKey);
      updateItem('fixedCosts', cost.id, {
        skippedPeriods: newSkippedPeriods
      });
    }
  };

  const handleEdit = (cost) => {
    setForm({
      title: cost.title,
      amount: cost.amount.toString(),
      recurrence: cost.recurrence || 'mensal',
      dueDay: cost.dueDay.toString(),
      dueMonth: (cost.dueMonth || 1).toString(),
      category: cost.category || 'Internet',
      notes: cost.notes || ''
    });
    setEditing(cost.id);
    setShowModal(true);
  };

  const handleDelete = (costId) => {
    if (confirm('Tem certeza de que deseja remover este custo fixo?')) {
      deleteItem('fixedCosts', costId);
    }
  };

  const handleSubmit = () => {
    if (!form.title || !form.amount || !form.dueDay) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const costData = {
      title: form.title,
      amount: parseFloat(form.amount.replace(',', '.')),
      recurrence: form.recurrence,
      dueDay: parseInt(form.dueDay),
      dueMonth: form.recurrence === 'anual' ? parseInt(form.dueMonth) : undefined,
      category: form.category,
      notes: form.notes
    };

    if (editing) {
      updateItem('fixedCosts', editing, costData);
    } else {
      createItem('fixedCosts', {
        ...costData,
        paidPeriods: [],
        skippedPeriods: []
      });
    }

    setShowModal(false);
    setEditing(null);
    setForm(defaultForm);
  };

  return (
    <div id="fixed-costs-section" style={{ marginBottom: 'var(--sp-6)' }}>
      {/* Header and Projections */}
      <div className="fixed-costs-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
        <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
          Obrigações Financeiras (Custos Fixos)
        </h2>
        <button className="btn btn-secondary btn-sm" onClick={() => { setForm(defaultForm); setEditing(null); setShowModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)' }}>
          <Plus size={14} /> Novo Custo Fixo
        </button>
      </div>

      {/* Projection Banner */}
      <div className="projections-banner" style={{
        background: 'linear-gradient(135deg, rgba(26, 31, 43, 0.7), rgba(32, 38, 54, 0.7))',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--sp-4) var(--sp-5)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 'var(--sp-4)',
        backdropFilter: 'blur(8px)',
        marginBottom: 'var(--sp-4)'
      }}>
        {/* Real Balance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Saldo Bancário Atual</span>
          <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>
            {formatCurrency(projections.currentBankBalance)}
          </span>
        </div>

        <div className="proj-operator" style={{ fontSize: 'var(--fs-lg)', color: 'var(--border-strong)', alignSelf: 'center', display: 'flex', alignItems: 'center', height: '100%' }}>—</div>

        {/* Unpaid Costs Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Custos Pendentes (Mês)</span>
          <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, color: '#fdcb6e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            -{formatCurrency(projections.totalPendingAmount)}
          </span>
        </div>

        <div className="proj-operator" style={{ fontSize: 'var(--fs-lg)', color: 'var(--border-strong)', alignSelf: 'center', display: 'flex', alignItems: 'center', height: '100%' }}>=</div>

        {/* Projected Balance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingRight: 'var(--sp-2)' }}>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Saldo Projetado</span>
          <span style={{ 
            fontSize: 'var(--fs-lg)', 
            fontWeight: 700, 
            color: projections.projectedBalance >= 0 ? 'var(--success)' : 'var(--danger)'
          }}>
            {formatCurrency(projections.projectedBalance)}
          </span>
        </div>
      </div>

      {/* Cards list */}
      {processedCosts.length === 0 ? (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-soft)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--sp-8)',
          textAlign: 'center',
          color: 'var(--text-tertiary)'
        }}>
          <AlertTriangle size={24} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--sp-2)' }} />
          <p style={{ fontSize: 'var(--fs-sm)', margin: 0 }}>Nenhum custo fixo recorrente cadastrado.</p>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(true)} style={{ marginTop: 'var(--sp-2)', color: 'var(--accent)' }}>
            Cadastrar primeiro custo
          </button>
        </div>
      ) : (
        <div className="fixed-costs-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 'var(--sp-4)'
        }}>
          {processedCosts.map(cost => {
            const config = CATEGORIES_CONFIG[cost.category] || CATEGORIES_CONFIG['Outros'];
            const CatIcon = config.icon;
            
            // Map card border classes
            let cardClass = 'fixed-cost-card-normal';
            let indicatorClass = 'fixed-cost-indicator-bar-normal';
            let statusText = 'Pendente';
            let statusStyle = { color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)' };
            
            if (cost.status === 'pago') {
              cardClass = 'fixed-cost-card-paid';
              indicatorClass = 'fixed-cost-indicator-bar-paid';
              statusText = 'Pago';
              statusStyle = { color: 'var(--success)', background: 'var(--success-subtle)' };
            } else if (cost.status === 'atrasado') {
              cardClass = 'fixed-cost-card-overdue';
              indicatorClass = 'fixed-cost-indicator-bar-overdue';
              statusText = 'Atrasado';
              statusStyle = { color: 'var(--danger)', background: 'var(--danger-subtle)', fontWeight: '600' };
            } else if (cost.status === 'duesoon') {
              cardClass = 'fixed-cost-card-duesoon';
              indicatorClass = 'fixed-cost-indicator-bar-duesoon';
              statusText = 'Vence logo';
              statusStyle = { color: 'var(--warning)', background: 'var(--warning-subtle)', fontWeight: '600' };
            }

            return (
              <div key={cost.id} className={cardClass} style={{
                borderRadius: 'var(--radius-md)',
                padding: 'var(--sp-4) var(--sp-4) var(--sp-4) var(--sp-5)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '145px'
              }}>
                {/* Left accent bar */}
                <div className={`fixed-cost-indicator-bar ${indicatorClass}`} />

                {/* Upper row: Icon & Title */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--bg-tertiary)',
                        color: config.color,
                        flexShrink: 0
                      }}>
                        <CatIcon size={14} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ fontSize: 'var(--fs-base)', fontWeight: 500, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cost.title}
                        </h3>
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                          {cost.category}
                        </span>
                      </div>
                    </div>
                    {/* Status Badge */}
                    <span style={{
                      fontSize: '9px',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      ...statusStyle
                    }}>
                      {statusText}
                    </span>
                  </div>

                  {/* Middle row: Due info */}
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                    <Calendar size={12} style={{ color: 'var(--text-tertiary)' }} />
                    {cost.status === 'pago' ? (
                      <span>Pago. Próx: {formatDate(cost.dueDate.toISOString().split('T')[0])}</span>
                    ) : (
                      <span>
                        Vence {cost.recurrence === 'semanal' ? 'este ciclo' : 'dia'} {cost.recurrence === 'anual' ? `${cost.dueDay}/${cost.dueMonth}` : cost.dueDay}
                        {' — '}
                        <strong style={{ color: cost.diffDays < 0 ? 'var(--danger)' : cost.diffDays <= 3 ? 'var(--warning)' : 'var(--text-secondary)' }}>
                          {cost.diffDays < 0 ? `Atrasado há ${Math.abs(cost.diffDays)}d` : cost.diffDays === 0 ? 'Vence HOJE' : `Em ${cost.diffDays} dias`}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer row: Amount & Action buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--border-soft)' }}>
                  <span style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {formatCurrency(cost.amount)}
                  </span>
                  
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {(() => {
                      const currentPeriodKey = getPeriodKey(cost, new Date());
                      const isPaidToday = (cost.paidPeriods || []).includes(currentPeriodKey);
                      const isSkippedToday = (cost.skippedPeriods || []).includes(currentPeriodKey);
                      
                      if (isPaidToday || isSkippedToday) {
                        return (
                          <button 
                            onClick={() => handleUndoPayment(cost)}
                            style={{
                              fontSize: '10px',
                              color: 'var(--text-tertiary)',
                              background: 'rgba(255, 255, 255, 0.04)',
                              border: '1px solid var(--border-soft)',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer',
                              transition: 'all var(--transition-base)'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.color = 'var(--warning)';
                              e.currentTarget.style.borderColor = 'rgba(246, 196, 83, 0.3)';
                              e.currentTarget.style.background = 'rgba(246, 196, 83, 0.05)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.color = 'var(--text-tertiary)';
                              e.currentTarget.style.borderColor = 'var(--border-soft)';
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                            }}
                          >
                            <Clock size={10} />
                            {isPaidToday ? 'Desfazer pagamento' : 'Desfazer pulo'}
                          </button>
                        );
                      }
                      return null;
                    })()}
                    {cost.status !== 'pago' && (
                      <>
                        <button 
                          className="btn-icon btn-ghost" 
                          onClick={() => handleMarkAsPaid(cost)}
                          title="Marcar como Pago"
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '4px',
                            color: 'var(--success)',
                            background: 'rgba(52, 211, 153, 0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Check size={12} />
                        </button>
                        <button 
                          className="btn-icon btn-ghost" 
                          onClick={() => handleSkipMonth(cost)}
                          title="Pular este ciclo"
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '4px',
                            color: 'var(--text-tertiary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <SkipForward size={12} />
                        </button>
                      </>
                    )}
                    <button 
                      className="btn-icon btn-ghost" 
                      onClick={() => handleEdit(cost)}
                      title="Editar"
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '4px',
                        color: 'var(--text-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Edit size={12} />
                    </button>
                    <button 
                      className="btn-icon btn-ghost" 
                      onClick={() => handleDelete(cost.id)}
                      title="Excluir"
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '4px',
                        color: 'var(--danger)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create or Edit Cost */}
      {showModal && (
        <Modal title={editing ? 'Editar Custo Fixo' : 'Novo Custo Fixo'} onClose={() => { setShowModal(false); setEditing(null); }}>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label">Título *</label>
            <input 
              className="form-input" 
              type="text" 
              placeholder="Ex: Internet do Escritório" 
              value={form.title} 
              onChange={e => setForm({ ...form, title: e.target.value })} 
              autoFocus 
            />
          </div>

          <div className="form-row" style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: '12px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Valor (R$) *</label>
              <input 
                className="form-input" 
                type="number" 
                step="0.01" 
                min="0" 
                placeholder="0,00" 
                value={form.amount} 
                onChange={e => setForm({ ...form, amount: e.target.value })} 
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Categoria *</label>
              <select 
                className="form-select" 
                value={form.category} 
                onChange={e => setForm({ ...form, category: e.target.value })}
              >
                {Object.keys(CATEGORIES_CONFIG).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row" style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: '12px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Recorrência</label>
              <select 
                className="form-select" 
                value={form.recurrence} 
                onChange={e => {
                  const newRec = e.target.value;
                  const newDay = newRec === 'semanal' ? '1' : '5';
                  setForm({ ...form, recurrence: newRec, dueDay: newDay });
                }}
              >
                <option value="mensal">Mensal</option>
                <option value="semanal">Semanal</option>
                <option value="anual">Anual</option>
              </select>
            </div>

            {form.recurrence === 'semanal' ? (
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Dia da Semana</label>
                <select 
                  className="form-select" 
                  value={form.dueDay} 
                  onChange={e => setForm({ ...form, dueDay: e.target.value })}
                >
                  <option value="1">Segunda-feira</option>
                  <option value="2">Terça-feira</option>
                  <option value="3">Quarta-feira</option>
                  <option value="4">Quinta-feira</option>
                  <option value="5">Sexta-feira</option>
                  <option value="6">Sábado</option>
                  <option value="0">Domingo</option>
                </select>
              </div>
            ) : (
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Dia do Vencimento *</label>
                <input 
                  className="form-input" 
                  type="number" 
                  min="1" 
                  max="31" 
                  value={form.dueDay} 
                  onChange={e => setForm({ ...form, dueDay: e.target.value })} 
                />
              </div>
            )}
          </div>

          {form.recurrence === 'anual' && (
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">Mês do Vencimento</label>
              <select 
                className="form-select" 
                value={form.dueMonth} 
                onChange={e => setForm({ ...form, dueMonth: e.target.value })}
              >
                <option value="1">Janeiro</option>
                <option value="2">Fevereiro</option>
                <option value="3">Março</option>
                <option value="4">Abril</option>
                <option value="5">Maio</option>
                <option value="6">Junho</option>
                <option value="7">Julho</option>
                <option value="8">Agosto</option>
                <option value="9">Setembro</option>
                <option value="10">Outubro</option>
                <option value="11">Novembro</option>
                <option value="12">Dezembro</option>
              </select>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">Observações</label>
            <textarea 
              className="form-textarea" 
              placeholder="Notas ou informações opcionais..." 
              value={form.notes} 
              onChange={e => setForm({ ...form, notes: e.target.value })} 
            />
          </div>

          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEditing(null); }}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSubmit}>{editing ? 'Salvar Alterações' : 'Criar Custo Fixo'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
