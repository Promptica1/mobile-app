-- Проверка SQL-логики Stripe: начисление credits и правило «один триал на человека».
-- Запуск на ПУСТОЙ тестовой базе Postgres (не на боевой!), из корня репозитория:
--   psql -v ON_ERROR_STOP=1 -d <тестовая_база> -f supabase/tests/stripe_credits_trial.sql
-- Файл сам создаёт минимальные заглушки таблиц Supabase и применяет миграции Stripe и смены тарифов.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create table if not exists public.profiles (id uuid primary key references auth.users (id) on delete cascade, tokens_balance integer not null default 10, tokens_total integer not null default 10);
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free', status text not null default 'active', current_period_end timestamptz
);
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users (id) on delete set null,
  plan text not null default 'premium_plus', status text not null default 'pending', kind text not null default 'initial'
);
create table if not exists public.token_grants (payment_id uuid primary key, user_id uuid, plan text);

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

-- ═════════════ Смена тарифов: Premium+ → Premium, «триал только тем, кто не платил» ═════════════
truncate public.trial_claims, public.credit_grants, auth.users cascade;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'Anna@Example.com'),
  ('00000000-0000-0000-0000-0000000000a2', 'a.n.n.a+x@gmail.com'),
  ('00000000-0000-0000-0000-0000000000a3', 'legacy.plus@example.com'),
  ('00000000-0000-0000-0000-0000000000a4', 'newbie@example.com'),
  ('00000000-0000-0000-0000-0000000000a5', 'anna@googlemail.com');
insert into public.profiles (id) select id from auth.users;
-- Старый Premium+ с балансом 150.
update public.profiles set tokens_balance = 150, tokens_total = 150 where id = '00000000-0000-0000-0000-0000000000a3';
insert into public.subscriptions (user_id, plan, status) values ('00000000-0000-0000-0000-0000000000a3', 'premium_plus', 'active');
insert into public.payments (user_id, plan, status) values ('00000000-0000-0000-0000-0000000000a3', 'premium_plus', 'succeeded');
-- Платил до смены тарифов (платёж без строки подписки).
insert into public.payments (user_id, plan, status) values ('00000000-0000-0000-0000-0000000000a1', 'premium', 'succeeded');

\i supabase/migrations/20261103120000_tariffs.sql
-- Повторный запуск не должен падать.
\i supabase/migrations/20261103120000_tariffs.sql

do $$
declare
  a1 constant uuid := '00000000-0000-0000-0000-0000000000a1';
  a2 constant uuid := '00000000-0000-0000-0000-0000000000a2';
  a3 constant uuid := '00000000-0000-0000-0000-0000000000a3';
  a4 constant uuid := '00000000-0000-0000-0000-0000000000a4';
  a5 constant uuid := '00000000-0000-0000-0000-0000000000a5';
  pay uuid;
  r text;
  b integer;
