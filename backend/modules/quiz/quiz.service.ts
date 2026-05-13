import {
  findWeeklyQuizByWeekNum,
  saveWeeklyQuiz,
  type GeneratedQuestion,
} from "./quiz.repository";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

type GenerateParams = {
  weekNum?: number;
  year?: number;
  month?: number;
  week?: number;
};

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

function shuffleArray<T>(arr: T[], seed?: number): T[] {
  const out = [...arr];
  const rng = seed != null ? seededRandom(seed) : Math.random;
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const resolveWeekNum = (params: GenerateParams): number => {
  if (typeof params.weekNum === "number") {
    return params.weekNum;
  }

  const hasYmw =
    typeof params.year === "number" &&
    typeof params.month === "number" &&
    typeof params.week === "number";

  if (hasYmw) {
    return params.year! * 1000 + params.month! * 10 + params.week!;
  }

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const w = d <= 7 ? 1 : d <= 14 ? 2 : d <= 21 ? 3 : d <= 28 ? 4 : 5;
  return y * 1000 + m * 10 + w;
};

const buildPrompt = (weekNum: number) => `You are creating a TOEIC PART 5 style vocabulary mock test.

Target: 주차번호 ${weekNum}
Create exactly 10 multiple-choice questions with the following requirements:
1. Each question must be a TOEIC PART 5 style sentence completion (single blank in a sentence).
2. Focus on vocabulary (word choice, collocation, meaning in context). Do NOT make grammar-only questions.
3. Do NOT directly ask "What is the meaning of X?" - use the word in a natural sentence with a blank.
4. Each question has exactly 4 choices (A, B, C, D). Only one answer is correct.
5. Include a brief explanation in Korean for each question.
6. Questions should feel like real TOEIC exam questions (business/office/formal context preferred).

Return a JSON object with a "questions" key containing an array of exactly 10 questions. Format:
{
  "questions": [
    {
      "question": "Complete sentence with _____ blank",
      "choices": ["choice A", "choice B", "choice C", "choice D"],
      "answer": "correct choice text exactly as in choices",
      "explanation": "Brief explanation in Korean"
    }
  ]
}
Return only valid JSON.`;

const parseGeneratedQuestions = (rawContent: string, weekNum: number): GeneratedQuestion[] => {
  let parsedContent: { questions?: unknown[] } | unknown[];
  try {
    parsedContent = JSON.parse(rawContent);
  } catch {
    throw new Error("Failed to parse JSON response");
  }

  const questions = Array.isArray((parsedContent as { questions?: unknown[] }).questions)
    ? (parsedContent as { questions: unknown[] }).questions
    : Array.isArray(parsedContent)
    ? parsedContent
    : null;

  if (!questions) {
    throw new Error('Invalid response format: expected object with "questions" array');
  }

  const validatedQuestions = (questions as any[])
    .filter((q: any) => q && q.question && Array.isArray(q.choices) && q.answer != null)
    .slice(0, 10)
    .map((q: any, index: number) => {
      const choices = (q.choices ?? []).map((c: any) => String(c).trim()).filter(Boolean);
      const answerText = String(q.answer ?? "").trim();
      const shuffled = shuffleArray(choices, weekNum * 10 + index);

      return {
        question: String(q.question ?? "").trim(),
        choices: shuffled,
        answer: answerText,
        explanation: String(q.explanation ?? "").trim(),
      };
    });

  if (validatedQuestions.length === 0) {
    throw new Error("No valid questions generated");
  }

  return validatedQuestions;
};

const requestQuizFromOpenAI = async (weekNum: number): Promise<GeneratedQuestion[]> => {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            'You are a TOEIC test question creator. Return only valid JSON with a "questions" array. No markdown or code blocks.',
        },
        { role: "user", content: buildPrompt(weekNum) },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content in API response");
  }

  return parseGeneratedQuestions(content, weekNum);
};

export const generateWeeklyQuiz = async (params: GenerateParams) => {
  const weekNum = resolveWeekNum(params);

  const existing = await findWeeklyQuizByWeekNum(weekNum);
  if (existing?.id) {
    const err = new Error("이미 해당 주차 모의고사가 존재합니다. 중복 생성되지 않습니다.");
    (err as Error & { status?: number; alreadyExists?: boolean }).status = 409;
    (err as Error & { status?: number; alreadyExists?: boolean }).alreadyExists = true;
    throw err;
  }

  const questions = await requestQuizFromOpenAI(weekNum);
  const { createdAt } = await saveWeeklyQuiz(weekNum, questions);

  return {
    questions,
    created_at: createdAt,
  };
};
