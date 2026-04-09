import { useState, useEffect } from 'react';
import { Palette, Check, Database, RefreshCw, Trash2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { db } from '../data/db';
import { loadDemoData } from '../data/seed';

const themes = [
  { id: 'dark-purple', name: 'Roxo', color: '#6c5ce7' },
  { id: 'dark-green', name: 'Verde', color: '#10b981' },
  { id: 'dark-red', name: 'Vermelho', color: '#dc2626' },
  { id: 'dark-blue', name: 'Azul', color: '#3b82f6' },
  { id: 'dark-gold', name: 'Dourado', color: '#d97706' },
  { id: 'dark-gray', name: 'Cinza', color: '#6b7280' },
];

export default function Settings() {
  const [currentTheme, setCurrentTheme] = useState('dark-purple');

  useEffect(() => {
    const savedTheme = localStorage.getItem('cp_theme') || 'dark-purple';
    setCurrentTheme(savedTheme);
  }, []);

  const handleThemeChange = (themeId) => {
    setCurrentTheme(themeId);
    localStorage.setItem('cp_theme', themeId);
    document.documentElement.setAttribute('data-theme', themeId);
  };

  const { refreshAll } = useApp();

  const handleResetData = () => {
    if (window.confirm('Tem certeza? Isso apagará TODOS os seus dados permanentemente. Essa ação não pode ser desfeita.')) {
      db.clearAll();
      refreshAll();
      alert('Dados apagados com sucesso.');
    }
  };

  const handleRestoreDemo = () => {
    if (window.confirm('Isso apagará seus dados atuais e carregará dados de demonstração. Deseja continuar?')) {
      db.clearAll();
      db.clearDemoFlag();
      loadDemoData(true);
      refreshAll();
      alert('Dados de demonstração carregados.');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Configurações</h1>
          <p>Aparência e preferências do sistema</p>
        </div>
      </div>

      <div className="grid grid-2">
        {/* Theme Settings */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <Palette size={16} /> Aparência (Tema)
            </span>
          </div>
          
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-4)' }}>
            Escolha a cor de destaque principal do sistema.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
            {themes.map((theme) => {
              const isActive = currentTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => handleThemeChange(theme.id)}
                  title={theme.name}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    backgroundColor: theme.color,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all var(--transition-fast)',
                    boxShadow: isActive ? `0 0 0 3px var(--bg-secondary), 0 0 0 6px ${theme.color}` : 'none',
                    opacity: isActive ? 1 : 0.7,
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.opacity = '1'; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.opacity = '0.7'; }}
                >
                  {isActive && <Check size={24} color="#ffffff" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Data Management */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <Database size={16} /> Banco de Dados
            </span>
          </div>
          
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-4)' }}>
            Gerencie as informações salvas no seu navegador. Cuidado ao utilizar estas ações.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <button 
              className="btn btn-outline" 
              onClick={handleRestoreDemo}
              style={{ display: 'flex', justifyContent: 'center', width: '100%', borderColor: 'var(--accent)', color: 'var(--accent)' }}
            >
              <RefreshCw size={16} /> Restaurar Dados de Demonstração
            </button>
            <button 
              className="btn btn-outline" 
              onClick={handleResetData}
              style={{ display: 'flex', justifyContent: 'center', width: '100%', borderColor: 'var(--danger)', color: 'var(--danger)' }}
            >
              <Trash2 size={16} /> Apagar Todos os Dados
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
