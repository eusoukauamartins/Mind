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

  const triggerSyncChain = useCallback((currentUser) => {
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
    }).catch(err => {
      console.error('[Lyria Auth] Sync chain error:', err);
    });
  }, []);

  useEffect(() => {
    // If Supabase is not configured, skip auth entirely
    if (!configured || !supabase) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    // Get initial session and wait for it before deciding user is logged out
    supabase.auth.getSession().then(({ data: { session: currentSession }, error }) => {
      if (!isMounted) return;
      if (error) {
        console.error('[Lyria Auth] getSession error on load:', error.message);
      }

      if (currentSession) {
        setSession(currentSession);
        const currentUser = currentSession.user;
        setUser(currentUser);

        if (lastSyncedUserRef.current !== currentUser.id) {
          lastSyncedUserRef.current = currentUser.id;
          triggerSyncChain(currentUser);
        }
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!isMounted) return;
        console.log(`[Lyria Auth] onAuthStateChange event: ${event}`);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          if (newSession) {
            setSession(newSession);
            const currentUser = newSession.user;
            setUser(currentUser);

            if (lastSyncedUserRef.current !== currentUser.id) {
              lastSyncedUserRef.current = currentUser.id;
              triggerSyncChain(currentUser);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          lastSyncedUserRef.current = null;
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [configured, triggerSyncChain]);


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
