/**
 * AI Context Builder for Lyria.
 * Compiles a compact, token-efficient, JSON-serializable snapshot of the active application state
 * to help the AI model answer context-aware questions.
 */

import { getToday } from '../utils/helpers';

// Helper to truncate text fields to save token space
function truncate(str, maxLen = 60) {
  if (!str) return '';
  const clean = String(str).trim();
  if (clean.length <= maxLen) return clean;
  return clean.substring(0, maxLen) + '...';
}

function detectRequestedMonths(text = '', history = [], currentDate = '') {
  const [currYearStr, currMonthStr] = currentDate.split('-');
  const currYear = parseInt(currYearStr, 10);
  const currMonth = parseInt(currMonthStr, 10);
  
  const currentMonthKey = `${currYearStr}-${currMonthStr}`;
  
  // Previous month calculation
  let prevMonth = currMonth - 1;
  let prevYear = currYear;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear = currYear - 1;
  }
  const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  
  const months = new Set([currentMonthKey, prevMonthKey]);
  
  const historyText = Array.isArray(history) ? history.slice(-5).map(h => h.content || '').join(' ') : '';
  const combinedText = (String(text) + ' ' + historyText).toLowerCase();
  
  // 1. Regex for MM/YY or MM/YYYY
  const dateRegex = /\b(\d{1,2})\/(\d{2,4})\b/g;
  let match;
  while ((match = dateRegex.exec(combinedText)) !== null) {
    const m = String(match[1]).padStart(2, '0');
    let y = match[2];
    if (y.length === 2) {
      y = '20' + y;
    }
    months.add(`${y}-${m}`);
  }
  
  // 2. Portuguese month names
  const monthMap = {
    janeiro: 1, jan: 1,
    fevereiro: 2, fev: 2,
    março: 3, marco: 3, mar: 3,
    abril: 4, abr: 4,
    maio: 5, mai: 5,
    junho: 6, jun: 6,
    julho: 7, jul: 7,
    agosto: 8, ago: 8,
    setembro: 9, set: 9,
    outubro: 10, out: 10,
    novembro: 11, nov: 11,
    dezembro: 12, dez: 12
  };
  
  const monthNamesRegex = /(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/gi;
  let nameMatch;
  while ((nameMatch = monthNamesRegex.exec(combinedText)) !== null) {
    const monthNum = monthMap[nameMatch[1].toLowerCase()];
    if (monthNum) {
      const index = nameMatch.index;
      const sub = combinedText.substring(index, index + 30);
      const yearMatch = /\b(\d{2,4})\b/.exec(sub);
      let year = currYear;
      if (yearMatch) {
        let yMatched = yearMatch[1];
        if (yMatched !== String(monthNum) && yMatched.length >= 2) {
          year = parseInt(yMatched.length === 2 ? '20' + yMatched : yMatched, 10);
        }
      }
      months.add(`${year}-${String(monthNum).padStart(2, '0')}`);
    }
  }
  
  return Array.from(months);
}

/**
 * Builds a compact summary of the current app context.
 * 
 * @param {object} appState - The current state exposed by useApp()
 * @param {string} userMessage - The current user message
 * @param {array} history - Recent conversation history
 * @returns {object} A compact JSON-serializable context object
 */
