import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { supabase, VocabularyWord } from '@/lib/supabase';
import FlipCard from '@/components/FlipCard';
import AdBanner from '@/components/AdBanner';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronLeft, ChevronRight, BookmarkX, Star, Moon, Sun } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';

const { width } = Dimensions.get('window');

export default function BookmarksScreen() {
  const { colors, theme, toggleTheme } = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadBookmarkedWords();
  }, []);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        handlePrevious();
      } else if (event.key === 'ArrowRight') {
        handleNext();
      } else if (event.key === ' ') {
        event.preventDefault();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        toggleCurrentBookmark();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex, words, bookmarkedIds]);

  const loadBookmarkedWords = async () => {
    try {
      const bookmarksJson = await AsyncStorage.getItem('bookmarks');
      if (!bookmarksJson) {
        setLoading(false);
        return;
      }

      const bookmarkIds = JSON.parse(bookmarksJson);
      if (bookmarkIds.length === 0) {
        setLoading(false);
        return;
      }

      setBookmarkedIds(new Set(bookmarkIds));

      const { data, error } = await supabase
        .from('vocabulary_words')
        .select('*')
        .in('id', bookmarkIds);

      if (error) throw error;

      const orderedWords = bookmarkIds
        .map((id: string) => data?.find((w) => w.id === id))
        .filter(Boolean);

      setWords(orderedWords);
    } catch (error) {
      console.error('Error loading bookmarked words:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCurrentBookmark = async () => {
    if (words.length === 0) return;

    const currentWord = words[currentIndex];
    const newBookmarkedIds = new Set(bookmarkedIds);

    if (newBookmarkedIds.has(currentWord.id)) {
      newBookmarkedIds.delete(currentWord.id);
    } else {
      newBookmarkedIds.add(currentWord.id);
    }

    setBookmarkedIds(newBookmarkedIds);

    try {
      await AsyncStorage.setItem(
        'bookmarks',
        JSON.stringify(Array.from(newBookmarkedIds))
      );

      const newWords = words.filter((w) => newBookmarkedIds.has(w.id));

      if (newWords.length === 0) {
        setWords([]);
      } else {
        setWords(newWords);
        const newIndex = Math.min(currentIndex, newWords.length - 1);
        setCurrentIndex(newIndex);
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index: newIndex, animated: false });
        }, 100);
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
    }
  };

  const handleNext = () => {
    if (currentIndex < words.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
    }
  };

  const handleProgressBarPress = (event: any) => {
    const { locationX } = event.nativeEvent;
    const progressBarWidth = event.currentTarget.offsetWidth || 300;
    const percentage = locationX / progressBarWidth;
    const newIndex = Math.floor(percentage * words.length);
    const clampedIndex = Math.max(0, Math.min(newIndex, words.length - 1));
    setCurrentIndex(clampedIndex);
    flatListRef.current?.scrollToIndex({ index: clampedIndex, animated: true });
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

  if (words.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <BookmarkX size={64} color={colors.textSecondary} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          No Bookmarks Yet
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          Start studying and bookmark words you want to review later
        </Text>
      </View>
    );
  }

  const currentWord = words[currentIndex];
  const isBookmarked = bookmarkedIds.has(currentWord.id);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Bookmarked Words
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={toggleTheme} style={styles.themeButton}>
            {theme === 'light' ? (
              <Moon size={20} color={colors.text} />
            ) : (
              <Sun size={20} color={colors.text} />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleCurrentBookmark} style={styles.removeButton}>
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
          activeOpacity={0.7}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${((currentIndex + 1) / words.length) * 100}%`,
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
        renderItem={({ item }) => <FlipCard word={item} />}
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
          onPress={handlePrevious}
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
          onPress={handleNext}
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
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
  removeButton: {
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
