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
| `RUNWARE_API_KEY` | Runware → Dashboard → API Keys. **Только сервер**, без `NEXT_PUBLIC_` |
| `RUNWARE_BG_MODEL` | Необязательно. AIR модели удаления фона, по умолчанию `runware:110@1` (Bria RMBG 2.0) |

Ключи не хранятся в репозитории: локально — в `.env.local`, на Vercel — в
Project → Settings → Environment Variables (после изменения нужен Redeploy).
Без ключей Supabase приложение работает на тестовых данных. Без ключа Runware
вещи сохраняются с исходным фото (фон не удаляется).

## Удаление фона

Шаг «Обработка» при добавлении вещи отправляет фото на `/api/remove-background`
(серверный маршрут). Сервер с ключом `RUNWARE_API_KEY` вызывает Runware
(`removeBackground`, PNG с прозрачностью) — ключ в браузер не попадает.
Если Runware недоступен, сохраняется исходное фото.

## База данных

SQL лежит в `supabase/migrations/` — запускайте файлы по порядку:
Supabase → SQL Editor → New query → вставить содержимое файла → Run.
Каждый скрипт можно запускать повторно.

- `20260925120000_initial_schema.sql` — таблицы, Row Level Security, триггер профиля.
- `20260926120000_storage_items_bucket.sql` — закрытый бакет `items` для фото
  вещей и политики: каждый пользователь видит только свою папку.

## Деплой

Vercel собирает ветку `main` автоматически после каждого push.
