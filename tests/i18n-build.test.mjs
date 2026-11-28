import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

function read(name) {
  return readFileSync(new URL('../' + name, import.meta.url));
}

function normalize(name) {
  return read(name).toString('utf8')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n');
}

test('Localization bundle is reproducible and authorized by CSP', () => {
  const core = normalize('i18n.mjs');
  const ui = normalize('i18n-ui.mjs');
  const lines = ui.trimEnd().split('\n');

  assert.ok(lines[0].startsWith('import '));

  const expected = core + '\n' +
    lines.slice(1).join('\n') + '\n' +
    "\ndocument.querySelector('header.top').append(mountLanguageSelector());\n";

  const actual = read('i18n-bundle.mjs');
  assert.deepEqual(actual, Buffer.from(expected, 'utf8'));

  const hash = 'sha256-' + createHash('sha256')
    .update(actual).digest('base64');

  const html = normalize('index.html');

  assert.ok(html.includes("'" + hash + "'"));
  assert.ok(html.includes(
    'src="./i18n-bundle.mjs" integrity="' + hash + '"'
  ));
});
