#!/bin/bash
# Запуск приложения (после `npm run build` с NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
# и NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key) против поддельных сервисов стенда. Ключи тут тестовые.
cd "$(dirname "$0")/../.."
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key \
SUPABASE_SERVICE_ROLE_KEY=test-service-key \
YOOKASSA_SHOP_ID=123456 YOOKASSA_SECRET_KEY=test_abc YOOKASSA_API_URL=http://localhost:54500/v3 \
STRIPE_SECRET_KEY=sk_test_abc STRIPE_API_URL=http://localhost:54600 STRIPE_WEBHOOK_SECRET=whsec_test_secret \
STRIPE_PRICE_TRIAL_SETUP=price_setup STRIPE_PRICE_PREMIUM_MONTHLY=price_monthly STRIPE_PRICE_PREMIUM_ANNUAL=price_annual \
CRON_SECRET=cron-secret APP_URL=http://localhost:3100 \
RESEND_API_KEY=re_test RESEND_API_URL=http://localhost:54700 EMAIL_FROM="MIRRO <billing@example.com>" \
exec npx next start -p 3100
