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
