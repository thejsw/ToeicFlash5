import React, { createContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import {
  supabase,
  signInWithGoogle as authSignInWithGoogle,
  signInWithMagicLink as authSignInWithMagicLink,
  signOut as authSignOut,
  deleteUserAccount as authDeleteUserAccount,
  getUserProfile,
  upsertUserProfile,
  ensureUserSettings,
  UserProfile,
} from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  initialized: boolean;
};

type AuthContextType = AuthState & {
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  signInWithMagicLink: (email: string, redirectTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    loading: true,
    initialized: false,
  });

  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const profile = await getUserProfile(userId);
      return profile;
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      return null;
    }
  }, []);

  const ensureProfile = useCallback(async (user: User): Promise<UserProfile | null> => {
    try {
      let profile = await getUserProfile(user.id);

      if (!profile) {
        const provider = user.app_metadata?.provider ?? 'email';
        const username =
          user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          user.email?.split('@')[0] ??
          '사용자';
        const avatarUrl =
          user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null;

        profile = await upsertUserProfile(user.id, {
          username,
          avatar_url: avatarUrl,
          provider,
        });
      }

      await ensureUserSettings(user.id);

      return profile;
    } catch (error) {
      console.error('Failed to ensure profile:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      let profile: UserProfile | null = null;
      
      if (session?.user) {
        profile = await ensureProfile(session.user);
      }
      
      setState({
        session,
        user: session?.user ?? null,
        profile,
        loading: false,
        initialized: true,
      });
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        let profile: UserProfile | null = null;
        
        if (session?.user) {
          if (event === 'SIGNED_IN') {
            profile = await ensureProfile(session.user);
          } else {
            profile = await fetchProfile(session.user.id);
          }
        }
        
        setState((prev) => ({
          ...prev,
          session,
          user: session?.user ?? null,
          profile,
          loading: false,
        }));
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [ensureProfile, fetchProfile]);

  const signInWithGoogle = useCallback(async (redirectTo?: string) => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      await authSignInWithGoogle(redirectTo);
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const signInWithMagicLink = useCallback(async (email: string, redirectTo?: string) => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      await authSignInWithMagicLink(email, redirectTo);
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const signOut = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      await authSignOut();
      setState((prev) => ({
        ...prev,
        session: null,
        user: null,
        profile: null,
        loading: false,
      }));
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false }));
      throw error;
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      await authDeleteUserAccount();
      await authSignOut();
      setState((prev) => ({
        ...prev,
        session: null,
        user: null,
        profile: null,
        loading: false,
      }));
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false }));
      throw error;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!state.user) return;
    
    const profile = await fetchProfile(state.user.id);
    setState((prev) => ({ ...prev, profile }));
  }, [state.user, fetchProfile]);

  const value: AuthContextType = {
    ...state,
    signInWithGoogle,
    signInWithMagicLink,
    signOut,
    deleteAccount,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
