-- MIRRO — оплата через Stripe (пользователи вне России). ЮKassa не затрагивается.
-- Запускается один раз: Supabase → SQL Editor → New query → вставить → Run.
-- Скрипт можно безопасно запустить повторно.
--
-- Всё, что связано с деньгами и credits, пишет только сервер (сервисный ключ) после проверки
-- события Stripe. Браузеру эти таблицы и функции недоступны.

-- 1. Подписка: откуда она (ЮKassa или Stripe) и данные Stripe.
alter table public.subscriptions add column if not exists provider text not null default 'yookassa';
alter table public.subscriptions drop constraint if exists subscriptions_provider_check;
alter table public.subscriptions add constraint subscriptions_provider_check check (provider in ('yookassa', 'stripe'));
alter table public.subscriptions add column if not exists stripe_customer_id text;
alter table public.subscriptions add column if not exists stripe_subscription_id text;
alter table public.subscriptions add column if not exists offer text;                 -- trial / trial_free / annual / monthly
alter table public.subscriptions add column if not exists billing_interval text;      -- month / year
alter table public.subscriptions add column if not exists is_trial boolean not null default false;
alter table public.subscriptions add column if not exists trial_end timestamptz;
alter table public.subscriptions add column if not exists credits_next_grant_at timestamptz;  -- годовой план: когда следующий месячный пакет
alter table public.subscriptions add column if not exists trial_email_sent_at timestamptz;
alter table public.subscriptions add column if not exists renewal_reminder_for timestamptz;   -- за какое продление уже напомнили
create unique index if not exists subscriptions_stripe_subscription_idx
  on public.subscriptions (stripe_subscription_id) where stripe_subscription_id is not null;

-- 2. Клиент Stripe пользователя (один на пользователя).
create table if not exists public.stripe_customers (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  customer_id text not null unique,
  created_at  timestamptz not null default now()
);
alter table public.stripe_customers enable row level security;
revoke all on public.stripe_customers from anon, authenticated;

-- 3. Один триал на человека. Запись остаётся и после удаления аккаунта (user_id → null),
-- поэтому «удалить аккаунт и взять триал снова» не работает. Почта хранится только хэшем.
create table if not exists public.trial_claims (
  id                bigint generated always as identity primary key,
  user_id           uuid unique references auth.users (id) on delete set null,
  email_hash        text not null unique,        -- sha256 нормализованной почты
  card_fingerprint  text unique,                 -- отпечаток карты (Stripe), если известен
  subscription_id   text,
  claimed_at        timestamptz not null default now()
);
alter table public.trial_claims enable row level security;
revoke all on public.trial_claims from anon, authenticated;

-- Можно ли этому человеку взять триал (проверка до оплаты).
create or replace function public.trial_available(p_user uuid, p_email_hash text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.trial_claims where user_id = p_user or email_hash = p_email_hash
  );
$$;

-- Занять триал за человеком (после оплаты, когда известна карта). Результат:
--   ok        — триал за ним (или уже был за этой же подпиской: повтор webhook безопасен);
--   user_used / email_used / card_used — триал уже брали с этим аккаунтом / почтой / картой.
create or replace function public.claim_trial(p_user uuid, p_email_hash text, p_subscription_id text, p_fingerprint text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.trial_claims%rowtype;
begin
  -- Две одновременные оплаты одного человека выстраиваются в очередь.
  perform pg_advisory_xact_lock(hashtext(p_email_hash));

  select * into existing from public.trial_claims where subscription_id = p_subscription_id;
  if found then
    if p_fingerprint is not null and existing.card_fingerprint is null then
      if exists (select 1 from public.trial_claims where card_fingerprint = p_fingerprint) then
        return 'card_used';
      end if;
      update public.trial_claims set card_fingerprint = p_fingerprint where id = existing.id;
    end if;
    return 'ok';
  end if;

  if exists (select 1 from public.trial_claims where user_id = p_user) then return 'user_used'; end if;
  if exists (select 1 from public.trial_claims where email_hash = p_email_hash) then return 'email_used'; end if;
  if p_fingerprint is not null and exists (select 1 from public.trial_claims where card_fingerprint = p_fingerprint) then
    return 'card_used';
  end if;

  insert into public.trial_claims (user_id, email_hash, card_fingerprint, subscription_id)
  values (p_user, p_email_hash, p_fingerprint, p_subscription_id);
  return 'ok';
end;
$$;

-- 4. Начисление credits. Баланс не складывается, а «сбрасывается» до числа тарифа
-- (неиспользованные credits прошлого периода сгорают). Один ключ = одно начисление:
-- повтор webhook или повторный запуск cron ничего не меняет.
create table if not exists public.credit_grants (
  key         text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  source      text not null,
  credits     integer not null check (credits > 0),
  granted_at  timestamptz not null default now()
);
create index if not exists credit_grants_user_idx on public.credit_grants (user_id, granted_at desc);
alter table public.credit_grants enable row level security;
revoke all on public.credit_grants from anon, authenticated;

-- true — начислено сейчас, false — по этому ключу уже начисляли.
create or replace function public.grant_credits(p_key text, p_user uuid, p_source text, p_credits integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_credits is null or p_credits <= 0 then
    raise exception 'bad credits amount';
  end if;
  insert into public.credit_grants (key, user_id, source, credits)
  values (p_key, p_user, p_source, p_credits)
  on conflict (key) do nothing;
  if not found then
    return false;
  end if;
  update public.profiles set tokens_balance = p_credits, tokens_total = p_credits where id = p_user;
  return true;
end;
$$;

-- Подписка закончилась: оставшиеся credits обнуляются.
create or replace function public.expire_credits(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set tokens_balance = 0 where id = p_user;
$$;

revoke all on function public.trial_available(uuid, text) from public, anon, authenticated;
revoke all on function public.claim_trial(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.grant_credits(text, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.expire_credits(uuid) from public, anon, authenticated;
grant execute on function public.trial_available(uuid, text) to service_role;
grant execute on function public.claim_trial(uuid, text, text, text) to service_role;
grant execute on function public.grant_credits(text, uuid, text, integer) to service_role;
grant execute on function public.expire_credits(uuid) to service_role;
