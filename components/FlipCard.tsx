import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, ScrollView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { VocabularyWord } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { useTranslation } from 'react-i18next';

const MAX_CARD_WIDTH = 420;
/** 이 값 미만이면 모바일로 간주하고 MAX_CARD_WIDTH 적용 */
const MOBILE_BREAKPOINT = 768;

type FlipCardProps = {
  word: VocabularyWord;
  meaningLabel?: string;
  exampleEnLabel?: string;
  /** 번역 예문 섹션 제목 (학습 언어에 맞게, 예: 예문 (한국어)) */
  localExampleLabel?: string;
  onFlip?: (isFlipped: boolean) => void;
  /** 외부에서 플립을 트리거하기 위한 신호 값 (변할 때마다 한 번 뒤집힘) */
  flipSignal?: number;
  /** 현재 화면에서 활성 카드인지 여부 (true일 때만 flipSignal에 반응) */
  isActive?: boolean;
  maxHeight?: number;
};

/** 헤더·프로그레스·네비·광고·마진 제외한 카드 높이용 여백 */
const DESKTOP_VERTICAL_RESERVE = 260;
const MOBILE_MIN_CARD_HEIGHT = 220;
const DESKTOP_MIN_CARD_HEIGHT = 280;
const MAX_CARD_HEIGHT = 560;
/** 카드 상하 마진(하단 네비와 겹치지 않도록) */
const CARD_MARGIN_VERTICAL = 10;

export default function FlipCard({
  word,
  meaningLabel,
  exampleEnLabel,
  localExampleLabel,
  onFlip,
  flipSignal,
  isActive,
  maxHeight,
}: FlipCardProps) {
  const { t } = useTranslation();
  const resolvedMeaning = meaningLabel ?? t('flashcard.meaning');
  const resolvedExampleEn = exampleEnLabel ?? t('flashcard.exampleEn');
  const resolvedExampleLocal = localExampleLabel ?? t('flashcard.exampleLocal');
  const { width, height } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;
  const cardWidth = isMobile ? Math.min(width - 40, MAX_CARD_WIDTH) : width - 40;
  const minCardHeight = isMobile ? MOBILE_MIN_CARD_HEIGHT : DESKTOP_MIN_CARD_HEIGHT;
  const availableCardHeight = Math.max(
    160,
    typeof maxHeight === 'number' && Number.isFinite(maxHeight)
      ? maxHeight
      : height - DESKTOP_VERTICAL_RESERVE
  );
  const cardHeight = Math.max(
    Math.min(minCardHeight, availableCardHeight),
    Math.min(MAX_CARD_HEIGHT, availableCardHeight)
  );
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
      style={[
        styles.container,
        {
          width: cardWidth,
          height: cardHeight,
          maxHeight: '100%',
          marginVertical: CARD_MARGIN_VERTICAL,
        },
      ]}
      onPress={handleFlip}
      activeOpacity={0.9}>
      <Animated.View
        style={[
          styles.card,
          isMobile && styles.mobileCard,
          styles.front,
          frontAnimatedStyle,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: colors.text,
          },
        ]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('flashcard.english')}</Text>
        <Text style={[styles.word, isMobile && styles.mobileWord, { color: colors.text }]}>
          {word.word}
        </Text>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>{t('flashcard.tapHint')}</Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.card,
          isMobile && styles.mobileCard,
          styles.back,
          backAnimatedStyle,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: colors.text,
          },
        ]}
        collapsable={false}>
        <ScrollView
          style={styles.backScroll}
          contentContainerStyle={styles.backContent}
          showsVerticalScrollIndicator={false}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {resolvedMeaning}
          </Text>
          <Text style={[styles.meaning, isMobile && styles.mobileMeaning, { color: colors.primary }]}>
            {word.meaning || ' '}
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />
          <Text style={[styles.exampleLabel, { color: colors.textSecondary }]}>
            {resolvedExampleEn}
          </Text>
          <Text style={[styles.example, isMobile && styles.mobileExample, styles.exampleEn, { color: colors.text }]}>
            {word.example_en || ' '}
          </Text>
          <Text style={[styles.exampleLabel, { color: colors.textSecondary }]}>
            {resolvedExampleLocal}
          </Text>
          <Text style={[styles.example, isMobile && styles.mobileExample, { color: colors.text }]}>
            {word.example_local || ' '}
          </Text>
        </ScrollView>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
  } as const,
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
  mobileCard: {
    padding: 22,
    borderRadius: 18,
  },
  front: {
    zIndex: 1,
  },
  back: {
    zIndex: 0,
  },
  backScroll: {
    width: '100%',
  },
  backContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  mobileWord: {
    fontSize: 34,
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
    marginBottom: 12,
  },
  mobileMeaning: {
    fontSize: 26,
    marginBottom: 8,
  },
  divider: {
    width: '80%',
    height: 1,
    marginVertical: 12,
  },
  exampleLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  example: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  mobileExample: {
    fontSize: 14,
    lineHeight: 20,
  },
  exampleEn: {
    marginBottom: 20,
  },
});
