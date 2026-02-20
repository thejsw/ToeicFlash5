-- Mock Exam 자동 생성 스케줄: 매주 월요일 00:30 (KST)
-- pg_cron + pg_net으로 Edge Function generate-weekly-quiz 호출
--
-- 사전 설정 (Supabase 대시보드에서):
--   1. Database → Extensions → pg_cron, pg_net, vault 활성화
--   2. SQL Editor에서 Vault 시크릿 생성 (1회):
--      select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
--      select vault.create_secret('YOUR_ANON_KEY', 'anon_key');
--
-- 시간대: 00:30 KST = 15:30 UTC (일요일) → cron: 30 15 * * 0

-- 기존 동일 이름 job 제거 후 재등록 (멱등성)
do $$
begin
  perform cron.unschedule('weekly-mock-exam-generate');
exception when others then
  null;
end $$;

select cron.schedule(
  'weekly-mock-exam-generate',
  '30 15 * * 0',  -- 매주 일요일 15:30 UTC = 월요일 00:30 KST
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/generate-weekly-quiz',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
    ),
    body := jsonb_build_object(
      'year', extract(year from (now() AT TIME ZONE 'Asia/Seoul'))::int,
      'month', extract(month from (now() AT TIME ZONE 'Asia/Seoul'))::int,
      'week', case
        when extract(day from (now() AT TIME ZONE 'Asia/Seoul')) <= 7 then 1
        when extract(day from (now() AT TIME ZONE 'Asia/Seoul')) <= 14 then 2
        when extract(day from (now() AT TIME ZONE 'Asia/Seoul')) <= 21 then 3
        when extract(day from (now() AT TIME ZONE 'Asia/Seoul')) <= 28 then 4
        else 5
      end
    )
  ) as request_id;
  $$
);
