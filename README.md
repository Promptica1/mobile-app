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
| `RUNWARE_GARMENT_MODEL` | Необязательно. AIR модели для вырезания вещей, по умолчанию `google:4@3` (Nano Banana 2) |
| `RUNWARE_AVATAR_MODEL` | Необязательно. AIR модели для аватара, по умолчанию `google:4@3` (Nano Banana 2) |

Ключи не хранятся в репозитории: локально — в `.env.local`, на Vercel — в
Project → Settings → Environment Variables (после изменения нужен Redeploy).
Без ключей Supabase приложение работает на тестовых данных. Без ключа Runware
вещи сохраняются с исходным фото.

## AI-вырезание вещи

При добавлении вещи пользователь выбирает её тип (Верх, Низ, …). Шаг «Обработка»
отправляет фото и тип на `/api/extract-garment` (серверный маршрут). Сервер с ключом
`RUNWARE_API_KEY` вызывает генеративную модель Runware (`imageInference`, фото в
`inputs.referenceImages`, задание в `positivePrompt`) и получает одну вещь на белом
фоне в стиле каталога. Ключ в браузер не попадает. Если Runware недоступен или
ключа нет, сохраняется исходное фото. Логи маршрута в Vercel начинаются с `RB:`.

## Аватар для «Примерки»

Если у пользователя нет аватара, «Примерка» предлагает его создать: селфи (обязательно),
фото в полный рост и рост/вес (необязательно). Сервер (`/api/create-avatar`, логи `AV:`)
отправляет фото в Nano Banana (`imageInference`) и возвращает аватар в полный рост.
Браузер сохраняет его в бакет `avatars` (`<user>/avatar-<время>.jpg`), путь — в
`profiles.avatar_path`; старый файл удаляется. Исходные фото не сохраняются.

## Деплой

Vercel собирает ветку `main` автоматически после каждого push.
