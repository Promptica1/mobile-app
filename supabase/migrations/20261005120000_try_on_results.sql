-- Digital Wardrobe — результаты примерки (кэш сгенерированных образов).
-- Запускается один раз: Supabase → SQL Editor → New query → вставить → Run.
-- Скрипт можно безопасно запустить повторно.
--
-- Каждый результат — аватар пользователя в выбранном наборе вещей. Ключ кэша
-- (combo_key) считается из пути аватара и отсортированных id вещей: тот же набор
-- на том же аватаре повторно не генерируется. Картинки — в закрытом бакете "tryons"
-- по пути <id пользователя>/<combo_key>.jpg.

-- 1. Таблица результатов.
create table if not exists public.try_on_results (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  combo_key    text not null,
  avatar_path  text not null,
  item_ids     uuid[] not null,
  image_path   text not null,
  created_at   timestamptz not null default now(),
  unique (user_id, combo_key)
);

alter table public.try_on_results enable row level security;

drop policy if exists "try_on_results_select_own" on public.try_on_results;
drop policy if exists "try_on_results_insert_own" on public.try_on_results;
drop policy if exists "try_on_results_update_own" on public.try_on_results;
drop policy if exists "try_on_results_delete_own" on public.try_on_results;
create policy "try_on_results_select_own" on public.try_on_results
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "try_on_results_insert_own" on public.try_on_results
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "try_on_results_update_own" on public.try_on_results
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "try_on_results_delete_own" on public.try_on_results
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 2. Бакет: закрытый, только картинки, до 10 МБ на файл.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tryons', 'tryons', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 3. Политики бакета: пользователь работает только со своей папкой.
drop policy if exists "tryons_storage_select_own" on storage.objects;
drop policy if exists "tryons_storage_insert_own" on storage.objects;
drop policy if exists "tryons_storage_update_own" on storage.objects;
drop policy if exists "tryons_storage_delete_own" on storage.objects;

create policy "tryons_storage_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'tryons' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "tryons_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'tryons' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "tryons_storage_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'tryons' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'tryons' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "tryons_storage_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'tryons' and (storage.foldername(name))[1] = (select auth.uid())::text);
