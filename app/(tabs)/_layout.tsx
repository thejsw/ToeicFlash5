import { Tabs, useRouter, useSegments } from 'expo-router';
import { Home, Bookmark, ClipboardList, User } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';
import { useCallback } from 'react';

export default function TabLayout() {
  const { colors } = useTheme();
  const router = useRouter();
  const segments = useSegments();

  // 프로필 탭 클릭 시 설정 화면에 있으면 프로필 인덱스로 이동 (설정 오류 후 프로필 진입 불가 방지)
  const handleProfileTabPress = useCallback(() => {
    if (segments.includes('settings')) {
      router.replace('/(tabs)/profile');
    }
  }, [segments, router]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ size, color }) => (
            <Home size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="test"
        options={{
          title: '테스트',
          tabBarIcon: ({ size, color }) => (
            <ClipboardList size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookmarks"
        options={{
          title: '북마크',
          tabBarIcon: ({ size, color }) => (
            <Bookmark size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '프로필',
          tabBarIcon: ({ size, color }) => (
            <User size={size} color={color} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            if (segments.includes('settings')) {
              e.preventDefault();
              router.replace('/(tabs)/profile');
            }
          },
        }}
      />
    </Tabs>
  );
}
