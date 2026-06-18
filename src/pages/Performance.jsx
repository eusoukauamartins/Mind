import { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { Activity, Plus, ChevronDown, ChevronRight, Edit2, Trash2, Calendar, Target, Zap, Smile, Search } from 'lucide-react';
import { toLocalISODate, formatDate } from '../utils/helpers';

const ratingConfig = {
  péssimo: { color: 'var(--danger)', bg: 'var(--danger-subtle)' },
  ruim: { color: 'var(--warning)', bg: 'var(--warning-subtle)' },
  médio: { color: 'var(--text-secondary)', bg: 'var(--bg-tertiary)' },
  bom: { color: 'var(--success)', bg: 'var(--success-subtle)' },
  excelente: { color: 'var(--accent)', bg: 'var(--accent-subtle)' }
};

const defaultLog = () => ({
  date: toLocalISODate(new Date()),
  sleep: 'médio',
  energy: 'médio',
  mood: 'médio',
  focus: 'médio',
  substances: '',
  helped: '',
  hindered: '',
  lostFocus: false,
  lostTime: '',
  focusLostTo: '',
  causeOfDistraction: '',
  notes: ''
});

const RATINGS = ['péssimo', 'ruim', 'médio', 'bom', 'excelente'];

export default function Performance() {
  const { dailyCheckIns, createItem, updateItem, deleteItem } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultLog());
  const [expandedIds, setExpandedIds] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  const logs = useMemo(() => {
    let result = [...dailyCheckIns].sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      return dateB.localeCompare(dateA);
    });

    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(log => 
        (log.notes || '').toLowerCase().includes(lower) ||
        (log.helped || '').toLowerCase().includes(lower) ||
        (log.hindered || '').toLowerCase().includes(lower) ||
        (log.focusLostTo || '').toLowerCase().includes(lower)
      );
    }
    return result;
  }, [dailyCheckIns, searchTerm]);

  const toggleExpanded = (id) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleEdit = (log, e) => {
    e.stopPropagation();
    setForm({ ...defaultLog(), ...log });
    setEditing(log.id);
    setShowModal(true);
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (window.confirm('Tem certeza que deseja excluir este registro de performance?')) {
      deleteItem('dailyCheckIns', id);
    }
  };

  const handleSubmit = () => {
    if (!form.date) return;
    
    if (editing) {
      updateItem('dailyCheckIns', editing, form);
    } else {
      createItem('dailyCheckIns', form);
    }
    
    setShowModal(false);
    setEditing(null);
    setForm(defaultLog());
  };

  const renderBadge = (label, value) => {
    const config = ratingConfig[value] || ratingConfig['médio'];
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontSize: 'var(--fs-xs)' }}>
        <span style={{ color: 'var(--text-tertiary)' }}>{label}:</span>
        <span className="badge" style={{ background: config.bg, color: config.color, textTransform: 'capitalize' }}>
          {value}
        </span>
      </div>
    );
  };

  const renderField = (label, value) => {
    if (!value) return null;
    return (
      <div style={{ marginBottom: 'var(--sp-3)' }}>
        <h4 style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--sp-1)' }}>{label}</h4>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{value}</p>
      </div>
    );
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Desempenho</h1>
          <p>Mapeamento de padrões, foco e análise comportamental</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(defaultLog()); setEditing(null); setShowModal(true); }}>
          <Plus size={16} /> Novo Registro
        </button>
      </div>

      <div style={{ marginBottom: 'var(--sp-6)' }}>
        <div className="search-input-wrapper" style={{ position: 'relative', maxWidth: 400 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Pesquisar nos registros de performance..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>
      </div>

      {logs.length === 0 ? (
        <EmptyState 
          icon={Activity} 
          title={searchTerm ? "Nenhum registro encontrado" : "Nenhum registro de desempenho"}
          description={searchTerm ? "Tente buscar por outras palavras." : "Crie seu primeiro registro estratégico para começar a mapear padrões."}
          action={!searchTerm && <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Novo Registro</button>}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {logs.map(log => {
            const expanded = expandedIds[log.id];
            
            return (
              <div key={log.id} className="project-card" style={{ padding: 'var(--sp-4)' }}>
                <div 
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => toggleExpanded(log.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
                    <div style={{ color: 'var(--text-tertiary)' }}>
                      {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                      <Calendar size={14} color="var(--text-tertiary)" />
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--fs-md)' }}>
                        {log.date ? log.date.split('-').reverse().join('/') : 'Sem data'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--sp-3)', marginLeft: 'var(--sp-4)', flexWrap: 'wrap' }}>
                      {renderBadge('Foco', log.focus)}
                      {renderBadge('Energia', log.energy)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--sp-1)' }} onClick={e => e.stopPropagation()}>
                    <button className="btn-icon btn-ghost" onClick={(e) => handleEdit(log, e)} title="Editar">
                      <Edit2 size={14} />
                    </button>
                    <button className="btn-icon btn-ghost" onClick={(e) => handleDelete(log.id, e)} title="Excluir"
                      style={{ color: 'var(--text-tertiary)' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div style={{ marginTop: 'var(--sp-4)', paddingTop: 'var(--sp-4)', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: 'var(--sp-6)', marginBottom: 'var(--sp-4)', flexWrap: 'wrap' }}>
                      {renderBadge('Sono', log.sleep)}
                      {renderBadge('Energia', log.energy)}
                      {renderBadge('Humor', log.mood)}
                      {renderBadge('Foco', log.focus)}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--sp-4)' }}>
                      <div>
                        {renderField('O que ajudou no desempenho?', log.helped)}
                        {renderField('O que atrapalhou?', log.hindered)}
                        {renderField('Hormônios / Suplementos / Substâncias', log.substances)}
                      </div>
                      
                      <div>
                        {log.lostFocus && (
                          <div style={{ padding: 'var(--sp-3)', background: 'var(--warning-subtle)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--sp-3)' }}>
                            <h4 style={{ fontSize: 'var(--fs-xs)', color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--sp-2)' }}>Análise de Distração</h4>
                            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)' }}>
                              <p><strong>Tempo perdido:</strong> {log.lostTime || 'Não especificado'}</p>
                              {log.focusLostTo && <p style={{ marginTop: '4px' }}><strong>Foco perdido em:</strong> {log.focusLostTo}</p>}
                              {log.causeOfDistraction && <p style={{ marginTop: '4px' }}><strong>Causa:</strong> {log.causeOfDistraction}</p>}
                            </div>
                          </div>
                        )}
                        {renderField('Observações Gerais', log.notes)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? 'Editar Registro' : 'Novo Registro Estratégico'} onClose={() => setShowModal(false)} maxWidth="700px">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
            
            {/* Header */}
            <div>
              <label className="form-label">Data do Registro</label>
              <input type="date" className="form-input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={{ maxWidth: 200 }} />
            </div>

            {/* Metrics */}
            <div style={{ background: 'var(--bg-secondary)', padding: 'var(--sp-4)', borderRadius: 'var(--radius-md)' }}>
              <h3 style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, marginBottom: 'var(--sp-3)', color: 'var(--text-primary)' }}>Métricas Base</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--sp-3)' }}>
                {['sleep', 'energy', 'mood', 'focus'].map(metric => (
                  <div key={metric}>
                    <label className="form-label" style={{ textTransform: 'capitalize' }}>
                      {metric === 'sleep' ? 'Sono' : metric === 'energy' ? 'Energia' : metric === 'mood' ? 'Humor' : 'Foco'}
                    </label>
                    <select className="form-select" value={form[metric] || 'médio'} onChange={e => setForm({ ...form, [metric]: e.target.value })}>
                      {RATINGS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Execution Analysis */}
            <div>
              <h3 style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, marginBottom: 'var(--sp-3)', color: 'var(--text-primary)' }}>Análise de Execução</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
                <div className="form-group">
                  <label className="form-label">O que ajudou no desempenho?</label>
                  <textarea className="form-textarea" placeholder="Ex: Ambiente limpo, café, fone de ouvido..." value={form.helped || ''} onChange={e => setForm({ ...form, helped: e.target.value })} rows={2} />
                </div>
                <div className="form-group">
                  <label className="form-label">O que atrapalhou?</label>
                  <textarea className="form-textarea" placeholder="Ex: Notificações, barulho, fome..." value={form.hindered || ''} onChange={e => setForm({ ...form, hindered: e.target.value })} rows={2} />
                </div>
              </div>
            </div>

            {/* Distraction Analysis */}
            <div style={{ border: '1px solid var(--border)', padding: 'var(--sp-4)', borderRadius: 'var(--radius-md)' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', cursor: 'pointer', marginBottom: form.lostFocus ? 'var(--sp-3)' : 0 }}>
                <input type="checkbox" checked={form.lostFocus || false} onChange={e => setForm({ ...form, lostFocus: e.target.checked })} />
                Houve perda severa de foco ou procrastinação?
              </label>

              {form.lostFocus && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Tempo perdido (aprox.)</label>
                      <input type="text" className="form-input" placeholder="Ex: 2 horas" value={form.lostTime || ''} onChange={e => setForm({ ...form, lostTime: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Em que perdi foco?</label>
                      <input type="text" className="form-input" placeholder="Ex: Instagram, YouTube, limpando a mesa..." value={form.focusLostTo || ''} onChange={e => setForm({ ...form, focusLostTo: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">O que causou isso?</label>
                    <input type="text" className="form-input" placeholder="Ex: Fui olhar o WhatsApp e caí no Instagram..." value={form.causeOfDistraction || ''} onChange={e => setForm({ ...form, causeOfDistraction: e.target.value })} />
                  </div>
                </div>
              )}
            </div>

            {/* Other */}
            <div className="form-group">
              <label className="form-label">Hormônios / Suplementos / Substâncias</label>
              <input type="text" className="form-input" placeholder="Ex: Café (2x), Creatina, Melatonina noite anterior" value={form.substances || ''} onChange={e => setForm({ ...form, substances: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="form-label">Observações Gerais</label>
              <textarea className="form-textarea" placeholder="Reflexões sobre o dia, o corpo e a mente..." value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>

          </div>

          <div className="form-actions" style={{ marginTop: 'var(--sp-6)' }}>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSubmit}>{editing ? 'Salvar Registro' : 'Adicionar Registro'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
