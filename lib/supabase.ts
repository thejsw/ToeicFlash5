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

export type words = {
  id: string;
  day: number;
  word: string;
  example_en: string;
  order_index: number;
  word_contents: word_contents[];
};

export type word_contents = {
  id: string;
  word_id: string;
  language: string;
  meaning: string;
  example_local: string;
  order_index: number;
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
  created_at: string;
};
