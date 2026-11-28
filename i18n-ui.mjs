import { LANGUAGES, normalizeLanguage, translate } from './i18n.mjs';

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

  const storageKey = 'crypto-project-language';

  select.addEventListener('change', () => {
    const language = apply(select.value);
    try {
      root.defaultView.localStorage.setItem(storageKey, language);
    } catch {}
  });

  let savedLanguage = 'ru';
  try {
    savedLanguage = root.defaultView.localStorage.getItem(storageKey);
  } catch {}

  apply(savedLanguage);
  return select;
}
