import { QuizQuestion } from '@/types/quiz';
import Constants from 'expo-constants';

type Extras = {
  openaiApiKey?: string;
};

const extras = (Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {}) as Extras;

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || extras.openaiApiKey || '';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// 디버그: 환경 변수 확인
console.log(
  'OPENAI KEY EXISTS:',
  !!OPENAI_API_KEY,
  'from env:',
  !!process.env.EXPO_PUBLIC_OPENAI_API_KEY,
  'from extras:',
  !!extras.openaiApiKey
);

export async function generateQuizQuestions(
  day: number,
  words: string[]
): Promise<QuizQuestion[]> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured');
  }

  const prompt = `You are creating TOEIC PART 5 style quiz questions based on vocabulary words.

Day: ${day}
Words to use: ${words.join(', ')}

Create exactly 3 multiple-choice questions with the following requirements:
1. Each question should be a TOEIC PART 5 style sentence completion question
2. Do NOT directly ask for the meaning of the words
3. Use the words in context-based sentences where the word fits naturally
4. Each question should have 4 choices (A, B, C, D)
5. Only one answer should be correct
6. Include a brief explanation in Korean for each question
7. The questions should feel like real TOEIC exam questions

Return a JSON object with a "questions" key containing an array of exactly 3 questions. Format:
{
  "questions": [
    {
      "question": "Complete sentence with blank",
      "choices": ["choice A", "choice B", "choice C", "choice D"],
      "answer": "correct choice text",
      "explanation": "Brief explanation in Korean"
    },
    ...
  ]
}

Make sure to use the vocabulary words naturally in the questions.`;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a TOEIC test question creator. Return only valid JSON, no markdown or code blocks.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in API response');
    }

    // JSON 파싱 (JSON 객체로 감싸져 있을 수 있음)
    let parsedContent: any;
    try {
      parsedContent = JSON.parse(content);
    } catch (e) {
      throw new Error('Failed to parse JSON response');
    }

    // questions 배열 추출 (직접 배열이거나 객체 안에 questions 키가 있을 수 있음)
    let questions: QuizQuestion[];
    if (Array.isArray(parsedContent)) {
      questions = parsedContent;
    } else if (parsedContent.questions && Array.isArray(parsedContent.questions)) {
      questions = parsedContent.questions;
    } else if (parsedContent.data && Array.isArray(parsedContent.data)) {
      questions = parsedContent.data;
    } else {
      // 객체가 아니고 직접 배열 형태인지 확인
      throw new Error('Invalid response format: expected array of questions or object with questions key');
    }

    // 최대 3개만 반환
    if (questions.length > 3) {
      questions = questions.slice(0, 3);
    }

    // 필수 필드 검증
    const validatedQuestions: QuizQuestion[] = questions
      .filter((q: any) => q.question && q.choices && q.answer && q.explanation)
      .map((q: any) => ({
        question: q.question,
        choices: Array.isArray(q.choices) ? q.choices : [],
        answer: q.answer,
        explanation: q.explanation,
      }));

    if (validatedQuestions.length === 0) {
      throw new Error('No valid questions generated');
    }

    return validatedQuestions;
  } catch (error) {
    console.error('Error generating quiz questions:', error);
    throw error;
  }
}

/**
 * 퀴즈 생성 함수 (재시도 로직 포함)
 * 네트워크 오류나 일시적인 오류 발생 시 최대 1회 재시도
 * @param day Day 번호
 * @param words 단어 목록
 * @param retry 재시도 횟수 (기본값: 1)
 * @returns 생성된 퀴즈 문제 배열
 */
export async function generateQuizQuestionsWithRetry(
  day: number,
  words: string[],
  retry = 1
): Promise<QuizQuestion[]> {
  try {
    return await generateQuizQuestions(day, words);
  } catch (error) {
    if (retry > 0) {
      console.warn('Retrying quiz generation...', error);
      // 짧은 지연 후 재시도
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return generateQuizQuestionsWithRetry(day, words, retry - 1);
    }
    throw error;
  }
}

