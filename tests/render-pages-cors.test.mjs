import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSepoliaHttpServer } from '../server/sepolia-http.mjs';

test('Sepolia API CORS is restricted to the Pages origin', async (t) => {
  const server = createSepoliaHttpServer({ apiKey: '' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const path = '/api/sepolia/transactions/invalid';
  const allowed = 'https://sitnics159-crypto.github.io';
  for (const origin of [allowed, 'https://example.com', 'null', undefined]) {
    const response = await fetch(base + path, { headers: origin === undefined ? {} : { Origin: origin } });
    assert.equal(response.headers.get('access-control-allow-origin'), origin === allowed ? allowed : null);
    assert.match(response.headers.get('vary') ?? '', /Origin/i);
    await response.text();
  }
  const health = await fetch(base + '/healthz', { headers: { Origin: allowed } });
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('access-control-allow-origin'), null);
  assert.deepEqual(await health.json(), { status: 'ok' });
  const rejected = await fetch(base + path, { method: 'POST', headers: { Origin: allowed } });
  assert.equal(rejected.status, 405);
  assert.equal(rejected.headers.get('access-control-allow-origin'), allowed);
  await rejected.text();
});
