import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import koCommon from '@/locales/ko/common.json';
import jaCommon from '@/locales/ja/common.json';
import { learningLanguageToI18nLng } from '@/lib/locale';

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

export function syncI18nLanguageFromLearningLanguage(learningLanguage: string | null | undefined): void {
  const lng = learningLanguageToI18nLng(learningLanguage);
  void i18n.changeLanguage(lng);
}

export default i18n;
