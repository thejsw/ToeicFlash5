import React, { createContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import {
  supabase,
  signInWithGoogle as authSignInWithGoogle,
  signInWithMagicLink as authSignInWithMagicLink,
  signOut as authSignOut,
  deleteUserAccount as authDeleteUserAccount,
  getUserProfile,
  getUserProfileByAddress,
  upsertUserProfile,
  ensureNewUserData,
  ensureUserSettings,
  getUserSettings,
  UserProfile,
} from '@/lib/supabase';
import i18n, { syncI18nLanguageFromLearningLanguage } from '@/lib/i18n';

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
  syncProfileFromAuth: () => Promise<void>;
  /** 401 등 세션 만료 시: 바로 signOut (Web에서는 Supabase 자동 refresh에 맡김) */
  handleSessionError: () => Promise<void>;
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

  /** user_metadata 또는 identities[0].identity_data에서 프로필 정보 추출 */
  const getProfileFromUser = useCallback((user: User) => {
    const meta = user.user_metadata ?? {};
    const identityData = (user.identities?.[0] as { identity_data?: Record<string, unknown> } | undefined)?.identity_data ?? {};
    const merged = { ...identityData, ...meta };
    const username =
      (merged.full_name as string) ??
      (merged.name as string) ??
      user.email?.split('@')[0] ??
      i18n.t('profile.defaultUser');
    const avatarUrl =
      (merged.avatar_url as string) ?? (merged.picture as string) ?? null;
    const provider = (user.app_metadata?.provider as string) ?? 'email';
    return { username, avatar_url: avatarUrl, provider };
  }, []);

  /**
   * address(메일 주소)로 신규/기존 유저 판별
   * - 신규: user_profiles에 해당 address 없음 → 프로필 생성
   * - 기존: user_profiles에 해당 address 있음 → DB에서 정보 불러옴
   */
  const ensureProfile = useCallback(async (user: User): Promise<UserProfile | null> => {
    try {
      const address = user.email?.trim() ?? null;
      const existingProfile = address
        ? await getUserProfileByAddress(address)
        : await getUserProfile(user.id);

      if (!existingProfile) {
        // 신규 유저: 프로필 생성 + user_settings, bookmark_folders(기본 폴더) 초기화
        const { username, avatar_url: avatarUrl, provider } = getProfileFromUser(user);
        const profile = await upsertUserProfile(user.id, {
          address: address ?? undefined,
          username,
          avatar_url: avatarUrl,
          provider,
        });
        await ensureNewUserData(user.id);
        return profile;
      }

      // 기존 유저: DB에서 불러온 정보 그대로 사용 (수정 없음)
      await ensureUserSettings(existingProfile.id);
      return existingProfile;
    } catch (error) {
      console.error('Failed to ensure profile:', error);
      return null;
    }
  }, [getProfileFromUser]);

  useEffect(() => {
    const INIT_TOTAL_TIMEOUT_MS = 12000;

    const initAuth = async () => {
      const timeoutId = setTimeout(() => {
        setState((prev) => (prev.initialized ? prev : { ...prev, loading: false, initialized: true }));
      }, INIT_TOTAL_TIMEOUT_MS);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentSession = session;
        const user = session?.user ?? null;

        clearTimeout(timeoutId);
        setState({
          session: currentSession && user ? { ...currentSession, user } : null,
          user,
          profile: null,
          loading: false,
          initialized: true,
        });

        if (user) {
          ensureProfile(user).then((profile) => {
            setState((prev) => ({ ...prev, profile }));
          });
        }
      } catch (err) {
        console.error('[AuthProvider] initAuth 실패:', err);
        clearTimeout(timeoutId);
        setState({
          session: null,
          user: null,
          profile: null,
          loading: false,
          initialized: true,
        });
      }
    };
    initAuth();

    // Listen for auth changes (TOKEN_REFRESHED 포함)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        let user = session?.user ?? null;
        if (event === 'SIGNED_OUT') {
          setState((prev) => ({
            ...prev,
            session: null,
            user: null,
            profile: null,
            loading: false,
          }));
          return;
        }
        setState((prev) => ({
          ...prev,
          session: session && user ? { ...session, user } : null,
          user,
          profile: null,
          loading: false,
        }));

        if (user) {
          if (event === 'SIGNED_IN') {
            ensureProfile(user).then((profile) => {
              setState((prev) => ({ ...prev, profile }));
            });
          } else {
            fetchProfile(user.id).then((profile) => {
              setState((prev) => ({ ...prev, profile }));
            });
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [ensureProfile, fetchProfile]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!state.user) {
        syncI18nLanguageFromLearningLanguage('ko');
        return;
      }
      try {
        const s = await getUserSettings(state.user.id);
        if (!cancelled) {
          syncI18nLanguageFromLearningLanguage(s?.learning_language);
        }
      } catch {
        if (!cancelled) {
          syncI18nLanguageFromLearningLanguage('ko');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.user?.id]);

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
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    console.log('[AuthProvider] start - deleteAccount 진입');
    setState((prev) => ({ ...prev, loading: true }));
    try {
      console.log('[AuthProvider] authDeleteUserAccount 호출 직전');
      await authDeleteUserAccount();
      console.log('[AuthProvider] authDeleteUserAccount 성공, 로그아웃 처리');
      await authSignOut();
      setState((prev) => ({
        ...prev,
        session: null,
        user: null,
        profile: null,
        loading: false,
      }));
    } catch (error) {
      console.error('[AuthProvider] deleteAccount 실패', error);
      setState((prev) => ({ ...prev, loading: false }));
      throw error;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!state.user) return;
    
    const profile = await fetchProfile(state.user.id);
    setState((prev) => ({ ...prev, profile }));
  }, [state.user, fetchProfile]);

  /** 구글 등 OAuth user_metadata를 DB 프로필에 동기화 (닉네임/사진이 비어있을 때) */
  const syncProfileFromAuth = useCallback(async () => {
    if (!state.user) return;
    const profile = await ensureProfile(state.user);
    setState((prev) => ({ ...prev, profile }));
  }, [state.user, ensureProfile]);

  /** 401 등 세션 만료 시: 바로 signOut (Web에서는 Supabase autoRefreshToken에 맡김) */
  const handleSessionError = useCallback(async () => {
    await authSignOut();
    setState((prev) => ({
      ...prev,
      session: null,
      user: null,
      profile: null,
      loading: false,
    }));
  }, []);

  const value: AuthContextType = {
    ...state,
    signInWithGoogle,
    signInWithMagicLink,
    signOut,
    deleteAccount,
    refreshProfile,
    syncProfileFromAuth,
    handleSessionError,
  };

  // getSession 완료 전까지 화면 렌더 지연 (OAuth callback 직후 세션 저장 대기)
  if (!state.initialized) {
    return (
      <AuthContext.Provider value={value}>
        <View style={styles.splash}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
});
