import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import AdBanner from '@/components/AdBanner';
import { BookOpen, Moon, Sun } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { colors, theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [wordCounts, setWordCounts] = useState<Record<number, number>>({});

  useEffect(() => {
    loadWordCounts();
  }, []);

  const loadWordCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('vocabulary_words')
        .select('day');

      if (error) throw error;

      const counts: Record<number, number> = {};
      data?.forEach((item) => {
        counts[item.day] = (counts[item.day] || 0) + 1;
      });

      setWordCounts(counts);
    } catch (error) {
      console.error('Error loading word counts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDayPress = (day: number) => {
    router.push(`/study/${day}`);
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>TOEIC Vocabulary</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Choose a day to study
          </Text>
        </View>
        <TouchableOpacity onPress={toggleTheme} style={styles.themeButton}>
          {theme === 'light' ? (
            <Moon size={24} color={colors.text} />
          ) : (
            <Sun size={24} color={colors.text} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          // 광고 영역이 가려지지 않도록 하단 여백 추가
          { paddingBottom: 24 },
        ]}>
        <View style={styles.grid}>
          {Array.from({ length: 20 }, (_, i) => i + 1).map((day) => (
            <TouchableOpacity
              key={day}
              style={[
                styles.dayCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => handleDayPress(day)}
              activeOpacity={0.7}>
              <View
                style={[
                  styles.dayIconContainer,
                  { backgroundColor: colors.primaryLight },
                ]}>
                <BookOpen size={24} color={colors.primary} />
              </View>
              <Text style={[styles.dayNumber, { color: colors.text }]}>
                Day {day}
              </Text>
              <Text style={[styles.wordCount, { color: colors.textSecondary }]}>
                {wordCounts[day] || 0} words
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* 항상 화면 가장 아래에 위치하는 광고 배너 */}
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
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  themeButton: {
    padding: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  dayCard: {
    width: '48%',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
  },
  dayIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  wordCount: {
    fontSize: 14,
  },
});
