import { supabase } from './supabaseClient.js';
import { db } from '../data/db.js';
import { isSyncBlocked } from './resetAndImport.js';

// ============================================================
// 1. REWARDS MAPPING
// ============================================================
export function mapRemoteToLocalReward(remote) {
  return {
    id: remote.id,
    title: remote.title,
    description: remote.description || '',
    category: remote.category || 'Outro',
    estimatedValue: remote.estimated_value || 0,
    deadline: remote.deadline || '',
    redeemAvailableDate: remote.redeem_available_date || '',
    priority: remote.priority || 'média',
    status: remote.status || 'em_andamento',
    conditions: Array.isArray(remote.conditions) ? remote.conditions : [],
    notes: remote.notes || '',
    redeemedAt: remote.redeemed_at || '',
    archivedAt: remote.archived_at || '',
    createdAt: remote.created_at,
    updatedAt: remote.updated_at || remote.created_at || new Date().toISOString(),
    financialTargetAmount: remote.financial_target_amount !== undefined && remote.financial_target_amount !== null ? remote.financial_target_amount : null,
    financialCurrentAmount: remote.financial_current_amount !== undefined && remote.financial_current_amount !== null ? remote.financial_current_amount : null,
    showOnDashboard: remote.show_on_dashboard === true
  };
}

export function mapLocalToRemoteReward(local, userId) {
  return {
    id: local.id,
    user_id: userId,
    title: local.title,
    description: local.description || null,
    category: local.category || 'Outro',
    estimated_value: typeof local.estimatedValue === 'number' ? local.estimatedValue : parseFloat(local.estimatedValue) || 0,
    deadline: local.deadline || null,
    redeem_available_date: local.redeemAvailableDate || null,
    priority: local.priority || 'média',
    status: local.status || 'em_andamento',
    conditions: Array.isArray(local.conditions) ? local.conditions : [],
    notes: local.notes || null,
    redeemed_at: local.redeemedAt || null,
    archived_at: local.archivedAt || null,
    created_at: local.createdAt || new Date().toISOString(),
    updated_at: local.updatedAt || new Date().toISOString(),
    deleted_at: null,
    financial_target_amount: typeof local.financialTargetAmount === 'number' ? local.financialTargetAmount : (local.financialTargetAmount && !isNaN(parseFloat(local.financialTargetAmount)) ? parseFloat(local.financialTargetAmount) : null),
    financial_current_amount: typeof local.financialCurrentAmount === 'number' ? local.financialCurrentAmount : (local.financialCurrentAmount && !isNaN(parseFloat(local.financialCurrentAmount)) ? parseFloat(local.financialCurrentAmount) : null),
    show_on_dashboard: local.showOnDashboard === true
  };
}

