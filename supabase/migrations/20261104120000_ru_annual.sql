-- MIRRO — годовой Premium в ЮKassa (10 990 ₽ в год, 60 credits в месяц).
-- Запускается один раз: Supabase → SQL Editor → New query → вставить → Run.
-- Скрипт можно безопасно запустить повторно. Нужны выполненные предыдущие миграции (в т.ч. Stripe и тарифов).
--
-- У платежа появляется период оплаты: month — месяц (1499 ₽), year — год (10 990 ₽). Подписка хранит свой
-- период в subscriptions.billing_interval (колонка уже есть), по нему cron автопродления выбирает сумму.
alter table public.payments add column if not exists billing_interval text not null default 'month';
alter table public.payments drop constraint if exists payments_billing_interval_check;
alter table public.payments add constraint payments_billing_interval_check check (billing_interval in ('month', 'year'));
