import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LANGUAGE, LANGUAGES, normalizeLanguage, translate } from '../i18n.mjs';

const keys = ['language','checkTransaction','checkAddress','loading','retry','testNetwork'];
test('supported languages and default', () => {
  assert.deepEqual(LANGUAGES, ['ru','en','es','de','fr','ro']);
  assert.equal(DEFAULT_LANGUAGE, 'ru');
});
for (const language of LANGUAGES) {
  test('complete foundation dictionary: ' + language, () => {
    for (const key of keys) assert.ok(translate(language,key).trim().length > 0);
    assert.equal(normalizeLanguage(language),language);
  });
}
test('regional codes and case normalization', () => {
  assert.equal(normalizeLanguage(' EN-US '),'en');
  assert.equal(normalizeLanguage('pt-BR'),'ru');
  assert.equal(normalizeLanguage('ro-RO'),'ro');
});
test('unsupported and invalid inputs fall back safely', () => {
  for (const value of [null,undefined,42,{},'', 'xx','__proto__','constructor']) {
    assert.equal(normalizeLanguage(value),'ru');
    assert.equal(translate(value,'loading'),translate('ru','loading'));
  }
});
test('unknown translation keys are rejected', () => {
  for (const key of ['missing','__proto__','constructor',null]) {
    assert.throws(() => translate('en',key),RangeError);
  }
});
test('English and Russian transaction labels are distinct', () => {
  assert.equal(translate('en','checkTransaction'),'Check transaction');
  assert.equal(translate('ru','checkTransaction'),'Проверить транзакцию');
});
