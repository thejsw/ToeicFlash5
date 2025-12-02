import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/lib/theme';

export default function AdBanner() {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderTopColor: colors.border },
      ]}>
      <Text style={[styles.text, { color: colors.textSecondary }]}>
        Google AdMob Ad Space
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 50,
    borderTopWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
});
