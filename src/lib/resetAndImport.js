// Reset & Import — clears local AND remote data atomically
// Prevents sync from restoring old data after reset or import
import { supabase, getCurrentUser } from './supabaseClient.js';
import { db, COLLECTIONS } from '../data/db.js';
import { SYNCABLE_SETTINGS } from './settingsSync.js';

// ============================================================
// GLOBAL SYNC GUARD
// When true, all sync runners must skip downloading remote data.
// ============================================================
let _syncBlocked = false;

export function isSyncBlocked() {
  const isLocked = localStorage.getItem('lyria_import_in_progress') === 'true';
  return _syncBlocked || isLocked;
}

export function blockSync() {
  _syncBlocked = true;
  console.log('[Lyria Reset] Sync BLOCKED');
}

export function unblockSync() {
  _syncBlocked = false;
  console.log('[Lyria Reset] Sync UNBLOCKED');
}

export function startImportLock() {
  localStorage.setItem('lyria_import_in_progress', 'true');
  console.log('[Lyria Import Debug] persistent lock SET');
}

export function releaseImportLock() {
  localStorage.removeItem('lyria_import_in_progress');
  console.log('[Lyria Import Debug] persistent lock CLEARED');
}

// ============================================================
// ALL SUPABASE TABLES THAT HOLD USER APP DATA
// ============================================================
const REMOTE_DATA_TABLES = [
  'tasks',
  'projects',
  'learnings',
  'experiments',
  'daily_checkins',
  'time_allocations',
  'workout_routines',
  'workout_logs',
  'weekly_reviews',
  'finance_entries',
  'fixed_costs',
  'finance_import_drafts',
  'rewards',
];

// Finance entry "type" values from older app versions that are not valid in the
// current schema (CHECK type IN ('entrada','saída')). These are omitted on import
// and preserved separately so historical data is never silently destroyed.
const IGNORE_FINANCE_TYPES = ['ignorar', 'ignore'];

const REMOTE_META_TABLES = [
  'user_settings',
  'migration_state',
  'daily_quote_state',
];

// ============================================================
// CLEAR ALL REMOTE DATA FOR CURRENT USER
// Hard-deletes rows (not soft-delete) so sync cannot bring them back.
// ============================================================
async function clearRemoteData(userId) {
  if (!supabase || !userId) return;

  console.log('[Lyria Reset] Clearing remote data for user:', userId);

  for (const table of REMOTE_DATA_TABLES) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('user_id', userId);
    if (error) {
      throwImportError({
        step: 'limpar dados remotos',
        moduleName: table,
        originalError: error,
        supabaseDetails: error.details || error.hint || error.message
      });
    }
  }

  // Clear metadata tables
  for (const table of REMOTE_META_TABLES) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('user_id', userId);
    if (error) {
      throwImportError({
        step: 'limpar metadados remotos',
        moduleName: table,
        originalError: error,
        supabaseDetails: error.details || error.hint || error.message
      });
    }
  }

  console.log('[Lyria Reset] Remote data cleared.');
}

// ============================================================
// CLEAR ALL LOCAL DATA
// Removes all cp_* keys, settings, and misc localStorage keys.
// Preserves only Supabase auth session keys.
// ============================================================
export function clearLocalData() {
  console.log('[Lyria Reset] Clearing local data...');

  // Clear all collections
  Object.values(COLLECTIONS).forEach(key => {
    localStorage.removeItem('cp_' + key);
  });

  // Clear all syncable settings
  SYNCABLE_SETTINGS.forEach(key => {
    localStorage.removeItem(key);
  });

  // Clear additional known keys
  const additionalKeys = [
    'cp_initialized',
    'cp__demo_loaded',
    'cp_finance_import_draft',
    'cp_monthlyGoal',
    'cp_theme',
    'lyria_quote_unlocked_date',
  ];
  additionalKeys.forEach(key => {
    localStorage.removeItem(key);
  });

  // Sweep any remaining cp_ keys except auth
  const allKeys = Object.keys(localStorage);
  allKeys.forEach(key => {
    if (key.startsWith('cp_')) {
      localStorage.removeItem(key);
    }
  });

  // Re-set initialized flag so seed data doesn't reload
  db.setInitialized();

  console.log('[Lyria Reset] Local data cleared.');
}

