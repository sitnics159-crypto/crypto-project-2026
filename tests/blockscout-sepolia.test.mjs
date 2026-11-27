import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createSepoliaHttpServer } from '../server/sepolia-http.mjs';
import { createBlockscoutHandler } from '../server/blockscout-sepolia.mjs';

const address = '0x' + 'a'.repeat(40);
const hash = '0x' + 'b'.repeat(64);
const request = (path, method = 'GET') => new Request('https://preview.example' + path, { method });

test('routes five Sepolia operations to the fixed provider and authenticates upstream', async () => {
  const paths = ['/transactions/' + hash, '/addresses/' + address, '/addresses/' + address + '/transactions?index=1',
    '/addresses/' + address + '/token-transfers?type=ERC-20&filter=from&block_number=100', '/tokens/' + address];
  const calls = [];
  const handle = createBlockscoutHandler({ apiKey: 'mock-key', fetchUpstream: async (url, options) => {
    calls.push(url);
    assert.equal(options.redirect, 'error');
    assert.equal(url.searchParams.get('apikey'), 'mock-key');
    assert.equal(url.origin, 'https://api.blockscout.com');
    return Response.json({ ok: true });
  } });
  for (const path of paths) {
    const response = await handle(request(path));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  }
  assert.equal(calls.length, 5);
  assert.ok(calls.every(url => url.pathname.startsWith('/11155111/api/v2/')));
  assert.equal(calls[3].searchParams.get('type'), 'ERC-20');
  assert.equal(calls[3].searchParams.get('filter'), 'from');
});

test('forwards token balances to Sepolia without accepting client query parameters', async () => {
  const path = '/addresses/' + address + '/token-balances';
  const balances = [{ value: '123456789012345678901234567890', token: { type: 'ERC-20', decimals: '18' } }];
  let calls = 0;
  const handle = createBlockscoutHandler({ apiKey: 'mock-key', fetchUpstream: async url => {
    calls++;
    assert.equal(url.origin, 'https://api.blockscout.com');
    assert.equal(url.pathname, '/11155111/api/v2' + path);
    assert.deepEqual([...url.searchParams], [['apikey', 'mock-key']]);
    return Response.json(balances);
  } });
  for (const query of ['apikey=client', 'type=ERC-20', 'index=1']) {
    assert.equal((await handle(request(path + '?' + query))).status, 400);
  }
  assert.equal(calls, 0);
  const response = await handle(request(path));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), balances);
  assert.equal(calls, 1);
});

test('rejects invalid methods, paths and query parameters before reaching the provider', async () => {
  let calls = 0;
  const handle = createBlockscoutHandler({ apiKey: 'mock-key', fetchUpstream: async () => { calls++; } });
  assert.equal((await handle(request('/tokens/' + address, 'POST'))).status, 405);
  assert.equal((await handle(request('/addresses/garbage'))).status, 404);
  assert.equal((await handle(request('/tokens/' + address + '?apikey=client'))).status, 400);
  assert.equal((await handle(request('/addresses/' + address + '/token-transfers?filter=wrong'))).status, 400);
  assert.equal((await handle(request('/addresses/' + address + '/transactions?index=1&index=2'))).status, 400);
  assert.equal((await handle(request('/addresses/' + address + '/token-transfers?type=ERC-721'))).status, 400);
  assert.equal((await handle(request('/addresses/' + address + '/token-transfers?type=ERC-20&type=ERC-20'))).status, 400);
  assert.equal(calls, 0);
});

test('limits combined upstream request starts and allows requests after the window', async () => {
  let time = 0;
  let calls = 0;
  const handle = createBlockscoutHandler({ apiKey: 'mock-key', now: () => time, fetchUpstream: async () => {
    calls++;
    return Response.json({});
  } });
  const path = request('/tokens/' + address);
  const results = await Promise.all(Array.from({ length: 6 }, () => handle(path)));
  assert.deepEqual(results.map(response => response.status), [200, 200, 200, 200, 200, 429]);
  assert.equal(calls, 5);
  time = 1000;
  assert.equal((await handle(path)).status, 200);
});

