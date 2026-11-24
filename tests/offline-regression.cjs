const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'application.json'), 'utf8'));
  const paginationFixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'pagination.json'), 'utf8'));
  const staleFixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'stale-requests.json'), 'utf8'));
  const apiErrorFixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'api-errors.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('pageerror', error => { throw error; });
  // The offline suite must never depend on Blockscout, Kraken, or any other external host.
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
    return route.abort('blockedbyclient');
  });
  try {
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
    if (!(await page.title()).includes('Sepolia')) throw new Error('Unexpected page title');

    const fixtureResult = await page.evaluate(f => ({
      type: transactionTypeLabel(f.transaction),
      status: statusOf(f.transaction).key,
      amount: tokenAmount(f.transfer),
      exactAmount: exactTokenAmount(f.transfer),
      csv: csvCell(f.csvFormula)
    }), fixture);
    if (fixtureResult.type !== fixture.expected.type ||
        fixtureResult.status !== fixture.expected.status ||
        fixtureResult.amount !== fixture.expected.amount ||
        fixtureResult.exactAmount !== fixture.expected.exactAmount ||
        !fixtureResult.csv.startsWith("\"'=")) {
      throw new Error('Application fixture regression failed: ' + JSON.stringify(fixtureResult));
    }
    console.log('Transaction, token-decimals, and CSV fixtures passed');

    const edgeCases = await page.evaluate(async (paginationFixture) => {
      const amountZeroDecimals = tokenAmount({ total: { value: '12345', decimals: '0' } });
      const amountTiny = tokenAmount({ total: { value: '1', decimals: '18' } });
      const amountInvalidDecimals = tokenAmount({ total: { value: '12345', decimals: '256' } });
      const amountMissingDecimals = tokenAmount({ total: { value: '12345' } });
      const amountMetadataFallback = tokenAmount({ total: { value: '1', decimals: '256' }, token: { decimals: '18' } });
      const eventAmountInvalidDecimalsFallback = tokenEventAmount({ total: { value: '1', decimals: '256' } }, { decimals: '18', symbol: 'TEST' });
      const contractTokenType = transactionTypeLabel({ transaction_types: ['token_transfer'], to: { is_contract: true }, value: '0' });
      const formulaCell = csvCell('=HYPERLINK("https://example.com")');
      const newlineFormulaCell = csvCell('\n=HYPERLINK("https://example.com")');
      const fullwidthFormulaCell = csvCell('＝HYPERLINK("https://example.com")');
      tokenTransferAddress = paginationFixture.address;
      tokenTransferItems = paginationFixture.filterItems;
      tokenTransferFilter = 'incoming';
      const incoming = filteredTokenTransfers().map(item => item.transaction_hash);
      tokenTransferFilter = 'outgoing';
      const outgoing = filteredTokenTransfers().map(item => item.transaction_hash);
      tokenTransferFilter = 'all';
      const saved = { items: tokenTransferItems, next: tokenTransferNext, visible: tokenTransferVisible, filter: tokenTransferFilter, address: tokenTransferAddress };
      tokenTransferItems = paginationFixture.pageItems;
      tokenTransferNext = { block_number: 123 };
      tokenTransferVisible = 5;
      tokenTransferFilter = 'all';
      renderTokenTransferList();
      await loadMoreTokenTransfers();
      const localPaginationVisible = document.querySelectorAll('#address-token-transfers .token-transfer').length;
      tokenTransferItems = saved.items; tokenTransferNext = saved.next; tokenTransferVisible = saved.visible;
      tokenTransferFilter = saved.filter; tokenTransferAddress = saved.address;
      renderTokenTransferList();
      const retryAddress = '0x' + 'c'.repeat(40);
      tokenMetadataCache.delete(retryAddress.toLowerCase());
      const originalFetch = window.fetch;
      let metadataAttempts = 0;
      window.fetch = async (url, options) => {
        if (String(url).includes('/api/v2/tokens/' + retryAddress)) {
          metadataAttempts++;
          if (metadataAttempts === 1) return { ok: false, status: 503, json: async () => ({}) };
          return { ok: true, status: 200, json: async () => ({ decimals: '18' }) };
        }
        return originalFetch(url, options);
      };
      let metadataRetry;
      try {
        const retryItem = { total: { value: '1', decimals: '256' }, token: { address_hash: retryAddress } };
        const firstAttempt = await resolveTokenDecimals(retryItem);
        const secondAttempt = await resolveTokenDecimals(retryItem);
        metadataRetry = { firstAttempt, secondAttempt, attempts: metadataAttempts };
      } finally {
        window.fetch = originalFetch;
        tokenMetadataCache.delete(retryAddress.toLowerCase());
      }
      return { amountZeroDecimals, amountTiny, amountInvalidDecimals, amountMissingDecimals, amountMetadataFallback, eventAmountInvalidDecimalsFallback, contractTokenType, localPaginationVisible, formulaCell, newlineFormulaCell, fullwidthFormulaCell, incoming, outgoing, metadataRetry };
    }, paginationFixture);
    if (edgeCases.amountZeroDecimals !== '12345') throw new Error('Zero-decimals token amount failed: ' + edgeCases.amountZeroDecimals);
    if (edgeCases.amountTiny !== '0.000000000000000001') throw new Error('Tiny ERC-20 amount lost precision: ' + edgeCases.amountTiny);
    if (!edgeCases.amountInvalidDecimals.includes('decimals недоступен')) throw new Error('Invalid decimals were not rejected safely');
    if (!edgeCases.amountMissingDecimals.includes('decimals недоступен')) throw new Error('Missing decimals were not handled safely');
    if (edgeCases.amountMetadataFallback !== '0.000000000000000001') throw new Error('Invalid event decimals did not fall back to valid token metadata: ' + edgeCases.amountMetadataFallback);
    if (edgeCases.eventAmountInvalidDecimalsFallback !== '0.000000000000000001 TEST') throw new Error('Transaction event amount did not fall back to valid token metadata: ' + edgeCases.eventAmountInvalidDecimalsFallback);
    if (edgeCases.metadataRetry.firstAttempt !== null || edgeCases.metadataRetry.secondAttempt !== 18 || edgeCases.metadataRetry.attempts !== 2) throw new Error('Transient token metadata failure was cached instead of retried: ' + JSON.stringify(edgeCases.metadataRetry));
    if (edgeCases.contractTokenType !== 'Перевод токена') throw new Error('ERC-20 transfer to a contract was misclassified: ' + edgeCases.contractTokenType);
    if (edgeCases.localPaginationVisible !== 8) throw new Error('Show-more did not reveal remaining items already loaded from the first page: ' + edgeCases.localPaginationVisible);
    if (edgeCases.incoming.join(',') !== '0x2' || edgeCases.outgoing.join(',') !== '0x3') {
      throw new Error('Self-transfer was incorrectly included in incoming/outgoing filters: ' + JSON.stringify(edgeCases));
    }
    if (!edgeCases.formulaCell.startsWith('"\'=HYPERLINK')) throw new Error('CSV formula injection guard failed');
    if (!edgeCases.newlineFormulaCell.startsWith('"\'\n=HYPERLINK')) throw new Error('CSV newline formula injection guard failed');
    if (!edgeCases.fullwidthFormulaCell.startsWith('"\'＝HYPERLINK')) throw new Error('CSV full-width formula injection guard failed');
    console.log('Edge cases verified:', JSON.stringify(edgeCases));
    const raceResults = await page.evaluate(async (staleFixture) => {
      const originalFetch = window.fetch;
      const addressA = staleFixture.addressA;
      const addressB = staleFixture.addressB;
      const addressC = staleFixture.addressC;
      const deferred = () => {
        let resolve;
        const promise = new Promise(done => { resolve = done; });
        return { promise, resolve };
      };
      const gates = { initialA: deferred(), pageBTx: deferred(), pageBToken: deferred() };
      const counts = {
        initialAStarted: 0, initialACompleted: 0,
        pageBTxStarted: 0, pageBTxCompleted: 0,
        pageBTokenStarted: 0, pageBTokenCompleted: 0
      };
      const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
      const makeResponse = payload => ({ ok: true, status: 200, json: async () => payload });
      const makePayload = (address, kind, isPage) => {
        if (kind === 'info') return { hash: address, coin_balance: '0', is_contract: false };
        if (kind === 'transactions') return {
          items: [{ hash: address + (isPage ? '-late-tx' : '-first-tx'), value: '0', block_number: 1 }],
          next_page_params: isPage ? null : { block_number: 123, index: 0 }
        };
        return {
          items: [{
            transaction_hash: address + (isPage ? '-late-token' : '-first-token'),
            token_type: 'ERC-20', log_index: isPage ? 2 : 1,
            from: { hash: address }, to: { hash: '0x' + 'd'.repeat(40) },
            token: { address_hash: '0x' + 'e'.repeat(40), symbol: 'RACE' },
            total: { value: '1', decimals: '0' }
          }],
          next_page_params: isPage ? null : { block_number: 123, index: 0 }
        };
      };
      window.fetch = async (url, options) => {
        const parsed = new URL(String(url));
        const match = parsed.pathname.match(/\/addresses\/(0x[a-f0-9]{40})(?:\/(transactions|token-transfers))?$/i);
        if (!match) return originalFetch(url, options);
        const address = match[1].toLowerCase();
        const endpoint = match[2] || 'info';
        const isPage = parsed.searchParams.has('block_number');
        if (address === addressA && !isPage) {
          counts.initialAStarted++;
          await gates.initialA.promise;
          counts.initialACompleted++;
        } else if (address === addressB && isPage && endpoint === 'transactions') {
          counts.pageBTxStarted++;
          await gates.pageBTx.promise;
          counts.pageBTxCompleted++;
        } else if (address === addressB && isPage && endpoint === 'token-transfers') {
          counts.pageBTokenStarted++;
          await gates.pageBToken.promise;
          counts.pageBTokenCompleted++;
        }
        // Deliberately ignore options.signal to exercise generation guards.
        return makeResponse(makePayload(address, endpoint, isPage));
      };
      const submit = address => {
        addressInput.value = address;
        addressForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      };
      const waitFor = async predicate => {
        for (let i = 0; i < 400; i++) {
          if (predicate()) return;
          await delay(5);
        }
        throw new Error('Timed out waiting for deterministic address race gate: ' + JSON.stringify(counts));
      };
      try {
        submit(addressA);
        await waitFor(() => counts.initialAStarted === 3);
        submit(addressB);
        await waitFor(() =>
          !addressResult.hidden &&
          document.querySelector('#a-hash').textContent.toLowerCase() === addressB &&
          addressTxItems.length === 1 && tokenTransferItems.length === 1
        );
        gates.initialA.resolve();
        await waitFor(() => counts.initialACompleted === 3);
        const staleInitialIgnored =
          document.querySelector('#a-hash').textContent.toLowerCase() === addressB &&
          addressTxItems.length === 1 && addressTxItems[0].hash === addressB + '-first-tx' &&
          tokenTransferAddress === addressB && tokenTransferItems.length === 1 &&
          tokenTransferItems[0].transaction_hash === addressB + '-first-token' &&
          !addressButton.disabled && addressLoading.hidden;
    
        submit(addressB);
        await waitFor(() =>
          !addressResult.hidden &&
          document.querySelector('#a-hash').textContent.toLowerCase() === addressB &&
          addressTxNext && tokenTransferNext
        );
        const oldTxPage = loadMoreAddressTx();
        const oldTokenPage = loadMoreTokenTransfers();
        await waitFor(() => counts.pageBTxStarted === 1 && counts.pageBTokenStarted === 1);
        submit(addressC);
        await waitFor(() =>
          !addressResult.hidden &&
          document.querySelector('#a-hash').textContent.toLowerCase() === addressC &&
          addressTxItems.length === 1 && tokenTransferItems.length === 1
        );
        gates.pageBTx.resolve();
        gates.pageBToken.resolve();
        await Promise.all([oldTxPage, oldTokenPage]);
        await waitFor(() => counts.pageBTxCompleted === 1 && counts.pageBTokenCompleted === 1);
        const stalePagesIgnored =
          document.querySelector('#a-hash').textContent.toLowerCase() === addressC &&
          addressTxItems.length === 1 && addressTxItems[0].hash === addressC + '-first-tx' &&
          tokenTransferAddress === addressC && tokenTransferItems.length === 1 &&
          tokenTransferItems[0].transaction_hash === addressC + '-first-token' &&
          !addressTxLoading && !tokenTransferLoading &&
          !addressTxLoadMore.disabled && !tokenLoadMore.disabled;
        return { staleInitialIgnored, stalePagesIgnored, counts };
      } finally {
        window.fetch = originalFetch;
      }
    }, staleFixture);
    if (!raceResults.staleInitialIgnored) throw new Error('Delayed initial lookup overwrote newer address or loading state: ' + JSON.stringify(raceResults));
    if (!raceResults.stalePagesIgnored) throw new Error('Delayed pagination overwrote newer address or loading state: ' + JSON.stringify(raceResults));
    console.log('Deterministic stale address/pagination race regressions passed:', JSON.stringify(raceResults));

    // Exercise the user-visible API failure handling with deterministic fetch responses.
    const apiErrors = await page.evaluate(async (apiErrorFixture) => {
      const originalFetch = window.fetch;
      const originalSetTimeout = window.setTimeout;
      const address = '0x' + 'a'.repeat(40);
      const submit = () => {
        addressInput.value = address;
        addressForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      };
      const run = async (mode) => {
        window.fetch = (url, options = {}) => {
          if (mode === 'timeout') return new Promise((resolve, reject) => {
            options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
          });
          const status = mode === 'rate-limit' ? apiErrorFixture.rateLimit.status : apiErrorFixture.serverError.status;
          return Promise.resolve({ ok: false, status, json: async () => ({}) });
        };
        if (mode === 'timeout') {
          window.setTimeout = (callback, delay, ...args) =>
            originalSetTimeout(callback, delay === 15000 ? 0 : delay, ...args);
        }
        submit();
        for (let attempt = 0; attempt < 100; attempt++) {
          await new Promise(resolve => originalSetTimeout(resolve, 5));
          if (!addressError.hidden) return addressError.textContent;
        }
        throw new Error('Timed out waiting for ' + mode + ' error state');
      };
      try {
        const rateLimit = await run('rate-limit');
        const serverError = await run('server-error');
        const timeout = await run('timeout');
        return { rateLimit, serverError, timeout };
      } finally {
        window.fetch = originalFetch;
        window.setTimeout = originalSetTimeout;
      }
    }, apiErrorFixture);
    if (!apiErrors.rateLimit.includes(apiErrorFixture.rateLimit.expected) ||
        !apiErrors.serverError.includes(apiErrorFixture.serverError.expected) ||
        !apiErrors.timeout.includes(apiErrorFixture.timeout.expected)) {
      throw new Error('API failure handling regression: ' + JSON.stringify(apiErrors));
    }
    console.log('Timeout, HTTP 429, and HTTP 5xx fixtures passed');
    console.log('All deterministic offline application tests passed');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
