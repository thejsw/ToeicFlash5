# Mock Exam 자동 생성 Cron 설정

매주 월요일 00:30 (KST)에 주차별 모의고사가 자동 생성되도록 Supabase `pg_cron`을 설정합니다.

## 사전 요구사항

- Supabase Hosted 프로젝트
- Edge Function `generate-weekly-quiz` 배포 완료
- Edge Function secrets 설정 완료:
  - `OPENAI_API_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `CRON_SECRET`
- 노출된 로컬/클라이언트 환경변수에 OpenAI 키나 service-role 키가 없는 상태

이미 공개 저장소, 앱 번들, 로그 등에 OpenAI 키 또는 service-role 키가 노출됐다면 해당 키를 폐기하고 재발급하세요.

## 1. 확장 활성화

Supabase 대시보드의 **Database > Extensions**에서 다음 확장을 활성화합니다.

- `pg_cron`: 스케줄러
- `pg_net`: Edge Function HTTP 호출
- `vault`: 프로젝트 URL, publishable key, cron secret 저장

## 2. Edge Function Secrets 설정

대시보드 또는 CLI에서 Edge Function secrets를 설정합니다.

```bash
npx supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_KEY
npx supabase secrets set SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
npx supabase secrets set CRON_SECRET=YOUR_RANDOM_CRON_SECRET
```

`CRON_SECRET`은 충분히 긴 랜덤 문자열로 만들고 클라이언트 코드에 넣지 않습니다.

## 3. Vault Secrets 생성

Supabase SQL Editor에서 아래 SQL을 실행합니다.

```sql
select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
select vault.create_secret('YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY', 'publishable_key');
select vault.create_secret('YOUR_RANDOM_CRON_SECRET', 'weekly_quiz_cron_secret');
```

`weekly_quiz_cron_secret` 값은 Edge Function secret `CRON_SECRET`과 같아야 합니다.

## 4. 마이그레이션 실행

```bash
npx supabase db push
```

적용되는 핵심 변경은 다음과 같습니다.

- `weekly_quiz_generation_logs` 생성
- `quizzes(type, week_num)`의 주간 모의고사 중복 방지 unique index 생성
- 기존 `weekly-mock-exam-generate` cron job 재등록
- cron 호출에 `x-cron-secret` 헤더 추가

## 5. 동작 확인

- **cron.job**: `weekly-mock-exam-generate`
- **실행 시각**: 매주 일요일 15:30 UTC = 월요일 00:30 KST
- **대상 주차**: 실행 시점의 KST 기준 `year`, `month`, `week` body로 생성
- **로그 확인**: `weekly_quiz_generation_logs`에서 `started`, `success`, `already_exists`, `failed`, `unauthorized` 상태 확인

### 수동 테스트

SQL Editor에서 즉시 호출할 수 있습니다.

```sql
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/generate-weekly-quiz',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
    'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'weekly_quiz_cron_secret')
  ),
  body := '{}'::jsonb
) as request_id;
```

잘못된 `x-cron-secret`으로 호출하면 401이 반환되어야 합니다.

## 6. 스케줄 변경

다른 시간대로 변경하려면 `cron.schedule`의 두 번째 인자만 조정합니다.

| 목표 | cron 표현식 |
|------|-------------|
| 매주 월요일 00:30 KST | `30 15 * * 0` |
| 매주 월요일 09:30 KST | `30 0 * * 1` |
| 매분 테스트 | `* * * * *` |
