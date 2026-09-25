# Digital Wardrobe

Next.js (App Router) + TypeScript + Tailwind CSS + Supabase.

## Локальный запуск

```bash
npm install
cp .env.local.example .env.local   # и впишите ключи Supabase
npm run dev
```

Откройте http://localhost:3000.

## Переменные окружения

| Переменная | Где взять |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API (Project URL) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys (publishable / anon) |

Ключи не хранятся в репозитории: локально — в `.env.local`, на Vercel — в
Project → Settings → Environment Variables (после изменения нужен Redeploy).
Без ключей приложение работает на тестовых данных.

## База данных

SQL лежит в `supabase/migrations/` — запускайте файлы по порядку:
Supabase → SQL Editor → New query → вставить содержимое файла → Run.
Каждый скрипт можно запускать повторно.

- `20260925120000_initial_schema.sql` — таблицы, Row Level Security, триггер профиля.
- `20260926120000_storage_items_bucket.sql` — закрытый бакет `items` для фото
  вещей и политики: каждый пользователь видит только свою папку.

## Деплой

Vercel собирает ветку `main` автоматически после каждого push.
