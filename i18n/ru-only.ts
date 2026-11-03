// Тексты, которые относятся только к русской версии и ЮKassa (рубли, СБП, русскоязычные документы).
// Пока RU_ENABLED выключен, они не попадают в сообщения приложения (и в страницы), но из файлов не удалены.
const RU_ONLY_KEYS = [
  "subscription.testText",
  "subscription.secure",
  "subscription.paidInRub",
  "subscription.manageScreen.testBanner",
  "subscription.manageScreen.payViaSbp",
  "subscription.manageScreen.unlinkTextMethod",
  "legal.onlyRussian",
];

type Messages = { [key: string]: string | Messages };

export function stripRuOnly(messages: Messages): Messages {
  const copy = structuredClone(messages);
  for (const path of RU_ONLY_KEYS) {
    const keys = path.split(".");
    let node: Messages | string | undefined = copy;
    for (const k of keys.slice(0, -1)) node = typeof node === "object" ? node[k] : undefined;
    if (typeof node === "object") delete node[keys[keys.length - 1]];
  }
  return copy;
}
