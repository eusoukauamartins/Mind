import { supabase } from './supabaseClient.js';
import { db } from '../data/db.js';
import { isSyncBlocked } from './resetAndImport.js';

// ============================================================
// 1. FIXED COSTS MAPPING
// ============================================================
export function mapRemoteToLocalFixedCost(remote) {
  return {
    id: remote.id,
    title: remote.title,
    amount: remote.amount,
    recurrence: remote.recurrence || 'mensal',
    dueDay: remote.due_day || '5',
    dueMonth: remote.due_month || '1',
    category: remote.category || '',
    notes: remote.notes || '',
    paidPeriods: Array.isArray(remote.paid_periods) ? remote.paid_periods : [],
    skippedPeriods: Array.isArray(remote.skipped_periods) ? remote.skipped_periods : [],
    createdAt: remote.created_at
  };
}

export function mapLocalToRemoteFixedCost(local, userId) {
  return {
    id: local.id,
    user_id: userId,
    title: local.title,
    amount: typeof local.amount === 'number' ? local.amount : parseFloat(local.amount) || 0,
    recurrence: local.recurrence || 'mensal',
    due_day: String(local.dueDay || '5'),
    due_month: String(local.dueMonth || '1'),
    category: local.category || null,
    notes: local.notes || null,
    paid_periods: Array.isArray(local.paidPeriods) ? local.paidPeriods : [],
    skipped_periods: Array.isArray(local.skippedPeriods) ? local.skippedPeriods : [],
    created_at: local.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null
  };
}

// ============================================================
// 2. FINANCE ENTRIES MAPPING
// ============================================================
export function mapRemoteToLocalFinance(remote) {
  return {
    id: remote.id,
    type: remote.type,
    amount: remote.amount,
    category: remote.category || '',
    expenseClass: remote.expense_class || '',
    subcategory: remote.subcategory || '',
    source: remote.source || '',
    date: remote.date,
    notes: remote.notes || '',
    originalDescription: remote.original_description || '',
    sourceBank: remote.source_bank || '',
    accountName: remote.account_name || '',
    duplicateKey: remote.duplicate_key || '',
    importedFrom: remote.imported_from || '',
    fixedCostId: remote.fixed_cost_id || null,
    periodKey: remote.period_key || '',
    createdAt: remote.created_at
  };
}

export function mapLocalToRemoteFinance(local, userId) {
  return {
    id: local.id,
    user_id: userId,
    type: local.type,
    amount: typeof local.amount === 'number' ? local.amount : parseFloat(local.amount) || 0,
    category: local.category || null,
    expense_class: local.expenseClass || null,
    subcategory: local.subcategory || null,
    source: local.source || null,
    date: local.date,
    notes: local.notes || null,
    original_description: local.originalDescription || null,
    source_bank: local.sourceBank || null,
    account_name: local.accountName || null,
    duplicate_key: local.duplicateKey || null,
    imported_from: local.importedFrom || null,
    fixed_cost_id: local.fixedCostId || null,
    period_key: local.periodKey || null,
    created_at: local.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null
  };
}

