import { redirect } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

// Пока профиль не заполнен (нет имени), отправляем на шаг «Создайте профиль».
async function requireCompletedProfile() {
  if (!getSupabaseEnv()) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.name) redirect("/onboarding");
}

export default async function TabsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireCompletedProfile();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background">
      <main className="flex flex-1 flex-col px-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
