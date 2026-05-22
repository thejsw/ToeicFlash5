import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/lib/theme';
import { ChevronLeft, CheckCircle, XCircle } from 'lucide-react-native';
import { QuizQuestion, QuizResult } from '@/types/quiz';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId, upsertUserProgress } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';

export default function DayQuizResultScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { day, questions: questionsParam, userAnswers: userAnswersParam } =
    useLocalSearchParams<{
      day: string;
      questions: string;
      userAnswers: string;
    }>();
  const { colors } = useTheme();

  const [results, setResults] = useState<QuizResult[]>([]);
  const [score, setScore] = useState(0);

  useEffect(() => {
    calculateResults();
  }, []);

  const calculateResults = async () => {
    try {
      const questions: QuizQuestion[] = JSON.parse(questionsParam || '[]');
      const userAnswers: string[] = JSON.parse(userAnswersParam || '[]');

      const calculatedResults: QuizResult[] = questions.map((question, index) => {
        const userAnswer = userAnswers[index] || '';
        const isCorrect = userAnswer === question.answer;

        return {
          question: question.question,
          userAnswer,
          correctAnswer: question.answer,
          isCorrect,
          explanation: question.explanation,
        };
      });

      const correctCount = calculatedResults.filter((r) => r.isCorrect).length;
      setResults(calculatedResults);
      setScore(correctCount);

      await AsyncStorage.setItem(`quiz_completed_day_${day}`, 'true');
      const uid = await getCurrentUserId();
      if (uid) {
        try {
          await upsertUserProgress(uid, parseInt(day || '0', 10), 0);
        } catch (error) {
          console.error('Error saving user progress:', error);
        }
      }
    } catch (error) {
      console.error('Error calculating results:', error);
    }
  };

  const handleGoHome = () => {
    router.push('/(tabs)');
  };

  const handleRetry = () => {
    router.push(`/study/${day}/quiz`);
  };

  const getChoiceLabel = (choice: string, choices: string[]) => {
    const index = choices.indexOf(choice);
    return index !== -1 ? String.fromCharCode(65 + index) : '';
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleGoHome} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('quizResult.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.scoreContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>{t('quizResult.score')}</Text>
          <Text style={[styles.scoreText, { color: colors.primary }]}>
            {score} / {results.length}
          </Text>
        </View>

        <View style={styles.resultsContainer}>
          {results.map((result, index) => {
            const currentQuestion = JSON.parse(questionsParam || '[]')[index] as QuizQuestion;
            const choices = currentQuestion?.choices || [];

            return (
              <View
                key={index}
                style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.resultHeader}>
                  <Text style={[styles.resultNumber, { color: colors.text }]}>
                    {t('quiz.questionLabel', { n: index + 1 })}
                  </Text>
                  {result.isCorrect ? (
                    <CheckCircle size={24} color={colors.success || '#10b981'} />
                  ) : (
                    <XCircle size={24} color={colors.error || '#ef4444'} />
                  )}
                </View>

                <Text style={[styles.resultQuestion, { color: colors.text }]}>{result.question}</Text>

                <View style={styles.answerSection}>
                  <View style={styles.answerRow}>
                    <Text style={[styles.answerLabel, { color: colors.textSecondary }]}>
                      {t('quizResult.myAnswer')}
                    </Text>
                    <Text
                      style={[
                        styles.answerText,
                        { color: result.isCorrect ? colors.success || '#10b981' : colors.error || '#ef4444' },
                      ]}>
                      {getChoiceLabel(result.userAnswer, choices)}. {result.userAnswer}
                    </Text>
                  </View>

                  {!result.isCorrect && (
                    <View style={styles.answerRow}>
                      <Text style={[styles.answerLabel, { color: colors.textSecondary }]}>
                        {t('quizResult.correct')}
                      </Text>
                      <Text style={[styles.answerText, { color: colors.primary }]}>
                        {getChoiceLabel(result.correctAnswer, choices)}. {result.correctAnswer}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={[styles.explanationContainer, { backgroundColor: colors.background }]}>
                  <Text style={[styles.explanationLabel, { color: colors.textSecondary }]}>
                    {t('quizResult.explanation')}
                  </Text>
                  <Text style={[styles.explanationText, { color: colors.text }]}>{result.explanation}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TouchableOpacity style={[styles.button, { borderColor: colors.border }]} onPress={handleRetry}>
          <Text style={[styles.buttonText, { color: colors.text }]}>{t('quizResult.retry')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary, { backgroundColor: colors.primary }]}
          onPress={handleGoHome}>
          <Text style={[styles.buttonText, styles.buttonTextPrimary]}>{t('quizResult.home')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 20,
  },
  scoreContainer: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  scoreText: {
    fontSize: 36,
    fontWeight: '700',
  },
  resultsContainer: {
    gap: 16,
  },
  resultCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    gap: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultNumber: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultQuestion: {
    fontSize: 16,
    lineHeight: 24,
  },
  answerSection: {
    gap: 8,
  },
  answerRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  answerLabel: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 60,
  },
  answerText: {
    fontSize: 14,
    flex: 1,
    fontWeight: '500',
  },
  explanationContainer: {
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  explanationLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  buttonPrimary: {
    borderWidth: 0,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextPrimary: {
    color: '#ffffff',
  },
});
