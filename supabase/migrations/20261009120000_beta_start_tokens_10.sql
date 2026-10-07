-- Digital Wardrobe — стартовый баланс токенов для НОВЫХ пользователей: 10 (было 35).
-- Запускается один раз: Supabase → SQL Editor → New query → вставить → Run.
-- Скрипт можно безопасно запустить повторно.
--
-- Меняется только функция, из которой берётся стартовое значение (default колонок
-- tokens_balance и tokens_total). Балансы уже зарегистрированных пользователей НЕ меняются.
-- stable (а не immutable) — чтобы база не «запомнила» старое число в кэше запросов.
create or replace function public.beta_start_tokens()
returns integer
language sql
stable
as $$ select 10 $$;
