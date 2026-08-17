// Format utilities for pt-BR

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

export function formatNumber(value, decimals = 0) {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value || 0);
}

export function formatPercent(value) {
  return `${Math.round(value || 0)}%`;
}

export function toLocalISODate(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getToday() {
  return toLocalISODate(new Date());
}

export function getWeekDates(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: toLocalISODate(monday),
    end: toLocalISODate(sunday),
  };
}

export function getWeekRef(date = new Date()) {
  const d = new Date(date);
  const firstJan = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d - firstJan) / 86400000);
  const weekNum = Math.ceil((days + firstJan.getDay() + 1) / 7);
  return `${d.getFullYear()}-S${String(weekNum).padStart(2, '0')}`;
}

export function isToday(dateStr) {
  return dateStr === getToday();
}

export function isThisWeek(dateStr) {
  const { start, end } = getWeekDates();
  return dateStr >= start && dateStr <= end;
}

export function isThisMonth(dateStr) {
  const now = new Date();
  const d = dateStr.substring(0, 7);
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return d === thisMonth;
}

export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const DAY_NAMES_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Priority order
export function priorityValue(p) {
  const map = { alta: 3, média: 2, baixa: 1 };
  return map[p] || 0;
}

// Productivity score calculation
export function calcDailyScore(tasks, checkIn, timeAllocations) {
  // Task completion component — 40%
  const totalTasks = tasks.length || 1;
  const completedTasks = tasks.filter(t => isTaskCompleted(t)).length;
  const taskScore = Math.min(completedTasks / totalTasks, 1);

  // Check-in component — 30%
  let checkInScore = 0.5; // default if no check-in
  if (checkIn) {
    const qualityMap = { ruim: 0, médio: 0.33, bom: 0.66, excelente: 1 };
    const energyMap = { baixa: 0, média: 0.5, alta: 1 };
    const focusMap = { baixo: 0, médio: 0.5, alto: 1 };
    checkInScore = (
      (qualityMap[checkIn.dayQuality] || 0) +
      (energyMap[checkIn.energy] || 0) +
      (focusMap[checkIn.focus] || 0)
    ) / 3;
  }

  // Time allocation component — 30%
  let timeScore = 0.5;
  if (timeAllocations.length > 0) {
    const productive = ['trabalho_produtivo', 'estudo', 'testes', 'academia'];
    const totalHours = timeAllocations.reduce((s, t) => s + (t.hours || 0), 0) || 1;
    const productiveHours = timeAllocations
      .filter(t => productive.includes(t.category))
      .reduce((s, t) => s + (t.hours || 0), 0);
    timeScore = Math.min(productiveHours / totalHours, 1);
  }

  return Math.round((taskScore * 40 + checkInScore * 30 + timeScore * 30));
}

// Recurring Tasks Helpers
export function getTaskPeriodKey(task, date = new Date()) {
  if (task.recurrence === 'diária') {
    return toLocalISODate(date); // YYYY-MM-DD local
  }
  if (task.recurrence === 'semanal') {
    return getWeekRef(date); // YYYY-Sxx local
  }
  if (task.recurrence === 'mensal') {
    return toLocalISODate(date).substring(0, 7); // YYYY-MM local
  }
  return '';
}

