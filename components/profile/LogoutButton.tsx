"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    // Без Supabase (тестовый режим) выходить некуда.
    if (!getSupabaseEnv()) return;
    setLoading(true);
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="mx-auto py-2 text-[15px] font-medium text-danger transition-opacity hover:opacity-70 disabled:opacity-50"
    >
      {loading ? "Выходим…" : "Выйти"}
    </button>
  );
}