// ============================================================
// FULL RESET — clears both local + remote, blocks sync
// ============================================================
export async function resetAllData(refreshAll) {
  const user = getCurrentUser();
  console.log('[Lyria Reset] === RESET STARTED ===');

  // 1. Block sync immediately to prevent any concurrent download
  blockSync();

  // 2. Clear localStorage
  clearLocalData();

  // 3. Refresh React state to show empty UI immediately
  if (refreshAll) refreshAll();

  // 4. Clear remote data
  if (user) {
    await clearRemoteData(user.id);
  }

  console.log('[Lyria Reset] === RESET COMPLETED ===');
  // NOTE: sync stays blocked until page reload or explicit unblock
}

// ============================================================
// COLLECTION KEY -> DB KEY mapping
// ============================================================
const STATE_TO_DB_KEY = {
  tasks: 'tasks',
  finance: 'finance',
  learnings: 'learnings',
  experiments: 'experiments',
  weeklyReviews: 'weekly_reviews',
  dailyCheckIns: 'daily_checkins',
  timeAllocations: 'time_allocations',
  workoutRoutines: 'workout_routines',
  workoutLogs: 'workout_logs',
  projects: 'projects',
  fixedCosts: 'fixed_costs',
  rewards: 'rewards',
};

// SYNC_CONFIG mapping for upload to Supabase
const IMPORT_SYNC_CONFIG = {
  tasks: { table: 'tasks' },
  learnings: { table: 'learnings' },
  experiments: { table: 'experiments' },
  dailyCheckIns: { table: 'daily_checkins' },
  timeAllocations: { table: 'time_allocations' },
  workoutRoutines: { table: 'workout_routines' },
  workoutLogs: { table: 'workout_logs' },
  projects: { table: 'projects' },
  finance: { table: 'finance_entries' },
  fixedCosts: { table: 'fixed_costs' },
  weeklyReviews: { table: 'weekly_reviews' },
  rewards: { table: 'rewards' },
};

// All collections sync to Supabase now (weeklyReviews included via 005 migration).
// If the weekly_reviews table is missing remotely, the import degrades gracefully
// (keeps weeklyReviews local-only) instead of failing the whole restore.
const LOCAL_ONLY_COLLECTIONS = [];

function throwImportError({ step, moduleName, expected, local, supabaseCount, originalError, supabaseDetails }) {
  let msg = `Falha na etapa "${step}"`;
  if (moduleName) msg += ` para o módulo "${moduleName}"`;
  msg += `.`;

  const details = [];
  if (expected !== undefined) details.push(`esperado: ${expected}`);
  if (local !== undefined) details.push(`local: ${local}`);
  if (supabaseCount !== undefined) details.push(`Supabase: ${supabaseCount}`);
  if (originalError) {
    const errorMsg = originalError.message || String(originalError);
    details.push(`erro original: ${errorMsg}`);
  }
  if (supabaseDetails) details.push(`detalhes: ${supabaseDetails}`);

  if (details.length > 0) {
    msg += ` (${details.join(', ')})`;
  }
  
  const err = new Error(msg);
  err.step = step;
  err.moduleName = moduleName;
  err.expected = expected;
  err.local = local;
  err.supabaseCount = supabaseCount;
  err.originalError = originalError;
  throw err;
}

function convertKeysToCamelCase(obj) {
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToCamelCase);
  } else if (obj !== null && typeof obj === 'object') {
    const newObj = {};
    Object.keys(obj).forEach(key => {
      const camelKey = key.includes('_') ? key.replace(/_([a-z0-9])/g, (_, p1) => p1.toUpperCase()) : key;
      newObj[camelKey] = convertKeysToCamelCase(obj[key]);
    });
    return newObj;
  }
  return obj;
}

