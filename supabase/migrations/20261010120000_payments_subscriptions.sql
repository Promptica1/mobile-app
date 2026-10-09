-- MIRRO — подписки и платежи ЮKassa (этап 1: первый платёж с сохранением карты).
-- Запускается один раз: Supabase → SQL Editor → New query → вставить → Run.
-- Скрипт можно безопасно запустить повторно.
--
-- Записывает в эти таблицы ТОЛЬКО сервер приложения (сервисным ключом) после того, как
-- проверил платёж в ЮKassa. Пользователь может только читать свои строки — выдать себе
-- тариф или подменить карту из браузера нельзя (политик на запись нет).

-- 1. Платежи: каждая попытка оплаты.
create table if not exists public.payments (
  id                  uuid primary key default gen_random_uuid(),   -- наш номер заказа
  user_id             uuid references auth.users (id) on delete set null,
  plan                text not null check (plan in ('premium', 'premium_plus')),
  amount              numeric(10, 2) not null,
  currency            text not null default 'RUB',
  yookassa_payment_id text unique,
  status              text not null default 'pending'
                      check (status in ('pending', 'waiting_for_capture', 'succeeded', 'canceled')),
  test                boolean not null default true,
  payment_method_id   text,
  cancellation_reason text,
  paid_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists payments_user_id_idx on public.payments (user_id, created_at desc);

alter table public.payments enable row level security;
drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments
  for select to authenticated using (user_id = (select auth.uid()));

-- 2. Подписка пользователя (одна строка на пользователя).
create table if not exists public.subscriptions (
  user_id                     uuid primary key references auth.users (id) on delete cascade,
  plan                        text not null default 'free' check (plan in ('free', 'premium', 'premium_plus')),
  status                      text not null default 'active' check (status in ('active', 'canceled', 'past_due')),
  started_at                  timestamptz,
  current_period_end          timestamptz,
  yookassa_payment_method_id  text,      -- сохранённая карта для будущих автосписаний
  card_last4                  text,
  card_type                   text,
  last_payment_id             uuid references public.payments (id) on delete set null,
  test                        boolean not null default true,
  updated_at                  timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

-- Явно запрещаем запись из браузера (на случай широких прав по умолчанию).
revoke insert, update, delete on public.payments from anon, authenticated;
revoke insert, update, delete on public.subscriptions from anon, authenticated;
