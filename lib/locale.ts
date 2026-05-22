import { normalizeWordContentLanguageKey } from '@/lib/supabase';

/** i18n 리소스 폴더(ko/ja)와 일치하는 UI 언어 코드 */
export type AppI18nLanguage = 'ko' | 'ja';

export function learningLanguageToI18nLng(learningLanguage: string | null | undefined): AppI18nLanguage {
  const key = normalizeWordContentLanguageKey(learningLanguage ?? '') || 'ko';
  return key === 'ja' ? 'ja' : 'ko';
}
