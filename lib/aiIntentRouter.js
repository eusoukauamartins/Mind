export function detectIntent(text = '') {
  const cleanText = String(text || '').toLowerCase().trim();

  if (!cleanText || cleanText === 'oi' || cleanText === 'olá' || cleanText === 'ola' || cleanText === 'teste' || cleanText === 'test') {
    return { intent: 'chat', confidence: 1.0 };
  }

  // Keywords for Portuguese heuristics
  const financeTriggers = [
    'gasto', 'gastei', 'despesa', 'receita', 'saldo', 'lucro', 'finança', 'lança', 'lançar', 
    'faturamento', 'pagamento', 'pagar', 'comprei', 'compras', 'mercado', 'supermercado', 
    'ifood', 'gasolina', 'combustível', 'combustivel', 'aluguel', 'condomínio', 'condominio', 
    'uber', 'metrô', 'metro', 'ônibus', 'onibus'
  ];

  const tasksTriggers = [
    'tarefa', 'todo', 'to-do', 'afazer', 'checklist', 'prazo', 'agendar', 'agendada', 
    'vencer', 'pendente', 'completar', 'concluir', 'priorizar', 'prioridade'
  ];

  const projectsTriggers = [
    'projeto', 'subprojeto', 'cronograma', 'milestone'
  ];

  const rewardsTriggers = [
    'recompensa', 'prêmio', 'premio', 'resgatar', 'resgate', 'desbloquear'
  ];

  const learningsTriggers = [
    'aprendizado', 'aprendi', 'lição', 'licao', 'insight'
  ];

  const experimentsTriggers = [
    'experimento', 'hipótese', 'hipotese', 'whatwastested'
  ];

  const scores = {
    finance: 0,
    tasks: 0,
    projects: 0,
    rewards: 0,
    learnings: 0,
    experiments: 0
  };

  financeTriggers.forEach(kw => {
    if (cleanText.includes(kw)) scores.finance += kw.length;
  });

  tasksTriggers.forEach(kw => {
    if (cleanText.includes(kw)) scores.tasks += kw.length;
  });

  projectsTriggers.forEach(kw => {
    if (cleanText.includes(kw)) scores.projects += kw.length;
  });

  rewardsTriggers.forEach(kw => {
    if (cleanText.includes(kw)) scores.rewards += kw.length;
  });

  learningsTriggers.forEach(kw => {
    if (cleanText.includes(kw)) scores.learnings += kw.length;
  });

  experimentsTriggers.forEach(kw => {
    if (cleanText.includes(kw)) {
      scores.experiments += kw.length;
    }
  });

  // Explicit check to ignore standalone 'teste' / 'testes'
  const words = cleanText.split(/\s+/);
  if (words.length <= 2 && (words.includes('teste') || words.includes('testes') || words.includes('test'))) {
    scores.experiments = 0;
  }

  // Find best intent
  let bestIntent = 'chat';
  let bestScore = 0;
  
  // Priority order: finance, tasks, projects, rewards, learnings, experiments
  const order = ['finance', 'tasks', 'projects', 'rewards', 'learnings', 'experiments'];
  order.forEach(intent => {
    if (scores[intent] > bestScore) {
      bestScore = scores[intent];
      bestIntent = intent;
    }
  });

  if (bestScore === 0) {
    return { intent: 'chat', confidence: 1.0 };
  }

  // Detect ambiguity
  let secondBestScore = 0;
  order.forEach(intent => {
    if (intent !== bestIntent && scores[intent] > secondBestScore) {
      secondBestScore = scores[intent];
    }
  });

  let confidence = 0.95;
  if (bestScore < 3) {
    confidence = 0.5;
  } else if (secondBestScore > 0 && Math.abs(bestScore - secondBestScore) <= 3) {
    confidence = 0.5;
  }

  if (confidence < 0.7) {
    return { intent: 'chat', confidence };
  }

  return { intent: bestIntent, confidence };
}
