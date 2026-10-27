# Тестовый стенд оплаты (ЮKassa + Stripe)

Прогоняет настоящий код приложения (маршруты оплаты, webhook, cron, письма) против **поддельных**
ЮKassa, Stripe, Resend и Supabase, а базой служит настоящая локальная Postgres с миграциями
из `supabase/migrations`. Реальных ключей и денег не нужно. Запускать только на пустой тестовой базе.

1. Postgres 16 на порту 5499 (или задайте `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`), база `app`:
   `psql -d app -f tests/stand/stubs.sql`, затем по порядку все файлы `supabase/migrations/*.sql`
   (ошибки про `storage.foldername` можно игнорировать — это политики хранилища фото).
2. `npm i --no-save pg`
3. Сборка: `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key npm run build`
4. Поддельные сервисы: `node tests/stand/mock-supabase.mjs`, `node tests/stand/mock-yookassa.mjs`,
   `node tests/stand/mock-stripe.mjs` (в нём же поддельный Resend) — каждый в своём окне.
5. Приложение: `tests/stand/start-app.sh`
6. Проверка: `node tests/stand/run.mjs` — должно закончиться строкой «0 не прошло».
   Повторный запуск без очистки базы (`truncate auth.users cascade`) покажет «триал отклонён» —
   это ожидаемо: тот же отпечаток карты уже брал триал.

Быстрые проверки без стенда: `npm test` (правила, обработчик webhook) и
`psql -v ON_ERROR_STOP=1 -d <пустая_база> -f supabase/tests/stripe_credits_trial.sql` (SQL-логика).
