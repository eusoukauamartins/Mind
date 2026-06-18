import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { syncSettings, SYNCABLE_SETTINGS } from '../lib/settingsSync';
import { syncTasks } from '../lib/tasksSync';
import { syncBatch1 } from '../lib/batch1Sync';
import { syncBatch2 } from '../lib/batch2Sync';
import { syncBatch3 } from '../lib/batch3Sync';
import { syncFinance } from '../lib/financeSync';
import { syncRewards } from '../lib/rewardsSync';
import { syncWeeklyReviews } from '../lib/weeklyReviewsSync';
import { db } from '../data/db';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const lastSyncedUserRef = useRef(null);

  const configured = isSupabaseConfigured();

  useEffect(() => {
    // If Supabase is not configured, skip auth entirely
    if (!configured || !supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      const currentUser = currentSession?.user ?? null;
      setUser(currentUser);
      setLoading(false);
 
      if (currentUser && lastSyncedUserRef.current !== currentUser.id) {
        lastSyncedUserRef.current = currentUser.id;
        syncSettings(currentUser).then(() => {
          return syncTasks(currentUser);
        }).then(() => {
          return syncBatch1(currentUser);
        }).then(() => {
          return syncBatch2(currentUser);
        }).then(() => {
          return syncBatch3(currentUser);
        }).then(() => {
          return syncRewards(currentUser);
        }).then(() => {
          return syncWeeklyReviews(currentUser);
        }).then(() => {
          syncFinance(currentUser);
        });
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        const currentUser = newSession?.user ?? null;
        setUser(currentUser);

        if (currentUser && lastSyncedUserRef.current !== currentUser.id) {
          lastSyncedUserRef.current = currentUser.id;
          syncSettings(currentUser).then(() => {
            return syncTasks(currentUser);
          }).then(() => {
            return syncBatch1(currentUser);
          }).then(() => {
            return syncBatch2(currentUser);
          }).then(() => {
            return syncBatch3(currentUser);
          }).then(() => {
            return syncRewards(currentUser);
          }).then(() => {
            return syncWeeklyReviews(currentUser);
          }).then(() => {
            syncFinance(currentUser);
          });
        } else if (!currentUser) {
          lastSyncedUserRef.current = null;
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [configured]);


  const signUp = useCallback(async (email, password, displayName) => {
    if (!supabase) return { error: { message: 'Supabase não configurado.' } };

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || email.split('@')[0] },
      },
    });
    return { data, error };
  }, []);

  const signIn = useCallback(async (email, password) => {
    if (!supabase) return { error: { message: 'Supabase não configurado.' } };

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.error('Supabase signOut failed:', e);
      }
    }
    
    // Clear user settings from cache, preserving mode/accent so user's visual settings are not lost on logout.
    const keysToClear = SYNCABLE_SETTINGS.filter(key => key !== 'cp_mode' && key !== 'cp_accent');
    keysToClear.forEach(key => {
      localStorage.removeItem(key);
    });

    // Clear local IndexedDB databases (only cp_ collections)
    try {
      db.clearAll();
      db.setInitialized();
    } catch (e) {
      console.error('Failed to clear local DB on logout:', e);
    }

    setUser(null);
    setSession(null);
    lastSyncedUserRef.current = null;

    // Hard reload to clear all in-memory React states
    window.location.href = '/';
  }, []);

  const resetPassword = useCallback(async (email) => {
    if (!supabase) return { error: { message: 'Supabase não configurado.' } };

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    return { data, error };
  }, []);

  // strict auth check: user and session must be present
  const isAuthenticated = !!user && !!session;

  const value = {
    user,
    session,
    loading,
    isAuthenticated,
    isSupabaseConfigured: configured,
    signUp,
    signIn,
    signOut,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
