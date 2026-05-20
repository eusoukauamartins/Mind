import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import DateFilter from '../components/DateFilter';
import { Plus, CheckSquare, Search, Trash2, Edit2, Check, Archive, RotateCcw, GripVertical, Repeat, Zap, CalendarClock, Clock } from 'lucide-react';
import { formatDate, priorityValue, getToday, isTaskCompleted, getTaskPeriodKey, isFutureTask, DAY_NAMES_FULL } from '../utils/helpers';

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Seg → Dom
const WEEKDAY_LABELS = { 0: 'Domingo', 1: 'Segunda-feira', 2: 'Terça-feira', 3: 'Quarta-feira', 4: 'Quinta-feira', 5: 'Sexta-feira', 6: 'Sábado' };

const defaultTask = {
  title: '', description: '', priority: 'média', estimatedHours: '',
  status: 'pendente', dueDate: '', scheduledDate: '', category: '',
  recurrence: 'única', recurrenceDay: '',
};

const categories = ['Marketing', 'Conteúdo', 'Produto', 'Operações', 'Estratégia', 'Pessoal', 'Outro'];

// Reusable task card component
function TaskCard({ task, onToggle, onEdit, onDelete, onDragStart, onDragOver, onDrop, draggableId, setDraggableId, draggedId, isArchive }) {
  const completed = isTaskCompleted(task);
  const statusLabel = { pendente: 'Pendente', em_andamento: 'Em Andamento', concluída: 'Concluída' };
  const statusColor = { pendente: 'var(--warning)', em_andamento: 'var(--info)', concluída: 'var(--success)' };

  return (
    <div
      className={`task-card ${draggedId === task.id ? 'task-card--dragging' : ''}`}
      draggable={!isArchive && draggableId === task.id}
      onDragStart={e => onDragStart?.(e, task)}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
      onDrop={e => onDrop?.(e, task)}
    >
      {!isArchive && (
        <div
          style={{ cursor: 'grab', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
          onMouseEnter={() => setDraggableId?.(task.id)}
          onMouseLeave={() => setDraggableId?.(null)}
        >
          <GripVertical size={14} />
        </div>
      )}
      <button
        className={`checkbox ${completed ? 'checked' : ''}`}
        onClick={() => onToggle(task)}
        style={{ flexShrink: 0 }}
      >
        {completed && <Check size={12} color="white" />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)', flexWrap: 'wrap' }}>
          <span style={{
            fontWeight: 500, fontSize: 'var(--fs-sm)',
            textDecoration: completed || task.status === 'excluída' ? 'line-through' : 'none',
            color: completed || task.status === 'excluída' ? 'var(--text-tertiary)' : 'var(--text-primary)',
          }}>
            {task.title}
          </span>
          <span className={`badge badge-${task.priority}`} style={{ fontSize: '10px', padding: '1px 6px' }}>{task.priority}</span>
          {task.category && <span className="badge badge-accent" style={{ fontSize: '10px', padding: '1px 6px' }}>{task.category}</span>}
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: '2px', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
          {task.dueDate && <span>Prazo: {formatDate(task.dueDate)}</span>}
          {task.scheduledDate && <span>Agendada: {formatDate(task.scheduledDate)}</span>}
          {task.estimatedHours && <span>{task.estimatedHours}h</span>}
          {task.status === 'em_andamento' && <span style={{ color: statusColor.em_andamento }}>{statusLabel.em_andamento}</span>}
          {task.status === 'excluída' && <span style={{ color: 'var(--danger)' }}>Excluída</span>}
          {task.recurrence === 'semanal' && <span style={{ color: 'var(--accent)' }}>Semanal</span>}
          {task.recurrence === 'mensal' && <span style={{ color: 'var(--accent)' }}>Mensal</span>}
        </div>
      </div>
      {isArchive ? (
        <div style={{ display: 'flex', gap: 'var(--sp-1)', flexShrink: 0 }}>
          <button className="btn-icon btn-ghost" onClick={() => onEdit(task)} title="Restaurar" style={{ color: 'var(--accent)' }}>
            <RotateCcw size={14} />
          </button>
          <button className="btn-icon btn-ghost" onClick={() => onDelete(task.id)} title="Excluir Permanentemente" style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
            <Trash2 size={14} />
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 'var(--sp-1)', flexShrink: 0 }}>
          <button className="btn-icon btn-ghost" onClick={() => onEdit(task)} title="Editar">
            <Edit2 size={14} />
          </button>
          <button className="btn-icon btn-ghost" onClick={() => onDelete(task)} title="Excluir" style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// Standard task column component (for Pendentes and Agendadas)
function TaskColumn({ title, icon: Icon, tasks, modifier, onToggle, onEdit, onDelete, onDragStart, onDragOver, onDrop, draggableId, setDraggableId, draggedId }) {
  return (
    <div className={`task-column ${modifier || ''}`}>
      <div className="task-column-header">
        <h3><Icon size={15} /> {title}</h3>
        <span className="task-column-count">{tasks.length}</span>
      </div>
      <div className="task-column-body">
        {tasks.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', textAlign: 'center', padding: 'var(--sp-6) 0' }}>
            Nenhuma tarefa
          </p>
        ) : (
          tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              draggableId={draggableId}
              setDraggableId={setDraggableId}
              draggedId={draggedId}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Routine column — daily + weekly tasks with internal sections
function RoutineColumn({ dailyTasks, weeklyByDay, todayWeekday, onToggle, onEdit, onDelete, onDragStart, onDrop, draggableId, setDraggableId, draggedId }) {
  const totalCount = dailyTasks.length + Object.values(weeklyByDay).reduce((s, arr) => s + arr.length, 0);

  // Order weekdays: today first, then the rest in order
  const orderedDays = WEEKDAY_ORDER.filter(d => weeklyByDay[d]?.length > 0);
  const todayDays = orderedDays.filter(d => d === todayWeekday);
  const otherDays = orderedDays.filter(d => d !== todayWeekday);
  const sortedDays = [...todayDays, ...otherDays];

  const renderCards = (tasks) => tasks.map(task => (
    <TaskCard
      key={task.id}
      task={task}
      onToggle={onToggle}
      onEdit={onEdit}
      onDelete={onDelete}
      onDragStart={onDragStart}
      onDrop={onDrop}
      draggableId={draggableId}
      setDraggableId={setDraggableId}
      draggedId={draggedId}
    />
  ));

  return (
    <div className="task-column task-column--daily">
      <div className="task-column-header">
        <h3><Repeat size={15} /> Rotina do Dia</h3>
        <span className="task-column-count">{totalCount}</span>
      </div>
      <div className="task-column-body">
        {totalCount === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', textAlign: 'center', padding: 'var(--sp-6) 0' }}>
            Nenhuma tarefa de rotina
          </p>
        ) : (
          <>
            {/* Section A — Daily */}
            {dailyTasks.length > 0 && (
              <>
                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent)', marginBottom: 'var(--sp-1)', marginTop: 'var(--sp-1)' }}>
                  Diárias
                </div>
                {renderCards(dailyTasks)}
              </>
            )}

            {/* Section B — Weekly by weekday */}
            {sortedDays.map(day => (
              <div key={day}>
                {(dailyTasks.length > 0 || sortedDays.indexOf(day) > 0) && (
                  <div style={{ height: 1, background: 'var(--border-soft)', margin: 'var(--sp-3) 0', opacity: 0.6 }} />
                )}
                <div style={{
                  fontSize: 'var(--fs-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                  color: day === todayWeekday ? 'var(--accent)' : 'var(--text-tertiary)',
                  marginBottom: 'var(--sp-1)',
                  display: 'flex', alignItems: 'center', gap: 'var(--sp-2)',
                }}>
                  {WEEKDAY_LABELS[day]}
                  {day === todayWeekday && (
                    <span style={{ fontSize: '9px', background: 'var(--accent)', color: '#ffffff', padding: '1px 6px', borderRadius: 'var(--radius-full)', fontWeight: 700 }}>HOJE</span>
                  )}
                </div>
                {renderCards(weeklyByDay[day])}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

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

  // Get all active tasks (non-completed, non-deleted)
  const activeTasks = useMemo(() => {
    let result = tasks.filter(t => t.status !== 'excluída' && !isTaskCompleted(t));

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q));
    }
    if (filterPriority !== 'todas') result = result.filter(t => t.priority === filterPriority);
    if (filterStatus !== 'todas') result = result.filter(t => t.status === filterStatus);

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
  }, [tasks, search, filterPriority, filterStatus, sortBy]);

  // Split active tasks into 3 columns
  const dailyTasks = useMemo(() => activeTasks.filter(t => t.recurrence === 'diária'), [activeTasks]);
  const weeklyTasks = useMemo(() => activeTasks.filter(t => t.recurrence === 'semanal'), [activeTasks]);
  const scheduledTasks = useMemo(() => activeTasks.filter(t => t.recurrence !== 'diária' && t.recurrence !== 'semanal' && isFutureTask(t)), [activeTasks]);
  const pendingTasks = useMemo(() => activeTasks.filter(t => t.recurrence !== 'diária' && t.recurrence !== 'semanal' && !isFutureTask(t)), [activeTasks]);

  // Group weekly tasks by weekday
  const todayWeekday = new Date().getDay();
  const weeklyByDay = useMemo(() => {
    const groups = {};
    weeklyTasks.forEach(t => {
      const day = t.recurrenceDay !== undefined && t.recurrenceDay !== '' ? Number(t.recurrenceDay) : todayWeekday;
      if (!groups[day]) groups[day] = [];
      groups[day].push(t);
    });
    return groups;
  }, [weeklyTasks, todayWeekday]);

  // All routine tasks for drag handler scope
  const allRoutineTasks = useMemo(() => [...dailyTasks, ...weeklyTasks], [dailyTasks, weeklyTasks]);

  // Archive list
  const archivedTasks = useMemo(() => {
    let result = tasks.filter(t => t.status === 'excluída' || isTaskCompleted(t));

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

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q));
    }
    if (filterPriority !== 'todas') result = result.filter(t => t.priority === filterPriority);
    if (filterStatus === 'concluída') result = result.filter(t => isTaskCompleted(t) && t.status !== 'excluída');
    if (filterStatus === 'excluída') result = result.filter(t => t.status === 'excluída');

    return result;
  }, [tasks, historyFilter, search, filterPriority, filterStatus]);

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

  const handleSoftDelete = (task) => {
    updateItem('tasks', task.id, { status: 'excluída', deletedAt: new Date().toISOString() });
  };

  const handleRestore = (task) => {
    updateItem('tasks', task.id, { status: 'pendente', completedAt: null, deletedAt: null, completedDates: [] });
  };

  // Drag and drop within a column list
  const makeDragHandlers = (columnTasks) => ({
    onDragStart: (e, task) => {
      setDraggedId(task.id);
      e.dataTransfer.effectAllowed = 'move';
    },
    onDrop: (e, targetTask) => {
      e.preventDefault();
      if (!draggedId || draggedId === targetTask.id) return;

      const sourceIndex = columnTasks.findIndex(t => t.id === draggedId);
      const targetIndex = columnTasks.findIndex(t => t.id === targetTask.id);
      if (sourceIndex === -1 || targetIndex === -1) return;

      const newList = [...columnTasks];
      const [moved] = newList.splice(sourceIndex, 1);
      newList.splice(targetIndex, 0, moved);

      const updates = newList.map((t, index) => ({
        id: t.id,
        updates: { order: index }
      }));

      if (sortBy !== 'manual') setSortBy('manual');
      updateBatch('tasks', updates);
      setDraggedId(null);
    },
  });

  const handleFastAdd = (e) => {
    if (e.key === 'Enter' && fastAdd.trim()) {
      createItem('tasks', { ...defaultTask, title: fastAdd.trim(), scheduledDate: getToday() });
      setFastAdd('');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Tarefas</h1>
          <p>{tasks.filter(t => !isTaskCompleted(t) && t.status !== 'excluída').length} pendentes · {tasks.filter(t => isTaskCompleted(t)).length} concluídas</p>
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
        {activeTab === 'ativas' && (
          <>
            <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="todas">Todos status</option>
              <option value="pendente">Pendente</option>
              <option value="em_andamento">Em Andamento</option>
            </select>
            <select className="form-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="manual">Ordem Manual</option>
              <option value="priority">Prioridade</option>
              <option value="date">Data</option>
              <option value="status">Status</option>
            </select>
          </>
        )}
        {activeTab === 'arquivo' && (
          <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="todas">Todas</option>
            <option value="concluída">Concluídas</option>
            <option value="excluída">Excluídas</option>
          </select>
        )}
      </div>

      {/* ===== ACTIVE: 3-Column Layout ===== */}
      {activeTab === 'ativas' && (
        activeTasks.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="Nenhuma tarefa encontrada"
            description="Crie sua primeira tarefa para começar a organizar seu dia."
            action={<button className="btn btn-primary" onClick={() => { setForm(defaultTask); setShowModal(true); }}><Plus size={16} /> Nova Tarefa</button>}
          />
        ) : (
          <div className="tasks-columns">
            <RoutineColumn
              dailyTasks={dailyTasks}
              weeklyByDay={weeklyByDay}
              todayWeekday={todayWeekday}
              onToggle={handleToggleComplete}
              onEdit={handleEdit}
              onDelete={handleSoftDelete}
              {...makeDragHandlers(allRoutineTasks)}
              draggableId={draggableTask}
              setDraggableId={setDraggableTask}
              draggedId={draggedId}
            />
            <TaskColumn
              title="Pendentes"
              icon={Clock}
              tasks={pendingTasks}
              onToggle={handleToggleComplete}
              onEdit={handleEdit}
              onDelete={handleSoftDelete}
              {...makeDragHandlers(pendingTasks)}
              draggableId={draggableTask}
              setDraggableId={setDraggableTask}
              draggedId={draggedId}
            />
            <TaskColumn
              title="Tarefas Agendadas"
              icon={CalendarClock}
              tasks={scheduledTasks}
              modifier="task-column--scheduled"
              onToggle={handleToggleComplete}
              onEdit={handleEdit}
              onDelete={handleSoftDelete}
              {...makeDragHandlers(scheduledTasks)}
              draggableId={draggableTask}
              setDraggableId={setDraggableTask}
              draggedId={draggedId}
            />
          </div>
        )
      )}

      {/* ===== ARCHIVE: Single list ===== */}
      {activeTab === 'arquivo' && (
        archivedTasks.length === 0 ? (
          <EmptyState
            icon={Archive}
            title="Nenhum registro encontrado"
            description="Tarefas concluídas e excluídas aparecerão aqui."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {archivedTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={handleToggleComplete}
                onEdit={handleRestore}
                onDelete={(id) => deleteItem('tasks', typeof id === 'string' ? id : id)}
                isArchive
              />
            ))}
          </div>
        )
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
