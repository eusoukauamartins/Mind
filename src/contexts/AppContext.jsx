import { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { db, COLLECTIONS } from '../data/db';
import { supabase, getCurrentUser } from '../lib/supabaseClient';
import { mapLocalToRemoteTask } from '../lib/tasksSync';
import {
  mapLocalToRemoteLearning,
  mapLocalToRemoteExperiment,
  mapLocalToRemoteCheckin,
  mapLocalToRemoteAllocation
} from '../lib/batch1Sync';
import {
  mapLocalToRemoteRoutine,
  mapLocalToRemoteLog
} from '../lib/batch2Sync';
import {
  mapLocalToRemoteProject
} from '../lib/batch3Sync';
import {
  mapLocalToRemoteFinance,
  mapLocalToRemoteFixedCost
} from '../lib/financeSync';
import { mapLocalToRemoteReward } from '../lib/rewardsSync';
import { mapLocalToRemoteWeeklyReview } from '../lib/weeklyReviewsSync';
import { useAuth } from './AuthContext';

const AppContext = createContext(null);

function safeGetAll(collectionKey) {
  const rawData = db.getAll(collectionKey);
  if (!Array.isArray(rawData)) return [];

  switch (collectionKey) {
    case COLLECTIONS.FINANCE:
      return rawData.map(t => {
        if (!t) return null;
        let amount = typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount || '0').replace(',', '.'));
        if (isNaN(amount)) amount = 0;
        
        // Non-destructive type normalization: recognise known aliases, but never
        // silently reclassify an unknown legacy type into an expense.
        const rawType = String(t.type ?? '').toLowerCase().trim();
        let type;
        if (rawType === 'entrada' || rawType === 'receita' || rawType === 'income') {
          type = 'entrada';
        } else if (rawType === 'saída' || rawType === 'saida' || rawType === 'despesa' || rawType === 'expense') {
          type = 'saída';
        } else if (rawType === '') {
          type = 'saída';
        } else {
          type = t.type; // preserve unknown legacy value (excluded from income/expense sums)
        }

        let date = t.date;
        if (!date || typeof date !== 'string') {
          date = new Date().toISOString().split('T')[0];
        }

        return {
          id: t.id || crypto.randomUUID(),
          type: type,
          amount: Math.abs(amount),
          category: String(t.category || t.categoria || 'Outros'),
          expenseClass: String(t.expenseClass || t.classificacao || (type === 'saída' ? 'Variável' : '')),
          subcategory: String(t.subcategory || ''),
          source: String(t.source || t.fonte || ''),
          date: date,
          notes: String(t.notes || t.observacoes || ''),
          originalDescription: String(t.originalDescription || t.original_description || ''),
          sourceBank: String(t.sourceBank || t.source_bank || t.banco || 'Importado'),
          accountName: String(t.accountName || t.account_name || t.conta || ''),
          duplicateKey: String(t.duplicateKey || t.duplicate_key || ''),
          importedFrom: String(t.importedFrom || t.imported_from || ''),
          reviewStatus: String(t.reviewStatus || t.review_status || 'approved'),
          fixedCostId: t.fixedCostId || t.fixed_cost_id || null,
          periodKey: String(t.periodKey || t.period_key || ''),
          createdAt: t.createdAt || t.created_at || new Date().toISOString(),
        };
      }).filter(Boolean);

    case COLLECTIONS.FIXED_COSTS:
      return rawData.map(fc => {
        if (!fc) return null;
        let amount = typeof fc.amount === 'number' ? fc.amount : parseFloat(String(fc.amount || '0').replace(',', '.'));
        if (isNaN(amount)) amount = 0;

        return {
          id: fc.id || crypto.randomUUID(),
          title: String(fc.title || 'Sem Título'),
          amount: Math.abs(amount),
          recurrence: String(fc.recurrence || 'mensal'),
          dueDay: String(fc.dueDay || fc.due_day || '5'),
          dueMonth: String(fc.dueMonth || fc.due_month || '1'),
          category: String(fc.category || 'Outros'),
          notes: String(fc.notes || ''),
          paidPeriods: Array.isArray(fc.paidPeriods) ? fc.paidPeriods.map(String) : Array.isArray(fc.paid_periods) ? fc.paid_periods.map(String) : [],
          skippedPeriods: Array.isArray(fc.skippedPeriods) ? fc.skippedPeriods.map(String) : Array.isArray(fc.skipped_periods) ? fc.skipped_periods.map(String) : [],
          createdAt: fc.createdAt || fc.created_at || new Date().toISOString(),
        };
      }).filter(Boolean);

    case COLLECTIONS.TASKS:
      return rawData.map(t => {
        if (!t) return null;
        return {
          ...t,
          id: t.id || crypto.randomUUID(),
          title: String(t.title || 'Sem Título'),
          priority: String(t.priority || 'média'),
          status: String(t.status || 'pendente'),
          dueDate: String(t.dueDate || t.due_date || ''),
          scheduledDate: String(t.scheduledDate || t.scheduled_date || ''),
          scheduledTime: String(t.scheduledTime || t.scheduled_time || ''),
          category: String(t.category || ''),
          completedDates: Array.isArray(t.completedDates) ? t.completedDates.map(String) : Array.isArray(t.completed_dates) ? t.completed_dates.map(String) : [],
        };
      }).filter(Boolean);

    case COLLECTIONS.PROJECTS:
      return rawData.map(p => {
        if (!p) return null;
        return {
          ...p,
          id: p.id || crypto.randomUUID(),
          title: String(p.title || 'Sem Título'),
          status: String(p.status || 'ativo'),
          category: String(p.category || ''),
          startDate: String(p.startDate || p.start_date || ''),
          targetDate: String(p.targetDate || p.target_date || ''),
          completedAt: String(p.completedAt || p.completed_at || ''),
          subtasks: Array.isArray(p.subtasks) ? p.subtasks.map(s => ({
            id: s.id || crypto.randomUUID(),
            title: String(s.title || 'Subtarefa'),
            completed: Boolean(s.completed),
            order: typeof s.order === 'number' ? s.order : 0
          })) : []
        };
      }).filter(Boolean);

    case COLLECTIONS.EXPERIMENTS:
      return rawData.map(e => {
        if (!e) return null;
        return {
          ...e,
          id: e.id || crypto.randomUUID(),
          title: String(e.title || 'Sem Título'),
          date: String(e.date || new Date().toISOString().split('T')[0]),
        };
      }).filter(Boolean);

    case COLLECTIONS.WEEKLY_REVIEWS:
      return rawData.map(w => {
        if (!w) return null;
        return {
          ...w,
          id: w.id || crypto.randomUUID(),
          weekStart: String(w.weekStart || w.week_start || ''),
          weekEnd: String(w.weekEnd || w.week_end || ''),
          weekRef: String(w.weekRef || w.week_ref || ''),
        };
      }).filter(Boolean);

    case COLLECTIONS.WORKOUT_LOGS:
      return rawData.map(wl => {
        if (!wl) return null;
        return {
          ...wl,
          id: wl.id || crypto.randomUUID(),
          date: String(wl.date || new Date().toISOString().split('T')[0]),
        };
      }).filter(Boolean);

    case COLLECTIONS.LEARNINGS:
      return rawData.map(l => {
        if (!l) return null;
        return {
          ...l,
          id: l.id || crypto.randomUUID(),
          content: String(l.content || ''),
          date: String(l.date || new Date().toISOString().split('T')[0]),
        };
      }).filter(Boolean);

    case COLLECTIONS.DAILY_CHECKINS:
      return rawData.map(c => {
        if (!c) return null;
        return {
          ...c,
          id: c.id || crypto.randomUUID(),
          date: String(c.date || new Date().toISOString().split('T')[0]),
        };
      }).filter(Boolean);

    case COLLECTIONS.TIME_ALLOCATIONS:
      return rawData.map(ta => {
        if (!ta) return null;
        return {
          ...ta,
          id: ta.id || crypto.randomUUID(),
          date: String(ta.date || new Date().toISOString().split('T')[0]),
          category: String(ta.category || ''),
          hours: typeof ta.hours === 'number' ? ta.hours : parseFloat(String(ta.hours || '0')) || 0
        };
      }).filter(Boolean);

    case COLLECTIONS.WORKOUT_ROUTINES:
      return rawData.map(wr => {
        if (!wr) return null;
        return {
          ...wr,
          id: wr.id || crypto.randomUUID(),
          dayName: String(wr.dayName || wr.day_name || ''),
        };
      }).filter(Boolean);

    case COLLECTIONS.REWARDS:
      return rawData.map(r => {
        if (!r) return null;
        let val = typeof r.estimatedValue === 'number' ? r.estimatedValue : parseFloat(String(r.estimatedValue || r.estimated_value || '0').replace(',', '.'));
        if (isNaN(val)) val = 0;
        
        let fTarget = r.financialTargetAmount !== undefined && r.financialTargetAmount !== null ? r.financialTargetAmount : (r.financial_target_amount !== undefined && r.financial_target_amount !== null ? r.financial_target_amount : null);
        let fCurrent = r.financialCurrentAmount !== undefined && r.financialCurrentAmount !== null ? r.financialCurrentAmount : (r.financial_current_amount !== undefined && r.financial_current_amount !== null ? r.financial_current_amount : null);

        if (fTarget !== null && fTarget !== '') {
          fTarget = typeof fTarget === 'number' ? fTarget : parseFloat(String(fTarget).replace(',', '.'));
          if (isNaN(fTarget)) fTarget = null;
        } else {
          fTarget = null;
        }

        if (fCurrent !== null && fCurrent !== '') {
          fCurrent = typeof fCurrent === 'number' ? fCurrent : parseFloat(String(fCurrent).replace(',', '.'));
          if (isNaN(fCurrent)) fCurrent = null;
        } else {
          fCurrent = null;
        }

        return {
          id: r.id || crypto.randomUUID(),
          title: String(r.title || 'Sem Título'),
          description: String(r.description || ''),
          category: String(r.category || 'Outro'),
          estimatedValue: val,
          deadline: r.deadline || '',
          redeemAvailableDate: r.redeemAvailableDate || r.redeem_available_date || '',
          priority: r.priority || 'média',
          status: r.status || 'em_andamento',
          conditions: Array.isArray(r.conditions) ? r.conditions.map(c => ({
            id: c.id || crypto.randomUUID(),
            text: String(c.text || ''),
            completed: !!c.completed,
            completedAt: c.completedAt || c.completed_at || null
          })) : [],
          notes: r.notes || '',
          redeemedAt: r.redeemedAt || r.redeemed_at || '',
          archivedAt: r.archivedAt || r.archived_at || '',
          createdAt: r.createdAt || r.created_at || new Date().toISOString(),
          financialTargetAmount: fTarget,
          financialCurrentAmount: fCurrent,
          showOnDashboard: r.showOnDashboard === true || r.show_on_dashboard === true,
        };
      }).filter(Boolean);

    default:
      return rawData;
  }
}

