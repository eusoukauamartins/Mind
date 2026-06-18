import { useState, useMemo, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  Plus, FolderKanban, ChevronDown, ChevronRight, Check, Trash2, Edit2,
  GripVertical, Pause, Play, CheckCircle2, Copy, Archive, RotateCcw, MoreHorizontal
} from 'lucide-react';
import { toLocalISODate } from '../utils/helpers';

const statusConfig = {
  ativo: { label: 'Ativo', color: 'var(--accent)', bg: 'var(--accent-subtle)' },
  pausado: { label: 'Pausado', color: 'var(--warning)', bg: 'var(--warning-subtle)' },
  concluído: { label: 'Concluído', color: 'var(--success)', bg: 'var(--success-subtle)' },
  arquivado: { label: 'Arquivado', color: 'var(--text-secondary)', bg: 'var(--bg-tertiary)' },
  excluído: { label: 'Excluído', color: 'var(--danger)', bg: 'var(--danger-subtle)' },
};

const PROJECT_CATEGORIES = [
  'Conteúdo', 'Negócios', 'Estudos', 'Produto'
];

const categoryMap = {
  'Operações': 'Negócios',
  'Branding': 'Conteúdo',
  'Automação': 'Produto'
};

const getCategory = (c) => categoryMap[c] || c;

const TABS = ['Todos', 'Em Andamento', 'Pausados', 'Concluídos', 'Arquivados', 'Lixeira'];

const defaultProject = () => ({ 
  title: '', 
  description: '', 
  status: 'ativo', 
  category: '',
  startDate: toLocalISODate(new Date()),
  targetDate: '',
  subtasks: [] 
});

