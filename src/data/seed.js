// Demo/seed data for all modules — pt-BR

import { db, COLLECTIONS } from './db';

const today = new Date();
const toISO = (d) => d.toISOString().split('T')[0];
const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return toISO(d); };
const daysFromNow = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return toISO(d); };

export function loadDemoData(force = false) {
  if (!force && db.isInitialized()) {
    return;
  }
  
  if (!force && (db.isDemoLoaded() || db.hasData())) {
    db.setInitialized();
    if (!db.isDemoLoaded() && db.hasData()) db.setDemoLoaded();
    return;
  }

  // If we reach here, we are seeding for the first time
  db.setInitialized();
  const tasks = [
    { title: 'Revisar landing page do produto', description: 'Ajustar copy e CTA principal', priority: 'alta', estimatedHours: 2, status: 'concluída', dueDate: daysAgo(0), scheduledDate: daysAgo(0), category: 'Marketing', completedAt: new Date().toISOString() },
    { title: 'Gravar vídeo para o Instagram', priority: 'alta', estimatedHours: 1.5, status: 'em_andamento', dueDate: daysAgo(0), scheduledDate: daysAgo(0), category: 'Conteúdo' },
    { title: 'Analisar métricas de campanha', priority: 'média', estimatedHours: 1, status: 'pendente', dueDate: daysAgo(0), scheduledDate: daysAgo(0), category: 'Marketing' },
    { title: 'Responder mensagens de clientes', priority: 'média', estimatedHours: 0.5, status: 'concluída', scheduledDate: daysAgo(0), category: 'Operações', completedAt: new Date().toISOString() },
    { title: 'Planejar conteúdo da semana', priority: 'alta', estimatedHours: 2, status: 'pendente', dueDate: daysFromNow(1), scheduledDate: daysFromNow(1), category: 'Conteúdo' },
    { title: 'Configurar automação de e-mail', priority: 'média', estimatedHours: 3, status: 'pendente', dueDate: daysFromNow(2), scheduledDate: daysFromNow(2), category: 'Marketing' },
    { title: 'Reunião com fornecedor', priority: 'baixa', estimatedHours: 1, status: 'pendente', dueDate: daysFromNow(3), scheduledDate: daysFromNow(3), category: 'Operações' },
    { title: 'Pesquisar novos nichos de mercado', priority: 'baixa', estimatedHours: 2, status: 'pendente', dueDate: daysFromNow(5), category: 'Estratégia' },
    { title: 'Atualizar precificação do produto', priority: 'alta', estimatedHours: 1, status: 'concluída', dueDate: daysAgo(1), scheduledDate: daysAgo(1), category: 'Produto', completedAt: daysAgo(1) + 'T14:00:00.000Z' },
    { title: 'Criar dashboard financeiro', priority: 'média', estimatedHours: 4, status: 'concluída', dueDate: daysAgo(2), scheduledDate: daysAgo(2), category: 'Produto', completedAt: daysAgo(2) + 'T16:00:00.000Z' },
    { title: 'Escrever artigo sobre produtividade', priority: 'baixa', estimatedHours: 3, status: 'pendente', dueDate: daysFromNow(7), category: 'Conteúdo' },
    { title: 'Testar nova campanha de ads', priority: 'alta', estimatedHours: 2, status: 'pendente', dueDate: daysFromNow(2), scheduledDate: daysFromNow(2), category: 'Marketing' },
  ];
  tasks.forEach(t => db.create(COLLECTIONS.TASKS, t));

  // FINANCE
  const finance = [
    { type: 'entrada', amount: 4500, category: 'Vendas', subcategory: 'Produto digital', source: 'dropshipping', date: daysAgo(0), notes: 'Vendas do dia' },
    { type: 'entrada', amount: 2200, category: 'Vendas', subcategory: '', source: 'conteúdo', date: daysAgo(1), notes: 'Patrocínio Instagram' },
    { type: 'entrada', amount: 8500, category: 'Serviços', subcategory: 'Consultoria', source: 'serviços', date: daysAgo(3) },
    { type: 'entrada', amount: 3200, category: 'Vendas', subcategory: '', source: 'dropshipping', date: daysAgo(5) },
    { type: 'entrada', amount: 1800, category: 'Vendas', subcategory: '', source: 'conteúdo', date: daysAgo(7) },
    { type: 'entrada', amount: 6000, category: 'Serviços', subcategory: '', source: 'serviços', date: daysAgo(10) },
    { type: 'entrada', amount: 3500, category: 'Vendas', subcategory: '', source: 'dropshipping', date: daysAgo(14) },
    { type: 'entrada', amount: 950, category: 'Outros', subcategory: '', source: 'outro', date: daysAgo(18) },
    { type: 'saída', amount: 1200, category: 'Marketing', subcategory: 'Ads', source: 'marketing', date: daysAgo(0) },
    { type: 'saída', amount: 350, category: 'Ferramentas', subcategory: 'SaaS', source: 'ferramentas', date: daysAgo(2) },
    { type: 'saída', amount: 800, category: 'Marketing', subcategory: 'Influenciador', source: 'marketing', date: daysAgo(4) },
    { type: 'saída', amount: 200, category: 'Operações', subcategory: 'Internet', source: 'operações', date: daysAgo(6) },
    { type: 'saída', amount: 150, category: 'Ferramentas', subcategory: '', source: 'ferramentas', date: daysAgo(9) },
    { type: 'saída', amount: 2500, category: 'Pessoal', subcategory: 'Aluguel', source: 'pessoal', date: daysAgo(12) },
    { type: 'saída', amount: 450, category: 'Pessoal', subcategory: 'Alimentação', source: 'pessoal', date: daysAgo(15) },
    { type: 'saída', amount: 300, category: 'Operações', subcategory: '', source: 'operações', date: daysAgo(20) },
  ];
  finance.forEach(f => db.create(COLLECTIONS.FINANCE, f));

  // LEARNINGS
  const learnings = [
    { type: 'aprendizado', content: 'Campanhas de retargeting convertem 3x mais que campanhas cold. Sempre separar orçamento dedicado para retargeting.', date: daysAgo(0), tags: ['marketing', 'ads'], favorite: true, source: 'Experiência própria' },
    { type: 'ideia', content: 'Criar um sistema de pontuação para priorizar atividades baseado no ROI de tempo investido.', date: daysAgo(1), tags: ['produtividade', 'sistema'], favorite: false },
    { type: 'frase', content: '"O que pode ser medido, pode ser melhorado." — Peter Drucker', date: daysAgo(2), tags: ['gestão', 'inspiração'], favorite: true },
    { type: 'estratégia', content: 'Regra 80/20 aplicada: focar nos 20% das atividades que geram 80% do resultado. No meu caso: criação de conteúdo e dropshipping.', date: daysAgo(3), tags: ['estratégia', 'foco'], favorite: true, source: 'Análise semanal' },
    { type: 'livro', content: 'Atomic Habits: Mudanças de 1% por dia geram resultados exponenciais. Focar em sistemas, não em metas. Identidade > resultado.', date: daysAgo(5), tags: ['hábitos', 'livro'], favorite: true, source: 'James Clear' },
    { type: 'aprendizado', content: 'Posts curtos no Instagram com CTA direto geram mais engajamento do que conteúdo longo. Testar Reels com gancho nos 2 primeiros segundos.', date: daysAgo(7), tags: ['conteúdo', 'instagram'], favorite: false },
    { type: 'ideia', content: 'Criar um funil de vendas automatizado: lead magnet → sequência de e-mails → oferta. Implementar até o fim do mês.', date: daysAgo(10), tags: ['vendas', 'automação'], favorite: false },
  ];
  learnings.forEach(l => db.create(COLLECTIONS.LEARNINGS, l));

  // EXPERIMENTS
  const experiments = [
    { title: 'Campanha de ads com vídeo curto vs imagem', category: 'ads', context: 'Testar formato de criativo para campanha de dropshipping', whatWasTested: 'Vídeo de 15s com produto vs imagem estática com texto', result: 'Vídeo teve CTR 2.3x maior e CPA 40% menor', mainError: 'Imagem estava genérica demais', lessonLearned: 'Sempre usar vídeo curto com demonstração real do produto', repeatThis: 'sim', date: daysAgo(3), tags: ['ads', 'criativo'] },
    { title: 'Horário de publicação no Instagram', category: 'conteúdo', context: 'Testar melhor horário para postar Reels', whatWasTested: '8h vs 12h vs 19h', result: '19h teve 60% mais alcance', mainError: 'Pesquisar pouco antes de testar', lessonLearned: 'Público está mais ativo à noite. Testar 18h-20h', repeatThis: 'sim', date: daysAgo(7), tags: ['conteúdo', 'instagram'] },
    { title: 'Preço do produto digital', category: 'negócio', context: 'Testar se aumentar preço de R$97 para R$147 reduz conversão', whatWasTested: 'A/B teste com preço R$97 vs R$147', result: 'Conversão caiu apenas 8% mas receita subiu 35%', mainError: null, lessonLearned: 'Subestimei o valor percebido. Público aceita preço maior se a página vende bem', repeatThis: 'sim', date: daysAgo(12), tags: ['precificação', 'vendas'] },
    { title: 'Trabalhar sem celular por 2h de manhã', category: 'produtividade', context: 'Testar deep work sem distrações', whatWasTested: 'Deixar celular em outro cômodo das 8h às 10h', result: 'Produtividade triplicou no período. Consegui fazer em 2h o que normalmente fazia em 5h', mainError: null, lessonLearned: 'Deep work funciona. Implementar como rotina diária', repeatThis: 'sim', date: daysAgo(5), tags: ['produtividade', 'foco'] },
  ];
  experiments.forEach(e => db.create(COLLECTIONS.EXPERIMENTS, e));

  // WEEKLY REVIEWS
  const weeklyReviews = [
    {
      weekRef: getWeekRefFromDate(daysAgo(0)),
      weekStart: getWeekStart(daysAgo(0)),
      weekEnd: getWeekEnd(daysAgo(0)),
      whatWorked: 'Deep work matinal funcionou muito bem. Consegui manter consistência de conteúdo (4 posts).',
      whatDidNotWork: 'Reuniões desnecessárias ocuparam tempo. Procrastinei na parte financeira.',
      timeWasted: 'Cerca de 3h em redes sociais sem propósito, 2h em reuniões que poderiam ser e-mails.',
      moneyWasted: 'R$300 em uma ferramenta que não usei direito.',
      biggestLearnings: 'A consistência importa mais que a perfeição. Publicar conteúdo imperfeito gera mais resultado do que planejar o perfeito e nunca publicar.',
      mainWins: 'Fechei 2 clientes de consultoria. Campanha de ads gerou ROI de 3.2x.',
      focusNextWeek: 'Focar em automação de vendas. Gravar 5 vídeos. Implementar rotina matinal sem celular.',
    },
    {
      weekRef: getWeekRefFromDate(daysAgo(7)),
      weekStart: getWeekStart(daysAgo(7)),
      weekEnd: getWeekEnd(daysAgo(7)),
      whatWorked: 'Nova campanha de ads performou bem. Rotina de treino mantida.',
      whatDidNotWork: 'Não consegui finalizar o funil de e-mails. Distrações à tarde.',
      timeWasted: '4h em scroll de redes sociais, 1h decidindo ferramenta.',
      moneyWasted: 'Nada significativo.',
      biggestLearnings: 'Preciso definir blocos de tempo fixos para tarefas criativas.',
      mainWins: 'Maior faturamento do mês em um único dia. 3 novos seguidores qualificados.',
      focusNextWeek: 'Finalizar funil. Testar novo formato de conteúdo. Melhorar rotina de sono.',
    },
  ];
  weeklyReviews.forEach(w => db.create(COLLECTIONS.WEEKLY_REVIEWS, w));

  // DAILY CHECK-INS (last 7 days)
  const checkIns = [
    { date: daysAgo(0), dayQuality: 'bom', energy: 'alta', focus: 'alto' },
    { date: daysAgo(1), dayQuality: 'excelente', energy: 'alta', focus: 'alto' },
    { date: daysAgo(2), dayQuality: 'médio', energy: 'média', focus: 'médio' },
    { date: daysAgo(3), dayQuality: 'bom', energy: 'alta', focus: 'médio' },
    { date: daysAgo(4), dayQuality: 'ruim', energy: 'baixa', focus: 'baixo' },
    { date: daysAgo(5), dayQuality: 'bom', energy: 'média', focus: 'alto' },
    { date: daysAgo(6), dayQuality: 'excelente', energy: 'alta', focus: 'alto' },
  ];
  checkIns.forEach(c => db.create(COLLECTIONS.DAILY_CHECKINS, c));

  // TIME ALLOCATIONS (last 7 days)
  for (let i = 0; i < 7; i++) {
    const allocations = [
      { date: daysAgo(i), category: 'trabalho_produtivo', hours: 4 + Math.random() * 3 },
      { date: daysAgo(i), category: 'estudo', hours: 0.5 + Math.random() * 1.5 },
      { date: daysAgo(i), category: 'testes', hours: Math.random() * 1.5 },
      { date: daysAgo(i), category: 'academia', hours: i % 2 === 0 ? 1 : 0 },
      { date: daysAgo(i), category: 'lazer', hours: 1 + Math.random() },
      { date: daysAgo(i), category: 'distrações', hours: Math.random() * 2 },
    ];
    allocations.forEach(a => {
      a.hours = Math.round(a.hours * 10) / 10;
      db.create(COLLECTIONS.TIME_ALLOCATIONS, a);
    });
  }

  // WORKOUT ROUTINES
  const routines = [
    { dayOfWeek: 1, dayName: 'Segunda', isRestDay: false, workoutType: 'Peito e Tríceps', plannedFocus: 'Supino reto, inclinado, crucifixo, tríceps pulley', notes: '' },
    { dayOfWeek: 2, dayName: 'Terça', isRestDay: false, workoutType: 'Costas e Bíceps', plannedFocus: 'Puxada frontal, remada, rosca direta', notes: '' },
    { dayOfWeek: 3, dayName: 'Quarta', isRestDay: true, workoutType: null, plannedFocus: null, notes: 'Descanso ou cardio leve' },
    { dayOfWeek: 4, dayName: 'Quinta', isRestDay: false, workoutType: 'Pernas', plannedFocus: 'Agachamento, leg press, extensora, flexora', notes: '' },
    { dayOfWeek: 5, dayName: 'Sexta', isRestDay: false, workoutType: 'Ombros e Abdômen', plannedFocus: 'Desenvolvimento, elevação lateral, prancha', notes: '' },
    { dayOfWeek: 6, dayName: 'Sábado', isRestDay: false, workoutType: 'Cardio e Funcional', plannedFocus: 'HIIT 30min + alongamento', notes: '' },
    { dayOfWeek: 0, dayName: 'Domingo', isRestDay: true, workoutType: null, plannedFocus: null, notes: 'Descanso total' },
  ];
  routines.forEach(r => db.create(COLLECTIONS.WORKOUT_ROUTINES, r));

  // WORKOUT LOGS (last 7 days)
  const workoutLogs = [
    { date: daysAgo(0), didTrain: true, workoutDone: 'Peito e Tríceps', followedPlan: true, howItWent: 'Treino pesado, boa evolução no supino', energy: 'alta' },
    { date: daysAgo(1), didTrain: true, workoutDone: 'Costas e Bíceps', followedPlan: true, howItWent: 'Normal, carga mantida', energy: 'média' },
    { date: daysAgo(2), didTrain: false, workoutDone: null, followedPlan: true, howItWent: 'Dia de descanso', energy: 'média' },
    { date: daysAgo(3), didTrain: true, workoutDone: 'Pernas', followedPlan: true, howItWent: 'Excelente, aumentei carga no agachamento', energy: 'alta' },
    { date: daysAgo(4), didTrain: true, workoutDone: 'Ombros e Abdômen', followedPlan: false, howItWent: 'Pulou abdômen por falta de tempo', energy: 'baixa' },
    { date: daysAgo(5), didTrain: true, workoutDone: 'Cardio', followedPlan: true, howItWent: 'HIIT de 25min', energy: 'média' },
    { date: daysAgo(6), didTrain: false, workoutDone: null, followedPlan: true, howItWent: 'Descanso', energy: 'alta' },
  ];
  workoutLogs.forEach(w => db.create(COLLECTIONS.WORKOUT_LOGS, w));

  db.setDemoLoaded();
}

export function clearDemoData() {
  db.clearAll();
  db.clearDemoFlag();
}

// Helpers
function getWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff).toISOString().split('T')[0];
}

function getWeekEnd(dateStr) {
  const start = getWeekStart(dateStr);
  const d = new Date(start + 'T00:00:00');
  d.setDate(d.getDate() + 6);
  return d.toISOString().split('T')[0];
}

function getWeekRefFromDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const firstJan = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d - firstJan) / 86400000);
  const weekNum = Math.ceil((days + firstJan.getDay() + 1) / 7);
  return `${d.getFullYear()}-S${String(weekNum).padStart(2, '0')}`;
}
