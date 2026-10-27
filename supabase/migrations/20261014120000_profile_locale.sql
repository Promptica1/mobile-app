-- MIRRO — язык интерфейса пользователя.
-- Запускается один раз: Supabase → SQL Editor → New query → вставить → Run.
-- Скрипт можно безопасно запустить повторно.
--
-- profiles.locale — выбранный язык ('ru', 'en', …). Пусто — язык определяется по телефону.
-- Список допустимых языков в базе не зашит: новый язык добавляется файлом переводов в приложении.
-- Пользователь меняет значение сам (как имя и пол — действует существующая политика обновления
-- собственной строки profiles), поэтому дополнительных прав не нужно.

alter table public.profiles add column if not exists locale text;
alter table public.profiles drop constraint if exists profiles_locale_format;
alter table public.profiles
  add constraint profiles_locale_format check (locale is null or locale ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$');
