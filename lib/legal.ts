// Юридические документы: оферта и политика конфиденциальности.
// Тексты — в content/legal/offer.md и content/legal/privacy.md (правьте только там).
// Страницы открываются без входа: /legal/offer и /legal/privacy.

export type LegalDoc = "offer" | "privacy";

export const LEGAL_DOCS: Record<LegalDoc, { title: string; href: string }> = {
  offer: { title: "Публичная оферта", href: "/legal/offer" },
  privacy: { title: "Политика конфиденциальности", href: "/legal/privacy" },
};
