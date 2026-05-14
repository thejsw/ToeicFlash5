import i18n from 'i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { initReactI18next } from 'react-i18next';
import koCommon from '@/locales/ko/common.json';
import jaCommon from '@/locales/ja/common.json';
import { AppI18nLanguage, learningLanguageToI18nLng } from '@/lib/locale';

export const I18N_LANGUAGE_STORAGE_KEY = 'i18n_language';
export const SUPPORTED_I18N_LANGUAGES = ['ko', 'ja'] as const;

void i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  resources: {
    ko: { common: koCommon },
    ja: { common: jaCommon },
  },
  lng: 'ko',
  fallbackLng: 'ko',
  defaultNS: 'common',
  ns: ['common'],
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

function isSupportedI18nLanguage(value: string | null | undefined): value is AppI18nLanguage {
  return value === 'ko' || value === 'ja';
}

export function detectDeviceI18nLanguage(): AppI18nLanguage | null {
  const locales = Localization.getLocales();

  for (const locale of locales) {
    const languageCode = locale.languageCode?.toLowerCase();
    if (languageCode === 'ko' || languageCode === 'ja') {
      return languageCode;
    }
  }

  return null;
}

export async function getStoredI18nLanguage(): Promise<AppI18nLanguage | null> {
  try {
    const savedLanguage = await AsyncStorage.getItem(I18N_LANGUAGE_STORAGE_KEY);
    return isSupportedI18nLanguage(savedLanguage) ? savedLanguage : null;
  } catch (error) {
    console.warn('[i18n] Failed to read saved language:', error);
    return null;
  }
}

export async function persistI18nLanguage(lng: AppI18nLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(I18N_LANGUAGE_STORAGE_KEY, lng);
  } catch (error) {
    console.warn('[i18n] Failed to persist language:', error);
  }
}

export async function resolveInitialI18nLanguage(
  learningLanguage?: string | null
): Promise<AppI18nLanguage> {
  if (learningLanguage) {
    return learningLanguageToI18nLng(learningLanguage);
  }

  const savedLanguage = await getStoredI18nLanguage();
  if (savedLanguage) {
    return savedLanguage;
  }

  return detectDeviceI18nLanguage() ?? 'ko';
}

export async function applyResolvedI18nLanguage(learningLanguage?: string | null): Promise<AppI18nLanguage> {
  const lng = await resolveInitialI18nLanguage(learningLanguage);
  await i18n.changeLanguage(lng);
  await persistI18nLanguage(lng);
  return lng;
}

export function syncI18nLanguageFromLearningLanguage(learningLanguage: string | null | undefined): void {
  const lng = learningLanguageToI18nLng(learningLanguage);
  void i18n.changeLanguage(lng);
  void persistI18nLanguage(lng);
}

export default i18n;
