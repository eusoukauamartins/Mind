import { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import Modal from '../components/Modal';
import { Calendar as CalIcon, ChevronLeft, ChevronRight, List, Plus, Clock, Check } from 'lucide-react';
import { MONTH_NAMES, DAY_NAMES, getDaysInMonth, getFirstDayOfMonth, formatDate, getToday, isTaskCompleted, getTaskPeriodKey, isTaskActiveOnDate } from '../utils/helpers';

const defaultTask = {
  title: '', description: '', priority: 'média', estimatedHours: '',
  status: 'pendente', dueDate: '', scheduledDate: '', scheduledTime: '', category: '',
  recurrence: 'única', recurrenceDay: '',
};

export default function CalendarPage() {
  const { tasks, createItem, updateItem } = useApp();
  const [view, setView] = useState('month'); // month, annual, agenda
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultTask);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const categories = Array.from(new Set(tasks.map(t => t.category).filter(Boolean)));

  const prevMonth = () => setCurrentDate(new Date(year, month - 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1));
  const prevYear = () => setCurrentDate(new Date(year - 1, month));
  const nextYear = () => setCurrentDate(new Date(year + 1, month));

  // Dynamic Task fetcher
  const getTasksForDate = (dateStr) => {
    const list = tasks.filter(t => 
      isTaskActiveOnDate(t, dateStr) && 
      (!t.recurrence || t.recurrence === 'única' || t.recurrence === 'mensal')
    );
    list.sort((a, b) => {
      const ta = a.scheduledTime || '99:99';
      const tb = b.scheduledTime || '99:99';
      return ta.localeCompare(tb);
    });
    return list;
  };

  const selectedTasks = selectedDate ? getTasksForDate(selectedDate) : [];

  const openAddModal = (date) => {
    const d = date || selectedDate || new Date().toISOString().split('T')[0];
    setForm({ ...defaultTask, scheduledDate: d });
    setEditing(null);
    setShowModal(true);
  };

  const openEditModal = (task) => {
    setForm({ ...task, scheduledTime: task.scheduledTime || '' });
    setEditing(task.id);
    setShowModal(true);
  };

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

  const handleToggleComplete = (task, dateStr) => {
    if (task.recurrence === 'diária' || task.recurrence === 'semanal' || task.recurrence === 'mensal') {
      const periodKey = getTaskPeriodKey(task, new Date(dateStr + 'T12:00:00'));
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

  // Month view
  const renderMonthView = () => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const cells = [];
    const today = new Date().toISOString().split('T')[0];

    for (let i = 0; i < firstDay; i++) cells.push(<div key={`empty-${i}`} style={{ padding: 'var(--sp-2)' }} />);

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayTasks = getTasksForDate(dateStr);
      const isToday = dateStr === today;
      const isSelected = dateStr === selectedDate;

      cells.push(
        <button
          key={day}
          onClick={() => setSelectedDate(dateStr)}
          style={{
            padding: 'var(--sp-2)',
            borderRadius: 'var(--radius-md)',
            border: isSelected ? '1px solid var(--accent)' : '1px solid transparent',
            background: isToday ? 'var(--accent-subtle)' : isSelected ? 'var(--bg-hover)' : 'transparent',
            cursor: 'pointer',
            minHeight: 60,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 2,
            transition: 'all var(--transition-fast)',
          }}
        >
          <span style={{
            fontSize: 'var(--fs-sm)', fontWeight: isToday ? 700 : 400,
            color: isToday ? 'var(--accent)' : 'var(--text-primary)',
          }}>
            {day}
          </span>
          {dayTasks.length > 0 && (
            <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {dayTasks.slice(0, 3).map((t, i) => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: isTaskCompleted(t, new Date(dateStr + 'T12:00:00')) ? 'var(--success)' : t.priority === 'alta' ? 'var(--danger)' : 'var(--accent)',
                }} />
              ))}
              {dayTasks.length > 3 && (
                <span style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>+{dayTasks.length - 3}</span>
              )}
            </div>
          )}
        </button>
      );
    }

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
          <button className="btn btn-ghost" onClick={prevMonth}><ChevronLeft size={18} /></button>
          <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 600 }}>{MONTH_NAMES[month]} {year}</h2>
          <button className="btn btn-ghost" onClick={nextMonth}><ChevronRight size={18} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 'var(--sp-2)' }}>
          {DAY_NAMES.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontWeight: 600, padding: 'var(--sp-2)' }}>
              {d}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {cells}
        </div>
      </div>
    );
  };

  // Annual overview
  const renderAnnualView = () => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-6)' }}>
        <button className="btn btn-ghost" onClick={prevYear}><ChevronLeft size={18} /></button>
        <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 600 }}>{year}</h2>
        <button className="btn btn-ghost" onClick={nextYear}><ChevronRight size={18} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--sp-4)' }}>
        {MONTH_NAMES.map((name, mIdx) => {
          const daysInM = getDaysInMonth(year, mIdx);
          const firstD = getFirstDayOfMonth(year, mIdx);
          const today = new Date().toISOString().split('T')[0];
          return (
            <div key={mIdx} className="card" style={{ padding: 'var(--sp-3)' }}>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, marginBottom: 'var(--sp-2)', color: 'var(--text-secondary)' }}>{name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
                {Array(firstD).fill(null).map((_, i) => <div key={`e-${i}`} style={{ width: 16, height: 16 }} />)}
                {Array.from({ length: daysInM }, (_, i) => {
                  const d = `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                  const hasTasks = getTasksForDate(d).length > 0;
                  const isT = d === today;
                  return (
                    <div key={i} onClick={() => { setSelectedDate(d); setView('month'); setCurrentDate(new Date(year, mIdx)); }}
                      style={{
                        width: 16, height: 16, borderRadius: 3, cursor: 'pointer', fontSize: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: hasTasks ? 'var(--accent)' : isT ? 'var(--bg-hover)' : 'var(--bg-tertiary)',
                        color: hasTasks ? 'white' : 'var(--text-tertiary)',
                      }}
                    >
                      {i + 1}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Agenda view
  const renderAgendaView = () => {
    const explicitDates = tasks.map(t => t.scheduledDate || t.dueDate).filter(Boolean);
    const futureExplicit = explicitDates.filter(d => d >= getToday());
    const futureDates = Array.from(new Set([
      ...Array(14).fill(0).map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d.toISOString().split('T')[0]; }),
      ...futureExplicit
    ])).sort().slice(0, 14);

    const datesToShow = futureDates.filter(d => getTasksForDate(d).length > 0);

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
          <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 600 }}>Agenda</h2>
          <button className="btn btn-primary" onClick={() => openAddModal()}>
            <Plus size={16} /> Novo Compromisso
          </button>
        </div>
        {datesToShow.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 'var(--sp-8)' }}>Nenhum item agendado.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            {datesToShow.map(date => (
              <div key={date}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--accent)', marginBottom: 'var(--sp-2)' }}>
                  {new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
                  {getTasksForDate(date).map(task => (
                    <div key={task.id} className="card" 
                      style={{ padding: 'var(--sp-3) var(--sp-4)', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                      <button
                        className={`checkbox ${isTaskCompleted(task, new Date(date + 'T12:00:00')) ? 'checked' : ''}`}
                        onClick={() => handleToggleComplete(task, date)}
                      >
                        {isTaskCompleted(task, new Date(date + 'T12:00:00')) && <Check size={14} color="white" />}
                      </button>
                      
                      <div onClick={() => openEditModal(task)} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flex: 1, minWidth: 0, cursor: 'pointer' }}>
                        {task.scheduledTime && (
                          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--accent)', minWidth: 48, flexShrink: 0 }}>
                            {task.scheduledTime}
                          </span>
                        )}
                        <span style={{ flex: 1, fontWeight: 500, textDecoration: isTaskCompleted(task, new Date(date + 'T12:00:00')) ? 'line-through' : 'none', color: isTaskCompleted(task, new Date(date + 'T12:00:00')) ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
                          {task.title}
                        </span>
                        {task.recurrence === 'diária' && <span className="badge badge-accent">Diária</span>}
                        {task.recurrence === 'semanal' && <span className="badge badge-accent">Semanal</span>}
                        <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Calendário</h1>
          <p>Planejamento e visão de atividades</p>
        </div>
        <button className="btn btn-primary" onClick={() => openAddModal()}>
          <Plus size={16} /> Novo Compromisso
        </button>
      </div>

      <div className="tabs">
        {[{ key: 'month', label: 'Mensal' }, { key: 'annual', label: 'Anual' }, { key: 'agenda', label: 'Agenda' }].map(v => (
          <button key={v.key} className={`tab ${view === v.key ? 'active' : ''}`} onClick={() => setView(v.key)}>{v.label}</button>
        ))}
      </div>

      <div className="grid grid-2">
        <div className="card" style={view === 'annual' ? { gridColumn: '1 / -1' } : {}}>
          {view === 'month' && renderMonthView()}
          {view === 'annual' && renderAnnualView()}
          {view === 'agenda' && renderAgendaView()}
        </div>

        {view === 'month' && (
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title">
                {selectedDate
                  ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
                  : 'Selecione uma data'}
              </span>
              {selectedDate && (
                <button className="btn btn-primary btn-sm" onClick={() => openAddModal(selectedDate)}>
                  <Plus size={14} /> Adicionar
                </button>
              )}
            </div>
            {selectedDate ? (
              selectedTasks.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                  {selectedTasks.map(task => (
                    <div key={task.id} onClick={() => openEditModal(task)}
                      style={{
                        padding: 'var(--sp-2) var(--sp-3)', borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center',
                        gap: 'var(--sp-2)', cursor: 'pointer', transition: 'background var(--transition-fast)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                    >
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: isTaskCompleted(task, new Date(selectedDate + 'T12:00:00')) ? 'var(--success)' : task.priority === 'alta' ? 'var(--danger)' : 'var(--accent)',
                      }} />
                      {task.scheduledTime && (
                        <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--accent)', minWidth: 40 }}>
                          {task.scheduledTime}
                        </span>
                      )}
                      <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, flex: 1 }}>{task.title}</span>
                      <span className={`badge badge-${task.priority}`} style={{ marginLeft: 'auto' }}>{task.priority}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 'var(--sp-6)' }}>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-3)' }}>Nenhuma tarefa para esta data.</p>
                  <button className="btn btn-primary btn-sm" onClick={() => openAddModal(selectedDate)}>
                    <Plus size={14} /> Adicionar Tarefa
                  </button>
                </div>
              )
            ) : (
              <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>Clique em uma data para ver as tarefas.</p>
            )}
          </div>
        )}
      </div>

      {/* Modal for Adding/Editing Task */}
      {showModal && (
        <Modal title={editing ? 'Editar Compromisso' : 'Novo Compromisso'} onClose={() => { setShowModal(false); setEditing(null); }}>
          <div className="form-group">
            <label className="form-label">Título *</label>
            <input className="form-input" placeholder="Ex: Reunião, Treino, Estudo..." value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <textarea className="form-textarea" placeholder="Detalhes opcionais..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Data Agendada *</label>
              <input className="form-input" type="date" value={form.scheduledDate} onChange={e => setForm({ ...form, scheduledDate: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Horário</label>
              <input className="form-input" type="time" value={form.scheduledTime} onChange={e => setForm({ ...form, scheduledTime: e.target.value })} />
            </div>
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
                <select className="form-select" value={form.status || 'pendente'} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="pendente">Pendente</option>
                  <option value="em_andamento">Em Andamento</option>
                  <option value="concluída">Concluída</option>
                </select>
              </div>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Categoria</label>
              <input className="form-input" list="cal-categories" placeholder="Ex: Pessoal" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
              <datalist id="cal-categories">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEditing(null); }}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSubmit}>{editing ? 'Salvar' : 'Criar Compromisso'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
