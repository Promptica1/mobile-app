// Юридические документы: оферта и политика конфиденциальности.
// Тексты — в content/legal/<документ>.md (русский) и content/legal/<документ>.<язык>.md (перевод,
// например offer.en.md). Если перевода нет или файл пуст, показывается русская версия.
// Названия документов — в переводах (messages/*.json → legal.offer, legal.privacy).
// Страницы открываются без входа: /legal/offer и /legal/privacy.

export type LegalDoc = "offer" | "privacy";

export const LEGAL_DOCS: Record<LegalDoc, { href: string }> = {
  offer: { href: "/legal/offer" },
  privacy: { href: "/legal/privacy" },
};
