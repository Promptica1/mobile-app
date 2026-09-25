-- Digital Wardrobe — фото вещей в Supabase Storage (бакет "items").
-- Запускается один раз: Supabase → SQL Editor → New query → вставить → Run.
-- Скрипт можно безопасно запустить повторно.
--
-- Фото хранятся по пути <id пользователя>/<id вещи>.jpg, а в items.image_url
-- записывается этот путь. Бакет закрытый: показать фото можно только
-- по временной подписанной ссылке, которую получает сам владелец.

-- 1. Бакет: закрытый, только картинки, до 10 МБ на файл.
--    Если бакет уже создан вручную, настройки просто обновятся.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('items', 'items', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2. Политики: пользователь работает только с файлами в своей папке
--    (первая часть пути = его auth.uid()).
drop policy if exists "items_storage_select_own" on storage.objects;
drop policy if exists "items_storage_insert_own" on storage.objects;
drop policy if exists "items_storage_update_own" on storage.objects;
drop policy if exists "items_storage_delete_own" on storage.objects;

create policy "items_storage_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'items' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "items_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'items' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "items_storage_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'items' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'items' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "items_storage_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'items' and (storage.foldername(name))[1] = (select auth.uid())::text);
