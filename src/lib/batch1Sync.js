import { supabase } from './supabaseClient.js';
import { db } from '../data/db.js';
import { isSyncBlocked } from './resetAndImport.js';

// ============================================================
// 1. LEARNINGS MAPPING
// ============================================================
export function mapRemoteToLocalLearning(remote) {
  return {
    id: remote.id,
    content: remote.content,
    source: remote.source || '',
    tags: Array.isArray(remote.tags) ? remote.tags : [],
    isFavorite: remote.is_favorite || false,
    date: remote.date,
    order: remote.list_order || 0,
    createdAt: remote.created_at
  };
}

export function mapLocalToRemoteLearning(local, userId) {
  return {
    id: local.id,
    user_id: userId,
    content: local.content,
    source: local.source || null,
    tags: Array.isArray(local.tags) ? local.tags : [],
    is_favorite: local.isFavorite || false,
    date: local.date,
    list_order: local.order || 0,
    created_at: local.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null
  };
}

// ============================================================
// 2. EXPERIMENTS MAPPING
// ============================================================
export function mapRemoteToLocalExperiment(remote) {
  return {
    id: remote.id,
    title: remote.title,
    category: remote.category,
    context: remote.context || '',
    whatWasTested: remote.what_was_tested || '',
    result: remote.result || '',
    mainError: remote.main_error || '',
    lessonLearned: remote.lesson_learned || '',
    repeatThis: remote.repeat_this || 'sim',
    date: remote.date,
    notes: remote.notes || '',
    tags: Array.isArray(remote.tags) ? remote.tags : [],
    createdAt: remote.created_at
  };
}

export function mapLocalToRemoteExperiment(local, userId) {
  return {
    id: local.id,
    user_id: userId,
    title: local.title,
    category: local.category,
    context: local.context || null,
    what_was_tested: local.whatWasTested || null,
    result: local.result || null,
    main_error: local.mainError || null,
    lesson_learned: local.lessonLearned || null,
    repeat_this: local.repeatThis || 'sim',
    date: local.date,
    notes: local.notes || null,
    tags: Array.isArray(local.tags) ? local.tags : [],
    created_at: local.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null
  };
}

// ============================================================
// 3. DAILY CHECKINS MAPPING
// ============================================================
export function mapRemoteToLocalCheckin(remote) {
  return {
    id: remote.id,
    date: remote.date,
    sleep: remote.sleep || 'médio',
    energy: remote.energy || 'médio',
    mood: remote.mood || 'médio',
    focus: remote.focus || 'médio',
    dayQuality: remote.day_quality || '',
    substances: remote.substances || '',
    helped: remote.helped || '',
    hindered: remote.hindered || '',
    lostFocus: remote.lost_focus || false,
    lostTime: remote.lost_time || '',
    focusLostTo: remote.focus_lost_to || '',
    causeOfDistraction: remote.cause_of_distraction || '',
    notes: remote.notes || '',
    createdAt: remote.created_at
  };
}

export function mapLocalToRemoteCheckin(local, userId) {
  return {
    id: local.id,
    user_id: userId,
    date: local.date,
    sleep: local.sleep || null,
    energy: local.energy || null,
    mood: local.mood || null,
    focus: local.focus || null,
    day_quality: local.dayQuality || null,
    substances: local.substances || null,
    helped: local.helped || null,
    hindered: local.hindered || null,
    lost_focus: local.lostFocus || false,
    lost_time: local.lostTime || null,
    focus_lost_to: local.focusLostTo || null,
    cause_of_distraction: local.causeOfDistraction || null,
    notes: local.notes || null,
    created_at: local.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null
  };
}

// ============================================================
// 4. TIME ALLOCATIONS MAPPING
// ============================================================
export function mapRemoteToLocalAllocation(remote) {
  return {
    id: remote.id,
    date: remote.date,
    category: remote.category,
    hours: remote.hours,
    createdAt: remote.created_at
  };
}

