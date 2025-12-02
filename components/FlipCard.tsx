import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { VocabularyWord } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;

type FlipCardProps = {
  word: VocabularyWord;
  onFlip?: (isFlipped: boolean) => void;
};

export default function FlipCard({ word, onFlip }: FlipCardProps) {
  const { colors } = useTheme();
  const [isFlipped, setIsFlipped] = useState(false);
  const rotation = useSharedValue(0);

  const handleFlip = () => {
    rotation.value = withTiming(isFlipped ? 0 : 180, { duration: 300 });
    const newFlippedState = !isFlipped;
    setIsFlipped(newFlippedState);
    onFlip?.(newFlippedState);
  };

  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateValue = interpolate(rotation.value, [0, 180], [0, 180]);
    return {
      transform: [{ rotateY: `${rotateValue}deg` }],
      backfaceVisibility: 'hidden',
    };
  });

  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateValue = interpolate(rotation.value, [0, 180], [180, 360]);
    return {
      transform: [{ rotateY: `${rotateValue}deg` }],
      backfaceVisibility: 'hidden',
    };
  });

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handleFlip}
      activeOpacity={0.9}>
      <Animated.View
        style={[
          styles.card,
          styles.front,
          frontAnimatedStyle,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: colors.text,
          },
        ]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          English
        </Text>
        <Text style={[styles.word, { color: colors.text }]}>{word.word}</Text>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          Tap to see meaning
        </Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.card,
          styles.back,
          backAnimatedStyle,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: colors.text,
          },
        ]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Korean
        </Text>
        <Text style={[styles.meaning, { color: colors.primary }]}>
          {word.meaning}
        </Text>
        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
        <Text style={[styles.exampleLabel, { color: colors.textSecondary }]}>
          Example
        </Text>
        <Text style={[styles.example, { color: colors.text }]}>
          {word.example}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    height: 450,
    marginHorizontal: 20,
  },
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 20,
    padding: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 2,
  },
  front: {
    zIndex: 1,
  },
  back: {
    zIndex: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 20,
  },
  word: {
    fontSize: 42,
    fontWeight: '700',
    textAlign: 'center',
  },
  hint: {
    position: 'absolute',
    bottom: 30,
    fontSize: 14,
    fontStyle: 'italic',
  },
  meaning: {
    fontSize: 32,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 30,
  },
  divider: {
    width: '80%',
    height: 1,
    marginVertical: 20,
  },
  exampleLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  example: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});
