import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = Deno.env.get("OPENAI_WEEKLY_QUIZ_MODEL") ?? "gpt-4o-mini";
const WEEKLY_MOCK_TYPE = "weekly_mock_light";
const ORDER_KEYS = ["A", "B", "C", "D"];
const ORDER_INDEX_BASE = 5001;
const REQUIRED_QUESTION_COUNT = 10;
const REQUIRED_CHOICE_COUNT = 4;

type GeneratedQuestion = {
  question: string;
  choices: string[];
  answer: string;
  explanation: string;
  explanations: {
    ko: string;
    jp: string;
  };
};

type LogStatus = "started" | "success" | "already_exists" | "failed" | "unauthorized";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

function shuffleArray<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  const rng = seededRandom(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function getKstWeekNum(date = new Date()): number {
  const kst = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(kst.find((p) => p.type === "year")?.value);
  const month = Number(kst.find((p) => p.type === "month")?.value);
  const day = Number(kst.find((p) => p.type === "day")?.value);
  const week = day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : day <= 28 ? 4 : 5;
  return year * 1000 + month * 10 + week;
}

function resolveWeekNum(body: Record<string, unknown>): number {
  const rawWeekNum = Number(body.weekNum);
  if (Number.isInteger(rawWeekNum) && rawWeekNum > 0) return rawWeekNum;

  const year = Number(body.year);
  const month = Number(body.month);
  const week = Number(body.week);
  if (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(week) &&
    year > 2000 &&
    month >= 1 &&
    month <= 12 &&
    week >= 1 &&
    week <= 5
  ) {
    return year * 1000 + month * 10 + week;
  }

  return getKstWeekNum();
}

function validateGeneratedQuestions(rawQuestions: unknown[], weekNum: number): GeneratedQuestion[] {
  if (rawQuestions.length !== REQUIRED_QUESTION_COUNT) {
    throw new Error(`Expected exactly ${REQUIRED_QUESTION_COUNT} questions, received ${rawQuestions.length}`);
  }

  return rawQuestions.map((raw, index) => {
    const q = raw as Record<string, unknown>;
    const question = String(q.question ?? "").trim();
    const rawExplanations = q.explanations as Record<string, unknown> | undefined;
    const explanationKo = String(rawExplanations?.ko ?? q.explanationKo ?? q.explanation ?? "").trim();
    const explanationJp = String(rawExplanations?.jp ?? q.explanationJp ?? "").trim();
    const answer = String(q.answer ?? "").trim();
    const choices = Array.isArray(q.choices)
      ? q.choices.map((choice) => String(choice ?? "").trim()).filter(Boolean)
      : [];

    if (!question) throw new Error(`Question ${index + 1} is missing question text`);
    if (!explanationKo) throw new Error(`Question ${index + 1} is missing Korean explanation`);
    if (!explanationJp) throw new Error(`Question ${index + 1} is missing Japanese explanation`);
    if (choices.length !== REQUIRED_CHOICE_COUNT) {
      throw new Error(`Question ${index + 1} must have exactly ${REQUIRED_CHOICE_COUNT} choices`);
    }
    if (new Set(choices).size !== REQUIRED_CHOICE_COUNT) {
      throw new Error(`Question ${index + 1} has duplicate choices`);
    }
    if (!choices.includes(answer)) {
      throw new Error(`Question ${index + 1} answer must match one of the choices exactly`);
    }

    const shuffled = shuffleArray(choices, weekNum * 10 + index);
    return {
      question,
      choices: shuffled,
      answer,
      explanation: explanationKo,
      explanations: { ko: explanationKo, jp: explanationJp },
    };
  });
}

async function logGeneration(
  supabase: any,
  status: LogStatus,
  values: {
    weekNum?: number | null;
    quizId?: string | null;
    errorMessage?: string | null;
    metadata?: Record<string, unknown>;
  } = {}
) {
  try {
    await supabase.from("weekly_quiz_generation_logs").insert({
      week_num: values.weekNum ?? null,
      quiz_id: values.quizId ?? null,
      status,
      error_message: values.errorMessage ?? null,
      metadata: values.metadata ?? {},
    });
  } catch (error) {
    console.warn("Failed to write weekly quiz generation log:", error);
  }
}

async function cleanupPartialQuiz(
  supabase: any,
  quizId: string,
  questionIds: string[]
) {
  if (questionIds.length > 0) {
    await supabase.from("quiz_choices").delete().in("question_id", questionIds);
    await supabase.from("quiz_explanations").delete().in("question_id", questionIds);
    await supabase.from("quiz_questions").delete().in("id", questionIds);
  }
  await supabase.from("quizzes").delete().eq("id", quizId);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase =
    supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;
  let weekNum: number | null = null;

  try {
    if (!supabaseUrl || !serviceRoleKey || !supabase) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in Edge Function secrets");
    }

    if (!CRON_SECRET) {
      throw new Error("CRON_SECRET is not configured");
    }

    if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
      await logGeneration(supabase, "unauthorized", {
        errorMessage: "Invalid or missing x-cron-secret",
      });
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    weekNum = resolveWeekNum(body);
    await logGeneration(supabase, "started", {
      weekNum,
      metadata: { model: OPENAI_MODEL },
    });

    const { data: existing, error: existingErr } = await supabase
      .from("quizzes")
      .select("id, created_at")
      .eq("type", WEEKLY_MOCK_TYPE)
      .eq("week_num", weekNum)
      .limit(1)
      .maybeSingle();

    if (existingErr) throw existingErr;
    if (existing?.id) {
      await logGeneration(supabase, "already_exists", {
        weekNum,
        quizId: existing.id,
      });
      return jsonResponse({
        alreadyExists: true,
        quiz_id: existing.id,
        created_at: existing.created_at,
      });
    }

    const label = `week number ${weekNum}`;
    const prompt = `You are creating a TOEIC PART 5 style vocabulary mock test.

Target: ${label}
Create exactly 10 multiple-choice questions with the following requirements:
1. Each question must be a TOEIC PART 5 style sentence completion with one blank.
2. Focus on vocabulary: word choice, collocation, and meaning in context. Do not make grammar-only questions.
3. Do not ask "What is the meaning of X?". Use the word naturally in a sentence with a blank.
4. Each question has exactly 4 choices. Only one answer is correct.
5. Include brief explanations in both Korean and Japanese for each question.
6. The Japanese explanation will be saved to Supabase quiz_explanations using language "jp" and the explanation column, so explanations.jp must contain the complete Japanese explanation text.
7. Questions should feel like real TOEIC exam questions in business, office, or formal contexts.

Return only valid JSON:
{
  "questions": [
    {
      "question": "Sentence with a _____ blank.",
      "choices": ["choice A", "choice B", "choice C", "choice D"],
      "answer": "correct choice text exactly as in choices",
      "explanations": {
        "ko": "Brief explanation in Korean",
        "jp": "Brief explanation in Japanese"
      }
    }
  ]
}`;

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content:
              'You are a TOEIC test question creator. Return only valid JSON with a "questions" array. No markdown or code blocks.',
          },
          { role: "user", content: prompt },
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
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content in API response");

    const parsedContent = JSON.parse(content) as { questions?: unknown[] };
    if (!Array.isArray(parsedContent.questions)) {
      throw new Error('Invalid response format: expected object with "questions" array');
    }

    const validatedQuestions = validateGeneratedQuestions(parsedContent.questions, weekNum);

    const { data: wordRow, error: wordErr } = await supabase
      .from("words")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (wordErr || !wordRow?.id) {
      throw new Error("words table has no row available for weekly quiz placeholder word_id");
    }

    const { data: quizRow, error: quizErr } = await supabase
      .from("quizzes")
      .insert({
        type: WEEKLY_MOCK_TYPE,
        week_num: weekNum,
        created_at: new Date().toISOString(),
      })
      .select("id, created_at")
      .single();

    if (quizErr || !quizRow?.id) {
      if (quizErr?.code === "23505") {
        await logGeneration(supabase, "already_exists", {
          weekNum,
          errorMessage: quizErr.message,
        });
        return jsonResponse({ alreadyExists: true });
      }
      throw new Error(quizErr?.message ?? "quizzes insert failed");
    }

    const createdQuestionIds: string[] = [];
    try {
      for (let i = 0; i < validatedQuestions.length; i++) {
        const q = validatedQuestions[i];
        const { data: questionRow, error: qErr } = await supabase
          .from("quiz_questions")
          .insert({
            word_id: wordRow.id,
            quiz_id: quizRow.id,
            question_text: q.question,
            order_index: ORDER_INDEX_BASE + i,
          })
          .select("id")
          .single();

        if (qErr || !questionRow?.id) {
          throw new Error(qErr?.message ?? "quiz_questions insert failed");
        }
        createdQuestionIds.push(questionRow.id);

        for (let j = 0; j < q.choices.length; j++) {
          const choiceText = q.choices[j];
          const { error: cErr } = await supabase.from("quiz_choices").insert({
            question_id: questionRow.id,
            choice_key: ORDER_KEYS[j],
            choice_text: choiceText,
            is_correct: choiceText === q.answer,
          });
          if (cErr) throw new Error(cErr.message);
        }

        const { error: exErr } = await supabase.from("quiz_explanations").insert([
          {
            question_id: questionRow.id,
            language: "ko",
            explanation: q.explanations.ko,
          },
          {
            question_id: questionRow.id,
            language: "jp",
            explanation: q.explanations.jp,
          },
        ]);
        if (exErr) throw new Error(exErr.message);
      }
    } catch (insertError) {
      await cleanupPartialQuiz(supabase, quizRow.id, createdQuestionIds);
      throw insertError;
    }

    await logGeneration(supabase, "success", {
      weekNum,
      quizId: quizRow.id,
      metadata: {
        questionCount: validatedQuestions.length,
        model: OPENAI_MODEL,
      },
    });

    return jsonResponse({
      quiz_id: quizRow.id,
      questions: validatedQuestions,
      created_at: quizRow.created_at,
    });
  } catch (error: unknown) {
    console.error("Error generating weekly quiz:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    if (supabase) {
      await logGeneration(supabase, "failed", {
        weekNum,
        errorMessage,
      });
    }
    return jsonResponse({ error: errorMessage }, 500);
  }
});
