import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const GUEST_FOLDERS_KEY = 'bookmark_guest_folders';
const GUEST_BOOKMARKS_KEY = 'bookmark_guest_bookmarks';

type GuestFolder = { id: string; name: string; order_index: number };
type GuestBookmark = { id: string; word_id: string; folder_id: string };

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

async function getGuestFolders(): Promise<GuestFolder[]> {
  const raw = await AsyncStorage.getItem(GUEST_FOLDERS_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function setGuestFolders(folders: GuestFolder[]): Promise<void> {
  await AsyncStorage.setItem(GUEST_FOLDERS_KEY, JSON.stringify(folders));
}

async function getGuestBookmarks(): Promise<GuestBookmark[]> {
  const raw = await AsyncStorage.getItem(GUEST_BOOKMARKS_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function setGuestBookmarks(bookmarks: GuestBookmark[]): Promise<void> {
  await AsyncStorage.setItem(GUEST_BOOKMARKS_KEY, JSON.stringify(bookmarks));
}

type SupabaseExtras = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const extras = (Constants.expoConfig?.extra ??
  Constants.manifest?.extra ??
  {}) as SupabaseExtras;

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? extras.supabaseUrl ?? '';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extras.supabaseAnonKey ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase credentials are missing. Provide EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

/** Supabase/PostgREST 401 인증 에러 여부 (세션 만료 시 handleSessionError 호출용) */
export function isAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string; status?: number };
  return (
    e.status === 401 ||
    e.code === 'PGRST301' ||
    (typeof e.message === 'string' && (e.message.includes('401') || e.message.includes('JWT') || e.message.includes('expired')))
  );
}

// ---------------------------------------------------------------------------
// Types (docs/DB_SCHEMA.md 기준)
// ---------------------------------------------------------------------------

/** words + word_contents 병합 결과 — 플래시카드/북마크 표시용 */
export type VocabularyWord = {
  id: string;
  day: number;
  word: string;
  order_index: number;
  meaning: string;
  example_en: string;
  example_local: string;
};

export type UserProgress = {
  id: string;
  user_id: string;
  day: number;
  last_card_index: number;
  updated_at: string;
};

export type Bookmark = {
  id: string;
  user_id: string;
  word_id: string;
  folder_id: string | null;
  created_at: string;
};

export type BookmarkFolder = {
  id: string;
  user_id: string;
  name: string;
  order_index: number;
  created_at: string;
};

export const DEFAULT_FOLDER_NAME = '기본';

// words / word_contents 단일 테이블 응답
type WordRow = {
  id: string;
  day: number;
  word: string;
  example_en: string | null;
  order_index: number;
};
type WordContentRow = {
  word_id: string;
  meaning: string | null;
  example_local?: string | null;
  exampleLocal?: string | null;
  language?: string | null;
};

/**
 * words와 word_contents를 각각 조회한 뒤 클라이언트에서 병합.
 * (Supabase 중첩 select가 null을 주는 경우 대비 — relation/FK 설정 없어도 동작)
 */
export async function fetchWordsWithContents(
  wordIds: string[] | { day: number }
): Promise<VocabularyWord[]> {
  const isByDay = typeof wordIds === 'object' && 'day' in wordIds;

  const wordsQuery = isByDay
    ? supabase
        .from('words')
        .select('id, day, word, example_en, order_index')
        .eq('day', wordIds.day)
        .order('order_index')
    : supabase
        .from('words')
        .select('id, day, word, example_en, order_index')
        .in('id', wordIds);

  const { data: wordsData, error: wordsError } = await wordsQuery;
  if (wordsError) throw wordsError;

  const words = (wordsData ?? []) as WordRow[];
  if (words.length === 0) return [];

  const ids = words.map((w) => w.id);
  const { data: contentsData, error: contentsError } = await supabase
    .from('word_contents')
    .select('word_id, meaning, example_local, language')
    .in('word_id', ids);

  if (contentsError) throw contentsError;
  const contents = (contentsData ?? []) as WordContentRow[];

  const byWordId = new Map<string, WordContentRow>();
  for (const c of contents) {
    if (c.word_id == null || c.word_id === '') continue;
    const existing = byWordId.get(c.word_id);
    const isKo = (c.language ?? '').toLowerCase().startsWith('ko');
    const existingIsKo = existing ? (existing.language ?? '').toLowerCase().startsWith('ko') : false;
    if (!existing || (isKo && !existingIsKo)) {
      byWordId.set(c.word_id, c);
    }
  }

  function getExampleLocalOnly(c: WordContentRow | undefined): string {
    if (!c) return '';
    const value = (c.example_local ?? (c as { exampleLocal?: string }).exampleLocal ?? '').trim();
    return value;
  }

  return words.map((w) => {
    const c = byWordId.get(w.id);
    const exampleEn = w.example_en ?? '';
    const exampleLocal = getExampleLocalOnly(c);
    return {
      id: w.id,
      day: w.day,
      word: w.word,
      order_index: w.order_index,
      meaning: c?.meaning ?? '',
      example_en: exampleEn,
      example_local: exampleLocal,
    };
  });
}

type QuizChoiceRow = {
  id: string;
  question_id: string;
  choice_key: string | null;
  choice_text: string | null;
  is_correct: boolean | null;
};
type QuizQuestionRow = { id: string; word_id: string; quiz_id: string; question_text: string | null; order_index: number };
type QuizExplanationRow = { question_id: string; explanation: string | null; language: string | null };

export type DayQuizQuestion = {
  id: string;
  question_text: string;
  choices: { choice_key: string; choice_text: string }[];
  answer: string;
  explanation: string;
};

/** Day 퀴즈 전용: week_num이 null인 퀴즈만 조회 (기존 로직 유지) */
export async function fetchQuizByDay(dayNum: number): Promise<DayQuizQuestion[]> {
  const { data: quizData, error: quizError } = await supabase
    .from('quizzes')
    .select('id')
    .eq('day_num', dayNum)
    .is('week_num', null)
    .limit(1)
    .maybeSingle();

  if (quizError) throw quizError;
  if (!quizData?.id) return [];

  const quizId = quizData.id;

  const { data: questionsData, error: questionsError } = await supabase
    .from('quiz_questions')
    .select('id, word_id, quiz_id, question_text, order_index')
    .eq('quiz_id', quizId)
    .order('order_index');

  if (questionsError) throw questionsError;
  const questions = (questionsData ?? []) as QuizQuestionRow[];
  if (questions.length === 0) return [];

  const questionIds = questions.map((q) => q.id);
  const { data: choicesData, error: choicesError } = await supabase
    .from('quiz_choices')
    .select('id, question_id, choice_key, choice_text, is_correct')
    .in('question_id', questionIds);

  if (choicesError) throw choicesError;
  const choices = (choicesData ?? []) as QuizChoiceRow[];

  const { data: explanationsData, error: explanationsError } = await supabase
    .from('quiz_explanations')
    .select('question_id, explanation, language')
    .in('question_id', questionIds);

  if (explanationsError) throw explanationsError;
  const explanations = (explanationsData ?? []) as QuizExplanationRow[];

  const choicesByQuestion = new Map<string, QuizChoiceRow[]>();
  for (const c of choices) {
    if (!c.question_id) continue;
    const list = choicesByQuestion.get(c.question_id) ?? [];
    list.push(c);
    choicesByQuestion.set(c.question_id, list);
  }

  const explanationByQuestion = new Map<string, string>();
  const explanationLangByQuestion = new Map<string, boolean>();
  for (const e of explanations) {
    if (!e.question_id) continue;
    const isKo = (e.language ?? '').toLowerCase().startsWith('ko');
    const existingIsKo = explanationLangByQuestion.get(e.question_id);
    if (existingIsKo === undefined || (isKo && !existingIsKo)) {
      explanationByQuestion.set(e.question_id, e.explanation ?? '');
      explanationLangByQuestion.set(e.question_id, isKo);
    }
  }

  function fixTextEncoding(str: string): string {
    return str
      .replace(/\uFFFD/g, "'")
      .replace(/â€™|Ã¢â‚¬â„¢|Ã¢â‚¬™|â€˜/g, "'")
      .replace(/â€œ|â€|â€\u009d/g, '"');
  }

  const orderKeys = ['A', 'B', 'C', 'D', 'a', 'b', 'c', 'd'];

  return questions.map((q) => {
    const rawChoices = choicesByQuestion.get(q.id) ?? [];
    const choiceList = rawChoices
      .map((c) => ({
        choice_key: c.choice_key ?? '',
        choice_text: fixTextEncoding((c.choice_text ?? '').trim()),
        is_correct: c.is_correct === true,
      }))
      .filter((c) => c.choice_text);

    const sorted = [...choiceList].sort((a, b) => {
      const ai = orderKeys.indexOf(a.choice_key);
      const bi = orderKeys.indexOf(b.choice_key);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.choice_key.localeCompare(b.choice_key);
    });

    const correctChoice = sorted.find((c) => c.is_correct);
    const answer = correctChoice?.choice_text ?? (sorted[0]?.choice_text ?? '');

    const explanation = fixTextEncoding(explanationByQuestion.get(q.id) ?? '');

    return {
      id: q.id,
      question_text: fixTextEncoding((q.question_text ?? '').trim()),
      choices: sorted.map((c) => ({ choice_key: c.choice_key, choice_text: c.choice_text })),
      answer,
      explanation,
    };
  });
}

const WEEKLY_MOCK_TYPE = 'weekly_mock_light';

/** Week 퀴즈 존재 여부 및 quiz id (test_quizzes, 동일 week_num 중복 생성 방지용) */
export async function getWeeklyQuizId(weekNum: number): Promise<string | null> {
  const { data, error } = await supabase
    .from('test_quizzes')
    .select('id')
    .eq('type', WEEKLY_MOCK_TYPE)
    .eq('week_num', weekNum)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export type FetchQuizByWeekResult = {
  questions: DayQuizQuestion[];
  created_at: string | null;
};

/** Week 퀴즈 문항 조회 (test_* 테이블, created_at 포함) */
export async function fetchQuizByWeek(weekNum: number): Promise<FetchQuizByWeekResult> {
  const { data: quizData, error: quizError } = await supabase
    .from('test_quizzes')
    .select('id, created_at')
    .eq('type', WEEKLY_MOCK_TYPE)
    .eq('week_num', weekNum)
    .limit(1)
    .maybeSingle();

  if (quizError) throw quizError;
  if (!quizData?.id) return { questions: [], created_at: null };

  const quizId = quizData.id;
  const created_at = quizData.created_at ?? null;

  const { data: questionsData, error: questionsError } = await supabase
    .from('test_quiz_questions')
    .select('id, word_id, quiz_id, question_text, order_index')
    .eq('quiz_id', quizId)
    .order('order_index');

  if (questionsError) throw questionsError;
  const questions = (questionsData ?? []) as QuizQuestionRow[];
  if (questions.length === 0) return { questions: [], created_at };

  const questionIds = questions.map((q) => q.id);
  const { data: choicesData, error: choicesError } = await supabase
    .from('test_quiz_choices')
    .select('id, question_id, choice_key, choice_text, is_correct')
    .in('question_id', questionIds)
    .order('order_index');

  if (choicesError) throw choicesError;
  const choices = (choicesData ?? []) as QuizChoiceRow[];

  const { data: explanationsData, error: explanationsError } = await supabase
    .from('test_quiz_explanations')
    .select('question_id, explanation, language')
    .in('question_id', questionIds)
    .order('order_index');

  if (explanationsError) throw explanationsError;
  const explanations = (explanationsData ?? []) as QuizExplanationRow[];

  const choicesByQuestion = new Map<string, QuizChoiceRow[]>();
  for (const c of choices) {
    if (!c.question_id) continue;
    const list = choicesByQuestion.get(c.question_id) ?? [];
    list.push(c);
    choicesByQuestion.set(c.question_id, list);
  }

  const explanationByQuestion = new Map<string, string>();
  const explanationLangByQuestion = new Map<string, boolean>();
  for (const e of explanations) {
    if (!e.question_id) continue;
    const isKo = (e.language ?? '').toLowerCase().startsWith('ko');
    const existingIsKo = explanationLangByQuestion.get(e.question_id);
    if (existingIsKo === undefined || (isKo && !existingIsKo)) {
      explanationByQuestion.set(e.question_id, e.explanation ?? '');
      explanationLangByQuestion.set(e.question_id, isKo);
    }
  }

  function fixTextEncoding(str: string): string {
    return str
      .replace(/\uFFFD/g, "'")
      .replace(/â€™|Ã¢â‚¬â„¢|Ã¢â‚¬™|â€˜/g, "'")
      .replace(/â€œ|â€|â€\u009d/g, '"');
  }

  const orderKeys = ['A', 'B', 'C', 'D', 'a', 'b', 'c', 'd'];

  const result = questions.map((q) => {
    const rawChoices = choicesByQuestion.get(q.id) ?? [];
    const choiceList = rawChoices
      .map((c) => ({
        choice_key: c.choice_key ?? '',
        choice_text: fixTextEncoding((c.choice_text ?? '').trim()),
        is_correct: c.is_correct === true,
      }))
      .filter((c) => c.choice_text);

    const sorted = [...choiceList].sort((a, b) => {
      const ai = orderKeys.indexOf(a.choice_key);
      const bi = orderKeys.indexOf(b.choice_key);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.choice_key.localeCompare(b.choice_key);
    });

    const correctChoice = sorted.find((c) => c.is_correct);
    const answer = correctChoice?.choice_text ?? (sorted[0]?.choice_text ?? '');
    const explanation = fixTextEncoding(explanationByQuestion.get(q.id) ?? '');

    return {
      id: q.id,
      question_text: fixTextEncoding((q.question_text ?? '').trim()),
      choices: sorted.map((c) => ({ choice_key: c.choice_key, choice_text: c.choice_text })),
      answer,
      explanation,
    };
  });

  return { questions: result, created_at };
}

/** 주차 퀴즈 저장 시 word_id placeholder (test_quiz_questions 등, Edge Function에서 사용) */
export async function getPlaceholderWordId(): Promise<string> {
  const { data, error } = await supabase
    .from('words')
    .select('id')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error('words 테이블에 단어가 없어 주차 퀴즈를 저장할 수 없습니다.');
  return data.id;
}

export type WeeklyQuizQuestionInput = {
  question: string;
  choices: string[];
  answer: string;
  explanation: string;
};

/** 주차 퀴즈 1건 DB 저장 (동일 week_num 중복 호출 금지 — 호출 전 getWeeklyQuizId로 확인) */
export async function insertWeeklyQuiz(
  weekNum: number,
  questions: WeeklyQuizQuestionInput[]
): Promise<string> {
  const placeholderWordId = await getPlaceholderWordId();

  const { data: quizRow, error: quizError } = await supabase
    .from('quizzes')
    .insert({
      type: WEEKLY_MOCK_TYPE,
      day_num: null,
      week_num: weekNum,
    })
    .select('id')
    .single();

  if (quizError) throw quizError;
  const quizId = quizRow.id;

  const orderKeys = ['A', 'B', 'C', 'D'];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const { data: questionRow, error: qErr } = await supabase
      .from('quiz_questions')
      .insert({
        word_id: placeholderWordId,
        quiz_id: quizId,
        question_text: q.question,
        order_index: i,
      })
      .select('id')
      .single();
    if (qErr) throw qErr;
    const questionId = questionRow.id;

    const choices = Array.isArray(q.choices) ? q.choices : [];
    const answerText = (q.answer ?? '').trim();
    for (let j = 0; j < choices.length; j++) {
      const choiceText = (choices[j] ?? '').trim();
      if (!choiceText) continue;
      await supabase.from('quiz_choices').insert({
        question_id: questionId,
        choice_key: orderKeys[j] ?? String.fromCharCode(65 + j),
        choice_text: choiceText,
        is_correct: choiceText === answerText,
      });
    }

    await supabase.from('quiz_explanations').insert({
      question_id: questionId,
      language: 'ko',
      explanation: q.explanation ?? '',
    });
  }

  return quizId;
}

// ---------------------------------------------------------------------------
// Auth Types
// ---------------------------------------------------------------------------

export type UserProfile = {
  id: string;
  address: string | null;
  username: string | null;
  avatar_url: string | null;
  provider: string | null;
  created_at: string;
};

export type UserSettings = {
  id: string;
  user_id: string;
  learning_language: string;
  notification_enabled: boolean;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Auth Functions
// ---------------------------------------------------------------------------

export async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export async function signInWithGoogle(redirectTo?: string) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        prompt: 'select_account', // 로그아웃 후 다른 구글 계정 선택 가능
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function signInWithMagicLink(email: string, redirectTo?: string) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function deleteUserAccount() {
  console.log('[supabase] deleteUserAccount 진입');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    console.error('[supabase] deleteUserAccount - session 없음');
    throw new Error('로그인이 필요합니다.');
  }
  console.log('[supabase] fetch start - delete-user Edge Function 호출 직전', {
    url: `${supabaseUrl}/functions/v1/delete-user`,
    hasAccessToken: !!session.access_token,
  });

  const { data, error } = await supabase.functions.invoke('delete-user', {
    body: { user_id: session.user.id },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  if (error) {
    console.error('[supabase] delete-user invoke error:', error);
    throw error;
  }
  if (data?.error) {
    console.error('[supabase] delete-user data.error:', data.error);
    throw new Error(data.error);
  }
  console.log('[supabase] delete-user 성공');
  return data;
}

// ---------------------------------------------------------------------------
// User Profile Functions
// ---------------------------------------------------------------------------

const USER_PROFILE_SELECT = 'id, address, username, avatar_url, provider, created_at';

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select(USER_PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as UserProfile | null;
}

/** address(메일 주소)로 프로필 조회 — 유저 판별용 (중복 시 첫 행 반환) */
export async function getUserProfileByAddress(address: string): Promise<UserProfile | null> {
  if (!address?.trim()) return null;
  const { data, error } = await supabase
    .from('user_profiles')
    .select(USER_PROFILE_SELECT)
    .eq('address', address.trim())
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as UserProfile | null;
}

export async function upsertUserProfile(
  userId: string,
  updates: { address?: string; username?: string; avatar_url?: string; provider?: string }
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert({
      id: userId,
      ...updates,
    })
    .select(USER_PROFILE_SELECT)
    .single();
  if (error) throw error;
  return data as UserProfile;
}

export async function updateUserProfile(
  userId: string,
  updates: { username?: string; avatar_url?: string }
): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', userId);
  if (error) throw error;
}

const AVATARS_BUCKET = 'avatars';

/** 프로필 이미지를 Supabase Storage에 업로드하고 public URL 반환
 * Supabase 대시보드에서 'avatars' 버킷을 생성하고 public 접근을 허용해주세요.
 */
export async function uploadAvatar(userId: string, uri: string): Promise<string> {
  const fileName = `${userId}/${Date.now()}.jpg`;

  const response = await fetch(uri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(fileName, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

// ---------------------------------------------------------------------------
// User Settings Functions
// ---------------------------------------------------------------------------

export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('id, user_id, learning_language, notification_enabled, updated_at')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as UserSettings | null;
}

/** 로그인 시 user_settings가 없으면 기본값으로 생성 */
export async function ensureUserSettings(userId: string): Promise<UserSettings> {
  const existing = await getUserSettings(userId);
  if (existing) return existing;
  return upsertUserSettings(userId, {
    learning_language: 'ko',
    notification_enabled: true,
  });
}

/** 신규 유저 초기 데이터 생성: user_settings, bookmark_folders(기본 폴더), user_progress는 학습 시 자동 생성 */
export async function ensureNewUserData(userId: string): Promise<void> {
  await ensureUserSettings(userId);
  await ensureDefaultFolder(userId);
}

export async function upsertUserSettings(
  userId: string,
  updates: { learning_language?: string; notification_enabled?: boolean }
): Promise<UserSettings> {
  // First check if settings exist
  const existing = await getUserSettings(userId);
  
  if (existing) {
    const { error } = await supabase
      .from('user_settings')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    if (error) throw error;
    const updated = await getUserSettings(userId);
    if (!updated) throw new Error('Failed to fetch updated settings');
    return updated;
  } else {
    const { data, error } = await supabase
      .from('user_settings')
      .insert({
        user_id: userId,
        learning_language: updates.learning_language ?? 'ko',
        notification_enabled: updates.notification_enabled ?? true,
      })
      .select('id, user_id, learning_language, notification_enabled, updated_at')
      .single();
    if (error) throw error;
    return data as UserSettings;
  }
}

// ---------------------------------------------------------------------------
// User Progress Functions
// ---------------------------------------------------------------------------

export async function getUserProgressList(userId: string): Promise<UserProgress[]> {
  const { data, error } = await supabase
    .from('user_progress')
    .select('id, user_id, day, last_card_index, updated_at')
    .eq('user_id', userId)
    .order('day');
  if (error) throw error;
  return (data ?? []) as UserProgress[];
}

/** Day 학습/퀴즈 완료 시 user_progress에 저장 (로그인 사용자만) */
export async function upsertUserProgress(
  userId: string,
  day: number,
  lastCardIndex: number
): Promise<void> {
  const { data: existing } = await supabase
    .from('user_progress')
    .select('id')
    .eq('user_id', userId)
    .eq('day', day)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from('user_progress')
      .update({
        last_card_index: lastCardIndex,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('day', day);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('user_progress').insert({
      user_id: userId,
      day,
      last_card_index: lastCardIndex,
    });
    if (error) throw error;
  }
}

/** test_quizzes에서 주차별 모의고사가 존재하는 week_num 목록 반환 (응시 가능한 주차 수) */
export async function getWeeklyQuizAttempts(userId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('test_quizzes')
    .select('week_num')
    .eq('type', 'weekly_mock_light')
    .not('week_num', 'is', null);
  if (error) throw error;
  return [...new Set((data ?? []).map((d) => d.week_num as number))].sort((a, b) => a - b);
}

export type WeeklyQuizItem = {
  week_num: number;
  created_at: string | null;
};

/** DB에 저장된 모든 주차별 모의고사 목록 (최신순) */
export async function listAvailableWeeklyQuizzes(): Promise<WeeklyQuizItem[]> {
  const { data, error } = await supabase
    .from('test_quizzes')
    .select('week_num, created_at')
    .eq('type', WEEKLY_MOCK_TYPE)
    .not('week_num', 'is', null)
    .order('week_num', { ascending: false });
  if (error) throw error;
  const seen = new Set<number>();
  return (data ?? [])
    .filter((d) => {
      const w = d.week_num as number;
      if (w == null || seen.has(w)) return false;
      seen.add(w);
      return true;
    })
    .map((d) => ({ week_num: d.week_num as number, created_at: d.created_at ?? null }));
}

export async function ensureDefaultFolder(userId: string | null): Promise<string> {
  if (userId === null) {
    const folders = await getGuestFolders();
    const existing = folders.find((f) => f.name === DEFAULT_FOLDER_NAME);
    if (existing) return existing.id;
    const newFolder: GuestFolder = {
      id: genId(),
      name: DEFAULT_FOLDER_NAME,
      order_index: folders.length,
    };
    await setGuestFolders([...folders, newFolder]);
    return newFolder.id;
  }
  const { data: existing } = await supabase
    .from('bookmark_folders')
    .select('id')
    .eq('user_id', userId)
    .eq('name', DEFAULT_FOLDER_NAME)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const maxOrder = await supabase
    .from('bookmark_folders')
    .select('order_index')
    .eq('user_id', userId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle();

  const orderIndex = (maxOrder?.data?.order_index ?? -1) + 1;
  const { data: created, error } = await supabase
    .from('bookmark_folders')
    .insert({ user_id: userId, name: DEFAULT_FOLDER_NAME, order_index: orderIndex })
    .select('id')
    .single();
  if (error) throw error;
  return created.id;
}

export async function migrateNullFolderBookmarks(userId: string | null): Promise<void> {
  if (userId === null) {
    const defaultFolderId = await ensureDefaultFolder(null);
    const bookmarks = await getGuestBookmarks();
    const updated = bookmarks.map((b) =>
      b.folder_id === '' ? { ...b, folder_id: defaultFolderId } : b
    );
    if (updated.some((b, i) => b.folder_id !== bookmarks[i].folder_id)) {
      await setGuestBookmarks(updated);
    }
    return;
  }
  const defaultFolderId = await ensureDefaultFolder(userId);
  await supabase
    .from('bookmarks')
    .update({ folder_id: defaultFolderId })
    .eq('user_id', userId)
    .is('folder_id', null);
}

export async function listFolders(userId: string | null): Promise<BookmarkFolder[]> {
  if (userId === null) {
    const folders = await getGuestFolders();
    return folders.map((f) => ({
      id: f.id,
      user_id: '',
      name: f.name,
      order_index: f.order_index,
      created_at: '',
    }));
  }
  const { data, error } = await supabase
    .from('bookmark_folders')
    .select('id, user_id, name, order_index, created_at')
    .eq('user_id', userId)
    .order('order_index');
  if (error) throw error;
  return (data ?? []) as BookmarkFolder[];
}

export async function getFolder(userId: string | null, folderId: string): Promise<BookmarkFolder | null> {
  if (userId === null) {
    const folders = await getGuestFolders();
    const f = folders.find((x) => x.id === folderId);
    return f ? { id: f.id, user_id: '', name: f.name, order_index: f.order_index, created_at: '' } : null;
  }
  const { data, error } = await supabase
    .from('bookmark_folders')
    .select('id, user_id, name, order_index, created_at')
    .eq('user_id', userId)
    .eq('id', folderId)
    .maybeSingle();
  if (error) throw error;
  return data as BookmarkFolder | null;
}

export async function createFolder(userId: string | null, name: string): Promise<BookmarkFolder> {
  if (userId === null) {
    const folders = await getGuestFolders();
    const orderIndex = folders.length;
    const newFolder: GuestFolder = { id: genId(), name: name.trim(), order_index: orderIndex };
    await setGuestFolders([...folders, newFolder]);
    return { id: newFolder.id, user_id: '', name: newFolder.name, order_index: newFolder.order_index, created_at: '' };
  }
  const { data: maxOrder } = await supabase
    .from('bookmark_folders')
    .select('order_index')
    .eq('user_id', userId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle();

  const orderIndex = ((maxOrder as { order_index?: number } | null)?.order_index ?? -1) + 1;
  const { data, error } = await supabase
    .from('bookmark_folders')
    .insert({ user_id: userId, name: name.trim(), order_index: orderIndex })
    .select()
    .single();
  if (error) throw error;
  return data as BookmarkFolder;
}

export async function updateFolder(userId: string | null, folderId: string, name: string): Promise<void> {
  if (userId === null) {
    const folders = await getGuestFolders();
    const idx = folders.findIndex((f) => f.id === folderId);
    if (idx === -1 || folders[idx].name === DEFAULT_FOLDER_NAME) return;
    const next = [...folders];
    next[idx] = { ...next[idx], name: name.trim() };
    await setGuestFolders(next);
    return;
  }
  const { data: folder } = await supabase
    .from('bookmark_folders')
    .select('name')
    .eq('id', folderId)
    .eq('user_id', userId)
    .single();
  if (folder?.name === DEFAULT_FOLDER_NAME) return;

  const { error } = await supabase
    .from('bookmark_folders')
    .update({ name: name.trim() })
    .eq('id', folderId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function deleteFolder(userId: string | null, folderId: string): Promise<void> {
  if (userId === null) {
    const folders = await getGuestFolders();
    const f = folders.find((x) => x.id === folderId);
    if (!f || f.name === DEFAULT_FOLDER_NAME) return;
    const defaultFolderId = await ensureDefaultFolder(null);
    const bookmarks = await getGuestBookmarks();
    const defaultWordIds = new Set(
      bookmarks.filter((b) => b.folder_id === defaultFolderId).map((b) => b.word_id)
    );
    const toKeep = bookmarks.filter((b) => b.folder_id !== folderId);
    const toMove = bookmarks.filter((b) => b.folder_id === folderId);
    for (const b of toMove) {
      if (!defaultWordIds.has(b.word_id)) {
        toKeep.push({ ...b, folder_id: defaultFolderId });
        defaultWordIds.add(b.word_id);
      }
    }
    await setGuestBookmarks(toKeep);
    await setGuestFolders(folders.filter((x) => x.id !== folderId));
    return;
  }
  const { data: folder } = await supabase
    .from('bookmark_folders')
    .select('name')
    .eq('id', folderId)
    .eq('user_id', userId)
    .single();
  if (folder?.name === DEFAULT_FOLDER_NAME) return;

  const defaultFolderId = await ensureDefaultFolder(userId);
  const { data: inDefault } = await supabase
    .from('bookmarks')
    .select('word_id')
    .eq('user_id', userId)
    .eq('folder_id', defaultFolderId);
  const defaultWordIds = new Set((inDefault ?? []).map((r) => r.word_id));

  const { data: toMoveRows } = await supabase
    .from('bookmarks')
    .select('id, word_id')
    .eq('user_id', userId)
    .eq('folder_id', folderId);

  for (const row of toMoveRows ?? []) {
    if (defaultWordIds.has(row.word_id)) {
      await supabase.from('bookmarks').delete().eq('id', row.id).eq('user_id', userId);
    } else {
      await supabase
        .from('bookmarks')
        .update({ folder_id: defaultFolderId })
        .eq('id', row.id)
        .eq('user_id', userId);
      defaultWordIds.add(row.word_id);
    }
  }

  const { error } = await supabase
    .from('bookmark_folders')
    .delete()
    .eq('id', folderId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function getBookmarkedWordIds(userId: string | null): Promise<string[]> {
  if (userId === null) {
    const bookmarks = await getGuestBookmarks();
    return [...new Set(bookmarks.map((b) => b.word_id))];
  }
  const { data, error } = await supabase
    .from('bookmarks')
    .select('word_id')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.word_id);
}

export async function getBookmarkedWordIdsInDefaultFolder(userId: string | null): Promise<string[]> {
  if (userId === null) {
    const defaultFolderId = await ensureDefaultFolder(null);
    const bookmarks = await getGuestBookmarks();
    return bookmarks.filter((b) => b.folder_id === defaultFolderId).map((b) => b.word_id);
  }
  const defaultFolderId = await ensureDefaultFolder(userId);
  const { data, error } = await supabase
    .from('bookmarks')
    .select('word_id')
    .eq('user_id', userId)
    .eq('folder_id', defaultFolderId);
  if (error) throw error;
  return (data ?? []).map((r) => r.word_id);
}

export async function listBookmarksByFolder(userId: string | null, folderId: string): Promise<Bookmark[]> {
  if (userId === null) {
    const bookmarks = await getGuestBookmarks();
    return bookmarks
      .filter((b) => b.folder_id === folderId)
      .map((b) => ({ id: b.id, user_id: '', word_id: b.word_id, folder_id: b.folder_id, created_at: '' }));
  }
  const { data, error } = await supabase
    .from('bookmarks')
    .select('id, user_id, word_id, folder_id, created_at')
    .eq('user_id', userId)
    .eq('folder_id', folderId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as Bookmark[];
}

async function hasBookmarkInFolder(userId: string | null, folderId: string, wordId: string): Promise<boolean> {
  if (userId === null) {
    const bookmarks = await getGuestBookmarks();
    return bookmarks.some((b) => b.folder_id === folderId && b.word_id === wordId);
  }
  const { data, error } = await supabase
    .from('bookmarks')
    .select('id')
    .eq('user_id', userId)
    .eq('folder_id', folderId)
    .eq('word_id', wordId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return !!data?.id;
}

export async function addBookmark(userId: string | null, wordId: string, folderId?: string | null): Promise<void> {
  const targetFolderId = folderId ?? (await ensureDefaultFolder(userId));
  const exists = await hasBookmarkInFolder(userId, targetFolderId, wordId);
  if (exists) return;

  if (userId === null) {
    const bookmarks = await getGuestBookmarks();
    await setGuestBookmarks([...bookmarks, { id: genId(), word_id: wordId, folder_id: targetFolderId }]);
    return;
  }
  const { error } = await supabase
    .from('bookmarks')
    .insert({ user_id: userId, word_id: wordId, folder_id: targetFolderId });
  if (error) throw error;
}

export async function removeBookmark(userId: string | null, bookmarkId: string): Promise<void> {
  if (userId === null) {
    const bookmarks = await getGuestBookmarks();
    await setGuestBookmarks(bookmarks.filter((b) => b.id !== bookmarkId));
    return;
  }
  const { error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('id', bookmarkId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function removeBookmarkByWordAndFolder(userId: string | null, wordId: string, folderId: string): Promise<void> {
  if (userId === null) {
    const bookmarks = await getGuestBookmarks();
    await setGuestBookmarks(bookmarks.filter((b) => !(b.word_id === wordId && b.folder_id === folderId)));
    return;
  }
  const { error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('user_id', userId)
    .eq('word_id', wordId)
    .eq('folder_id', folderId);
  if (error) throw error;
}

export async function isWordBookmarkedInDefaultFolder(userId: string | null, wordId: string): Promise<boolean> {
  const defaultFolderId = await ensureDefaultFolder(userId);
  return hasBookmarkInFolder(userId, defaultFolderId, wordId);
}

export async function removeBookmarkFromDefaultFolder(userId: string | null, wordId: string): Promise<void> {
  const defaultFolderId = await ensureDefaultFolder(userId);
  await removeBookmarkByWordAndFolder(userId, wordId, defaultFolderId);
}

export async function removeBookmarkByWord(userId: string | null, wordId: string): Promise<void> {
  if (userId === null) {
    const bookmarks = await getGuestBookmarks();
    await setGuestBookmarks(bookmarks.filter((b) => b.word_id !== wordId));
    return;
  }
  const { error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('user_id', userId)
    .eq('word_id', wordId);
  if (error) throw error;
}

export async function moveBookmark(userId: string | null, bookmarkId: string, targetFolderId: string): Promise<void> {
  if (userId === null) {
    const bookmarks = await getGuestBookmarks();
    const row = bookmarks.find((b) => b.id === bookmarkId);
    if (!row) return;
    const alreadyInTarget = await hasBookmarkInFolder(null, targetFolderId, row.word_id);
    if (alreadyInTarget) {
      await setGuestBookmarks(bookmarks.filter((b) => b.id !== bookmarkId));
      return;
    }
    await setGuestBookmarks(
      bookmarks.map((b) => (b.id === bookmarkId ? { ...b, folder_id: targetFolderId } : b))
    );
    return;
  }
  const { data: row, error: fetchErr } = await supabase
    .from('bookmarks')
    .select('word_id, folder_id')
    .eq('id', bookmarkId)
    .eq('user_id', userId)
    .single();
  if (fetchErr || !row) throw fetchErr ?? new Error('Bookmark not found');

  const alreadyInTarget = await hasBookmarkInFolder(userId, targetFolderId, row.word_id);
  if (alreadyInTarget) {
    await removeBookmark(userId, bookmarkId);
    return;
  }

  const { error } = await supabase
    .from('bookmarks')
    .update({ folder_id: targetFolderId })
    .eq('id', bookmarkId)
    .eq('user_id', userId);
  if (error) throw error;
}
