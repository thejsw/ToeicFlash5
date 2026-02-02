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

/** words + word_contents(ko) 병합 결과 */
export type VocabularyWord = {
  id: string;
  day: number;
  word: string;
  example_en: string;
  order_index: number;
  meaning: string;
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

/** words + word_contents join 조회용 Row */
export type WordContentRow = {
  meaning: string;
  example_local: string;
  language: string;
};
export type WordRow = {
  id: string;
  day: number;
  word: string;
  example_en: string;
  order_index: number;
  word_contents: WordContentRow[] | null;
};

export function mergeWordWithContent(
  row: WordRow,
  lang = 'ko'
): VocabularyWord | null {
  const contents = row.word_contents ?? [];
  const content = contents.find((c) => c.language === lang) ?? contents[0];
  if (!content) return null;
  return {
    id: row.id,
    day: row.day,
    word: row.word,
    example_en: row.example_en ?? '',
    order_index: row.order_index,
    meaning: content.meaning ?? '',
    example_local: content.example_local ?? '',
  };
}
