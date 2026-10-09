-- MIRRO — токены по тарифу подписки (модель «сброс»: остаток не переносится).
-- Запускается один раз: Supabase → SQL Editor → New query → вставить → Run.
-- Скрипт можно безопасно запустить повторно.
--
-- Правила:
-- - Новый пользователь: 10 токенов один раз (как и раньше, beta_start_tokens). Не пополняются.
-- - Оплата Premium / Premium+ (первая и каждое продление): баланс = 50 / 150, «из» = 50 / 150.
-- - Отмена или окончание подписки: баланс не трогаем, просто больше не начисляем.
--
-- Начисляет только сервер (сервисный ключ) через grant_plan_tokens. Один платёж = одно
-- начисление: повторный вызов для того же платежа ничего не меняет (таблица token_grants).

create table if not exists public.token_grants (
  payment_id  uuid primary key references public.payments (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  plan        text not null,
  tokens      integer not null check (tokens > 0),
  granted_at  timestamptz not null default now()
);
create index if not exists token_grants_user_idx on public.token_grants (user_id, granted_at desc);

-- Только для сервера: браузеру таблица не видна.
alter table public.token_grants enable row level security;
revoke all on public.token_grants from anon, authenticated;

-- Начислить токены тарифа за оплаченный период. true — начислено сейчас,
-- false — за этот платёж уже начисляли (ничего не меняем).
create or replace function public.grant_plan_tokens(p_payment_id uuid, p_user_id uuid, p_plan text, p_tokens integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_tokens is null or p_tokens <= 0 then
    raise exception 'bad tokens amount';
  end if;
  insert into public.token_grants (payment_id, user_id, plan, tokens)
  values (p_payment_id, p_user_id, p_plan, p_tokens)
  on conflict (payment_id) do nothing;
  if not found then
    return false;
  end if;
  update public.profiles
     set tokens_balance = p_tokens, tokens_total = p_tokens
   where id = p_user_id;
  return true;
end;
$$;

revoke all on function public.grant_plan_tokens(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.grant_plan_tokens(uuid, uuid, text, integer) to service_role;