// ============================================================
// 3. TRANSIENT IMPORT DRAFT SYNC HELPERS
// ============================================================
export async function saveImportDraft(user, draft) {
  if (!user || !supabase) return;
  try {
    console.log('[Lyria Finance Sync] Saving transient import draft to cloud...');
    await supabase
      .from('finance_import_drafts')
      .upsert({
        user_id: user.id,
        draft_data: draft,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
  } catch (err) {
    console.error('[Lyria Finance Sync] Error saving import draft:', err);
  }
}

export async function clearImportDraft(user) {
  if (!user || !supabase) return;
  try {
    console.log('[Lyria Finance Sync] Clearing transient import draft from cloud...');
    await supabase
      .from('finance_import_drafts')
      .delete()
      .eq('user_id', user.id);
  } catch (err) {
    console.error('[Lyria Finance Sync] Error clearing import draft:', err);
  }
}

// ============================================================
// CORE FINANCE SYNC RUNNER
// ============================================================
export async function syncFinance(user) {
  if (!user || !supabase) return;
  if (isSyncBlocked()) {
    console.log('[Lyria Finance Sync] Sync blocked (reset/import in progress). Skipping.');
    return;
  }
  console.log('[Lyria Finance Sync] Starting synchronization...');

  // 1. Synchronize Import Draft (transient data)
  try {
    const { data: draftRow, error: draftErr } = await supabase
      .from('finance_import_drafts')
      .select('draft_data')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!draftErr) {
      if (draftRow?.draft_data) {
        localStorage.setItem('cp_finance_import_draft', JSON.stringify(draftRow.draft_data));
        console.log('[Lyria Finance Sync] Downloaded transient import draft.');
      } else {
        const localDraft = localStorage.getItem('cp_finance_import_draft');
        if (localDraft) {
          try {
            const parsed = JSON.parse(localDraft);
            await saveImportDraft(user, parsed);
          } catch (pe) {
            console.error('[Lyria Finance Sync] Parsing local draft failed:', pe);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Lyria Finance Sync] Error syncing import draft:', err);
  }

  // 2. Sync collections: fixed_costs, finance (order matters: fixed_costs first)
  const collectionsConfig = [
    {
      key: 'fixedCosts',
      dbKey: 'fixed_costs',
      table: 'fixed_costs',
      mapRemote: mapRemoteToLocalFixedCost,
      mapLocal: mapLocalToRemoteFixedCost,
      event: 'lyria-fixedcosts-synced'
    },
    {
      key: 'finance',
      dbKey: 'finance',
      table: 'finance_entries',
      mapRemote: mapRemoteToLocalFinance,
      mapLocal: mapLocalToRemoteFinance,
      event: 'lyria-finance-synced'
    }
  ];

  for (const col of collectionsConfig) {
    try {
      const { data: migrationRow, error: migrationError } = await supabase
        .from('migration_state')
        .select('status')
        .eq('user_id', user.id)
        .eq('collection_key', col.key)
        .maybeSingle();

      if (migrationError) {
        console.error(`[Lyria Finance Sync] Error reading migration state for ${col.key}:`, migrationError.message);
        continue;
      }

      const isCompleted = migrationRow?.status === 'completed';

      if (isCompleted) {
        console.log(`[Lyria Finance Sync] ${col.key} migration completed. Downloading remote data...`);
        const { data: remoteData, error: fetchError } = await supabase
          .from(col.table)
          .select('*')
          .eq('user_id', user.id)
          .is('deleted_at', null);

        if (!fetchError && remoteData) {
          const mapped = remoteData.map(col.mapRemote);
          db.set(col.dbKey, mapped);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(col.event));
          }
        }
      } else {
        console.log(`[Lyria Finance Sync] First sync for ${col.key}. Merging data...`);
        const localData = db.getAll(col.dbKey) || [];

        if (localData.length > 0) {
          const payload = localData.map(item => col.mapLocal(item, user.id));
          const { error: uploadError } = await supabase
            .from(col.table)
            .upsert(payload, { onConflict: 'id' });

          if (uploadError) {
            console.error(`[Lyria Finance Sync] Upload failed for ${col.key}:`, uploadError.message);
            continue;
          }
        }

        const { data: mergedData, error: fetchError } = await supabase
          .from(col.table)
          .select('*')
          .eq('user_id', user.id)
          .is('deleted_at', null);

        if (!fetchError && mergedData) {
          const mapped = mergedData.map(col.mapRemote);
          db.set(col.dbKey, mapped);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(col.event));
          }
        }

        await supabase.from('migration_state').upsert({
          user_id: user.id,
          collection_key: col.key,
          status: 'completed',
          local_count: localData.length,
          remote_count: mergedData ? mergedData.length : 0,
          migrated_at: new Date().toISOString()
        }, { onConflict: 'user_id,collection_key' });
      }
    } catch (colErr) {
      console.error(`[Lyria Finance Sync] Unexpected error syncing ${col.key}:`, colErr);
    }
  }
}
