import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { mailer } from "../email.server";
import { createAdminClient } from "../supabase/admin";
import { createClient } from "../supabase/server";
import { createStripeApi, stripeMode } from "./client.server";
import { createStore } from "./store.server";
import type { Deps } from "./types";

// Всё, что нужно маршрутам Stripe: вошедший пользователь, служебный клиент базы и зависимости обработчика.
export const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export const appBase = (request: NextRequest) => (process.env.APP_URL || request.nextUrl.origin).replace(/\/$/, "");

export function stripeDeps(): Deps | null {
  const admin = createAdminClient();
  if (!admin || !stripeMode().available) return null;
  return { api: createStripeApi(), store: createStore(admin), mailer };
}

export async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
