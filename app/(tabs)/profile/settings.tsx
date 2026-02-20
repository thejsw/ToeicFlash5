import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/hooks/useAuth';
import { getUserSettings, upsertUserSettings, ensureUserSettings, UserSettings } from '@/lib/supabase';
import { ArrowLeft, Globe, Bell, Trash2 } from 'lucide-react-native';

const LANGUAGES = [
  { code: 'ko', label: '한국어' },
  { code: 'ja', label: '日本語' },
];

export default function SettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, deleteAccount, loading: authLoading } = useAuth();

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [savingNotification, setSavingNotification] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!user) return;
    setLoadingSettings(true);
    try {
      // user_settings가 없을 수 있으므로 ensure로 생성 후 조회
      const data = await ensureUserSettings(user.id);
      setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
      // 폴백: ensure 실패 시 getUserSettings 시도
      try {
        const fallback = await getUserSettings(user.id);
        setSettings(
          fallback ?? {
            id: '',
            user_id: user.id,
            learning_language: 'ko',
            notification_enabled: true,
            updated_at: '',
          }
        );
      } catch {
        setSettings({
          id: '',
          user_id: user.id,
          learning_language: 'ko',
          notification_enabled: true,
          updated_at: '',
        });
      }
    } finally {
      setLoadingSettings(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadSettings();
    } else {
      setLoadingSettings(false);
    }
  }, [user, loadSettings]);

  const handleLanguageChange = async (langCode: string) => {
    if (!user || savingLanguage) return;
    setSavingLanguage(true);
    try {
      const updated = await upsertUserSettings(user.id, { learning_language: langCode });
      setSettings(updated);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      Alert.alert('저장 실패', errorMessage);
    } finally {
      setSavingLanguage(false);
    }
  };

  const handleNotificationToggle = async (value: boolean) => {
    if (!user || savingNotification) return;
    setSavingNotification(true);
    try {
      const updated = await upsertUserSettings(user.id, { notification_enabled: value });
      setSettings(updated);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      Alert.alert('저장 실패', errorMessage);
    } finally {
      setSavingNotification(false);
    }
  };

  const handleDeleteAccount = () => {
    console.log('[설정] click - 계정 삭제 버튼 눌림');
    // 웹에서는 Alert.alert가 동작하지 않으므로 window.confirm 사용
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const ok1 = window.confirm(
        '계정 삭제\n\n정말로 계정을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 모든 데이터가 삭제됩니다.'
      );
      if (!ok1) return;
      const ok2 = window.confirm(
        '최종 확인\n\n계정 삭제를 진행하면 다음 데이터가 모두 삭제됩니다:\n\n• 프로필 정보\n• 학습 진행 기록\n• 북마크\n• 설정\n\n정말 삭제하시겠습니까?'
      );
      if (ok2) performDeleteAccount();
      return;
    }
    Alert.alert(
      '계정 삭제',
      '정말로 계정을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 모든 데이터가 삭제됩니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => confirmDeleteAccount(),
        },
      ]
    );
  };

  const confirmDeleteAccount = () => {
    console.log('[설정] start - confirmDeleteAccount (첫 번째 다이얼로그에서 삭제 클릭됨)');
    Alert.alert(
      '최종 확인',
      '계정 삭제를 진행하면 다음 데이터가 모두 삭제됩니다:\n\n• 프로필 정보\n• 학습 진행 기록\n• 북마크\n• 설정\n\n정말 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '영구 삭제',
          style: 'destructive',
          onPress: performDeleteAccount,
        },
      ]
    );
  };

  const performDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await deleteAccount();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // 웹: 전체 페이지 리로드로 AuthProvider/캐시 초기화 보장
        window.location.replace('/');
      } else {
        router.replace('/(tabs)');
      }
    } catch (error: unknown) {
      console.error('[설정] performDeleteAccount catch:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`계정 삭제 실패\n\n${errorMessage}`);
      } else {
        Alert.alert('계정 삭제 실패', errorMessage);
      }
    } finally {
      setDeletingAccount(false);
    }
  };

  // 로그인 안 된 경우
  if (!user) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          로그인이 필요합니다.
        </Text>
      </View>
    );
  }

  if (authLoading || loadingSettings) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 헤더 */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/profile')} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>설정</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* 학습 언어 */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>학습 언어</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.cardHeader}>
            <Globe size={20} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>콘텐츠 표시 언어</Text>
            {savingLanguage && (
              <ActivityIndicator size="small" color={colors.primary} style={styles.savingIndicator} />
            )}
          </View>
          <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
            단어 뜻과 예문 번역에 사용할 언어를 선택하세요.
          </Text>
          <View style={styles.languageOptions}>
            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.languageOption,
                  {
                    borderColor:
                      settings?.learning_language === lang.code ? colors.primary : colors.border,
                    backgroundColor:
                      settings?.learning_language === lang.code
                        ? colors.primaryLight
                        : colors.background,
                  },
                ]}
                onPress={() => handleLanguageChange(lang.code)}
                disabled={savingLanguage}
              >
                <Text
                  style={[
                    styles.languageLabel,
                    {
                      color:
                        settings?.learning_language === lang.code ? colors.primary : colors.text,
                      fontWeight: settings?.learning_language === lang.code ? '600' : '400',
                    },
                  ]}
                >
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 알림 설정 */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>알림</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.notificationRow}>
            <View style={styles.notificationLeft}>
              <Bell size={20} color={colors.primary} />
              <View style={styles.notificationText}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>푸시 알림</Text>
                <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                  학습 리마인더 및 주요 알림을 받습니다.
                </Text>
              </View>
            </View>
            <View style={styles.switchContainer}>
              {savingNotification && (
                <ActivityIndicator size="small" color={colors.primary} style={styles.switchLoader} />
              )}
              <Switch
                value={settings?.notification_enabled ?? true}
                onValueChange={handleNotificationToggle}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
                disabled={savingNotification}
              />
            </View>
          </View>
        </View>

        {/* 위험 영역 */}
        <Text style={[styles.sectionTitle, { color: colors.error ?? '#dc2626' }]}>위험 영역</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={styles.dangerRow}
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
          >
            <View style={styles.dangerLeft}>
              <Trash2 size={20} color={colors.error ?? '#dc2626'} />
              <View style={styles.dangerText}>
                <Text style={[styles.dangerTitle, { color: colors.error ?? '#dc2626' }]}>
                  계정 삭제
                </Text>
                <Text style={[styles.dangerDescription, { color: colors.textSecondary }]}>
                  모든 데이터가 영구적으로 삭제됩니다.
                </Text>
              </View>
            </View>
            {deletingAccount && <ActivityIndicator size="small" color={colors.error ?? '#dc2626'} />}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 40,
  },

  content: {
    padding: 20,
    gap: 8,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  card: {
    padding: 16,
    borderRadius: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  savingIndicator: {
    marginLeft: 'auto',
  },

  languageOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  languageOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  languageLabel: {
    fontSize: 14,
  },

  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  notificationText: {
    flex: 1,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchLoader: {
    marginRight: 8,
  },

  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dangerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  dangerText: {
    flex: 1,
  },
  dangerTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  dangerDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
});