// ============================================================
// CORE REWARDS SYNC RUNNER
// ============================================================
export async function syncRewards(user) {
  if (!user || !supabase) return;
  if (isSyncBlocked()) {
    console.log('[Lyria Rewards Sync] Sync blocked (reset/import in progress). Skipping.');
    return;
  }
  console.log('[Lyria Rewards Sync] Starting synchronization...');

  const col = {
    key: 'rewards',
    dbKey: 'rewards',
    table: 'rewards',
    mapRemote: mapRemoteToLocalReward,
    mapLocal: mapLocalToRemoteReward,
    event: 'lyria-rewards-synced'
  };

  try {
    const { data: migrationRow, error: migrationError } = await supabase
      .from('migration_state')
      .select('status')
      .eq('user_id', user.id)
      .eq('collection_key', col.key)
      .maybeSingle();

    if (migrationError) {
      console.error(`[Lyria Rewards Sync] Error reading migration state for ${col.key}:`, migrationError.message);
      return;
    }

    const isCompleted = migrationRow?.status === 'completed';

    if (isCompleted) {
      console.log(`[Lyria Rewards Sync] ${col.key} migration completed. Fetching remote data...`);
      const { data: remoteData, error: fetchError } = await supabase
        .from(col.table)
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null);

      if (fetchError) {
        console.error(`[Lyria Rewards Sync] Error fetching remote rewards:`, {
          code: fetchError.code,
          message: fetchError.message,
          details: fetchError.details,
          hint: fetchError.hint
        });
        return;
      }

      if (!remoteData && remoteData !== null) {
        console.warn('[Lyria Rewards Sync] Remote data is undefined. Skipping reconciliation to protect local state.');
        return;
      }

      const localData = db.getAll(col.dbKey) || [];
      const remoteMap = new Map((remoteData || []).map(r => [r.id, r]));

      // Conservative reconciliation:
      // 1. Identify local-only items (created offline/before sync) and newer local edits
      const toUpload = [];
      const newerLocalIds = new Set();

      localData.forEach(localItem => {
        if (!localItem || !localItem.id) return;
        const remoteItem = remoteMap.get(localItem.id);

        if (!remoteItem) {
          // Local item not found on remote -> upload it
          toUpload.push(col.mapLocal(localItem, user.id));
          newerLocalIds.add(localItem.id);
        } else if (localItem.updatedAt && remoteItem.updated_at) {
          // If local has a strictly newer timestamp, upload local item
          const localTime = new Date(localItem.updatedAt).getTime();
          const remoteTime = new Date(remoteItem.updated_at).getTime();
          if (localTime > remoteTime && !isNaN(localTime) && !isNaN(remoteTime)) {
            toUpload.push(col.mapLocal(localItem, user.id));
            newerLocalIds.add(localItem.id);
          }
        }
      });

      if (toUpload.length > 0) {
        console.log(`[Lyria Rewards Sync] Uploading ${toUpload.length} un-synced/updated local rewards...`);
        const { error: uploadError } = await supabase
          .from(col.table)
          .upsert(toUpload, { onConflict: 'id' });

        if (uploadError) {
          console.error(`[Lyria Rewards Sync] Error uploading un-synced rewards:`, {
            code: uploadError.code,
            message: uploadError.message,
            details: uploadError.details,
            hint: uploadError.hint
          });
        }
      }

      // Build reconciled state:
      // Start with mapped remote items as base
      const reconciledMap = new Map();
      (remoteData || []).forEach(remoteItem => {
        const mapped = col.mapRemote(remoteItem);
        reconciledMap.set(mapped.id, mapped);
      });

      // Overlay local items that are strictly newer or local-only
      localData.forEach(localItem => {
        if (!localItem || !localItem.id) return;
        if (newerLocalIds.has(localItem.id)) {
          reconciledMap.set(localItem.id, localItem);
        }
      });

      const reconciled = Array.from(reconciledMap.values());
      db.set(col.dbKey, reconciled);
      console.log('[Lyria Rewards Sync] Reconciled rewards count:', reconciled.length);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(col.event));
      }
    } else {
      console.log(`[Lyria Rewards Sync] First sync for ${col.key}. Merging data...`);
      const localData = db.getAll(col.dbKey) || [];

      if (localData.length > 0) {
        const payload = localData.map(item => {
          const remoteItem = col.mapLocal(item, user.id);
          remoteItem.user_id = user.id;
          return remoteItem;
        });

        const { error: uploadError } = await supabase
          .from(col.table)
          .upsert(payload, { onConflict: 'id' });

        if (uploadError) {
          console.error(`[Lyria Rewards Sync] Upload failed for ${col.key}:`, uploadError.message);
          return;
        }
      }

      const { data: remoteData, error: fetchError } = await supabase
        .from(col.table)
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null);

      if (!fetchError && remoteData) {
        const mapped = remoteData.map(col.mapRemote);
        db.set(col.dbKey, mapped);
      }

      await supabase
        .from('migration_state')
        .upsert({
          user_id: user.id,
          collection_key: col.key,
          status: 'completed',
          migrated_at: new Date().toISOString()
        }, { onConflict: 'user_id,collection_key' });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(col.event));
      }
    }
  } catch (err) {
    console.error(`[Lyria Rewards Sync] Exception during sync for ${col.key}:`, err);
  }
}
