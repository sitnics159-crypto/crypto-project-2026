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

  await page.goto(origin + '/?address=' + address);
  await page.locator('#address-result').waitFor({ timeout: 20000 });
  assert.equal((await page.locator('#a-hash').innerText()).toLowerCase(), address.toLowerCase());
  await page.locator('#token-balances-load').click();
  const balance = page.locator('#token-balances-list li').filter({ hasText: 'FAUCET' }).first();
  await balance.waitFor({ timeout: 20000 });
  assert.match(await balance.innerText(), / · \d+(?:\.\d+)?$/);

  await page.locator('#address-token-transfers .token-transfer').first().waitFor({ timeout: 20000 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#token-export').click()]);
  const csv = readFileSync(await download.path(), 'utf8');
  assert.match(csv.split(/\r?\n/, 1)[0], /amount_raw/);
  assert.ok(csv.trim().split(/\r?\n/).length > 1, 'The CSV must include at least one transfer.');
  assert.ok(requests.some(url => url.startsWith(origin + '/api/sepolia/') && url.endsWith('/token-balances')));
  assert.ok(!requests.some(url => url.includes(apiKey) || new URL(url).searchParams.has('apikey')),
    'A browser request contained API credentials.');
  assert.ok(!(await page.content()).includes(apiKey), 'The page contained API credentials.');
  console.log('Live Sepolia browser check passed for lookup, ERC-20 balances and CSV through the server.');
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
