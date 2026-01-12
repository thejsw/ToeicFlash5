import { QuizQuestion } from '@/types/quiz';
import { supabase } from '@/lib/supabase';

export async function generateQuizQuestions(
  day: number,
  words: string[]
): Promise<QuizQuestion[]> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-quiz', {
      body: { day, words },
    });

    if (error) {
      throw new Error(error.message || 'Failed to generate quiz');
    }

    if (!data || !data.questions) {
      throw new Error('Invalid response from server');
    }

    const questions: QuizQuestion[] = data.questions;

    const validatedQuestions = questions.filter(
      (q) => q.question && q.choices && q.answer && q.explanation
    );

    if (validatedQuestions.length === 0) {
      throw new Error('No valid questions generated');
    }

    return validatedQuestions;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to generate quiz questions');
  }
}

export async function generateQuizQuestionsWithRetry(
  day: number,
  words: string[],
  retry = 1
): Promise<QuizQuestion[]> {
  try {
    return await generateQuizQuestions(day, words);
  } catch (error) {
    if (retry > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return generateQuizQuestionsWithRetry(day, words, retry - 1);
    }
    throw error;
  }
}
