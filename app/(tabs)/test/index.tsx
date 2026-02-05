import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '@/lib/theme';
import { ClipboardList } from 'lucide-react-native';
import { getCurrentWeekNum, formatWeeklyQuizTitle } from '@/lib/weekUtils';
import { getWeeklyQuizId } from '@/lib/supabase';
import { generateWeeklyQuizQuestions } from '@/lib/llm';
import AdBanner from '@/components/AdBanner';

export default function TestScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [currentWeekNum, setCurrentWeekNum] = useState<number | null>(null);
  const [hasQuiz, setHasQuiz] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const weekNum = getCurrentWeekNum();
      setCurrentWeekNum(weekNum);
      const quizId = await getWeeklyQuizId(weekNum);
      setHasQuiz(!!quizId);
    } catch (e) {
      console.error('Error loading weekly quiz state:', e);
      setHasQuiz(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleStartOrCreate = async () => {
    if (currentWeekNum == null) return;

    if (hasQuiz) {
      router.push(`/test/week/${currentWeekNum}/quiz`);
      return;
    }

    setCreating(true);
    try {
      await generateWeeklyQuizQuestions(currentWeekNum);
      setHasQuiz(true);
      router.push(`/test/week/${currentWeekNum}/quiz`);
    } catch (err: any) {
      console.error('Error creating weekly quiz:', err);
      const msg = err?.message ?? '';
      if (msg.includes('이미 해당 주차') || msg.includes('alreadyExists')) {
        setHasQuiz(true);
        router.push(`/test/week/${currentWeekNum}/quiz`);
        return;
      }
      const hint =
        'Supabase 대시보드에서 Edge Function "generate-weekly-quiz" 배포 여부와 시크릿(OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) 설정을 확인해주세요.';
      Alert.alert('생성 실패', `${msg || '주차 모의고사를 생성하는 중 오류가 발생했습니다.'}\n\n${hint}`);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const title = currentWeekNum != null ? formatWeeklyQuizTitle(currentWeekNum) : '';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>테스트</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          주차별 TOEIC Part 5 어휘 모의고사
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 }]}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primaryLight }]}>
            <ClipboardList size={32} color={colors.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
          {hasQuiz ? (
            <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
              저장된 모의고사입니다. 다시 풀어볼 수 있습니다.
            </Text>
          ) : null}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleStartOrCreate}
            disabled={creating}>
            {creating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{hasQuiz ? '시작하기' : '시작'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <AdBanner />
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
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
