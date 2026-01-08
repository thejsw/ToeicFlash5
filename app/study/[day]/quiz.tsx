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
import { generateQuizQuestionsWithRetry } from '@/lib/llm';
import { QuizQuestion } from '@/types/quiz';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function DayQuizScreen() {
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
      const storageKey = `quiz_generated_day_${dayNum}`;

      // Day당 퀴즈 생성 1회 제한: 이미 생성된 퀴즈가 있는지 확인
      const cachedQuiz = await AsyncStorage.getItem(storageKey);
      if (cachedQuiz) {
        try {
          const parsedQuestions = JSON.parse(cachedQuiz) as QuizQuestion[];
          if (Array.isArray(parsedQuestions) && parsedQuestions.length > 0) {
            console.log(`Day ${dayNum} 퀴즈를 캐시에서 불러옵니다.`);
            setQuestions(parsedQuestions);
            setUserAnswers(new Array(parsedQuestions.length).fill(''));
            return;
          }
        } catch (parseError) {
          console.warn('캐시된 퀴즈 파싱 실패, 새로 생성합니다.', parseError);
          // 파싱 실패 시 캐시 삭제
          await AsyncStorage.removeItem(storageKey);
        }
      }

      // Day의 단어 목록 가져오기
      const { data: wordsData, error: wordsError } = await supabase
        .from('vocabulary_words')
        .select('word')
        .eq('day', dayNum)
        .order('order_index');

      if (wordsError) throw wordsError;

      const wordList = wordsData?.map((w) => w.word) || [];
      
      if (wordList.length === 0) {
        throw new Error('단어를 찾을 수 없습니다.');
      }

      // LLM으로 퀴즈 생성 (재시도 로직 포함)
      const quizQuestions = await generateQuizQuestionsWithRetry(
        dayNum,
        wordList,
        1 // 최대 1회 재시도
      );

      // 생성 성공 시 AsyncStorage에 저장
      await AsyncStorage.setItem(storageKey, JSON.stringify(quizQuestions));

      setQuestions(quizQuestions);
      setUserAnswers(new Array(quizQuestions.length).fill(''));
    } catch (err: any) {
      console.error('Error loading quiz:', err);
      const errorMessage = err.message || '퀴즈를 불러오는 중 오류가 발생했습니다.';
      setError(errorMessage.includes('재시도') || err.message?.includes('Retrying') 
        ? '문제 생성에 실패했어요. 잠시 후 다시 시도해주세요.' 
        : errorMessage);
      Alert.alert('오류', errorMessage.includes('재시도') || err.message?.includes('Retrying')
        ? '문제 생성에 실패했어요. 잠시 후 다시 시도해주세요.'
        : errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (choice: string) => {
    if (selectedAnswer !== null) return; // 이미 선택한 경우 무시

    setSelectedAnswer(choice);
    const newUserAnswers = [...userAnswers];
    newUserAnswers[currentQuestionIndex] = choice;
    setUserAnswers(newUserAnswers);
  };

  const handleNext = () => {
    if (selectedAnswer === null) {
      Alert.alert('알림', '정답을 선택해주세요.');
      return;
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(userAnswers[currentQuestionIndex + 1] || null);
    } else {
      // 마지막 문제 완료 - 결과 화면으로 이동
      router.push({
        pathname: `/study/${day}/quiz/result` as any,
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Day {day} 퀴즈</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            문제를 생성하는 중...
          </Text>
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Day {day} 퀴즈</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>
            {error || '문제를 불러올 수 없습니다.'}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={loadQuestions}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Day {day} 퀴즈</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.progressContainer}>
        <Text style={[styles.progressText, { color: colors.textSecondary }]}>
          {currentQuestionIndex + 1} / {questions.length}
        </Text>
      </View>

      <View style={styles.questionContainer}>
        <Text style={[styles.questionNumber, { color: colors.primary }]}>
          문제 {currentQuestionIndex + 1}
        </Text>
        <Text style={[styles.questionText, { color: colors.text }]}>
          {currentQuestion.question}
        </Text>

        <View style={styles.choicesContainer}>
          {currentQuestion.choices.map((choice, index) => {
            const choiceLabel = String.fromCharCode(65 + index); // A, B, C, D
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
                onPress={() => handleAnswerSelect(choice)}
                disabled={isAnswered}>
                <Text style={[styles.choiceLabel, { color: colors.textSecondary }]}>
                  {choiceLabel}.
                </Text>
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
            {currentQuestionIndex < questions.length - 1 ? '다음 문제' : '결과 보기'}
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

