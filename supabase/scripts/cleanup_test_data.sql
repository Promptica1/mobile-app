-- =====================================================================================
-- MIRRO — очистка ТЕСТОВЫХ данных перед запуском
-- =====================================================================================
-- Запускать в Supabase → SQL Editor ПО ЧАСТЯМ: выделите нужную часть мышкой → Run
-- (запускается только выделенный текст). Не запускайте весь файл целиком.
--
-- Что НЕ трогается: таблицы, функции, триггеры, политики доступа, бакеты — вся «настройка».
-- Удаляются только строки с тестовыми данными.
--
-- Порядок:
--   ЧАСТЬ 0 — только посмотреть, что будет удалено (ничего не меняет).
--   ЧАСТЬ 1 — удалить тестовые платежи, подписки, начисления токенов и согласия к этим платежам.
--   ЧАСТЬ 2 — список аккаунтов (ничего не меняет), чтобы решить, какие тестовые удалить.
--   ЧАСТЬ 3 — удалить ВЫБРАННЫЕ аккаунты по email (по умолчанию выключено, с защитой основного).
--
-- Перед ЧАСТЬЮ 1 и 3 рекомендуется резервная копия:
--   Supabase → Database → Backups (на бесплатном плане — ежедневная копия,
--   или выгрузите таблицы payments / subscriptions / token_grants / legal_consents в CSV
--   кнопкой Export в Table Editor).


-- =====================================================================================
-- ЧАСТЬ 0. ПРЕДПРОСМОТР — ничего не удаляет
-- =====================================================================================
-- Сколько строк затронет ЧАСТЬ 1. Сверьтесь, что цифры ожидаемые.
-- «платежи_не_тестовые» должно быть 0 — их скрипт НЕ удаляет.

select
  (select count(*) from public.payments where test = true)                       as платежи_тестовые,
  (select count(*) from public.payments where test is distinct from true)        as платежи_не_тестовые,
  (select count(*) from public.subscriptions where test = true)                  as подписки_тестовые,
  (select count(*) from public.subscriptions where test is distinct from true)   as подписки_не_тестовые,
  (select count(*) from public.token_grants g
     join public.payments p on p.id = g.payment_id where p.test = true)          as начисления_токенов_за_тест,
  (select count(*) from public.legal_consents c
     where c.context = 'payment'
       and (c.payment_id is null
            or c.payment_id in (select id from public.payments where test = true))) as согласия_при_тестовой_оплате,
  (select count(*) from public.legal_consents where context = 'signup')          as согласия_при_регистрации_НЕ_удаляются;

-- Подробно: тестовые платежи с почтой пользователя.
select p.created_at, u.email, p.plan, p.amount, p.status, p.kind, p.test
from public.payments p
left join auth.users u on u.id = p.user_id
where p.test = true
order by p.created_at desc;


-- =====================================================================================
-- ЧАСТЬ 1. УДАЛЕНИЕ ТЕСТОВЫХ ПЛАТЕЖЕЙ И ПОДПИСОК
-- =====================================================================================
-- Что удаляется:
--   1) тестовые подписки (subscriptions.test = true) — у пользователей снова «Бесплатный план»,
--      автосписание по ним больше не запустится; сохранённая тестовая карта забывается;
--   2) согласия с офертой, данные при ТЕСТОВЫХ оплатах (legal_consents, context = 'payment').
--      Согласия при регистрации остаются — аккаунты ведь остаются;
--   3) записи о начислении токенов за тестовые оплаты (token_grants);
--   4) сами тестовые платежи (payments.test = true).
-- Всё внутри одной транзакции: если что-то пойдёт не так, не изменится ничего.
--
-- ТОКЕНЫ. Пользователи, которые «оплачивали» тестовую подписку, сейчас имеют на балансе
-- 50 / 150 токенов (или остаток от них). По умолчанию балансы НЕ меняются.
-- Если хотите вернуть таким пользователям стартовые 10 токенов — уберите «--» в начале
-- строки с update (шаг 0 ниже). Остальных пользователей это не касается.

begin;

-- шаг 0 (по желанию): вернуть стартовый баланс тем, кому начисляли токены за тестовую оплату
-- update public.profiles set tokens_balance = public.beta_start_tokens(), tokens_total = public.beta_start_tokens()
--  where id in (select g.user_id from public.token_grants g join public.payments p on p.id = g.payment_id where p.test = true);

