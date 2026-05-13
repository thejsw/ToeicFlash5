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

/** Edge Function 에러 응답 본문에서 메시지 추출 (500 등) */
async function getInvokeErrorMessage(error: unknown): Promise<string> {
  if (!error || typeof error !== 'object') return '주차 퀴즈 생성에 실패했습니다.';
  const err = error as { message?: string; context?: Response };
  if (err.context && typeof err.context.json === 'function') {
    try {
      const body = (await err.context.json()) as { error?: string };
      if (body?.error && typeof body.error === 'string') return body.error;
    } catch (_) {}
  }
  return err.message || '주차 퀴즈 생성에 실패했습니다.';
}

/** 주차별 TOEIC Part 5 어휘 모의고사 10문항 생성 (Edge Function) */
export async function generateWeeklyQuizQuestions(weekNum: number): Promise<QuizQuestion[]> {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/57760822-afc0-4241-84bd-3d7185be3e6b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'route-check',hypothesisId:'H5',location:'lib/llm.ts:68',message:'invoke generate-weekly-quiz start',data:{weekNum},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const { data, error } = await supabase.functions.invoke('generate-weekly-quiz', {
    body: { weekNum },
  });
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/57760822-afc0-4241-84bd-3d7185be3e6b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'route-check',hypothesisId:'H6',location:'lib/llm.ts:73',message:'invoke generate-weekly-quiz result',data:{weekNum,hasData:Boolean(data),hasError:Boolean(error),errorMessage:(error as {message?:string}|null)?.message??null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  if (error) {
    const message = await getInvokeErrorMessage(error);
    throw new Error(message);
  }

  if (!data) {
    throw new Error('서버에서 응답이 없습니다. Edge Function(generate-weekly-quiz)이 배포되었는지 확인해주세요.');
  }

  if (data.error && typeof data.error === 'string') {
    throw new Error(data.error);
  }

  if (!data.questions || !Array.isArray(data.questions)) {
    throw new Error('서버 응답 형식이 올바르지 않습니다. (questions 없음)');
  }

  const questions = (data.questions as QuizQuestion[]).filter(
    (q) => q && q.question && Array.isArray(q.choices) && q.answer
  );

  if (questions.length === 0) {
    throw new Error('생성된 문항이 없습니다.');
  }

  return questions;
}

type GetOrCreateWeeklyQuizResult = {
  id?: string;
  type?: string;
  week_num?: number;
  created_at?: string | null;
  [key: string]: unknown;
};

/** 주차별 퀴즈: 존재하면 그대로, 없으면 생성 후 반환 (Edge Function) */
export async function getOrCreateWeeklyQuiz(weekNum: number): Promise<GetOrCreateWeeklyQuizResult> {
  const { data, error } = await supabase.functions.invoke('get-or-create-weekly-quiz', {
    body: { weekNum },
  });

  if (error) {
    const message = await getInvokeErrorMessage(error);
    throw new Error(message);
  }

  if (!data) {
    throw new Error('서버에서 응답이 없습니다. Edge Function(get-or-create-weekly-quiz)이 배포되었는지 확인해주세요.');
  }

  if ((data as { error?: unknown }).error && typeof (data as { error?: unknown }).error === 'string') {
    throw new Error((data as { error: string }).error);
  }

  return data as GetOrCreateWeeklyQuizResult;
}
