import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { Plus, Lightbulb, Search, Star, Trash2, Edit2, Tag, Heart } from 'lucide-react';
import { formatDate } from '../utils/helpers';

const defaultLearning = { type: 'aprendizado', content: '', date: new Date().toISOString().split('T')[0], tags: [], favorite: false, source: '' };
const types = [
  { value: 'ideia', label: 'Ideia', emoji: '💡' },
  { value: 'aprendizado', label: 'Aprendizado', emoji: '📚' },
  { value: 'frase', label: 'Frase', emoji: '💬' },
  { value: 'estratégia', label: 'Estratégia', emoji: '🎯' },
  { value: 'livro', label: 'Livro', emoji: '📖' },
];

export default function Learnings() {
  const { learnings, createItem, updateItem, deleteItem } = useApp();
  const location = useLocation();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultLearning);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('todas');
  const [showFavorites, setShowFavorites] = useState(false);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (location.state?.quickAdd) { setShowModal(true); window.history.replaceState({}, ''); }
  }, [location.state]);

  const allTags = useMemo(() => {
    const tags = new Set();
    learnings.forEach(l => (l.tags || []).forEach(t => tags.add(t)));
    return [...tags];
  }, [learnings]);

  const [filterTag, setFilterTag] = useState('');

  const filtered = useMemo(() => {
    let result = [...learnings];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l => l.content.toLowerCase().includes(q) || (l.source || '').toLowerCase().includes(q));
    }
    if (filterType !== 'todas') result = result.filter(l => l.type === filterType);
    if (showFavorites) result = result.filter(l => l.favorite);
    if (filterTag) result = result.filter(l => (l.tags || []).includes(filterTag));
    result.sort((a, b) => b.date.localeCompare(a.date));
    return result;
  }, [learnings, search, filterType, showFavorites, filterTag]);

  const handleSubmit = () => {
    if (!form.content.trim()) return;
    if (editing) { updateItem('learnings', editing, form); }
    else { createItem('learnings', form); }
    setShowModal(false); setEditing(null); setForm(defaultLearning);
  };

  const handleEdit = (item) => {
    setForm({ ...item });
    setEditing(item.id);
    setShowModal(true);
  };

  const addTag = () => {
    if (tagInput.trim() && !(form.tags || []).includes(tagInput.trim())) {
      setForm({ ...form, tags: [...(form.tags || []), tagInput.trim()] });
      setTagInput('');
    }
  };

  const removeTag = (tag) => setForm({ ...form, tags: (form.tags || []).filter(t => t !== tag) });

  const typeInfo = (type) => types.find(t => t.value === type) || types[1];

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Aprendizados</h1>
          <p>Seu cofre pessoal de conhecimento</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(defaultLearning); setEditing(null); setShowModal(true); }}>
          <Plus size={16} /> Novo
        </button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input className="form-input" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 34 }} />
        </div>
        <select className="form-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="todas">Todos os tipos</option>
          {types.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
        </select>
        {allTags.length > 0 && (
          <select className="form-select" value={filterTag} onChange={e => setFilterTag(e.target.value)}>
            <option value="">Todas as tags</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <button className={`btn ${showFavorites ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowFavorites(!showFavorites)}>
          <Star size={14} fill={showFavorites ? 'white' : 'none'} /> Favoritos
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState icon={Lightbulb} title="Nenhum aprendizado" description="Registre ideias, frases, estratégias e aprendizados que podem ser úteis no futuro."
          action={<button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Novo Aprendizado</button>} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--sp-4)' }}>
          {filtered.map(item => (
            <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
                  {typeInfo(item.type).emoji} {typeInfo(item.type).label} · {formatDate(item.date)}
                </span>
                <div style={{ display: 'flex', gap: 'var(--sp-1)' }}>
                  <button className="btn-icon btn-ghost" onClick={() => updateItem('learnings', item.id, { favorite: !item.favorite })}>
                    <Star size={14} fill={item.favorite ? 'var(--warning)' : 'none'} style={{ color: item.favorite ? 'var(--warning)' : 'var(--text-tertiary)' }} />
                  </button>
                  <button className="btn-icon btn-ghost" onClick={() => handleEdit(item)}><Edit2 size={14} /></button>
                  <button className="btn-icon btn-ghost" onClick={() => deleteItem('learnings', item.id)} style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                </div>
              </div>
              <p style={{ fontSize: 'var(--fs-base)', lineHeight: 1.6, color: item.type === 'frase' ? 'var(--accent-hover)' : 'var(--text-primary)', fontStyle: item.type === 'frase' ? 'italic' : 'normal' }}>
                {item.content}
              </p>
              {item.source && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>Fonte: {item.source}</span>}
              {(item.tags || []).length > 0 && (
                <div style={{ display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap' }}>
                  {item.tags.map(tag => <span key={tag} className="chip">{tag}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <Modal title={editing ? 'Editar Aprendizado' : 'Novo Aprendizado'} onClose={() => { setShowModal(false); setEditing(null); }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                {types.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Data</label>
              <input className="form-input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Conteúdo *</label>
            <textarea className="form-textarea" placeholder="O que você aprendeu?" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} style={{ minHeight: 120 }} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Fonte</label>
            <input className="form-input" placeholder="Ex: livro, experiência, pessoa..." value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Tags</label>
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <input className="form-input" placeholder="Adicionar tag..." value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
              <button className="btn btn-secondary" onClick={addTag}>+</button>
            </div>
            {(form.tags || []).length > 0 && (
              <div style={{ display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap', marginTop: 'var(--sp-2)' }}>
                {form.tags.map(tag => (
                  <span key={tag} className="chip active" onClick={() => removeTag(tag)} style={{ cursor: 'pointer' }}>
                    {tag} ×
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="checkbox-wrapper">
              <button className={`checkbox ${form.favorite ? 'checked' : ''}`} onClick={() => setForm({ ...form, favorite: !form.favorite })}>
                {form.favorite && <Star size={12} color="white" />}
              </button>
              Marcar como favorito
            </label>
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEditing(null); }}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSubmit}>{editing ? 'Salvar' : 'Criar'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