const initialState = {
  tasks: safeGetAll(COLLECTIONS.TASKS),
  finance: safeGetAll(COLLECTIONS.FINANCE),
  learnings: safeGetAll(COLLECTIONS.LEARNINGS),
  experiments: safeGetAll(COLLECTIONS.EXPERIMENTS),
  weeklyReviews: safeGetAll(COLLECTIONS.WEEKLY_REVIEWS),
  dailyCheckIns: safeGetAll(COLLECTIONS.DAILY_CHECKINS),
  timeAllocations: safeGetAll(COLLECTIONS.TIME_ALLOCATIONS),
  workoutRoutines: safeGetAll(COLLECTIONS.WORKOUT_ROUTINES),
  workoutLogs: safeGetAll(COLLECTIONS.WORKOUT_LOGS),
  projects: safeGetAll(COLLECTIONS.PROJECTS),
  fixedCosts: safeGetAll(COLLECTIONS.FIXED_COSTS),
  rewards: safeGetAll(COLLECTIONS.REWARDS),
  lastUpdate: Date.now(),
};

function reducer(state, action) {
  switch (action.type) {
    case 'REFRESH_ALL':
      return {
        ...state,
        tasks: safeGetAll(COLLECTIONS.TASKS),
        finance: safeGetAll(COLLECTIONS.FINANCE),
        learnings: safeGetAll(COLLECTIONS.LEARNINGS),
        experiments: safeGetAll(COLLECTIONS.EXPERIMENTS),
        weeklyReviews: safeGetAll(COLLECTIONS.WEEKLY_REVIEWS),
        dailyCheckIns: safeGetAll(COLLECTIONS.DAILY_CHECKINS),
        timeAllocations: safeGetAll(COLLECTIONS.TIME_ALLOCATIONS),
        workoutRoutines: safeGetAll(COLLECTIONS.WORKOUT_ROUTINES),
        workoutLogs: safeGetAll(COLLECTIONS.WORKOUT_LOGS),
        projects: safeGetAll(COLLECTIONS.PROJECTS),
        fixedCosts: safeGetAll(COLLECTIONS.FIXED_COSTS),
        rewards: safeGetAll(COLLECTIONS.REWARDS),
        lastUpdate: Date.now(),
      };
    case 'REFRESH_COLLECTION':
      return {
        ...state,
        [action.collection]: safeGetAll(action.dbKey),
        lastUpdate: Date.now(),
      };
    default:
      return state;
  }
}

