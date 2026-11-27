import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const publicOrigin = 'https://eth-sepolia.blockscout.com';
const publicApi = publicOrigin + '/api/v2/';
const proxyApi = '/api/sepolia/';
const hash = content => 'sha256-' + createHash('sha256').update(content).digest('base64');
const inline = html => html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

export function buildProPreview(sourceHtml, sourceModule) {
  const html = sourceHtml.replace(/\r\n/g, '\n');
  const originalScript = inline(html);
  const originalModuleHash = hash(sourceModule);
  if (!originalScript?.includes(publicApi) || !sourceModule.includes(publicApi) ||
      !html.includes("script-src '" + hash(originalScript) + "' '" + originalModuleHash + "'") ||
      !html.includes('src="./token-balances.mjs" integrity="' + originalModuleHash + '"') ||
      !html.includes('connect-src ' + publicOrigin)) {
    throw new Error('Expected the current Sepolia API URLs, CSP, and balance module integrity.');
  }

  const balanceModule = sourceModule.replaceAll(publicApi, proxyApi);
  const script = originalScript.replaceAll(publicApi, proxyApi);
  const indexHtml = html.replace(originalScript, () => script)
    .replace(hash(originalScript), hash(script))
    .replaceAll(originalModuleHash, hash(balanceModule))
    .replace('connect-src ' + publicOrigin, "connect-src 'self'");
  if (indexHtml.includes(publicApi) || balanceModule.includes(publicApi)) {
    throw new Error('The preview still contains a direct Sepolia API URL.');
  }
  return { indexHtml, balanceModule };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [source, output, ...extra] = process.argv.slice(2);
  if (!source || !output || extra.length) {
    throw new Error('Usage: node scripts/build-pro-preview.mjs <source-directory> <new-output-directory>');
  }
  const preview = buildProPreview(readFileSync(join(source, 'index.html'), 'utf8'),
    readFileSync(join(source, 'token-balances.mjs'), 'utf8'));
  mkdirSync(output);
  writeFileSync(join(output, 'index.html'), preview.indexHtml, { flag: 'wx' });
  writeFileSync(join(output, 'token-balances.mjs'), preview.balanceModule, { flag: 'wx' });
}
