-- Digital Wardrobe — начальная схема базы данных.
-- Запускается один раз: Supabase → SQL Editor → New query → вставить → Run.
-- Скрипт можно безопасно запустить повторно: таблицы, политики и триггер
-- создаются только если их ещё нет (политики пересоздаются).

-- ─────────────────────────────────────────────────────────────
-- 1. Таблицы
-- ─────────────────────────────────────────────────────────────

-- Профиль пользователя. id совпадает с id пользователя в auth.users.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text,
  gender      text check (gender in ('female', 'male')),
  age_range   text check (age_range in ('18-24', '25-34', '35-44', '45+')),
  created_at  timestamptz not null default now()
);

-- Вещи гардероба.
create table if not exists public.items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null,
  category     text not null,
  color        text,
  material     text,
  brand        text,
  comment      text,
  image_url    text,
  is_favorite  boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Папки для образов.
create table if not exists public.folders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

-- Сохранённые образы.
create table if not exists public.looks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null,
  folder_id    uuid references public.folders (id) on delete set null,
  comment      text,
  is_favorite  boolean not null default false,
  image_url    text,
  created_at   timestamptz not null default now()
);

-- Какие вещи входят в образ (связь многие-ко-многим).
create table if not exists public.look_items (
  look_id  uuid not null references public.looks (id) on delete cascade,
  item_id  uuid not null references public.items (id) on delete cascade,
  primary key (look_id, item_id)
);

-- Индексы для быстрых выборок «мои вещи / мои образы».
create index if not exists items_user_id_idx      on public.items (user_id);
create index if not exists folders_user_id_idx    on public.folders (user_id);
create index if not exists looks_user_id_idx      on public.looks (user_id);
create index if not exists looks_folder_id_idx    on public.looks (folder_id);
create index if not exists look_items_item_id_idx on public.look_items (item_id);

-- ─────────────────────────────────────────────────────────────
-- 2. Row Level Security: каждый видит и меняет только свои строки
-- ─────────────────────────────────────────────────────────────

alter table public.profiles   enable row level security;
alter table public.items      enable row level security;
alter table public.folders    enable row level security;
alter table public.looks      enable row level security;
alter table public.look_items enable row level security;

-- profiles: владелец — строка, у которой id = auth.uid()
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "profiles_delete_own" on public.profiles
  for delete to authenticated using ((select auth.uid()) = id);

-- items, folders: владелец — user_id = auth.uid()
do $$
declare
  t text;
begin
  foreach t in array array['items', 'folders'] loop
    execute format('drop policy if exists "%1$s_select_own" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_insert_own" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_update_own" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_delete_own" on public.%1$I', t);

    execute format(
      'create policy "%1$s_select_own" on public.%1$I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "%1$s_insert_own" on public.%1$I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "%1$s_update_own" on public.%1$I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "%1$s_delete_own" on public.%1$I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- looks: владелец — user_id = auth.uid(); папка (если указана) тоже должна быть своей.
drop policy if exists "looks_select_own" on public.looks;
drop policy if exists "looks_insert_own" on public.looks;
drop policy if exists "looks_update_own" on public.looks;
drop policy if exists "looks_delete_own" on public.looks;
create policy "looks_select_own" on public.looks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "looks_insert_own" on public.looks
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (folder_id is null or exists (
      select 1 from public.folders f where f.id = folder_id and f.user_id = (select auth.uid())
    ))
  );
create policy "looks_update_own" on public.looks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (folder_id is null or exists (
      select 1 from public.folders f where f.id = folder_id and f.user_id = (select auth.uid())
    ))
  );
create policy "looks_delete_own" on public.looks
  for delete to authenticated using ((select auth.uid()) = user_id);

-- look_items: своей колонки user_id нет — проверяем, что и образ, и вещь принадлежат пользователю.
drop policy if exists "look_items_select_own" on public.look_items;
drop policy if exists "look_items_insert_own" on public.look_items;
drop policy if exists "look_items_delete_own" on public.look_items;
create policy "look_items_select_own" on public.look_items
  for select to authenticated using (
    exists (select 1 from public.looks l where l.id = look_id and l.user_id = (select auth.uid()))
  );
create policy "look_items_insert_own" on public.look_items
  for insert to authenticated with check (
    exists (select 1 from public.looks l where l.id = look_id and l.user_id = (select auth.uid()))
    and exists (select 1 from public.items i where i.id = item_id and i.user_id = (select auth.uid()))
  );
create policy "look_items_delete_own" on public.look_items
  for delete to authenticated using (
    exists (select 1 from public.looks l where l.id = look_id and l.user_id = (select auth.uid()))
  );

-- ─────────────────────────────────────────────────────────────
-- 3. Профиль создаётся автоматически при регистрации
-- ─────────────────────────────────────────────────────────────
-- Работает и когда включено подтверждение почты (в этот момент
-- у пользователя ещё нет сессии, и приложение само вставить строку не может).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