begin
  -- Premium+ убран.
  assert (select plan from public.subscriptions where user_id = a3) = 'premium', 'Premium+ subscription moved to Premium';
  assert (select plan from public.payments where user_id = a3) = 'premium', 'Premium+ payment moved to Premium';
  select tokens_balance into b from public.profiles where id = a3;
  assert b = 60, 'balance of Premium+ users is clamped to 60, got ' || b;
  assert (select tokens_total from public.profiles where id = a3) = 60, 'total is 60';
  begin
    insert into public.subscriptions (user_id, plan) values (a4, 'premium_plus');
    assert false, 'premium_plus must be rejected';
  exception when check_violation then null;
  end;

  -- Нормализация почты совпадает с приложением (sha256 нормализованной почты).
  assert public.normalize_email_hash('  Anna@Example.COM ') = 'f7d54c22dda5b1780276601cd005909b70543fc4a6ba72d735b4cb9bbb611f01', 'plain email';
  assert public.normalize_email_hash('anna+trial2@example.com') = 'f7d54c22dda5b1780276601cd005909b70543fc4a6ba72d735b4cb9bbb611f01', 'plus tag stripped';
  assert public.normalize_email_hash('a.n.n.a+x@gmail.com') = '7dad900140d08b66a8e4f0aaeaf8f7dbb33d391f959e963d8fbd392719a11c99', 'gmail dots and plus stripped';
  assert public.normalize_email_hash('anna@googlemail.com') = '7dad900140d08b66a8e4f0aaeaf8f7dbb33d391f959e963d8fbd392719a11c99', 'googlemail = gmail';
  assert public.normalize_email_hash('a.nna@example.com') <> 'f7d54c22dda5b1780276601cd005909b70543fc4a6ba72d735b4cb9bbb611f01', 'dots matter outside gmail';

  -- Кто платил раньше, триал не получает: по аккаунту ...
  assert public.had_payment(a1) and public.had_payment(a3) and not public.had_payment(a4), 'payment history';
  assert public.trial_available(a1, 'whatever') = false, 'paid account: no trial (even with a new email)';
  assert public.trial_available(a3, 'whatever') = false, 'old Premium+ user: no trial';
  -- ... и по почте: алиас Gmail старого плательщика (a3 → legacy.plus, a1 → anna@example.com).
  assert public.trial_available(a4, public.normalize_email_hash('Anna+2@example.com')) = false, 'email of a past payer is blocked on another account';
  assert public.trial_available(a4, public.normalize_email_hash('newbie@example.com')) = true, 'person without payments can take a trial';
  assert public.claim_trial(a1, 'h_new', 'sub_x', null) <> 'ok', 'claim after a payment is refused';
  -- Оплата, о которой записи в trial_claims ещё нет, — всё равно «платил».
  insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a6', 'late@example.com');
  insert into public.profiles (id) values ('00000000-0000-0000-0000-0000000000a6');
  insert into public.payments (user_id, plan, status) values ('00000000-0000-0000-0000-0000000000a6', 'premium', 'succeeded');
  assert public.claim_trial('00000000-0000-0000-0000-0000000000a6', 'h_late', 'sub_late', null) = 'paid_before', 'payer without a claim row is refused';

  -- Новая оплата без триала тоже закрывает триал для почтового алиаса и карты.
  perform public.record_payer(a4, public.normalize_email_hash('a.n.n.a@gmail.com'), 'pay:1', 'fp_pay');
  assert public.trial_available(a2, public.normalize_email_hash('a.n.n.a+x@gmail.com')) = false, 'gmail alias of a payer is blocked';
  assert public.trial_available(a5, public.normalize_email_hash('anna@googlemail.com')) = false, 'googlemail alias of a payer is blocked';
  assert public.claim_trial(a5, public.normalize_email_hash('anna@googlemail.com'), 'sub_y', 'fp_other') = 'email_used', 'trial refused by email';
  assert public.claim_trial(a2, 'brand_new_hash', 'sub_z', 'fp_pay') = 'card_used', 'trial refused by the payer card';
  perform public.record_payer(a4, 'x', 'pay:2', 'fp_pay');   -- повтор и конфликты не падают

  -- Бронь пробного платежа алиаса не стирает запись о том, что человек уже платил.
  insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a7', 'payer.x@example.com');
  perform public.record_payer('00000000-0000-0000-0000-0000000000a7', public.normalize_email_hash('payer.x@example.com'), 'yk:paid:' || gen_random_uuid()::text, null);
  r := public.claim_trial_pending(a5, public.normalize_email_hash('Payer.X+1@example.com'), gen_random_uuid());
  assert r <> 'ok', 'payer record survives a pending claim of an alias, got ' || r;
  assert exists (select 1 from public.trial_claims where email_hash = public.normalize_email_hash('payer.x@example.com')), 'payer record is still there';

  -- ЮKassa: бронь при создании платежа и её снятие.
  pay := gen_random_uuid();
  assert public.claim_trial_pending(a2, 'hash_free_user', pay) = 'ok', 'pending claim ok';
  assert public.trial_available(a2, 'hash_free_user') = false, 'reserved while the payment is in progress';
  perform public.release_trial('yk:' || pay::text);
  assert public.trial_available(a2, 'hash_free_user') = true, 'released after a failed payment';
  -- Закрыл страницу оплаты (платёж не оплачен) — можно попробовать ещё раз с новым заказом.
  insert into public.payments (id, user_id, status, plan, kind) values (pay, a2, 'pending', 'premium', 'trial');
  assert public.claim_trial_pending(a2, 'hash_free_user', pay) = 'ok', 'first try';
  assert public.claim_trial_pending(a2, 'hash_free_user', gen_random_uuid()) = 'ok', 'retry after an abandoned payment';
  -- Оплаченный пробный платёж бронь не снимает.
  update public.payments set status = 'succeeded' where id = pay;
  r := public.claim_trial_pending(a2, 'hash_free_user', gen_random_uuid());
  assert r <> 'ok', 'a paid trial blocks a new one, got ' || r;

  raise notice 'TARIFF SQL TESTS: all passed';
end $$;
