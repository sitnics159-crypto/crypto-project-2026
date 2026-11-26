import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Script } from 'node:vm';

const [input, output, ...extra] = process.argv.slice(2);
if (!input || !output || extra.length || resolve(input) === resolve(output)) {
  throw new Error('Usage: node scripts/build-without-kraken.mjs <source HTML> <new output HTML>');
}

let html = readFileSync(input, 'utf8');
function replaceOnce(pattern, replacement) {
  if ([...html.matchAll(new RegExp(pattern.source, 'g'))].length !== 1) {
    throw new Error(`Unexpected source layout: ${pattern}`);
  }
  html = html.replace(pattern, replacement);
}

replaceOnce(/<section class="panel market-panel"[\s\S]*?<\/section>\s*/, '');
replaceOnce(/ https:\/\/api\.kraken\.com(?=;)/, '');
replaceOnce(/let latestEthUsdPrice=null,lastTransactionFeeWei=null;[\s\S]*?(?=function tokenEventAmount)/, '');
replaceOnce(/lastTransactionFeeWei=fee;put\('#r-fee',fee===null\?'Не удалось определить':formatFeeDisplay\(fee\)\);/, "put('#r-fee',fee===null?'Не удалось определить':weiToEth(fee,18));");
replaceOnce(/const MARKET_API=[\s\S]*?(?=restoreShareableLookup\(\);\s*<\/script>)/, '');

const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!script || /kraken|latestEthUsdPrice|formatFeeDisplay|market-refresh/i.test(html)) {
  throw new Error('The generated HTML still has market dependencies or is missing its script.');
}
new Script(script);
const hash = createHash('sha256').update(script).digest('base64');
replaceOnce(/script-src 'sha256-[^']+'/, `script-src 'sha256-${hash}'`);
writeFileSync(output, html, { flag: 'wx' });
