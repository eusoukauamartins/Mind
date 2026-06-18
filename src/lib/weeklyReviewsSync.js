import { supabase } from './supabaseClient.js';
import { db } from '../data/db.js';
import { isSyncBlocked } from './resetAndImport.js';

// ============================================================
// WEEKLY REVIEWS MAPPING
// ============================================================
export function mapRemoteToLocalWeeklyReview(remote) {
  return {
    id: remote.id,
    weekRef: remote.week_ref || '',
    weekStart: remote.week_start || '',
    weekEnd: remote.week_end || '',
    whatWorked: remote.what_worked || '',
    whatDidNotWork: remote.what_did_not_work || '',
    timeWasted: remote.time_wasted || '',
    moneyWasted: remote.money_wasted || '',
    biggestLearnings: remote.biggest_learnings || '',
    mainWins: remote.main_wins || '',
    focusNextWeek: remote.focus_next_week || '',
    order: remote.list_order || 0,
    createdAt: remote.created_at
  };
}

export function mapLocalToRemoteWeeklyReview(local, userId) {
  return {
    id: local.id,
    user_id: userId,
    week_ref: local.weekRef || null,
    week_start: local.weekStart || null,
    week_end: local.weekEnd || null,
    what_worked: local.whatWorked || null,
    what_did_not_work: local.whatDidNotWork || null,
    time_wasted: local.timeWasted || null,
    money_wasted: local.moneyWasted || null,
    biggest_learnings: local.biggestLearnings || null,
    main_wins: local.mainWins || null,
    focus_next_week: local.focusNextWeek || null,
    list_order: local.order || 0,
    created_at: local.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null
  };
}

function isMissingTable(error) {
  if (!error) return false;
  const code = error.code || '';
  const msg = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
  return code === '42P01' || code === 'PGRST205' || msg.includes('does not exist') || msg.includes('schema cache');
}

// ============================================================
// CORE WEEKLY REVIEWS SYNC RUNNER
// ============================================================
export async function syncWeeklyReviews(user) {
  if (!user || !supabase) return;
  if (isSyncBlocked()) {
    console.log('[Lyria WeeklyReviews Sync] Sync blocked (reset/import in progress). Skipping.');
    return;
  }
  console.log('[Lyria WeeklyReviews Sync] Starting synchronization...');

  const col = {
    key: 'weeklyReviews',
    dbKey: 'weekly_reviews',
    table: 'weekly_reviews',
    event: 'lyria-weeklyreviews-synced'
  };

  try {
    const { data: migrationRow, error: migrationError } = await supabase
      .from('migration_state')
      .select('status')
      .eq('user_id', user.id)
      .eq('collection_key', col.key)
      .maybeSingle();

    if (migrationError) {
      console.error('[Lyria WeeklyReviews Sync] Error reading migration state:', migrationError.message);
      return;
    }

    const isCompleted = migrationRow?.status === 'completed';

    if (isCompleted) {
      const { data: remoteData, error: fetchError } = await supabase
        .from(col.table)
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null);

      if (fetchError) {
        if (isMissingTable(fetchError)) {
          console.warn('[Lyria WeeklyReviews Sync] Tabela weekly_reviews ausente. Rode a migration 005. Mantendo dados locais.');
          return;
        }
        console.error('[Lyria WeeklyReviews Sync] Fetch error:', fetchError.message);
        return;
      }
      if (remoteData) {
        db.set(col.dbKey, remoteData.map(mapRemoteToLocalWeeklyReview));
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(col.event));
      }
    } else {
      const localData = db.getAll(col.dbKey) || [];

      if (localData.length > 0) {
        const payload = localData.map(item => mapLocalToRemoteWeeklyReview(item, user.id));
        const { error: uploadError } = await supabase
          .from(col.table)
          .upsert(payload, { onConflict: 'id' });

        if (uploadError) {
          if (isMissingTable(uploadError)) {
            console.warn('[Lyria WeeklyReviews Sync] Tabela weekly_reviews ausente. Rode a migration 005. Mantendo dados locais.');
            return;
          }
          console.error('[Lyria WeeklyReviews Sync] Upload failed:', uploadError.message);
          return;
        }
      }

      const { data: mergedData, error: fetchError } = await supabase
        .from(col.table)
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null);

      if (!fetchError && mergedData) {
        db.set(col.dbKey, mergedData.map(mapRemoteToLocalWeeklyReview));
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(col.event));
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
  } catch (err) {
    console.error('[Lyria WeeklyReviews Sync] Unexpected error:', err);
  }
}
