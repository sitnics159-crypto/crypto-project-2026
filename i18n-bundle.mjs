// Localization foundation. Not yet connected to the production interface.
export const DEFAULT_LANGUAGE = 'ru';
export const LANGUAGES = Object.freeze(['ru', 'en', 'es', 'de', 'fr', 'ro']);
const messages = Object.freeze({
  ru: Object.freeze({language:'Язык', checkTransaction:'Проверить транзакцию', checkAddress:'Проверить адрес', loading:'Загрузка…', retry:'Повторить', testNetwork:'Тестовая сеть Sepolia'}),
  en: Object.freeze({language:'Language', checkTransaction:'Check transaction', checkAddress:'Check address', loading:'Loading…', retry:'Retry', testNetwork:'Sepolia test network'}),
  es: Object.freeze({language:'Idioma', checkTransaction:'Verificar transacción', checkAddress:'Verificar dirección', loading:'Cargando…', retry:'Reintentar', testNetwork:'Red de prueba Sepolia'}),
  de: Object.freeze({language:'Sprache', checkTransaction:'Transaktion prüfen', checkAddress:'Adresse prüfen', loading:'Wird geladen…', retry:'Erneut versuchen', testNetwork:'Sepolia-Testnetz'}),
  fr: Object.freeze({language:'Langue', checkTransaction:'Vérifier la transaction', checkAddress:'Vérifier l’adresse', loading:'Chargement…', retry:'Réessayer', testNetwork:'Réseau de test Sepolia'}),
  ro: Object.freeze({language:'Limbă', checkTransaction:'Verifică tranzacția', checkAddress:'Verifică adresa', loading:'Se încarcă…', retry:'Încearcă din nou', testNetwork:'Rețeaua de test Sepolia'})
});
export function normalizeLanguage(value) {
  const code = typeof value === 'string' ? value.trim().toLowerCase().split('-')[0] : '';
  return LANGUAGES.includes(code) ? code : DEFAULT_LANGUAGE;
}
export function translate(language, key) {
  const dictionary = messages[normalizeLanguage(language)];
  if (typeof key !== 'string' || !Object.hasOwn(dictionary, key)) throw new RangeError('Unknown translation key');
  return dictionary[key];
}


export function mountLanguageSelector(root = document) {
  const select = root.createElement('select');
  select.id = 'language-select';

  for (const language of LANGUAGES) {
    const option = root.createElement('option');
    option.value = language;
    option.textContent = language.toUpperCase();
    select.append(option);
  }

  function apply(value) {
    const language = normalizeLanguage(value);
    select.value = language;
    select.setAttribute('aria-label', translate(language, 'language'));
    root.documentElement.lang = language;
    const labels = {
      '#submit': 'checkTransaction',
      '#address-submit': 'checkAddress',
      '.net': 'testNetwork'
    };

    for (const [selector, key] of Object.entries(labels)) {
      const element = root.querySelector(selector);
      if (element) {
        element.textContent =
          (selector === '.net' ? '\u25cf ' : '') +
          translate(language, key);
      }
    }
    return language;
  }

  select.addEventListener('change', () => apply(select.value));
  apply('ru');
  return select;
}

document.querySelector('header.top').append(mountLanguageSelector());
