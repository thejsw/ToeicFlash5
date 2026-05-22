import { Tabs, useRouter, useSegments } from 'expo-router';
import { Home, Bookmark, ClipboardList, User } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
<<<<<<< HEAD
import { useSafeAreaInsets } from 'react-native-safe-area-context';
=======
>>>>>>> ab247db19aef375cf71ff64e670f0ad175e55db5

export default function TabLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 0);
  const isBookmarkStudyScreen =
    (segments as string[]).includes('bookmarks') &&
    (segments as string[]).includes('[folderId]');

  // 프로필 탭 클릭 시 설정 화면에 있으면 프로필 인덱스로 이동 (설정 오류 후 프로필 진입 불가 방지)
  const handleProfileTabPress = useCallback(() => {
    if ((segments as string[]).includes('settings')) {
      router.replace('/(tabs)/profile');
    }
  }, [segments, router]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: isBookmarkStudyScreen
          ? { display: 'none' }
          : {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              height: 50 + bottomInset,
              paddingBottom: bottomInset,
            },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ size, color }) => (
            <Home size={size} {...({ color } as object)} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookmarks"
        options={{
          title: t('tabs.bookmarks'),
          tabBarIcon: ({ size, color }) => (
            <Bookmark size={size} {...({ color } as object)} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ size, color }) => (
            <User size={size} {...({ color } as object)} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            if ((segments as string[]).includes('settings')) {
              e.preventDefault();
              router.replace('/(tabs)/profile');
            }
          },
        }}
      />
      <Tabs.Screen
        name="testTab"
        options={{
          title: t('tabs.test'),
          tabBarIcon: ({ size, color }) => (
            <ClipboardList size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
