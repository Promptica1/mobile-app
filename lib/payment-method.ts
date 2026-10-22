// Сохранённый способ оплаты для автопродления: банковская карта или СБП.
// Хранится в полях подписки card_last4 / card_type (отдельный SQL не нужен):
//   карта — последние 4 цифры и платёжная система («Mastercard»);
//   СБП   — card_type = "sbp", цифр нет.
// Сам платёжный токен (yookassa_payment_method_id) в браузер не отдаётся.

export const SBP = "sbp";

type YooKassaMethod = { type?: string; saved?: boolean; card?: { last4?: string; card_type?: string } } | undefined;

// Что записать в подписку о сохранённом способе оплаты (если ЮKassa его сохранила).
export function storedMethodFields(method: YooKassaMethod): { card_last4: string | null; card_type: string | null } {
  if (!method?.saved) return { card_last4: null, card_type: null };
  if (method.type === SBP) return { card_last4: null, card_type: SBP };
  return { card_last4: method.card?.last4 ?? null, card_type: method.card?.card_type ?? null };
}
