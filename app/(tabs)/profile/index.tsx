import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/hooks/useAuth';
import { getUserProgressList, getWeeklyQuizAttempts, isAuthError, UserProgress } from '@/lib/supabase';
import {
  User,
  Settings,
  LogOut,
  ChevronRight,
  Check,
  BookOpen,
  ClipboardCheck,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), ms);
    }),
  ]);
}

// Google 아이콘 SVG 대체 컴포넌트
function GoogleIcon({ size, color }: { size: number; color: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
      }}
    >
      <Text style={{ fontSize: size * 0.6, fontWeight: 'bold', color: '#4285F4' }}>G</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { user, profile, loading, initialized, signInWithGoogle, signOut, syncProfileFromAuth, handleSessionError } =
    useAuth();

  // DB 프로필이 비어있는데 구글 user_metadata에 있으면 동기화
  const displayNickname = useMemo(() => {
    if (profile?.username) return profile.username;
    const meta = user?.user_metadata ?? {};
    const identityData = (user?.identities?.[0] as { identity_data?: Record<string, unknown> } | undefined)?.identity_data ?? {};
    return (identityData.full_name ?? identityData.name ?? meta.full_name ?? meta.name ?? user?.email?.split('@')[0] ?? '') as string;
  }, [user, profile?.username]);
  const displayAvatar = useMemo(() => {
    if (profile?.avatar_url) return profile.avatar_url;
    const meta = user?.user_metadata ?? {};
    const identityData = (user?.identities?.[0] as { identity_data?: Record<string, unknown> } | undefined)?.identity_data ?? {};
    return (identityData.avatar_url ?? identityData.picture ?? meta.avatar_url ?? meta.picture ?? null) as string | null;
  }, [user, profile?.avatar_url]);

  const [authLoading, setAuthLoading] = useState(false);
  const [progressList, setProgressList] = useState<UserProgress[]>([]);
  const [weeklyAttempts, setWeeklyAttempts] = useState<number[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  // 프로필 탭 포커스 시 프로필이 없으면 생성 시도 (신규 유저)
  useFocusEffect(
    useCallback(() => {
      if (user && !profile) {
        syncProfileFromAuth();
      }
    }, [user, profile, syncProfileFromAuth])
  );

  // 학습 정보 로드
  const loadStats = useCallback(async () => {
    if (!user) return;
    setStatsLoading(true);
    try {
      const [progress, weeks] = await withTimeout(
        Promise.all([
          getUserProgressList(user.id),
          getWeeklyQuizAttempts(user.id),
        ]),
        12000,
        t('errors.requestTimeout')
      );
      setProgressList(progress);
      setWeeklyAttempts(weeks);
    } catch (error) {
      console.error('Failed to load stats:', error);
      if (isAuthError(error)) {
        await handleSessionError();
      }
      setProgressList([]);
      setWeeklyAttempts([]);
    } finally {
      setStatsLoading(false);
    }
  }, [user, handleSessionError, t]);

  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user, loadStats]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadStats();
      }
    }, [user, loadStats])
  );

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    try {
      const redirectTo =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.origin + window.location.pathname
          : undefined;
      await signInWithGoogle(redirectTo);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('settings.unknownError');
      Alert.alert(t('profile.loginFail'), errorMessage);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
    const confirmed = isWeb
      ? window.confirm(t('profile.signOutConfirm'))
      : await new Promise<boolean>((resolve) => {
          Alert.alert(t('profile.signOutTitle'), t('profile.signOutConfirm'), [
            { text: t('folder.cancel'), style: 'cancel', onPress: () => resolve(false) },
            { text: t('profile.signOut'), style: 'destructive', onPress: () => resolve(true) },
          ]);
        });

    if (!confirmed) return;

    try {
      await signOut();
      if (isWeb) {
        window.location.reload();
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('settings.unknownError');
      Alert.alert(t('alert.error'), errorMessage);
    }
  };

  // 로딩 중
  if (!initialized || loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // 비로그인 상태 - 로그인 유도
  if (!user) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>{t('profile.title')}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.loginContent}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primaryLight }]}>
            <User size={48} color={colors.primary} />
          </View>
          <Text style={[styles.loginTitle, { color: colors.text }]}>{t('profile.loginTitle')}</Text>
          <Text style={[styles.loginSubtitle, { color: colors.textSecondary }]}>
            {t('profile.loginSubtitle')}
          </Text>

          <TouchableOpacity
            style={[styles.googleButton, { backgroundColor: '#fff', borderColor: colors.border }]}
            onPress={handleGoogleSignIn}
            disabled={authLoading}
          >
            <GoogleIcon size={24} color="#4285F4" />
            <Text style={styles.googleButtonText}>{t('profile.googleContinue')}</Text>
          </TouchableOpacity>

          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            {t('profile.guestInfo')}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // 로그인 상태 - 프로필 표시
  const completedDays = progressList.length;
  const totalDays = 50;
  const isDayComplete = completedDays >= totalDays;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t('profile.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.profileContent}>
        {/* 프로필 섹션 */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface }]}>
          <View style={styles.avatarSection}>
            {displayAvatar ? (
              <Image source={{ uri: displayAvatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primaryLight }]}>
                <User size={40} color={colors.primary} />
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={[styles.displayName, { color: colors.text }]}>
                {displayNickname || t('profile.defaultUser')}
              </Text>
              <Text style={[styles.email, { color: colors.textSecondary }]}>
                {user.email ?? ''}
              </Text>
            </View>
          </View>
        </View>

        {/* 학습 정보 요약 */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.statsSection')}</Text>
        <View style={[styles.statsCard, { backgroundColor: colors.surface }]}>
          {statsLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <View style={styles.statRow}>
                <View style={[styles.statIconWrap, { backgroundColor: colors.primaryLight }]}>
                  {isDayComplete ? (
                    <Check size={20} color={colors.primary} />
                  ) : (
                    <BookOpen size={20} color={colors.primary} />
                  )}
                </View>
                <View style={styles.statContent}>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('profile.dayProgressLabel')}</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {isDayComplete
                      ? t('profile.dayProgressComplete', { total: totalDays })
                      : t('profile.dayProgressPartial', { completed: completedDays, total: totalDays })}
                  </Text>
                </View>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statRow}>
                <View style={[styles.statIconWrap, { backgroundColor: colors.primaryLight }]}>
                  <ClipboardCheck size={20} color={colors.success ?? colors.primary} />
                </View>
                <View style={styles.statContent}>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    {t('profile.weeklyMockLabel')}
                  </Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {weeklyAttempts.length > 0
                      ? t('profile.weeklyMockHas', { count: weeklyAttempts.length })
                      : t('profile.weeklyMockNone')}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* 메뉴 리스트 */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.settingsSection')}</Text>
        <View style={[styles.menuCard, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/profile/settings')}
          >
            <View style={styles.menuLeft}>
              <Settings size={20} color={colors.textSecondary} />
              <Text style={[styles.menuText, { color: colors.text }]}>{t('profile.appSettings')}</Text>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
            <View style={styles.menuLeft}>
              <LogOut size={20} color={colors.error ?? '#dc2626'} />
              <Text style={[styles.menuText, { color: colors.error ?? '#dc2626' }]}>{t('profile.signOut')}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },

  // 로그인 화면
  loginContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  loginSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
    gap: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  infoText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 32,
    lineHeight: 20,
  },

  // 프로필 화면
  profileContent: {
    padding: 20,
    gap: 20,
  },
  profileCard: {
    padding: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
  },
  displayName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },

  statsCard: {
    padding: 20,
    borderRadius: 16,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 13,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  statDivider: {
    height: 1,
    marginVertical: 16,
  },

  menuCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuText: {
    fontSize: 16,
  },
  menuDivider: {
    height: 1,
    marginLeft: 52,
  },
});
