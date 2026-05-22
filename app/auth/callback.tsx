import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/lib/theme';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { initialized } = useAuth();

  useEffect(() => {
    if (initialized) {
      router.replace('/(tabs)/profile');
    }
  }, [initialized, router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
