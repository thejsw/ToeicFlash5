import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import 'react-native-url-polyfill/auto';

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

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

export async function fetchQuizByDay(dayNum: number): Promise<DayQuizQuestion[]> {
  const { data: quizData, error: quizError } = await supabase
    .from('quizzes')
    .select('id')
    .eq('day_num', dayNum)
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
