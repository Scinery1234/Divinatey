-- Linked-chart questions: paid accounts get a weekly allowance. One question =
-- one draw (seed) asked with linked charts; follow-ups on the same draw are free.
create table if not exists public.linked_questions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,        -- Monday (UTC) of the week it was asked
  seed bigint not null,
  asked_at timestamptz not null default now(),
  primary key (user_id, week_start, seed)
);
alter table public.linked_questions enable row level security;
drop policy if exists "read own linked questions" on public.linked_questions;
create policy "read own linked questions" on public.linked_questions
  for select to authenticated using ((select auth.uid()) = user_id);
-- Writes come from the server only.
