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
  return null;
}
