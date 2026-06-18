// Migration Detector — scans localStorage for existing Lyria data
// Does NOT upload, modify, or delete anything.

import { COLLECTIONS } from '../data/db';

const STORAGE_PREFIX = 'cp_';

/**
 * Scans localStorage for existing Lyria data and returns a report.
 * This is detection only — no data is modified, uploaded, or deleted.
 *
 * @returns {{ hasLocalData: boolean, totalItems: number, collections: Record<string, number>, settings: string[] }}
 */
export function detectLocalData() {
  const collections = {};
  let totalItems = 0;

  // Scan all known collections
  for (const [, collectionKey] of Object.entries(COLLECTIONS)) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + collectionKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const count = Array.isArray(parsed) ? parsed.length : 0;
        if (count > 0) {
          collections[collectionKey] = count;
          totalItems += count;
        }
      }
    } catch {
      // Skip unparseable entries
    }
  }

  // Scan known direct settings keys
  const settingsKeys = [
    'cp_initial_balance',
    'cp_financialGoal_v2',
    'cp_monthlyGoal',
    'cp_dashboard_layout',
    'cp_finance_import_rules',
    'cp_finance_import_draft',
    'cp_theme',
    'cp_accent',
    'cp_mode',
    'lyria_quote_unlocked_date',
  ];

  const foundSettings = settingsKeys.filter(key => localStorage.getItem(key) !== null);

  const hasLocalData = totalItems > 0 || foundSettings.length > 0;

  return {
    hasLocalData,
    totalItems,
    collections,
    settings: foundSettings,
  };
}

/**
 * Logs the migration detection report to the console.
 * Called after auth to inform the developer about local data state.
 */
export function logMigrationReport() {
  const report = detectLocalData();

  if (!report.hasLocalData) {
    console.log('[Lyria Migration] No local data detected.');
    return report;
  }

  console.log('[Lyria Migration] Local data detected:');
  console.log(`  Total items: ${report.totalItems}`);

  if (Object.keys(report.collections).length > 0) {
    console.log('  Collections:');
    for (const [key, count] of Object.entries(report.collections)) {
      console.log(`    - ${key}: ${count} items`);
    }
  }

  if (report.settings.length > 0) {
    console.log(`  Settings keys found: ${report.settings.join(', ')}`);
  }

  console.log('  Status: Detection only. No data was uploaded or modified.');
  return report;
}
