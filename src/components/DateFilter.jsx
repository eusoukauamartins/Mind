import { useState, useEffect } from 'react';

export default function DateFilter({ onChange, compact }) {
  const [period, setPeriod] = useState('30 dias');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    let startStr = todayStr;
    let endStr = todayStr;

    switch (period) {
      case 'Hoje':
        startStr = todayStr;
        endStr = todayStr;
        break;
      case '7 dias': {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        startStr = d.toISOString().split('T')[0];
        break;
      }
      case '30 dias': {
        const d = new Date();
        d.setDate(d.getDate() - 29);
        startStr = d.toISOString().split('T')[0];
        break;
      }
      case 'Este mês': {
        startStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endStr = lastDay.toISOString().split('T')[0];
        break;
      }
      case 'Este ano': {
        startStr = `${today.getFullYear()}-01-01`;
        endStr = `${today.getFullYear()}-12-31`;
        break;
      }
      case 'Personalizado': {
        startStr = customStart || '1970-01-01'; 
        endStr = customEnd || '2100-01-01';
        break;
      }
      default:
        break;
    }

    onChange({ period, start: startStr, end: endStr });
  }, [period, customStart, customEnd, onChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 'var(--sp-2)' : 'var(--sp-4)', marginBottom: compact ? 0 : 'var(--sp-6)' }}>
      <div className="tabs" style={{ marginBottom: 0, flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
        {['Hoje', '7 dias', '30 dias', 'Este mês', 'Este ano', 'Personalizado'].map(p => (
          <button 
            key={p} 
            className={`tab ${period === p ? 'active' : ''}`} 
            onClick={() => setPeriod(p)}
          >
            {p}
          </button>
        ))}
      </div>
      
      {period === 'Personalizado' && (
        <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center', background: 'var(--bg-elevated)', padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Data inicial:</label>
            <input 
              type="date" 
              className="form-input" 
              style={{ width: 'auto', padding: 'var(--sp-1) var(--sp-2)' }} 
              value={customStart} 
              onChange={e => setCustomStart(e.target.value)} 
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>Data final:</label>
            <input 
              type="date" 
              className="form-input" 
              style={{ width: 'auto', padding: 'var(--sp-1) var(--sp-2)' }} 
              value={customEnd} 
              onChange={e => setCustomEnd(e.target.value)} 
            />
          </div>
        </div>
      )}
    </div>
  );
}
