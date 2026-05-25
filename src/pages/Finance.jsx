import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import DateFilter from '../components/DateFilter';
import { Plus, DollarSign, TrendingUp, TrendingDown, Search, Trash2, Edit2, Wallet, Edit3, LineChart as LineChartIcon, X } from 'lucide-react';
import { formatCurrency, formatDate, isThisMonth, isThisWeek, getWeekDates } from '../utils/helpers';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import FixedCosts from '../components/FixedCosts';

const defaultEntry = { type: 'entrada', amount: '', category: '', expenseClass: '', subcategory: '', source: '', date: new Date().toISOString().split('T')[0], notes: '' };
const incomeCategories = ['Vendas', 'Serviços', 'Investimentos', 'Outros'];
const expenseCategories = ['Marketing', 'Ferramentas', 'Operações', 'Pessoal', 'Educação', 'Impostos', 'Outros'];
const expenseClasses = ['Fixo', 'Essencial', 'Estratégico', 'Variável', 'Dispensável'];
const sources = ['dropshipping', 'conteúdo', 'serviços', 'ferramentas', 'marketing', 'operações', 'pessoal', 'outro'];
const COLORS = ['#6c5ce7', '#00cec9', '#00b894', '#fdcb6e', '#e17055', '#74b9ff', '#a29bfe', '#fab1a0'];
const CLASS_COLORS = { 'Fixo': '#e17055', 'Essencial': '#00cec9', 'Estratégico': '#6c5ce7', 'Variável': '#fdcb6e', 'Dispensável': '#a29bfe', 'Sem Classificação': '#636e72' };

