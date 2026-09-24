import BottomNav from "@/components/BottomNav";

export default function TabsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background">
      <main className="flex flex-1 flex-col px-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
