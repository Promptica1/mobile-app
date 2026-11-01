// Правила установки на главный экран. Файл без зависимостей — его же проверяют тесты (tests/pwa.test.ts).

// Второй показ — не раньше чем через 3 дня после первого; больше двух раз не показываем.
export const RESHOW_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
export const MAX_SHOWS = 2;

export type PwaState = {
  // Когда окно установки показывали сами (мс).
  shown: number[];
  // Приложение уже установлено (событие appinstalled или открыто с главного экрана).
  installed: boolean;
  // Первый сохранённый образ на этом устройстве уже был (триггер «после первого образа» отработал).
  lookSeen: boolean;
};

export const EMPTY_STATE: PwaState = { shown: [], installed: false, lookSeen: false };

export function parseState(raw: string | null): PwaState {
  if (!raw) return EMPTY_STATE;
  try {
    const v = JSON.parse(raw) as Partial<PwaState>;
    return {
      shown: Array.isArray(v.shown) ? v.shown.filter((n) => typeof n === "number").slice(0, MAX_SHOWS) : [],
      installed: v.installed === true,
      lookSeen: v.lookSeen === true,
    };
  } catch {
    return EMPTY_STATE;
  }
}

// Что показать человеку:
//  installed — приложение уже открыто с главного экрана;
//  inapp     — встроенный браузер соцсетей или Telegram: установить нельзя, зовём открыть Safari / Chrome;
//  native    — Chrome предложил системное окно установки (Android и не только);
//  ios       — iPhone / iPad: туториал «Поделиться → На экран Домой»;
//  android   — Android без системного окна: ручная инструкция через меню Chrome;
//  other     — остальное (компьютер): общая подсказка.
export type Variant = "installed" | "inapp" | "native" | "ios" | "android" | "other";

export function pickVariant(env: {
  standalone: boolean;
  telegram: boolean;
  inApp: boolean;
  os: "ios" | "android" | "other";
  hasPrompt: boolean;
}): Variant {
  if (env.standalone) return "installed";
  if (env.telegram || env.inApp) return "inapp";
  if (env.hasPrompt) return "native";
  if (env.os === "ios") return "ios";
  if (env.os === "android") return "android";
  return "other";
}

export type Trigger = "payment" | "signup" | "look" | "open";

// Показывать ли окно само (без нажатия в профиле).
// - не показываем, если уже установлено, в Telegram Mini App и там, где установка ничем не поможет;
// - первый раз — на первом удобном моменте (оплата, регистрация, первый образ);
// - второй раз — через 3 дня, если не установлено; больше двух раз не показываем.
// «open» (открытие приложения) срабатывает только для второго показа, а для пользователей ЮKassa —
// ещё и как «после регистрации» (первое открытие приложения).
// «look» — только пока первый образ на устройстве не был сохранён.
export function shouldAutoShow(
  state: PwaState,
  now: number,
  ctx: { trigger: Trigger; variant: Variant; telegram: boolean; signupFirstShow?: boolean },
): boolean {
  if (state.installed || ctx.telegram) return false;
  if (!(ctx.variant === "inapp" || ctx.variant === "native" || ctx.variant === "ios")) return false;
  if (state.shown.length >= MAX_SHOWS) return false;
  const reshowDue = state.shown.length === 1 && now - state.shown[0] >= RESHOW_AFTER_MS;
  const firstShow = state.shown.length === 0;
  if (!firstShow && !reshowDue) return false;
  if (ctx.trigger === "look" && state.lookSeen && firstShow) return false;
  if (ctx.trigger === "open") return reshowDue || (firstShow && ctx.signupFirstShow === true);
  return true;
}
