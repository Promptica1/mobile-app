-- Digital Wardrobe — фото профиля и удаление аккаунта.
-- Запускается один раз: Supabase → SQL Editor → New query → вставить → Run.
-- Скрипт можно безопасно запустить повторно.

-- 1. Фото профиля (отдельно от аватара): путь в закрытом бакете profile-photos,
--    <id пользователя>/photo-<время>.jpg. Показывается по временной ссылке только владельцу.
alter table public.profiles add column if not exists photo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile_photos_storage_select_own" on storage.objects;
drop policy if exists "profile_photos_storage_insert_own" on storage.objects;
drop policy if exists "profile_photos_storage_update_own" on storage.objects;
drop policy if exists "profile_photos_storage_delete_own" on storage.objects;

create policy "profile_photos_storage_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "profile_photos_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "profile_photos_storage_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "profile_photos_storage_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 2. Удаление аккаунта. Файлы приложение сначала удаляет через Storage API
--    (напрямую из storage.objects Supabase удалять не даёт). Функция проверяет,
--    что файлов не осталось, удаляет все строки пользователя и сам аккаунт.
--    Работает только для текущего пользователя (auth.uid()).
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

  -- Явно, даже если где-то нет каскада: ничего «сиротского» не остаётся.
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
