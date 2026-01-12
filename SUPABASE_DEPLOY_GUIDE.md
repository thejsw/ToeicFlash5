# Supabase Edge Function 배포 가이드

## 방법 1: Supabase Dashboard에서 직접 배포 (권장 ⭐)

### 1. Supabase Dashboard 접속
1. https://supabase.com/dashboard 접속
2. 프로젝트 선택

### 2. Edge Functions 페이지 이동
- 좌측 메뉴에서 **Edge Functions** 클릭
- 또는 직접 URL: `https://supabase.com/dashboard/project/YOUR_PROJECT_ID/functions`

### 3. 새 함수 생성
1. **Create a new function** 또는 **New Function** 버튼 클릭
2. 함수 이름: `generate-quiz` 입력
3. 코드 에디터에 아래 코드 붙여넣기

### 4. 코드 복사 (아래 전체 코드)

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const { day, words } = await req.json();

    if (!day || !words || !Array.isArray(words)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: day and words array are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
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

    let parsedContent: any;
    try {
      parsedContent = JSON.parse(content);
    } catch (e) {
      throw new Error('Failed to parse JSON response');
    }

    let questions: any[];
    if (Array.isArray(parsedContent)) {
      questions = parsedContent;
    } else if (parsedContent.questions && Array.isArray(parsedContent.questions)) {
      questions = parsedContent.questions;
    } else if (parsedContent.data && Array.isArray(parsedContent.data)) {
      questions = parsedContent.data;
    } else {
      throw new Error('Invalid response format: expected array of questions or object with questions key');
    }

    if (questions.length > 3) {
      questions = questions.slice(0, 3);
    }

    const validatedQuestions = questions
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

    return new Response(JSON.stringify({ questions: validatedQuestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating quiz:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
```

### 5. 배포 (Deploy)
- **Deploy** 버튼 클릭
- 배포 완료까지 대기 (수십 초 소요)

### 6. 환경 변수 설정 (중요!)
1. Edge Functions 페이지에서 **Settings** 탭 클릭
2. **Secrets** 섹션으로 이동
3. **Add Secret** 클릭
4. 입력:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: `sk-xxxx...` (실제 OpenAI API Key)
5. **Save** 클릭

---

## 방법 2: Supabase CLI 설치 후 배포

### 1. Supabase CLI 설치 (Windows)

#### 옵션 A: npm으로 설치 (추천)
```bash
npm install -g supabase
```

#### 옵션 B: Scoop으로 설치
```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

#### 옵션 C: 직접 다운로드
1. https://github.com/supabase/cli/releases 접속
2. Windows용 `.exe` 파일 다운로드
3. PATH 환경 변수에 추가

### 2. CLI로 배포
```bash
# 로그인
supabase login

# 프로젝트 연결
supabase link --project-ref YOUR_PROJECT_REF

# 함수 배포
supabase functions deploy generate-quiz

# 환경 변수 설정
supabase secrets set OPENAI_API_KEY=sk-xxxx...
```

---

## ✅ 배포 확인

배포가 완료되면 앱에서 퀴즈 기능이 정상 작동해야 합니다.

## 📝 참고
- 함수 이름은 반드시 `generate-quiz`여야 합니다 (코드에서 이 이름으로 호출함)
- OpenAI API Key는 반드시 Secrets에 설정해야 합니다
- 배포 후 몇 분 정도 시간이 걸릴 수 있습니다