// Timezone deterministic datetime conversion
export function convertZonedToUTCISO(dateStr, timeStr, timeZone = 'America/Sao_Paulo') {
  if (!dateStr || !timeStr) return '';

  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) {
    return '';
  }

  // Create a guess Date in UTC assuming the target wall-clock values
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));

  try {
    // Format utcGuess in the target timeZone to get the local wall-clock components
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'America/Sao_Paulo',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });

    const parts = formatter.formatToParts(utcGuess);
    const partMap = {};
    parts.forEach(p => { partMap[p.type] = p.value; });

    let formattedHour = parseInt(partMap.hour, 10);
    if (formattedHour === 24) formattedHour = 0; // Some engines return 24 for midnight

    const targetLocalInUTC = Date.UTC(
      parseInt(partMap.year, 10),
      parseInt(partMap.month, 10) - 1,
      parseInt(partMap.day, 10),
      formattedHour,
      parseInt(partMap.minute, 10),
      parseInt(partMap.second || '0', 10)
    );

    // Offset is difference between target local representation and UTC instant
    const offsetMs = targetLocalInUTC - utcGuess.getTime();
    
    // Correct the UTC instant
    const finalDate = new Date(utcGuess.getTime() - offsetMs);
    return finalDate.toISOString();
  } catch (err) {
    // Fallback: America/Sao_Paulo is standard UTC-3
    console.warn(`[Lyria Timezone] Invalid timezone "${timeZone}". Falling back to UTC-3:`, err);
    const fixedOffsetMs = -3 * 60 * 60 * 1000;
    const finalDate = new Date(utcGuess.getTime() - fixedOffsetMs);
    return finalDate.toISOString();
  }
}

export function isRoutineTask(task) {
  if (!task) return false;
  if (task.taskType === 'routine') return true;
  if (task.taskType === 'task') return false;
  // Legacy fallback when taskType is undefined/null/empty:
  return task.recurrence === 'diária' || task.recurrence === 'semanal';
}

export function isTaskCompleted(task, date = new Date()) {
  if (task.recurrence === 'diária' || task.recurrence === 'semanal' || task.recurrence === 'mensal') {
    const periodKey = getTaskPeriodKey(task, date);
    return (task.completedDates || []).includes(periodKey);
  }
  return task.status === 'concluída';
}

export function isTaskActiveOnDate(task, dateStr) {
  if (!task) return false;
  
  if (isRoutineTask(task)) {
    if (task.recurrence === 'diária' || (!task.recurrence && !task.recurrenceDay)) return true;
    if (task.recurrence === 'semanal') {
      if (task.recurrenceDay !== undefined && task.recurrenceDay !== null && task.recurrenceDay !== '') {
        const d = new Date(dateStr + 'T12:00:00');
        return String(task.recurrenceDay) === String(d.getDay());
      }
      return true;
    }
    if (task.recurrence === 'mensal') {
      if (task.recurrenceDay !== undefined && task.recurrenceDay !== null && task.recurrenceDay !== '') {
        const d = new Date(dateStr + 'T12:00:00');
        return String(task.recurrenceDay) === String(d.getDate());
      }
      return true;
    }
    return true;
  }
  
  // Normal task with recurrence (e.g. taskType === 'task' with recurrence)
  if (task.recurrence === 'diária') return true;
  if (task.recurrence === 'semanal') {
    if (task.recurrenceDay !== undefined && task.recurrenceDay !== null && task.recurrenceDay !== '') {
      const d = new Date(dateStr + 'T12:00:00');
      if (String(task.recurrenceDay) === String(d.getDay())) return true;
    }
  }
  if (task.recurrence === 'mensal') {
    if (task.recurrenceDay !== undefined && task.recurrenceDay !== null && task.recurrenceDay !== '') {
      const d = new Date(dateStr + 'T12:00:00');
      if (String(task.recurrenceDay) === String(d.getDate())) return true;
    }
  }

  return task.scheduledDate === dateStr || task.dueDate === dateStr;
}

export function isTaskActiveInWeek(task) {
  if (!task) return false;
  if (isRoutineTask(task)) return true;
  if (task.recurrence === 'diária' || task.recurrence === 'semanal') return true;
  if (task.scheduledDate) return isThisWeek(task.scheduledDate);
  if (task.dueDate) return isThisWeek(task.dueDate);
  return false;
}

export function isFutureTask(task) {
  if (!task) return false;
  if (isRoutineTask(task)) return false;
  
  const today = getToday();
  if (task.scheduledDate) {
    return task.scheduledDate > today;
  }
  if (task.dueDate) {
    return task.dueDate > today;
  }
  return false;
}
