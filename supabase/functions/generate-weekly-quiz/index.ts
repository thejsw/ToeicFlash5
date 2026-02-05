import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const WEEKLY_MOCK_TYPE = 'weekly_mock_light';
const ORDER_KEYS = ['A', 'B', 'C', 'D'];
const ORDER_INDEX_BASE = 5001;

/** Fisher-Yates shuffle (정답이 A/B/C/D에 골고루 나오도록) */
function shuffleArray<T>(arr: T[], seed?: number): T[] {
  const out = [...arr];
  const rng = seed != null ? seededRandom(seed) : Math.random;
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function seededRandom(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in Edge Function secrets');
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    let weekNum = body?.weekNum as number | undefined;
    const year = body?.year as number | undefined;
    const month = body?.month as number | undefined;
    const week = body?.week as number | undefined;

    if (weekNum == null && (year == null || month == null || week == null)) {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      const d = now.getDate();
      const w = d <= 7 ? 1 : d <= 14 ? 2 : d <= 21 ? 3 : d <= 28 ? 4 : 5;
      weekNum = y * 1000 + m * 10 + w;
    } else if (year != null && month != null && week != null) {
      weekNum = year * 1000 + month * 10 + week;
    }

    if (weekNum == null) {
      return jsonResponse(
        { error: 'Invalid request: weekNum or (year, month, week) are required' },
        400
      );
    }

    const { data: existing } = await supabase
      .from('test_quizzes')
      .select('id')
      .eq('type', WEEKLY_MOCK_TYPE)
      .eq('week_num', weekNum)
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      return jsonResponse(
        { error: '이미 해당 주차 모의고사가 존재합니다. 중복 생성되지 않습니다.', alreadyExists: true },
        409
      );
    }

    const label = `주차번호 ${weekNum}`;
    const prompt = `You are creating a TOEIC PART 5 style vocabulary mock test.

Target: ${label}
Create exactly 10 multiple-choice questions with the following requirements:
1. Each question must be a TOEIC PART 5 style sentence completion (single blank in a sentence).
2. Focus on vocabulary (word choice, collocation, meaning in context). Do NOT make grammar-only questions.
3. Do NOT directly ask "What is the meaning of X?" — use the word in a natural sentence with a blank.
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
            content:
              'You are a TOEIC test question creator. Return only valid JSON with a "questions" array. No markdown or code blocks.',
          },
          { role: 'user', content: prompt },
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

    let parsedContent: { questions?: unknown[] };
    try {
      parsedContent = JSON.parse(content);
    } catch {
      throw new Error('Failed to parse JSON response');
    }

    let questions: unknown[];
    if (Array.isArray(parsedContent.questions)) {
      questions = parsedContent.questions;
    } else if (Array.isArray(parsedContent)) {
      questions = parsedContent;
    } else {
      throw new Error('Invalid response format: expected object with "questions" array');
    }

    const validatedQuestions = (questions as any[])
      .filter((q: any) => q && q.question && q.choices && Array.isArray(q.choices) && q.answer != null)
      .slice(0, 10)
      .map((q: any, index: number) => {
        const choices = (q.choices ?? []).map((c: any) => String(c).trim()).filter(Boolean);
        const answerText = String(q.answer ?? '').trim();
        const shuffled = shuffleArray(choices, weekNum * 10 + index);
        return {
          question: String(q.question ?? '').trim(),
          choices: shuffled,
          answer: answerText,
          explanation: String(q.explanation ?? '').trim(),
        };
      });

    if (validatedQuestions.length === 0) {
      throw new Error('No valid questions generated');
    }

    const { data: wordRow, error: wordErr } = await supabase
      .from('words')
      .select('id')
      .limit(1)
      .maybeSingle();
    if (wordErr || !wordRow?.id) {
      throw new Error('words 테이블에 단어가 없어 주차 퀴즈를 저장할 수 없습니다.');
    }
    const placeholderWordId = wordRow.id;

    const createdAt = new Date().toISOString();
    const { data: quizRow, error: quizErr } = await supabase
      .from('test_quizzes')
      .insert({
        type: WEEKLY_MOCK_TYPE,
        week_num: weekNum,
        created_at: createdAt,
      })
      .select('id, created_at')
      .single();
    if (quizErr || !quizRow?.id) {
      throw new Error(quizErr?.message ?? 'test_quizzes insert failed');
    }
    const quizId = quizRow.id;

    for (let i = 0; i < validatedQuestions.length; i++) {
      const q = validatedQuestions[i];
      const questionOrderIndex = ORDER_INDEX_BASE + i;
      const { data: questionRow, error: qErr } = await supabase
        .from('test_quiz_questions')
        .insert({
          word_id: placeholderWordId,
          quiz_id: quizId,
          question_text: q.question,
          order_index: questionOrderIndex,
        })
        .select('id')
        .single();
      if (qErr || !questionRow?.id) {
        throw new Error(qErr?.message ?? 'test_quiz_questions insert failed');
      }
      const questionId = questionRow.id;

      const choices = q.choices ?? [];
      const answerText = (q.answer ?? '').trim();
      for (let j = 0; j < choices.length; j++) {
        const choiceText = String(choices[j] ?? '').trim();
        if (!choiceText) continue;
        const choiceOrderIndex = ORDER_INDEX_BASE + i * 4 + j;
        const { error: cErr } = await supabase.from('test_quiz_choices').insert({
          question_id: questionId,
          choice_key: ORDER_KEYS[j] ?? String.fromCharCode(65 + j),
          choice_text: choiceText,
          is_correct: choiceText === answerText,
          order_index: choiceOrderIndex,
        });
        if (cErr) throw new Error(cErr.message);
      }

      const { error: exErr } = await supabase.from('test_quiz_explanations').insert({
        question_id: questionId,
        language: 'ko',
        explanation: q.explanation ?? '',
        order_index: questionOrderIndex,
      });
      if (exErr) throw new Error(exErr.message);
    }

    return jsonResponse({
      questions: validatedQuestions,
      created_at: quizRow.created_at ?? createdAt,
    });
  } catch (error: unknown) {
    console.error('Error generating weekly quiz:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Internal server error';
    return jsonResponse({ error: errorMessage }, 500);
  }
});
