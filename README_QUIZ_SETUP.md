# 퀴즈 기능 설정 가이드

## 🎯 변경 사항

OpenAI API Key를 클라이언트에서 서버(Supabase Edge Function)로 이동하여 보안 문제를 해결했습니다.

## 📋 설정 단계

### 1. Supabase Edge Function 배포

#### 1-1. Supabase CLI 설치 (아직 안 했다면)

```bash
npm install -g supabase
```

#### 1-2. Supabase 로그인

```bash
supabase login
```

#### 1-3. 프로젝트 연결

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

#### 1-4. Edge Function 배포

```bash
supabase functions deploy generate-quiz
```

### 2. Supabase에 OpenAI API Key 환경 변수 설정

Supabase Dashboard에서 환경 변수를 설정합니다:

1. Supabase Dashboard 접속
2. 프로젝트 선택
3. **Settings** → **Edge Functions** → **Secrets** 이동
4. 새로운 Secret 추가:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: `sk-xxxx...` (실제 OpenAI API Key)

또는 CLI로 설정:

```bash
supabase secrets set OPENAI_API_KEY=sk-xxxx...
```

### 3. 앱 코드 변경 사항

✅ **완료된 작업**:
- `supabase/functions/generate-quiz/index.ts` - Edge Function 생성
- `lib/llm.ts` - Edge Function 호출로 변경
- `app.config.ts` - OpenAI API Key 제거

### 4. 테스트

로컬에서 테스트하려면:

```bash
# Supabase 로컬 실행
supabase start

# Edge Function 로컬 테스트
supabase functions serve generate-quiz
```

## 🔒 보안 개선 사항

### Before (문제)
- ❌ API Key가 클라이언트 번들에 포함
- ❌ EAS 빌드에서 환경 변수 주입 실패
- ❌ API Key 유출 위험

### After (해결)
- ✅ API Key는 서버(Edge Function)에서만 관리
- ✅ 클라이언트는 Edge Function만 호출
- ✅ API Key 완전 보호

## 📚 참고 자료

- [Supabase Edge Functions 문서](https://supabase.com/docs/guides/functions)
- [Edge Functions Secrets 관리](https://supabase.com/docs/guides/functions/secrets)