export default function Finance() {
  const { finance, createItem, updateItem, deleteItem } = useApp();
  const location = useLocation();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultEntry);
  const [dateFilter, setDateFilter] = useState({ period: '30 dias', start: '', end: '' });
  const [historyFilter, setHistoryFilter] = useState({ period: '7 dias', start: '', end: '' });
  const [initialBalance, setInitialBalance] = useState(() => parseFloat(localStorage.getItem('cp_initial_balance') || '0'));
  const [showBalanceHistory, setShowBalanceHistory] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    setVisibleCount(20);
  }, [dateFilter]);

  const handleUpdateInitialBalance = (e) => {
    e.stopPropagation();
    const val = prompt('Defina seu saldo inicial (ex: 1500.50):', initialBalance);
    if (val !== null && val.trim() !== '') {
      const parsed = parseFloat(val.replace(',', '.'));
      if (!isNaN(parsed)) {
        setInitialBalance(parsed);
        localStorage.setItem('cp_initial_balance', parsed);
      }
    }
  };

  useEffect(() => {
    if (location.state?.quickAdd) { setShowModal(true); window.history.replaceState({}, ''); }
  }, [location.state]);

  const filtered = useMemo(() => {
    let result = [...finance];
    if (dateFilter.start && dateFilter.end) {
      result = result.filter(f => f.date >= dateFilter.start && f.date <= dateFilter.end);
    }
    result.sort((a, b) => b.date.localeCompare(a.date));
    return result;
  }, [finance, dateFilter]);

  const metrics = useMemo(() => {
    const income = filtered.filter(f => f.type === 'entrada').reduce((s, f) => s + f.amount, 0);
    const expenses = filtered.filter(f => f.type === 'saída').reduce((s, f) => s + f.amount, 0);
    const profit = income - expenses;

    // By category
    const categoryMap = {};
    filtered.forEach(f => {
      const baseKey = f.category || 'Sem Categoria';
      const key = `${baseKey}-${f.type}`;
      if (!categoryMap[key]) categoryMap[key] = { name: baseKey, value: 0, type: f.type };
      categoryMap[key].value += f.amount;
    });
    const categoryData = Object.values(categoryMap).sort((a, b) => b.value - a.value);

    // By source
    const sourceMap = {};
    filtered.forEach(f => {
      const baseKey = f.source || 'Outro';
      const key = `${baseKey}-${f.type}`;
      if (!sourceMap[key]) sourceMap[key] = { name: baseKey, value: 0, type: f.type };
      sourceMap[key].value += f.amount;
    });
    const sourceData = Object.values(sourceMap).sort((a, b) => b.value - a.value);

    // Filtered Expense Class
    const expenseClassMap = {};
    expenseClasses.forEach(c => expenseClassMap[c] = { name: c, value: 0 }); 
    filtered.filter(f => f.type === 'saída').forEach(f => {
      const key = f.expenseClass || 'Sem Classificação';
      if (!expenseClassMap[key]) expenseClassMap[key] = { name: key, value: 0 };
      expenseClassMap[key].value += f.amount;
    });
    const expenseClassData = Object.values(expenseClassMap).filter(c => c.value > 0).sort((a, b) => b.value - a.value);

    // Global constraints
    const globalIncome = finance.filter(f => f.type === 'entrada').reduce((s, f) => s + f.amount, 0);
    const globalExpenses = finance.filter(f => f.type === 'saída').reduce((s, f) => s + f.amount, 0);
    const currentBankBalance = initialBalance + globalIncome - globalExpenses;

    // Temporal historical processing
    const allChronological = [...finance].sort((a, b) => a.date.localeCompare(b.date));
    let runningAccumulator = initialBalance;
    const dateBalances = {}; 
    allChronological.forEach(f => {
      if(f.type === 'entrada') runningAccumulator += f.amount;
      else if(f.type === 'saída') runningAccumulator -= f.amount;
      dateBalances[f.date] = runningAccumulator;
    });

    const getBalanceAtDate = (dateStr) => {
      let closestDate = null;
      for (let f of allChronological) {
         if (f.date <= dateStr) closestDate = f.date;
         else break;
      }
      return closestDate ? dateBalances[closestDate] : initialBalance;
    };

    // Balance Sparkline Data
    const recentBalances = [];
    if (historyFilter.start && historyFilter.end) {
      const sd = new Date(historyFilter.start + 'T00:00:00');
      const ed = new Date(historyFilter.end + 'T00:00:00');
      const diffDays = Math.ceil(Math.abs(ed - sd) / (1000 * 60 * 60 * 24));
      const capDays = Math.min(diffDays, 100); 
      
      for (let i = capDays; i >= 0; i--) {
        const d = new Date(ed);
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        recentBalances.push({ date: ds, label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), saldo: getBalanceAtDate(ds) });
      }
    }

    // Daily Comparison (Receita vs Despesa)
    const dailyMap = {};
    if (dateFilter.start && dateFilter.end) {
      const sd = new Date(dateFilter.start + 'T00:00:00');
      const ed = new Date(dateFilter.end + 'T00:00:00');
      const diffDays = Math.ceil(Math.abs(ed - sd) / (1000 * 60 * 60 * 24));
      const capDays = Math.min(diffDays, 60);

      for (let i = 0; i <= capDays; i++) {
        const d = new Date(sd);
        d.setDate(d.getDate() + i);
        const ds = d.toISOString().split('T')[0];
        dailyMap[ds] = { date: ds, label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), receita: 0, despesa: 0, lucro: 0, saldoBancario: getBalanceAtDate(ds) };
      }
    }

    filtered.forEach(f => {
      if (dailyMap[f.date]) {
        if (f.type === 'entrada') dailyMap[f.date].receita += f.amount;
        else if (f.type === 'saída') dailyMap[f.date].despesa += f.amount;
        dailyMap[f.date].lucro = dailyMap[f.date].receita - dailyMap[f.date].despesa;
      }
    });

    const dailyComparisons = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    return { income, expenses, profit, categoryData, sourceData, dailyComparisons, expenseClassData, currentBankBalance, recentBalances };
  }, [filtered, finance, dateFilter, historyFilter, initialBalance]);

  const handleSubmit = () => {
    if (!form.amount || !form.category) return;
    const data = { ...form, amount: parseFloat(form.amount) };
    if (editing) { updateItem('finance', editing, data); }
    else { createItem('finance', data); }
    setShowModal(false); setEditing(null); setForm(defaultEntry);
  };

  const handleEdit = (entry) => {
    setForm({ ...entry, amount: entry.amount.toString() });
    setEditing(entry.id);
    setShowModal(true);
  };

  const currentCategories = form.type === 'entrada' ? incomeCategories : expenseCategories;

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Finanças</h1>
          <p>Controle financeiro e visibilidade de resultados</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(defaultEntry); setEditing(null); setShowModal(true); }}>
          <Plus size={16} /> Novo Lançamento
        </button>
      </div>

      {/* Period Filter */}
      <DateFilter onChange={setDateFilter} />

      {/* Stats Cards */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 'var(--sp-6)' }}>
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Receita Total</span>
            <TrendingUp size={18} style={{ color: 'var(--income)' }} />
          </div>
          <span className="stat-value" style={{ color: 'var(--income)' }}>{formatCurrency(metrics.income)}</span>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Despesas Total</span>
            <TrendingDown size={18} style={{ color: 'var(--expense)' }} />
          </div>
          <span className="stat-value" style={{ color: 'var(--expense)' }}>{formatCurrency(metrics.expenses)}</span>
        </div>
        <div className="stat-card" style={{ borderColor: metrics.profit >= 0 ? 'rgba(0,184,148,0.2)' : 'rgba(225,112,85,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Lucro do Período</span>
            <DollarSign size={18} style={{ color: metrics.profit >= 0 ? 'var(--success)' : 'var(--danger)' }} />
          </div>
          <span className="stat-value" style={{ color: metrics.profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {formatCurrency(metrics.profit)}
          </span>
        </div>
        <div className="stat-card card-accent" style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              Saldo Bancário Global
              <button 
                onClick={handleUpdateInitialBalance}
                title="Editar Saldo Inicial"
                style={{ display: 'inline-flex', padding: '4px', opacity: 0.5, borderRadius: '4px' }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = 0.5}
              >
                <Edit3 size={12} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowBalanceHistory(!showBalanceHistory); }}
                title="Histórico de Saldo"
                style={{ display: 'inline-flex', padding: '4px', opacity: 1, borderRadius: '4px', color: showBalanceHistory ? 'var(--text-primary)' : 'var(--text-tertiary)', background: showBalanceHistory ? 'var(--bg-hover)' : 'transparent' }}
              >
                <LineChartIcon size={14} style={{ color: showBalanceHistory ? 'var(--accent)' : 'var(--text-tertiary)' }} />
              </button>
            </span>
            <Wallet size={18} style={{ color: 'var(--accent)' }} />
          </div>
          <span className="stat-value" style={{ color: 'var(--text-primary)' }}>
            {formatCurrency(metrics.currentBankBalance)}
          </span>
          
          {showBalanceHistory && (
            <div style={{
              position: 'absolute', top: '100%', left: '0', zIndex: 50, minWidth: 340,
              background: 'var(--bg-elevated)', border: '1px solid var(--accent-glow)', 
              borderRadius: 'var(--radius-lg)', padding: 'var(--sp-4)', marginTop: 'var(--sp-2)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>Histórico do saldo</div>
                <button className="btn-icon btn-ghost" onClick={() => setShowBalanceHistory(false)}>
                  <X size={14} />
                </button>
              </div>
              <DateFilter onChange={setHistoryFilter} compact={true} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: 200, overflowY: 'auto', paddingRight: '4px', marginTop: 'var(--sp-2)' }}>
                {metrics.recentBalances.map((rb, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)', color: idx === metrics.recentBalances.length - 1 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    <span>{rb.label}</span>
                    <span style={{ fontWeight: 500 }}>{formatCurrency(rb.saldo)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-3" style={{ marginBottom: 'var(--sp-6)' }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Por Categoria</span></div>
          {metrics.categoryData.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', padding: 'var(--sp-2) 0', maxHeight: 260, overflowY: 'auto' }}>
              {(() => {
                const incomeCategories = metrics.categoryData.filter(c => c.type === 'entrada');
                const expenseCategories = metrics.categoryData.filter(c => c.type === 'saída');
                
                const totalIncome = incomeCategories.reduce((s, c) => s + c.value, 0);
                const totalExpense = expenseCategories.reduce((s, c) => s + c.value, 0);

                const maxIncome = incomeCategories.length > 0 ? Math.max(...incomeCategories.map(c => c.value)) : 0;
                const maxExpense = expenseCategories.length > 0 ? Math.max(...expenseCategories.map(c => c.value)) : 0;

                return (
                  <>
                    {/* Receitas Group */}
                    <div>
                      <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--income)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--sp-2)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Receitas</span>
                        <span>{formatCurrency(totalIncome)}</span>
                      </div>
                      
                      {incomeCategories.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                          {incomeCategories.map((item, i) => (
                            <div key={`inc-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', alignItems: 'center' }}>
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.name}</span>
                                <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                                  <span style={{ color: 'var(--income)', fontWeight: 600 }}>{formatCurrency(item.value)}</span>
                                  <span style={{ color: 'var(--text-tertiary)', width: '36px', textAlign: 'right' }}>{totalIncome > 0 ? Math.round((item.value / totalIncome) * 100) : 0}%</span>
                                </div>
                              </div>
                              <div style={{ width: '100%', height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ width: `${maxIncome > 0 ? (item.value / maxIncome) * 100 : 0}%`, height: '100%', background: 'var(--income)', borderRadius: 3 }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', padding: 'var(--sp-1) 0' }}>Sem receitas no período</p>
                      )}
                    </div>

                    <div style={{ height: 1, background: 'var(--border-soft)', margin: 'var(--sp-1) 0' }} />

                    {/* Despesas Group */}
                    <div>
                      <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--expense)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--sp-2)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Despesas</span>
                        <span>{formatCurrency(totalExpense)}</span>
                      </div>

                      {expenseCategories.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                          {expenseCategories.map((item, i) => (
                            <div key={`exp-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', alignItems: 'center' }}>
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.name}</span>
                                <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                                  <span style={{ color: 'var(--expense)', fontWeight: 600 }}>{formatCurrency(item.value)}</span>
                                  <span style={{ color: 'var(--text-tertiary)', width: '36px', textAlign: 'right' }}>{totalExpense > 0 ? Math.round((item.value / totalExpense) * 100) : 0}%</span>
                                </div>
                              </div>
                              <div style={{ width: '100%', height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ width: `${maxExpense > 0 ? (item.value / maxExpense) * 100 : 0}%`, height: '100%', background: 'var(--expense)', borderRadius: 3 }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', padding: 'var(--sp-1) 0' }}>Sem despesas no período</p>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          ) : <p className="text-secondary text-sm" style={{ padding: 'var(--sp-8)', textAlign: 'center' }}>Sem dados para exibir</p>}
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Por Fonte / Atividade</span></div>
          {metrics.sourceData.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', padding: 'var(--sp-2) 0', maxHeight: 260, overflowY: 'auto' }}>
              {(() => {
                const incomeSources = metrics.sourceData.filter(c => c.type === 'entrada');
                const expenseSources = metrics.sourceData.filter(c => c.type === 'saída');
                
                const totalIncome = incomeSources.reduce((s, c) => s + c.value, 0);
                const totalExpense = expenseSources.reduce((s, c) => s + c.value, 0);

                const maxIncome = incomeSources.length > 0 ? Math.max(...incomeSources.map(c => c.value)) : 0;
                const maxExpense = expenseSources.length > 0 ? Math.max(...expenseSources.map(c => c.value)) : 0;

                return (
                  <>
                    {/* Receitas Group */}
                    <div>
                      <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--income)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--sp-2)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Receitas</span>
                        <span>{formatCurrency(totalIncome)}</span>
                      </div>
                      
                      {incomeSources.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                          {incomeSources.map((item, i) => (
                            <div key={`src-inc-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', alignItems: 'center' }}>
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.name}</span>
                                <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                                  <span style={{ color: 'var(--income)', fontWeight: 600 }}>{formatCurrency(item.value)}</span>
                                  <span style={{ color: 'var(--text-tertiary)', width: '36px', textAlign: 'right' }}>{totalIncome > 0 ? Math.round((item.value / totalIncome) * 100) : 0}%</span>
                                </div>
                              </div>
                              <div style={{ width: '100%', height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ width: `${maxIncome > 0 ? (item.value / maxIncome) * 100 : 0}%`, height: '100%', background: 'var(--income)', borderRadius: 3 }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', padding: 'var(--sp-1) 0' }}>Sem receitas no período</p>
                      )}
                    </div>

                    <div style={{ height: 1, background: 'var(--border-soft)', margin: 'var(--sp-1) 0' }} />

                    {/* Despesas Group */}
                    <div>
                      <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--expense)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--sp-2)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Despesas</span>
                        <span>{formatCurrency(totalExpense)}</span>
                      </div>

                      {expenseSources.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                          {expenseSources.map((item, i) => (
                            <div key={`src-exp-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', alignItems: 'center' }}>
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.name}</span>
                                <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                                  <span style={{ color: 'var(--expense)', fontWeight: 600 }}>{formatCurrency(item.value)}</span>
                                  <span style={{ color: 'var(--text-tertiary)', width: '36px', textAlign: 'right' }}>{totalExpense > 0 ? Math.round((item.value / totalExpense) * 100) : 0}%</span>
                                </div>
                              </div>
                              <div style={{ width: '100%', height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ width: `${maxExpense > 0 ? (item.value / maxExpense) * 100 : 0}%`, height: '100%', background: 'var(--expense)', borderRadius: 3 }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', padding: 'var(--sp-1) 0' }}>Sem despesas no período</p>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          ) : <p className="text-secondary text-sm" style={{ padding: 'var(--sp-8)', textAlign: 'center' }}>Sem dados para exibir</p>}
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header"><span className="card-title">Classificação do Gasto</span></div>
          {metrics.expenseClassData.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)', padding: 'var(--sp-2) 0' }}>
                {(() => {
                  const total = metrics.expenseClassData.reduce((s, c) => s + c.value, 0);
                  const top = metrics.expenseClassData[0];
                  return (
                    <>
                      {metrics.expenseClassData.map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: CLASS_COLORS[item.name] || '#636e72' }} />
                            <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 'var(--fs-sm)' }}>{item.name}</span>
                          </div>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{total > 0 ? Math.round((item.value / total) * 100) : 0}%</span>
                        </div>
                      ))}
                      
                      <div style={{ marginTop: 'auto', paddingTop: 'var(--sp-4)' }}>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)', lineHeight: 1.5 }}>
                          <strong style={{ color: 'var(--text-primary)' }}>Visão Operacional:</strong>
                          <br />
                          O maior volume de gastos do período foi <strong style={{ color: CLASS_COLORS[top.name] || 'var(--accent)' }}>{top.name}</strong>, representando {total > 0 ? Math.round((top.value / total) * 100) : 0}% das despesas.
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          ) : <p className="text-secondary text-sm" style={{ padding: 'var(--sp-8)', textAlign: 'center' }}>Não houve saídas registradas</p>}
        </div>
      </div>

      {/* Daily Comparison Chart */}
      {metrics.dailyComparisons.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--sp-6)' }}>
          <div className="card-header" style={{ marginBottom: 'var(--sp-1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
            <span className="card-title">Comparativo Diário</span>
            {(() => {
              const bestProfitDay = [...metrics.dailyComparisons].sort((a,b) => b.lucro - a.lucro)[0];
              const highestExpenseDay = [...metrics.dailyComparisons].sort((a,b) => b.despesa - a.despesa)[0];
              return (
                <div style={{ display: 'flex', gap: 'var(--sp-4)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {bestProfitDay && bestProfitDay.lucro > 0 && <span>Maior lucro: <strong style={{color: 'var(--success)'}}>{bestProfitDay.label}</strong></span>}
                  {highestExpenseDay && highestExpenseDay.despesa > 0 && <span>Maior gasto: <strong style={{color: 'var(--danger)'}}>{highestExpenseDay.label}</strong></span>}
                </div>
              );
            })()}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={metrics.dailyComparisons} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} tickFormatter={(v) => `R$ ${v/1000}k`} />
              <Tooltip 
                cursor={{ fill: 'var(--bg-hover)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px', minWidth: 200, boxShadow: '0 8px 16px rgba(0,0,0,0.3)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Data: {formatDate(data.date)}</div>
                        <div style={{ color: 'var(--income)', display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}><span>Receita total:</span> <span style={{fontWeight: 500}}>{formatCurrency(data.receita)}</span></div>
                        <div style={{ color: 'var(--expense)', display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}><span>Despesa total:</span> <span style={{fontWeight: 500}}>{formatCurrency(data.despesa)}</span></div>
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', color: data.lucro >= 0 ? 'var(--success)' : 'var(--danger)', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '8px' }}>
                          <span>Lucro do dia:</span> <span>{formatCurrency(data.lucro)}</span>
                        </div>
                        <div style={{ color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '6px' }}>
                          <span>Saldo bancário do dia:</span> <span>{formatCurrency(data.saldoBancario)}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: '10px' }} />
              <Bar dataKey="receita" name="Receita" fill="var(--income)" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="despesa" name="Despesa" fill="var(--expense)" radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Custos Fixos Mensais */}
      <FixedCosts />

      {/* Transactions List */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Transações Recentes</span>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{filtered.length} registros</span>
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={DollarSign} title="Nenhum lançamento" description="Registre receitas e despesas para acompanhar seus resultados."
            action={<button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Novo Lançamento</button>} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.slice(0, visibleCount).map(entry => (
              <div key={entry.id} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3) 0',
                borderBottom: '1px solid var(--border)',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: entry.type === 'entrada' ? 'var(--success-subtle)' : 'var(--danger-subtle)',
                }}>
                  {entry.type === 'entrada' ? <TrendingUp size={16} style={{ color: 'var(--income)' }} /> : <TrendingDown size={16} style={{ color: 'var(--expense)' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 'var(--fs-base)' }}>{entry.category}{entry.expenseClass && entry.type === 'saída' ? ` — ${entry.expenseClass}` : ''}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', display: 'flex', gap: 'var(--sp-3)' }}>
                    <span>{formatDate(entry.date)}</span>
                    <span>{entry.source}</span>
                  </div>
                </div>
                <span style={{ fontWeight: 600, color: entry.type === 'entrada' ? 'var(--income)' : 'var(--expense)' }}>
                  {entry.type === 'entrada' ? '+' : '-'}{formatCurrency(entry.amount)}
                </span>
                <button className="btn-icon btn-ghost" onClick={() => handleEdit(entry)}><Edit2 size={14} /></button>
                <button className="btn-icon btn-ghost" onClick={() => deleteItem('finance', entry.id)} style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
              </div>
            ))}
            {filtered.length > visibleCount && (
              <div style={{ padding: 'var(--sp-4)', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-secondary" onClick={() => setVisibleCount(v => v + 20)}>
                  Ver mais transações
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <Modal title={editing ? 'Editar Lançamento' : 'Novo Lançamento'} onClose={() => { setShowModal(false); setEditing(null); }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tipo *</label>
              <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value, category: '' })}>
                <option value="entrada">Entrada</option>
                <option value="saída">Saída</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Valor (R$) *</label>
              <input className="form-input" type="number" step="0.01" min="0" placeholder="0,00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} autoFocus />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Categoria *</label>
              <input className="form-input" list="finance-categories" placeholder="Ex: Marketing" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
              <datalist id="finance-categories">{currentCategories.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            {form.type === 'saída' && (
              <div className="form-group">
                <label className="form-label">Classificação do gasto</label>
                <select className="form-select" value={form.expenseClass} onChange={e => setForm({ ...form, expenseClass: e.target.value })}>
                  <option value="" disabled>Selecione...</option>
                  {expenseClasses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fonte / Atividade</label>
              <input className="form-input" list="finance-sources" placeholder="Ex: dropshipping" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} />
              <datalist id="finance-sources">{sources.map(s => <option key={s} value={s} />)}</datalist>
            </div>
            <div className="form-group">
              <label className="form-label">Data</label>
              <input className="form-input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Observações</label>
            <textarea className="form-textarea" placeholder="Notas opcionais..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEditing(null); }}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSubmit}>{editing ? 'Salvar' : 'Criar Lançamento'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