function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // Fallback RFC4122-ish
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// C4: Regenerate every record id so imported rows can never collide on primary key
// with rows owned by another user (which would trigger RLS "USING expression" errors
// on upsert). Internal relationships are preserved by remapping references through idMap.
function remapImportedIds(normalizedData, collectionKeys) {
  const idMap = {};

  // 1. Assign fresh ids to every collection record.
  collectionKeys.forEach(key => {
    const arr = normalizedData[key];
    if (!Array.isArray(arr)) return;
    arr.forEach(item => {
      if (item && item.id) {
        const newId = genId();
        idMap[item.id] = newId;
        item.id = newId;
      } else if (item && !item.id) {
        item.id = genId();
      }
    });
  });

  // 2. Fix known cross-collection references.
  // finance_entries.fixedCostId -> fixed_costs.id
  if (Array.isArray(normalizedData.finance)) {
    normalizedData.finance.forEach(f => {
      if (f && f.fixedCostId && idMap[f.fixedCostId]) {
        f.fixedCostId = idMap[f.fixedCostId];
      }
    });
  }

  return idMap;
}

// Detects Postgres/PostgREST errors that mean a table or column does not exist yet
// (e.g. migration not applied). Used to degrade gracefully instead of aborting.
function isMissingSchemaError(error) {
  if (!error) return false;
  const code = error.code || '';
  const msg = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
  return (
    code === '42P01' ||            // undefined_table
    code === '42703' ||            // undefined_column
    code === 'PGRST204' ||         // column not found in schema cache
    code === 'PGRST205' ||         // table not found in schema cache
    msg.includes('does not exist') ||
    msg.includes('could not find') ||
    msg.includes('schema cache')
  );
}

