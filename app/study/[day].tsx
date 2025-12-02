import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase, VocabularyWord } from '@/lib/supabase';
import FlipCard from '@/components/FlipCard';
import AdBanner from '@/components/AdBanner';
import { ChevronLeft, ChevronRight, Star, Moon, Sun } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/lib/theme';

const { width } = Dimensions.get('window');

export default function StudyScreen() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const router = useRouter();
  const { colors, theme, toggleTheme } = useTheme();
  const flatListRef = useRef<FlatList>(null);

  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  // 프로그레스 바 실제 너비 (onLayout으로 측정)
  const [progressBarWidth, setProgressBarWidth] = useState(width - 40);
  // 키보드(F 키)로 플립을 트리거하기 위한 신호 값 (증가할 때마다 한 번 플립)
  const [flipSignal, setFlipSignal] = useState(0);

  const goHome = () => {
    // 항상 홈(탭의 메인 화면)으로 이동
    router.push('/(tabs)');
  };

  useEffect(() => {
    loadWords();
    loadBookmarks();
  }, [day]);

  useEffect(() => {
    saveProgress();
  }, [currentIndex]);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        // 키보드로 이동 시에는 애니메이션 없이 즉시 이동
        handlePrevious(false);
      } else if (event.key === 'ArrowRight') {
        handleNext(false);
      } else if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        flipCard();
      } else if (event.key === 'v' || event.key === 'V') {
        event.preventDefault();
        toggleBookmark();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex, words, bookmarkedIds]);

  const loadWords = async () => {
    try {
      const { data, error } = await supabase
        .from('vocabulary_words')
        .select('*')
        .eq('day', parseInt(day))
        .order('order_index');

      if (error) throw error;

      setWords(data || []);

      const savedIndex = await AsyncStorage.getItem(`progress_day_${day}`);
      if (savedIndex) {
        const index = parseInt(savedIndex);
        setCurrentIndex(index);
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index, animated: false });
        }, 100);
      }
    } catch (error) {
      console.error('Error loading words:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBookmarks = async () => {
    try {
      const bookmarksJson = await AsyncStorage.getItem('bookmarks');
      if (bookmarksJson) {
        const bookmarks = JSON.parse(bookmarksJson);
        setBookmarkedIds(new Set(bookmarks));
      }
    } catch (error) {
      console.error('Error loading bookmarks:', error);
    }
  };

  const saveProgress = async () => {
    try {
      await AsyncStorage.setItem(`progress_day_${day}`, currentIndex.toString());
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  const toggleBookmark = async () => {
    if (words.length === 0) return;

    const wordId = words[currentIndex].id;
    const newBookmarkedIds = new Set(bookmarkedIds);

    if (newBookmarkedIds.has(wordId)) {
      newBookmarkedIds.delete(wordId);
    } else {
      newBookmarkedIds.add(wordId);
    }

    setBookmarkedIds(newBookmarkedIds);

    try {
      await AsyncStorage.setItem(
        'bookmarks',
        JSON.stringify(Array.from(newBookmarkedIds))
      );
    } catch (error) {
      console.error('Error saving bookmark:', error);
    }
  };

  const flipCard = () => {
    // flipSignal을 증가시켜 현재 활성 카드만 한 번 뒤집히도록 신호 보냄
    setFlipSignal((prev) => prev + 1);
  };

  const handlePrevious = (animated: boolean = true) => {
    setCurrentIndex((prev) => {
      if (prev <= 0) return prev;
      const newIndex = prev - 1;
      flatListRef.current?.scrollToIndex({ index: newIndex, animated });
      return newIndex;
    });
  };

  const handleNext = (animated: boolean = true) => {
    setCurrentIndex((prev) => {
      if (prev >= words.length - 1) return prev;
      const newIndex = prev + 1;
      flatListRef.current?.scrollToIndex({ index: newIndex, animated });
      return newIndex;
    });
  };

  const handleProgressBarPress = (event: any) => {
    if (!words.length) return;

    const barWidth = progressBarWidth > 0 ? progressBarWidth : width - 40;

    const nativeEvent = event?.nativeEvent ?? event;
    const rawX =
      nativeEvent?.locationX ??
      nativeEvent?.pageX ??
      nativeEvent?.offsetX ??
      nativeEvent?.x;

    if (typeof rawX !== 'number' || !Number.isFinite(rawX)) {
      return;
    }

    const clampedX = Math.max(0, Math.min(rawX, barWidth));
    const percentage = clampedX / barWidth;

    // 10단어(10페이지) 단위로 끊어서 대략적인 위치로 이동
    const approxIndex = Math.floor(percentage * words.length);
    const blockSize = 10;
    const blockIndex = Math.floor(approxIndex / blockSize);
    const coarseIndex = blockIndex * blockSize;

    const clampedIndex = Math.max(
      0,
      Math.min(coarseIndex, words.length - 1)
    );

    if (!Number.isFinite(clampedIndex)) return;

    setCurrentIndex(clampedIndex);
    flatListRef.current?.scrollToIndex({ index: clampedIndex, animated: false });
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const currentWord = words[currentIndex];
  const isBookmarked = currentWord && bookmarkedIds.has(currentWord.id);
  const progressPercent =
    words.length > 0 ? ((currentIndex + 1) / words.length) * 100 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={goHome} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Day {day}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={toggleTheme} style={styles.themeButton}>
            {theme === 'light' ? (
              <Moon size={20} color={colors.text} />
            ) : (
              <Sun size={20} color={colors.text} />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleBookmark} style={styles.bookmarkButton}>
            <Star
              size={24}
              color={isBookmarked ? colors.bookmark : colors.bookmarkEmpty}
              fill={isBookmarked ? colors.bookmark : 'none'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.progressContainer, { backgroundColor: colors.surface }]}>
        <Text style={[styles.progressText, { color: colors.textSecondary }]}>
          {currentIndex + 1} / {words.length}
        </Text>
        <TouchableOpacity
          style={[styles.progressBar, { backgroundColor: colors.border }]}
          onPress={handleProgressBarPress}
          activeOpacity={0.7}
          onLayout={(e) => setProgressBarWidth(e.nativeEvent.layout.width)}
          disabled={!words.length}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progressPercent}%`,
                backgroundColor: colors.primary,
              },
            ]}
          />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={words}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item, index }) => (
          <FlipCard
            word={item}
            isActive={index === currentIndex}
            flipSignal={flipSignal}
          />
        )}
        keyExtractor={(item) => item.id}
        getItemLayout={(data, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
      />

      <View style={[styles.navigation, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
          onPress={() => handlePrevious(true)}
          disabled={currentIndex === 0}>
          <ChevronLeft
            size={24}
            color={currentIndex === 0 ? colors.bookmarkEmpty : colors.text}
          />
          <Text
            style={[
              styles.navText,
              {
                color: currentIndex === 0 ? colors.bookmarkEmpty : colors.text,
              },
            ]}>
            Previous
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navButton,
            currentIndex === words.length - 1 && styles.navButtonDisabled,
          ]}
          onPress={() => handleNext(true)}
          disabled={currentIndex === words.length - 1}>
          <Text
            style={[
              styles.navText,
              {
                color: currentIndex === words.length - 1 ? colors.bookmarkEmpty : colors.text,
              },
            ]}>
            Next
          </Text>
          <ChevronRight
            size={24}
            color={currentIndex === words.length - 1 ? colors.bookmarkEmpty : colors.text}
          />
        </TouchableOpacity>
      </View>

      <AdBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  themeButton: {
    padding: 8,
  },
  bookmarkButton: {
    padding: 8,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  progressText: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
