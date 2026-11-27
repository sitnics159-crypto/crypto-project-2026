import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { createSepoliaHttpServer } from '../server/sepolia-http.mjs';
import { buildProPreview } from '../scripts/build-pro-preview.mjs';

const apiKey = process.env.BLOCKSCOUT_API_KEY?.trim();
assert.ok(apiKey && /^proapi_[A-Za-z0-9_-]+$/.test(apiKey), 'Set the Blockscout Pro secret before running the live test.');
const preview = buildProPreview(
  readFileSync(new URL('../index.html', import.meta.url), 'utf8'),
  readFileSync(new URL('../token-balances.mjs', import.meta.url), 'utf8')
);
const address = '0xd482cCc8EC97e9cA7a365F2403bf7f228aD149A0';
const hash = '0x616c86b82eaa5485aa04e9773bd281bbc8fd9cd6b050efcc2f864bed50707204';
const server = createSepoliaHttpServer({ apiKey, preview });
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = 'http://127.0.0.1:' + server.address().port;
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ acceptDownloads: true });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (route.request().url().includes(apiKey) || url.origin !== origin) {
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  const requests = [];
  page.on('request', request => requests.push(request.url()));

  await page.goto(origin + '/?tx=' + hash);
  await page.locator('#result').waitFor({ timeout: 20000 });
  assert.equal(await page.locator('#r-hash').innerText(), hash);

  const historyPath = '/api/sepolia/addresses/' + address + '/transactions';
  const isHistory = response => new URL(response.url()).pathname.toLowerCase() === historyPath.toLowerCase();
  const [firstHistory] = await Promise.all([
    page.waitForResponse(response => isHistory(response) && !new URL(response.url()).search, { timeout: 20000 }),
    page.goto(origin + '/?address=' + address)
  ]);
  assert.equal(firstHistory.status(), 200);
  const firstPage = await firstHistory.json();
  assert.ok(firstPage.items?.length > 0 && firstPage.next_page_params, 'Expected a paginated transaction history.');
  await page.locator('#address-result').waitFor({ timeout: 20000 });
  assert.equal((await page.locator('#a-hash').innerText()).toLowerCase(), address.toLowerCase());
  await page.locator('#token-balances-load').click();
  const balance = page.locator('#token-balances-list li').filter({ hasText: 'FAUCET' }).first();
  await balance.waitFor({ timeout: 20000 });
  assert.match(await balance.innerText(), / · \d+(?:\.\d+)?$/);

  const transferRows = page.locator('#address-token-transfers .token-transfer');
  const transferStatus = page.locator('#token-list-status');
  const loadTransfers = page.locator('#token-load-more');
  await transferRows.first().waitFor({ timeout: 20000 });
  const initialCount = Number((await transferStatus.innerText()).match(/из (\d+) загруженных переводов/)?.[1]);
  assert.ok(initialCount > 0, 'Expected a first page of ERC-20 transfers.');
  for (let i = await transferRows.count(); i < initialCount; i += 5) await loadTransfers.click();
  const [secondTransfers] = await Promise.all([
    page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname.endsWith('/token-transfers') && url.searchParams.has('block_number');
    }, { timeout: 20000 }),
    loadTransfers.click()
  ]);
  assert.equal(secondTransfers.status(), 200);
  await page.waitForFunction(count => {
    const label = document.querySelector('#token-list-status').textContent;
    return Number(label.match(/из (\d+) загруженных переводов/)?.[1]) > count;
  }, initialCount, { timeout: 10000 });
  const loadedCount = Number((await transferStatus.innerText()).match(/из (\d+) загруженных переводов/)?.[1]);

  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#token-export').click()]);
  const csv = readFileSync(await download.path(), 'utf8');
  assert.match(csv.split(/\r?\n/, 1)[0], /amount_raw/);
  // Export fields are quoted. Match an entire record so a newline inside a token name is not a row.
  const records = [...csv.matchAll(/^"(0x[0-9a-f]{64})","(\d+)"(?:,"(?:[^"]|"")*"){11}\r?$/gim)];
  const exportedEvents = new Set(records.map(([, txHash, logIndex]) => txHash.toLowerCase() + ':' + logIndex));
  assert.equal(records.length, loadedCount, 'CSV must export every loaded transfer.');
  assert.equal(exportedEvents.size, loadedCount, 'CSV must not repeat a transfer event.');
  console.log('CSV included all ' + loadedCount + ' unique ERC-20 transfers from two pages.');
  const historyRows = page.locator('#address-transactions .tx-row');
  const loadHistory = page.locator('#address-tx-load-more');
  const visibleCount = await historyRows.count();
  assert.ok(visibleCount > 0);
  for (let i = visibleCount; i < firstPage.items.length; i += 5) await loadHistory.click();
  const [secondHistory] = await Promise.all([
    page.waitForResponse(response => isHistory(response) && !!new URL(response.url()).search, { timeout: 20000 }),
    loadHistory.click()
  ]);
  assert.equal(secondHistory.status(), 200);
  const secondItems = (await secondHistory.json()).items;
  const firstHashes = new Set(firstPage.items.map(item => item.hash));
  assert.ok(secondItems?.some(item => !firstHashes.has(item.hash)), 'The next page must include a new transaction.');
  await page.waitForFunction(count => document.querySelectorAll('#address-transactions .tx-row').length > count,
    firstPage.items.length, { timeout: 10000 });

  assert.ok(requests.some(url => url.startsWith(origin + '/api/sepolia/') && url.endsWith('/token-balances')));
  assert.ok(!requests.some(url => url.includes(apiKey) || new URL(url).searchParams.has('apikey')),
    'A browser request contained API credentials.');
  assert.ok(!(await page.content()).includes(apiKey), 'The page contained API credentials.');
  console.log('Live Sepolia browser check passed for lookup, ERC-20 balances, CSV and transaction pagination through the server.');
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
