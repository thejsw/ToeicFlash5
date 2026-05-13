import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../.env"),
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/57760822-afc0-4241-84bd-3d7185be3e6b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'boot-check',hypothesisId:'H1',location:'backend/modules/quiz/quiz.repository.ts:13',message:'dotenv loaded',data:{envPath:path.basename(envPath)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    break;
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
const WEEKLY_MOCK_TYPE = "weekly_mock_light";
const ORDER_KEYS = ["A", "B", "C", "D"];
const ORDER_INDEX_BASE = 5001;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/57760822-afc0-4241-84bd-3d7185be3e6b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'boot-check',hypothesisId:'H1',location:'backend/modules/quiz/quiz.repository.ts:24',message:'supabase env missing',data:{hasSupabaseUrl:Boolean(SUPABASE_URL),hasServiceRoleKey:Boolean(SUPABASE_SERVICE_ROLE_KEY)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
}

// #region agent log
fetch('http://127.0.0.1:7243/ingest/57760822-afc0-4241-84bd-3d7185be3e6b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'boot-check',hypothesisId:'H1',location:'backend/modules/quiz/quiz.repository.ts:29',message:'supabase env ready',data:{hasSupabaseUrl:true,hasServiceRoleKey:true},timestamp:Date.now()})}).catch(()=>{});
// #endregion

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export type GeneratedQuestion = {
  question: string;
  choices: string[];
  answer: string;
  explanation: string;
};

export const findWeeklyQuizByWeekNum = async (weekNum: number) => {
  const { data, error } = await supabase
    .from("quizzes")
    .select("id")
    .eq("type", WEEKLY_MOCK_TYPE)
    .eq("week_num", weekNum)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const getPlaceholderWordId = async () => {
  const { data, error } = await supabase.from("words").select("id").limit(1).maybeSingle();
  if (error || !data?.id) {
    throw new Error("words 테이블에 단어가 없어 주차 퀴즈를 저장할 수 없습니다.");
  }
  return data.id as string;
};

export const saveWeeklyQuiz = async (weekNum: number, questions: GeneratedQuestion[]) => {
  const createdAt = new Date().toISOString();
  const placeholderWordId = await getPlaceholderWordId();

  const { data: quizRow, error: quizErr } = await supabase
    .from("quizzes")
    .insert({
      id: crypto.randomUUID(),
      type: WEEKLY_MOCK_TYPE,
      week_num: weekNum,
      created_at: createdAt,
    })
    .select("id, created_at")
    .single();

  if (quizErr || !quizRow?.id) {
    throw new Error(quizErr?.message ?? "quizzes insert failed");
  }

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const questionOrderIndex = ORDER_INDEX_BASE + i;
    const { data: questionRow, error: qErr } = await supabase
      .from("quiz_questions")
      .insert({
        id: crypto.randomUUID(),
        word_id: placeholderWordId,
        quiz_id: quizRow.id,
        question_text: q.question,
        order_index: questionOrderIndex,
      })
      .select("id")
      .single();

    if (qErr || !questionRow?.id) {
      throw new Error(qErr?.message ?? "quiz_questions insert failed");
    }

    for (let j = 0; j < q.choices.length; j++) {
      const choiceText = String(q.choices[j] ?? "").trim();
      if (!choiceText) continue;

      const { error: cErr } = await supabase.from("quiz_choices").insert({
        id: crypto.randomUUID(),
        question_id: questionRow.id,
        choice_key: ORDER_KEYS[j] ?? String.fromCharCode(65 + j),
        choice_text: choiceText,
        is_correct: choiceText === q.answer,
      });
      if (cErr) throw new Error(cErr.message);
    }

    const { error: exErr } = await supabase.from("quiz_explanations").insert({
      id: crypto.randomUUID(),
      question_id: questionRow.id,
      language: "ko",
      explanation: q.explanation ?? "",
    });
    if (exErr) throw new Error(exErr.message);
  }

  return { createdAt: quizRow.created_at ?? createdAt };
};
