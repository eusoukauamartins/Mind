import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { Dumbbell, Plus, Check, X, Edit2, Save, Calendar } from 'lucide-react';
import { formatDate, getToday, isThisWeek, DAY_NAMES_FULL } from '../utils/helpers';

const dayOrder = [1, 2, 3, 4, 5, 6, 0]; // Seg to Dom

export default function Workout() {
  const { workoutRoutines, workoutLogs, createItem, updateItem, deleteItem } = useApp();
  const location = useLocation();
  const [tab, setTab] = useState('routine');
  const [showLogModal, setShowLogModal] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState(null);
  const [routineForm, setRoutineForm] = useState({});
  const today = getToday();

  useEffect(() => {
    if (location.state?.quickAdd) { setShowLogModal(true); window.history.replaceState({}, ''); }
  }, [location.state]);

  // Workout log form
  const existingLog = workoutLogs.find(w => w.date === today);
  const [logForm, setLogForm] = useState({
    date: today,
    didTrain: existingLog?.didTrain ?? true,
    workoutDone: existingLog?.workoutDone || '',
    followedPlan: existingLog?.followedPlan ?? true,
    howItWent: existingLog?.howItWent || '',
    energy: existingLog?.energy || 'média',
    notes: existingLog?.notes || '',
  });

  // Sorted routines
  const sortedRoutines = useMemo(() => {
    return dayOrder.map(dayNum => {
      const routine = workoutRoutines.find(r => r.dayOfWeek === dayNum);
      return routine || { dayOfWeek: dayNum, dayName: DAY_NAMES_FULL[dayNum], isRestDay: true, workoutType: null, plannedFocus: null, notes: '' };
    });
  }, [workoutRoutines]);

  // Week metrics
  const weekMetrics = useMemo(() => {
    const weekLogs = workoutLogs.filter(w => isThisWeek(w.date));
    const trained = weekLogs.filter(w => w.didTrain).length;
    const planned = workoutRoutines.filter(r => !r.isRestDay).length;
    const followed = weekLogs.filter(w => w.followedPlan).length;
    const adherence = planned > 0 ? Math.round((trained / planned) * 100) : 0;

    // Streak
    let streak = 0;
    const sortedLogs = [...workoutLogs].sort((a, b) => b.date.localeCompare(a.date));
    for (const log of sortedLogs) {
      if (log.didTrain) streak++;
      else break;
    }

    return { trained, planned, followed, adherence, streak, totalLogs: weekLogs.length };
  }, [workoutLogs, workoutRoutines]);

  const handleSaveLog = () => {
    if (existingLog) {
      updateItem('workoutLogs', existingLog.id, logForm);
    } else {
      createItem('workoutLogs', logForm);
    }
    setShowLogModal(false);
  };

  const handleSaveRoutine = (dayOfWeek) => {
    const existing = workoutRoutines.find(r => r.dayOfWeek === dayOfWeek);
    const data = routineForm[dayOfWeek];
    if (!data) return;
    if (existing) {
      updateItem('workoutRoutines', existing.id, data);
    } else {
      createItem('workoutRoutines', { ...data, dayOfWeek, dayName: DAY_NAMES_FULL[dayOfWeek] });
    }
    setEditingRoutine(null);
  };

  // Weekly log view
  const weekDayLogs = useMemo(() => {
    return dayOrder.map(dayNum => {
      const d = new Date();
      const currentDay = d.getDay();
      const diff = dayNum - currentDay + (dayNum < currentDay ? 0 : 0);
      const targetDate = new Date(d);
      // Find the date for this day of the current week
      const mondayOffset = (currentDay === 0 ? -6 : 1 - currentDay);
      const monday = new Date(d);
      monday.setDate(d.getDate() + mondayOffset);
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + (dayNum === 0 ? 6 : dayNum - 1));
      const dateStr = dayDate.toISOString().split('T')[0];
      const log = workoutLogs.find(w => w.date === dateStr);
      const routine = workoutRoutines.find(r => r.dayOfWeek === dayNum);
      return { dayNum, dayName: DAY_NAMES_FULL[dayNum], dateStr, log, routine };
    });
  }, [workoutLogs, workoutRoutines]);

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Treino</h1>
          <p>Rotina, disciplina e consistência</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowLogModal(true)}>
          <Plus size={16} /> Log de Treino
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-4" style={{ marginBottom: 'var(--sp-6)' }}>
        <div className="stat-card">
          <span className="stat-label">Treinos na Semana</span>
          <span className="stat-value">{weekMetrics.trained}<span style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)' }}>/{weekMetrics.planned}</span></span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Aderência</span>
          <span className="stat-value" style={{ color: weekMetrics.adherence >= 80 ? 'var(--success)' : weekMetrics.adherence >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
            {weekMetrics.adherence}%
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Seguiu o Plano</span>
          <span className="stat-value">{weekMetrics.followed}/{weekMetrics.trained}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Sequência</span>
          <span className="stat-value">{weekMetrics.streak} <span style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)' }}>dias</span></span>
        </div>
      </div>

      <div className="tabs">
        {[
          { key: 'routine', label: 'Rotina Semanal' },
          { key: 'logs', label: 'Registro Diário' },
        ].map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'routine' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {sortedRoutines.map(routine => (
            <div key={routine.dayOfWeek} className="card" style={{ padding: 'var(--sp-4)', display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 'var(--radius-md)',
                background: routine.isRestDay ? 'var(--bg-tertiary)' : 'var(--accent-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {routine.isRestDay ? <span style={{ fontSize: '18px' }}>😴</span> : <Dumbbell size={20} style={{ color: 'var(--accent)' }} />}
              </div>
              {editingRoutine === routine.dayOfWeek ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                  <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, minWidth: 80 }}>{routine.dayName}</span>
                    <label style={{ fontSize: 'var(--fs-sm)', display: 'flex', alignItems: 'center', gap: 'var(--sp-1)' }}>
                      <input type="checkbox"
                        checked={routineForm[routine.dayOfWeek]?.isRestDay ?? routine.isRestDay}
                        onChange={e => setRoutineForm({ ...routineForm, [routine.dayOfWeek]: { ...routineForm[routine.dayOfWeek], isRestDay: e.target.checked } })}
                      /> Descanso
                    </label>
                  </div>
                  {!(routineForm[routine.dayOfWeek]?.isRestDay ?? routine.isRestDay) && (
                    <>
                      <input className="form-input" placeholder="Tipo de treino..." value={routineForm[routine.dayOfWeek]?.workoutType ?? routine.workoutType ?? ''}
                        onChange={e => setRoutineForm({ ...routineForm, [routine.dayOfWeek]: { ...routineForm[routine.dayOfWeek], workoutType: e.target.value } })} />
                      <input className="form-input" placeholder="Foco planejado..." value={routineForm[routine.dayOfWeek]?.plannedFocus ?? routine.plannedFocus ?? ''}
                        onChange={e => setRoutineForm({ ...routineForm, [routine.dayOfWeek]: { ...routineForm[routine.dayOfWeek], plannedFocus: e.target.value } })} />
                    </>
                  )}
                  <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => handleSaveRoutine(routine.dayOfWeek)}>
                      <Save size={14} /> Salvar
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingRoutine(null)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{routine.dayName}</div>
                    {routine.isRestDay ? (
                      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>Dia de descanso</span>
                    ) : (
                      <div>
                        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--accent-hover)' }}>{routine.workoutType || 'Treino não definido'}</div>
                        {routine.plannedFocus && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{routine.plannedFocus}</div>}
                      </div>
                    )}
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    setRoutineForm({ ...routineForm, [routine.dayOfWeek]: { ...routine } });
                    setEditingRoutine(routine.dayOfWeek);
                  }}>
                    <Edit2 size={14} /> Editar
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'logs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {weekDayLogs.map(({ dayName, dateStr, log, routine }) => {
            const isRest = routine?.isRestDay;
            return (
              <div key={dateStr} className="card" style={{
                padding: 'var(--sp-4)', display: 'flex', alignItems: 'center', gap: 'var(--sp-4)',
                opacity: dateStr > today ? 0.5 : 1,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: log?.didTrain ? 'var(--success-subtle)' : isRest ? 'var(--bg-tertiary)' : log ? 'var(--danger-subtle)' : 'var(--bg-tertiary)',
                }}>
                  {log?.didTrain ? <Check size={18} style={{ color: 'var(--success)' }} /> :
                    isRest ? <span style={{ fontSize: 16 }}>😴</span> :
                      log && !log.didTrain ? <X size={18} style={{ color: 'var(--danger)' }} /> :
                        <Calendar size={16} style={{ color: 'var(--text-tertiary)' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                    <span style={{ fontWeight: 600 }}>{dayName}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{formatDate(dateStr)}</span>
                    {dateStr === today && <span className="badge badge-accent">Hoje</span>}
                  </div>
                  {log ? (
                    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
                      {log.didTrain ? `${log.workoutDone || 'Treinou'} — ${log.howItWent || ''}` : 'Não treinou'}
                    </div>
                  ) : routine && !isRest ? (
                    <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>Planejado: {routine.workoutType || '—'}</span>
                  ) : (
                    <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>Descanso</span>
                  )}
                </div>
                {log?.followedPlan !== undefined && (
                  <span className={`badge ${log.followedPlan ? 'badge-success' : 'badge-media'}`}>
                    {log.followedPlan ? 'No plano' : 'Fora do plano'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Log Modal */}
      {showLogModal && (
        <Modal title="Registro de Treino" onClose={() => setShowLogModal(false)}>
          <div className="form-group">
            <label className="form-label">Data</label>
            <input className="form-input" type="date" value={logForm.date} onChange={e => setLogForm({ ...logForm, date: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Treinou hoje?</label>
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <button className={`btn ${logForm.didTrain ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setLogForm({ ...logForm, didTrain: true })}>Sim</button>
              <button className={`btn ${!logForm.didTrain ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setLogForm({ ...logForm, didTrain: false })}>Não</button>
            </div>
          </div>
          {logForm.didTrain && (
            <>
              <div className="form-group">
                <label className="form-label">Treino realizado</label>
                <input className="form-input" placeholder="Ex: Peito e Tríceps" value={logForm.workoutDone} onChange={e => setLogForm({ ...logForm, workoutDone: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Seguiu o plano?</label>
                <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                  <button className={`btn ${logForm.followedPlan ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setLogForm({ ...logForm, followedPlan: true })}>Sim</button>
                  <button className={`btn ${!logForm.followedPlan ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setLogForm({ ...logForm, followedPlan: false })}>Não</button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Como foi?</label>
                <textarea className="form-textarea" placeholder="Descreva brevemente..." value={logForm.howItWent} onChange={e => setLogForm({ ...logForm, howItWent: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Energia</label>
                <select className="form-select" value={logForm.energy} onChange={e => setLogForm({ ...logForm, energy: e.target.value })}>
                  <option value="baixa">Baixa</option>
                  <option value="média">Média</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
            </>
          )}
          <div className="form-group">
            <label className="form-label">Notas</label>
            <textarea className="form-textarea" placeholder="Observações..." value={logForm.notes} onChange={e => setLogForm({ ...logForm, notes: e.target.value })} />
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setShowLogModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSaveLog}>
              {existingLog ? 'Atualizar' : 'Salvar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
