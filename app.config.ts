import type { ExpoConfig } from 'expo/config';

try {
  require('dotenv/config');
} catch {
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
    bundleIdentifier: 'com.thejsw.toeicflashcardvoca',
  },
  android: {
    package: 'com.thejsw.toeicflashcardvoca',
    versionCode: 19,
    adaptiveIcon: {
      foregroundImage: './assets/images/Flash5Icon.png',
      backgroundColor: '#ffffff',
    },
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/images/Flash5Icon.png',
  },
  plugins: ['expo-router', 'expo-font', 'expo-web-browser'],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {
      projectId: '62c17608-5381-44d9-acbc-3f4c7166205f',
    },
  },
};

export default config;


