import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { createBlockscoutHandler } from '../server/blockscout-sepolia.mjs';

const origin = 'http://127.0.0.1:4173';
const hash = '0x' + 'a'.repeat(64);
const address = '0x' + 'b'.repeat(40);
const sender = '0x' + 'c'.repeat(40);
const token = '0x' + 'd'.repeat(40);
const key = 'mock-server-key';
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
  [addresses + '/token-transfers', { items: [transfer], next_page_params: null }],
  ['/tokens/' + token, { decimals: '6' }]
]);
const handle = createBlockscoutHandler({
  apiKey: key,
  fetchUpstream: async url => {
    assert.equal(url.origin, 'https://api.blockscout.com');
    assert.equal(url.searchParams.get('apikey'), key);
    const path = url.pathname.replace(/^\/11155111\/api\/v2/, '');
    assert.ok(mocks.has(path), 'Unexpected upstream route: ' + path);
    paths.add(path);
    return Response.json(mocks.get(path));
  }
});

const pageHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  .replaceAll('https://eth-sepolia.blockscout.com/api/v2/', '/preview-api/')
  .replace('connect-src https://eth-sepolia.blockscout.com', "connect-src 'self'");
const script = pageHtml.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'Expected the application script');
const scriptHash = createHash('sha256').update(script).digest('base64');
const preview = pageHtml.replace(/script-src 'sha256-[^']+'/, `script-src 'sha256-${scriptHash}'`);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ acceptDownloads: true });
  const pageErrors = [];
  const bridgeRequests = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/preview-api/')) {
      return route.fulfill({ body: preview, contentType: 'text/html; charset=utf-8' });
    }
    bridgeRequests.push(url);
    const target = new URL(url);
    target.pathname = target.pathname.slice('/preview-api'.length);
    const response = await handle(new Request(target, { method: route.request().method() }));
    return route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: await response.text()
    });
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
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#token-export').click()]);
  const csv = readFileSync(await download.path(), 'utf8');
  assert.match(csv, /"1\.234567","1234567","6"/);
  assert.ok(csv.includes(hash));
  assert.equal(paths.size, mocks.size);
  assert.equal(bridgeRequests.length, mocks.size);
  assert.ok(bridgeRequests.every(url => !url.searchParams.has('apikey')));
  assert.deepEqual(pageErrors, []);
  console.log('Mocked browser check passed: transaction, address, token decimals and CSV through five server routes.');
} finally {
  await browser.close();
}