-- шаг 1: тестовые подписки
delete from public.subscriptions where test = true;

-- шаг 2: согласия, данные при тестовых оплатах
delete from public.legal_consents
 where context = 'payment'
   and (payment_id is null or payment_id in (select id from public.payments where test = true));

-- шаг 3: начисления токенов за тестовые оплаты
delete from public.token_grants
 where payment_id in (select id from public.payments where test = true);

-- шаг 4: тестовые платежи
delete from public.payments where test = true;

-- Проверка: всё должно стать 0.
select
  (select count(*) from public.payments where test = true)      as осталось_тестовых_платежей,
  (select count(*) from public.subscriptions where test = true) as осталось_тестовых_подписок;

commit;
-- Если перед commit что-то показалось не так — вместо commit выполните: rollback;


-- =====================================================================================
-- ЧАСТЬ 2. СПИСОК АККАУНТОВ — ничего не удаляет
-- =====================================================================================
-- Посмотрите и выпишите email тестовых аккаунтов, которые хотите удалить.
-- ВАШ ОСНОВНОЙ аккаунт в этот список удаления не включайте.

select
  u.email,
  p.name                                                               as имя,
  u.created_at::date                                                   as создан,
  u.last_sign_in_at::date                                              as последний_вход,
  coalesce(u.raw_app_meta_data ->> 'provider', 'email')                as способ_входа,
  p.tokens_balance                                                     as токенов,
  (select count(*) from public.items i where i.user_id = u.id)         as вещей,
  (select count(*) from public.looks l where l.user_id = u.id)         as образов,
  u.id                                                                 as id_папки_в_storage
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at;


-- =====================================================================================
-- ЧАСТЬ 3. УДАЛЕНИЕ ВЫБРАННЫХ ТЕСТОВЫХ АККАУНТОВ (по email) — НЕОБРАТИМО
-- =====================================================================================
-- Самый чистый способ — войти в тестовый аккаунт в приложении и нажать
-- «Профиль → Приватность и данные → Удалить аккаунт»: так удалятся и фото в хранилище.
--
-- Если удобнее через SQL — блок ниже. Он удаляет аккаунт и все его строки в базе
-- (профиль, вещи, образы, папки, примерки, обращения, согласия, подписку) — каскадом.
-- ФОТО в хранилище (Storage) SQL удалить не может — Supabase это запрещает. После удаления
-- откройте Storage → бакеты items, avatars, tryons, profile-photos и удалите папки
-- с id удалённых пользователей (id выводится в ЧАСТИ 2 и в сообщениях ниже).
--
-- Как пользоваться:
--   1) впишите свой ОСНОВНОЙ email в main_email — он защищён: если он попадёт в список,
--      скрипт остановится и ничего не удалит;
--   2) впишите тестовые email в to_delete;
--   3) уберите «/*» и «*/» вокруг блока и запустите только его.

/*
do $$
declare
  main_email text   := 'ваш-основной@email.ru';                    -- ← ваш основной аккаунт (защищён)
  to_delete  text[] := array['test1@example.com', 'test2@example.com']; -- ← тестовые аккаунты
  e text;
  uid uuid;
begin
  if main_email is null or main_email = '' or main_email like 'ваш-%' then
    raise exception 'Сначала впишите свой основной email в main_email';
  end if;
  if lower(main_email) = any (select lower(x) from unnest(to_delete) x) then
    raise exception 'Основной аккаунт % есть в списке удаления — ничего не удалено', main_email;
  end if;

  foreach e in array to_delete loop
    select id into uid from auth.users where lower(email) = lower(e);
    if uid is null then
      raise notice 'Не найден: %', e;
      continue;
    end if;
    -- Платежи при удалении аккаунта не удаляются сами (остаются без владельца) — убираем их явно.
    delete from public.legal_consents where user_id = uid;
    delete from public.token_grants where user_id = uid;
    delete from public.subscriptions where user_id = uid;
    delete from public.payments where user_id = uid;
    -- Аккаунт; профиль, вещи, образы, папки, примерки и обращения удалятся каскадом.
    delete from auth.users where id = uid;
    raise notice 'Удалён: % (папка в Storage: %)', e, uid;
  end loop;
end $$;
*/
