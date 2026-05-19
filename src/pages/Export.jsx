import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import Modal from '../components/Modal';
import { Download, Upload, FileText, FileJson, Calendar, CheckSquare, DollarSign, Lightbulb, FlaskConical, ClipboardList, BarChart3, Dumbbell, Trash2, Palette, Check, RefreshCw, Database, Layers } from 'lucide-react';
import { db } from '../data/db';

const modules = [
  { key: 'tasks', label: 'Tarefas', icon: CheckSquare, stateKey: 'tasks' },
  { key: 'finance', label: 'Finanças', icon: DollarSign, stateKey: 'finance' },
  { key: 'learnings', label: 'Aprendizados', icon: Lightbulb, stateKey: 'learnings' },
  { key: 'experiments', label: 'Experimentos', icon: FlaskConical, stateKey: 'experiments' },
  { key: 'weeklyReviews', label: 'Revisões Semanais', icon: ClipboardList, stateKey: 'weeklyReviews' },
  { key: 'dailyCheckIns', label: 'Check-ins Diários', icon: BarChart3, stateKey: 'dailyCheckIns' },
  { key: 'timeAllocations', label: 'Alocação de Tempo', icon: Calendar, stateKey: 'timeAllocations' },
  { key: 'workoutRoutines', label: 'Rotinas de Treino', icon: Dumbbell, stateKey: 'workoutRoutines' },
  { key: 'workoutLogs', label: 'Logs de Treino', icon: Dumbbell, stateKey: 'workoutLogs' },
  { key: 'projects', label: 'Projetos', icon: CheckSquare, stateKey: 'projects' },
];

// Modules allowed for complementary import
const mergeableModules = [
  { key: 'learnings', label: 'Aprendizados', icon: Lightbulb, stateKey: 'learnings' },
  { key: 'experiments', label: 'Experimentos', icon: FlaskConical, stateKey: 'experiments' },
  { key: 'weeklyReviews', label: 'Revisões Semanais', icon: ClipboardList, stateKey: 'weeklyReviews' },
  { key: 'dailyCheckIns', label: 'Check-ins Diários', icon: BarChart3, stateKey: 'dailyCheckIns' },
  { key: 'timeAllocations', label: 'Alocação de Tempo', icon: Calendar, stateKey: 'timeAllocations' },
];

// CSV column mappings for readable pt-BR export
const csvMappings = {
  tasks: {
    columns: ['titulo', 'descricao', 'prioridade', 'horas_estimadas', 'status', 'data_limite', 'data_agendada', 'categoria', 'criado_em', 'concluido_em'],
    map: t => [t.title, t.description || '', t.priority, t.estimatedHours || '', t.status, t.dueDate || '', t.scheduledDate || '', t.category || '', t.createdAt, t.completedAt || ''],
  },
  finance: {
    columns: ['tipo', 'valor', 'categoria', 'subcategoria', 'fonte_atividade', 'data', 'observacoes', 'criado_em'],
    map: f => [f.type, f.amount, f.category, f.subcategory || '', f.source, f.date, f.notes || '', f.createdAt],
  },
  learnings: {
    columns: ['tipo', 'conteudo', 'data', 'tags', 'favorito', 'fonte', 'criado_em'],
    map: l => [l.type, l.content, l.date, (l.tags || []).join(';'), l.favorite ? 'sim' : 'não', l.source || '', l.createdAt],
  },
  experiments: {
    columns: ['titulo', 'categoria', 'contexto', 'o_que_foi_testado', 'resultado', 'principal_erro', 'licao_aprendida', 'repetir', 'data', 'notas', 'criado_em'],
    map: e => [e.title, e.category, e.context, e.whatWasTested, e.result, e.mainError || '', e.lessonLearned, e.repeatThis, e.date, e.notes || '', e.createdAt],
  },
  weeklyReviews: {
    columns: ['semana_ref', 'inicio', 'fim', 'o_que_funcionou', 'o_que_nao_funcionou', 'tempo_desperdicado', 'dinheiro_desperdicado', 'maiores_aprendizados', 'principais_conquistas', 'foco_proxima_semana', 'criado_em'],
    map: w => [w.weekRef, w.weekStart, w.weekEnd, w.whatWorked, w.whatDidNotWork, w.timeWasted, w.moneyWasted, w.biggestLearnings, w.mainWins, w.focusNextWeek, w.createdAt],
  },
  dailyCheckIns: {
    columns: ['data', 'qualidade_do_dia', 'energia', 'foco', 'criado_em'],
    map: c => [c.date, c.dayQuality, c.energy, c.focus, c.createdAt],
  },
  timeAllocations: {
    columns: ['data', 'categoria', 'horas', 'criado_em'],
    map: t => [t.date, t.category, t.hours, t.createdAt],
  },
  workoutRoutines: {
    columns: ['dia_semana', 'dia_nome', 'descanso', 'tipo_treino', 'foco_planejado', 'notas'],
    map: r => [r.dayOfWeek, r.dayName, r.isRestDay ? 'sim' : 'não', r.workoutType || '', r.plannedFocus || '', r.notes || ''],
  },
  workoutLogs: {
    columns: ['data', 'treinou', 'treino_realizado', 'seguiu_plano', 'como_foi', 'energia', 'notas', 'criado_em'],
    map: w => [w.date, w.didTrain ? 'sim' : 'não', w.workoutDone || '', w.followedPlan ? 'sim' : 'não', w.howItWent || '', w.energy || '', w.notes || '', w.createdAt],
  },
};



