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
import { useAuth } from '@/hooks/useAuth';
import { ClipboardList } from 'lucide-react-native';
import { getCurrentWeekNum, formatWeeklyQuizTitle } from '@/lib/weekUtils';
import { fetchQuizByWeek, listAvailableWeeklyQuizzes, isAuthError, type WeeklyQuizItem } from '@/lib/supabase';

function withTimeout<T>(promise: Promise<T>, ms = 12000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('요청 시간이 초과되었습니다.')), ms);
    }),
  ]);
}

const BACKEND_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://127.0.0.1:3000';

type GenerateWeeklyQuizApiResult = {
  questions?: unknown[];
  created_at?: string | null;
  error?: string;
  alreadyExists?: boolean;
};

async function generateWeeklyQuizViaBackend(weekNum: number): Promise<GenerateWeeklyQuizApiResult> {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/57760822-afc0-4241-84bd-3d7185be3e6b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'route-check-2',hypothesisId:'H7',location:'app/(tabs)/testTab/index.tsx:37',message:'backend generate request start',data:{weekNum,backendBaseUrl:BACKEND_BASE_URL},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const response = await fetch(`${BACKEND_BASE_URL}/quiz/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weekNum }),
  });
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/57760822-afc0-4241-84bd-3d7185be3e6b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'route-check-2',hypothesisId:'H7',location:'app/(tabs)/testTab/index.tsx:44',message:'backend generate response',data:{weekNum,status:response.status,ok:response.ok},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  const data = (await response.json().catch(() => ({}))) as GenerateWeeklyQuizApiResult;
  if (!response.ok) {
    const message = data?.error || '주차 모의고사 생성 요청에 실패했습니다.';
    const err = new Error(message) as Error & { alreadyExists?: boolean };
    err.alreadyExists = Boolean(data?.alreadyExists);
    throw err;
  }

  return data;
}

export default function TestScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { handleSessionError } = useAuth();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<number | null>(null);
  const [quizzes, setQuizzes] = useState<WeeklyQuizItem[]>([]);
  const [currentWeekNum] = useState(() => getCurrentWeekNum());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await withTimeout(listAvailableWeeklyQuizzes());
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
  }, [handleSessionError]);

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
      // 1) 먼저 DB에 해당 주차 퀴즈가 이미 있는지 확인
      const existing = await fetchQuizByWeek(currentWeekNum);
      const hasExisting = existing.questions.length > 0;
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/57760822-afc0-4241-84bd-3d7185be3e6b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H1',location:'app/(tabs)/testTab/index.tsx:70',message:'fetchQuizByWeek result',data:{weekNum:currentWeekNum,questionCount:existing.questions.length,createdAt:existing.created_at,hasExisting},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      if (hasExisting) {
        const createdAt = existing.created_at ?? new Date().toISOString();
        setQuizzes((prev) => {
          const exists = prev.some((q) => q.week_num === currentWeekNum);
          if (exists) return prev;
          return [{ week_num: currentWeekNum, created_at: createdAt }, ...prev];
        });
        router.push(`/test/week/${currentWeekNum}/quiz`);
        return;
      }

      // 2) 없으면 backend quiz API로 생성
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/57760822-afc0-4241-84bd-3d7185be3e6b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H2',location:'app/(tabs)/testTab/index.tsx:84',message:'calling generateWeeklyQuizQuestions',data:{weekNum:currentWeekNum},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      await generateWeeklyQuizViaBackend(currentWeekNum);

      // 3) 생성 후 다시 조회(로컬 목록/created_at 동기화)
      const after = await fetchQuizByWeek(currentWeekNum);
      const createdAt = after.created_at ?? new Date().toISOString();
      setQuizzes((prev) => {
        const exists = prev.some((q) => q.week_num === currentWeekNum);
        if (exists) return prev;
        return [{ week_num: currentWeekNum, created_at: createdAt }, ...prev];
      });
      router.push(`/test/week/${currentWeekNum}/quiz`);
    } catch (err: any) {
      console.error('Error creating weekly quiz:', err);
      const msg = err?.message ?? '';
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/57760822-afc0-4241-84bd-3d7185be3e6b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H4',location:'app/(tabs)/testTab/index.tsx:98',message:'handleCreateAndStart catch',data:{weekNum:currentWeekNum,errorMessage:msg,isDuplicateMsg:msg.includes('이미 해당 주차')||msg.includes('alreadyExists')},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (msg.includes('이미 해당 주차') || msg.includes('alreadyExists') || Boolean(err?.alreadyExists)) {
        // 중복 생성 요청이더라도 이미 만들어져 있을 가능성이 높으니 재조회 후 created_at 동기화
        try {
          const after = await fetchQuizByWeek(currentWeekNum);
          const createdAt = after.created_at ?? new Date().toISOString();
          setQuizzes((prev) => {
            const exists = prev.some((q) => q.week_num === currentWeekNum);
            if (exists) return prev;
            return [{ week_num: currentWeekNum, created_at: createdAt }, ...prev];
          });
        } catch {
          setQuizzes((prev) => {
            const exists = prev.some((q) => q.week_num === currentWeekNum);
            if (exists) return prev;
            return [{ week_num: currentWeekNum, created_at: new Date().toISOString() }, ...prev];
          });
        }
        router.push(`/test/week/${currentWeekNum}/quiz`);
        return;
      }
      const hint =
        `backend 서버 상태와 API 경로(${BACKEND_BASE_URL}/quiz/generate), 그리고 서버 환경변수(OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) 설정을 확인해주세요.`;
      Alert.alert('생성 실패', `${msg || '주차 모의고사를 생성하는 중 오류가 발생했습니다.'}\n\n${hint}`);
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
        <Text style={[styles.title, { color: colors.text }]}>테스트</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          주차별 TOEIC Part 5 어휘 모의고사
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}>
        {/* 이번 주 모의고사 (없으면 생성 버튼) */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primaryLight }]}>
            <ClipboardList size={32} color={colors.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {formatWeeklyQuizTitle(currentWeekNum)}
          </Text>
          <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
            {hasCurrentQuiz ? '저장된 모의고사입니다. 다시 풀어볼 수 있습니다.' : '이번 주 모의고사'}
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleCreateAndStart}
            disabled={creating !== null}>
            {creating === currentWeekNum ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{hasCurrentQuiz ? '시작하기' : '시작'}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 이전 모의고사 목록 */}
        {quizzes
          .filter((q) => q.week_num !== currentWeekNum)
          .map((q) => (
            <TouchableOpacity
              key={q.week_num}
              style={[styles.card, styles.cardCompact, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => handleStart(q.week_num)}
              activeOpacity={0.7}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{formatWeeklyQuizTitle(q.week_num)}</Text>
              <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>다시 풀어보기</Text>
              <View style={[styles.button, styles.buttonOutline, { borderColor: colors.primary }]}>
                <Text style={[styles.buttonText, { color: colors.primary }]}>시작하기</Text>
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
