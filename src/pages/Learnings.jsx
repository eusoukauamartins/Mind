import { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { BookOpen, Plus, Search, Star, Trash2, Edit2, GripVertical, ChevronDown, ChevronRight, X } from 'lucide-react';
import { toLocalISODate } from '../utils/helpers';

const normalizeTag = (tag) => {
  if (!tag) return '';
  return tag.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const defaultLearning = () => ({
  content: '',
  source: '',
  tags: [],
  isFavorite: false,
  date: toLocalISODate(new Date()),
  order: 0
});

export default function Learnings() {
  const { learnings, createItem, updateItem, updateBatch, deleteItem } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultLearning());
  const [tagInput, setTagInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [expandedIds, setExpandedIds] = useState({});
  const [selectedTagFilter, setSelectedTagFilter] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const tagInputRef = useRef(null);

  const tagStats = useMemo(() => {
    const stats = {};
    learnings.forEach(item => {
      const normTags = (item.tags || []).map(normalizeTag);
      const uniqueTags = Array.from(new Set(normTags));
      uniqueTags.forEach(t => {
        if (!t) return;
        stats[t] = (stats[t] || 0) + 1;
      });
    });
    return Object.entries(stats)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [learnings]);

  const existingTags = tagStats.map(s => s.tag);

  // Auto-normalize existing tags silently during grouping
  const groupedLearnings = useMemo(() => {
    let filtered = [...learnings];

    if (showFavoritesOnly) {
      filtered = filtered.filter(l => l.isFavorite);
    }

    if (selectedTagFilter) {
      filtered = filtered.filter(l => {
        const normTags = (l.tags || []).map(normalizeTag);
        return normTags.includes(selectedTagFilter);
      });
    }

    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(l => 
        (l.content || '').toLowerCase().includes(lower) ||
        (l.source || '').toLowerCase().includes(lower) ||
        (l.tags || []).some(t => t.toLowerCase().includes(lower))
      );
    }

    const groups = {};

    filtered.forEach(item => {
      // Normalize tags for display grouping
      const normTags = (item.tags || []).map(normalizeTag);
      const primaryGroup = normTags.length > 0 ? normTags[0] : 'geral';

      if (!groups[primaryGroup]) {
        groups[primaryGroup] = [];
      }
      groups[primaryGroup].push(item);
    });

    // Sort items within each group by order property
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => (a.order || 0) - (b.order || 0));
    });

    // Sort group keys alphabetically, keeping 'geral' at the end
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === 'geral') return 1;
      if (b === 'geral') return -1;
      return a.localeCompare(b);
    });

    return { groups, sortedKeys };
  }, [learnings, searchTerm, showFavoritesOnly]);

  const toggleExpanded = (id) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleEdit = (item, e) => {
    e.stopPropagation();
    setForm({ ...defaultLearning(), ...item });
    setEditing(item.id);
    setShowModal(true);
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (window.confirm('Excluir este aprendizado permanentemente?')) {
      deleteItem('learnings', id);
    }
  };

  const toggleFavorite = (id, current, e) => {
    e.stopPropagation();
    updateItem('learnings', id, { isFavorite: !current });
  };

  const handleAddTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = normalizeTag(tagInput);
      if (newTag && !form.tags.includes(newTag)) {
        setForm(prev => ({ ...prev, tags: [...prev.tags, newTag] }));
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tagToRemove) }));
  };

  const handleSubmit = () => {
    if (!form.content.trim()) return;
    
    // Normalize tags on save
    const normalizedTags = Array.from(new Set(form.tags.map(normalizeTag)));
    const payload = { ...form, tags: normalizedTags };

    if (editing) {
      updateItem('learnings', editing, payload);
    } else {
      createItem('learnings', payload);
    }
    
    setShowModal(false);
    setEditing(null);
    setForm(defaultLearning());
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const groupKey = result.source.droppableId;
    
    // For simplicity, we only allow reordering inside the same category visual group
    if (result.destination.droppableId !== groupKey) return;

    const groupItems = Array.from(groupedLearnings.groups[groupKey]);
    const [reorderedItem] = groupItems.splice(result.source.index, 1);
    groupItems.splice(result.destination.index, 0, reorderedItem);

    // Prepare batch update
    const updates = groupItems.map((item, index) => ({
      id: item.id,
      changes: { order: index }
    }));
    
    updateBatch('learnings', updates);
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Aprendizados</h1>
          <p>Biblioteca de insights, referências e conhecimento estruturado</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(defaultLearning()); setEditing(null); setShowModal(true); }}>
          <Plus size={16} /> Novo Insight
        </button>
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-6)', flexWrap: 'wrap' }}>
        <div className="search-input-wrapper" style={{ position: 'relative', flex: 1, minWidth: 250, maxWidth: 500 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Pesquisar conhecimentos, tags ou fontes..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>
        <select 
          className="form-select"
          style={{ width: 'auto', minWidth: 180, padding: '8px 12px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}
          value={selectedTagFilter}
          onChange={e => setSelectedTagFilter(e.target.value)}
        >
          <option value="">Todas as Categorias</option>
          {tagStats.map(stat => (
            <option key={stat.tag} value={stat.tag}>
              {stat.tag} ({stat.count})
            </option>
          ))}
        </select>
        <button 
          className="btn" 
          style={{ 
            background: showFavoritesOnly ? 'var(--warning-subtle)' : 'var(--bg-secondary)', 
            color: showFavoritesOnly ? 'var(--warning)' : 'var(--text-secondary)',
            border: showFavoritesOnly ? '1px solid var(--warning)' : '1px solid transparent'
          }}
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
        >
          <Star size={16} fill={showFavoritesOnly ? "currentColor" : "none"} /> Favoritos
        </button>
      </div>

      {learnings.length === 0 ? (
        <EmptyState 
          icon={BookOpen} 
          title="Nenhum insight registrado"
          description="Transforme conteúdos consumidos em blocos de conhecimento estruturados."
          action={<button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Novo Insight</button>}
        />
      ) : groupedLearnings.sortedKeys.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-tertiary)' }}>
          Nenhum resultado encontrado para os filtros atuais.
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-8)' }}>
            {groupedLearnings.sortedKeys.map(groupKey => (
              <div key={groupKey}>
                <h3 style={{ 
                  fontSize: 'var(--fs-sm)', 
                  fontWeight: 600, 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.05em', 
                  color: 'var(--text-tertiary)',
                  marginBottom: 'var(--sp-3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-2)'
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }}></div>
                  {groupKey}
                  <span style={{ fontSize: 'var(--fs-xs)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '10px' }}>
                    {groupedLearnings.groups[groupKey].length}
                  </span>
                </h3>

                <Droppable droppableId={groupKey}>
                  {(provided) => (
                    <div 
                      {...provided.droppableProps} 
                      ref={provided.innerRef}
                      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}
                    >
                      {groupedLearnings.groups[groupKey].map((item, index) => {
                        const isExpanded = expandedIds[item.id];
                        
                        return (
                          <Draggable key={item.id} draggableId={item.id} index={index}>
                            {(provided, snapshot) => {
                              const draggableStyle = {
                                ...provided.draggableProps.style,
                                padding: 'var(--sp-3)',
                                cursor: 'pointer',
                                background: snapshot.isDragging ? 'var(--bg-hover)' : 'var(--bg-secondary)',
                                border: item.isFavorite ? '1px solid var(--warning-subtle)' : '1px solid var(--border)',
                                boxShadow: snapshot.isDragging ? 'var(--shadow-lg)' : 'none',
                                opacity: snapshot.isDragging ? 0.95 : 1,
                                zIndex: snapshot.isDragging ? 100 : 'auto',
                              };

                              // Lock drag axis to vertical only
                              if (draggableStyle.transform) {
                                draggableStyle.transform = draggableStyle.transform.replace(/translate\([^,]+,/, 'translate(0px,');
                              }

                              return (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className="project-card"
                                  onClick={() => toggleExpanded(item.id)}
                                  style={draggableStyle}
                                >
                                <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                                  <div 
                                    {...provided.dragHandleProps}
                                    style={{ display: 'flex', alignItems: 'flex-start', paddingTop: 2, cursor: 'grab', color: 'var(--text-tertiary)' }}
                                    title="Arrastar para reordenar"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <GripVertical size={16} />
                                  </div>
                                  
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ 
                                      fontSize: 'var(--fs-sm)', 
                                      color: 'var(--text-primary)', 
                                      lineHeight: 1.6,
                                      whiteSpace: 'pre-wrap',
                                      display: isExpanded ? 'block' : '-webkit-box',
                                      WebkitLineClamp: isExpanded ? 'unset' : 3,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden'
                                    }}>
                                      {item.content}
                                    </div>
                                    
                                    {isExpanded && (
                                      <div style={{ marginTop: 'var(--sp-4)', paddingTop: 'var(--sp-3)', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', alignItems: 'center', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                                        {item.source && (
                                          <div><strong>Fonte:</strong> {item.source}</div>
                                        )}
                                        {item.date && (
                                          <div><strong>Registrado em:</strong> {item.date.split('-').reverse().join('/')}</div>
                                        )}
                                        {item.tags && item.tags.length > 0 && (
                                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                            {item.tags.map(t => (
                                              <span key={t} style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>#{t}</span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                    <button 
                                      className="btn-icon btn-ghost" 
                                      onClick={(e) => toggleFavorite(item.id, item.isFavorite, e)}
                                      style={{ color: item.isFavorite ? 'var(--warning)' : 'var(--text-tertiary)' }}
                                    >
                                      <Star size={16} fill={item.isFavorite ? "currentColor" : "none"} />
                                    </button>
                                    {isExpanded && (
                                      <>
                                        <button className="btn-icon btn-ghost" onClick={(e) => handleEdit(item, e)}>
                                          <Edit2 size={14} />
                                        </button>
                                        <button className="btn-icon btn-ghost" onClick={(e) => handleDelete(item.id, e)} style={{ color: 'var(--danger)' }}>
                                          <Trash2 size={14} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      )}

      {showModal && (
        <Modal title={editing ? 'Editar Insight' : 'Novo Insight Estratégico'} onClose={() => setShowModal(false)} maxWidth="600px">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            
            <div className="form-group">
              <label className="form-label">Insight / Conhecimento *</label>
              <textarea 
                className="form-textarea" 
                placeholder="Qual o aprendizado central? Seja direto e estruturado." 
                value={form.content} 
                onChange={e => setForm({ ...form, content: e.target.value })} 
                rows={5} 
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Fonte (Opcional)</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Ex: Livro X, Vídeo Y, Reunião com Z" 
                value={form.source || ''} 
                onChange={e => setForm({ ...form, source: e.target.value })} 
              />
            </div>

            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">Tags / Categorias (Pressione Enter para adicionar)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)', padding: 'var(--sp-2)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', minHeight: 42 }}>
                {form.tags.map(tag => (
                  <span key={tag} className="badge" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {tag}
                    <X size={12} style={{ cursor: 'pointer', opacity: 0.5 }} onClick={() => removeTag(tag)} />
                  </span>
                ))}
                <div style={{ position: 'relative', flex: 1, minWidth: 120 }}>
                  <input 
                    ref={tagInputRef}
                    type="text" 
                    value={tagInput} 
                    onChange={e => {
                      setTagInput(e.target.value);
                      setShowTagSuggestions(true);
                    }} 
                    onFocus={() => setShowTagSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                    onKeyDown={handleAddTag} 
                    placeholder={form.tags.length === 0 ? "Ex: marketing, operações..." : ""}
                    style={{ background: 'transparent', border: 'none', outline: 'none', color: 'inherit', width: '100%', fontSize: 'var(--fs-sm)', height: '100%', minHeight: 24 }}
                  />
                  {showTagSuggestions && tagInput.trim() && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      minWidth: 200,
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-soft)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-md)',
                      maxHeight: 200,
                      overflowY: 'auto',
                      zIndex: 1000,
                      marginTop: 4
                    }}>
                      {existingTags
                        .filter(t => t.includes(normalizeTag(tagInput)) && !form.tags.includes(t))
                        .slice(0, 8)
                        .map(tag => (
                          <div 
                            key={tag}
                            onClick={() => {
                              setForm(prev => ({ ...prev, tags: [...prev.tags, tag] }));
                              setTagInput('');
                              setShowTagSuggestions(false);
                              tagInputRef.current?.focus();
                            }}
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 'var(--fs-sm)', borderBottom: '1px solid var(--border-soft)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            {tag}
                          </div>
                        ))}
                      {existingTags.filter(t => t.includes(normalizeTag(tagInput)) && !form.tags.includes(t)).length === 0 && (
                        <div style={{ padding: '8px 12px', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                          Pressione Enter para criar a tag "{normalizeTag(tagInput)}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                A primeira tag definirá o grupo visual principal na lista.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <input 
                type="checkbox" 
                id="fav-check"
                checked={form.isFavorite} 
                onChange={e => setForm({ ...form, isFavorite: e.target.checked })} 
              />
              <label htmlFor="fav-check" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                Marcar como Favorito
              </label>
            </div>

          </div>

          <div className="form-actions" style={{ marginTop: 'var(--sp-6)' }}>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSubmit}>{editing ? 'Salvar Insight' : 'Adicionar Insight'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
