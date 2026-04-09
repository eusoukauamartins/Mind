import { useState } from 'react';
import { Plus, CheckSquare, DollarSign, Lightbulb, FlaskConical, ClipboardList, Dumbbell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const quickActions = [
  { icon: CheckSquare, label: 'Nova Tarefa', path: '/tarefas', action: 'add_task' },
  { icon: DollarSign, label: 'Lançamento Financeiro', path: '/financas', action: 'add_finance' },
  { icon: Lightbulb, label: 'Novo Aprendizado', path: '/aprendizados', action: 'add_learning' },
  { icon: FlaskConical, label: 'Novo Experimento', path: '/experimentos', action: 'add_experiment' },
  { icon: ClipboardList, label: 'Revisão Semanal', path: '/revisao', action: 'add_review' },
  { icon: Dumbbell, label: 'Log de Treino', path: '/treino', action: 'add_workout' },
];

export default function QuickAdd() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="quick-add-menu">
      {open && (
        <div className="quick-add-dropdown">
          {quickActions.map(item => (
            <button
              key={item.action}
              onClick={() => {
                setOpen(false);
                navigate(item.path, { state: { quickAdd: true } });
              }}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </div>
      )}
      <button
        className="quick-add-btn"
        onClick={() => setOpen(!open)}
        style={{ transform: open ? 'rotate(45deg)' : 'none' }}
      >
        <Plus size={24} />
      </button>
    </div>
  );
}
