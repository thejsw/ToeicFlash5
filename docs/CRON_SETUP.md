# Mock Exam 자동 생성 Cron 설정

매주 월요일 00:30 (KST)에 주차별 모의고사가 자동 생성되도록 pg_cron을 설정합니다.

## 사전 요구사항

- Supabase 프로젝트 (Hosted)
- Edge Function `generate-weekly-quiz` 배포 완료
- Edge Function 시크릿 설정 완료 (`OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)

## 1. 확장(Extensions) 활성화

Supabase 대시보드 → **Database** → **Extensions**에서 다음 확장을 활성화합니다:

- `pg_cron` — 스케줄러
- `pg_net` — HTTP 요청 (Edge Function 호출)
- `vault` — 시크릿 저장 (프로젝트 URL, anon key)

## 2. Vault 시크릿 생성

Supabase 대시보드 → **SQL Editor**에서 아래 SQL을 실행합니다.  
`YOUR_PROJECT_REF`와 `YOUR_ANON_KEY`를 실제 값으로 교체하세요.

```sql
-- 프로젝트 URL (예: https://fruuhjybiniukkixfdof.supabase.co)
select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');

-- anon key (Settings → API → anon public)
select vault.create_secret('YOUR_ANON_KEY', 'anon_key');
```

> **참고**: `generate-weekly-quiz`는 `verify_jwt = false`이므로 anon key로 호출 가능합니다.

## 3. 마이그레이션 실행

로컬에서 Supabase CLI로 마이그레이션을 적용합니다:

```bash
supabase db push
```

또는 Supabase 대시보드 **SQL Editor**에서  
`supabase/migrations/20250219120000_schedule_weekly_mock_cron.sql` 파일 내용을 복사해 실행합니다.

## 4. 동작 확인

- **cron.job**: `weekly-mock-exam-generate` 항목이 등록됩니다.
- **실행 시각**: 매주 일요일 15:30 UTC = 월요일 00:30 KST
- **대상 주차**: 실행 시점의 KST 기준 해당 주차로 생성됩니다.

### 수동 테스트

마이그레이션 적용 후, SQL Editor에서 아래를 실행해 즉시 호출할 수 있습니다:

```sql
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/generate-weekly-quiz',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
  ),
  body := '{}'::jsonb
) as request_id;
```

## 5. 스케줄 변경

다른 시간대로 변경하려면 `cron.schedule`의 두 번째 인자(cron 표현식)를 수정합니다.

| 목표 | cron 표현식 |
|------|-------------|
| 매주 월요일 00:30 KST | `30 15 * * 0` (일요일 15:30 UTC) |
| 매주 월요일 09:30 KST | `30 0 * * 1` (월요일 00:30 UTC) |
| 매분 (테스트용) | `* * * * *` |

기존 job 제거 후 재등록:

```sql
select cron.unschedule('weekly-mock-exam-generate');
-- 새 schedule 적용
```