// ============================================================
// NORMALIZATION FUNCTION
// ============================================================
export function normalizeBackupData(rawData) {
  const data = JSON.parse(JSON.stringify(rawData)); // clone to avoid mutation

  // Collection mappings: canonical camelCase key -> array of supported key aliases
  const collectionMapping = {
    tasks: ['tasks'],
    finance: ['finance', 'finance_entries'],
    fixedCosts: ['fixedCosts', 'fixed_costs'],
    projects: ['projects'],
    learnings: ['learnings'],
    experiments: ['experiments'],
    weeklyReviews: ['weeklyReviews', 'weekly_reviews'],
    dailyCheckIns: ['dailyCheckIns', 'daily_checkins'],
    timeAllocations: ['timeAllocations', 'time_allocations'],
    workoutRoutines: ['workoutRoutines', 'workout_routines'],
    workoutLogs: ['workoutLogs', 'workout_logs'],
    rewards: ['rewards', 'recompensas'],
  };

  // Ensure _settings exists
  if (!data._settings) {
    data._settings = {};
  }

  // If a top-level settings or settings object exists, merge it in
  if (data.settings && typeof data.settings === 'object') {
    data._settings = { ...data._settings, ...data.settings };
  }

  // Move top-level cp_* keys to _settings
  Object.keys(data).forEach(key => {
    if (key.startsWith('cp_')) {
      data._settings[key] = data[key];
    }
  });

  if (data.lyria_quote_unlocked_date !== undefined && data.lyria_quote_unlocked_date !== null) {
    data._settings.lyria_quote_unlocked_date = data.lyria_quote_unlocked_date;
  }

  // Normalize specific settings aliases:
  
  // 1. Balance
  const balanceAliases = ['cp_initial_balance', 'globalBalance', 'initialBalance', 'bankBalance', 'initial_balance'];
  let foundBalance = null;
  for (const alias of balanceAliases) {
    if (data[alias] !== undefined && data[alias] !== null) {
      foundBalance = data[alias];
      break;
    }
  }
  if (foundBalance === null && data._settings) {
    for (const alias of balanceAliases) {
      if (data._settings[alias] !== undefined && data._settings[alias] !== null) {
        foundBalance = data._settings[alias];
        break;
      }
    }
  }
  if (foundBalance !== null) {
    data._settings.cp_initial_balance = foundBalance;
  }

  // 2. Finance Import Rules
  const rulesAliases = ['cp_finance_import_rules', 'finance_import_rules', 'financeImportRules'];
  let foundRules = null;
  for (const alias of rulesAliases) {
    if (data[alias] !== undefined && data[alias] !== null) {
      foundRules = data[alias];
      break;
    }
  }
  if (foundRules === null && data._settings) {
    for (const alias of rulesAliases) {
      if (data._settings[alias] !== undefined && data._settings[alias] !== null) {
        foundRules = data._settings[alias];
        break;
      }
    }
  }
  if (foundRules !== null) {
    data._settings.cp_finance_import_rules = foundRules;
  }

  // 3. Financial Goal V2
  const goalAliases = ['cp_financialGoal_v2', 'financialGoal_v2', 'financial_goal_v2'];
  let foundGoal = null;
  for (const alias of goalAliases) {
    if (data[alias] !== undefined && data[alias] !== null) {
      foundGoal = data[alias];
      break;
    }
  }
  if (foundGoal === null && data._settings) {
    for (const alias of goalAliases) {
      if (data._settings[alias] !== undefined && data._settings[alias] !== null) {
        foundGoal = data._settings[alias];
        break;
      }
    }
  }
  if (foundGoal !== null) {
    data._settings.cp_financialGoal_v2 = foundGoal;
  }

  // 4. Dashboard Layout
  const layoutAliases = ['cp_dashboard_layout', 'dashboard_layout', 'dashboardLayout'];
  let foundLayout = null;
  for (const alias of layoutAliases) {
    if (data[alias] !== undefined && data[alias] !== null) {
      foundLayout = data[alias];
      break;
    }
  }
  if (foundLayout === null && data._settings) {
    for (const alias of layoutAliases) {
      if (data._settings[alias] !== undefined && data._settings[alias] !== null) {
        foundLayout = data._settings[alias];
        break;
      }
    }
  }
  if (foundLayout !== null) {
    data._settings.cp_dashboard_layout = foundLayout;
  }

  // 5. Finance Import Draft
  const draftAliases = ['cp_finance_import_draft', 'finance_import_draft', 'financeImportDraft'];
  let foundDraft = null;
  for (const alias of draftAliases) {
    if (data[alias] !== undefined && data[alias] !== null) {
      foundDraft = data[alias];
      break;
    }
  }
  if (foundDraft === null && data._settings) {
    for (const alias of draftAliases) {
      if (data._settings[alias] !== undefined && data._settings[alias] !== null) {
        foundDraft = data._settings[alias];
        break;
      }
    }
  }
  if (foundDraft !== null) {
    data._settings.cp_finance_import_draft = foundDraft;
  }

  // Normalize all collections into camelCase
  const normalized = {
    _settings: data._settings,
    _metadata: data._metadata || {}
  };

  const presentKeys = {};

  Object.entries(collectionMapping).forEach(([canonicalKey, aliases]) => {
    let foundData = null;
    let exists = false;
    for (const alias of aliases) {
      if (data[alias] !== undefined) {
        exists = true;
        if (Array.isArray(data[alias])) {
          foundData = data[alias];
          break;
        }
      }
    }
    presentKeys[canonicalKey] = exists;
    // Normalize properties of elements within collection to camelCase
    const records = foundData || [];
    normalized[canonicalKey] = records.map(item => convertKeysToCamelCase(item));
  });

  // Generate warnings
  const warnings = [];

  // C2: Strip legacy finance entries whose type is not valid in the current schema
  // (e.g. "Ignorar"). Preserve them under _omittedFinanceIgnorar so no history is lost.
  const omittedFinanceIgnorar = [];
  if (Array.isArray(normalized.finance)) {
    const kept = [];
    for (const entry of normalized.finance) {
      const t = String(entry?.type || '').toLowerCase();
      if (IGNORE_FINANCE_TYPES.includes(t)) {
        omittedFinanceIgnorar.push(entry);
      } else {
        kept.push(entry);
      }
    }
    normalized.finance = kept;
  }
  // Merge with any pre-existing omitted list carried in the backup itself.
  if (Array.isArray(rawData._omitted_finance_ignorar)) {
    omittedFinanceIgnorar.push(...rawData._omitted_finance_ignorar);
  }
  normalized._omittedFinanceIgnorar = omittedFinanceIgnorar;
  if (omittedFinanceIgnorar.length > 0) {
    warnings.push(
      `${omittedFinanceIgnorar.length} lançamento(s) financeiro(s) marcado(s) como "Ignorar" ` +
      `foram omitidos (incompatíveis com a versão atual). Eles foram preservados no backup ` +
      `em "_omitted_finance_ignorar".`
    );
  }

  if (foundBalance === null) {
    warnings.push('Este backup não contém saldo bancário inicial/global.');
  }
  if (!presentKeys.fixedCosts) {
    warnings.push('Este backup não contém custos fixos.');
  }

  return { normalized, presentKeys, warnings };
}