test('handles missing credentials and provider failures without returning provider errors', async () => {
  const path = request('/tokens/' + address);
  assert.equal((await createBlockscoutHandler()(path)).status, 503);
  for (const [status, expected] of [[404, 404], [429, 429], [401, 502], [500, 502]]) {
    const handle = createBlockscoutHandler({ apiKey: 'mock-key', fetchUpstream: async () =>
      new Response('provider-only details', { status }) });
    const response = await handle(path);
    assert.equal(response.status, expected);
    assert.doesNotMatch(await response.text(), /mock-key|provider-only details/);
  }
  const malformed = createBlockscoutHandler({ apiKey: 'mock-key', fetchUpstream: async () => new Response('invalid') });
  assert.equal((await malformed(path)).status, 502);
});

test('closing a client connection aborts the upstream balance request', { timeout: 5000 }, async t => {
  const started = Promise.withResolvers();
  const server = createSepoliaHttpServer({ apiKey: 'mock-key', fetchUpstream: async (url, { signal }) => {
    started.resolve(signal);
    await once(signal, 'abort');
    throw signal.reason;
  } });
  server.listen(0, '127.0.0.1');
  t.after(() => {
    server.closeAllConnections();
    return new Promise(resolve => server.close(resolve));
  });
  await once(server, 'listening');

  const controller = new AbortController();
  const pending = fetch('http://127.0.0.1:' + server.address().port +
    '/api/sepolia/addresses/' + address + '/token-balances', { signal: controller.signal });
  const upstream = await Promise.race([started.promise, pending]);
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  const aborted = once(upstream, 'abort', { signal: AbortSignal.timeout(2000) });
  controller.abort();
  await Promise.all([rejected, aborted]);
  assert.equal(upstream.aborted, true);
});

test('forwards the Pro transaction history cursor and rejects malformed fields', async () => {
  const path = '/addresses/' + address + '/transactions';
  const cursor = new URLSearchParams({
    block_number: '10435582', fee: '641081769684', hash, index: '54',
    inserted_at: '2026-03-12T23:02:17.601368Z', value: '0'
  });
  let calls = 0;
  const handle = createBlockscoutHandler({ apiKey: 'mock-key', fetchUpstream: async url => {
    calls++;
    assert.equal(url.pathname, '/11155111/api/v2' + path);
    for (const [name, value] of cursor) assert.equal(url.searchParams.get(name), value);
    assert.equal(url.searchParams.get('apikey'), 'mock-key');
    return Response.json({ items: [] });
  } });
  assert.equal((await handle(request(path + '?' + cursor))).status, 200);
  for (const query of ['hash=bad', 'inserted_at=invalid', 'fee=-1', 'value=1.2', 'fee=1&fee=2', 'apikey=client']) {
    assert.equal((await handle(request(path + '?' + query))).status, 400);
  }
  assert.equal((await handle(request('/addresses/' + address + '/token-transfers?fee=1'))).status, 400);
  assert.equal(calls, 1);
});

test('returns a numeric retry delay for provider rate limits without leaking headers', async () => {
  for (const [retry, expected] of [['15', '15'], ['0', '1'], ['invalid', '1'], [null, '1']]) {
    const headers = { 'x-provider-private': 'mock-key' };
    if (retry !== null) headers['retry-after'] = retry;
    const handle = createBlockscoutHandler({ apiKey: 'mock-key', fetchUpstream: async () =>
      new Response('private details', { status: 429, headers }) });
    const response = await handle(request('/tokens/' + address));
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('retry-after'), expected);
    assert.equal(response.headers.get('x-provider-private'), null);
    assert.doesNotMatch(await response.text(), /mock-key|private details/);
  }
});
