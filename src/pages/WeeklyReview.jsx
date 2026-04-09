import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { Plus, ClipboardList, Trash2, Edit2, ChevronDown, ChevronUp, Trophy, AlertTriangle, Lightbulb, Target } from 'lucide-react';
import { formatDate, getWeekRef, getWeekDates } from '../utils/helpers';

const defaultReview = {
  weekRef: getWeekRef(),
  weekStart: getWeekDates().start,
  weekEnd: getWeekDates().end,
  whatWorked: '', whatDidNotWork: '', timeWasted: '', moneyWasted: '',
  biggestLearnings: '', mainWins: '', focusNextWeek: '',
};

export default function WeeklyReview() {
  const { weeklyReviews, createItem, updateItem, deleteItem } = useApp();
  const location = useLocation();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultReview);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (location.state?.quickAdd) { setShowModal(true); window.history.replaceState({}, ''); }
  }, [location.state]);

  const sorted = [...weeklyReviews].sort((a, b) => b.weekStart.localeCompare(a.weekStart));

  const handleSubmit = () => {
    if (!form.whatWorked.trim() && !form.mainWins.trim()) return;
    if (editing) { updateItem('weeklyReviews', editing, form); }
    else { createItem('weeklyReviews', form); }
    setShowModal(false); setEditing(null); setForm(defaultReview);
  };

  const handleEdit = (item) => {
    setForm({ ...item });
    setEditing(item.id);
    setShowModal(true);
  };

  const Section = ({ icon: Icon, color, title, content }) => (
    <div style={{ marginBottom: 'var(--sp-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-1)' }}>
        <Icon size={14} style={{ color }} />
        <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
      </div>
      <p style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{content || '—'}</p>
    </div>
  );

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Revisão Semanal</h1>
          <p>Reflexão e planejamento — semana {getWeekRef()}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(defaultReview); setEditing(null); setShowModal(true); }}>
          <Plus size={16} /> Nova Revisão
        </button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nenhuma revisão semanal" description="Faça revisões semanais para manter clareza sobre o que funciona e o que precisa mudar."
          action={<button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Nova Revisão</button>} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {sorted.map(review => (
            <div key={review.id} className="card">
              <div onClick={() => setExpandedId(expandedId === review.id ? null : review.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', cursor: 'pointer' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--accent-subtle)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ClipboardList size={18} style={{ color: 'var(--accent)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{review.weekRef}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                    {formatDate(review.weekStart)} — {formatDate(review.weekEnd)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--sp-1)' }}>
                  <button className="btn-icon btn-ghost" onClick={(e) => { e.stopPropagation(); handleEdit(review); }}><Edit2 size={14} /></button>
                  <button className="btn-icon btn-ghost" onClick={(e) => { e.stopPropagation(); deleteItem('weeklyReviews', review.id); }} style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                  {expandedId === review.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {expandedId === review.id && (
                <div style={{ marginTop: 'var(--sp-4)', paddingTop: 'var(--sp-4)', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
                    <Section icon={Trophy} color="var(--success)" title="O que funcionou" content={review.whatWorked} />
                    <Section icon={AlertTriangle} color="var(--danger)" title="O que não funcionou" content={review.whatDidNotWork} />
                    <Section icon={AlertTriangle} color="var(--warning)" title="Tempo desperdiçado" content={review.timeWasted} />
                    <Section icon={AlertTriangle} color="var(--warning)" title="Dinheiro desperdiçado" content={review.moneyWasted} />
                    <Section icon={Lightbulb} color="var(--info)" title="Maiores Aprendizados" content={review.biggestLearnings} />
                    <Section icon={Trophy} color="var(--success)" title="Principais Conquistas" content={review.mainWins} />
                  </div>
                  <div style={{ marginTop: 'var(--sp-4)', padding: 'var(--sp-4)', background: 'var(--accent-subtle)', borderRadius: 'var(--radius-md)' }}>
                    <Section icon={Target} color="var(--accent)" title="Foco para próxima semana" content={review.focusNextWeek} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? 'Editar Revisão' : 'Nova Revisão Semanal'} onClose={() => { setShowModal(false); setEditing(null); }} wide>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Referência da Semana</label>
              <input className="form-input" value={form.weekRef} onChange={e => setForm({ ...form, weekRef: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Início</label>
              <input className="form-input" type="date" value={form.weekStart} onChange={e => setForm({ ...form, weekStart: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Fim</label>
              <input className="form-input" type="date" value={form.weekEnd} onChange={e => setForm({ ...form, weekEnd: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">✅ O que funcionou</label>
              <textarea className="form-textarea" value={form.whatWorked} onChange={e => setForm({ ...form, whatWorked: e.target.value })} placeholder="Liste o que deu certo..." />
            </div>
            <div className="form-group">
              <label className="form-label">❌ O que não funcionou</label>
              <textarea className="form-textarea" value={form.whatDidNotWork} onChange={e => setForm({ ...form, whatDidNotWork: e.target.value })} placeholder="O que não funcionou bem..." />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">⏰ Tempo desperdiçado</label>
              <textarea className="form-textarea" value={form.timeWasted} onChange={e => setForm({ ...form, timeWasted: e.target.value })} placeholder="Onde perdeu tempo..." />
            </div>
            <div className="form-group">
              <label className="form-label">💸 Dinheiro desperdiçado</label>
              <textarea className="form-textarea" value={form.moneyWasted} onChange={e => setForm({ ...form, moneyWasted: e.target.value })} placeholder="Gastos desnecessários..." />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">💡 Maiores Aprendizados</label>
            <textarea className="form-textarea" value={form.biggestLearnings} onChange={e => setForm({ ...form, biggestLearnings: e.target.value })} placeholder="O que aprendeu..." />
          </div>
          <div className="form-group">
            <label className="form-label">🏆 Principais Conquistas</label>
            <textarea className="form-textarea" value={form.mainWins} onChange={e => setForm({ ...form, mainWins: e.target.value })} placeholder="Vitórias da semana..." />
          </div>
          <div className="form-group">
            <label className="form-label">🎯 Foco para Próxima Semana</label>
            <textarea className="form-textarea" style={{ minHeight: 100 }} value={form.focusNextWeek} onChange={e => setForm({ ...form, focusNextWeek: e.target.value })} placeholder="No que focar..." />
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEditing(null); }}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSubmit}>{editing ? 'Salvar' : 'Criar Revisão'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
