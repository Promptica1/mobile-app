-- MIRRO — согласия с офертой и политикой конфиденциальности (доказательство согласия).
-- Запускается один раз: Supabase → SQL Editor → New query → вставить → Run.
-- Скрипт можно безопасно запустить повторно.
--
-- Что записывается:
-- - при регистрации — согласие с Политикой конфиденциальности (пишет триггер базы
--   при создании пользователя, время — время сервера базы);
-- - при оформлении подписки — согласие с Офертой и Политикой (пишет сервер приложения,
--   с номером заказа, IP и браузером).
-- version — редакция документа (отпечаток текста): видно, с какой именно редакцией согласились.
-- Записи только добавляются; пользователь может их читать, но не менять.

create table if not exists public.legal_consents (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  document    text not null check (document in ('offer', 'privacy')),
  version     text not null,
  context     text not null check (context in ('signup', 'payment')),
  payment_id  uuid references public.payments (id) on delete set null,
  ip          text,
  user_agent  text,
  accepted_at timestamptz not null default now()
);
create index if not exists legal_consents_user_idx on public.legal_consents (user_id, accepted_at desc);

alter table public.legal_consents enable row level security;
drop policy if exists "legal_consents_select_own" on public.legal_consents;
create policy "legal_consents_select_own" on public.legal_consents
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.legal_consents from anon, authenticated;

-- Согласие при регистрации: приложение передаёт его в данных регистрации
-- (privacy_accepted = true, privacy_version), триггер записывает его сразу при создании аккаунта.
create or replace function public.record_signup_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'privacy_accepted', '') = 'true' then
    insert into public.legal_consents (user_id, document, version, context)
    values (new.id, 'privacy', coalesce(nullif(new.raw_user_meta_data ->> 'privacy_version', ''), 'unknown'), 'signup');
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_consent on auth.users;
create trigger on_auth_user_consent
  after insert on auth.users
  for each row execute function public.record_signup_consent();
