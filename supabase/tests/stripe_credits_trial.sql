-- Проверка SQL-логики Stripe: начисление credits и правило «один триал на человека».
-- Запуск на ПУСТОЙ тестовой базе Postgres (не на боевой!), из корня репозитория:
--   psql -v ON_ERROR_STOP=1 -d <тестовая_база> -f supabase/tests/stripe_credits_trial.sql
-- Файл сам создаёт минимальные заглушки таблиц Supabase и применяет миграцию Stripe.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create table if not exists public.profiles (id uuid primary key references auth.users (id) on delete cascade, tokens_balance integer not null default 10, tokens_total integer not null default 10);
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free', status text not null default 'active', current_period_end timestamptz
);

\i supabase/migrations/20261015120000_stripe.sql
-- Повторный запуск миграции не должен падать.
\i supabase/migrations/20261015120000_stripe.sql

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003');
insert into public.profiles (id) select id from auth.users;

do $$
declare
  u1 constant uuid := '00000000-0000-0000-0000-000000000001';
  u2 constant uuid := '00000000-0000-0000-0000-000000000002';
  u3 constant uuid := '00000000-0000-0000-0000-000000000003';
  r text;
  b integer;
begin
  -- ── Начисление credits ────────────────────────────────────────────────────────
  assert public.grant_credits('checkout:cs_1', u1, 'checkout', 15) = true, 'first grant must apply';
  select tokens_balance into b from public.profiles where id = u1;
  assert b = 15, 'trial gives 15';

  update public.profiles set tokens_balance = 4 where id = u1;           -- потратил 11
  assert public.grant_credits('checkout:cs_1', u1, 'checkout', 15) = false, 'same key must not grant twice';
  select tokens_balance into b from public.profiles where id = u1;
  assert b = 4, 'repeat webhook must not refill';

  assert public.grant_credits('invoice:in_1', u1, 'invoice', 30) = true, 'renewal grants';
  select tokens_balance into b from public.profiles where id = u1;
  assert b = 30, 'balance is reset to 30, not 4+30';
  select tokens_total into b from public.profiles where id = u1;
  assert b = 30, 'total follows the plan';

  assert public.grant_credits('annual:sub_9:2026-11-01', u1, 'cron', 25) = true;
  select tokens_balance into b from public.profiles where id = u1;
  assert b = 25, 'annual monthly grant resets to 25';

  perform public.expire_credits(u1);
  select tokens_balance into b from public.profiles where id = u1;
  assert b = 0, 'unused credits are zeroed when the subscription ends';

  begin
    perform public.grant_credits('bad', u1, 'x', 0);
    assert false, 'zero credits must raise';
  exception when raise_exception then null;
  end;

  -- ── Один триал на человека ────────────────────────────────────────────────────
  assert public.trial_available(u1, 'hash_a') = true, 'fresh person can take a trial';
  r := public.claim_trial(u1, 'hash_a', 'sub_1', 'fp_1');
  assert r = 'ok', 'first claim ok, got ' || r;
  assert public.trial_available(u1, 'hash_zzz') = false, 'same user cannot take a second trial';
  assert public.trial_available(u2, 'hash_a') = false, 'same email on another account cannot';
  assert public.trial_available(u2, 'hash_b') = true, 'a different person can';

  assert public.claim_trial(u1, 'hash_a', 'sub_1', 'fp_1') = 'ok', 'webhook retry for the same subscription is ok';
  assert public.claim_trial(u1, 'hash_c', 'sub_2', 'fp_9') = 'user_used', 'same user, new subscription';
  assert public.claim_trial(u2, 'hash_a', 'sub_3', 'fp_8') = 'email_used', 'same email, new account';
  assert public.claim_trial(u2, 'hash_b', 'sub_4', 'fp_1') = 'card_used', 'same card, new account and email';
  assert not exists (select 1 from public.trial_claims where user_id = u2), 'rejected claims leave no record';
  assert public.claim_trial(u2, 'hash_b', 'sub_5', 'fp_2') = 'ok', 'different person and card';
  assert public.claim_trial(u3, 'hash_d', 'sub_6', null) = 'ok', 'unknown card still claims by account and email';

  -- Удаление аккаунта не освобождает триал.
  delete from auth.users where id = u1;
  assert public.trial_available('00000000-0000-0000-0000-0000000000ff', 'hash_a') = false, 'deleting the account does not free the trial';
  assert public.claim_trial('00000000-0000-0000-0000-0000000000ff', 'hash_x', 'sub_7', 'fp_1') = 'card_used', 'card stays blocked';

  -- ── Права ────────────────────────────────────────────────────────────────────
  assert not has_function_privilege('authenticated', 'public.grant_credits(text,uuid,text,integer)', 'execute'), 'browser cannot grant credits';
  assert not has_function_privilege('anon', 'public.claim_trial(uuid,text,text,text)', 'execute'), 'anon cannot claim';
  assert has_function_privilege('service_role', 'public.grant_credits(text,uuid,text,integer)', 'execute'), 'server can grant';
  assert not has_table_privilege('authenticated', 'public.credit_grants', 'select'), 'grants are server-only';

  raise notice 'STRIPE SQL TESTS: all passed';
end $$;
