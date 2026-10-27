// Переключатели функций — единственное место, где их включают и выключают.

// Вход через Google (кнопка «Продолжить с Google» на экранах входа и регистрации).
export const SHOW_GOOGLE_LOGIN = true;
// Вход через Apple — пока не настроен, кнопка скрыта.
export const SHOW_APPLE_LOGIN = false;

// Есть ли хоть один способ входа через сервисы (тогда показываем разделитель «или»).
export const SHOW_SOCIAL_LOGIN = SHOW_GOOGLE_LOGIN || SHOW_APPLE_LOGIN;

// Stripe (пользователи вне России): какой триал предлагаем.
// false — вариант A: триал $4,99 на 5 дней, затем Premium $9,99 в месяц;
// true  — вариант B: бесплатные 3 дня, карта обязательна, затем Premium $9,99 в месяц.
export const STRIPE_FREE_TRIAL = false;
