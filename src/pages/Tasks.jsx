import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import DateFilter from '../components/DateFilter';
import { Plus, CheckSquare, Search, Trash2, Edit2, Check, Archive, RotateCcw, GripVertical, Repeat, Zap, CalendarClock, Clock, Bell, ChevronDown, ChevronRight } from 'lucide-react';
import {
  formatDate,
  priorityValue,
  getToday,
  isTaskCompleted,
  getTaskPeriodKey,
  isRoutineTask,
  convertZonedToUTCISO,
  getCalendarDayDiff,
  getTaskExecutionDate,
  isTaskLongTermScheduled,
  isTaskInPendingWindow,
  getRollingNextDays,
  getUpcomingWeekdayDate,
  DAY_NAMES_FULL
} from '../utils/helpers';

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Seg → Dom
const WEEKDAY_LABELS = { 0: 'Domingo', 1: 'Segunda-feira', 2: 'Terça-feira', 3: 'Quarta-feira', 4: 'Quinta-feira', 5: 'Sexta-feira', 6: 'Sábado' };

const defaultTask = {
  title: '', description: '', priority: 'média', estimatedHours: '',
  taskType: 'task',
  status: 'pendente', dueDate: '', dueTime: '', scheduledDate: '', category: '',
  recurrence: 'única', recurrenceDay: '',
  reminderEnabled: false, reminderAt: '', timezone: 'America/Sao_Paulo'
};

const categories = ['Marketing', 'Conteúdo', 'Produto', 'Operações', 'Estratégia', 'Pessoal', 'Outro'];

// Reusable task card component
function TaskCard({ task, onToggle, onEdit, onDelete, onDragStart, onDragOver, onDrop, draggableId, setDraggableId, draggedId, isArchive, variant }) {
  const completed = isTaskCompleted(task);
  const statusLabel = { pendente: 'Pendente', em_andamento: 'Em Andamento', concluída: 'Concluída' };
  const statusColor = { pendente: 'var(--warning)', em_andamento: 'var(--info)', concluída: 'var(--success)' };
  const variantClass = variant ? `task-card--${variant}` : '';

  return (
    <div
      className={`task-card ${variantClass} ${draggedId === task.id ? 'task-card--dragging' : ''}`}
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
          {task.dueDate && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              Prazo: {formatDate(task.dueDate)}{task.dueTime ? ` às ${task.dueTime}` : ''}
              {task.reminderEnabled && (
                <Bell size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} title="Lembrete ativado" />
              )}
            </span>
          )}
          {task.scheduledDate && <span>Agendada: {formatDate(task.scheduledDate)}</span>}
          {task.estimatedHours && <span>{task.estimatedHours}h</span>}
          {task.status === 'em_andamento' && <span style={{ color: statusColor.em_andamento }}>{statusLabel.em_andamento}</span>}
          {task.status === 'excluída' && <span style={{ color: 'var(--danger)' }}>Excluída</span>}
          {task.recurrence === 'semanal' && (
            <span style={{ color: variant === 'routine-other' ? 'var(--text-tertiary)' : 'var(--accent)' }}>
              Semanal{task.recurrenceDay !== undefined && task.recurrenceDay !== '' ? ` (${WEEKDAY_LABELS[task.recurrenceDay]?.split('-')[0]})` : ''}
            </span>
          )}
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

