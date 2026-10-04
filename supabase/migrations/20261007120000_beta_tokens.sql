-- Digital Wardrobe — токены для бета-тестеров (простой контроль расходов, не биллинг).
-- Запускается один раз: Supabase → SQL Editor → New query → вставить → Run.
-- Скрипт можно безопасно запустить повторно.
--
-- Один баланс на пользователя. Каждая новая платная генерация Runware (вырезание вещи,
-- новая примерка, создание аватара) списывает 1 токен — только после успеха и только
-- на сервере. Повтор сохранённой примерки и неудачные генерации бесплатны.
--
-- ПОПОЛНИТЬ баланс одному пользователю (выполнить в SQL Editor, подставив email):
--   update public.profiles
--      set tokens_balance = tokens_balance + 10, tokens_total = tokens_total + 10
--    where id = (select id from auth.users where email = 'friend@example.com');

-- 1. Стартовый баланс — ЕДИНСТВЕННОЕ место, где задано число. Чтобы изменить для новых
--    пользователей: поменяйте 35 и выполните этот блок ещё раз.
create or replace function public.beta_start_tokens()
returns integer
language sql
immutable
as $$ select 35 $$;

-- 2. Баланс и «из скольких» (tokens_total растёт при пополнении).
--    Существующие пользователи получают стартовый баланс автоматически.
alter table public.profiles add column if not exists tokens_balance integer not null default public.beta_start_tokens();
alter table public.profiles add column if not exists tokens_total integer not null default public.beta_start_tokens();
alter table public.profiles alter column tokens_balance set default public.beta_start_tokens();
alter table public.profiles alter column tokens_total set default public.beta_start_tokens();
alter table public.profiles drop constraint if exists profiles_tokens_balance_check;
alter table public.profiles add constraint profiles_tokens_balance_check check (tokens_balance >= 0);

-- 3. Из браузера (роли anon/authenticated) баланс поменять нельзя: при обновлении профиля
--    значения токенов остаются прежними, при вставке — стартовыми.
--    SQL Editor, сервисный ключ и функция spend_token() работают как обычно.
create or replace function public.protect_profile_tokens()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.tokens_balance := public.beta_start_tokens();
      new.tokens_total := public.beta_start_tokens();
    else
      new.tokens_balance := old.tokens_balance;
      new.tokens_total := old.tokens_total;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_tokens on public.profiles;
create trigger protect_profile_tokens
  before insert or update on public.profiles
  for each row execute function public.protect_profile_tokens();

-- 4. Списать 1 токен у текущего пользователя (вызывает сервер после успешной генерации).
--    Возвращает новый баланс или null, если списывать нечего.
create or replace function public.spend_token()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  left_tokens integer;
begin
  update public.profiles
     set tokens_balance = tokens_balance - 1
   where id = auth.uid() and tokens_balance > 0
  returning tokens_balance into left_tokens;
  return left_tokens;
end;
$$;

revoke all on function public.spend_token() from public, anon;
grant execute on function public.spend_token() to authenticated;
