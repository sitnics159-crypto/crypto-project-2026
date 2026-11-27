import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { createBlockscoutHandler } from '../server/blockscout-sepolia.mjs';
import { createSharedRateLimit } from '../server/shared-rate-limit.mjs';

test('two Sepolia handlers share a five-request rolling limit and fail closed', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'sepolia-limit-'));
  const path = join(directory, 'quota.sqlite');
  const databases = [];
  try {
    databases.push(new DatabaseSync(path));
    databases.push(new DatabaseSync(path));
    databases[0].exec(readFileSync(new URL(
      '../server/migrations/0000_blockscout_request_window.sql', import.meta.url
    ), 'utf8'));
    let time = 1000;
    let upstreamCalls = 0;
    const handlers = databases.map(db => createBlockscoutHandler({
      apiKey: 'test-key',
      reserveStart: createSharedRateLimit({
        prepare: sql => ({ bind: (...args) => ({ first: () => db.prepare(sql).get(...args) }) })
      }, () => time),
      fetchUpstream: async () => {
        upstreamCalls++;
        return Response.json({});
      }
    }));
    const request = () => new Request('https://example.test/addresses/0x' + 'a'.repeat(40));
    const responses = await Promise.all(Array.from({ length: 6 }, (_, i) =>
      handlers[i % 2](request())
    ));
    assert.deepEqual(responses.map(response => response.status), [200, 200, 200, 200, 200, 429]);
    assert.equal(responses[5].headers.get('retry-after'), '1');
    time = 1999;
    assert.equal((await handlers[1](request())).status, 429);
    time = 2000;
    assert.equal((await handlers[1](request())).status, 200);
    databases[0].exec('DROP TABLE blockscout_request_window');
    assert.equal((await handlers[0](request())).status, 503);
    assert.equal(upstreamCalls, 6);
  } finally {
    for (const db of databases) db.close();
    rmSync(directory, { recursive: true });
  }
});
