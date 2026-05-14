import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/lib/theme';
import { ChevronLeft } from 'lucide-react-native';
import { QuizQuestion } from '@/types/quiz';
import { fetchQuizByDay } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';

export default function DayQuizScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { day } = useLocalSearchParams<{ day: string }>();
  const { colors } = useTheme();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadQuestions();
  }, [day]);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      setError(null);

      const dayNum = parseInt(day || '1');
      const dayQuiz = await fetchQuizByDay(dayNum);

      const quizQuestions: QuizQuestion[] = dayQuiz.map((q) => ({
        question: q.question_text,
        choices: q.choices.map((c) => c.choice_text),
        answer: q.answer,
        explanation: q.explanation,
      }));

      if (quizQuestions.length === 0) {
        throw new Error(t('quiz.noQuestionsForDay'));
      }

      setQuestions(quizQuestions);
      setUserAnswers(new Array(quizQuestions.length).fill(''));
    } catch (err: unknown) {
      console.error('Error loading quiz:', err);
      const errorMessage =
        err instanceof Error ? err.message : t('quiz.loadError');
      setError(errorMessage);
      Alert.alert(t('alert.error'), errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (choice: string) => {
    setSelectedAnswer(choice);
    const newUserAnswers = [...userAnswers];
    newUserAnswers[currentQuestionIndex] = choice;
    setUserAnswers(newUserAnswers);
  };

  const handleNext = () => {
    if (selectedAnswer === null) {
      Alert.alert(t('alert.notice'), t('quiz.selectAnswer'));
      return;
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(userAnswers[currentQuestionIndex + 1] || null);
    } else {
      router.push({
        pathname: `/study/${day}/quiz/result` as never,
        params: {
          questions: JSON.stringify(questions),
          userAnswers: JSON.stringify(userAnswers),
        },
      });
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t('quiz.dayTitle', { day: day || '' })}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('quiz.loading')}</Text>
        </View>
      </View>
    );
  }

  if (error || questions.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t('quiz.dayTitle', { day: day || '' })}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>
            {error || t('quiz.cannotLoad')}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={loadQuestions}>
            <Text style={styles.retryButtonText}>{t('quiz.retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const isAnswered = selectedAnswer !== null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t('quiz.dayTitle', { day: day || '' })}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.progressContainer}>
        <Text style={[styles.progressText, { color: colors.textSecondary }]}>
          {currentQuestionIndex + 1} / {questions.length}
        </Text>
      </View>

      <View style={styles.questionContainer}>
        <Text style={[styles.questionNumber, { color: colors.primary }]}>
          {t('quiz.questionLabel', { n: currentQuestionIndex + 1 })}
        </Text>
        <Text style={[styles.questionText, { color: colors.text }]}>{currentQuestion.question}</Text>

        <View style={styles.choicesContainer}>
          {currentQuestion.choices.map((choice, index) => {
            const choiceLabel = String.fromCharCode(65 + index);
            const isSelected = selectedAnswer === choice;

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.choiceButton,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => handleAnswerSelect(choice)}>
                <Text style={[styles.choiceLabel, { color: colors.textSecondary }]}>{choiceLabel}.</Text>
                <Text style={[styles.choiceText, { color: colors.text }]}>{choice}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.nextButton,
            {
              backgroundColor: isAnswered ? colors.primary : colors.border,
            },
          ]}
          onPress={handleNext}
          disabled={!isAnswered}>
          <Text
            style={[
              styles.nextButtonText,
              { color: isAnswered ? '#ffffff' : colors.textSecondary },
            ]}>
            {currentQuestionIndex < questions.length - 1 ? t('quiz.next') : t('quiz.viewResults')}
          </Text>
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
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 24,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  questionContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  questionNumber: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  questionText: {
    fontSize: 18,
    lineHeight: 28,
    marginBottom: 32,
  },
  choicesContainer: {
    gap: 12,
  },
  choiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  choiceLabel: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 24,
  },
  choiceText: {
    fontSize: 16,
    flex: 1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
  },
  nextButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
