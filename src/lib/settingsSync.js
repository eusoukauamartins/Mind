// Settings Cloud Sync Utility
import { supabase, getCurrentUser } from './supabaseClient.js';
import { isSyncBlocked } from './resetAndImport.js';

export const SYNCABLE_SETTINGS = [
  'cp_mode',
  'cp_accent',
  'cp_initial_balance',
  'cp_financialGoal_v2',
  'cp_dashboard_layout',
  'cp_finance_import_rules'
];

/**
 * Saves a setting locally to localStorage cache and, if authenticated,
 * asynchronously uploads/upserts it to Supabase user_settings.
 *
 * @param {string} key
 * @param {any} value
 */
export function saveSetting(key, value) {
  console.log(`[Lyria Sync] saveSetting called for key: "${key}" with value:`, value);
  
  // 1. Write to localStorage local cache
  const rawValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
  localStorage.setItem(key, rawValue);

  // 2. Asynchronously upload to Supabase if authenticated and syncable
  if (SYNCABLE_SETTINGS.includes(key)) {
    const user = getCurrentUser();
    console.log('[Lyria Sync] authenticated user detected:', user ? user.email : 'null', 'ID:', user ? user.id : 'null');
    
    if (user && supabase) {
      // Defer database write to macro-task queue to prevent blocking theme/UI transitions
      setTimeout(() => {
        console.log(`[Lyria Sync] deferred upsert started for key: "${key}"`);
        
        // Ensure we pass a parsed representation for JSONB compatibility
        let parsedVal = value;
        if (typeof value === 'string') {
          try {
            parsedVal = JSON.parse(value);
          } catch {
            parsedVal = value; // Keep as string if it's not JSON
          }
        }

        supabase
          .from('user_settings')
          .upsert({
            user_id: user.id,
            setting_key: key,
            setting_value: parsedVal
          }, { onConflict: 'user_id,setting_key' })
          .then(({ data, error }) => {
            if (error) {
              console.error(`[Lyria Sync] upsert error for key "${key}":`, error.message, error);
            } else {
              console.log(`[Lyria Sync] upsert success for key: "${key}"`, data);
            }
          })
          .catch(err => {
            console.error(`[Lyria Sync] upsert exception for key "${key}":`, err);
          });
      }, 0);
    } else {
      console.log(`[Lyria Sync] Skip upsert: user is null or supabase is null (user=${user}, supabase=${!!supabase})`);
    }
  } else {
    console.log(`[Lyria Sync] Key "${key}" is not syncable`);
  }
}


/**
 * Synchronizes local cache and remote database settings on user login.
 * Source of Truth Rule:
 * - If remote settings exist: Remote wins (download all, overwrite local).
 * - If remote settings do not exist: Local wins (upload all to remote).
 *
 * @param {object} user - The authenticated user instance
 */
export async function syncSettings(user) {
  if (!user || !supabase) return;
  if (isSyncBlocked()) {
    console.log('[Lyria Sync] Settings sync blocked (reset/import in progress). Skipping.');
    return;
  }

  try {
    console.log('[Lyria Sync] Syncing settings for user:', user.email);

    // 1. Fetch remote settings from user_settings table
    const { data: remoteSettings, error } = await supabase
      .from('user_settings')
      .select('setting_key, setting_value')
      .eq('user_id', user.id);

    if (error) {
      console.error('[Lyria Sync] Error fetching remote settings:', error.message);
      return;
    }

    if (remoteSettings && remoteSettings.length > 0) {
      // --- REMOTE WINS ---
      console.log('[Lyria Sync] Remote settings exist. Downloading and applying remote settings...');
      
      // Clear local settings cache first so we don't bleed values from other users
      SYNCABLE_SETTINGS.forEach(key => {
        localStorage.removeItem(key);
      });

      remoteSettings.forEach(setting => {
        const key = setting.setting_key;
        const val = setting.setting_value;
        const rawValue = typeof val === 'object' ? JSON.stringify(val) : String(val);
        localStorage.setItem(key, rawValue);
      });

      // Ensure import rules is set to empty array if missing in remote settings
      if (!localStorage.getItem('cp_finance_import_rules')) {
        localStorage.setItem('cp_finance_import_rules', JSON.stringify([]));
      }
    } else {
      // --- LOCAL WINS ---
      console.log('[Lyria Sync] Remote settings not found. Uploading local settings to cloud...');
      
      // New account or account with no settings starts with empty rules!
      localStorage.setItem('cp_finance_import_rules', JSON.stringify([]));

      const upserts = [];
      
      SYNCABLE_SETTINGS.forEach(key => {
        const localValRaw = localStorage.getItem(key);
        if (localValRaw !== null) {
          let parsedVal;
          try {
            parsedVal = JSON.parse(localValRaw);
          } catch {
            parsedVal = localValRaw;
          }
          upserts.push({
            user_id: user.id,
            setting_key: key,
            setting_value: parsedVal
          });
        }
      });

      if (upserts.length > 0) {
        const { error: uploadError } = await supabase
          .from('user_settings')
          .upsert(upserts, { onConflict: 'user_id,setting_key' });
        
        if (uploadError) {
          console.error('[Lyria Sync] Error uploading local settings:', uploadError.message);
        } else {
          console.log(`[Lyria Sync] Successfully uploaded ${upserts.length} settings.`);
        }
      }
    }

    // 2. Apply visual theme/accent styles immediately to prevent flash/mismatch
    const finalMode = localStorage.getItem('cp_mode') || 'dark';
    const finalAccent = localStorage.getItem('cp_accent') || 'purple-premium';
    document.documentElement.setAttribute('data-mode', finalMode);
    document.documentElement.setAttribute('data-accent', finalAccent);

  } catch (err) {
    console.error('[Lyria Sync] Unexpected error during settings sync:', err);
  }
}
