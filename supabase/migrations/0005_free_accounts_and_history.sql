-- Divinatey: free-account allowances and kept readings (chat history).
-- Run after 0001–0004 in the Supabase SQL editor.

-- ── Weekly allowances for free accounts ───────────────────────────────────────
-- kind 'chat': one row per oracle chat message (key is random).
-- kind 'chart_reading': the chart (system|date|time|timezone) given its weekly AI reading.
create table if not exists public.account_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  kind text not null check (kind in ('chat', 'chart_reading')),
  key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, week_start, kind, key)
);

-- ── Readings: each draw's interpretation and chat, kept with the account ───────
-- data is {interp, messages}, sealed by the server when CHART_ENCRYPTION_KEY is set.
create table if not exists public.readings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  seed text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, seed)
);
create index if not exists readings_recent on public.readings (user_id, updated_at desc);

-- Server only (service role): no policies.
alter table public.account_usage enable row level security;
alter table public.readings enable row level security;
