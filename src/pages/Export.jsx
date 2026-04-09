import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { Download, Upload, FileText, FileJson, Calendar, CheckSquare, DollarSign, Lightbulb, FlaskConical, ClipboardList, BarChart3, Dumbbell, Trash2 } from 'lucide-react';
import { db } from '../data/db';
import { clearDemoData } from '../data/seed';

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

export default function Export() {
  const appState = useApp();
  const [selectedModules, setSelectedModules] = useState(modules.map(m => m.key));
  const [format, setFormat] = useState('csv');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [showConfirmClear, setShowConfirmClear] = useState(false);

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
        app: 'Personal Performance OS',
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
        
        if (!data._metadata || data._metadata.app !== 'Personal Performance OS') {
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

  const getModuleCount = (key) => {
    const mod = modules.find(m => m.key === key);
    return (appState[mod.stateKey] || []).length;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Dados & Backup</h1>
        <p>Exporte, importe e gerencie o ciclo de vida dos seus dados</p>
      </div>

      <div className="grid grid-2">
        {/* Module Selection */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Módulos</span>
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <button className="btn btn-ghost btn-sm" onClick={selectAll}>Todos</button>
              <button className="btn btn-ghost btn-sm" onClick={selectNone}>Nenhum</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {modules.map(mod => (
              <label key={mod.key} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-2) var(--sp-3)',
                borderRadius: 'var(--radius-md)', cursor: 'pointer',
                background: selectedModules.includes(mod.key) ? 'var(--accent-subtle)' : 'transparent',
                transition: 'background var(--transition-fast)',
              }}>
                <input type="checkbox" checked={selectedModules.includes(mod.key)} onChange={() => toggleModule(mod.key)} style={{ accentColor: 'var(--accent)' }} />
                <mod.icon size={16} style={{ color: selectedModules.includes(mod.key) ? 'var(--accent)' : 'var(--text-tertiary)' }} />
                <span style={{ flex: 1, fontSize: 'var(--fs-base)', fontWeight: 500 }}>{mod.label}</span>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{getModuleCount(mod.key)} registros</span>
              </label>
            ))}
          </div>
        </div>

        {/* Export Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <div className="card">
            <div className="card-header"><span className="card-title">Formato</span></div>
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <button className={`btn ${format === 'csv' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setFormat('csv')}>
                <FileText size={16} /> CSV
              </button>
              <button className={`btn ${format === 'json' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setFormat('json')}>
                <FileJson size={16} /> JSON
              </button>
            </div>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-2)' }}>
              {format === 'csv' ? 'CSV: cada módulo é exportado em um arquivo separado. Ideal para planilhas.' : 'JSON: todos os módulos em um único arquivo estruturado. Ideal para análise com IA.'}
            </p>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Período (Opcional)</span></div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">De</label>
                <input className="form-input" type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Até</label>
                <input className="form-input" type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-2)' }}>
              {[
                { label: 'Esta semana', fn: () => { const d = new Date(); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); const mon = new Date(d); mon.setDate(diff); setDateStart(mon.toISOString().split('T')[0]); setDateEnd(d.toISOString().split('T')[0]); } },
                { label: 'Este mês', fn: () => { const d = new Date(); setDateStart(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`); setDateEnd(d.toISOString().split('T')[0]); } },
                { label: 'Tudo', fn: () => { setDateStart(''); setDateEnd(''); } },
              ].map(p => (
                <button key={p.label} className="btn btn-ghost btn-sm" onClick={p.fn}>{p.label}</button>
              ))}
            </div>
          </div>

          <button className="btn btn-primary" style={{ padding: 'var(--sp-4)', fontSize: 'var(--fs-md)' }} onClick={handleExport}
            disabled={selectedModules.length === 0}>
            <Download size={18} /> Baixar Dados ({selectedModules.length} {selectedModules.length === 1 ? 'módulo' : 'módulos'})
          </button>

          {/* Import Backup Feature */}
          <div className="card" style={{ marginTop: 'var(--sp-2)' }}>
            <div className="card-header"><span className="card-title">Restaurar Backup</span></div>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-4)' }}>
              Restaure um arquivo JSON gerado via <b>Baixar Dados</b>. Todos os seus dados atuais serão sobrepostos no aplicativo.
            </p>
            <label className="btn btn-secondary" style={{ display: 'flex', justifyContent: 'center', cursor: 'pointer', padding: 'var(--sp-3)' }}>
              <Upload size={18} /> Restaurar Arquivo de Backup (.json)
              <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
            </label>
          </div>

          {/* Clear Demo Data */}
          {db.isDemoLoaded() && (
            <div className="card" style={{ borderColor: 'var(--danger-subtle)' }}>
              <div className="card-header"><span className="card-title" style={{ color: 'var(--danger)' }}>Dados de Demonstração</span></div>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-3)' }}>
                O app está carregado com dados de demonstração. Você pode removê-los para começar do zero.
              </p>
              {showConfirmClear ? (
                <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                  <button className="btn btn-danger" onClick={handleClearDemo}><Trash2 size={14} /> Confirmar Remoção</button>
                  <button className="btn btn-secondary" onClick={() => setShowConfirmClear(false)}>Cancelar</button>
                </div>
              ) : (
                <button className="btn btn-danger" onClick={() => setShowConfirmClear(true)}>
                  <Trash2 size={14} /> Remover Dados de Demonstração
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
