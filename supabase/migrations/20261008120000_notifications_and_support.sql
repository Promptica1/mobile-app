-- Digital Wardrobe — настройки уведомлений и обращения в поддержку.
-- Запускается один раз: Supabase → SQL Editor → New query → вставить → Run.
-- Скрипт можно безопасно запустить повторно.

-- 1. Настройки уведомлений пользователя (какие уведомления он хочет получать).
--    Пустой объект = настройки по умолчанию (их задаёт приложение).
alter table public.profiles
  add column if not exists notification_settings jsonb not null default '{}'::jsonb;

-- 2. Обращения в поддержку из раздела «Помощь».
--    Читать их можно в Supabase → Table Editor → support_requests.
create table if not exists public.support_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  email       text,
  topic       text not null check (topic in ('question', 'bug', 'idea', 'payment')),
  message     text not null check (char_length(message) between 5 and 2000),
  app_version text,
  user_agent  text,
  status      text not null default 'new' check (status in ('new', 'in_progress', 'done')),
  created_at  timestamptz not null default now()
);

create index if not exists support_requests_user_id_idx on public.support_requests (user_id);
create index if not exists support_requests_status_idx on public.support_requests (status, created_at desc);

alter table public.support_requests enable row level security;

-- Пользователь может отправить обращение и видеть свои; менять и удалять — нет.
drop policy if exists "support_requests_select_own" on public.support_requests;
drop policy if exists "support_requests_insert_own" on public.support_requests;
create policy "support_requests_select_own" on public.support_requests
  for select to authenticated using (user_id = (select auth.uid()));
create policy "support_requests_insert_own" on public.support_requests
  for insert to authenticated with check (user_id = (select auth.uid()) and status = 'new');

-- 3. При удалении аккаунта обращения тоже удаляются (каскад по user_id), а функция
--    delete_my_account() удаляет их явно — чтобы ничего не осталось.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  files_left integer;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select count(*) into files_left
  from storage.objects
  where bucket_id in ('items', 'avatars', 'tryons', 'profile-photos')
    and (storage.foldername(name))[1] = uid::text;
  if files_left > 0 then
    raise exception 'storage_not_empty' using errcode = 'P0001', detail = files_left::text;
  end if;

  delete from public.support_requests where user_id = uid;
  delete from public.look_items where look_id in (select id from public.looks where user_id = uid);
  delete from public.looks where user_id = uid;
  delete from public.folders where user_id = uid;
  delete from public.try_on_results where user_id = uid;
  delete from public.items where user_id = uid;
  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
