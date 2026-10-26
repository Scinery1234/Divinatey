-- Billing: Stripe subscriptions, extra questions, and webhook idempotency.

alter table public.profiles
  add column if not exists subscription_id text,
  add column if not exists subscription_status text,
  add column if not exists billing_interval text check (billing_interval in ('month', 'year')),
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists extra_questions integer not null default 0 check (extra_questions >= 0);

-- Each Stripe event is applied once, even if Stripe delivers it again.
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;   -- server only

-- Uses one purchased extra question if the user has any. Returns true if one was used.
create or replace function public.use_extra_question(uid uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.profiles set extra_questions = extra_questions - 1
    where id = uid and extra_questions > 0
    returning extra_questions into n;
  return n is not null;
end;
$$;

create or replace function public.add_extra_questions(uid uuid, n integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set extra_questions = extra_questions + n where id = uid;
end;
$$;

revoke execute on function public.use_extra_question(uuid) from public, anon, authenticated;
revoke execute on function public.add_extra_questions(uuid, integer) from public, anon, authenticated;
