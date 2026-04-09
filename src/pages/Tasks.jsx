import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import DateFilter from '../components/DateFilter';
import { Plus, CheckSquare, Search, Trash2, Edit2, Check, ChevronDown, Archive, RotateCcw, GripVertical } from 'lucide-react';
import { formatDate, priorityValue, getToday, isTaskCompleted, getTaskPeriodKey, isFutureTask } from '../utils/helpers';

const defaultTask = {
  title: '', description: '', priority: 'média', estimatedHours: '',
  status: 'pendente', dueDate: '', scheduledDate: '', category: '',
  recurrence: 'única', recurrenceDay: '',
};

const categories = ['Marketing', 'Conteúdo', 'Produto', 'Operações', 'Estratégia', 'Pessoal', 'Outro'];

export default function Tasks() {
  const { tasks, createItem, updateItem, updateBatch, deleteItem } = useApp();
  const location = useLocation();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultTask);
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('todas');
  const [filterStatus, setFilterStatus] = useState('todas');
  const [sortBy, setSortBy] = useState('manual');
  const [draggedId, setDraggedId] = useState(null);
  const [draggableTask, setDraggableTask] = useState(null);
  const [fastAdd, setFastAdd] = useState('');
  const [activeTab, setActiveTab] = useState('ativas');
  const [historyFilter, setHistoryFilter] = useState({ period: '30 dias', start: '', end: '' });

  useEffect(() => {
    if (location.state?.quickAdd) {
      setShowModal(true);
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  const filtered = useMemo(() => {
    let result = [...tasks];

    if (activeTab === 'ativas') {
      result = result.filter(t => t.status !== 'excluída' && !isTaskCompleted(t));
    } else {
      result = result.filter(t => t.status === 'excluída' || isTaskCompleted(t));
      
      // Data customizada no Histórico
      if (historyFilter.start && historyFilter.end) {
        result = result.filter(t => {
           let targetDate = t.deletedAt || t.completedAt;
           if (!targetDate && t.status === 'excluída') targetDate = t.createdAt; 
           if (!targetDate && isTaskCompleted(t)) {
             if (t.completedDates && t.completedDates.length > 0) {
               targetDate = t.completedDates[t.completedDates.length - 1];
             } else {
               targetDate = t.createdAt;
             }
           }
           if (!targetDate) return true;
           const dateStr = targetDate.substring(0, 10);
           return dateStr >= historyFilter.start && dateStr <= historyFilter.end;
        });
      }
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q));
    }
    if (filterPriority !== 'todas') result = result.filter(t => t.priority === filterPriority);
    
    if (activeTab === 'arquivo') {
       if (filterStatus === 'concluída') result = result.filter(t => isTaskCompleted(t) && t.status !== 'excluída');
       if (filterStatus === 'excluída') result = result.filter(t => t.status === 'excluída');
    } else {
       if (filterStatus !== 'todas') {
         result = result.filter(t => t.status === filterStatus);
       }
    }

    result.sort((a, b) => {
      if (sortBy === 'manual') return (a.order || 0) - (b.order || 0);
      if (sortBy === 'priority') return priorityValue(b.priority) - priorityValue(a.priority);
      if (sortBy === 'date') return (a.dueDate || '9999') > (b.dueDate || '9999') ? 1 : -1;
      if (sortBy === 'status') {
        const order = { pendente: 0, em_andamento: 1, concluída: 2, excluída: 3 };
        return (order[a.status] || 0) - (order[b.status] || 0);
      }
      return 0;
    });
    return result;
  }, [tasks, search, filterPriority, filterStatus, sortBy, activeTab, historyFilter]);

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    if (editing) {
      updateItem('tasks', editing, form);
    } else {
      createItem('tasks', form);
    }
    setShowModal(false);
    setEditing(null);
    setForm(defaultTask);
  };

  const handleEdit = (task) => {
    setForm({ ...task });
    setEditing(task.id);
    setShowModal(true);
  };

  const handleToggleComplete = (task) => {
    if (task.recurrence === 'diária' || task.recurrence === 'semanal') {
      const periodKey = getTaskPeriodKey(task);
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

  const handleDragStart = (e, task) => {
    setDraggedId(task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e, targetTask) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetTask.id) return;
    if (activeTab !== 'ativas') return;

    const sourceIndex = filtered.findIndex(t => t.id === draggedId);
    const targetIndex = filtered.findIndex(t => t.id === targetTask.id);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const newFiltered = [...filtered];
    const [moved] = newFiltered.splice(sourceIndex, 1);
    newFiltered.splice(targetIndex, 0, moved);

    const updates = newFiltered.map((t, index) => ({
      id: t.id,
      updates: { order: index }
    }));
    
    if (sortBy !== 'manual') setSortBy('manual');
    updateBatch('tasks', updates);
    setDraggedId(null);
  };

  const handleFastAdd = (e) => {
    if (e.key === 'Enter' && fastAdd.trim()) {
      createItem('tasks', { ...defaultTask, title: fastAdd.trim(), scheduledDate: getToday() });
      setFastAdd('');
    }
  };

  const statusLabel = { pendente: 'Pendente', em_andamento: 'Em Andamento', concluída: 'Concluída' };
  const statusColor = { pendente: 'var(--warning)', em_andamento: 'var(--info)', concluída: 'var(--success)' };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Tarefas</h1>
          <p>{tasks.filter(t => !isTaskCompleted(t)).length} pendentes · {tasks.filter(t => isTaskCompleted(t)).length} concluídas</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(defaultTask); setEditing(null); setShowModal(true); }}>
          <Plus size={16} /> Nova Tarefa
        </button>
      </div>

      <div className="tabs" style={{ marginBottom: 'var(--sp-6)' }}>
        <button className={`tab ${activeTab === 'ativas' ? 'active' : ''}`} onClick={() => { setActiveTab('ativas'); setFilterStatus('todas'); }}>
          <CheckSquare size={16} style={{ marginRight: 'var(--sp-2)' }} /> Ativas
        </button>
        <button className={`tab ${activeTab === 'arquivo' ? 'active' : ''}`} onClick={() => { setActiveTab('arquivo'); setFilterStatus('todas'); }}>
          <Archive size={16} style={{ marginRight: 'var(--sp-2)' }} /> Histórico
        </button>
      </div>

      {activeTab === 'arquivo' && (
        <DateFilter onChange={setHistoryFilter} />
      )}

      {/* Fast Add */}
      {activeTab === 'ativas' && (
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <div style={{ position: 'relative' }}>
            <Plus size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              className="form-input"
              placeholder="Adicionar tarefa rapidamente... (Enter para criar)"
              value={fastAdd}
              onChange={e => setFastAdd(e.target.value)}
              onKeyDown={handleFastAdd}
              style={{ paddingLeft: 36 }}
            />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input className="form-input" placeholder="Buscar tarefas..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 34 }} />
        </div>
        <select className="form-select" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="todas">Todas prioridades</option>
          <option value="alta">Alta</option>
          <option value="média">Média</option>
          <option value="baixa">Baixa</option>
        </select>
        <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="todas">{activeTab === 'arquivo' ? 'Todas' : 'Todos status'}</option>
          {activeTab === 'ativas' && (
            <>
              <option value="pendente">Pendente</option>
              <option value="em_andamento">Em Andamento</option>
            </>
          )}
          {activeTab === 'arquivo' && (
            <>
              <option value="concluída">Concluídas</option>
              <option value="excluída">Excluídas</option>
            </>
          )}
        </select>
        <select className="form-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="manual">Ordem Manual</option>
          <option value="priority">Prioridade</option>
          <option value="date">Data</option>
          <option value="status">Status</option>
        </select>
      </div>

      {/* Task List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="Nenhuma tarefa encontrada"
          description="Crie sua primeira tarefa para começar a organizar seu dia."
          action={<button className="btn btn-primary" onClick={() => { setForm(defaultTask); setShowModal(true); }}><Plus size={16} /> Nova Tarefa</button>}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {filtered.map(task => {
            const future = isFutureTask(task);
            return (
            <div
              key={task.id}
              className="card"
              draggable={activeTab === 'ativas' && draggableTask === task.id}
              onDragStart={e => handleDragStart(e, task)}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
              onDrop={e => handleDrop(e, task)}
              style={{
                padding: 'var(--sp-3) var(--sp-4)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-3)',
                opacity: task.status === 'concluída' ? 0.6 : (future ? 0.65 : 1),
                border: future ? '1px dashed var(--border)' : '1px solid var(--border)',
                background: future ? 'var(--bg-primary)' : 'var(--bg-elevated)',
                cursor: 'default',
              }}
            >
              {activeTab === 'ativas' && (
                <div 
                  style={{ cursor: 'grab', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={() => setDraggableTask(task.id)}
                  onMouseLeave={() => setDraggableTask(null)}
                >
                  <GripVertical size={16} />
                </div>
              )}
              <button
                className={`checkbox ${isTaskCompleted(task) ? 'checked' : ''}`}
                onClick={() => handleToggleComplete(task)}
              >
                {isTaskCompleted(task) && <Check size={14} color="white" />}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                  <span style={{
                    fontWeight: 500,
                    textDecoration: isTaskCompleted(task) || task.status === 'excluída' ? 'line-through' : 'none',
                    color: isTaskCompleted(task) || task.status === 'excluída' ? 'var(--text-tertiary)' : 'var(--text-primary)',
                  }}>
                    {task.title}
                  </span>
                  {task.recurrence === 'diária' && <span className="badge badge-accent">Diária</span>}
                  {task.recurrence === 'semanal' && <span className="badge badge-accent">Semanal</span>}
                  <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                  {task.category && <span className="badge badge-accent">{task.category}</span>}
                </div>
                <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-1)', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                  {task.dueDate && <span>Prazo: {formatDate(task.dueDate)}</span>}
                  {task.estimatedHours && <span>{task.estimatedHours}h estimadas</span>}
                  {task.status !== 'concluída' && task.status !== 'pendente' && task.status !== 'excluída' && (
                    <span style={{ color: statusColor[task.status] }}>{statusLabel[task.status]}</span>
                  )}
                  {task.status === 'excluída' && (
                    <span style={{ color: 'var(--danger)' }}>Excluída</span>
                  )}
                </div>
              </div>
              
              {activeTab === 'ativas' ? (
                <div style={{ display: 'flex', gap: 'var(--sp-1)' }}>
                  <button className="btn-icon btn-ghost" onClick={() => handleEdit(task)} title="Editar">
                    <Edit2 size={15} />
                  </button>
                  <button className="btn-icon btn-ghost" onClick={() => updateItem('tasks', task.id, { status: 'excluída', deletedAt: new Date().toISOString() })} title="Excluir" style={{ color: 'var(--text-tertiary)' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 'var(--sp-1)' }}>
                  <button className="btn-icon btn-ghost" onClick={() => updateItem('tasks', task.id, { status: 'pendente', completedAt: null, deletedAt: null, completedDates: [] })} title="Restaurar" style={{ color: 'var(--accent)' }}>
                    <RotateCcw size={15} />
                  </button>
                  <button className="btn-icon btn-ghost" onClick={() => deleteItem('tasks', task.id)} title="Excluir Permanentemente" style={{ color: 'var(--text-tertiary)' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <Modal title={editing ? 'Editar Tarefa' : 'Nova Tarefa'} onClose={() => { setShowModal(false); setEditing(null); }}>
          <div className="form-group">
            <label className="form-label">Título *</label>
            <input className="form-input" placeholder="O que precisa ser feito?" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <textarea className="form-textarea" placeholder="Detalhes opcionais..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Prioridade</label>
              <select className="form-select" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                <option value="baixa">Baixa</option>
                <option value="média">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            {(!form.recurrence || form.recurrence === 'única') && (
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="pendente">Pendente</option>
                  <option value="em_andamento">Em Andamento</option>
                  <option value="concluída">Concluída</option>
                </select>
              </div>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Frequência</label>
              <select className="form-select" value={form.recurrence || 'única'} onChange={e => setForm({ ...form, recurrence: e.target.value })}>
                <option value="única">Única</option>
                <option value="diária">Diária</option>
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
              </select>
            </div>
            {form.recurrence === 'semanal' && (
              <div className="form-group">
                <label className="form-label">Dia da Semana</label>
                <select className="form-select" value={form.recurrenceDay || ''} onChange={e => setForm({ ...form, recurrenceDay: e.target.value })}>
                  <option value="">Qualquer dia</option>
                  <option value="1">Segunda-feira</option>
                  <option value="2">Terça-feira</option>
                  <option value="3">Quarta-feira</option>
                  <option value="4">Quinta-feira</option>
                  <option value="5">Sexta-feira</option>
                  <option value="6">Sábado</option>
                  <option value="0">Domingo</option>
                </select>
              </div>
            )}
            {form.recurrence === 'mensal' && (
              <div className="form-group">
                <label className="form-label">Dia do Mês</label>
                <input 
                  type="number" 
                  min="1" 
                  max="31" 
                  className="form-input" 
                  placeholder="Ex: 15"
                  value={form.recurrenceDay || ''} 
                  onChange={e => setForm({ ...form, recurrenceDay: e.target.value })} 
                />
              </div>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Horas Estimadas</label>
              <input className="form-input" type="number" step="0.5" min="0" placeholder="Ex: 2" value={form.estimatedHours} onChange={e => setForm({ ...form, estimatedHours: parseFloat(e.target.value) || '' })} />
            </div>
            <div className="form-group">
              <label className="form-label">Categoria</label>
              <input className="form-input" list="task-categories" placeholder="Ex: Marketing" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
              <datalist id="task-categories">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Data Limite</label>
              <input className="form-input" type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Data Agendada</label>
              <input className="form-input" type="date" value={form.scheduledDate} onChange={e => setForm({ ...form, scheduledDate: e.target.value })} />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEditing(null); }}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSubmit}>{editing ? 'Salvar' : 'Criar Tarefa'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
