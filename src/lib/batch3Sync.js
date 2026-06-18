import { supabase } from './supabaseClient.js';
import { db } from '../data/db.js';
import { isSyncBlocked } from './resetAndImport.js';

// ============================================================
// 1. PROJECTS MAPPING
// ============================================================
export function mapRemoteToLocalProject(remote) {
  return {
    id: remote.id,
    title: remote.title,
    description: remote.description || '',
    status: remote.status || 'ativo',
    category: remote.category || '',
    startDate: remote.start_date || '',
    targetDate: remote.target_date || '',
    completedAt: remote.completed_at || '',
    subtasks: Array.isArray(remote.subtasks) ? remote.subtasks : [],
    order: remote.list_order || 0,
    createdAt: remote.created_at
  };
}

export function mapLocalToRemoteProject(local, userId) {
  return {
    id: local.id,
    user_id: userId,
    title: local.title,
    description: local.description || null,
    status: local.status || 'ativo',
    category: local.category || null,
    start_date: local.startDate || null,
    target_date: local.targetDate || null,
    completed_at: local.completedAt || null,
    subtasks: Array.isArray(local.subtasks) ? local.subtasks : [],
    list_order: local.order || 0,
    created_at: local.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null
  };
}

// ============================================================
// CORE BATCH 3 SYNC RUNNER
// ============================================================
export async function syncBatch3(user) {
  if (!user || !supabase) return;
  if (isSyncBlocked()) {
    console.log('[Lyria Batch 3 Sync] Sync blocked (reset/import in progress). Skipping.');
    return;
  }
  console.log('[Lyria Batch 3 Sync] Starting synchronization...');

  const col = {
    key: 'projects',
    dbKey: 'projects',
    table: 'projects',
    mapRemote: mapRemoteToLocalProject,
    mapLocal: mapLocalToRemoteProject,
    event: 'lyria-projects-synced'
  };

  try {
    const { data: migrationRow, error: migrationError } = await supabase
      .from('migration_state')
      .select('status')
      .eq('user_id', user.id)
      .eq('collection_key', col.key)
      .maybeSingle();

    if (migrationError) {
      console.error(`[Lyria Batch 3 Sync] Error reading migration state for ${col.key}:`, migrationError.message);
      return;
    }

    const isCompleted = migrationRow?.status === 'completed';

    if (isCompleted) {
      console.log(`[Lyria Batch 3 Sync] ${col.key} migration completed. Downloading remote data...`);
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
      console.log(`[Lyria Batch 3 Sync] First sync for ${col.key}. Merging data...`);
      const localData = db.getAll(col.dbKey) || [];

      if (localData.length > 0) {
        const payload = localData.map(item => col.mapLocal(item, user.id));
        const { error: uploadError } = await supabase
          .from(col.table)
          .upsert(payload, { onConflict: 'id' });

        if (uploadError) {
          console.error(`[Lyria Batch 3 Sync] Upload failed for ${col.key}:`, uploadError.message);
          return;
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
    console.error(`[Lyria Batch 3 Sync] Unexpected error syncing ${col.key}:`, colErr);
  }
}
