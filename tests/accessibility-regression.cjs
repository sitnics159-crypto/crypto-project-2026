const { chromium } = require('playwright');
const axe = require('axe-core');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  // Keep the baseline deterministic: this suite must not contact third-party APIs.
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
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

    if (pageErrors.length) throw new Error('Browser runtime errors: ' + JSON.stringify(pageErrors));
    console.log('Responsive viewport and WCAG 2.2 AA baseline:', JSON.stringify(viewportResults));
    console.log('Validation-error accessibility audits:', JSON.stringify({ transactionErrorAudit, addressErrorAudit }));
    console.log('PASS: no horizontal overflow, both primary inputs visible, and no automated WCAG violations in initial or validation-error states.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