const premiumAccents = [
  { id: 'purple-premium', name: 'Roxo Premium', color: 'linear-gradient(135deg, #8b5cf6, #4c1d95)' },
  { id: 'rosa-premium', name: 'Rosa Premium', color: 'linear-gradient(135deg, #ec4899, #831843)' },
  { id: 'green-premium', name: 'Verde Premium', color: 'linear-gradient(135deg, #10b981, #064e3b)' },
  { id: 'red-premium', name: 'Vermelho Premium', color: 'linear-gradient(135deg, #ef4444, #450a0a)' },
  { id: 'blue-premium', name: 'Azul Premium', color: 'linear-gradient(135deg, #3b82f6, #1e3a8a)' },
  { id: 'gold-premium', name: 'Dourado Premium', color: 'linear-gradient(135deg, #f59e0b, #451a03)' },
  { id: 'gray-premium', name: 'Cinza Premium', color: 'linear-gradient(135deg, #9ca3af, #1f2937)' },
];

function escapeCSV(val) {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function generateCSV(data, mapping) {
  const header = mapping.columns.join(',');
  const rows = data.map(item => mapping.map(item).map(escapeCSV).join(','));
  return header + '\n' + rows.join('\n');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Config() {
  const appState = useApp();
  const [selectedModules, setSelectedModules] = useState(modules.map(m => m.key));
  const [format, setFormat] = useState('csv');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [mergePreview, setMergePreview] = useState(null); // { summary: [...], rawData, fileName }

  // Theme state
  const [currentMode, setCurrentMode] = useState('dark');
  const [currentAccent, setCurrentAccent] = useState('purple-premium');

  useEffect(() => {
    // Migration logic for old theme strings (e.g. "dark-purple")
    const legacyTheme = localStorage.getItem('cp_theme');
    let mode = localStorage.getItem('cp_mode') || 'dark';
    let accent = localStorage.getItem('cp_accent') || 'purple-premium';

    if (legacyTheme && legacyTheme.startsWith('dark-')) {
      mode = 'dark';
      accent = legacyTheme.split('dark-')[1];
      localStorage.removeItem('cp_theme');
      localStorage.setItem('cp_mode', mode);
      localStorage.setItem('cp_accent', accent);
    }

    // Force accent migration if it's solid color
    if (accent && !accent.endsWith('-premium')) {
      accent = `${accent}-premium`;
      localStorage.setItem('cp_accent', accent);
    }

    setCurrentMode(mode);
    setCurrentAccent(accent);
  }, []);

  const handleModeChange = (mode) => {
    setCurrentMode(mode);
    localStorage.setItem('cp_mode', mode);
    document.documentElement.setAttribute('data-mode', mode);
  };

  const handleAccentChange = (accentId) => {
    setCurrentAccent(accentId);
    localStorage.setItem('cp_accent', accentId);
    document.documentElement.setAttribute('data-accent', accentId);
  };

  const handleResetData = () => {
    if (window.confirm('Tem certeza? Isso apagará TODOS os seus dados permanentemente. Essa ação não pode ser desfeita.')) {
      db.clearAll();
      db.setInitialized(); // Ensure reseeding never happens alone
      appState.refreshAll();
      alert('Dados apagados com sucesso.');
    }
  };

  const toggleModule = (key) => {
    setSelectedModules(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const selectAll = () => setSelectedModules(modules.map(m => m.key));
  const selectNone = () => setSelectedModules([]);

  const filterByDate = (data) => {
    if (!dateStart && !dateEnd) return data;
    return data.filter(item => {
      const itemDate = item.date || item.scheduledDate || item.dueDate || item.weekStart || (item.createdAt ? item.createdAt.split('T')[0] : '');
      if (dateStart && itemDate < dateStart) return false;
      if (dateEnd && itemDate > dateEnd) return false;
      return true;
    });
  };

  const handleExport = () => {
    const timestamp = new Date().toISOString().split('T')[0];

    if (format === 'json') {
      const exportData = {};
      selectedModules.forEach(key => {
        const mod = modules.find(m => m.key === key);
        const data = filterByDate(appState[mod.stateKey] || []);
        exportData[key] = data;
      });
      exportData._metadata = {
        exportado_em: new Date().toISOString(),
        app: 'Lyria',
        versao_backup: '1.0',
        modulos: selectedModules,
        periodo: { inicio: dateStart || 'todos', fim: dateEnd || 'todos' },
      };
      downloadFile(JSON.stringify(exportData, null, 2), `comando_pessoal_${timestamp}.json`, 'application/json');
    } else {
      // CSV - export each module separately
      selectedModules.forEach(key => {
        const mod = modules.find(m => m.key === key);
        const data = filterByDate(appState[mod.stateKey] || []);
        if (data.length === 0) return;
        const mapping = csvMappings[key];
        if (!mapping) return;
        const csv = generateCSV(data, mapping);
        downloadFile(csv, `${key}_${timestamp}.csv`, 'text/csv');
      });
    }
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        
        if (!data._metadata || (data._metadata.app !== 'Personal Performance OS' && data._metadata.app !== 'Lyria')) {
          alert('Arquivo inválido. O arquivo selecionado não é um backup válido do aplicativo.');
          return;
        }
        
        const confirmed = window.confirm(`Backup da versão ${data._metadata.versao_backup || 'anterior'} encontrado.\nSeu banco de dados local será substituído inteiramente pelo conteúdo deste arquivo.\n\nDeseja continuar e restaurar os dados?`);
        if (!confirmed) {
          e.target.value = '';
          return;
        }

        modules.forEach(mod => {
          if (data[mod.key]) {
            db.set(mod.stateKey, data[mod.key]);
          }
        });
        
        appState.refreshAll();
        alert('Backup restaurado com sucesso! Seus painéis foram atualizados.');

      } catch (err) {
        alert('Erro ao ler o arquivo JSON. Ele pode estar corrompido ou mal formatado.');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  // ===== Complementary Import =====
  const handleMergeImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);

        if (!data._metadata || (data._metadata.app !== 'Personal Performance OS' && data._metadata.app !== 'Lyria')) {
          alert('Arquivo inválido. O arquivo selecionado não é um backup válido do Lyria.');
          e.target.value = '';
          return;
        }

        // Build merge preview
        const summary = [];
        mergeableModules.forEach(mod => {
          const incoming = data[mod.key];
          if (!incoming || !Array.isArray(incoming) || incoming.length === 0) {
            summary.push({ key: mod.key, label: mod.label, found: 0, newItems: 0, duplicates: 0 });
            return;
          }

          const current = appState[mod.stateKey] || [];
          const currentIds = new Set(current.map(item => item.id).filter(Boolean));

          let newItems = 0;
          let duplicates = 0;
          incoming.forEach(item => {
            if (item.id && currentIds.has(item.id)) {
              duplicates++;
            } else {
              // Secondary check by date+content for items without reliable IDs
              const isDuplicate = current.some(existing => {
                if (mod.key === 'learnings') return existing.date === item.date && existing.content === item.content;
                if (mod.key === 'experiments') return existing.date === item.date && existing.title === item.title;
                if (mod.key === 'weeklyReviews') return existing.weekRef === item.weekRef;
                if (mod.key === 'dailyCheckIns') return existing.date === item.date;
                if (mod.key === 'timeAllocations') return existing.date === item.date && existing.category === item.category && existing.hours === item.hours;
                return false;
              });
              if (isDuplicate) duplicates++;
              else newItems++;
            }
          });

          summary.push({ key: mod.key, label: mod.label, found: incoming.length, newItems, duplicates });
        });

        setMergePreview({ summary, rawData: data, fileName: file.name });
      } catch (err) {
        alert('Erro ao ler o arquivo JSON. Ele pode estar corrompido ou mal formatado.');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleConfirmMerge = () => {
    if (!mergePreview) return;
    const { rawData } = mergePreview;

    mergeableModules.forEach(mod => {
      const incoming = rawData[mod.key];
      if (!incoming || !Array.isArray(incoming) || incoming.length === 0) return;

      const current = appState[mod.stateKey] || [];
      const currentIds = new Set(current.map(item => item.id).filter(Boolean));

      const toAdd = incoming.filter(item => {
        if (item.id && currentIds.has(item.id)) return false;
        const isDuplicate = current.some(existing => {
          if (mod.key === 'learnings') return existing.date === item.date && existing.content === item.content;
          if (mod.key === 'experiments') return existing.date === item.date && existing.title === item.title;
          if (mod.key === 'weeklyReviews') return existing.weekRef === item.weekRef;
          if (mod.key === 'dailyCheckIns') return existing.date === item.date;
          if (mod.key === 'timeAllocations') return existing.date === item.date && existing.category === item.category && existing.hours === item.hours;
          return false;
        });
        return !isDuplicate;
      });

      if (toAdd.length > 0) {
        const merged = [...current, ...toAdd];
        db.set(mod.stateKey, merged);
      }
    });

    appState.refreshAll();
    const totalNew = mergePreview.summary.reduce((s, m) => s + m.newItems, 0);
    setMergePreview(null);
    alert(`Importação complementar concluída! ${totalNew} novo(s) registro(s) adicionado(s).`);
  };

  const getModuleCount = (key) => {
    const mod = modules.find(m => m.key === key);
    return (appState[mod.stateKey] || []).length;
  };

  return (
    <div className="page-container" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <h1>Configurações</h1>
        <p>Aparência, backup e gerenciamento de dados do sistema</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
        
        {/* SECTION 1 — APARÊNCIA */}
        <div style={{ paddingBottom: 'var(--sp-8)', borderBottom: '1px solid var(--border-soft)' }}>
          <h3 style={{ fontSize: 'var(--fs-lg)', color: 'var(--text-primary)', marginBottom: 'var(--sp-6)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontWeight: 600 }}>
            <Palette size={18} /> Aparência
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--sp-8)' }}>
            <div>
              <label className="form-label" style={{ marginBottom: 'var(--sp-3)' }}>Fundo e Luminosidade</label>
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <button
                  className={`btn ${currentMode === 'dark' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => handleModeChange('dark')}
                  style={{ flex: 1 }}
                >
                  Escuro
                </button>
                <button
                  className={`btn ${currentMode === 'light' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => handleModeChange('light')}
                  style={{ flex: 1 }}
                >
                  Claro
                </button>
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
                <label className="form-label" style={{ margin: 0 }}>Cor de Destaque</label>
                <span style={{ fontSize: '10px', background: 'var(--accent-subtle)', color: 'var(--accent)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Premium</span>
              </div>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-3)' }}>Atmosfera imersiva e cinematográfica com degradês suaves e profundidade.</p>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
                {premiumAccents.map((accent) => {
                  const isActive = currentAccent === accent.id;
                  return (
                    <button
                      key={accent.id}
                      onClick={() => handleAccentChange(accent.id)}
                      title={accent.name}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: accent.color,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all var(--transition-fast)',
                        boxShadow: isActive ? `0 0 0 3px var(--bg-secondary), 0 0 0 6px var(--accent)` : 'none',
                        opacity: isActive ? 1 : 0.6,
                      }}
                    >
                      {isActive && <Check size={18} color="#ffffff" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2 — BACKUP E EXPORTAÇÃO */}
        <div style={{ paddingBottom: 'var(--sp-8)', borderBottom: '1px solid var(--border-soft)' }}>
          <h3 style={{ fontSize: 'var(--fs-lg)', color: 'var(--text-primary)', marginBottom: 'var(--sp-6)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontWeight: 600 }}>
            <Database size={18} /> Exportar Dados
          </h3>

          <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap', marginBottom: 'var(--sp-4)' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="form-label" style={{ fontSize: 'var(--fs-xs)' }}>Formato</label>
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <button className={`btn ${format === 'csv' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setFormat('csv')}>CSV</button>
                <button className={`btn ${format === 'json' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setFormat('json')}>JSON</button>
              </div>
            </div>

            <div style={{ flex: 2, minWidth: 300, display: 'flex', gap: 'var(--sp-3)' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ fontSize: 'var(--fs-xs)' }}>A partir de</label>
                <input className="form-input" type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ fontSize: 'var(--fs-xs)' }}>Até</label>
                <input className="form-input" type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 'var(--sp-4)', background: 'var(--bg-tertiary)', padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
              <span className="form-label" style={{ margin: 0, fontSize: 'var(--fs-xs)' }}>Módulos para exportar</span>
              <button className="btn btn-ghost btn-sm" onClick={selectAll} style={{ padding: 0, height: 'auto', fontSize: 'var(--fs-xs)' }}>Selecionar Todos</button>
            </div>
            <div className="grid grid-2" style={{ gap: 'var(--sp-2)' }}>
              {modules.map(mod => (
                <label key={mod.key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}>
                  <input type="checkbox" checked={selectedModules.includes(mod.key)} onChange={() => toggleModule(mod.key)} style={{ accentColor: 'var(--accent)' }} />
                  <span style={{ color: selectedModules.includes(mod.key) ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{mod.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleExport} disabled={selectedModules.length === 0}>
            <Download size={16} /> Gerar e Baixar Exportação
          </button>
        </div>

        {/* SECTION 3 — IMPORTAÇÃO */}
        <div style={{ paddingBottom: 'var(--sp-8)', borderBottom: '1px solid var(--border-soft)' }}>
          <h3 style={{ fontSize: 'var(--fs-lg)', color: 'var(--text-primary)', marginBottom: 'var(--sp-6)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontWeight: 600 }}>
            <Upload size={18} /> Restauração e Importação
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--sp-4)' }}>
            <div style={{ padding: 'var(--sp-4)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)' }}>
              <h4 style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', marginBottom: 'var(--sp-2)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <Upload size={14} /> Importar Backup
              </h4>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-4)', minHeight: 32 }}>
                Substitui integralmente seu banco de dados atual por um arquivo .json de backup.
              </p>
              <label className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', cursor: 'pointer' }}>
                <Upload size={14} /> Escolher Arquivo
                <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
              </label>
            </div>

            <div style={{ padding: 'var(--sp-4)', border: '1px solid var(--accent-glow)', borderRadius: 'var(--radius-md)', background: 'var(--accent-subtle)' }}>
              <h4 style={{ fontSize: 'var(--fs-sm)', color: 'var(--accent)', marginBottom: 'var(--sp-2)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <Layers size={14} /> Importar Complemento
              </h4>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent)', opacity: 0.8, marginBottom: 'var(--sp-4)', minHeight: 32 }}>
                Soma novos registros (Aprendizados, Experimentos, etc) ao seu banco atual, sem apagar nada.
              </p>
              <label className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', cursor: 'pointer' }}>
                <Layers size={14} /> Escolher Complemento
                <input type="file" accept=".json" onChange={handleMergeImportFile} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
        </div>

        {/* SECTION 4 — SISTEMA / DADOS (ZONA DE PERIGO) */}
        <div style={{ marginTop: 'var(--sp-4)', padding: 'var(--sp-5)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--danger-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
            <div>
              <h4 style={{ fontSize: 'var(--fs-sm)', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <Trash2 size={16} /> Zona de Perigo
              </h4>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                Apagar permanentemente todos os dados do aplicativo. Esta ação não tem volta.
              </p>
            </div>
            <button className="btn" onClick={handleResetData} style={{ background: 'var(--danger-subtle)', color: 'var(--danger)', border: 'none' }}>
              Apagar Tudo (Reset)
            </button>
          </div>
        </div>
      </div>
      {/* Merge Preview Modal */}
      {mergePreview && (
        <Modal title="Importação Complementar" onClose={() => setMergePreview(null)}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-4)' }}>
            Arquivo: <strong style={{ color: 'var(--text-primary)' }}>{mergePreview.fileName}</strong>
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', marginBottom: 'var(--sp-5)' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 100px', gap: 'var(--sp-2)', padding: '0 var(--sp-2)', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <span>Módulo</span>
              <span style={{ textAlign: 'center' }}>Encontrados</span>
              <span style={{ textAlign: 'center' }}>Novos</span>
              <span style={{ textAlign: 'center' }}>Duplicados</span>
            </div>

            {mergePreview.summary.map(row => (
              <div key={row.key} style={{
                display: 'grid', gridTemplateColumns: '1fr 80px 80px 100px', gap: 'var(--sp-2)',
                padding: 'var(--sp-2) var(--sp-2)',
                background: row.newItems > 0 ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-sm)',
              }}>
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{row.label}</span>
                <span style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{row.found}</span>
                <span style={{ textAlign: 'center', fontWeight: 600, color: row.newItems > 0 ? 'var(--success)' : 'var(--text-tertiary)' }}>{row.newItems}</span>
                <span style={{ textAlign: 'center', color: row.duplicates > 0 ? 'var(--warning)' : 'var(--text-tertiary)' }}>{row.duplicates}</span>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-3) var(--sp-4)', marginBottom: 'var(--sp-4)', display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Total de novos registros:</span>
            <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{mergePreview.summary.reduce((s, m) => s + m.newItems, 0)}</span>
          </div>

          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setMergePreview(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleConfirmMerge}
              disabled={mergePreview.summary.reduce((s, m) => s + m.newItems, 0) === 0}>
              Confirmar Importação Complementar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
