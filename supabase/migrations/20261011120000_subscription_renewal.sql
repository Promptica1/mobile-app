-- MIRRO — автопродление и отмена подписки (ЮKassa, тестовый режим).
-- Запускается один раз: Supabase → SQL Editor → New query → вставить → Run.
-- Скрипт можно безопасно запустить повторно.

-- 1. Платежи: первый платёж или продление, и за какой период продление.
alter table public.payments add column if not exists kind text not null default 'initial';
alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check check (kind in ('initial', 'renewal'));
alter table public.payments add column if not exists renewal_for timestamptz;  -- конец оплаченного периода, который продлеваем

-- Один период нельзя продлить дважды: не больше одного «живого» платежа продления на период.
-- Неудачные (canceled) не мешают повторной попытке на следующий день.
create unique index if not exists payments_one_renewal_per_period
  on public.payments (user_id, renewal_for)
  where kind = 'renewal' and status in ('pending', 'waiting_for_capture', 'succeeded');

-- 2. Подписки: отмена и неудачные попытки продления.
alter table public.subscriptions add column if not exists canceled_at timestamptz;
alter table public.subscriptions add column if not exists renewal_failures integer not null default 0;
alter table public.subscriptions add column if not exists last_renewal_attempt_at timestamptz;

-- Статусы: active — продлевается; canceled — отменена, доступ до конца периода;
-- past_due — не удалось списать, повторяем; expired — закончилась.
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('active', 'canceled', 'past_due', 'expired'));

create index if not exists subscriptions_due_idx on public.subscriptions (status, current_period_end);