// Standard task column component (for Tarefas Agendadas)
function TaskColumn({ title, icon: Icon, tasks, modifier, emptyMessage, onToggle, onEdit, onDelete, onDragStart, onDragOver, onDrop, draggableId, setDraggableId, draggedId, variant }) {
  return (
    <div className={`task-column ${modifier || ''}`}>
      <div className="task-column-header">
        <h3><Icon size={15} /> {title}</h3>
        <span className="task-column-count">{tasks.length}</span>
      </div>
      <div className="task-column-body">
        {tasks.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', textAlign: 'center', padding: 'var(--sp-6) 0' }}>
            {emptyMessage || 'Nenhuma tarefa'}
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
              variant={variant}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Pending Planner column — weekly planner with Overdue, Rolling 7-day groups, and No-Date groups
function PendingPlannerColumn({
  overdueTasks,
  pendingByDate,
  noDateTasks,
  rollingDays,
  totalCount,
  onToggle,
  onEdit,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  draggableId,
  setDraggableId,
  draggedId
}) {
  const [collapsedSections, setCollapsedSections] = useState(() => {
    try {
      const saved = localStorage.getItem('cp_tasks_pending_collapsed_groups');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}

    // Default collapsed state:
    // ATRASADAS: expanded (false)
    // HOJE (day 0): expanded (false)
    // Future days (days 1..7): collapsed by default (true)
    // SEM PRAZO: expanded (false)
    const initial = {
      atrasadas: false,
      sem_prazo: false
    };
    rollingDays.forEach(d => {
      if (!d.isToday) {
        initial[d.dateStr] = true;
      } else {
        initial[d.dateStr] = false;
      }
    });
    return initial;
  });

  const toggleSection = (key) => {
    setCollapsedSections(prev => {
      const updated = {
        ...prev,
        [key]: !prev[key]
      };
      try {
        localStorage.setItem('cp_tasks_pending_collapsed_groups', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const renderCards = (tasks, variant) => tasks.map(task => (
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
      variant={variant}
    />
  ));

  return (
    <div className="task-column task-column--pending">
      <div className="task-column-header">
        <h3><Clock size={15} /> Pendentes</h3>
        <span className="task-column-count">{totalCount}</span>
      </div>
      <div className="task-column-body">
        {totalCount === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)', textAlign: 'center', padding: 'var(--sp-6) 0' }}>
            Nenhuma tarefa pendente
          </p>
        ) : (
          <>
            {/* 1. Group: ATRASADAS */}
            {overdueTasks.length > 0 && (
              <div style={{ marginBottom: 'var(--sp-2)' }}>
                <div
                  onClick={() => toggleSection('atrasadas')}
                  style={{
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--danger)',
                    marginBottom: 'var(--sp-1)',
                    marginTop: 'var(--sp-1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none',
                    padding: '4px 6px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--danger-subtle)'
                  }}
                  onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                  onMouseLeave={e => e.currentTarget.style.filter = 'none'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {collapsedSections['atrasadas'] ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                    <span>Atrasadas</span>
                  </div>
                  <span style={{ fontSize: '10px', background: 'var(--danger)', color: '#ffffff', padding: '1px 6px', borderRadius: 'var(--radius-full)', fontWeight: 700 }}>
                    {overdueTasks.length}
                  </span>
                </div>
                {!collapsedSections['atrasadas'] && renderCards(overdueTasks, "pending-overdue")}
              </div>
            )}

            {/* 2. Groups: Rolling 7 Days */}
            {rollingDays.map(day => {
              const dayTasks = pendingByDate[day.dateStr] || [];
              const isCollapsed = Boolean(collapsedSections[day.dateStr]);
              const isToday = day.isToday;

              return (
                <div key={day.dateStr} style={{ marginBottom: 'var(--sp-2)' }}>
                  {(overdueTasks.length > 0 || day.offset > 0) && (
                    <div style={{ height: 1, background: 'var(--border-soft)', margin: 'var(--sp-2) 0', opacity: 0.6 }} />
                  )}
                  <div
                    onClick={() => toggleSection(day.dateStr)}
                    style={{
                      fontSize: 'var(--fs-xs)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: isToday ? 'var(--accent)' : 'var(--text-secondary)',
                      marginBottom: 'var(--sp-1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none',
                      padding: '3px 6px',
                      borderRadius: 'var(--radius-sm)'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                      <span>{WEEKDAY_LABELS[day.weekday]}</span>
                      <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'none' }}>
                        {formatDate(day.dateStr)}
                      </span>
                      {isToday && (
                        <span style={{ fontSize: '9px', background: 'var(--accent)', color: '#ffffff', padding: '1px 6px', borderRadius: 'var(--radius-full)', fontWeight: 700 }}>
                          HOJE
                        </span>
                      )}
                    </div>
                    <span style={{
                      fontSize: '10px',
                      background: dayTasks.length > 0 ? (isToday ? 'var(--accent-subtle)' : 'var(--bg-tertiary)') : 'transparent',
                      color: dayTasks.length > 0 ? (isToday ? 'var(--accent)' : 'var(--text-primary)') : 'var(--text-tertiary)',
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-full)',
                      fontWeight: dayTasks.length > 0 ? 600 : 400
                    }}>
                      {dayTasks.length}
                    </span>
                  </div>
                  {!isCollapsed && (
                    dayTasks.length === 0 ? (
                      <p style={{ color: 'var(--text-tertiary)', fontSize: '11px', padding: '4px 8px', fontStyle: 'italic' }}>
                        Nenhuma tarefa planejada
                      </p>
                    ) : (
                      renderCards(dayTasks, isToday ? "pending-today" : "pending-day")
                    )
                  )}
                </div>
              );
            })}

            {/* 3. Group: SEM PRAZO */}
            {noDateTasks.length > 0 && (
              <div style={{ marginBottom: 'var(--sp-2)' }}>
                <div style={{ height: 1, background: 'var(--border-soft)', margin: 'var(--sp-2) 0', opacity: 0.6 }} />
                <div
                  onClick={() => toggleSection('sem_prazo')}
                  style={{
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-tertiary)',
                    marginBottom: 'var(--sp-1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none',
                    padding: '3px 6px',
                    borderRadius: 'var(--radius-sm)'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {collapsedSections['sem_prazo'] ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                    <span>Sem Prazo</span>
                  </div>
                  <span style={{ fontSize: '10px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '1px 6px', borderRadius: 'var(--radius-full)' }}>
                    {noDateTasks.length}
                  </span>
                </div>
                {!collapsedSections['sem_prazo'] && renderCards(noDateTasks, "pending-nodate")}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Routine column — daily + weekly tasks with internal collapsible sections
function RoutineColumn({ dailyTasks, weeklyByDay, todayWeekday, onToggle, onEdit, onDelete, onDragStart, onDrop, draggableId, setDraggableId, draggedId }) {
  const [collapsedSections, setCollapsedSections] = useState(() => {
    // Keep other days collapsed by default, today & daily expanded
    const initial = {};
    WEEKDAY_ORDER.forEach(d => {
      if (d !== todayWeekday) initial[d] = true;
    });
    return initial;
  });

  const toggleSection = (key) => {
    setCollapsedSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const totalCount = dailyTasks.length + Object.values(weeklyByDay).reduce((s, arr) => s + arr.length, 0);

  // Order weekdays: today first, then the rest in order
  const orderedDays = WEEKDAY_ORDER.filter(d => weeklyByDay[d]?.length > 0);
  const todayDays = orderedDays.filter(d => d === todayWeekday);
  const otherDays = orderedDays.filter(d => d !== todayWeekday);
  const sortedDays = [...todayDays, ...otherDays];

  const renderCards = (tasks, variant) => tasks.map(task => (
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
      variant={variant}
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
              <div style={{ marginBottom: 'var(--sp-2)' }}>
                <div 
                  onClick={() => toggleSection('daily')}
                  style={{
                    fontSize: 'var(--fs-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                    color: 'var(--accent)', marginBottom: 'var(--sp-1)', marginTop: 'var(--sp-1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
                    userSelect: 'none', padding: '3px 6px', borderRadius: 'var(--radius-sm)'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {collapsedSections['daily'] ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                    <span>Diárias</span>
                  </div>
                  <span style={{ fontSize: '10px', background: 'var(--accent-subtle)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 'var(--radius-full)' }}>
                    {dailyTasks.length}
                  </span>
                </div>
                {!collapsedSections['daily'] && renderCards(dailyTasks, "routine-today")}
              </div>
            )}

            {/* Section B — Weekly by weekday */}
            {sortedDays.map(day => {
              const isTodayDay = day === todayWeekday;
              const isCollapsed = Boolean(collapsedSections[day]);
              const dayTasks = weeklyByDay[day] || [];

              return (
                <div key={day} style={{ marginBottom: 'var(--sp-2)' }}>
                  {(dailyTasks.length > 0 || sortedDays.indexOf(day) > 0) && (
                    <div style={{ height: 1, background: 'var(--border-soft)', margin: 'var(--sp-2) 0', opacity: 0.6 }} />
                  )}
                  <div 
                    onClick={() => toggleSection(day)}
                    style={{
                      fontSize: 'var(--fs-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                      color: isTodayDay ? 'var(--accent)' : 'var(--text-tertiary)',
                      marginBottom: 'var(--sp-1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
                      userSelect: 'none', padding: '3px 6px', borderRadius: 'var(--radius-sm)'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                      <span>{WEEKDAY_LABELS[day]}</span>
                      {isTodayDay && (
                        <span style={{ fontSize: '9px', background: 'var(--accent)', color: '#ffffff', padding: '1px 6px', borderRadius: 'var(--radius-full)', fontWeight: 700 }}>HOJE</span>
                      )}
                    </div>
                    <span style={{ fontSize: '10px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '1px 6px', borderRadius: 'var(--radius-full)' }}>
                      {dayTasks.length}
                    </span>
                  </div>
                  {!isCollapsed && renderCards(dayTasks, isTodayDay ? "routine-today" : "routine-other")}
                </div>
              );
            })}
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

  const todayStr = getToday();
  const todayWeekday = new Date().getDay();
  const tomorrowStr = useMemo(() => {
    const [y, m, d] = todayStr.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    return next.toISOString().substring(0, 10);
  }, [todayStr]);
  const rollingDays = useMemo(() => getRollingNextDays(7, todayStr), [todayStr]);

  // Split active tasks into Routine vs Ordinary (Scheduled / Pending)
  const routineTasks = useMemo(() => activeTasks.filter(t => isRoutineTask(t)), [activeTasks]);
  const dailyTasks = useMemo(() => routineTasks.filter(t => t.recurrence === 'diária' || (!t.recurrence && !t.recurrenceDay)), [routineTasks]);
  const weeklyTasks = useMemo(() => routineTasks.filter(t => t.recurrence === 'semanal'), [routineTasks]);

  const ordinaryTasks = useMemo(() => activeTasks.filter(t => !routineTasks.includes(t)), [activeTasks, routineTasks]);
  
  // 1. Long term scheduled: ordinary tasks with relevant date >= 8 days ahead
  const scheduledTasks = useMemo(() => ordinaryTasks.filter(t => isTaskLongTermScheduled(t, todayStr)), [ordinaryTasks, todayStr]);

  // 2. Pending weekly planner tasks: overdue, rolling 0..7 days, or no date
  const pendingTasks = useMemo(() => ordinaryTasks.filter(t => isTaskInPendingWindow(t, todayStr)), [ordinaryTasks, todayStr]);

  // Sub-groups for pending weekly planner
  const overdueTasks = useMemo(() => {
    return pendingTasks.filter(t => {
      const target = getTaskExecutionDate(t);
      if (!target) return false;
      const diff = getCalendarDayDiff(target, todayStr);
      return diff !== null && diff < 0;
    });
  }, [pendingTasks, todayStr]);

  const pendingByDate = useMemo(() => {
    const map = {};
    rollingDays.forEach(d => { map[d.dateStr] = []; });

    pendingTasks.forEach(t => {
      const target = getTaskExecutionDate(t);
      if (!target) return;
      const diff = getCalendarDayDiff(target, todayStr);
      if (diff !== null && diff >= 0 && diff <= 7) {
        if (!map[target]) map[target] = [];
        map[target].push(t);
      }
    });
    return map;
  }, [pendingTasks, rollingDays, todayStr]);

  const noDateTasks = useMemo(() => {
    return pendingTasks.filter(t => !getTaskExecutionDate(t));
  }, [pendingTasks]);

  // Group weekly tasks by weekday
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

    const taskPayload = { ...form };

    // Validate reminder settings
    if (taskPayload.reminderEnabled) {
      if (!taskPayload.dueDate) {
        alert('A data limite é obrigatória quando o lembrete está ativado.');
        return;
      }
      if (!taskPayload.dueTime) {
        alert('A hora de vencimento é obrigatória quando o lembrete está ativado.');
        return;
      }
      taskPayload.reminderAt = convertZonedToUTCISO(
        taskPayload.dueDate,
        taskPayload.dueTime,
        taskPayload.timezone || 'America/Sao_Paulo'
      );
    } else {
      taskPayload.reminderAt = '';
    }

    if (editing) {
      updateItem('tasks', editing, taskPayload);
    } else {
      createItem('tasks', taskPayload);
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
    if (task.recurrence === 'diária' || task.recurrence === 'semanal' || task.recurrence === 'mensal') {
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
            <PendingPlannerColumn
              overdueTasks={overdueTasks}
              pendingByDate={pendingByDate}
              noDateTasks={noDateTasks}
              rollingDays={rollingDays}
              totalCount={pendingTasks.length}
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
              emptyMessage="Nenhuma tarefa agendada (> 7 dias)"
              onToggle={handleToggleComplete}
              onEdit={handleEdit}
              onDelete={handleSoftDelete}
              {...makeDragHandlers(scheduledTasks)}
              draggableId={draggableTask}
              setDraggableId={setDraggableTask}
              draggedId={draggedId}
              variant="scheduled"
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
            <label className="form-label">Tipo de Item</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)' }}>
              <button
                type="button"
                className={`btn ${form.taskType !== 'routine' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setForm({ ...form, taskType: 'task', recurrence: form.recurrence === 'diária' ? 'única' : (form.recurrence || 'única') })}
                style={{ justifyContent: 'center', fontSize: 'var(--fs-sm)', padding: '8px' }}
              >
                <CheckSquare size={14} /> Tarefa
              </button>
              <button
                type="button"
                className={`btn ${form.taskType === 'routine' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setForm({ ...form, taskType: 'routine', recurrence: (form.recurrence === 'única' || !form.recurrence) ? 'diária' : form.recurrence })}
                style={{ justifyContent: 'center', fontSize: 'var(--fs-sm)', padding: '8px' }}
              >
                <Repeat size={14} /> Rotina
              </button>
            </div>
          </div>
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
          {/* Quick Date Selector for Ordinary Tasks */}
          {form.taskType !== 'routine' && (
            <div className="form-group" style={{ background: 'var(--bg-tertiary)', padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-soft)', marginBottom: 'var(--sp-4)' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Quando pretende fazer? (Data Agendada)</span>
                {form.scheduledDate ? (
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent)', fontWeight: 600 }}>
                    {formatDate(form.scheduledDate)}
                  </span>
                ) : (
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                    Sem agendamento
                  </span>
                )}
              </label>

              {/* Quick shortcuts: Sem agendamento, Hoje, Amanhã */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                <button
                  type="button"
                  className={`btn ${!form.scheduledDate ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  style={{ padding: '4px 10px', fontSize: '11px', borderRadius: 'var(--radius-sm)' }}
                  onClick={() => setForm(prev => ({ ...prev, scheduledDate: '' }))}
                >
                  Sem agendamento
                </button>
                <button
                  type="button"
                  className={`btn ${form.scheduledDate === todayStr ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  style={{ padding: '4px 10px', fontSize: '11px', borderRadius: 'var(--radius-sm)' }}
                  onClick={() => setForm(prev => ({ ...prev, scheduledDate: todayStr }))}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  className={`btn ${form.scheduledDate === tomorrowStr ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  style={{ padding: '4px 10px', fontSize: '11px', borderRadius: 'var(--radius-sm)' }}
                  onClick={() => setForm(prev => ({ ...prev, scheduledDate: tomorrowStr }))}
                >
                  Amanhã
                </button>
              </div>

              {/* Weekday shortcut buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px' }}>
                {[
                  { label: 'Seg', day: 1 },
                  { label: 'Ter', day: 2 },
                  { label: 'Qua', day: 3 },
                  { label: 'Qui', day: 4 },
                  { label: 'Sex', day: 5 },
                  { label: 'Sáb', day: 6 },
                  { label: 'Dom', day: 0 }
                ].map(w => {
                  const targetDate = getUpcomingWeekdayDate(w.day, todayStr);
                  const isSelected = form.scheduledDate === targetDate;
                  const isTodayWeekday = w.day === todayWeekday;
                  return (
                    <button
                      key={w.day}
                      type="button"
                      className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      style={{
                        padding: '4px 2px',
                        fontSize: '11px',
                        fontWeight: isTodayWeekday ? 700 : 500,
                        justifyContent: 'center',
                        borderRadius: 'var(--radius-sm)',
                        border: isTodayWeekday && !isSelected ? '1px solid var(--accent)' : undefined
                      }}
                      title={`${w.label} (${formatDate(targetDate)})`}
                      onClick={() => setForm(prev => ({ ...prev, scheduledDate: targetDate }))}
                    >
                      {w.label}
                    </button>
                  );
                })}
              </div>

              {/* Specific Date input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  Data específica:
                </span>
                <input
                  className="form-input"
                  type="date"
                  value={form.scheduledDate || ''}
                  onChange={e => setForm(prev => ({ ...prev, scheduledDate: e.target.value }))}
                  style={{ flex: 1, fontSize: 'var(--fs-xs)', padding: '5px 8px' }}
                />
                {form.scheduledDate && (
                  <button
                    type="button"
                    className="btn-icon btn-ghost"
                    onClick={() => setForm(prev => ({ ...prev, scheduledDate: '' }))}
                    title="Limpar data agendada"
                    style={{ padding: '6px', color: 'var(--text-tertiary)' }}
                  >
                    <RotateCcw size={13} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Due Date (Deadline) & Reminder */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Data Limite (Prazo Final)</label>
              <input className="form-input" type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Hora de Vencimento</label>
              <input className="form-input" type="time" value={form.dueTime || ''} onChange={e => setForm({ ...form, dueTime: e.target.value })} />
            </div>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
            <input
              type="checkbox"
              id="task-reminder-checkbox"
              checked={form.reminderEnabled || false}
              onChange={e => setForm({ ...form, reminderEnabled: e.target.checked })}
              style={{ width: '16px', height: '16px', margin: 0, cursor: 'pointer' }}
            />
            <label htmlFor="task-reminder-checkbox" style={{ margin: 0, cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 500 }}>Ativar Lembrete</label>
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
