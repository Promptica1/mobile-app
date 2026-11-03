-- MIRRO — смена тарифов: один тариф Premium (60 credits в месяц) и триал только для тех, у кого
-- никогда не было ни оплаты, ни триала.
-- Запускается один раз: Supabase → SQL Editor → New query → вставить → Run.
-- Скрипт можно безопасно запустить повторно. Нужны выполненные предыдущие миграции (в т.ч. Stripe).

-- 1. Premium+ убирается: подписки и платежи переводим на Premium. Баланс не больше 60
-- (у тарифа Premium+ было 150), «из» = 60.
update public.profiles
   set tokens_balance = least(tokens_balance, 60), tokens_total = 60
 where id in (select user_id from public.subscriptions where plan = 'premium_plus');
update public.subscriptions set plan = 'premium' where plan = 'premium_plus';
update public.payments set plan = 'premium' where plan = 'premium_plus';
update public.token_grants set plan = 'premium' where plan = 'premium_plus';

alter table public.payments drop constraint if exists payments_plan_check;
alter table public.payments add constraint payments_plan_check check (plan in ('premium'));
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in ('free', 'premium'));

-- 2. Платёж «триал» (ЮKassa: 399 ₽ за 7 дней с сохранением карты, затем автосписание 1499 ₽).
alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check check (kind in ('initial', 'renewal', 'trial'));

-- 3. Почта для проверки «один человек» приводится к одному виду (как normalizeEmail в приложении):
-- заглавные буквы, «+метка» и точки в Gmail не помогают обойти правило. Хранится только sha256.
create or replace function public.normalize_email_hash(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  with parts as (
    select split_part(lower(btrim(p_email)), '@', 1) as lcl,
           case when split_part(lower(btrim(p_email)), '@', 2) = 'googlemail.com' then 'gmail.com'
                else split_part(lower(btrim(p_email)), '@', 2) end as dom
  ), norm as (
    select case when dom = 'gmail.com' then replace(split_part(lcl, '+', 1), '.', '')
                else split_part(lcl, '+', 1) end || '@' || dom as email
      from parts
  )
  select encode(sha256(convert_to(email, 'UTF8')), 'hex') from norm;
$$;

-- 4. Была ли у человека оплата (любого тарифа, в том числе старого Premium и Premium+):
-- успешный платёж или строка подписки не «free».
create or replace function public.had_payment(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.payments where user_id = p_user and status = 'succeeded')
      or exists (select 1 from public.subscriptions where user_id = p_user and plan <> 'free');
$$;

-- Записать «этот человек уже платил» (после любой оплаты без триала), чтобы триал не получили
-- с новой почтой-алиасом или новой картой. Ничего не ломает: конфликты уникальности игнорируются.
create or replace function public.record_payer(p_user uuid, p_email_hash text, p_ref text, p_fingerprint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.trial_claims (user_id, email_hash, card_fingerprint, subscription_id)
  values (p_user, p_email_hash, p_fingerprint, p_ref)
  on conflict do nothing;
  if p_fingerprint is not null then
    begin
      update public.trial_claims set card_fingerprint = p_fingerprint
       where user_id = p_user and card_fingerprint is null;
    exception when unique_violation then
      null;
    end;
  end if;
end;
$$;

-- 5. Можно ли взять триал (проверка до оплаты): нет записи по аккаунту или почте и не было оплаты.
create or replace function public.trial_available(p_user uuid, p_email_hash text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.trial_claims where user_id = p_user or email_hash = p_email_hash)
     and not public.had_payment(p_user);
$$;

-- Занять триал (после оплаты, когда известна карта). Результат:
--   ok — триал за ним (или уже был за этой же подпиской: повтор webhook безопасен);
--   paid_before / user_used / email_used / card_used — была оплата / триал брали с этим аккаунтом / почтой / картой.
create or replace function public.claim_trial(p_user uuid, p_email_hash text, p_subscription_id text, p_fingerprint text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.trial_claims%rowtype;
begin
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
  if public.had_payment(p_user) then return 'paid_before'; end if;
  if p_fingerprint is not null and exists (select 1 from public.trial_claims where card_fingerprint = p_fingerprint) then
    return 'card_used';
  end if;

  insert into public.trial_claims (user_id, email_hash, card_fingerprint, subscription_id)
  values (p_user, p_email_hash, p_fingerprint, p_subscription_id);
  return 'ok';
end;
$$;

-- ЮKassa: бронь триала при создании платежа. Брони по неоплаченным пробным платежам этого же человека
-- (человек закрыл страницу оплаты) снимаются, чтобы он мог попробовать ещё раз.
create or replace function public.claim_trial_pending(p_user uuid, p_email_hash text, p_payment_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext(p_email_hash));
  delete from public.trial_claims c
   where (c.user_id = p_user or c.email_hash = p_email_hash)
     and c.subscription_id ~ '^yk:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'   -- только брони пробных платежей, не записи об оплате
     and not exists (
       select 1 from public.payments p
        where p.id::text = substr(c.subscription_id, 4) and p.status = 'succeeded'
     );
  return public.claim_trial(p_user, p_email_hash, 'yk:' || p_payment_id::text, null);
end;
$$;

-- Платёж триала не прошёл — бронь снимается.
create or replace function public.release_trial(p_subscription_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.trial_claims where subscription_id = p_subscription_id;
$$;

-- 6. Уже платившие (включая Premium и Premium+ до смены тарифов) записываем в «триал использован».
insert into public.trial_claims (user_id, email_hash, subscription_id)
select u.id, public.normalize_email_hash(u.email), 'legacy'
  from auth.users u
 where u.email is not null
   and public.had_payment(u.id)
on conflict do nothing;

revoke all on function public.normalize_email_hash(text) from public, anon, authenticated;
revoke all on function public.had_payment(uuid) from public, anon, authenticated;
revoke all on function public.record_payer(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.trial_available(uuid, text) from public, anon, authenticated;
revoke all on function public.claim_trial(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.claim_trial_pending(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.release_trial(text) from public, anon, authenticated;
grant execute on function public.normalize_email_hash(text) to service_role;
grant execute on function public.had_payment(uuid) to service_role;
grant execute on function public.record_payer(uuid, text, text, text) to service_role;
grant execute on function public.trial_available(uuid, text) to service_role;
grant execute on function public.claim_trial(uuid, text, text, text) to service_role;
grant execute on function public.claim_trial_pending(uuid, text, uuid) to service_role;
grant execute on function public.release_trial(text) to service_role;
