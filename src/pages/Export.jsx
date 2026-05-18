import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import Modal from '../components/Modal';
import { Download, Upload, FileText, FileJson, Calendar, CheckSquare, DollarSign, Lightbulb, FlaskConical, ClipboardList, BarChart3, Dumbbell, Trash2, Palette, Check, RefreshCw, Database, Layers } from 'lucide-react';
import { db } from '../data/db';
import { clearDemoData, loadDemoData } from '../data/seed';

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

const accents = [
  { id: 'purple', name: 'Roxo', color: '#6c5ce7' },
  { id: 'rosa', name: 'Rosa (Novo)', color: '#ec4899' },
  { id: 'green', name: 'Verde', color: '#10b981' },
  { id: 'red', name: 'Vermelho', color: '#dc2626' },
  { id: 'blue', name: 'Azul', color: '#3b82f6' },
  { id: 'gold', name: 'Dourado', color: '#d97706' },
  { id: 'gray', name: 'Cinza', color: '#6b7280' },
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
  const [currentAccent, setCurrentAccent] = useState('purple');

  useEffect(() => {
    // Migration logic for old theme strings (e.g. "dark-purple")
    const legacyTheme = localStorage.getItem('cp_theme');
    let mode = localStorage.getItem('cp_mode') || 'dark';
    let accent = localStorage.getItem('cp_accent') || 'purple';

    if (legacyTheme && legacyTheme.startsWith('dark-')) {
      mode = 'dark';
      accent = legacyTheme.split('dark-')[1];
      localStorage.removeItem('cp_theme');
      localStorage.setItem('cp_mode', mode);
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

  const handleRestoreDemo = () => {
    if (window.confirm('Isso apagará seus dados atuais e carregará dados de demonstração. Deseja continuar?')) {
      db.clearAll();
      db.clearDemoFlag();
      loadDemoData(true);
      appState.refreshAll();
      alert('Dados de demonstração carregados.');
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

  const handleClearDemo = () => {
    clearDemoData();
    appState.refreshAll();
    setShowConfirmClear(false);
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
    <div className="page-container">
      <div className="page-header">
        <h1>Configurações</h1>
        <p>Aparência, backup e gerenciamento de dados do sistema</p>
      </div>

      <div className="grid grid-2" style={{ alignItems: 'flex-start' }}>
        {/* Appearance Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <Palette size={16} /> Fundo e Luminosidade
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-4)' }}>
              Escolha entre o conforto noturno ou o brilho de alta legibilidade.
            </p>
            <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
              <button
                key="dark"
                className={`btn ${currentMode === 'dark' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => handleModeChange('dark')}
                style={{ flex: 1 }}
              >
                Escuro
              </button>
              <button
                key="light"
                className={`btn ${currentMode === 'light' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => handleModeChange('light')}
                style={{ flex: 1 }}
              >
                Claro
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <Palette size={16} /> Cor de Destaque
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-4)' }}>
              Identidade visual do sistema.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
              {accents.map((accent) => {
                const isActive = currentAccent === accent.id;
                return (
                  <button
                    key={accent.id}
                    onClick={() => handleAccentChange(accent.id)}
                    title={accent.name}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      backgroundColor: accent.color,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all var(--transition-fast)',
                      boxShadow: isActive ? `0 0 0 3px var(--bg-secondary), 0 0 0 6px ${accent.color}` : 'none',
                      opacity: isActive ? 1 : 0.7,
                    }}
                  >
                    {isActive && <Check size={20} color="#ffffff" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <Database size={16} /> Banco de Dados
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-4)' }}>
              Ações críticas sobre as informações salvas localmente.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              <button className="btn btn-secondary" onClick={handleRestoreDemo} style={{ justifyContent: 'center' }}>
                <RefreshCw size={16} /> Restaurar Dados de Demo
              </button>
              <button className="btn btn-danger" onClick={handleResetData} style={{ justifyContent: 'center', background: 'var(--danger-subtle)', color: 'var(--danger)' }}>
                <Trash2 size={16} /> Apagar Tudo (Reset)
              </button>
            </div>
          </div>
        </div>

        {/* Export/Import logic */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <Download size={16} /> Exportação de Dados
              </span>
            </div>
            {/* Formato */}
            <div style={{ marginBottom: 'var(--sp-4)' }}>
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <button className={`btn ${format === 'csv' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setFormat('csv')}>
                  CSV
                </button>
                <button className={`btn ${format === 'json' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setFormat('json')}>
                  JSON
                </button>
              </div>
            </div>

            {/* Período */}
            <div className="form-row" style={{ marginBottom: 'var(--sp-4)' }}>
              <div className="form-group">
                <label className="form-label">De</label>
                <input className="form-input" type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Até</label>
                <input className="form-input" type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
              </div>
            </div>

            {/* Módulos */}
            <div style={{ marginBottom: 'var(--sp-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-2)' }}>
                <span className="form-label">Módulos</span>
                <button className="btn btn-ghost btn-sm" onClick={selectAll} style={{ padding: 0 }}>Todos</button>
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

            <button className="btn btn-primary" style={{ width: '100%', padding: 'var(--sp-3)' }} onClick={handleExport}
              disabled={selectedModules.length === 0}>
              <Download size={16} /> Iniciar Exportação
            </button>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <Upload size={16} /> Importar Backup
              </span>
            </div>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-4)' }}>
              Substitua todos os dados locais por um arquivo JSON exportado anteriormente.
            </p>
            <label className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', cursor: 'pointer' }}>
              <Upload size={16} /> Escolher Arquivo .json
              <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
            </label>
          </div>

          {/* Complementary Import */}
          <div className="card" style={{ border: '1px solid var(--accent-glow)' }}>
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <Layers size={16} style={{ color: 'var(--accent)' }} /> Importar Complemento
              </span>
            </div>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-3)' }}>
              Adicione dados de outro dispositivo sem apagar os atuais. Apenas módulos de conhecimento e revisão serão importados.
            </p>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-4)', display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-1)' }}>
              {mergeableModules.map(m => (
                <span key={m.key} className="badge badge-accent" style={{ fontSize: '10px' }}>{m.label}</span>
              ))}
            </div>
            <label className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', cursor: 'pointer' }}>
              <Layers size={16} /> Selecionar Backup para Complementar
              <input type="file" accept=".json" onChange={handleMergeImportFile} style={{ display: 'none' }} />
            </label>
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
