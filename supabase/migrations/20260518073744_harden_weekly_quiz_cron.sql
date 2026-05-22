-- Harden weekly mock generation for cron-only execution.
-- Required Vault secrets before this migration runs:
--   select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
--   select vault.create_secret('YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY', 'publishable_key');
--   select vault.create_secret('YOUR_RANDOM_CRON_SECRET', 'weekly_quiz_cron_secret');

create table if not exists public.weekly_quiz_generation_logs (
  id uuid primary key default gen_random_uuid(),
  week_num int4,
  quiz_id uuid references public.quizzes(id) on delete set null,
  status text not null check (
    status in ('started', 'success', 'already_exists', 'failed', 'unauthorized')
  ),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.weekly_quiz_generation_logs enable row level security;

create index if not exists weekly_quiz_generation_logs_week_created_idx
  on public.weekly_quiz_generation_logs (week_num, created_at desc);

create temp table _duplicate_weekly_quizzes on commit drop as
select id
from (
  select
    id,
    row_number() over (
      partition by type, week_num
      order by created_at asc nulls last, id asc
    ) as row_num
  from public.quizzes
  where type = 'weekly_mock_light'
    and week_num is not null
) ranked
where row_num > 1;

create temp table _duplicate_weekly_questions on commit drop as
select id
from public.quiz_questions
where quiz_id in (select id from _duplicate_weekly_quizzes);

delete from public.quiz_choices
where question_id in (select id from _duplicate_weekly_questions);

delete from public.quiz_explanations
where question_id in (select id from _duplicate_weekly_questions);

delete from public.quiz_questions
where id in (select id from _duplicate_weekly_questions);

delete from public.quizzes
where id in (select id from _duplicate_weekly_quizzes);

create unique index if not exists quizzes_weekly_mock_type_week_num_uidx
  on public.quizzes (type, week_num)
  where type = 'weekly_mock_light'
    and week_num is not null;

do $$
begin
  perform cron.unschedule('weekly-mock-exam-generate');
exception when others then
  null;
end $$;

select cron.schedule(
  'weekly-mock-exam-generate',
  '30 15 * * 0',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/generate-weekly-quiz',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'weekly_quiz_cron_secret')
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
