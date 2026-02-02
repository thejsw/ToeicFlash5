import { useState, useEffect, useRef } from 'react';
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
  /** 외부에서 플립을 트리거하기 위한 신호 값 (변할 때마다 한 번 뒤집힘) */
  flipSignal?: number;
  /** 현재 화면에서 활성 카드인지 여부 (true일 때만 flipSignal에 반응) */
  isActive?: boolean;
};

export default function FlipCard({ word, onFlip, flipSignal, isActive }: FlipCardProps) {
  const { colors } = useTheme();
  const [isFlipped, setIsFlipped] = useState(false);
  const rotation = useSharedValue(0);
  const prevFlipSignalRef = useRef<number | undefined>(undefined);
  const isFirstMount = useRef(true);

  const handleFlip = () => {
    rotation.value = withTiming(isFlipped ? 0 : 180, { duration: 300 });
    const newFlippedState = !isFlipped;
    setIsFlipped(newFlippedState);
    onFlip?.(newFlippedState);
  };

  // 부모에서 flipSignal을 변경하면, "그 시점에 활성인" 카드만 한 번 플립
  useEffect(() => {
    if (flipSignal === undefined) return;
    if (!isActive) return;
    
    // 첫 마운트 시에는 flip하지 않음
    if (isFirstMount.current) {
      isFirstMount.current = false;
      prevFlipSignalRef.current = flipSignal;
      return;
    }
    
    // flipSignal이 실제로 변경되었을 때만 flip
    if (prevFlipSignalRef.current !== flipSignal) {
      prevFlipSignalRef.current = flipSignal;
      handleFlip();
    }
  }, [flipSignal, isActive]);

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
          {word.example_local}
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