export default function Projects() {
  const { projects, createItem, updateItem, deleteItem } = useApp();
  const [activeTab, setActiveTab] = useState('Todos');
  const [openMenuId, setOpenMenuId] = useState(null);

  // Disable drag-and-drop on small/touch screens to avoid scroll/touch conflicts.
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Close contextual menu when clicking outside
  useEffect(() => {
    const closeMenu = () => setOpenMenuId(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultProject());
  const [expandedIds, setExpandedIds] = useState({});
  const [newSubtask, setNewSubtask] = useState({});

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (activeTab === 'Todos') return p.status === 'ativo' || p.status === 'pausado';
      if (activeTab === 'Em Andamento') return p.status === 'ativo';
      if (activeTab === 'Pausados') return p.status === 'pausado';
      if (activeTab === 'Concluídos') return p.status === 'concluído';
      if (activeTab === 'Arquivados') return p.status === 'arquivado';
      if (activeTab === 'Lixeira') return p.status === 'excluído';
      return true;
    });
  }, [projects, activeTab]);

  const sorted = useMemo(() => {
    return [...filteredProjects].sort((a, b) => {
      const order = { ativo: 0, pausado: 1, concluído: 2, arquivado: 3, excluído: 4 };
      const statusDiff = (order[a.status] || 0) - (order[b.status] || 0);
      if (statusDiff !== 0) return statusDiff;
      return (a.order || 0) - (b.order || 0);
    });
  }, [filteredProjects]);

  const toggleExpanded = (id) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    if (editing) {
      updateItem('projects', editing, form);
    } else {
      createItem('projects', { ...form, subtasks: [] });
    }
    setShowModal(false);
    setEditing(null);
    setForm(defaultProject());
  };

  const handleEdit = (project) => {
    setForm({ 
      title: project.title, 
      description: project.description, 
      status: project.status, 
      category: getCategory(project.category) || '',
      startDate: project.startDate || '',
      targetDate: project.targetDate || '',
      subtasks: project.subtasks || [] 
    });
    setEditing(project.id);
    setShowModal(true);
  };

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
    const cycle = { ativo: 'pausado', pausado: 'ativo' };
    const newStatus = cycle[project.status] || 'ativo';
    updateItem('projects', project.id, { 
      status: newStatus,
      completedAt: newStatus === 'ativo' ? null : project.completedAt
    });
  };

  const markProjectComplete = (project) => {
    updateItem('projects', project.id, { 
      status: 'concluído',
      completedAt: toLocalISODate(new Date())
    });
  };

  const archiveProject = (project) => {
    updateItem('projects', project.id, { status: 'arquivado' });
  };

  const softDeleteProject = (project) => {
    updateItem('projects', project.id, { status: 'excluído' });
  };

  const restoreProject = (project) => {
    updateItem('projects', project.id, { status: 'ativo', completedAt: null });
  };

  const hardDeleteProject = (id) => {
    deleteItem('projects', id);
  };

  const getProgress = (project) => {
    const subs = project.subtasks || [];
    if (subs.length === 0) return 0;
    return Math.round((subs.filter(s => s.completed).length / subs.length) * 100);
  };

  const handleDragEnd = (result, projectId) => {
    if (!result.destination) return;
    
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    const subs = [...(project.subtasks || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    const [reorderedItem] = subs.splice(result.source.index, 1);
    subs.splice(result.destination.index, 0, reorderedItem);
    
    const updatedSubs = subs.map((sub, index) => ({ ...sub, order: index }));
    updateItem('projects', projectId, { subtasks: updatedSubs });
  };

  const duplicateProject = (project) => {
    const newProject = {
      ...project,
      title: `${project.title} (Cópia)`,
      status: 'ativo',
      startDate: toLocalISODate(new Date()),
      completedAt: null,
      subtasks: (project.subtasks || []).map(sub => ({
        ...sub,
        id: crypto.randomUUID(),
        completed: false
      }))
    };
    delete newProject.id;
    createItem('projects', newProject);
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Projetos</h1>
          <p>Decomposição estratégica de tarefas complexas</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(defaultProject()); setEditing(null); setShowModal(true); }}>
          <Plus size={16} /> Novo Projeto
        </button>
      </div>

      <div className="project-tabs-container">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: 'var(--sp-2) var(--sp-4)',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 500,
              background: activeTab === tab ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
              color: activeTab === tab ? 'var(--accent)' : 'var(--text-secondary)',
              border: activeTab === tab ? '1px solid var(--border-active)' : '1px solid transparent',
              transition: 'all var(--transition-fast)',
              whiteSpace: 'nowrap',
              cursor: 'pointer'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={activeTab === 'Todos' ? "Nenhum projeto ativo" : `Nenhum projeto ${activeTab.toLowerCase()}`}
          description={activeTab === 'Lixeira' ? "A lixeira está vazia." : "Crie um projeto para decompor tarefas complexas em blocos de execution."}
          action={activeTab !== 'Lixeira' && <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Novo Projeto</button>}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {sorted.map(project => {
            const progress = getProgress(project);
            const expanded = expandedIds[project.id];
            const subs = project.subtasks || [];
            const cfg = statusConfig[project.status] || statusConfig.ativo;
            const displayCategory = getCategory(project.category);

            return (
              <div key={project.id} className="project-card">
                <div className="project-card-header" onClick={() => toggleExpanded(project.id)}>
                  <div className="project-card-main-info">
                    <div style={{ color: 'var(--text-tertiary)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </div>

                    <div className="project-card-info">
                      <div className="project-card-title-row">
                        <span className="project-card-title" style={{ fontWeight: 600, fontSize: 'var(--fs-md)', color: project.status === 'concluído' ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: project.status === 'concluído' ? 'line-through' : 'none' }}>
                          {project.title}
                        </span>
                        <div className="project-card-badges">
                          <span className="badge" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                          {displayCategory && (
                            <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                              {displayCategory}
                            </span>
                          )}
                        </div>
                      </div>
                      {project.description && (
                        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: '2px' }}>{project.description}</p>
                      )}
                      
                      <div className="project-card-dates">
                        {project.startDate && <span>Início: {project.startDate.split('-').reverse().join('/')}</span>}
                        {project.targetDate && <span>Previsto: {project.targetDate.split('-').reverse().join('/')}</span>}
                        {project.completedAt && <span style={{ color: 'var(--success)' }}>Concluído em: {project.completedAt.split('-').reverse().join('/')}</span>}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginTop: '12px' }}>
                        <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', height: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? 'var(--success)' : 'linear-gradient(90deg, var(--accent), var(--accent-hover))', borderRadius: 'var(--radius-full)', transition: 'width 0.4s ease' }} />
                        </div>
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-primary)', fontWeight: 600, minWidth: 35, textAlign: 'right' }}>
                          {progress}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="project-card-actions" onClick={e => e.stopPropagation()}>

                    {project.status === 'excluído' ? (
                      <>
                        <button className="btn-icon btn-ghost" onClick={() => restoreProject(project)} title="Restaurar" style={{ color: 'var(--success)' }}>
                          <RotateCcw size={14} />
                        </button>
                        <button className="btn-icon btn-ghost" onClick={() => hardDeleteProject(project.id)} title="Excluir Permanentemente" style={{ color: 'var(--danger)' }}>
                          <Trash2 size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        {project.status !== 'concluído' && project.status !== 'arquivado' && (
                          <button className="btn-icon btn-ghost" onClick={() => markProjectComplete(project)} title="Concluir" style={{ color: 'var(--success)' }}>
                            <CheckCircle2 size={14} />
                          </button>
                        )}
                        <button className="btn-icon btn-ghost" onClick={() => handleEdit(project)} title="Editar">
                          <Edit2 size={14} />
                        </button>
                        
                        <div style={{ position: 'relative' }}>
                          <button 
                            className={`btn-icon btn-ghost ${openMenuId === project.id ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === project.id ? null : project.id);
                            }}
                            style={{ color: openMenuId === project.id ? 'var(--accent)' : 'inherit' }}
                          >
                            <MoreHorizontal size={14} />
                          </button>
                          
                          {openMenuId === project.id && (
                            <div className="project-dropdown">
                              {project.status !== 'concluído' && project.status !== 'arquivado' && (
                                <button className="project-dropdown-item" onClick={() => { toggleProjectStatus(project); setOpenMenuId(null); }}>
                                  {project.status === 'pausado' ? <><Play size={14} /> Retomar Projeto</> : <><Pause size={14} /> Pausar Projeto</>}
                                </button>
                              )}
                              {project.status !== 'arquivado' && (
                                <button className="project-dropdown-item" onClick={() => { archiveProject(project); setOpenMenuId(null); }}>
                                  <Archive size={14} /> Arquivar Projeto
                                </button>
                              )}
                              <button className="project-dropdown-item" onClick={() => { duplicateProject(project); setOpenMenuId(null); }}>
                                <Copy size={14} /> Duplicar Projeto
                              </button>
                              <div className="project-dropdown-divider" />
                              <button className="project-dropdown-item danger" onClick={() => { softDeleteProject(project); setOpenMenuId(null); }}>
                                <Trash2 size={14} /> Mover para Lixeira
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {expanded && (
                  <div className="project-card-body">
                    {subs.length === 0 ? (
                      <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', padding: 'var(--sp-3) 0', textAlign: 'center' }}>
                        Nenhuma subtarefa ainda. Adicione blocos de execução abaixo.
                      </p>
                    ) : (
                      <DragDropContext onDragEnd={(result) => handleDragEnd(result, project.id)}>
                        <Droppable droppableId={`droppable-${project.id}`}>
                          {(provided) => (
                            <div 
                              {...provided.droppableProps} 
                              ref={provided.innerRef} 
                              style={{ padding: 'var(--sp-3) 0' }}
                            >
                              {subs.sort((a, b) => (a.order || 0) - (b.order || 0)).map((sub, index) => (
                                <Draggable key={sub.id} draggableId={sub.id} index={index} isDragDisabled={isMobile}>
                                  {(provided, snapshot) => (
                                    <div 
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      className={`subtask-item ${sub.completed ? 'subtask-item--completed' : ''}`}
                                      style={{
                                        ...provided.draggableProps.style,
                                        background: snapshot.isDragging ? 'var(--bg-hover)' : 'transparent',
                                        boxShadow: snapshot.isDragging ? 'var(--shadow-md)' : 'none',
                                        borderRadius: 'var(--radius-md)',
                                        zIndex: snapshot.isDragging ? 100 : 'auto',
                                        position: snapshot.isDragging ? 'relative' : 'static',
                                      }}
                                    >
                                      {!isMobile && (
                                        <div 
                                          {...provided.dragHandleProps}
                                          style={{ display: 'flex', alignItems: 'center', cursor: 'grab', padding: '0 4px', color: 'var(--text-tertiary)', marginRight: 'var(--sp-1)' }}
                                          title="Arrastar para reordenar"
                                        >
                                          <GripVertical size={14} />
                                        </div>
                                      )}
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
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </DragDropContext>
                    )}

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
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Categoria</label>
              <select className="form-select" value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">Sem categoria</option>
                {PROJECT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="ativo">Ativo</option>
                <option value="pausado">Pausado</option>
                <option value="concluído">Concluído</option>
                <option value="arquivado">Arquivado</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Data de Início</label>
              <input type="date" className="form-input" value={form.startDate || ''} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Data Prevista (Opcional)</label>
              <input type="date" className="form-input" value={form.targetDate || ''} onChange={e => setForm({ ...form, targetDate: e.target.value })} />
            </div>
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
