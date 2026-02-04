import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getCurrentUserId,
  getFolder,
  listBookmarksByFolder,
  listFolders,
  removeBookmark,
  moveBookmark,
  fetchWordsWithContents,
  VocabularyWord,
  Bookmark,
} from '@/lib/supabase';
import FlipCard from '@/components/FlipCard';
import AdBanner from '@/components/AdBanner';
import MoveBookmarkSheet from './_components/MoveBookmarkSheet';
import { ChevronLeft, ChevronRight, Star, Moon, Sun, FolderInput } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';

export default function FolderBookmarksScreen() {
  const { folderId } = useLocalSearchParams<{ folderId: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors, theme, toggleTheme } = useTheme();
  const flatListRef = useRef<FlatList>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState('');
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [folders, setFolders] = useState<Awaited<ReturnType<typeof listFolders>>>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [moveSheetVisible, setMoveSheetVisible] = useState(false);

  const loadData = useCallback(async () => {
    if (!folderId) return;
    const uid = await getCurrentUserId();
    setUserId(uid ?? null);
    const [folder, bookmarkList, folderList] = await Promise.all([
      getFolder(uid ?? null, folderId),
      listBookmarksByFolder(uid ?? null, folderId),
      listFolders(uid ?? null),
    ]);
    if (!folder) {
      setLoading(false);
      return;
    }
    setFolderName(folder.name);
    setFolders(folderList);
    setBookmarks(bookmarkList);
    if (bookmarkList.length === 0) {
      setWords([]);
      setLoading(false);
      return;
    }
    const wordIds = bookmarkList.map((b) => b.word_id);
    const wordsList = await fetchWordsWithContents(wordIds);
    const orderMap = new Map(bookmarkList.map((b, i) => [b.word_id, i]));
    const ordered = wordsList.sort(
      (a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999)
    );
    setWords(ordered);
    setLoading(false);
  }, [folderId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrevious();
      else if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex, words.length]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const next = currentIndex - 1;
      setCurrentIndex(next);
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
    }
  };

  const handleNext = () => {
    if (currentIndex < words.length - 1) {
      const next = currentIndex + 1;
      setCurrentIndex(next);
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
    }
  };

  const removeCurrentBookmark = async () => {
    if (words.length === 0) return;
    const word = words[currentIndex];
    const b = bookmarks.find((x) => x.word_id === word.id);
    if (!b) return;
    try {
      await removeBookmark(userId ?? null, b.id);
      setBookmarks((prev) => prev.filter((x) => x.id !== b.id));
      setWords((prev) => prev.filter((w) => w.id !== word.id));
      const nextIndex = Math.min(currentIndex, Math.max(0, words.length - 2));
      setCurrentIndex(nextIndex);
      if (words.length <= 1) {
        setCurrentIndex(0);
      } else {
        setTimeout(() => flatListRef.current?.scrollToIndex({ index: nextIndex, animated: false }), 100);
      }
    } catch (e) {
      Alert.alert('오류', '폴더에서 제거에 실패했습니다.');
    }
  };

  const handleMoveToFolder = async (targetFolderId: string) => {
    if (words.length === 0) return;
    const word = words[currentIndex];
    const b = bookmarks.find((x) => x.word_id === word.id);
    if (!b) return;
    try {
      await moveBookmark(userId ?? null, b.id, targetFolderId);
      setBookmarks((prev) => prev.filter((x) => x.id !== b.id));
      setWords((prev) => prev.filter((w) => w.id !== word.id));
      setMoveSheetVisible(false);
      const nextIndex = Math.min(currentIndex, Math.max(0, words.length - 2));
      setCurrentIndex(nextIndex);
      setTimeout(() => flatListRef.current?.scrollToIndex({ index: nextIndex, animated: false }), 100);
    } catch (e) {
      Alert.alert('오류', '이동에 실패했습니다.');
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (words.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {folderName}
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={toggleTheme} style={styles.themeButton}>
              {theme === 'light' ? <Moon size={20} color={colors.text} /> : <Sun size={20} color={colors.text} />}
            </TouchableOpacity>
          </View>
        </View>
        <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>이 폴더에 북마크가 없습니다</Text>
        </View>
      </View>
    );
  }

  const currentWord = words[currentIndex];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {folderName}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={toggleTheme} style={styles.themeButton}>
            {theme === 'light' ? <Moon size={20} color={colors.text} /> : <Sun size={20} color={colors.text} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={removeCurrentBookmark} style={styles.iconBtn}>
            <Star size={24} color={colors.bookmark} fill={colors.bookmark} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMoveSheetVisible(true)} style={styles.iconBtn}>
            <FolderInput size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.progressContainer, { backgroundColor: colors.surface }]}>
        <Text style={[styles.progressText, { color: colors.textSecondary }]}>
          {currentIndex + 1} / {words.length}
        </Text>
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${((currentIndex + 1) / words.length) * 100}%`,
                backgroundColor: colors.primary,
              },
            ]}
          />
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={words}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={width}
        snapToAlignment="center"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <View style={[styles.cardPage, { width }]}>
            <FlipCard word={item} />
          </View>
        )}
        keyExtractor={(item) => item.id}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      />

      <View style={[styles.navigation, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
          onPress={handlePrevious}
          disabled={currentIndex === 0}>
          <ChevronLeft size={24} color={currentIndex === 0 ? colors.bookmarkEmpty : colors.text} />
          <Text style={[styles.navText, { color: currentIndex === 0 ? colors.bookmarkEmpty : colors.text }]}>
            Previous
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navButton, currentIndex === words.length - 1 && styles.navButtonDisabled]}
          onPress={handleNext}
          disabled={currentIndex === words.length - 1}>
          <Text style={[styles.navText, { color: currentIndex === words.length - 1 ? colors.bookmarkEmpty : colors.text }]}>
            Next
          </Text>
          <ChevronRight size={24} color={currentIndex === words.length - 1 ? colors.bookmarkEmpty : colors.text} />
        </TouchableOpacity>
      </View>

      <MoveBookmarkSheet
        visible={moveSheetVisible}
        folders={folders}
        currentFolderId={folderId}
        onSelect={handleMoveToFolder}
        onClose={() => setMoveSheetVisible(false)}
      />
      <AdBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 18 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  backButton: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '600', marginHorizontal: 8 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  themeButton: { padding: 8 },
  iconBtn: { padding: 8 },
  progressContainer: { paddingHorizontal: 20, paddingVertical: 16 },
  progressText: { fontSize: 14, marginBottom: 8, textAlign: 'center' },
  progressBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  cardPage: { alignItems: 'center', justifyContent: 'center' },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
  },
  navButton: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  navButtonDisabled: { opacity: 0.4 },
  navText: { fontSize: 16, fontWeight: '600' },
});
