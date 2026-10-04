import { useSyncExternalStore } from "react";

// Отметка «подсказку о съёмке уже показали». Хранится в браузере на этом устройстве.
const STORAGE_KEY = "dw:add-item-photo-tips-seen";

const listeners = new Set<() => void>();

function readSeen(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Хранилище недоступно (приватный режим) — не мучаем подсказкой каждый раз.
    return true;
  }
}

export function markPhotoTipsSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// На сервере считаем, что подсказку уже видели, — показываем её только в браузере.
export function usePhotoTipsSeen() {
  return useSyncExternalStore(subscribe, readSeen, () => true);
}
