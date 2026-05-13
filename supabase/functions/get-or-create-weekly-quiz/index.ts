// @ts-nocheck
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const WEEKLY_MOCK_TYPE = 'weekly_mock_light';

serve(async (req: Request) => {
  const { weekNum } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1️⃣ 조회
  const { data: existingQuiz } = await supabase
    .from("quizzes")
    .select("*")
    .eq("type", WEEKLY_MOCK_TYPE)
    .eq("week_num", weekNum)
    .maybeSingle();

  if (existingQuiz) {
    return new Response(JSON.stringify(existingQuiz), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2️⃣ 없으면 생성 함수 호출 (기존 함수 재사용)
  const res = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-weekly-quiz`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ weekNum }),
    }
  );
  let generateErrText = '';
  if (!res.ok) {
    generateErrText = await res.text().catch(() => '');
  }

  // 3️⃣ 다시 조회
  const { data: newQuiz } = await supabase
    .from("quizzes")
    .select("*")
    .eq("type", WEEKLY_MOCK_TYPE)
    .eq("week_num", weekNum)
    .maybeSingle();

  if (!newQuiz) {
    return new Response(
      JSON.stringify({
        error: `주차 퀴즈 생성 후에도 DB에서 조회되지 않았습니다.${generateErrText ? ` (${generateErrText})` : ''}`,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify(newQuiz), {
    headers: { "Content-Type": "application/json" },
  });
});