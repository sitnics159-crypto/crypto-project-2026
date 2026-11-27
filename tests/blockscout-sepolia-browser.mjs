import assert from 'node:assert/strict';
import { once } from 'node:events';
import { buildProPreview } from '../scripts/build-pro-preview.mjs';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { createSepoliaHttpServer } from '../server/sepolia-http.mjs';

const hash = '0x' + 'a'.repeat(64);
const address = '0x' + 'b'.repeat(40);
const sender = '0x' + 'c'.repeat(40);
const token = '0x' + 'd'.repeat(40);
const key = 'mock-server-key';
const secondHash = '0x' + 'e'.repeat(64);
const addresses = '/addresses/' + address;
const paths = new Set();
const transfer = {
  transaction_hash: hash, log_index: 0, token_type: 'ERC-20',
  from: { hash: sender }, to: { hash: address },
  token: { address_hash: token, symbol: 'TEST' }, total: { value: '1234567' }
};
const mocks = new Map([
  ['/transactions/' + hash, { hash, status: 'ok', block_number: 100, fee: { value: '21000000000000' } }],
  [addresses, { hash: address, coin_balance: '1000000000000000000' }],
  [addresses + '/transactions', { items: [{ hash, status: 'ok', block_number: 100 }], next_page_params: null }],
  [addresses + '/token-transfers', { items: [transfer], next_page_params: { block_number: 100, index: 0, items_count: 1 } }],
  ['/tokens/' + token, { decimals: '6' }],
  [addresses + '/token-balances', [{
    value: '123456789012345678901234567890',
    token: { address_hash: token, type: 'ERC-20', symbol: 'TEST', decimals: '18' }
  }]]
]);
const preview = buildProPreview(
  readFileSync(new URL('../index.html', import.meta.url), 'utf8'),
  readFileSync(new URL('../token-balances.mjs', import.meta.url), 'utf8')
);
let time = 0;
const server = createSepoliaHttpServer({
  preview,
  now: () => time,
  apiKey: key,
  fetchUpstream: async url => {
    assert.equal(url.origin, 'https://api.blockscout.com');
    assert.equal(url.searchParams.get('apikey'), key);
    const path = url.pathname.replace(/^\/11155111\/api\/v2/, '');
    assert.ok(mocks.has(path), 'Unexpected upstream route: ' + path);
    paths.add(path);
    if (path.endsWith('/token-transfers') && url.searchParams.has('block_number')) {
      assert.equal(url.searchParams.get('block_number'), '100');
      assert.equal(url.searchParams.get('index'), '0');
      assert.equal(url.searchParams.get('items_count'), '1');
      assert.equal(url.searchParams.get('type'), 'ERC-20');
      return Response.json({ items: [{ ...transfer, transaction_hash: secondHash }], next_page_params: null });
    }
    return Response.json(mocks.get(path));
  }
});

server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = 'http://127.0.0.1:' + server.address().port;
let browser;
try {
  const balanceUrl = origin + '/api/sepolia' + addresses + '/token-balances';
  assert.equal((await fetch(balanceUrl, { method: 'POST' })).status, 405);
  assert.equal((await fetch(balanceUrl + '?apikey=client')).status, 400);
  assert.equal((await fetch(origin + '/unknown')).status, 404);
  const module = await fetch(origin + '/token-balances.mjs');
  assert.match(module.headers.get('content-type'), /^text\/javascript/);
  assert.equal(module.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(await module.text(), preview.balanceModule);
  browser = await chromium.launch();
  const page = await browser.newPage({ acceptDownloads: true });
  const pageErrors = [];
  const bridgeRequests = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort('blockedbyclient');
    if (url.pathname.startsWith('/api/sepolia/')) bridgeRequests.push(url);
    return route.continue();
  });
  await page.goto(origin + '/?tx=' + hash);
  await page.locator('#result').waitFor();
  assert.equal(await page.locator('#r-hash').innerText(), hash);
  assert.equal(await page.locator('#r-fee').innerText(), '0.000021 ETH');

  await page.locator('#address-input').fill(address);
  await page.locator('#address-submit').click();
  await page.locator('#address-result').waitFor();
  assert.equal(await page.locator('#a-hash').innerText(), address);
  const row = page.locator('#address-token-transfers .token-transfer');
  await row.getByText(/1\.234567 TEST/).waitFor();
  time = 1000;
  await page.locator('#token-load-more').click();
  await page.waitForFunction(() => document.querySelectorAll('#address-token-transfers .token-transfer').length === 2);
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#token-export').click()]);
  const csv = readFileSync(await download.path(), 'utf8');
  assert.match(csv, /"1\.234567","1234567","6"/);
  assert.ok(csv.includes(hash) && csv.includes(secondHash));
  time = 2000;
  await page.getByRole('button', { name: 'Загрузить балансы' }).click();
  const balance = page.locator('#token-balances-list li');
  await balance.waitFor();
  assert.equal(await balance.innerText(), 'TEST · ' + token + ' · 123456789012.34567890123456789');
  assert.ok(bridgeRequests.some(url => url.pathname === '/api/sepolia' + addresses + '/token-balances'));
  assert.equal(paths.size, mocks.size);
  assert.equal(bridgeRequests.length, mocks.size + 1);
  assert.ok(bridgeRequests.every(url => !url.searchParams.has('apikey') && !url.href.includes(key)));
  assert.ok(!(await page.content()).includes(key));
  assert.deepEqual(pageErrors, []);
  console.log('Mocked browser check passed: transaction, address, token decimals, pagination, CSV and exact balances through six server routes.');
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
