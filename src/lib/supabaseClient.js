// Supabase Client — safe initialization with fallback
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL : undefined);
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_ANON_KEY : undefined);

/**
 * Returns true if Supabase environment variables are configured
 * with real values (not placeholder strings).
 */
export function isSupabaseConfigured() {
  return !!(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'your-supabase-project-url' &&
    supabaseAnonKey !== 'your-supabase-anon-key' &&
    supabaseUrl.startsWith('https://')
  );
}

/**
 * Supabase client instance.
 * Returns null if Supabase is not configured, so callers must check.
 */
export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

let currentUser = null;

if (supabase) {
  // Retrieve initial session synchronously/asynchronously on load
  supabase.auth.getSession().then(({ data: { session } }) => {
    currentUser = session?.user ?? null;
  });

  // Track user session changes
  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
  });
}

/**
 * Exposes the current authenticated user synchronously.
 */
export function getCurrentUser() {
  return currentUser;
}

