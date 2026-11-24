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
          incomplete: results.incomplete.length
        };
      });

      viewportResults.push({ viewport, layout, audit });
      const critical = audit.violations.filter(item => item.impact === 'critical');
      if (critical.length) {
        throw new Error('Critical WCAG violations at ' + viewport.width + 'px: ' + JSON.stringify(critical));
      }
    }

    if (pageErrors.length) throw new Error('Browser runtime errors: ' + JSON.stringify(pageErrors));
    console.log('Responsive viewport and WCAG 2.2 AA baseline:', JSON.stringify(viewportResults));
    console.log('PASS: no horizontal overflow, both primary inputs visible, and no critical automated WCAG violations.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
