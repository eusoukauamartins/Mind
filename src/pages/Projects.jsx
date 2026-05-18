import { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import {
  Plus, FolderKanban, ChevronDown, ChevronRight, Check, Trash2, Edit2,
  GripVertical, Pause, Play, CheckCircle2
} from 'lucide-react';

const statusConfig = {
  ativo: { label: 'Ativo', color: 'var(--accent)', bg: 'var(--accent-subtle)' },
  pausado: { label: 'Pausado', color: 'var(--warning)', bg: 'var(--warning-subtle)' },
  concluído: { label: 'Concluído', color: 'var(--success)', bg: 'var(--success-subtle)' },
};

const defaultProject = { title: '', description: '', status: 'ativo', subtasks: [] };

export default function Projects() {
  const { projects, createItem, updateItem, deleteItem } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultProject);
  const [expandedIds, setExpandedIds] = useState({});
  const [newSubtask, setNewSubtask] = useState({});

  const sorted = useMemo(() => {
    return [...projects].sort((a, b) => {
      // Active first, then paused, then completed
      const order = { ativo: 0, pausado: 1, concluído: 2 };
      const statusDiff = (order[a.status] || 0) - (order[b.status] || 0);
      if (statusDiff !== 0) return statusDiff;
      return (a.order || 0) - (b.order || 0);
    });
  }, [projects]);

  const toggleExpanded = (id) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    if (editing) {
      updateItem('projects', editing, { title: form.title, description: form.description, status: form.status });
    } else {
      createItem('projects', { ...form, subtasks: [] });
    }
    setShowModal(false);
    setEditing(null);
    setForm(defaultProject);
  };

  const handleEdit = (project) => {
    setForm({ title: project.title, description: project.description, status: project.status, subtasks: project.subtasks || [] });
    setEditing(project.id);
    setShowModal(true);
  };

  // Subtask operations
  const addSubtask = (projectId) => {
    const text = (newSubtask[projectId] || '').trim();
    if (!text) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const subs = [...(project.subtasks || [])];
    subs.push({ id: crypto.randomUUID(), title: text, completed: false, order: subs.length });
    updateItem('projects', projectId, { subtasks: subs });
    setNewSubtask(prev => ({ ...prev, [projectId]: '' }));
  };

  const toggleSubtask = (projectId, subtaskId) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const subs = (project.subtasks || []).map(s =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    updateItem('projects', projectId, { subtasks: subs });
  };

  const removeSubtask = (projectId, subtaskId) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const subs = (project.subtasks || []).filter(s => s.id !== subtaskId);
    updateItem('projects', projectId, { subtasks: subs });
  };

  const toggleProjectStatus = (project) => {
    const cycle = { ativo: 'pausado', pausado: 'ativo', concluído: 'ativo' };
    updateItem('projects', project.id, { status: cycle[project.status] || 'ativo' });
  };

  const markProjectComplete = (project) => {
    updateItem('projects', project.id, { status: 'concluído' });
  };

  const getProgress = (project) => {
    const subs = project.subtasks || [];
    if (subs.length === 0) return 0;
    return Math.round((subs.filter(s => s.completed).length / subs.length) * 100);
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Projetos</h1>
          <p>Decomposição estratégica de tarefas complexas</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(defaultProject); setEditing(null); setShowModal(true); }}>
          <Plus size={16} /> Novo Projeto
        </button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Nenhum projeto criado"
          description="Crie um projeto para decompor tarefas complexas em blocos de execução."
          action={<button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Novo Projeto</button>}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {sorted.map(project => {
            const progress = getProgress(project);
            const expanded = expandedIds[project.id];
            const subs = project.subtasks || [];
            const completed = subs.filter(s => s.completed).length;
            const cfg = statusConfig[project.status] || statusConfig.ativo;

            return (
              <div key={project.id} className="project-card">
                {/* Header */}
                <div className="project-card-header" onClick={() => toggleExpanded(project.id)}>
                  <div style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
                    {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--fs-md)', color: project.status === 'concluído' ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: project.status === 'concluído' ? 'line-through' : 'none' }}>
                        {project.title}
                      </span>
                      <span className="badge" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    </div>
                    {project.description && (
                      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: '2px' }}>{project.description}</p>
                    )}
                    {/* Progress bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginTop: 'var(--sp-2)' }}>
                      <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', height: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? 'var(--success)' : 'linear-gradient(90deg, var(--accent), var(--teal))', borderRadius: 'var(--radius-full)', transition: 'width 0.4s ease' }} />
                      </div>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontWeight: 600, minWidth: 50, textAlign: 'right' }}>
                        {completed}/{subs.length}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 'var(--sp-1)', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button className="btn-icon btn-ghost" onClick={() => toggleProjectStatus(project)} title={project.status === 'pausado' ? 'Retomar' : 'Pausar'}>
                      {project.status === 'pausado' ? <Play size={14} /> : <Pause size={14} />}
                    </button>
                    {project.status !== 'concluído' && (
                      <button className="btn-icon btn-ghost" onClick={() => markProjectComplete(project)} title="Marcar como concluído" style={{ color: 'var(--success)' }}>
                        <CheckCircle2 size={14} />
                      </button>
                    )}
                    <button className="btn-icon btn-ghost" onClick={() => handleEdit(project)} title="Editar">
                      <Edit2 size={14} />
                    </button>
                    <button className="btn-icon btn-ghost" onClick={() => deleteItem('projects', project.id)} title="Excluir"
                      style={{ color: 'var(--text-tertiary)' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Expanded subtasks */}
                {expanded && (
                  <div className="project-card-body">
                    {subs.length === 0 ? (
                      <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', padding: 'var(--sp-3) 0', textAlign: 'center' }}>
                        Nenhuma subtarefa ainda. Adicione blocos de execução abaixo.
                      </p>
                    ) : (
                      <div style={{ padding: 'var(--sp-3) 0' }}>
                        {subs.sort((a, b) => (a.order || 0) - (b.order || 0)).map(sub => (
                          <div key={sub.id} className={`subtask-item ${sub.completed ? 'subtask-item--completed' : ''}`}>
                            <button
                              className={`checkbox ${sub.completed ? 'checked' : ''}`}
                              onClick={() => toggleSubtask(project.id, sub.id)}
                              style={{ flexShrink: 0, width: 18, height: 18 }}
                            >
                              {sub.completed && <Check size={10} color="white" />}
                            </button>
                            <span style={{ flex: 1, fontWeight: 400 }}>{sub.title}</span>
                            <button className="btn-icon btn-ghost" onClick={() => removeSubtask(project.id, sub.id)}
                              style={{ color: 'var(--text-tertiary)', padding: 2 }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add subtask */}
                    <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
                      <input
                        className="form-input"
                        placeholder="Novo bloco de execução..."
                        value={newSubtask[project.id] || ''}
                        onChange={e => setNewSubtask(prev => ({ ...prev, [project.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') addSubtask(project.id); }}
                        style={{ fontSize: 'var(--fs-sm)' }}
                      />
                      <button className="btn btn-primary btn-sm" onClick={() => addSubtask(project.id)}>
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <Modal title={editing ? 'Editar Projeto' : 'Novo Projeto'} onClose={() => { setShowModal(false); setEditing(null); }}>
          <div className="form-group">
            <label className="form-label">Título *</label>
            <input className="form-input" placeholder="Ex: Gravar primeiro vídeo" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <textarea className="form-textarea" placeholder="Objetivo e contexto do projeto..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="ativo">Ativo</option>
              <option value="pausado">Pausado</option>
              <option value="concluído">Concluído</option>
            </select>
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEditing(null); }}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSubmit}>{editing ? 'Salvar' : 'Criar Projeto'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
