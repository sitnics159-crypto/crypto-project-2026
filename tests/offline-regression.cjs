const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'application.json'), 'utf8'));
  const paginationFixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'pagination.json'), 'utf8'));
  const staleFixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'stale-requests.json'), 'utf8'));
  const apiErrorFixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'api-errors.json'), 'utf8'));
  const transactionFixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'transaction-states.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ acceptDownloads: true });
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
      const tinyFee = formatFeeDisplay('1422359');
      const normalFee = formatFeeDisplay('21000000000000');
      const zeroFee = formatFeeDisplay('0');
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
      return { amountZeroDecimals, amountTiny, tinyFee, normalFee, zeroFee, amountInvalidDecimals, amountMissingDecimals, amountMetadataFallback, eventAmountInvalidDecimalsFallback, contractTokenType, localPaginationVisible, formulaCell, newlineFormulaCell, fullwidthFormulaCell, incoming, outgoing, metadataRetry };
    }, paginationFixture);
    if (edgeCases.amountZeroDecimals !== '12345') throw new Error('Zero-decimals token amount failed: ' + edgeCases.amountZeroDecimals);
    if (edgeCases.amountTiny !== '0.000000000000000001') throw new Error('Tiny ERC-20 amount lost precision: ' + edgeCases.amountTiny);
    if (edgeCases.tinyFee !== '0.000000000001422359 ETH') throw new Error('Tiny positive transaction fee was rounded to zero: ' + edgeCases.tinyFee);
    if (edgeCases.normalFee !== '0.000021 ETH') throw new Error('Normal transaction fee formatting changed: ' + edgeCases.normalFee);
    if (edgeCases.zeroFee !== '0 ETH') throw new Error('Zero transaction fee formatting changed: ' + edgeCases.zeroFee);
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
    // Exercise transaction rendering and request failures using local fixtures only.
    const transactionRegression = await page.evaluate(async fixture => {
      const originalFetch = window.fetch;
      const originalSetTimeout = window.setTimeout;
      const submit = async hash => {
        result.hidden = true;
        errorBox.hidden = true;
        input.value = hash;
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        for (let attempt = 0; attempt < 100; attempt++) {
          await new Promise(resolve => originalSetTimeout(resolve, 5));
          if (!result.hidden || !errorBox.hidden) return;
        }
        throw new Error('Timed out waiting for transaction lookup result');
      };
      const checks = [];
      try {
        for (const item of fixture.transactions) {
          window.fetch = async () => ({
            ok: true, status: 200, json: async () => item.data
          });
          await submit(fixture.hash);
          const actual = {
            status: document.querySelector('#r-status').textContent,
            value: document.querySelector('#r-value').textContent,
            fee: document.querySelector('#r-fee').textContent,
            block: document.querySelector('#r-block').textContent,
            from: document.querySelector('#r-from').textContent,
            to: document.querySelector('#r-to').textContent,
            time: document.querySelector('#r-time').textContent,
            explanation: document.querySelector('#r-explanation').textContent
          };
          for (const [key, expected] of Object.entries(item.expected)) {
            if (key === 'explanation') {
              if (!actual.explanation.includes(expected)) throw new Error(item.name + ' explanation mismatch: ' + actual.explanation);
            } else if (key === 'time') {
              if (actual.time !== expected) throw new Error(item.name + ' time mismatch: ' + actual.time);
            } else if (actual[key] !== expected) {
              throw new Error(item.name + ' ' + key + ' mismatch: expected "' + expected + '", got "' + actual[key] + '"');
            }
          }
          if (item.name === 'success' && actual.time === 'Не удалось определить') {
            throw new Error('Valid transaction timestamp was not rendered');
          }
          checks.push(item.name);
        }

        const errorCases = [
          { name: 'not-found', status: 404, expected: fixture.errors.notFound },
          { name: 'rate-limit', status: 429, expected: fixture.errors.rateLimit },
          { name: 'server', status: 503, expected: fixture.errors.server },
          { name: 'incomplete', status: 200, body: {}, expected: fixture.errors.incomplete }
        ];
        const errors = {};
        for (const item of errorCases) {
          window.fetch = async () => ({
            ok: item.status >= 200 && item.status < 300,
            status: item.status,
            json: async () => item.body || {}
          });
          await submit(fixture.hash);
          errors[item.name] = errorBox.textContent;
          if (result.hidden !== true || errorBox.hidden || !errors[item.name].includes(item.expected)) {
            throw new Error('Transaction ' + item.name + ' error state mismatch: ' + errors[item.name]);
          }
        }

        window.fetch = async (url, options = {}) => new Promise((resolve, reject) => {
          // AbortSignal is intentionally honored to test the visible timeout path.
          const signal = options.signal;
          signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        });
        window.setTimeout = (callback, delay, ...args) =>
          originalSetTimeout(callback, delay === 15000 ? 0 : delay, ...args);
        await submit(fixture.hash);
        errors.timeout = errorBox.textContent;
        if (!errors.timeout.includes('слишком долго')) throw new Error('Transaction timeout message mismatch: ' + errors.timeout);

        window.fetch = async () => { throw new Error('Unexpected network request for invalid hash'); };
        await submit('0x1234');
        errors.invalidHash = errorBox.textContent;
        if (!errors.invalidHash.includes('Проверьте формат')) throw new Error('Invalid hash was not rejected before fetch');

        return { states: checks, errors };
      } finally {
        window.fetch = originalFetch;
        window.setTimeout = originalSetTimeout;
      }
    }, transactionFixture);
    console.log('Transaction state matrix passed:', JSON.stringify(transactionRegression));

    // Exercise Kraken market snapshot success and failure paths with deterministic local responses.
    const marketRegression = await page.evaluate(async () => {
      const originalFetch = window.fetch;
      const originalSetTimeout = window.setTimeout;
      const tickerPayload = {
        error: [],
        result: {
          XXBTZUSD: { c: ['62000.00', '1'], h: ['63000.00', '64000.00'], l: ['61000.00', '60000.00'] },
          XETHZUSD: { c: ['1800.00', '1'], h: ['1850.00', '1900.00'], l: ['1750.00', '1700.00'] }
        }
      };
      const makeRows = open => Array.from({ length: 26 }, (_, index) => [
        1000 + index * 3600, String(open + index), String(open + index + 2),
        String(open + index - 1), String(open + index + 1), '0', '1', 1
      ]);
      const chartPayload = (key, open) => ({ error: [], result: { [key]: makeRows(open), last: 999999 } });
      const waitForMarket = async () => {
        for (let attempt = 0; attempt < 200; attempt++) {
          await new Promise(resolve => originalSetTimeout(resolve, 5));
          if (!marketRefresh.disabled && marketStatus.textContent !== 'Получаем публичные рыночные данные…') return;
        }
        throw new Error('Timed out waiting for market snapshot completion: ' + marketStatus.textContent);
      };
      const run = async mode => {
        window.fetch = (url, options = {}) => {
          const target = String(url);
          if (target.includes('/Ticker?')) {
            if (mode === 'timeout') return new Promise((resolve, reject) => {
              options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
            });
            if (mode === 'rate-limit') return Promise.resolve({ ok: false, status: 429, json: async () => ({}) });
            if (mode === 'server-error') return Promise.resolve({ ok: false, status: 503, json: async () => ({}) });
            return Promise.resolve({ ok: true, status: 200, json: async () => tickerPayload });
          }
          if (target.includes('/OHLC?')) {
            if (mode === 'charts-unavailable') return Promise.resolve({ ok: false, status: 503, json: async () => ({}) });
            const isEth = target.includes('pair=ETHUSD');
            return Promise.resolve({
              ok: true, status: 200,
              json: async () => isEth ? chartPayload('XETHZUSD', 1790) : chartPayload('XXBTZUSD', 61900)
            });
          }
          throw new Error('Unexpected fetch in market regression: ' + target);
        };
        if (mode === 'timeout') {
          window.setTimeout = (callback, delay, ...args) =>
            originalSetTimeout(callback, delay === 15000 ? 0 : delay, ...args);
        }
        marketRefresh.click();
        await waitForMarket();
        return {
          status: marketStatus.textContent,
          role: marketStatus.getAttribute('role'),
          btcPrice: document.querySelector('#btc-price').textContent,
          ethPrice: document.querySelector('#eth-price').textContent,
          btcChart: document.querySelector('#btc-chart').getAttribute('aria-label'),
          refreshEnabled: !marketRefresh.disabled
        };
      };
      try {
        const success = await run('success');
        const rateLimit = await run('rate-limit');
        const serverError = await run('server-error');
        const timeout = await run('timeout');
        const chartsUnavailable = await run('charts-unavailable');
        return { success, rateLimit, serverError, timeout, chartsUnavailable };
      } finally {
        window.fetch = originalFetch;
        window.setTimeout = originalSetTimeout;
      }
    });
    if (!marketRegression.success.status.includes('Обновлено') ||
        marketRegression.success.btcPrice !== '$62,000.00' ||
        marketRegression.success.ethPrice !== '$1,800.00' ||
        !marketRegression.success.btcChart.includes('График Bitcoin') ||
        !marketRegression.success.refreshEnabled) {
      throw new Error('Market success regression failed: ' + JSON.stringify(marketRegression.success));
    }
    if (!marketRegression.rateLimit.status.includes('Слишком много запросов') ||
        marketRegression.rateLimit.role !== 'alert' || !marketRegression.rateLimit.refreshEnabled) {
      throw new Error('Market HTTP 429 regression failed: ' + JSON.stringify(marketRegression.rateLimit));
    }
    if (!marketRegression.serverError.status.includes('Не удалось получить котировки') ||
        marketRegression.serverError.role !== 'alert' || !marketRegression.serverError.refreshEnabled) {
      throw new Error('Market HTTP 5xx regression failed: ' + JSON.stringify(marketRegression.serverError));
    }
    if (!marketRegression.timeout.status.includes('слишком долго') ||
        marketRegression.timeout.role !== 'alert' || !marketRegression.timeout.refreshEnabled) {
      throw new Error('Market timeout regression failed: ' + JSON.stringify(marketRegression.timeout));
    }
    if (!marketRegression.chartsUnavailable.status.includes('Котировки доступны, но графики временно не загрузились') ||
        marketRegression.chartsUnavailable.btcPrice !== '$62,000.00' ||
        marketRegression.chartsUnavailable.ethPrice !== '$1,800.00' ||
        !marketRegression.chartsUnavailable.refreshEnabled) {
      throw new Error('Market chart fallback regression failed: ' + JSON.stringify(marketRegression.chartsUnavailable));
    }
    console.log('Market snapshot success, HTTP 429, HTTP 5xx, timeout, and OHLC fallback regressions passed:', JSON.stringify(marketRegression));

    // Verify that a saved transaction URL restores the lookup automatically.
    const shareableHash = transactionFixture.hash;
    const shareableTransaction = transactionFixture.transactions.find(item => item.name === 'success').data;
    await page.addInitScript(({ hash, transaction }) => {
      const originalFetch = window.fetch.bind(window);
      window.__shareableLookupFetches = 0;
      window.fetch = (url, options) => {
        if (String(url).includes('/api/v2/transactions/' + hash)) {
          window.__shareableLookupFetches++;
          return Promise.resolve(new Response(JSON.stringify(transaction), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }));
        }
        return originalFetch(url, options);
      };
    }, { hash: shareableHash, transaction: shareableTransaction });
    await page.goto('http://127.0.0.1:4173/?tx=' + encodeURIComponent(shareableHash), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() =>
      !document.querySelector('#result').hidden || !document.querySelector('#error').hidden,
      undefined,
      { timeout: 10000 }
    );
    const shareableLookup = await page.evaluate(() => ({
      input: document.querySelector('#tx-hash').value,
      displayedHash: document.querySelector('#r-hash').textContent,
      status: document.querySelector('#r-status').textContent,
      resultVisible: !document.querySelector('#result').hidden,
      errorVisible: !document.querySelector('#error').hidden,
      fetches: window.__shareableLookupFetches,
      queryHash: new URLSearchParams(window.location.search).get('tx')
    }));
    if (!shareableLookup.resultVisible || shareableLookup.errorVisible ||
        shareableLookup.input !== shareableHash ||
        shareableLookup.displayedHash !== shareableHash ||
        shareableLookup.status !== 'Выполнена' ||
        shareableLookup.fetches !== 1 ||
        shareableLookup.queryHash !== shareableHash) {
      throw new Error('Shareable transaction URL regression failed: ' + JSON.stringify(shareableLookup));
    }
    console.log('Shareable transaction URL restoration passed:', JSON.stringify(shareableLookup));

    const shareableAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    await page.addInitScript(address => {
      const originalFetch = window.fetch.bind(window);
      window.__shareableAddressFetches = [];
      window.fetch = (url, options) => {
        const target = String(url);
        const base = 'https://eth-sepolia.blockscout.com/api/v2/addresses/' + address;
        if (target === base || target === base + '/transactions' ||
            target.startsWith(base + '/token-transfers?')) {
          window.__shareableAddressFetches.push(target);
          const payload = target === base
            ? { hash: address, coin_balance: '1000000000000000000', is_contract: false, is_scam: false, has_tokens: true, has_token_transfers: true }
            : target === base + '/token-transfers?type=ERC-20'
              ? {
                  items: [
                    {
                      transaction_hash: '0x' + '1'.repeat(64), log_index: 0, token_type: 'ERC-20',
                      from: { hash: '0x' + 'a'.repeat(40) }, to: { hash: address },
                      token: { name: 'USD, "Coin"', symbol: 'USDC', address_hash: '0x' + 'c'.repeat(40) },
                      total: { value: '16825800', decimals: '6' }, block_number: 100, timestamp: '2026-11-24T09:00:00.000Z'
                    },
                    {
                      transaction_hash: '0x' + '2'.repeat(64), log_index: 1, token_type: 'ERC-20',
                      from: { hash: address }, to: { hash: '0x' + 'd'.repeat(40) },
                      token: { name: '=HYPERLINK("https://example.com")', symbol: 'WETH', address_hash: '0x' + 'e'.repeat(40) },
                      total: { value: '7000000000000000', decimals: '18' }, block_number: 101, timestamp: '2026-11-24T09:01:00.000Z'
                    }
                  ],
                  next_page_params: null
                }
              : { items: [], next_page_params: null };
          return Promise.resolve(new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }));
        }
        return originalFetch(url, options);
      };
    }, shareableAddress);
    await page.goto('http://127.0.0.1:4173/?address=' + encodeURIComponent(shareableAddress), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() =>
      !document.querySelector('#address-result').hidden || !document.querySelector('#address-error').hidden,
      undefined,
      { timeout: 10000 }
    );
    const shareableAddressLookup = await page.evaluate(() => ({
      input: document.querySelector('#address-input').value,
      displayedAddress: document.querySelector('#a-hash').textContent,
      resultVisible: !document.querySelector('#address-result').hidden,
      errorVisible: !document.querySelector('#address-error').hidden,
      fetches: window.__shareableAddressFetches.length,
      queryAddress: new URLSearchParams(window.location.search).get('address')
    }));
    if (!shareableAddressLookup.resultVisible || shareableAddressLookup.errorVisible ||
        shareableAddressLookup.input.toLowerCase() !== shareableAddress ||
        shareableAddressLookup.displayedAddress.toLowerCase() !== shareableAddress ||
        shareableAddressLookup.fetches !== 3 ||
        shareableAddressLookup.queryAddress.toLowerCase() !== shareableAddress) {
      throw new Error('Shareable address URL regression failed: ' + JSON.stringify(shareableAddressLookup));
    }
    console.log('Shareable address URL restoration passed:', JSON.stringify(shareableAddressLookup));
    const csvState = await page.evaluate(() => ({
      itemCount: tokenTransferItems.length,
      address: tokenTransferAddress,
      filter: tokenTransferFilter,
      exportDisabled: tokenExport.disabled,
      listStatus: tokenListStatus.textContent,
      items: tokenTransferItems.map(item => ({ hash: item.transaction_hash, from: item.from?.hash, to: item.to?.hash }))
    }));
    console.log('CSV export fixture state:', JSON.stringify(csvState));
    if (csvState.itemCount !== 2 || csvState.exportDisabled) {
      throw new Error('CSV export fixture did not enable the export button: ' + JSON.stringify(csvState));
    }

    const readCsvDownload = async () => {
      const download = await page.waitForEvent('download', () => page.locator('#token-export').click());
      const raw = fs.readFileSync(await download.path(), 'utf8').replace(/^\uFEFF/, '');
      const rows = [];
      let row = [], field = '', quoted = false;
      for (let i = 0; i < raw.length; i++) {
        const char = raw[i];
        if (quoted && char === '"' && raw[i + 1] === '"') { field += '"'; i++; }
        else if (char === '"') quoted = !quoted;
        else if (!quoted && char === ',') { row.push(field); field = ''; }
        else if (!quoted && char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (char !== '\r') field += char;
      }
      if (field.length || row.length) { row.push(field); rows.push(row); }
      return { filename: download.suggestedFilename(), rows, raw };
    };
    const allCsv = await readCsvDownload();
    const expectedHeaders = [
      'transaction_hash', 'log_index', 'token_type', 'from_address', 'to_address',
      'token_name', 'token_symbol', 'token_address', 'amount', 'amount_raw',
      'decimals', 'block_number', 'timestamp'
    ];
    if (allCsv.rows.length !== 3 || allCsv.rows.some(row => row.length !== 13) ||
        JSON.stringify(allCsv.rows[0]) !== JSON.stringify(expectedHeaders) ||
        !allCsv.filename.endsWith('-all.csv') ||
        allCsv.rows[1][0] !== '0x' + '1'.repeat(64) ||
        allCsv.rows[1][8] !== '16.8258' || allCsv.rows[1][9] !== '16825800' ||
        allCsv.rows[1][10] !== '6' || allCsv.rows[1][5] !== 'USD, "Coin"' ||
        allCsv.rows[2][0] !== '0x' + '2'.repeat(64) ||
        allCsv.rows[2][8] !== '0.007' || allCsv.rows[2][9] !== '7000000000000000' ||
        allCsv.rows[2][10] !== '18' ||
        allCsv.rows[2][5] !== '=HYPERLINK("https://example.com")' ||
        !allCsv.raw.includes('"\'=HYPERLINK(""https://example.com"")"')) {
      throw new Error('CSV all-transfers export regression failed: ' + JSON.stringify(allCsv));
    }

    await page.locator('[data-token-filter="incoming"]').click();
    const incomingCsv = await readCsvDownload();
    if (incomingCsv.rows.length !== 2 || incomingCsv.rows[1][0] !== '0x' + '1'.repeat(64) ||
        incomingCsv.filename.endsWith('-all.csv')) {
      throw new Error('CSV incoming-filter export regression failed: ' + JSON.stringify(incomingCsv));
    }
    await page.locator('[data-token-filter="outgoing"]').click();
    const outgoingCsv = await readCsvDownload();
    if (outgoingCsv.rows.length !== 2 || outgoingCsv.rows[1][0] !== '0x' + '2'.repeat(64)) {
      throw new Error('CSV outgoing-filter export regression failed: ' + JSON.stringify(outgoingCsv));
    }
    console.log('CSV download, 13-column schema, exact amounts, escaping, and all/incoming/outgoing filters passed');

    console.log('All deterministic offline application tests passed');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