export function buildAIContext(appState, userMessage = '', history = []) {
  if (!appState) {
    return { error: 'No appState supplied.' };
  }

  const today = getToday();
  const now = new Date();
  
  const currentTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:mm
  const currentMonth = today.substring(0, 7); // YYYY-MM

  let timezone = 'America/Sao_Paulo';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || timezone;
  } catch (e) {}

  // 1. Date/Time info
  const dateInfo = {
    currentDate: today,
    currentTime,
    locale: 'pt-BR',
    timezone
  };

  // 2. Tasks Summary
  const rawTasks = Array.isArray(appState.tasks) ? appState.tasks : [];
  const incompleteTasks = rawTasks.filter(t => t.status !== 'concluída' && t.status !== 'excluída');
  
  const todayTasks = incompleteTasks
    .filter(t => t.scheduledDate === today)
    .slice(0, 10)
    .map(t => ({
      id: t.id,
      title: truncate(t.title),
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate,
      scheduledDate: t.scheduledDate,
      scheduledTime: t.scheduledTime,
      estimatedHours: t.estimatedHours
    }));

  const overdueTasks = incompleteTasks
    .filter(t => t.dueDate && t.dueDate < today)
    .slice(0, 10)
    .map(t => ({
      id: t.id,
      title: truncate(t.title),
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate,
      scheduledDate: t.scheduledDate,
      scheduledTime: t.scheduledTime,
      estimatedHours: t.estimatedHours
    }));

  const highPriorityTasks = incompleteTasks
    .filter(t => t.priority === 'alta')
    .slice(0, 10)
    .map(t => ({
      id: t.id,
      title: truncate(t.title),
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate,
      scheduledDate: t.scheduledDate,
      scheduledTime: t.scheduledTime,
      estimatedHours: t.estimatedHours
    }));

  const tasksSummary = {
    totalIncomplete: incompleteTasks.length,
    todayTasks,
    overdueTasks,
    highPriorityTasks
  };

  // 3. Finance Summary
  const rawFinance = Array.isArray(appState.finance) ? appState.finance : [];
  const financeDataAccessible = Array.isArray(appState.finance);
  const requestedMonths = detectRequestedMonths(userMessage, history, today);
  
  const requestedMonthsData = {};
  if (financeDataAccessible) {
    requestedMonths.forEach(monthKey => {
      const monthEntries = rawFinance.filter(f => f.date && f.date.startsWith(monthKey));
      
      const incomeTotal = monthEntries
        .filter(f => f.type === 'entrada')
        .reduce((sum, f) => sum + (f.amount || 0), 0);
        
      const expenseTotal = monthEntries
        .filter(f => f.type === 'saída')
        .reduce((sum, f) => sum + (f.amount || 0), 0);
        
      const balance = incomeTotal - expenseTotal;
      
      // Category calculations
      const categorySummary = {};
      monthEntries.forEach(f => {
        const cat = f.category || 'Outros';
        const amt = f.amount || 0;
        if (!categorySummary[cat]) categorySummary[cat] = 0;
        categorySummary[cat] += f.type === 'entrada' ? amt : -amt;
      });

      // Compact transaction summaries (max 30 transactions per month to prevent token bloating)
      const transactions = monthEntries
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 30)
        .map(f => ({
          date: f.date,
          type: f.type,
          amount: f.amount,
          category: f.category,
          subcategory: f.subcategory || '',
          description: f.originalDescription || f.notes || ''
        }));

      requestedMonthsData[monthKey] = {
        periodKey: monthKey,
        transactionCount: monthEntries.length,
        totals: {
          receitas: incomeTotal,
          despesas: expenseTotal,
          saldo: balance
        },
        categorySummary,
        transactions
      };
    });
  }

  const currentMonthEntries = rawFinance.filter(f => f.date && f.date.startsWith(currentMonth));
  const incomeTotal = currentMonthEntries
    .filter(f => f.type === 'entrada')
    .reduce((sum, f) => sum + (f.amount || 0), 0);
  const expenseTotal = currentMonthEntries
    .filter(f => f.type === 'saída')
    .reduce((sum, f) => sum + (f.amount || 0), 0);
  const monthlyBalance = incomeTotal - expenseTotal;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
  const last7DaysExpenses = rawFinance
    .filter(f => f.type === 'saída' && f.date >= sevenDaysAgoStr && f.date <= today)
    .reduce((sum, f) => sum + (f.amount || 0), 0);

  const recentFinance = rawFinance
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)
    .map(f => ({
      id: f.id,
      type: f.type,
      amount: f.amount,
      category: f.category,
      expenseClass: f.expenseClass,
      source: f.source,
      date: f.date,
      notes: truncate(f.notes, 40)
    }));

  const bigExpenses = currentMonthEntries
    .filter(f => f.type === 'saída')
    .sort((a, b) => (b.amount || 0) - (a.amount || 0))
    .slice(0, 5)
    .map(f => ({
      id: f.id,
      amount: f.amount,
      category: f.category,
      date: f.date
    }));

  const financeSummary = {
    financeDataAccessible,
    requestedMonthsData,
    currentMonth: {
      periodKey: currentMonth,
      incomeTotal,
      expenseTotal,
      balance: monthlyBalance
    },
    last7DaysExpenses,
    recentFinance,
    bigExpenses
  };

  // 4. Projects Summary
  const rawProjects = Array.isArray(appState.projects) ? appState.projects : [];
  const activeProjects = rawProjects
    .filter(p => p.status === 'ativo')
    .slice(0, 10)
    .map(p => {
      const subtasks = p.subtasks || [];
      const total = subtasks.length;
      const completed = subtasks.filter(s => s.completed).length;
      const nextPending = subtasks
        .filter(s => !s.completed)
        .slice(0, 3)
        .map(s => truncate(s.title, 30));

      return {
        id: p.id,
        title: truncate(p.title),
        status: p.status,
        category: p.category,
        targetDate: p.targetDate,
        progress: { completed, total },
        pendingSubtasks: nextPending
      };
    });

  const projectsSummary = {
    activeProjects
  };

  // 5. Rewards Summary
  const rawRewards = Array.isArray(appState.rewards) ? appState.rewards : [];
  const activeRewards = rawRewards
    .filter(r => r.status === 'em_andamento' || r.status === 'desbloqueada')
    .slice(0, 10)
    .map(r => ({
      id: r.id,
      title: truncate(r.title),
      status: r.status,
      priority: r.priority,
      estimatedValue: r.estimatedValue,
      financialTargetAmount: r.financialTargetAmount,
      financialCurrentAmount: r.financialCurrentAmount,
      showOnDashboard: r.showOnDashboard,
      deadline: r.deadline
    }));

  const rewardsSummary = {
    activeRewards
  };

  // 6. Learnings Summary
  const rawLearnings = Array.isArray(appState.learnings) ? appState.learnings : [];
  const recentLearnings = rawLearnings
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)
    .map(l => ({
      id: l.id,
      content: truncate(l.content, 80),
      source: truncate(l.source, 35),
      tags: l.tags || [],
      date: l.date,
      isFavorite: l.isFavorite
    }));

  const learningsSummary = {
    recentLearnings
  };

  // 7. Experiments Summary
  const rawExperiments = Array.isArray(appState.experiments) ? appState.experiments : [];
  const recentExperiments = rawExperiments
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)
    .map(e => ({
      id: e.id,
      title: truncate(e.title),
      category: e.category,
      result: truncate(e.result, 80),
      lessonLearned: truncate(e.lessonLearned, 80),
      repeatThis: e.repeatThis,
      date: e.date,
      tags: e.tags || []
    }));

  const experimentsSummary = {
    recentExperiments
  };

  // 8. AI Action Log Summary (from localStorage)
  let actionLogSummary = { appliedCount: 0, revertedCount: 0, last5Actions: [] };
  try {
    const rawLog = localStorage.getItem('cp_ai_action_log');
    if (rawLog) {
      const logs = JSON.parse(rawLog);
      const applied = logs.filter(l => l.status === 'applied');
      const reverted = logs.filter(l => l.status === 'reverted');
      
      const last5 = logs.slice(0, 5).map(l => ({
        module: l.module,
        status: l.status,
        summary: l.summary,
        timestamp: l.timestamp
      }));

      actionLogSummary = {
        appliedCount: applied.length,
        revertedCount: reverted.length,
        last5Actions: last5
      };
    }
  } catch (e) {
    console.error('[Lyria Context Builder] Failed parsing action logs:', e);
  }

  // 9. Static User Guidance Context
  const userGuidance = {
    replyLanguage: 'Português',
    rules: [
      'Responda sempre em português e seja objetivo, prático e motivador.',
      'Sempre que o usuário quiser criar itens, proponha a estrutura JSON no campo "actions" com "requiresConfirmation": true.',
      'Ações financeiras exigem cuidado redobrado e devem avisar o usuário no texto de resposta.',
      'Não decida nada de forma silenciosa ou automática sem autorização.'
    ]
  };

  // Return unified compiled context envelope
  return {
    ...dateInfo,
    summary: {
      tasks: tasksSummary,
      finance: financeSummary,
      projects: projectsSummary,
      rewards: rewardsSummary,
      learnings: learningsSummary,
      experiments: experimentsSummary,
      actionLogs: actionLogSummary,
      guidance: userGuidance
    }
  };
}
