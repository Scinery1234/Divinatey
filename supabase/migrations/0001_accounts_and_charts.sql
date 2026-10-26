-- Divinatey: accounts, saved charts and the free-tier daily chart count.
-- Run once in the Supabase SQL editor (or with `supabase db push`).
--
-- The browser uses the anon key only to sign in. Every read and write of these
-- tables goes through the Divinatey server with the service-role key, which
-- checks the plan first; row-level security blocks direct access otherwise.

-- ── Profiles: one per auth user ───────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'paid')),
  plan_renews_at timestamptz,
  stripe_customer_id text unique,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Saved charts: paid accounts have two slots ────────────────────────────────
create table if not exists public.charts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  slot smallint not null check (slot in (1, 2)),
  system text not null check (system in ('gene-keys', 'human-design', 'natal', 'vedic')),
  name text not null default '' check (char_length(name) <= 60),
  birth jsonb not null,           -- {date, time, tz, lat?, lon?, place}
  updated_at timestamptz not null default now(),
  primary key (user_id, slot)
);

-- ── Free tier: different charts opened per IP per UTC day ─────────────────────
-- ip_hash and chart_hash are HMACs keyed with a server secret, never raw values.
create table if not exists public.free_chart_usage (
  day date not null,
  ip_hash text not null,
  chart_hash text not null,
  primary key (day, ip_hash, chart_hash)
);

-- ── Row-level security ────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.charts enable row level security;
alter table public.free_chart_usage enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "read own charts" on public.charts;
create policy "read own charts" on public.charts
  for select to authenticated using ((select auth.uid()) = user_id);

-- No insert/update/delete policies: only the server (service role) writes.
-- free_chart_usage has no policies at all: server only.