export function mapLocalToRemoteAllocation(local, userId) {
  return {
    id: local.id,
    user_id: userId,
    date: local.date,
    category: local.category,
    hours: typeof local.hours === 'number' ? local.hours : parseFloat(local.hours) || 0,
    created_at: local.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null
  };
}

// ============================================================
// CORE BATCH 1 SYNC RUNNER
// ============================================================
export async function syncBatch1(user) {
  if (!user || !supabase) return;
  if (isSyncBlocked()) {
    console.log('[Lyria Batch 1 Sync] Sync blocked (reset/import in progress). Skipping.');
    return;
  }
  console.log('[Lyria Batch 1 Sync] Starting synchronization...');

  // 1. Sync daily_quote_state (simple key-value setting pattern)
  try {
    const localQuoteDate = localStorage.getItem('lyria_quote_unlocked_date');
    const { data: remoteQuote, error: quoteError } = await supabase
      .from('daily_quote_state')
      .select('unlocked_date')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!quoteError) {
      if (remoteQuote?.unlocked_date) {
        localStorage.setItem('lyria_quote_unlocked_date', remoteQuote.unlocked_date);
        console.log('[Lyria Batch 1 Sync] Downloaded daily quote date:', remoteQuote.unlocked_date);
      } else if (localQuoteDate) {
        await supabase.from('daily_quote_state').upsert({
          user_id: user.id,
          unlocked_date: localQuoteDate
        }, { onConflict: 'user_id' });
        console.log('[Lyria Batch 1 Sync] Uploaded local daily quote date:', localQuoteDate);
      }
    }
  } catch (err) {
    console.error('[Lyria Batch 1 Sync] Error syncing daily quote:', err);
  }

  // 2. Sync collections: learnings, experiments, daily_checkins, time_allocations
  const collectionsConfig = [
    {
      key: 'learnings',
      dbKey: 'learnings',
      table: 'learnings',
      mapRemote: mapRemoteToLocalLearning,
      mapLocal: mapLocalToRemoteLearning,
      event: 'lyria-learnings-synced'
    },
    {
      key: 'experiments',
      dbKey: 'experiments',
      table: 'experiments',
      mapRemote: mapRemoteToLocalExperiment,
      mapLocal: mapLocalToRemoteExperiment,
      event: 'lyria-experiments-synced'
    },
    {
      key: 'dailyCheckIns',
      dbKey: 'daily_checkins',
      table: 'daily_checkins',
      mapRemote: mapRemoteToLocalCheckin,
      mapLocal: mapLocalToRemoteCheckin,
      event: 'lyria-checkins-synced'
    },
    {
      key: 'timeAllocations',
      dbKey: 'time_allocations',
      table: 'time_allocations',
      mapRemote: mapRemoteToLocalAllocation,
      mapLocal: mapLocalToRemoteAllocation,
      event: 'lyria-allocations-synced'
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
        console.error(`[Lyria Batch 1 Sync] Error reading migration state for ${col.key}:`, migrationError.message);
        continue;
      }

      const isCompleted = migrationRow?.status === 'completed';

      if (isCompleted) {
        console.log(`[Lyria Batch 1 Sync] ${col.key} migration completed. Downloading remote data...`);
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
        console.log(`[Lyria Batch 1 Sync] First sync for ${col.key}. Merging data...`);
        const localData = db.getAll(col.dbKey) || [];

        if (localData.length > 0) {
          const payload = localData.map(item => col.mapLocal(item, user.id));
          const { error: uploadError } = await supabase
            .from(col.table)
            .upsert(payload, { onConflict: 'id' });

          if (uploadError) {
            console.error(`[Lyria Batch 1 Sync] Upload failed for ${col.key}:`, uploadError.message);
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
      console.error(`[Lyria Batch 1 Sync] Unexpected error syncing ${col.key}:`, colErr);
    }
  }
}
