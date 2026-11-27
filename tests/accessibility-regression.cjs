const { chromium } = require('playwright');
const axe = require('axe-core');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  // Keep the baseline deterministic: this suite must not contact third-party APIs.
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if ((url.hostname === '127.0.0.1' || url.hostname === 'localhost') &&
        (url.pathname === '/' || url.pathname === '/index.html')) {
      // axe injects its own script. Strip the production CSP only from this
      // isolated accessibility-test response; CSP is checked separately by
      // the offline regression and the normal browser smoke test.
      const response = await route.fetch();
      const html = await response.text();
      return route.fulfill({
        response,
        body: html.replace(/<meta http-equiv="Content-Security-Policy" content="[^"]+">/i, '')
      });
    }
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
    return route.abort('blockedbyclient');
  });

  try {
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
    if (!(await page.title()).includes('Sepolia')) throw new Error('Unexpected page title');

    const controlSemantics = await page.evaluate(() => {
      const txInput = document.querySelector('#tx-hash');
      const addressInput = document.querySelector('#address-input');
      const labelFor = id => Boolean(document.querySelector('label[for="' + id + '"]'));
      return {
        transactionInputLabelled: labelFor('tx-hash'),
        addressInputLabelled: labelFor('address-input'),
        transactionHintLinked: txInput?.getAttribute('aria-describedby') === 'hint',
        addressHintLinked: addressInput?.getAttribute('aria-describedby') === 'address-hint',
        transactionErrorUsesAlert: document.querySelector('#error')?.getAttribute('role') === 'alert',
        addressErrorUsesAlert: document.querySelector('#address-error')?.getAttribute('role') === 'alert',
        addressLoadingAnnounced: document.querySelector('#address-loading')?.getAttribute('aria-live') === 'polite',
        transactionLoadingAnnounced: document.querySelector('#loading')?.getAttribute('role') === 'status',
        marketRefreshHasName: document.querySelector('#market-refresh')?.textContent.trim() === 'Обновить',
        marketCardsNamed: [...document.querySelectorAll('.market-card')].length === 2 &&
          [...document.querySelectorAll('.market-card')].every(card => Boolean(card.getAttribute('aria-label')))
      };
    });
    if (Object.values(controlSemantics).some(value => value !== true)) {
      throw new Error('Interactive control accessibility semantics mismatch: ' + JSON.stringify(controlSemantics));
    }

    await page.addScriptTag({ content: axe.source });
    const viewportResults = [];

    for (const viewport of [
      { width: 320, height: 740 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 }
    ]) {
      await page.setViewportSize(viewport);
      const layout = await page.evaluate(() => ({
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth ||
          document.body.scrollWidth > document.documentElement.clientWidth,
        transactionInputVisible: document.querySelector('#tx-hash')?.getClientRects().length > 0,
        addressInputVisible: document.querySelector('#address-input')?.getClientRects().length > 0
      }));

      if (layout.horizontalOverflow || !layout.transactionInputVisible || !layout.addressInputVisible) {
        throw new Error('Responsive layout regression at ' + viewport.width + 'px: ' + JSON.stringify(layout));
      }

      const audit = await page.evaluate(async () => {
        const results = await axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
          }
        });
        return {
          violations: results.violations.map(item => ({
            id: item.id,
            impact: item.impact,
            help: item.help,
            nodes: item.nodes.length,
            examples: item.nodes.slice(0, 3).map(node => ({
              target: node.target,
              summary: node.failureSummary
            }))
          })),
          passes: results.passes.length,
          incomplete: results.incomplete.map(item => ({
            id: item.id,
            impact: item.impact,
            help: item.help,
            description: item.description,
            helpUrl: item.helpUrl,
            nodes: item.nodes.slice(0, 5).map(node => ({
              target: node.target,
              html: node.html,
              any: node.any.map(check => ({ id: check.id, message: check.message })),
              all: node.all.map(check => ({ id: check.id, message: check.message })),
              none: node.none.map(check => ({ id: check.id, message: check.message }))
            }))
          }))
        };
      });

      viewportResults.push({ viewport, layout, audit });
      if (audit.violations.length) {
        throw new Error('WCAG violations at ' + viewport.width + 'px: ' + JSON.stringify(audit.violations));
      }
    }

    // Audit the client-side validation states as well as the empty initial page.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#tx-hash').fill('not-a-transaction-hash');
    await page.locator('#submit').click();
    await page.locator('#error').waitFor({ state: 'visible' });
    const transactionErrorAudit = await page.evaluate(async () => {
      const results = await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }
      });
      return {
        violations: results.violations.map(item => ({
          id: item.id, impact: item.impact, help: item.help,
          nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary }))
        })),
        passes: results.passes.length,
        incomplete: results.incomplete.length
      };
    });
    if (transactionErrorAudit.violations.length) {
      throw new Error('WCAG violations in transaction validation-error state: ' + JSON.stringify(transactionErrorAudit.violations));
    }

    await page.locator('#address-input').fill('not-an-address');
    await page.locator('#address-submit').click();
    await page.locator('#address-error').waitFor({ state: 'visible' });
    const addressErrorAudit = await page.evaluate(async () => {
      const results = await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }
      });
      return {
        violations: results.violations.map(item => ({
          id: item.id, impact: item.impact, help: item.help,
          nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary }))
        })),
        passes: results.passes.length,
        incomplete: results.incomplete.length
      };
    });
    if (addressErrorAudit.violations.length) {
      throw new Error('WCAG violations in address validation-error state: ' + JSON.stringify(addressErrorAudit.violations));
    }

    // Audit real loading, populated-result, and pagination states with deterministic Blockscout fixtures.
    const fixtureAddress = '0x' + 'b'.repeat(40);
    const fixtureTxHash = '0x' + 'a'.repeat(64);
    const fixtureTx = {
      hash: fixtureTxHash, status: 'ok', block_number: 12345,
      from: { hash: '0x' + 'c'.repeat(40) }, to: { hash: '0x' + 'd'.repeat(40) },
      value: '1000000000000000000', gas_used: '21000', gas_price: '1000000000',
      timestamp: '2026-11-24T14:00:00.000000Z', transaction_types: ['coin_transfer']
    };
    const fixtureTokenTransfer = {
      transaction_hash: '0x' + 'e'.repeat(64), log_index: 0, token_type: 'ERC-20',
      from: { hash: '0x' + 'c'.repeat(40) }, to: { hash: fixtureAddress },
      token: { address_hash: '0x' + 'f'.repeat(40), symbol: 'TEST', decimals: '6' },
      total: { value: '1250000', decimals: '6' }, block_number: 12345
    };
    await page.route('https://eth-sepolia.blockscout.com/**', async route => {
      const url = new URL(route.request().url());
      const json = body => route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify(body)
      });
      if (url.pathname === '/api/v2/transactions/' + fixtureTxHash) {
        await new Promise(resolve => setTimeout(resolve, 350));
        return json(fixtureTx);
      }
      if (url.pathname === '/api/v2/addresses/' + fixtureAddress) {
        await new Promise(resolve => setTimeout(resolve, 350));
        return json({
          hash: fixtureAddress, coin_balance: '2500000000000000000',
          is_contract: false, is_scam: false, has_tokens: true, has_token_transfers: true
        });
      }
      if (url.pathname === '/api/v2/addresses/' + fixtureAddress + '/transactions') {
        if (url.searchParams.has('block_number')) {
          await new Promise(resolve => setTimeout(resolve, 350));
          return json({ items: [{ ...fixtureTx, hash: '0x' + '9'.repeat(64), block_number: 12344 }], next_page_params: null });
        }
        return json({ items: [fixtureTx], next_page_params: { block_number: 12344, index: 0 } });
      }
      if (url.pathname === '/api/v2/addresses/' + fixtureAddress + '/token-transfers') {
        if (url.searchParams.has('block_number')) {
          await new Promise(resolve => setTimeout(resolve, 350));
          return json({ items: [{ ...fixtureTokenTransfer, transaction_hash: '0x' + '8'.repeat(64), block_number: 12344 }], next_page_params: null });
        }
        return json({ items: [fixtureTokenTransfer], next_page_params: { block_number: 12344, index: 0 } });
      }
      if (url.pathname === '/api/v2/addresses/' + fixtureAddress + '/token-balances') {
        return json([{
          value: ((1n << 256n) - 1n).toString(),
          token: { type: 'ERC-20', address_hash: '0x' + 'f'.repeat(40), symbol: 'T'.repeat(80), decimals: '0' }
        }]);
      }
      return route.abort('blockedbyclient');
    });

    const auditCurrentState = async label => {
      const result = await page.evaluate(async () => {
        const results = await axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }
        });
        return {
          violations: results.violations.map(item => ({
            id: item.id, impact: item.impact, help: item.help,
            nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary }))
          })),
          passes: results.passes.length,
          incomplete: results.incomplete.length
        };
      });
      if (result.violations.length) {
        throw new Error('WCAG violations in ' + label + ' state: ' + JSON.stringify(result.violations));
      }
      return result;
    };

    await page.locator('#tx-hash').fill(fixtureTxHash);
    await page.locator('#submit').click();
    await page.locator('#loading').waitFor({ state: 'visible' });
    const transactionLoadingAudit = await auditCurrentState('transaction loading');
    await page.locator('#result').waitFor({ state: 'visible' });
    const transactionResultAudit = await auditCurrentState('transaction result');

    await page.locator('#address-input').fill(fixtureAddress);
    await page.locator('#address-submit').click();
    await page.locator('#address-loading').waitFor({ state: 'visible' });
    const addressLoadingAudit = await auditCurrentState('address loading');
    await page.locator('#address-result').waitFor({ state: 'visible' });
    await page.locator('#address-tx-load-more').waitFor({ state: 'visible' });
    await page.locator('#token-load-more').waitFor({ state: 'visible' });
    const addressResultAudit = await auditCurrentState('address result with pagination controls');

    await page.locator('#address-tx-load-more').click();
    await page.waitForFunction(() => document.querySelector('#address-tx-status')?.textContent.includes('Загружаем следующую страницу'));
    const transactionPaginationLoadingAudit = await auditCurrentState('address transaction pagination loading');
    await page.waitForFunction(() => document.querySelector('#address-tx-status')?.textContent.includes('Показано 2 из 2'));

    await page.locator('#token-load-more').click();
    await page.waitForFunction(() => document.querySelector('#token-load-more')?.textContent === 'Загружаем…');
    const tokenPaginationLoadingAudit = await auditCurrentState('token transfer pagination loading');
    await page.waitForFunction(() => document.querySelector('#token-list-status')?.textContent.includes('Показано 2 из 2'));

    await page.setViewportSize({ width: 320, height: 740 });
    const balanceButton = page.getByRole('button', { name: 'Загрузить балансы' });
    await balanceButton.focus();
    await page.keyboard.press('Enter');
    const balanceRow = page.locator('#token-balances-list li');
    await balanceRow.waitFor({ state: 'visible' });
    const balanceLayout = await balanceRow.evaluate(row => {
      const status = document.querySelector('#token-balances-status');
      return {
        text: row.textContent,
        rowFits: row.scrollWidth <= row.clientWidth + 1 &&
          row.getBoundingClientRect().right <= document.documentElement.clientWidth + 1,
        announced: status.getAttribute('aria-live') === 'polite' &&
          status.textContent === 'Балансы загружены.'
      };
    });
    if (!balanceLayout.rowFits || !balanceLayout.announced ||
        !balanceLayout.text.includes('0x' + 'f'.repeat(40)) ||
        !balanceLayout.text.includes(((1n << 256n) - 1n).toString())) {
      throw new Error('Mobile ERC-20 balance regression: ' + JSON.stringify(balanceLayout));
    }
    const balanceMobileAudit = await auditCurrentState('ERC-20 balances at 320px');

    console.log('Loading, result, and pagination accessibility audits:', JSON.stringify({
      transactionLoadingAudit, transactionResultAudit, addressLoadingAudit,
      addressResultAudit, transactionPaginationLoadingAudit, tokenPaginationLoadingAudit, balanceMobileAudit
    }));

    if (pageErrors.length) throw new Error('Browser runtime errors: ' + JSON.stringify(pageErrors));
    console.log('Responsive viewport and WCAG 2.2 AA baseline:', JSON.stringify(viewportResults));
    console.log('Validation-error accessibility audits:', JSON.stringify({ transactionErrorAudit, addressErrorAudit }));
    console.log('PASS: responsive layout and WCAG checks passed in initial, validation-error, loading, result, and pagination-loading states.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
