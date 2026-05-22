import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/hooks/useAuth';
import { ClipboardList } from 'lucide-react-native';
import { getCurrentWeekNum, parseWeekNum } from '@/lib/weekUtils';
import { listAvailableWeeklyQuizzes, isAuthError, type WeeklyQuizItem } from '@/lib/supabase';
import { generateWeeklyQuizQuestions } from '@/lib/llm';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), ms);
    }),
  ]);
}

export default function TestScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const { handleSessionError } = useAuth();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 0);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<number | null>(null);
  const [quizzes, setQuizzes] = useState<WeeklyQuizItem[]>([]);
  const [currentWeekNum] = useState(() => getCurrentWeekNum());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await withTimeout(listAvailableWeeklyQuizzes(), 12000, t('errors.requestTimeout'));
      setQuizzes(list);
    } catch (e) {
      console.error('Error loading weekly quiz list:', e);
      if (isAuthError(e)) {
        await handleSessionError();
      }
      setQuizzes([]);
    } finally {
      setLoading(false);
    }
  }, [handleSessionError, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const hasCurrentQuiz = quizzes.some((q) => q.week_num === currentWeekNum);

  const handleStart = (weekNum: number) => {
    router.push(`/test/week/${weekNum}/quiz`);
  };

  const handleCreateAndStart = async () => {
    setCreating(currentWeekNum);
    try {
      await generateWeeklyQuizQuestions(currentWeekNum);
      setQuizzes((prev) => {
        const exists = prev.some((q) => q.week_num === currentWeekNum);
        if (exists) return prev;
        return [{ week_num: currentWeekNum, created_at: new Date().toISOString() }, ...prev];
      });
      router.push(`/test/week/${currentWeekNum}/quiz`);
    } catch (err: any) {
      console.error('Error creating weekly quiz:', err);
      const msg = err?.message ?? '';
      if (msg.includes('이미 해당 주차') || msg.includes('alreadyExists')) {
        setQuizzes((prev) => {
          const exists = prev.some((q) => q.week_num === currentWeekNum);
          if (exists) return prev;
          return [{ week_num: currentWeekNum, created_at: new Date().toISOString() }, ...prev];
        });
        router.push(`/test/week/${currentWeekNum}/quiz`);
        return;
      }
      Alert.alert(
        t('testTab.createFail'),
        t('testTab.createFailBody', {
          msg: msg || t('testTab.createFailGeneric'),
          hint: t('testTab.createFailHint'),
        })
      );
    } finally {
      setCreating(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t('testTab.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('testTab.subtitle')}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + bottomInset }]}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primaryLight }]}>
            <ClipboardList size={32} color={colors.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {t('weeklyQuiz.title', parseWeekNum(currentWeekNum))}
          </Text>
          <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
            {hasCurrentQuiz ? t('testTab.savedQuiz') : t('testTab.thisWeekQuiz')}
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={hasCurrentQuiz ? () => handleStart(currentWeekNum) : handleCreateAndStart}
            disabled={creating !== null}>
            {creating === currentWeekNum ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{hasCurrentQuiz ? t('testTab.startOver') : t('testTab.start')}</Text>
            )}
          </TouchableOpacity>
        </View>

        {quizzes
          .filter((q) => q.week_num !== currentWeekNum)
          .map((q) => (
            <TouchableOpacity
              key={q.week_num}
              style={[styles.card, styles.cardCompact, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => handleStart(q.week_num)}
              activeOpacity={0.7}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {t('weeklyQuiz.title', parseWeekNum(q.week_num))}
              </Text>
              <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{t('testTab.retryList')}</Text>
              <View style={[styles.button, styles.buttonOutline, { borderColor: colors.primary }]}>
                <Text style={[styles.buttonText, { color: colors.primary }]}>{t('testTab.startOver')}</Text>
              </View>
            </TouchableOpacity>
          ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  cardCompact: {
    padding: 20,
    marginTop: 12,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 160,
    alignItems: 'center',
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
