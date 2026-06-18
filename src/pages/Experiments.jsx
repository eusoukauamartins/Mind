import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { Plus, FlaskConical, Search, Trash2, Edit2, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDate } from '../utils/helpers';

const defaultExperiment = {
  title: '', category: '', context: '', whatWasTested: '', result: '',
  mainError: '', lessonLearned: '', repeatThis: 'sim', date: new Date().toISOString().split('T')[0],
  notes: '', tags: [],
};

const categories = ['ads', 'conteúdo', 'negócio', 'operacional', 'produtividade', 'estratégia', 'outro'];

export default function Experiments() {
  const { experiments, createItem, updateItem, deleteItem } = useApp();
  const location = useLocation();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultExperiment);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('todas');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (location.state?.quickAdd) { setShowModal(true); window.history.replaceState({}, ''); }
  }, [location.state]);

  const filtered = useMemo(() => {
    let result = [...experiments];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e => e.title.toLowerCase().includes(q) || e.lessonLearned.toLowerCase().includes(q));
    }
    if (filterCategory !== 'todas') result = result.filter(e => e.category === filterCategory);
    result.sort((a, b) => b.date.localeCompare(a.date));
    return result;
  }, [experiments, search, filterCategory]);

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    if (editing) { updateItem('experiments', editing, form); }
    else { createItem('experiments', form); }
    setShowModal(false); setEditing(null); setForm(defaultExperiment);
  };

  const handleEdit = (item) => {
    setForm({ ...item });
    setEditing(item.id);
    setShowModal(true);
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Experimentos</h1>
          <p>Teste, erre, aprenda. Evite repetir os mesmos erros.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(defaultExperiment); setEditing(null); setShowModal(true); }}>
          <Plus size={16} /> Novo Experimento
        </button>
      </div>

      <div className="filter-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input className="form-input" placeholder="Buscar experimentos..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 34 }} />
        </div>
        <select className="form-select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="todas">Todas categorias</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={FlaskConical} title="Nenhum experimento" description="Registre testes, erros e lições aprendidas para evoluir mais rápido."
          action={<button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Novo Experimento</button>} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {filtered.map(exp => (
            <div key={exp.id} className="card" style={{ cursor: 'pointer' }}>
              <div onClick={() => setExpandedId(expandedId === exp.id ? null : exp.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: exp.repeatThis === 'sim' ? 'var(--success-subtle)' : 'var(--danger-subtle)',
                }}>
                  {exp.repeatThis === 'sim' ? <ThumbsUp size={16} style={{ color: 'var(--success)' }} /> : <ThumbsDown size={16} style={{ color: 'var(--danger)' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{exp.title}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', display: 'flex', gap: 'var(--sp-3)' }}>
                    <span className="badge badge-accent">{exp.category}</span>
                    <span>{formatDate(exp.date)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--sp-1)' }}>
                  <button className="btn-icon btn-ghost" onClick={(e) => { e.stopPropagation(); handleEdit(exp); }}><Edit2 size={14} /></button>
                  <button className="btn-icon btn-ghost" onClick={(e) => { e.stopPropagation(); deleteItem('experiments', exp.id); }} style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                  {expandedId === exp.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {expandedId === exp.id && (
                <div style={{ marginTop: 'var(--sp-4)', paddingTop: 'var(--sp-4)', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
                  <div><div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>Contexto</div><p style={{ fontSize: 'var(--fs-sm)' }}>{exp.context || '—'}</p></div>
                  <div><div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>O que foi testado</div><p style={{ fontSize: 'var(--fs-sm)' }}>{exp.whatWasTested || '—'}</p></div>
                  <div><div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>Resultado</div><p style={{ fontSize: 'var(--fs-sm)', color: 'var(--success)' }}>{exp.result || '—'}</p></div>
                  <div><div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>Principal Erro</div><p style={{ fontSize: 'var(--fs-sm)', color: 'var(--danger)' }}>{exp.mainError || '—'}</p></div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>Lição Aprendida</div>
                    <p style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--accent-hover)' }}>{exp.lessonLearned || '—'}</p>
                  </div>
                  {exp.notes && <div style={{ gridColumn: '1 / -1' }}><div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>Notas</div><p style={{ fontSize: 'var(--fs-sm)' }}>{exp.notes}</p></div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? 'Editar Experimento' : 'Novo Experimento'} onClose={() => { setShowModal(false); setEditing(null); }} wide>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Título *</label>
              <input className="form-input" placeholder="Nome do experimento..." value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Categoria</label>
              <input className="form-input" list="exp-categories" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
              <datalist id="exp-categories">{categories.map(c => <option key={c} value={c} />)}</datalist>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Contexto</label>
            <textarea className="form-textarea" placeholder="Qual era o cenário?" value={form.context} onChange={e => setForm({ ...form, context: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">O que foi testado</label>
            <textarea className="form-textarea" placeholder="Descreva o teste..." value={form.whatWasTested} onChange={e => setForm({ ...form, whatWasTested: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Resultado</label>
              <textarea className="form-textarea" placeholder="O que aconteceu?" value={form.result} onChange={e => setForm({ ...form, result: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Principal Erro</label>
              <textarea className="form-textarea" placeholder="Onde errou?" value={form.mainError} onChange={e => setForm({ ...form, mainError: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Lição Aprendida</label>
            <textarea className="form-textarea" placeholder="O que aprendeu com isso?" value={form.lessonLearned} onChange={e => setForm({ ...form, lessonLearned: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Repetir isso?</label>
              <select className="form-select" value={form.repeatThis} onChange={e => setForm({ ...form, repeatThis: e.target.value })}>
                <option value="sim">Sim</option>
                <option value="não">Não</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Data</label>
              <input className="form-input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notas</label>
            <textarea className="form-textarea" placeholder="Observações adicionais..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEditing(null); }}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSubmit}>{editing ? 'Salvar' : 'Criar Experimento'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
