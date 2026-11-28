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
    return language;
  }

  select.addEventListener('change', () => apply(select.value));
  apply('ru');
  return select;
}
