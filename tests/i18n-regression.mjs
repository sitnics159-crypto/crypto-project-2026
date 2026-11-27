import assert from 'node:assert/strict';
import {messages, resolveLocale, translate} from '../src/i18n.mjs';
assert.deepEqual(Object.keys(messages.en).sort(),Object.keys(messages.ru).sort());
for(const [input,expected] of [['en-US','en'],['en-GB','en'],['ru-MD','ru'],['RU','ru'],['ar','ru'],['invalid_locale','ru'],[null,'ru'],['constructor','ru']]) assert.equal(resolveLocale(input),expected);
assert.equal(resolveLocale('fr','en'),'en');
assert.equal(translate('en','loading'),'Loading…');
assert.equal(translate('ru','loading'),'Загрузка…');
assert.equal(translate('fr','loading'),'Загрузка…');
assert.equal(translate('en','unknown'),'unknown');
assert.equal(translate('en','constructor'),'constructor');
console.log('i18n regression assertions passed');

// Ensure locale dictionaries cannot be mutated at runtime.
assert.ok(Object.isFrozen(messages));
for (const dictionary of Object.values(messages)) {
  assert.ok(Object.isFrozen(dictionary));
  for (const value of Object.values(dictionary)) assert.ok(typeof value === 'string' && value.trim().length > 0);
}
assert.equal(resolveLocale('en-Latn-US'),'en');
assert.equal(resolveLocale('ar','unsupported'),'ru');
assert.equal(translate('en','__proto__'),'__proto__');
console.log('Locale immutability and fallback assertions passed');
