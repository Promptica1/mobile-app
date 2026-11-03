-- MIRRO — срок хранения записей о триале: пока существует аккаунт и 12 месяцев после его удаления
-- (так написано в политике конфиденциальности).
-- Запускается один раз: Supabase → SQL Editor → New query → вставить → Run.
-- Скрипт можно безопасно запустить повторно. Нужна выполненная миграция Stripe (таблица trial_claims).
--
-- В trial_claims лежат хэш нормализованной почты и отпечаток карты. При удалении аккаунта user_id становится
-- пустым (так «удалить аккаунт и взять триал снова» не работает), а момент удаления теперь запоминается.
-- Раз в сутки cron вызывает purge_trial_claims(): удаляются ТОЛЬКО записи удалённых аккаунтов старше 12 месяцев.
-- Записи действующих аккаунтов (user_id не пуст) не трогаются никогда.

alter table public.trial_claims add column if not exists account_deleted_at timestamptz;

create or replace function public.mark_trial_claim_account_deleted()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.user_id is not null and new.user_id is null and new.account_deleted_at is null then
    new.account_deleted_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trial_claims_account_deleted on public.trial_claims;
create trigger trial_claims_account_deleted
  before update of user_id on public.trial_claims
  for each row execute function public.mark_trial_claim_account_deleted();

-- Аккаунты, удалённые до этой миграции: срок в 12 месяцев считаем с сегодняшнего дня.
update public.trial_claims set account_deleted_at = now() where user_id is null and account_deleted_at is null;

-- Удаляет записи удалённых аккаунтов старше 12 месяцев, возвращает, сколько записей удалено.
create or replace function public.purge_trial_claims()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from public.trial_claims
   where user_id is null
     and account_deleted_at is not null
     and account_deleted_at < now() - interval '12 months';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.purge_trial_claims() from public, anon, authenticated;
grant execute on function public.purge_trial_claims() to service_role;
