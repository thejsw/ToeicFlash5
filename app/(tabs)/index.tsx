import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import AdBanner from '@/components/AdBanner';
import { BookOpen, Moon, Sun, Check, GraduationCap } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function HomeScreen() {
  const router = useRouter();
  const { colors, theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [wordCounts, setWordCounts] = useState<Record<number, number>>({});
  const [progressData, setProgressData] = useState<Record<number, number>>({});
  const [studyCompleted, setStudyCompleted] = useState<Record<number, boolean>>({});
  const [quizCompleted, setQuizCompleted] = useState<Record<number, boolean>>({});

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

  const loadProgressData = async () => {
    try {
      const progress: Record<number, number> = {};
      const studyCompletedData: Record<number, boolean> = {};
      const quizCompletedData: Record<number, boolean> = {};
      
      for (let day = 1; day <= 20; day++) {
        // 최대 진행상황을 사용 (진행상황이 리셋되지 않도록)
        const maxProgressKey = `max_progress_day_${day}`;
        const savedMaxProgress = await AsyncStorage.getItem(maxProgressKey);
        const savedIndex = await AsyncStorage.getItem(`progress_day_${day}`);
        
        // 최대 진행상황이 있으면 그것을 사용, 없으면 현재 진행상황 사용
        const indexToUse = savedMaxProgress !== null ? parseInt(savedMaxProgress) : (savedIndex ? parseInt(savedIndex) : -1);
        
        if (indexToUse >= 0) {
          progress[day] = indexToUse + 1; // +1 because index is 0-based
        } else {
          progress[day] = 0;
        }
        
        // 학습 완료 상태 확인
        const studyCompletedValue = await AsyncStorage.getItem(`study_completed_day_${day}`);
        studyCompletedData[day] = studyCompletedValue === 'true';
        
        // 퀴즈 완료 상태 확인
        const quizCompletedValue = await AsyncStorage.getItem(`quiz_completed_day_${day}`);
        quizCompletedData[day] = quizCompletedValue === 'true';
      }
      
      setProgressData(progress);
      setStudyCompleted(studyCompletedData);
      setQuizCompleted(quizCompletedData);
    } catch (error) {
      console.error('Error loading progress data:', error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadWordCounts();
      loadProgressData();
    }, [])
  );

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
          <Text style={[styles.title, { color: colors.text }]}>⚡ Flash5 TOEIC</Text>
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
          {Array.from({ length: 20 }, (_, i) => i + 1).map((day) => {
            const totalWords = wordCounts[day] || 0;
            const currentProgress = progressData[day] || 0;
            const progressPercent = totalWords > 0 ? (currentProgress / totalWords) * 100 : 0;
            const isStudyCompleted = studyCompleted[day] === true;
            const isQuizCompleted = quizCompleted[day] === true;

            // 아이콘 결정: 퀴즈 완료 > 학습 완료 > 기본
            let IconComponent;
            if (isQuizCompleted) {
              IconComponent = Check;
            } else if (isStudyCompleted) {
              IconComponent = GraduationCap;
            } else {
              IconComponent = BookOpen;
            }

            return (
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
                  <IconComponent size={24} color={colors.primary} />
                </View>
                <Text style={[styles.dayNumber, { color: colors.text }]}>
                  Day {day}
                </Text>
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBarBackground,
                      { backgroundColor: colors.border },
                    ]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(progressPercent, 100)}%`,
                          backgroundColor: colors.primary,
                        },
                      ]}
                    />
                  </View>
                </View>
                <Text style={[styles.wordCount, { color: colors.textSecondary }]}>
                  {currentProgress} / {totalWords} words
                </Text>
              </TouchableOpacity>
            );
          })}
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
    fontSize: 12,
    marginTop: 8,
  },
  progressBarContainer: {
    width: '100%',
    marginVertical: 8,
  },
  progressBarBackground: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
});
