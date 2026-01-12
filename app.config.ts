import type { ExpoConfig } from 'expo/config';

// 로컬 개발 시 .env 파일 로드 (EAS 빌드에서는 eas.json의 env가 자동으로 process.env에 주입됨)
try {
  require('dotenv/config');
} catch {
  // dotenv가 없어도 EAS 빌드에서는 문제없음
}

const config: ExpoConfig = {
  name: 'Flash5 TOEIC',
  slug: 'bolt-expo-nativewind',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/Flash5Icon.png',
  scheme: 'myapp',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
  },
  android: {
    package: 'com.thejsw.toeicflashcardvoca',
    versionCode: 11,
    adaptiveIcon: {
      foregroundImage: './assets/images/icon.png',
      backgroundColor: '#ffffff',
    },
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: ['expo-router', 'expo-font', 'expo-web-browser'],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    // fallback용으로 extra에도 저장 (lib/supabase.ts와 lib/llm.ts에서 process.env가 없을 때 사용)
    // EAS 빌드: eas.json의 env → process.env → 여기서 extra로 복사 → lib/supabase.ts, lib/llm.ts에서 사용
    // 로컬 개발: .env → process.env → 여기서 extra로 복사 → lib/supabase.ts, lib/llm.ts에서 사용
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    openaiApiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
    eas: {
      projectId: '62c17608-5381-44d9-acbc-3f4c7166205f',
    },
  },
};

export default config;


