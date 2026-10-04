-- Digital Wardrobe — аватары для «Примерки».
-- Запускается один раз: Supabase → SQL Editor → New query → вставить → Run.
-- Скрипт можно безопасно запустить повторно.
--
-- Сгенерированный аватар хранится в закрытом бакете "avatars" по пути
-- <id пользователя>/avatar-<время>.jpg, а путь записывается в profiles.avatar_path.
-- Показывается он только по временной подписанной ссылке самому владельцу.

-- 1. Поля профиля: путь к аватару и необязательные параметры фигуры.
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists height_cm smallint
  check (height_cm is null or height_cm between 100 and 230);
alter table public.profiles add column if not exists weight_kg smallint
  check (weight_kg is null or weight_kg between 30 and 250);

-- 2. Бакет: закрытый, только картинки, до 10 МБ на файл.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 3. Политики: пользователь работает только с файлами в своей папке
--    (первая часть пути = его auth.uid()).
drop policy if exists "avatars_storage_select_own" on storage.objects;
drop policy if exists "avatars_storage_insert_own" on storage.objects;
drop policy if exists "avatars_storage_update_own" on storage.objects;
drop policy if exists "avatars_storage_delete_own" on storage.objects;

create policy "avatars_storage_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars_storage_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars_storage_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