const collectionMap = {
  tasks: COLLECTIONS.TASKS,
  finance: COLLECTIONS.FINANCE,
  learnings: COLLECTIONS.LEARNINGS,
  experiments: COLLECTIONS.EXPERIMENTS,
  weeklyReviews: COLLECTIONS.WEEKLY_REVIEWS,
  dailyCheckIns: COLLECTIONS.DAILY_CHECKINS,
  timeAllocations: COLLECTIONS.TIME_ALLOCATIONS,
  workoutRoutines: COLLECTIONS.WORKOUT_ROUTINES,
  workoutLogs: COLLECTIONS.WORKOUT_LOGS,
  projects: COLLECTIONS.PROJECTS,
  fixedCosts: COLLECTIONS.FIXED_COSTS,
  rewards: COLLECTIONS.REWARDS,
};

const SYNC_CONFIG = {
  tasks: {
    table: 'tasks',
    mapLocal: mapLocalToRemoteTask
  },
  learnings: {
    table: 'learnings',
    mapLocal: mapLocalToRemoteLearning
  },
  experiments: {
    table: 'experiments',
    mapLocal: mapLocalToRemoteExperiment
  },
  dailyCheckIns: {
    table: 'daily_checkins',
    mapLocal: mapLocalToRemoteCheckin
  },
  timeAllocations: {
    table: 'time_allocations',
    mapLocal: mapLocalToRemoteAllocation
  },
  workoutRoutines: {
    table: 'workout_routines',
    mapLocal: mapLocalToRemoteRoutine
  },
  workoutLogs: {
    table: 'workout_logs',
    mapLocal: mapLocalToRemoteLog
  },
  projects: {
    table: 'projects',
    mapLocal: mapLocalToRemoteProject
  },
  finance: {
    table: 'finance_entries',
    mapLocal: mapLocalToRemoteFinance
  },
  fixedCosts: {
    table: 'fixed_costs',
    mapLocal: mapLocalToRemoteFixedCost
  },
  rewards: {
    table: 'rewards',
    mapLocal: mapLocalToRemoteReward
  },
  weeklyReviews: {
    table: 'weekly_reviews',
    mapLocal: mapLocalToRemoteWeeklyReview
  }
};

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { user } = useAuth();

  const refreshAll = useCallback(() => {
    dispatch({ type: 'REFRESH_ALL' });
  }, []);

  const refreshCollection = useCallback((stateKey) => {
    dispatch({
      type: 'REFRESH_COLLECTION',
      collection: stateKey,
      dbKey: collectionMap[stateKey],
    });
  }, []);

  // Listen for sync completion events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleTasksSync = () => {
      console.log('[Lyria AppContext] Tasks sync event received. Refreshing tasks...');
      refreshCollection('tasks');
    };
    const handleLearningsSync = () => {
      console.log('[Lyria AppContext] Learnings sync event received. Refreshing learnings...');
      refreshCollection('learnings');
    };
    const handleExperimentsSync = () => {
      console.log('[Lyria AppContext] Experiments sync event received. Refreshing experiments...');
      refreshCollection('experiments');
    };
    const handleCheckinsSync = () => {
      console.log('[Lyria AppContext] Checkins sync event received. Refreshing dailyCheckIns...');
      refreshCollection('dailyCheckIns');
    };
    const handleAllocationsSync = () => {
      console.log('[Lyria AppContext] Allocations sync event received. Refreshing timeAllocations...');
      refreshCollection('timeAllocations');
    };
    const handleRoutinesSync = () => {
      console.log('[Lyria AppContext] Routines sync event received. Refreshing workoutRoutines...');
      refreshCollection('workoutRoutines');
    };
    const handleLogsSync = () => {
      console.log('[Lyria AppContext] Logs sync event received. Refreshing workoutLogs...');
      refreshCollection('workoutLogs');
    };
    const handleProjectsSync = () => {
      console.log('[Lyria AppContext] Projects sync event received. Refreshing projects...');
      refreshCollection('projects');
    };
    const handleFinanceSync = () => {
      console.log('[Lyria AppContext] Finance sync event received. Refreshing finance...');
      refreshCollection('finance');
    };
    const handleFixedCostsSync = () => {
      console.log('[Lyria AppContext] FixedCosts sync event received. Refreshing fixedCosts...');
      refreshCollection('fixedCosts');
    };
    const handleRewardsSync = () => {
      console.log('[Lyria AppContext] Rewards sync event received. Refreshing rewards...');
      refreshCollection('rewards');
    };
    const handleWeeklyReviewsSync = () => {
      console.log('[Lyria AppContext] WeeklyReviews sync event received. Refreshing weeklyReviews...');
      refreshCollection('weeklyReviews');
    };

    window.addEventListener('lyria-tasks-synced', handleTasksSync);
    window.addEventListener('lyria-learnings-synced', handleLearningsSync);
    window.addEventListener('lyria-experiments-synced', handleExperimentsSync);
    window.addEventListener('lyria-checkins-synced', handleCheckinsSync);
    window.addEventListener('lyria-allocations-synced', handleAllocationsSync);
    window.addEventListener('lyria-routines-synced', handleRoutinesSync);
    window.addEventListener('lyria-logs-synced', handleLogsSync);
    window.addEventListener('lyria-projects-synced', handleProjectsSync);
    window.addEventListener('lyria-finance-synced', handleFinanceSync);
    window.addEventListener('lyria-fixedcosts-synced', handleFixedCostsSync);
    window.addEventListener('lyria-rewards-synced', handleRewardsSync);
    window.addEventListener('lyria-weeklyreviews-synced', handleWeeklyReviewsSync);

    return () => {
      window.removeEventListener('lyria-tasks-synced', handleTasksSync);
      window.removeEventListener('lyria-learnings-synced', handleLearningsSync);
      window.removeEventListener('lyria-experiments-synced', handleExperimentsSync);
      window.removeEventListener('lyria-checkins-synced', handleCheckinsSync);
      window.removeEventListener('lyria-allocations-synced', handleAllocationsSync);
      window.removeEventListener('lyria-routines-synced', handleRoutinesSync);
      window.removeEventListener('lyria-logs-synced', handleLogsSync);
      window.removeEventListener('lyria-projects-synced', handleProjectsSync);
      window.removeEventListener('lyria-finance-synced', handleFinanceSync);
      window.removeEventListener('lyria-fixedcosts-synced', handleFixedCostsSync);
      window.removeEventListener('lyria-rewards-synced', handleRewardsSync);
      window.removeEventListener('lyria-weeklyreviews-synced', handleWeeklyReviewsSync);
    };
  }, [refreshCollection]);

  const createItem = useCallback((stateKey, item) => {
    const result = db.create(collectionMap[stateKey], item);
    refreshCollection(stateKey);

    const config = SYNC_CONFIG[stateKey];
    if (config) {
      const activeUser = user || getCurrentUser();
      console.log(`[Lyria Batch 1 Create Sync] Collection Key: ${stateKey}`);
      console.log(`[Lyria Batch 1 Create Sync] Current User:`, activeUser ? { id: activeUser.id, email: activeUser.email } : null);

      if (activeUser && supabase) {
        const remoteItem = config.mapLocal(result, activeUser.id);
        console.log(`[Lyria Batch 1 Create Sync] Insert Payload:`, remoteItem);
        supabase
          .from(config.table)
          .insert(remoteItem)
          .then(({ error }) => {
            if (error) {
              console.error(`[Lyria Batch 1 Create Sync] Error:`, error.message, error);
            } else {
              console.log(`[Lyria Batch 1 Create Sync] Success: true`);
            }
          })
          .catch(err => {
            console.error(`[Lyria Batch 1 Create Sync] Error Exception:`, err);
          });
      } else {
        console.log(`[Lyria Batch 1 Create Sync] Skip: activeUser or supabase is null (User: ${activeUser ? activeUser.id : 'null'})`);
      }
    }

    return result;
  }, [refreshCollection, user]);

  const updateItem = useCallback((stateKey, id, updates) => {
    const result = db.update(collectionMap[stateKey], id, updates);
    refreshCollection(stateKey);

    const config = SYNC_CONFIG[stateKey];
    if (config && result) {
      const activeUser = user || getCurrentUser();
      console.log(`[Lyria AppContext] updateItem ${stateKey} called for ID:`, id, 'with updates:', updates);

      if (activeUser && supabase) {
        const remoteItem = config.mapLocal(result, activeUser.id);
        console.log(`[Lyria AppContext] update payload for ${stateKey}:`, remoteItem);
        supabase
          .from(config.table)
          .upsert(remoteItem, { onConflict: 'id' })
          .then(({ error }) => {
            if (error) {
              console.error(`[Lyria AppContext] update error for ${stateKey}:`, error.message, error);
            } else {
              console.log(`[Lyria AppContext] update success for ${stateKey}.`);
            }
          })
          .catch(err => {
            console.error(`[Lyria AppContext] update exception for ${stateKey}:`, err);
          });
      } else {
        console.log(`[Lyria AppContext] Skip update for ${stateKey}: user or supabase is null`);
      }
    }

    return result;
  }, [refreshCollection, user]);

  const updateBatch = useCallback((stateKey, updatesArray) => {
    const result = db.updateBatch(collectionMap[stateKey], updatesArray);
    refreshCollection(stateKey);

    const config = SYNC_CONFIG[stateKey];
    if (config) {
      const activeUser = user || getCurrentUser();
      console.log(`[Lyria AppContext] updateBatch ${stateKey} called with count:`, updatesArray.length);

      if (activeUser && supabase) {
        const ids = updatesArray.map(u => u.id);
        const allItems = safeGetAll(collectionMap[stateKey]);
        const updatedItems = allItems.filter(t => ids.includes(t.id));
        if (updatedItems.length > 0) {
          const payload = updatedItems.map(item => config.mapLocal(item, activeUser.id));
          console.log(`[Lyria AppContext] batch payload count for ${stateKey}:`, payload.length);
          supabase
            .from(config.table)
            .upsert(payload, { onConflict: 'id' })
            .then(({ error }) => {
              if (error) {
                console.error(`[Lyria AppContext] batch update error for ${stateKey}:`, error.message, error);
              } else {
                console.log(`[Lyria AppContext] batch update success for ${stateKey}.`);
              }
            })
            .catch(err => {
              console.error(`[Lyria AppContext] batch update exception for ${stateKey}:`, err);
            });
        }
      } else {
        console.log(`[Lyria AppContext] Skip batch update for ${stateKey}: user or supabase is null`);
      }
    }

    return result;
  }, [refreshCollection, user]);

  const deleteItem = useCallback((stateKey, id) => {
    db.remove(collectionMap[stateKey], id);
    refreshCollection(stateKey);

    const config = SYNC_CONFIG[stateKey];
    if (config) {
      const activeUser = user || getCurrentUser();
      console.log(`[Lyria AppContext] deleteItem ${stateKey} called for ID:`, id);

      if (activeUser && supabase) {
        const updatePayload = {
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        if (stateKey === 'tasks') {
          updatePayload.status = 'excluída';
        }

        supabase
          .from(config.table)
          .update(updatePayload)
          .eq('id', id)
          .then(({ error }) => {
            if (error) {
              console.error(`[Lyria AppContext] delete error for ${stateKey}:`, error.message, error);
            } else {
              console.log(`[Lyria AppContext] delete success for ${stateKey}. Row soft-deleted.`);
            }
          })
          .catch(err => {
            console.error(`[Lyria AppContext] delete exception for ${stateKey}:`, err);
          });
      } else {
        console.log(`[Lyria AppContext] Skip delete for ${stateKey}: user or supabase is null`);
      }
    }
  }, [refreshCollection, user]);

  const value = {
    ...state,
    refreshAll,
    refreshCollection,
    createItem,
    updateItem,
    updateBatch,
    deleteItem,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
