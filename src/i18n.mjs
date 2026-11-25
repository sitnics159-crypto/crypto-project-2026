export const messages = Object.freeze({
  ru: Object.freeze({ transactionCheck: 'Проверка транзакции', addressCheck: 'Проверка адреса Sepolia', loading: 'Загрузка…', unavailable: 'Не удалось определить', refresh: 'Обновить' }),
  en: Object.freeze({ transactionCheck: 'Transaction lookup', addressCheck: 'Sepolia address lookup', loading: 'Loading…', unavailable: 'Unavailable', refresh: 'Refresh' })
});
export function resolveLocale(preferred, fallback = 'ru') {
  for (const candidate of [preferred, fallback, 'ru']) {
    if (typeof candidate !== 'string') continue;
    try { const lang = new Intl.Locale(candidate).language; if (Object.hasOwn(messages, lang)) return lang; } catch {}
  }
  return 'ru';
}
export function translate(locale, key) {
  const dictionary = messages[resolveLocale(locale)];
  return Object.hasOwn(dictionary, key) ? dictionary[key] : Object.hasOwn(messages.ru, key) ? messages.ru[key] : String(key);
}