// ============================================================
// FULL IMPORT — replaces all data, local + remote
// ============================================================
export async function importFullBackup(importedData, mappers, refreshAll) {
  console.log('[Lyria Import Debug] import started');

  if (!supabase) {
    throwImportError({
      step: 'verificação de dependências',
      originalError: 'Supabase não está configurado.'
    });
  }

  // Fetch fresh authenticated user directly from Supabase API to bypass stale cached auth state
  let authUser = null;
  try {
    const { data } = await supabase.auth.getUser();
    authUser = data?.user || null;
  } catch (userErr) {
    console.error('[Lyria Import Debug] Failed to fetch authenticated user:', userErr);
  }

  if (!authUser) {
    throwImportError({
      step: 'verificar autenticação',
      originalError: 'Falha ao restaurar tasks: usuário não autenticado no Supabase.'
    });
  }

  const collectionKeys = [
    'tasks', 'fixedCosts', 'finance', 'learnings', 'experiments', 'weeklyReviews',
    'dailyCheckIns', 'timeAllocations', 'workoutRoutines', 'workoutLogs',
    'projects', 'rewards',
  ];

  // Backup current local storage state for transactional safety / rollback
  const localBackup = {};
  try {
    collectionKeys.forEach(key => {
      const dbKey = STATE_TO_DB_KEY[key];
      const val = localStorage.getItem('cp_' + dbKey);
      if (val !== null) {
        localBackup['cp_' + dbKey] = val;
      }
    });
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(key => {
      if (key.startsWith('cp_') || key === 'lyria_quote_unlocked_date') {
        const val = localStorage.getItem(key);
        if (val !== null) {
          localBackup[key] = val;
        }
      }
    });
  } catch (backupErr) {
    console.warn('[Lyria Import Debug] Failed to create local backup:', backupErr);
  }

  // 1. Block sync during entire import and set persistent lock
  blockSync();
  startImportLock();

  try {
    const { normalized: normalizedData, presentKeys } = normalizeBackupData(importedData);

    // C4: Regenerate all ids BEFORE anything destructive, so imported rows can never
    // collide with another user's rows on upsert (the RLS "USING expression" error).
    const idMap = remapImportedIds(normalizedData, collectionKeys);
    console.log('[Lyria Import Debug] ids remapped:', Object.keys(idMap).length);

    // C2: Persist any omitted "Ignorar" finance entries so the historical record is
    // never lost — kept in localStorage and automatically included in future exports.
    if (Array.isArray(normalizedData._omittedFinanceIgnorar) && normalizedData._omittedFinanceIgnorar.length > 0) {
      normalizedData._settings = normalizedData._settings || {};
      normalizedData._settings.cp_omitted_finance_ignorar = normalizedData._omittedFinanceIgnorar;
    }

    // Log detected modules and counts
    const detectedLogs = [];
    collectionKeys.forEach(key => {
      if (presentKeys[key]) {
        detectedLogs.push(`${key}: ${(normalizedData[key] || []).length}`);
      }
    });
    console.log('[Lyria Import Debug] module counts detected:', detectedLogs.join(', '));

    // C3: Build AND validate every upload payload BEFORE touching remote data.
    // If a mapper is missing or a user_id is wrong, we fail here while the remote
    // database is still fully intact (no destructive clear has happened yet).
    const uploadPlan = [];
    for (const stateKey of collectionKeys) {
      const items = normalizedData[stateKey];
      if (!items || !Array.isArray(items) || items.length === 0) continue;

      const config = IMPORT_SYNC_CONFIG[stateKey];
      const mapFn = mappers[stateKey] || mappers[STATE_TO_DB_KEY[stateKey]];
      if (!config || !mapFn) {
        throwImportError({
          step: 'preparar upload (mapeamento ausente)',
          moduleName: stateKey,
          expected: items.length
        });
      }

      const payload = items.map(item => {
        const mapped = mapFn(item, authUser.id);
        mapped.user_id = authUser.id; // Force current authenticated user's id
        return mapped;
      });

      // Defensive: never trust ids/user_id from the backup.
      for (let idx = 0; idx < payload.length; idx++) {
        if (!payload[idx].user_id || payload[idx].user_id !== authUser.id) {
          throwImportError({ step: 'validação de user_id', moduleName: stateKey });
        }
      }

      uploadPlan.push({ stateKey, table: config.table, payload, count: items.length });
    }
    console.log('[Lyria Import Debug] upload plan built for modules:',
      uploadPlan.map(j => `${j.stateKey}(${j.count})`).join(', '));

    // 2. Clear remote data (validation passed; payloads are ready in memory)
    console.log('[Lyria Import Debug] remote clear started');
    await clearRemoteData(authUser.id);
    console.log('[Lyria Import Debug] remote clear completed');

    // 3. Clear local data (ensuring lock state is preserved in localStorage)
    const wasLocked = localStorage.getItem('lyria_import_in_progress');
    clearLocalData();
    if (wasLocked) {
      localStorage.setItem('lyria_import_in_progress', wasLocked);
    }
    console.log('[Lyria Import Debug] local clear completed');

    // 4. Write imported settings to localStorage
    if (normalizedData._settings) {
      Object.entries(normalizedData._settings).forEach(([key, val]) => {
        const rawValue = typeof val === 'object' ? JSON.stringify(val) : String(val);
        localStorage.setItem(key, rawValue);
      });
      console.log('[Lyria Import Debug] settings restored to localStorage.');
    }

    // Re-apply visual theme immediately
    const finalMode = localStorage.getItem('cp_mode') || 'dark';
    const finalAccent = localStorage.getItem('cp_accent') || 'purple-premium';
    document.documentElement.setAttribute('data-mode', finalMode);
    document.documentElement.setAttribute('data-accent', finalAccent);

    // 5. Write imported collections to localStorage (uses remapped ids)
    const localWriteCounts = [];
    collectionKeys.forEach(key => {
      if (presentKeys[key]) {
        const dbKey = STATE_TO_DB_KEY[key];
        db.set(dbKey, normalizedData[key]);
        localWriteCounts.push(`${key}: ${normalizedData[key].length}`);
      }
    });
    console.log('[Lyria Import Debug] local write counts:', localWriteCounts.join(', '));

    // 6. Refresh React state with imported data
    if (refreshAll) {
      refreshAll();
    }

    // 7. Upload imported data to Supabase from the pre-built plan.
    // Optional schema (weekly_reviews table / rewards financial columns) degrades
    // gracefully if the migration has not been applied yet.
    const remoteSkipped = new Set();
    const uploadCounts = [];

    const upsertChunks = async (table, rows) => {
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
        if (error) return error;
      }
      return null;
    };

    for (const job of uploadPlan) {
      const { stateKey, table, payload, count } = job;
      console.log(`[Lyria Import Debug] per-module upload started: ${stateKey} (${count} itens)`);

      let uploadError = await upsertChunks(table, payload);

      if (uploadError && isMissingSchemaError(uploadError)) {
        if (stateKey === 'rewards') {
          // Retry rewards without optional financial columns (migration 003 not applied).
          const stripped = payload.map(r => {
            const copy = { ...r };
            delete copy.financial_target_amount;
            delete copy.financial_current_amount;
            return copy;
          });
          const retryError = await upsertChunks(table, stripped);
          if (!retryError) {
            console.warn('[Lyria Import] Recompensas enviadas sem colunas financeiras (rode a migration 003).');
            uploadCounts.push(`${stateKey}: ${count} (sem colunas financeiras)`);
            continue;
          }
          if (isMissingSchemaError(retryError)) {
            remoteSkipped.add(stateKey);
            console.warn('[Lyria Import] Tabela "rewards" ausente. Recompensas mantidas apenas localmente (rode a migration 002).');
            continue;
          }
          uploadError = retryError;
        } else if (stateKey === 'weeklyReviews') {
          remoteSkipped.add(stateKey);
          console.warn('[Lyria Import] Tabela "weekly_reviews" ausente. Revisões mantidas apenas localmente (rode a migration 005).');
          continue;
        }
      }

      if (uploadError) {
        throwImportError({
          step: 'upload para o Supabase',
          moduleName: stateKey,
          expected: count,
          originalError: uploadError,
          supabaseDetails: uploadError.message || uploadError.details || uploadError.hint
        });
      }

      uploadCounts.push(`${stateKey}: ${count}`);
      console.log(`[Lyria Import Debug] per-module upload completed: ${stateKey} (${count} itens)`);
    }
    console.log('[Lyria Import Debug] remote upload counts:', uploadCounts.join(', '));

    // 8. Upload settings to Supabase user_settings
    if (normalizedData._settings) {
      const settingsUpserts = [];
      SYNCABLE_SETTINGS.forEach(key => {
        const val = localStorage.getItem(key);
        if (val !== null) {
          let parsedVal;
          try { parsedVal = JSON.parse(val); } catch { parsedVal = val; }
          settingsUpserts.push({
            user_id: authUser.id,
            setting_key: key,
            setting_value: parsedVal,
          });
        }
      });
      if (settingsUpserts.length > 0) {
        const { error } = await supabase
          .from('user_settings')
          .upsert(settingsUpserts, { onConflict: 'user_id,setting_key' });
        if (error) {
          throwImportError({
            step: 'upload de configurações',
            originalError: error,
            supabaseDetails: error.message || error.details || error.hint
          });
        }
      }
    }

    // 9. Set migration_state to 'completed' for all collections
    const migrationUpserts = collectionKeys.map(key => ({
      user_id: authUser.id,
      collection_key: key,
      status: 'completed',
      local_count: (normalizedData[key] || []).length,
      remote_count: (normalizedData[key] || []).length,
      migrated_at: new Date().toISOString(),
    }));
    const { error: migError } = await supabase
      .from('migration_state')
      .upsert(migrationUpserts, { onConflict: 'user_id,collection_key' });
    if (migError) {
      throwImportError({
        step: 'atualizar migration_state',
        originalError: migError,
        supabaseDetails: migError.message || migError.details || migError.hint
      });
    }
    console.log('[Lyria Import Debug] migration_state counts completed');

    // 10. Post-import Verification Phase
    console.log('[Lyria Import Debug] starting post-import verification...');
    for (const stateKey of collectionKeys) {
      if (presentKeys[stateKey]) {
        const dbKey = STATE_TO_DB_KEY[stateKey];
        const localItems = db.getAll(dbKey) || [];
        const expectedCount = (normalizedData[stateKey] || []).length;
        
        // Verify local storage count
        if (localItems.length !== expectedCount) {
          throwImportError({
            step: 'verificação local (localStorage)',
            moduleName: stateKey,
            expected: expectedCount,
            local: localItems.length
          });
        }

        // Verify Supabase count (if syncable and not degraded to local-only)
        if (!LOCAL_ONLY_COLLECTIONS.includes(stateKey) && !remoteSkipped.has(stateKey)) {
          const config = IMPORT_SYNC_CONFIG[stateKey];
          const mapFn = mappers[stateKey] || mappers[STATE_TO_DB_KEY[stateKey]];
          if (authUser && supabase && config && mapFn) {
            const { count, error } = await supabase
              .from(config.table)
              .select('*', { count: 'exact', head: true })
              .eq('user_id', authUser.id);
            if (error) {
              throwImportError({
                step: 'verificação remota (Supabase query)',
                moduleName: stateKey,
                expected: expectedCount,
                originalError: error,
                supabaseDetails: error.message || error.details || error.hint
              });
            }
            if (count !== expectedCount) {
              throwImportError({
                step: 'verificação remota (Supabase count)',
                moduleName: stateKey,
                expected: expectedCount,
                local: localItems.length,
                supabaseCount: count
              });
            }
          }
        }
        console.log(`[Lyria Import Debug] per-module verification result: ${stateKey} verificado (esperado: ${expectedCount})`);
      }
    }

    // Verify settings in localStorage and Supabase
    if (normalizedData._settings) {
      Object.keys(normalizedData._settings).forEach(key => {
        if (localStorage.getItem(key) === null) {
          throwImportError({
            step: 'verificação de configurações locais',
            moduleName: key
          });
        }
      });

      if (authUser && supabase) {
        const syncableSettingsInBackup = Object.keys(normalizedData._settings).filter(k => SYNCABLE_SETTINGS.includes(k));
        if (syncableSettingsInBackup.length > 0) {
          const { data: remoteSettings, error: settingsError } = await supabase
            .from('user_settings')
            .select('setting_key')
            .eq('user_id', authUser.id);
          if (settingsError) {
            throwImportError({
              step: 'verificação de configurações remotas (query)',
              originalError: settingsError,
              supabaseDetails: settingsError.message
            });
          }
          const remoteKeys = new Set((remoteSettings || []).map(r => r.setting_key));
          for (const key of syncableSettingsInBackup) {
            if (!remoteKeys.has(key)) {
              throwImportError({
                step: 'verificação de configurações remotas (chave ausente)',
                moduleName: key
              });
            }
          }
        }
      }
    }

    console.log('[Lyria Import Debug] verification success');

    // 11. Release lock on success
    releaseImportLock();
    unblockSync();
    console.log('[Lyria Import Debug] sync released');
    console.log('[Lyria Import] === IMPORT COMPLETED ===');
  } catch (err) {
    console.error('[Lyria Import Debug] import failed with exact step/module:', err.step || 'desconhecido', err.moduleName || 'desconhecido', err.message);
    
    // Safely roll back local storage state
    try {
      console.log('[Lyria Import Debug] Rolling back local data to pre-import state...');
      clearLocalData();
      Object.entries(localBackup).forEach(([key, val]) => {
        localStorage.setItem(key, val);
      });
      if (refreshAll) {
        refreshAll();
      }
      console.log('[Lyria Import Debug] Rollback completed.');
    } catch (rollbackErr) {
      console.error('[Lyria Import Debug] Failed to roll back local storage:', rollbackErr);
    }

    // Release sync blocks
    releaseImportLock();
    unblockSync();
    console.log('[Lyria Import Debug] sync released or intentionally kept (safe rollback released)');
    
    throw err;
  }
}
