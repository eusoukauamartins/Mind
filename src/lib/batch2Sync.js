import { supabase } from './supabaseClient.js';
import { db } from '../data/db.js';
import { isSyncBlocked } from './resetAndImport.js';

// ============================================================
// 1. WORKOUT ROUTINES MAPPING
// ============================================================
export function mapRemoteToLocalRoutine(remote) {
  return {
    id: remote.id,
    dayOfWeek: remote.day_of_week,
    dayName: remote.day_name,
    isRestDay: remote.is_rest_day || false,
    workoutType: remote.workout_type || null,
    plannedFocus: remote.planned_focus || null,
    notes: remote.notes || '',
    createdAt: remote.created_at
  };
}

export function mapLocalToRemoteRoutine(local, userId) {
  return {
    id: local.id,
    user_id: userId,
    day_of_week: local.dayOfWeek,
    day_name: local.dayName,
    is_rest_day: local.isRestDay || false,
    workout_type: local.workoutType || null,
    planned_focus: local.plannedFocus || null,
    notes: local.notes || null,
    created_at: local.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null
  };
}

// ============================================================
// 2. WORKOUT LOGS MAPPING
// ============================================================
export function mapRemoteToLocalLog(remote) {
  return {
    id: remote.id,
    date: remote.date,
    didTrain: remote.did_train || false,
    workoutDone: remote.workout_done || '',
    followedPlan: remote.followed_plan || false,
    howItWent: remote.how_it_went || '',
    energy: remote.energy || 'média',
    notes: remote.notes || '',
    createdAt: remote.created_at
  };
}

export function mapLocalToRemoteLog(local, userId) {
  return {
    id: local.id,
    user_id: userId,
    date: local.date,
    did_train: local.didTrain || false,
    workout_done: local.workoutDone || null,
    followed_plan: local.followedPlan || false,
    how_it_went: local.howItWent || null,
    energy: local.energy || 'média',
    notes: local.notes || null,
    created_at: local.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null
  };
}

// ============================================================
// CORE BATCH 2 SYNC RUNNER
// ============================================================
export async function syncBatch2(user) {
  if (!user || !supabase) return;
  if (isSyncBlocked()) {
    console.log('[Lyria Batch 2 Sync] Sync blocked (reset/import in progress). Skipping.');
    return;
  }
  console.log('[Lyria Batch 2 Sync] Starting synchronization...');

  const collectionsConfig = [
    {
      key: 'workoutRoutines',
      dbKey: 'workout_routines',
      table: 'workout_routines',
      mapRemote: mapRemoteToLocalRoutine,
      mapLocal: mapLocalToRemoteRoutine,
      event: 'lyria-routines-synced'
    },
    {
      key: 'workoutLogs',
      dbKey: 'workout_logs',
      table: 'workout_logs',
      mapRemote: mapRemoteToLocalLog,
      mapLocal: mapLocalToRemoteLog,
      event: 'lyria-logs-synced'
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
        console.error(`[Lyria Batch 2 Sync] Error reading migration state for ${col.key}:`, migrationError.message);
        continue;
      }

      const isCompleted = migrationRow?.status === 'completed';

      if (isCompleted) {
        console.log(`[Lyria Batch 2 Sync] ${col.key} migration completed. Downloading remote data...`);
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
        console.log(`[Lyria Batch 2 Sync] First sync for ${col.key}. Merging data...`);
        const localData = db.getAll(col.dbKey) || [];

        if (localData.length > 0) {
          const payload = localData.map(item => col.mapLocal(item, user.id));
          const { error: uploadError } = await supabase
            .from(col.table)
            .upsert(payload, { onConflict: 'id' });

          if (uploadError) {
            console.error(`[Lyria Batch 2 Sync] Upload failed for ${col.key}:`, uploadError.message);
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
      console.error(`[Lyria Batch 2 Sync] Unexpected error syncing ${col.key}:`, colErr);
    }
  }
}
