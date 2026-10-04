"use client";

import { useEffect, useState } from "react";

// Короткое всплывающее сообщение внизу экрана.
export function useToast(ms = 2500) {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), ms);
    return () => clearTimeout(timer);
  }, [toast, ms]);
  const node = toast && (
    <div
      role="status"
      className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 z-40 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-2xl bg-text px-4 py-2 text-center text-sm text-background"
    >
      {toast}
    </div>
  );
  return { show: setToast, node };
}
