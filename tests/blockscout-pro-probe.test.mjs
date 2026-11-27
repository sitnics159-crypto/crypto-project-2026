import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const probe = fileURLToPath(new URL('../scripts/check-blockscout-pro.mjs', import.meta.url));
const mockKey = 'proapi_test_only';

function runProbe(key, responses = []) {
  const mock = `
    import assert from 'node:assert/strict';
    const responses = ${JSON.stringify(responses)};
    globalThis.fetch = async (url, options) => {
      const [chain, status] = responses.shift() ?? [];
      assert.equal(url.origin, 'https://api.blockscout.com');
      assert.ok(url.pathname.startsWith('/' + chain + '/api/v2/'));
      assert.equal(url.searchParams.get('apikey'), process.env.BLOCKSCOUT_API_KEY.trim());
      assert.equal(options.redirect, 'error');
      return new Response(JSON.stringify({ message: process.env.BLOCKSCOUT_API_KEY }), { status });
    };
    process.on('exit', () => assert.equal(responses.length, 0));
  `;
  const result = spawnSync(process.execPath, ['--import', 'data:text/javascript,' + encodeURIComponent(mock), probe], {
    encoding: 'utf8',
    env: { ...process.env, BLOCKSCOUT_API_KEY: key },
    timeout: 5000,
  });
  assert.ifError(result.error);
  return { status: result.status, output: result.stdout + result.stderr };
}

test('missing and malformed secrets stop before making a request', () => {
  const missing = runProbe('');
  assert.equal(missing.status, 2);
  assert.match(missing.output, /missing or empty/);

  for (const key of ['"' + mockKey + '"', 'apikey=' + mockKey, 'https://example.test/?apikey=' + mockKey]) {
    const invalid = runProbe(key);
    assert.equal(invalid.status, 2);
    assert.match(invalid.output, /Invalid BLOCKSCOUT_API_KEY format/);
    assert.ok(!invalid.output.includes(mockKey));
  }
});

for (const [controlStatus, diagnostic] of [
  [200, /Ethereum accepted the key/],
  [401, /Both Ethereum and Sepolia rejected authorization/],
  [429, /control request did not verify authorization/],
]) {
  test('Sepolia HTTP 401 with Ethereum control HTTP ' + controlStatus, () => {
    const result = runProbe(mockKey, [['11155111', 401], ['1', controlStatus]]);
    assert.equal(result.status, 1);
    assert.match(result.output, diagnostic);
    assert.match(result.output, /Sepolia transaction: HTTP 401/);
    assert.ok(!result.output.includes(mockKey));
    assert.ok(!result.output.includes('https://'));
  });
}

test('Sepolia throttling does not trigger the Ethereum control request', () => {
  const result = runProbe(mockKey, [['11155111', 429]]);
  assert.equal(result.status, 1);
  assert.match(result.output, /Sepolia transaction: HTTP 429/);
  assert.doesNotMatch(result.output, /Ethereum|request failed/);
  assert.ok(!result.output.includes(mockKey));
});
