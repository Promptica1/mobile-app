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

## Деплой

Vercel собирает ветку `main` автоматически после каждого push.
