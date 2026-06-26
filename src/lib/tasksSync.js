import { supabase } from './supabaseClient.js';
import { db } from '../data/db.js';
import { isSyncBlocked } from './resetAndImport.js';

/**
 * Maps a database task record to the client-side task schema.
 */
export function mapRemoteToLocalTask(remote) {
  return {
    id: remote.id,
    title: remote.title,
    description: remote.description || '',
    priority: remote.priority || 'média',
    estimatedHours: remote.estimated_hours !== null && remote.estimated_hours !== undefined ? String(remote.estimated_hours) : '',
    status: remote.status || 'pendente',
    dueDate: remote.due_date || '',
    dueTime: remote.due_time || '',
    reminderEnabled: remote.reminder_enabled === true,
    reminderAt: remote.reminder_at || '',
    timezone: remote.timezone || 'America/Sao_Paulo',
    scheduledDate: remote.scheduled_date || '',
    category: remote.category || '',
    recurrence: remote.recurrence || 'única',
    recurrenceDay: remote.recurrence_day !== null && remote.recurrence_day !== undefined
      ? (isNaN(Number(remote.recurrence_day)) ? remote.recurrence_day : Number(remote.recurrence_day))
      : '',
    completedDates: Array.isArray(remote.completed_dates) ? remote.completed_dates : [],
    order: remote.list_order || 0,
    createdAt: remote.created_at,
    deletedAt: remote.status === 'excluída' ? (remote.updated_at || remote.created_at) : null
  };
}

/**
 * Maps a client-side task object to the database task schema.
 */
export function mapLocalToRemoteTask(local, userId) {
  return {
    id: local.id,
    user_id: userId,
    title: local.title,
    description: local.description || null,
    priority: local.priority || 'média',
    estimated_hours: local.estimatedHours ? parseFloat(local.estimatedHours) : null,
    status: local.status || 'pendente',
    due_date: local.dueDate || null,
    due_time: local.dueTime || null,
    reminder_enabled: local.reminderEnabled === true,
    reminder_at: local.reminderAt || null,
    timezone: local.timezone || 'America/Sao_Paulo',
    scheduled_date: local.scheduledDate || null,
    category: local.category || null,
    recurrence: local.recurrence || 'única',
    recurrence_day: local.recurrenceDay !== undefined && local.recurrenceDay !== '' ? String(local.recurrenceDay) : null,
    completed_dates: Array.isArray(local.completedDates) ? local.completedDates : [],
    list_order: local.order || 0,
    created_at: local.createdAt || new Date().toISOString(),
    updated_at: local.deletedAt || new Date().toISOString(),
    deleted_at: null
  };
}

/**
 * Synchronizes tasks between local storage and Supabase on login.
 * Merge migration strategy:
 * - If migration is already completed, download remote tasks.
 * - If migration is not completed, upload local tasks, then download merged tasks.
 *
 * @param {object} user - The authenticated user instance
 */
export async function syncTasks(user) {
  if (!user || !supabase) return;
  if (isSyncBlocked()) {
    console.log('[Lyria Tasks Sync] Sync blocked (reset/import in progress). Skipping.');
    return;
  }

  try {
    console.log('[Lyria Tasks Sync] Syncing tasks for user:', user.email);

    // 1. Check migration state
    const { data: migrationRow, error: migrationError } = await supabase
      .from('migration_state')
      .select('status, local_count, remote_count')
      .eq('user_id', user.id)
      .eq('collection_key', 'tasks')
      .maybeSingle();

    if (migrationError) {
      console.error('[Lyria Tasks Sync] Error reading migration state:', migrationError.message);
      return;
    }

    const isMigrationCompleted = migrationRow?.status === 'completed';

    if (isMigrationCompleted) {
      console.log('[Lyria Tasks Sync] Migration already completed. Downloading remote tasks...');
      const { data: remoteTasks, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null);

      if (fetchError) {
        console.error('[Lyria Tasks Sync] Error fetching remote tasks:', fetchError.message);
        return;
      }

      if (remoteTasks) {
        const localTasks = remoteTasks.map(mapRemoteToLocalTask);
        db.set('tasks', localTasks);
        console.log(`[Lyria Tasks Sync] Downloaded ${localTasks.length} tasks successfully.`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('lyria-tasks-synced'));
        }
      }
    } else {
      console.log('[Lyria Tasks Sync] First sync / migration required.');
      const localTasks = db.getAll('tasks') || [];

      // A. Upload local tasks if they exist
      if (localTasks.length > 0) {
        console.log(`[Lyria Tasks Sync] Uploading ${localTasks.length} local tasks...`);
        
        // Upsert by primary key (id) to avoid duplicates
        const uploadPayload = localTasks.map(t => mapLocalToRemoteTask(t, user.id));
        const { error: uploadError } = await supabase
          .from('tasks')
          .upsert(uploadPayload, { onConflict: 'id' });

        if (uploadError) {
          console.error('[Lyria Tasks Sync] Upload failed:', uploadError.message);
          return; // Abort migration to keep local cache as source of truth
        }
      }

      // B. Download merged tasks (contains both previously existing remote and newly uploaded local tasks)
      console.log('[Lyria Tasks Sync] Downloading merged remote tasks...');
      const { data: mergedTasks, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null);

      if (fetchError) {
        console.error('[Lyria Tasks Sync] Error fetching merged tasks:', fetchError.message);
        return;
      }

      if (mergedTasks) {
        const mappedMerged = mergedTasks.map(mapRemoteToLocalTask);
        db.set('tasks', mappedMerged);
        console.log(`[Lyria Tasks Sync] Merged sync successful. Total local tasks: ${mappedMerged.length}`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('lyria-tasks-synced'));
        }
      }

      // C. Set migration state to completed
      const { error: stateError } = await supabase
        .from('migration_state')
        .upsert({
          user_id: user.id,
          collection_key: 'tasks',
          status: 'completed',
          local_count: localTasks.length,
          remote_count: mergedTasks ? mergedTasks.length : 0,
          migrated_at: new Date().toISOString()
        }, { onConflict: 'user_id,collection_key' });

      if (stateError) {
        console.error('[Lyria Tasks Sync] Error saving migration state:', stateError.message);
      }
    }
  } catch (err) {
    console.error('[Lyria Tasks Sync] Unexpected error during tasks sync:', err);
  }
}
