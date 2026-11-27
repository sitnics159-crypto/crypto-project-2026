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
      const [chain, status, body, path] = responses.shift() ?? [];
      assert.equal(url.origin, 'https://api.blockscout.com');
      assert.ok(url.pathname.startsWith('/' + chain + '/api/v2/'));
      if (path) assert.equal(url.pathname, '/' + chain + '/api/v2' + path);
      assert.equal(url.searchParams.get('apikey'), process.env.BLOCKSCOUT_API_KEY.trim());
      assert.equal(options.redirect, 'error');
      return new Response(JSON.stringify(body ?? { message: process.env.BLOCKSCOUT_API_KEY }), { status });
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

const sampleHash = '0x616c86b82eaa5485aa04e9773bd281bbc8fd9cd6b050efcc2f864bed50707204';
const sampleAddress = '0xd482cCc8EC97e9cA7a365F2403bf7f228aD149A0';
const sampleToken = '0x50B1eF6e0fe05a32F3E63F02f3c0151BD9004C7c';
const sampleTransfer = {
  transaction_hash: sampleHash, log_index: 0, token_type: 'ERC-20',
  from: { hash: sampleAddress }, to: { hash: sampleToken }, total: { value: '1' },
};

function balanceResponses(value) {
  const chain = '11155111';
  const path = '/addresses/' + sampleAddress;
  return [
    [chain, 200, { hash: sampleHash, fee: {} }, '/transactions/' + sampleHash],
    [chain, 200, { hash: sampleAddress, coin_balance: '0' }, path],
    [chain, 200, { items: [sampleTransfer] }, path + '/transactions'],
    [chain, 200, { items: [sampleTransfer] }, path + '/token-transfers'],
    [chain, 200, { items: [sampleTransfer] }, path + '/token-transfers'],
    [chain, 200, [{ value, token: { address_hash: sampleToken, type: 'ERC-20', decimals: '18' } }], path + '/token-balances'],
  ];
}

test('the probe accepts a precise string balance from the Pro API', () => {
  const amount = '123456789012345678901234567890';
  const result = runProbe(mockKey, [...balanceResponses(amount), ['11155111', 200, { decimals: '18' }, '/tokens/' + sampleToken]]);
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Verified an exact ERC-20 balance/);
  assert.ok(!result.output.includes(amount));
  assert.ok(!result.output.includes(mockKey));
});

test('the probe rejects a numeric balance that could lose precision', () => {
  const result = runProbe(mockKey, balanceResponses(1e29));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /Expected an exact ERC-20 balance for the sample token/);
  assert.ok(!result.output.includes(mockKey));
});
