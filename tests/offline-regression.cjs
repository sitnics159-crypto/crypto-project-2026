const { chromium } = require('playwright');
const fs = require('node:fs');
const crypto = require('node:crypto');
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

    const lookupNotice = page.locator('p.foot').filter({ hasText: 'Поисковые данные:' });
    if (!(await lookupNotice.isVisible()) ||
        !/Blockscout Sepolia.*получатель увидит этот хеш или адрес.*Kraken/.test(await lookupNotice.innerText())) {
      throw new Error('Expected a visible explanation of lookup data and shared links');
    }
    if (await page.locator('meta[name="referrer"]').getAttribute('content') !== 'no-referrer') {
      throw new Error('Expected the document-wide no-referrer policy');
    }

    const previewUrl = 'http://127.0.0.1:4173/';
    const destinationUrl = previewUrl + '?referrer-check=destination';
    await page.evaluate(destination => {
      const lookupUrl = new URL(window.location.href);
      lookupUrl.searchParams.set('address', '0x' + 'a'.repeat(40));
      window.history.replaceState(null, '', lookupUrl);

      const link = document.createElement('a');
      link.href = destination;
      link.textContent = 'Referrer policy test';
      document.body.append(link);
    }, destinationUrl);
    await Promise.all([
      page.waitForURL(destinationUrl),
      page.getByRole('link', { name: 'Referrer policy test' }).click()
    ]);
    if (await page.evaluate(() => document.referrer) !== '') {
      throw new Error('The destination received a referrer for a URL containing a lookup identifier');
    }
    console.log('Lookup privacy notice and no-referrer navigation passed');
    await page.goto(previewUrl, { waitUntil: 'domcontentloaded' });

    // Keep the static CSP hash synchronized with the sole inline application script.
    const sourceHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const cspMatch = sourceHtml.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/i);
    const inlineScripts = [...sourceHtml.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
      .filter(match => !/\bsrc=/.test(match[0].split('>')[0]));
    if (!cspMatch || inlineScripts.length !== 1) {
      throw new Error('Expected one inline application script and a meta CSP policy');
    }
    const expectedScriptHash = "'sha256-" +
      crypto.createHash('sha256').update(inlineScripts[0][1], 'utf8').digest('base64') + "'";
    const cspDirectives = new Map(cspMatch[1].split(';').map(part => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name, values.join(' ')];
    }));
    const scriptSources = cspDirectives.get('script-src') || '';
    const moduleHash = 'sha256-' + crypto.createHash('sha256')
      .update(fs.readFileSync(path.join(__dirname, '..', 'token-balances.mjs'))).digest('base64');
    if (!sourceHtml.includes('src="./token-balances.mjs" integrity="' + moduleHash + '"') ||
        scriptSources !== expectedScriptHash + " '" + moduleHash + "'") {
      throw new Error('CSP and integrity must authorize only the current application scripts');
    }
    const connectSources = cspDirectives.get('connect-src') || '';
    for (const [directive, expected] of [
      ['default-src', "'none'"], ['base-uri', "'none'"],
      ['object-src', "'none'"], ['form-action', "'self'"]
    ]) {
      if (cspDirectives.get(directive) !== expected) {
        throw new Error('CSP directive mismatch: ' + directive);
      }
    }
    if (!scriptSources.includes(expectedScriptHash) || scriptSources.includes("'unsafe-inline'")) {
      throw new Error('CSP must authorize the app only by its current inline-script hash');
    }
    if (connectSources !== 'https://api.kraken.com https://crypto-project-2026.onrender.com') {
      throw new Error('CSP connect-src must stay limited to the fixed public API origins');
    }
    console.log('Static CSP hash and restrictive directives passed');


    // Mobile input sizing must avoid iOS focus zoom; keyboard focus must remain visible.
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileAccessibility = await page.evaluate(() => ({
      transactionInputSize: getComputedStyle(document.querySelector('#tx-hash')).fontSize,
      addressInputSize: getComputedStyle(document.querySelector('#address-input')).fontSize,
      focusRule: [...document.styleSheets].some(sheet => {
        try { return [...sheet.cssRules].some(rule => rule.cssText.includes(':focus-visible') && rule.cssText.includes('outline: 3px solid')); }
        catch { return false; }
      })
    }));
    if (mobileAccessibility.transactionInputSize !== '16px' ||
        mobileAccessibility.addressInputSize !== '16px' ||
        !mobileAccessibility.focusRule) {
      throw new Error('Mobile input/focus accessibility regression: ' + JSON.stringify(mobileAccessibility));
    }
    await page.keyboard.press('Tab');
    const keyboardFocus = await page.evaluate(() => ({
      id: document.activeElement?.id || '',
      outlineStyle: getComputedStyle(document.activeElement).outlineStyle,
      outlineWidth: getComputedStyle(document.activeElement).outlineWidth
    }));
    if (keyboardFocus.id !== 'tx-hash' ||
        keyboardFocus.outlineStyle === 'none' ||
        keyboardFocus.outlineWidth === '0px') {
      throw new Error('Visible keyboard focus regression: ' + JSON.stringify(keyboardFocus));
    }
    const tabbable = await page.locator('a[href],button:not([disabled]),input:not([disabled])').evaluateAll(elements =>
      elements.filter(element => {
        const style = getComputedStyle(element);
        return element.getClientRects().length > 0 && style.visibility !== 'hidden' &&
          !element.closest('[hidden]') && element.tabIndex >= 0;
      }).map(element => element.id)
    );
    const currentStop = tabbable.indexOf(keyboardFocus.id);
    if (currentStop < 0 || tabbable.length < 6) {
      throw new Error('Keyboard navigation fixture did not expose the expected controls: ' + JSON.stringify({ tabbable, keyboardFocus }));
    }
    const keyboardSequence = [];
    for (let index = currentStop + 1; index < tabbable.length; index++) {
      await page.keyboard.press('Tab');
      const activeId = await page.evaluate(() => document.activeElement?.id || '');
      keyboardSequence.push(activeId);
      if (activeId !== tabbable[index]) {
        throw new Error('Keyboard Tab order skipped or reordered a visible control: ' +
          JSON.stringify({ expected: tabbable[index], actual: activeId, keyboardSequence }));
      }
    }
    console.log('Mobile input sizing and sequential keyboard navigation passed:', JSON.stringify({ mobileAccessibility, keyboardFocus, keyboardSequence }));

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
      const ethOneWei = weiToEth('1');
      const ethZero = weiToEth('0');
      const ethOne = weiToEth('1000000000000000000');
      const ethFraction = weiToEth('1234567890123456789');
      const ethTrimmed = weiToEth('100000000000000000');
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
        if (String(url).includes('/api/sepolia/tokens/' + retryAddress)) {
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
      return { ethOneWei, ethZero, ethOne, ethFraction, ethTrimmed, amountZeroDecimals, amountTiny, tinyFee, normalFee, zeroFee, amountInvalidDecimals, amountMissingDecimals, amountMetadataFallback, eventAmountInvalidDecimalsFallback, contractTokenType, localPaginationVisible, formulaCell, newlineFormulaCell, fullwidthFormulaCell, incoming, outgoing, metadataRetry };
    }, paginationFixture);
    if (edgeCases.ethOneWei !== '0.000000000000000001 ETH') throw new Error('1 wei ETH amount lost precision: ' + edgeCases.ethOneWei);
    if (edgeCases.ethZero !== '0 ETH') throw new Error('Zero ETH amount formatting changed: ' + edgeCases.ethZero);
    if (edgeCases.ethOne !== '1 ETH') throw new Error('Whole ETH amount formatting changed: ' + edgeCases.ethOne);
    if (edgeCases.ethFraction !== '1.234567890123456789 ETH') throw new Error('18-digit ETH precision failed: ' + edgeCases.ethFraction);
    if (edgeCases.ethTrimmed !== '0.1 ETH') throw new Error('Trailing zero trimming changed: ' + edgeCases.ethTrimmed);
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
          if (mode === 'incomplete') {
            return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
          }
          if (mode === 'mismatched-address') {
            return Promise.resolve({ ok: true, status: 200, json: async () => ({
              hash: '0x' + 'b'.repeat(40), coin_balance: '0', is_contract: false
            }) });
          }
          const status = mode === 'rate-limit' ? apiErrorFixture.rateLimit.status :
            mode === 'not-found' ? 404 : apiErrorFixture.serverError.status;
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
        const notFound = await run('not-found');
        const incomplete = await run('incomplete');
        const mismatchedAddress = await run('mismatched-address');
        if (!addressResult.hidden) throw new Error('Mismatched address response was rendered');
        const rateLimit = await run('rate-limit');
        const serverError = await run('server-error');
        const failedState = {
          message: addressError.textContent,
          buttonEnabled: !addressButton.disabled,
          loadingHidden: addressLoading.hidden,
          resultHidden: addressResult.hidden
        };
        const timeout = await run('timeout');
        let recoveryRequests = 0;
        window.setTimeout = originalSetTimeout;
        window.fetch = async url => {
          recoveryRequests++;
          const target = new URL(String(url));
          if (target.pathname.endsWith('/transactions')) {
            return new Response(JSON.stringify({ items: [], next_page_params: null }), {
              status: 200, headers: { 'Content-Type': 'application/json' }
            });
          }
          if (target.pathname.endsWith('/token-transfers')) {
            return new Response(JSON.stringify({ items: [], next_page_params: null }), {
              status: 200, headers: { 'Content-Type': 'application/json' }
            });
          }
          return new Response(JSON.stringify({
            hash: '0x' + address.slice(2).toUpperCase(), coin_balance: '0', is_contract: false,
            is_scam: false, has_tokens: false, has_token_transfers: false
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        };
        submit();
        for (let attempt = 0; attempt < 100; attempt++) {
          await new Promise(resolve => originalSetTimeout(resolve, 5));
          if (!addressResult.hidden || !addressError.hidden) break;
        }
        const recoveredState = {
          resultVisible: !addressResult.hidden,
          errorHidden: addressError.hidden,
          displayedAddress: document.querySelector('#a-hash').textContent.toLowerCase(),
          buttonEnabled: !addressButton.disabled,
          loadingHidden: addressLoading.hidden,
          requestCount: recoveryRequests
        };
        return { notFound, incomplete, mismatchedAddress, rateLimit, serverError, timeout, failedState, recoveredState };
      } finally {
        window.fetch = originalFetch;
        window.setTimeout = originalSetTimeout;
      }
    }, apiErrorFixture);
    if (!apiErrors.notFound.includes('Адрес не найден в Sepolia') ||
        !apiErrors.incomplete.includes('Источник вернул неполные данные') ||
        !apiErrors.mismatchedAddress.includes('Источник вернул неполные данные') ||
        !apiErrors.rateLimit.includes(apiErrorFixture.rateLimit.expected) ||
        !apiErrors.serverError.includes(apiErrorFixture.serverError.expected) ||
        !apiErrors.timeout.includes(apiErrorFixture.timeout.expected) ||
        !apiErrors.failedState.message.includes(apiErrorFixture.serverError.expected) ||
        !apiErrors.failedState.buttonEnabled || !apiErrors.failedState.loadingHidden ||
        !apiErrors.failedState.resultHidden ||
        !apiErrors.recoveredState.resultVisible || !apiErrors.recoveredState.errorHidden ||
        apiErrors.recoveredState.displayedAddress !== ('0x' + 'a'.repeat(40)) ||
        !apiErrors.recoveredState.buttonEnabled || !apiErrors.recoveredState.loadingHidden ||
        apiErrors.recoveredState.requestCount !== 3) {
      throw new Error('Address lookup API failure/recovery regression: ' + JSON.stringify(apiErrors));
    }
    console.log('Address lookup 404, incomplete payload, timeout, HTTP 429, and HTTP 5xx fixtures passed');
    const loadBalances = page.locator('#token-balances-load');
    const balanceStatus = page.locator('#token-balances-status');
    await page.evaluate(() => {
      const originalFetch = window.fetch;
      let attempts = 0;
      window.fetch = async (url, options) => {
        if (!String(url).endsWith('/token-balances')) return originalFetch(url, options);
        if (++attempts === 1) return new Response('{}', { status: 429, headers: { 'retry-after': '2' } });
        if (attempts === 2) return new Response('{}', { status: 503 });
        window.fetch = originalFetch;
        return new Response(JSON.stringify([{
          value: '123456789012345678901234567890',
          token: { type: 'ERC-20', address_hash: '0x' + 'b'.repeat(40), decimals: '18', symbol: '<TEST>' }
        }]));
      };
    });
    await loadBalances.click();
    await balanceStatus.filter({ hasText: 'ограничил частоту запросов' }).waitFor();
    if (!(await page.locator('#address-result').isVisible())) {
      throw new Error('HTTP 429 balance response hid the address overview');
    }
    if (!(await balanceStatus.innerText()).includes('2 сек.')) {
      throw new Error('HTTP 429 balance response did not respect Retry-After');
    }
    await loadBalances.click();
    await balanceStatus.filter({ hasText: 'временно недоступен' }).waitFor();
    if (!(await page.locator('#address-result').isVisible())) {
      throw new Error('HTTP 503 balance response hid the address overview');
    }
    await loadBalances.click();
    await page.locator('#token-balances-list li').filter({ hasText: '<TEST>' })
      .filter({ hasText: '123456789012.34567890123456789' }).waitFor();
    // Allow the old fetch to resolve after cancellation to exercise the stale response guard.
    const balanceRace = await page.evaluate(async () => {
      const originalFetch = window.fetch;
      const nextAddress = '0x' + 'c'.repeat(40);
      const balanceButton = document.querySelector('#token-balances-load');
      const balanceList = document.querySelector('#token-balances-list');
      const balanceStatus = document.querySelector('#token-balances-status');
      const waitFor = async condition => {
        for (let attempt = 0; attempt < 100; attempt++) {
          if (condition()) return;
          await new Promise(resolve => setTimeout(resolve, 5));
        }
        throw new Error('Timed out waiting for the balance lookup race');
      };
      const makeBalance = symbol => [{
        value: '42', token: { type: 'ERC-20', address_hash: '0x' + 'b'.repeat(40), decimals: '0', symbol }
      }];
      let oldSignal, resolveOld;
      try {
        window.fetch = async (url, options) => {
          const path = new URL(String(url)).pathname;
          if (path.endsWith('/token-balances')) {
            if (path.includes(nextAddress)) return Response.json(makeBalance('CURRENT'));
            oldSignal = options.signal;
            return new Promise(resolve => { resolveOld = resolve; });
          }
          if (path === '/api/sepolia/addresses/' + nextAddress) {
            return Response.json({ hash: nextAddress, coin_balance: '0' });
          }
          if (path.startsWith('/api/sepolia/addresses/' + nextAddress + '/')) {
            return Response.json({ items: [], next_page_params: null });
          }
          return originalFetch(url, options);
        };
        balanceButton.click();
        await waitFor(() => !!resolveOld);
        addressInput.value = nextAddress;
        addressForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await waitFor(() => !addressResult.hidden && document.querySelector('#a-hash').textContent === nextAddress);
        const reset = balanceList.textContent === '' && balanceStatus.textContent === '' && !balanceButton.disabled;
        balanceButton.click();
        await waitFor(() => balanceList.textContent.includes('CURRENT') && !balanceButton.disabled);
        resolveOld(Response.json(makeBalance('STALE')));
        await new Promise(resolve => setTimeout(resolve, 0));
        return {
          aborted: oldSignal.aborted,
          reset,
          currentOnly: balanceList.textContent.includes('CURRENT') && !balanceList.textContent.includes('STALE')
        };
      } finally {
        window.fetch = originalFetch;
      }
    });
    if (!balanceRace.aborted || !balanceRace.reset || !balanceRace.currentOnly) {
      throw new Error('Switching addresses left stale balance state: ' + JSON.stringify(balanceRace));
    }
    console.log('ERC-20 balance cancellation and stale response checks passed');
    // A secondary activity endpoint failure must not hide a successfully resolved address or the other activity section.
    const partialAddressRegression = await page.evaluate(async () => {
      const originalFetch = window.fetch;
      const originalSetTimeout = window.setTimeout;
      const address = '0x' + 'b'.repeat(40);
      const makeResponse = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
      const lookupStatus = document.querySelector('#address-lookup-status[role="status"]');
      if (!lookupStatus) throw new Error('Missing address lookup status');
      const submit = async () => {
        addressInput.value = address;
        addressForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        if (lookupStatus.textContent !== '') throw new Error('Address lookup status did not clear');
        for (let attempt = 0; attempt < 100; attempt++) {
          await new Promise(resolve => originalSetTimeout(resolve, 5));
          if (!addressResult.hidden && !addressButton.disabled && addressLoading.hidden) {
            if (lookupStatus.textContent !== 'Обзор адреса готов.') {
              throw new Error('Address overview completion announcement is missing');
            }
            return;
          }
        }
        throw new Error('Timed out waiting for partial address result');
      };
      const cases = [];
      try {
        for (const failedEndpoint of ['transactions', 'token-transfers']) {
          let failingEndpoint = failedEndpoint;
          window.fetch = async url => {
            const target = String(url);
            if (target.endsWith('/transactions') && failingEndpoint === 'transactions') return makeResponse(503, {});
            if (target.includes('/token-transfers') && failingEndpoint === 'token-transfers') return makeResponse(429, {});
            if (target.endsWith('/transactions')) return makeResponse(200, { items: [{ hash: address + '-tx' }], next_page_params: null });
            if (target.includes('/token-transfers')) return makeResponse(200, { items: [{ transaction_hash: address + '-token', token_type: 'ERC-20' }], next_page_params: null });
            return makeResponse(200, { hash: address, coin_balance: '0', is_contract: false });
          };
          await submit();
          const result = {
            failedEndpoint,
            addressVisible: !addressResult.hidden,
            address: document.querySelector('#a-hash').textContent.toLowerCase(),
            txCount: addressTxItems.length,
            txStatus: addressTxStatus.textContent,
            tokenCount: tokenTransferItems.length,
            tokenStatus: tokenListStatus.textContent,
            buttonEnabled: !addressButton.disabled,
            loadingHidden: addressLoading.hidden
          };
          if (!result.addressVisible || result.address !== address || !result.buttonEnabled || !result.loadingHidden) {
            throw new Error('Address result was hidden after secondary endpoint failure: ' + JSON.stringify(result));
          }
          if (failedEndpoint === 'transactions' && (!result.txStatus.includes('Не удалось загрузить этот раздел') || result.tokenCount !== 1)) {
            throw new Error('Transaction endpoint failure did not remain isolated: ' + JSON.stringify(result));
          }
          if (failedEndpoint === 'token-transfers' && (!result.tokenStatus.includes('Blockscout ограничил частоту') || result.txCount !== 1)) {
            throw new Error('Token endpoint failure did not remain isolated: ' + JSON.stringify(result));
          }
          failingEndpoint = null;
          await submit();
          const recovered = addressTxItems.length === 1 && tokenTransferItems.length === 1 &&
            addressTxStatus.textContent.includes('Показано 1 из 1') &&
            tokenListStatus.textContent.includes('Показано 1 из 1');
          if (!recovered) throw new Error('Address activity did not recover after retry: ' + failedEndpoint);
          cases.push({ ...result, recovered, completionAnnouncement: lookupStatus.textContent });
        }
        return cases;
      } finally {
        window.fetch = originalFetch;
        window.setTimeout = originalSetTimeout;
      }
    });
    console.log('Partial address activity availability regressions passed:', JSON.stringify(partialAddressRegression));
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
            ok: true, status: 200, json: async () => ({
              ...item.data,
              hash: '0x' + item.data.hash.slice(2).toUpperCase()
            })
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
          { name: 'incomplete', status: 200, body: {}, expected: fixture.errors.incomplete },
          {
            name: 'mismatched-hash',
            status: 200,
            body: { ...fixture.transactions[0].data, hash: fixture.hash.slice(0, -1) + (fixture.hash.endsWith('0') ? '1' : '0') },
            expected: fixture.errors.incomplete
          }
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
            const isEth = target.includes('pair=ETHUSD');
            if (mode === 'charts-unavailable' ||
                (mode === 'charts-btc-unavailable' && !isEth) ||
                (mode === 'charts-eth-unavailable' && isEth)) {
              return Promise.resolve({ ok: false, status: 503, json: async () => ({}) });
            }
            if (mode === 'charts-malformed-json' && isEth) {
              return Promise.resolve({ ok: true, status: 200, json: async () => { throw new SyntaxError('Invalid JSON'); } });
            }
            if (mode === 'charts-incomplete' && isEth) {
              return Promise.resolve({ ok: true, status: 200, json: async () => ({ error: [], result: {} }) });
            }
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
          ethChart: document.querySelector('#eth-chart').getAttribute('aria-label'),
          btcChartRows: document.querySelectorAll('#btc-chart-data tbody tr').length,
          ethChartRows: document.querySelectorAll('#eth-chart-data tbody tr').length,
          btcChartLast: document.querySelector('#btc-chart-data tbody tr:last-child td')?.textContent || '',
          ethChartLast: document.querySelector('#eth-chart-data tbody tr:last-child td')?.textContent || '',
          chartsDecorative: document.querySelector('#btc-chart').getAttribute('aria-hidden') === 'true' &&
            document.querySelector('#eth-chart').getAttribute('aria-hidden') === 'true',
          refreshEnabled: !marketRefresh.disabled,
          staleSnapshotNotice: marketStatus.textContent.includes('Последние успешные данные') && marketStatus.textContent.includes('могут быть устаревшими')
        };
      };
      try {
        const success = await run('success');
        const rateLimit = await run('rate-limit');
        const serverError = await run('server-error');
        const timeout = await run('timeout');
        const chartsUnavailable = await run('charts-unavailable');
        const btcChartUnavailable = await run('charts-btc-unavailable');
        const ethChartUnavailable = await run('charts-eth-unavailable');
        const malformedChartJson = await run('charts-malformed-json');
        const incompleteChartPayload = await run('charts-incomplete');
        const retryAfterError = await run('success');
        return { success, rateLimit, serverError, timeout, chartsUnavailable,
          btcChartUnavailable, ethChartUnavailable, malformedChartJson, incompleteChartPayload, retryAfterError };
      } finally {
        window.fetch = originalFetch;
        window.setTimeout = originalSetTimeout;
      }
    });
    if (!marketRegression.success.status.includes('Обновлено') ||
        marketRegression.success.btcPrice !== '$62,000.00' ||
        marketRegression.success.ethPrice !== '$1,800.00' ||
        marketRegression.success.btcChart !== null || marketRegression.success.ethChart !== null ||
        marketRegression.success.btcChartRows !== 25 || marketRegression.success.ethChartRows !== 25 ||
        marketRegression.success.btcChartLast !== '$61,926.00' ||
        marketRegression.success.ethChartLast !== '$1,816.00' ||
        !marketRegression.success.chartsDecorative ||
        !marketRegression.success.refreshEnabled) {
      throw new Error('Market success regression failed: ' + JSON.stringify(marketRegression.success));
    }
    if (!marketRegression.rateLimit.status.includes('Слишком много запросов') ||
        marketRegression.rateLimit.role !== 'alert' || !marketRegression.rateLimit.refreshEnabled ||
        !marketRegression.rateLimit.staleSnapshotNotice) {
      throw new Error('Market HTTP 429 regression failed: ' + JSON.stringify(marketRegression.rateLimit));
    }
    if (!marketRegression.serverError.status.includes('Не удалось получить котировки') ||
        marketRegression.serverError.role !== 'alert' || !marketRegression.serverError.refreshEnabled ||
        !marketRegression.serverError.staleSnapshotNotice) {
      throw new Error('Market HTTP 5xx regression failed: ' + JSON.stringify(marketRegression.serverError));
    }
    if (!marketRegression.timeout.status.includes('слишком долго') ||
        marketRegression.timeout.role !== 'alert' || !marketRegression.timeout.refreshEnabled ||
        !marketRegression.timeout.staleSnapshotNotice) {
      throw new Error('Market timeout regression failed: ' + JSON.stringify(marketRegression.timeout));
    }
    const chartFallbackCases = [
      { name: 'chartsUnavailable', btc: false, eth: false, status: 'Графики BTC и ETH временно недоступны.' },
      { name: 'btcChartUnavailable', btc: false, eth: true, status: 'График ETH построен; график BTC временно недоступен.' },
      { name: 'ethChartUnavailable', btc: true, eth: false, status: 'График BTC построен; график ETH временно недоступен.' },
      { name: 'malformedChartJson', btc: true, eth: false, status: 'График BTC построен; график ETH временно недоступен.' },
      { name: 'incompleteChartPayload', btc: true, eth: false, status: 'График BTC построен; график ETH временно недоступен.' }
    ];
    for (const item of chartFallbackCases) {
      const state = marketRegression[item.name];
      if (!state.status.includes(item.status) ||
          (state.btcChartRows === 25) !== item.btc || (state.ethChartRows === 25) !== item.eth ||
          state.btcPrice !== '$62,000.00' || state.ethPrice !== '$1,800.00' || !state.refreshEnabled) {
        throw new Error('Market independent OHLC fallback regression (' + item.name + ') failed: ' + JSON.stringify(state));
      }
    }
    if (!marketRegression.retryAfterError.status.includes('Обновлено') ||
        marketRegression.retryAfterError.btcPrice !== '$62,000.00' ||
        marketRegression.retryAfterError.ethPrice !== '$1,800.00' ||
        !marketRegression.retryAfterError.refreshEnabled) {
      throw new Error('Market manual retry after failure regression failed: ' + JSON.stringify(marketRegression.retryAfterError));
    }
    console.log('Market snapshot success, HTTP 429, HTTP 5xx, timeout, asymmetric/malformed/incomplete OHLC fallback, and manual retry regressions passed:', JSON.stringify(marketRegression));

    // Verify that a saved transaction URL restores the lookup automatically.
    const shareableHash = transactionFixture.hash;
    const shareableTransaction = transactionFixture.transactions.find(item => item.name === 'success').data;
    await page.addInitScript(({ hash, transaction }) => {
      const originalFetch = window.fetch.bind(window);
      window.__shareableLookupFetches = 0;
      window.fetch = (url, options) => {
        if (String(url).includes('/api/sepolia/transactions/' + hash)) {
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
        const base = 'https://crypto-project-2026.onrender.com/api/sepolia/addresses/' + address;
        if (target === base || target === base + '/transactions' ||
            target.startsWith(base + '/token-transfers?')) {
          window.__shareableAddressFetches.push(target);
          let payload = target === base
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
          const directionFilter = new URL(target).searchParams.get('filter');
          if (directionFilter === 'to') payload = {
            items: [{
              transaction_hash: '0x' + '1'.repeat(64), log_index: 0, token_type: 'ERC-20',
              from: { hash: '0x' + 'a'.repeat(40) }, to: { hash: address },
              token: { name: 'USD, "Coin"', symbol: 'USDC', address_hash: '0x' + 'c'.repeat(40) },
              total: { value: '16825800', decimals: '6' }, block_number: 100, timestamp: '2026-11-24T09:00:00.000Z'
            }], next_page_params: null
          };
          if (directionFilter === 'from') payload = {
            items: [{
              transaction_hash: '0x' + '2'.repeat(64), log_index: 1, token_type: 'ERC-20',
              from: { hash: address }, to: { hash: '0x' + 'd'.repeat(40) },
              token: { name: '=HYPERLINK("https://example.com")', symbol: 'WETH', address_hash: '0x' + 'e'.repeat(40) },
              total: { value: '7000000000000000', decimals: '18' }, block_number: 101, timestamp: '2026-11-24T09:01:00.000Z'
            }], next_page_params: null
          };
          const response = new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
          if (directionFilter === 'to') {
            return new Promise(resolve => {
              window.__finishIncomingTransferResponse = () => resolve(response);
            });
          }
          return Promise.resolve(response);
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
      const downloadPromise = page.waitForEvent('download');
      await page.locator('#token-export').click();
      const download = await downloadPromise;
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
        allCsv.rows[2][5] !== "'=HYPERLINK(\"https://example.com\")" ||
        !allCsv.raw.includes('"\'=HYPERLINK(""https://example.com"")"')) {
      throw new Error('CSV all-transfers export regression failed: ' + JSON.stringify(allCsv));
    }

    await page.locator('#insight-create').click();
    if (!(await page.locator('#insight-report').isVisible()) ||
        !(await page.locator('#insight-report').innerText()).includes('Загружено записей: 2') ||
        await page.locator('#insight-print').isDisabled()) {
      throw new Error('Insight report preview regression');
    }
    await page.evaluate(() => { window.print = () => { window.__insightPrinted = true; }; });
    await page.locator('#insight-print').click();
    if (!(await page.evaluate(() => window.__insightPrinted))) throw new Error('Insight print action failed');
    await page.locator('[data-token-filter="incoming"]').click();
    if (await page.locator('#insight-report').isVisible() || !(await page.locator('#insight-print').isDisabled())) {
      throw new Error('Stale insight report survived filter change');
    }
    await page.waitForFunction(() => typeof window.__finishIncomingTransferResponse === 'function');
    if (!(await page.locator('#token-export').isDisabled()) ||
        (await page.locator('#token-export-status').innerText()).trim() !== '') {
      throw new Error('CSV export must be disabled and clear its prior status while a new filter loads');
    }
    await page.evaluate(() => window.__finishIncomingTransferResponse());
    await page.waitForFunction(() => !tokenTransferLoading && tokenTransferFilter === 'incoming' && tokenTransferItems.length === 1);
    if (!(await page.evaluate(() => window.__shareableAddressFetches.some(url => new URL(url).searchParams.get('filter') === 'to')))) {
      throw new Error('Incoming CSV filter did not issue Blockscout filter=to request');
    }
    const incomingCsv = await readCsvDownload();
    if (incomingCsv.rows.length !== 2 || incomingCsv.rows[1][0] !== '0x' + '1'.repeat(64) ||
        incomingCsv.filename.endsWith('-all.csv')) {
      throw new Error('CSV incoming-filter export regression failed: ' + JSON.stringify(incomingCsv));
    }
    await page.locator('[data-token-filter="outgoing"]').click();
    await page.waitForFunction(() => !tokenTransferLoading && tokenTransferFilter === 'outgoing' && tokenTransferItems.length === 1);
    if (!(await page.evaluate(() => window.__shareableAddressFetches.some(url => new URL(url).searchParams.get('filter') === 'from')))) {
      throw new Error('Outgoing CSV filter did not issue Blockscout filter=from request');
    }
    const outgoingCsv = await readCsvDownload();
    if (outgoingCsv.rows.length !== 2 || outgoingCsv.rows[1][0] !== '0x' + '2'.repeat(64)) {
      throw new Error('CSV outgoing-filter export regression failed: ' + JSON.stringify(outgoingCsv));
    }
    console.log('CSV download, 13-column schema, exact amounts, escaping, and all/incoming/outgoing filters passed');

    const csvExportRace = await page.evaluate(async () => {
      const originalFetch = window.fetch;
      const originalCreateObjectURL = URL.createObjectURL;
      const originalAnchorClick = HTMLAnchorElement.prototype.click;
      const previous = {
        items: tokenTransferItems,
        address: tokenTransferAddress,
        filter: tokenTransferFilter,
        visible: tokenTransferVisible,
        status: tokenExportStatus.textContent
      };
      const exportAddress = '0x' + 'd'.repeat(40);
      const changedAddress = '0x' + 'e'.repeat(40);
      const tokenAddress = '0x' + 'f'.repeat(40);
      const txHash = '0x' + '9'.repeat(64);
      let releaseMetadata;
      let metadataStartedResolve;
      const metadataStarted = new Promise(resolve => { metadataStartedResolve = resolve; });
      let capturedBlob = null;
      let capturedFilename = '';
      window.fetch = async url => {
        if (String(url).includes('/api/sepolia/tokens/' + tokenAddress)) {
          metadataStartedResolve();
          return new Promise(resolve => {
            releaseMetadata = () => resolve(new Response(JSON.stringify({ decimals: '6' }), {
              status: 200, headers: { 'Content-Type': 'application/json' }
            }));
          });
        }
        return originalFetch(url);
      };
      URL.createObjectURL = blob => { capturedBlob = blob; return 'blob:csv-export-race'; };
      HTMLAnchorElement.prototype.click = function () { capturedFilename = this.download; };
      try {
        tokenMetadataCache.delete(tokenAddress.toLowerCase());
        tokenTransferAddress = exportAddress;
        tokenTransferFilter = 'incoming';
        tokenTransferItems = [{
          transaction_hash: txHash,
          log_index: 7,
          token_type: 'ERC-20',
          from: { hash: '0x' + 'a'.repeat(40) },
          to: { hash: exportAddress },
          token: { address_hash: tokenAddress, symbol: 'RACE' },
          total: { value: '1234567' }
        }];
        const pendingExport = exportTokenTransfers();
        await metadataStarted;
        tokenTransferFilter = 'outgoing';
        tokenTransferAddress = changedAddress;
        tokenExportStatus.textContent = 'Current lookup status';
        releaseMetadata();
        await pendingExport;
        return {
          filename: capturedFilename,
          status: tokenExportStatus.textContent,
          csv: capturedBlob ? await capturedBlob.text() : ''
        };
      } finally {
        window.fetch = originalFetch;
        URL.createObjectURL = originalCreateObjectURL;
        HTMLAnchorElement.prototype.click = originalAnchorClick;
        tokenMetadataCache.delete(tokenAddress.toLowerCase());
        tokenTransferItems = previous.items;
        tokenTransferAddress = previous.address;
        tokenTransferFilter = previous.filter;
        tokenTransferVisible = previous.visible;
        tokenExportStatus.textContent = previous.status;
        renderTokenTransferList();
      }
    });
    const raceAddressSuffix = 'd'.repeat(8);
    if (!csvExportRace.filename.includes(raceAddressSuffix) ||
        !csvExportRace.filename.endsWith('-incoming.csv') ||
        csvExportRace.status !== 'Current lookup status' ||
        !csvExportRace.csv.includes('0x' + '9'.repeat(64)) ||
        !csvExportRace.csv.includes('1.234567')) {
      throw new Error('CSV export state snapshot race regression failed: ' + JSON.stringify(csvExportRace));
    }
    console.log('CSV export keeps the initiating address and filter without overwriting the current status');

    // Verify address transaction/token pagination failures preserve state and can be retried.
    const paginationRegression = await page.evaluate(async () => {
      const originalFetch = window.fetch;
      const originalSetTimeout = window.setTimeout;
      const address = '0x' + 'f'.repeat(40);
      let txMode = 'success';
      let tokenMode = 'success';
      const txFirst = '0x' + '1'.repeat(64);
      const txSecond = '0x' + '2'.repeat(64);
      const tokenFirst = '0x' + '3'.repeat(64);
      const tokenSecond = '0x' + '4'.repeat(64);
      const incomingSecond = '0x' + '5'.repeat(64);
      const outgoingFirst = '0x' + '6'.repeat(64);
      const outgoingSecond = '0x' + '7'.repeat(64);
      const tokenFilterRequests = [];
      const response = (status, body) => new Response(JSON.stringify(body), {
        status, headers: { 'Content-Type': 'application/json' }
      });
      const pageResponse = (mode, payload) => {
        if (mode === 'rate-limit') return response(429, {});
        if (mode === 'server-error') return response(503, {});
        if (mode === 'incomplete') return response(200, {});
        if (mode === 'timeout') return new Promise((resolve, reject) => {
          // The application timeout aborts this deterministic pending request.
          const signal = window.__paginationSignal;
          signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')), { once: true });
        });
        return response(200, payload);
      };
      window.fetch = async (url, options = {}) => {
        const parsed = new URL(String(url));
        const base = 'https://crypto-project-2026.onrender.com/api/sepolia/addresses/' + address;
        if (parsed.href === base) return response(200, {
          hash: address, coin_balance: '0', is_contract: false,
          is_scam: false, has_tokens: true, has_token_transfers: true
        });
        if (parsed.pathname === '/api/sepolia/addresses/' + address + '/transactions') {
          if (!parsed.searchParams.has('block_number')) return response(200, {
            items: [{ hash: txFirst, value: '1', block_number: 10 }],
            next_page_params: { block_number: 9, index: 0 }
          });
          window.__paginationSignal = options.signal;
          return pageResponse(txMode, {
            items: [{ hash: txSecond, value: '2', block_number: 9 }],
            next_page_params: null
          });
        }
        if (parsed.pathname === '/api/sepolia/addresses/' + address + '/token-transfers') {
          const filter = parsed.searchParams.get('filter') || 'all';
          const paged = parsed.searchParams.has('block_number');
          tokenFilterRequests.push({ filter, paged, type: parsed.searchParams.get('type') });
          if (filter === 'to') {
            return response(200, paged ? {
              items: [{
                transaction_hash: incomingSecond, log_index: 2, token_type: 'ERC-20',
                from: { hash: '0x' + 'd'.repeat(40) }, to: { hash: address },
                token: { address_hash: '0x' + 'b'.repeat(40), symbol: 'PAGE' },
                total: { value: '3', decimals: '0' }, block_number: 8
              }], next_page_params: null
            } : {
              items: [{
                transaction_hash: tokenFirst, log_index: 0, token_type: 'ERC-20',
                from: { hash: '0x' + 'a'.repeat(40) }, to: { hash: address },
                token: { address_hash: '0x' + 'b'.repeat(40), symbol: 'PAGE' },
                total: { value: '1', decimals: '0' }, block_number: 10
              }], next_page_params: { block_number: 8, index: 0 }
            });
          }
          if (filter === 'from') {
            return response(200, paged ? {
              items: [{
                transaction_hash: outgoingSecond, log_index: 3, token_type: 'ERC-20',
                from: { hash: address }, to: { hash: '0x' + 'e'.repeat(40) },
                token: { address_hash: '0x' + 'b'.repeat(40), symbol: 'PAGE' },
                total: { value: '4', decimals: '0' }, block_number: 8
              }], next_page_params: null
            } : {
              items: [{
                transaction_hash: outgoingFirst, log_index: 1, token_type: 'ERC-20',
                from: { hash: address }, to: { hash: '0x' + 'c'.repeat(40) },
                token: { address_hash: '0x' + 'b'.repeat(40), symbol: 'PAGE' },
                total: { value: '2', decimals: '0' }, block_number: 9
              }], next_page_params: { block_number: 8, index: 0 }
            });
          }
          if (!paged) return response(200, {
            items: [{
              transaction_hash: tokenFirst, log_index: 0, token_type: 'ERC-20',
              from: { hash: '0x' + 'a'.repeat(40) }, to: { hash: address },
              token: { address_hash: '0x' + 'b'.repeat(40), symbol: 'PAGE' },
              total: { value: '1', decimals: '0' }, block_number: 10
            }],
            next_page_params: { block_number: 9, index: 0 }
          });
          window.__paginationSignal = options.signal;
          return pageResponse(tokenMode, {
            items: [{
              transaction_hash: tokenSecond, log_index: 1, token_type: 'ERC-20',
              from: { hash: address }, to: { hash: '0x' + 'c'.repeat(40) },
              token: { address_hash: '0x' + 'b'.repeat(40), symbol: 'PAGE' },
              total: { value: '2', decimals: '0' }, block_number: 9
            }],
            next_page_params: null
          });
        }
        throw new Error('Unexpected pagination fixture request: ' + parsed.href);
      };
      const wait = ms => new Promise(resolve => originalSetTimeout(resolve, ms));
      const waitFor = async predicate => {
        for (let attempt = 0; attempt < 200; attempt++) {
          if (predicate()) return;
          await wait(5);
        }
        throw new Error('Pagination fixture timed out');
      };
      const txErrors = [];
      const tokenErrors = [];
      try {
        addressInput.value = address;
        addressForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await waitFor(() => !addressResult.hidden && addressTxItems.length === 1 && tokenTransferItems.length === 1);
        tokenFilterButtons.find(button => button.dataset.tokenFilter === 'incoming').click();
        await waitFor(() => !tokenTransferLoading && tokenTransferItems.length === 1 && tokenTransferItems[0].transaction_hash === tokenFirst);
        if (tokenFilterRequests.at(-1)?.filter !== 'to' || tokenFilterRequests.at(-1)?.type !== 'ERC-20') {
          throw new Error('Incoming filter did not request Blockscout filter=to: ' + JSON.stringify(tokenFilterRequests));
        }
        await loadMoreTokenTransfers();
        if (tokenTransferItems.length !== 2 || tokenTransferItems[1].transaction_hash !== incomingSecond ||
            tokenFilterRequests.at(-1)?.filter !== 'to' || !tokenFilterRequests.at(-1)?.paged) {
          throw new Error('Incoming filtered pagination failed: ' + JSON.stringify(tokenFilterRequests));
        }
        tokenFilterButtons.find(button => button.dataset.tokenFilter === 'outgoing').click();
        await waitFor(() => !tokenTransferLoading && tokenTransferItems.length === 1 && tokenTransferItems[0].transaction_hash === outgoingFirst);
        if (tokenFilterRequests.at(-1)?.filter !== 'from' || tokenFilterRequests.at(-1)?.type !== 'ERC-20') {
          throw new Error('Outgoing filter did not request Blockscout filter=from: ' + JSON.stringify(tokenFilterRequests));
        }
        await loadMoreTokenTransfers();
        if (tokenTransferItems.length !== 2 || tokenTransferItems[1].transaction_hash !== outgoingSecond ||
            tokenFilterRequests.at(-1)?.filter !== 'from' || !tokenFilterRequests.at(-1)?.paged) {
          throw new Error('Outgoing filtered pagination failed: ' + JSON.stringify(tokenFilterRequests));
        }
        tokenFilterButtons.find(button => button.dataset.tokenFilter === 'all').click();
        await waitFor(() => !tokenTransferLoading && tokenTransferItems.length === 1 && tokenTransferFilter === 'all');
        for (const mode of ['rate-limit', 'server-error', 'incomplete', 'timeout']) {
          txMode = mode;
          if (mode === 'timeout') {
            window.setTimeout = (callback, delay, ...args) =>
              originalSetTimeout(callback, delay === 15000 ? 0 : delay, ...args);
          }
          await loadMoreAddressTx();
          const state = {
            mode, message: addressTxStatus.textContent,
            count: addressTxItems.length, hasNext: Boolean(addressTxNext),
            loading: addressTxLoading, disabled: addressTxLoadMore.disabled,
            visible: !addressTxLoadMore.hidden
          };
          const expected = mode === 'rate-limit' ? 'ограничил частоту' :
            mode === 'timeout' ? 'слишком долго' : 'Не удалось загрузить следующую страницу';
          if (!state.message.includes(expected) || state.count !== 1 || !state.hasNext ||
              state.loading || state.disabled || !state.visible) {
            throw new Error('Address transaction pagination ' + mode + ' state mismatch: ' + JSON.stringify(state));
          }
          txErrors.push(mode);
          if (mode === 'timeout') window.setTimeout = originalSetTimeout;
        }
        txMode = 'success';
        await loadMoreAddressTx();
        if (addressTxItems.length !== 2 || addressTxItems[1].hash !== txSecond ||
            addressTxNext || addressTxLoadError || addressTxLoading || addressTxLoadMore.disabled) {
          throw new Error('Address transaction pagination retry failed: ' + JSON.stringify({
            count: addressTxItems.length, next: addressTxNext, error: addressTxLoadError,
            loading: addressTxLoading, disabled: addressTxLoadMore.disabled
          }));
        }

        for (const mode of ['rate-limit', 'server-error', 'incomplete', 'timeout']) {
          tokenMode = mode;
          if (mode === 'timeout') {
            window.setTimeout = (callback, delay, ...args) =>
              originalSetTimeout(callback, delay === 15000 ? 0 : delay, ...args);
          }
          await loadMoreTokenTransfers();
          const state = {
            mode, message: tokenListStatus.textContent,
            count: tokenTransferItems.length, hasNext: Boolean(tokenTransferNext),
            loading: tokenTransferLoading, disabled: tokenLoadMore.disabled,
            visible: !tokenLoadMore.hidden
          };
          const expected = mode === 'rate-limit' ? 'ограничил частоту' :
            mode === 'timeout' ? 'слишком долго' : 'Не удалось загрузить следующую страницу переводов';
          if (!state.message.includes(expected) || state.count !== 1 || !state.hasNext ||
              state.loading || state.disabled || !state.visible) {
            throw new Error('Token transfer pagination ' + mode + ' state mismatch: ' + JSON.stringify(state));
          }
          tokenErrors.push(mode);
          if (mode === 'timeout') window.setTimeout = originalSetTimeout;
        }
        tokenMode = 'success';
        await loadMoreTokenTransfers();
        if (tokenTransferItems.length !== 2 || tokenTransferItems[1].transaction_hash !== tokenSecond ||
            tokenTransferNext || tokenTransferLoadError || tokenTransferLoading || tokenLoadMore.disabled) {
          throw new Error('Token transfer pagination retry failed: ' + JSON.stringify({
            count: tokenTransferItems.length, next: tokenTransferNext, error: tokenTransferLoadError,
            loading: tokenTransferLoading, disabled: tokenLoadMore.disabled
          }));
        }
        return { txErrors, tokenErrors, txRows: addressTxItems.length, tokenRows: tokenTransferItems.length };
      } finally {
        window.fetch = originalFetch;
        window.setTimeout = originalSetTimeout;
        delete window.__paginationSignal;
      }
    });
    console.log('Address transaction and token-transfer pagination error/retry matrix passed:', JSON.stringify(paginationRegression));

    // Untrusted Blockscout strings must remain inert text, never become executable markup.
    const untrustedApiRendering = await page.evaluate(async () => {
      const originalFetch = window.fetch;
      const hash = '0x' + '8'.repeat(64);
      const address = '0x' + '9'.repeat(40);
      const payload = '<img src=x onerror="window.__untrustedApiExecuted=1"><script>window.__untrustedApiExecuted=2</script>';
      const transaction = {
        hash, status: 'ok', block_number: 123,
        from: { hash: payload }, to: { hash: '0x' + '2'.repeat(40) },
        value: '1', method: payload, decoded_input: { method_call: payload },
        token_transfers: [{
          token: { name: payload, address_hash: '0x' + '3'.repeat(40) },
          from: { hash: '0x' + '4'.repeat(40) }, to: { hash: '0x' + '5'.repeat(40) },
          total: { value: '1', decimals: '0' }
        }]
      };
      window.__untrustedApiExecuted = 0;
      window.fetch = async url => {
        if (String(url).includes('/api/sepolia/transactions/' + hash)) {
          return new Response(JSON.stringify(transaction), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return originalFetch(url);
      };
      try {
        input.value = hash;
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        for (let attempt = 0; attempt < 200; attempt++) {
          if (!result.hidden || !errorBox.hidden) break;
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        const tokenRow = appendTokenTransfer(transaction.token_transfers[0], address);
        const state = {
          resultVisible: !result.hidden,
          fromText: document.querySelector('#r-from').textContent,
          methodText: document.querySelector('#r-method').textContent,
          tokenText: tokenRow.textContent,
          injectedElements: document.querySelectorAll('#result img, #result script').length +
            tokenRow.querySelectorAll('img, script').length,
          executed: window.__untrustedApiExecuted
        };
        return { payload, state };
      } finally {
        window.fetch = originalFetch;
        delete window.__untrustedApiExecuted;
      }
    });
    if (!untrustedApiRendering.state.resultVisible ||
        untrustedApiRendering.state.fromText !== untrustedApiRendering.payload ||
        untrustedApiRendering.state.methodText !== untrustedApiRendering.payload ||
        !untrustedApiRendering.state.tokenText.includes(untrustedApiRendering.payload) ||
        untrustedApiRendering.state.injectedElements !== 0 ||
        untrustedApiRendering.state.executed !== 0) {
      throw new Error('Untrusted API text-rendering/XSS regression failed: ' + JSON.stringify(untrustedApiRendering));
    }
    console.log('Untrusted Blockscout transaction, method, and token strings remain inert text (no injected elements or execution)');

    console.log('All deterministic offline application tests passed');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
