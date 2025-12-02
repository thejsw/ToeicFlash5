import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type VocabularyWord = {
  id: string;
  day: number;
  word: string;
  meaning: string;
  example: string;
  order_index: number;
  created_at: string;
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
