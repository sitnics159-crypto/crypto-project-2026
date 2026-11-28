import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createBlockscoutHandler } from './blockscout-sepolia.mjs';

export function createSepoliaHttpServer({ preview, ...options } = {}) {
  const handle = createBlockscoutHandler(options);
  const modules = new Map([['/token-balances.mjs', preview?.balanceModule], ['/insight-report.mjs', preview?.insightReport], ['/insight-report-view.mjs', preview?.insightReportView]]);
  return createServer(async (incoming, outgoing) => {
    if (incoming.url?.startsWith('/api/sepolia/')) {
      outgoing.setHeader('Vary', 'Origin');
      if (incoming.headers.origin === 'https://sitnics159-crypto.github.io') {
        outgoing.setHeader('Access-Control-Allow-Origin', 'https://sitnics159-crypto.github.io');
      }
    }
    if (incoming.method !== 'GET') {
      outgoing.writeHead(405, { allow: 'GET', 'cache-control': 'no-store' }).end();
      return;
    }
    const target = incoming.url;
    const path = target?.split('?', 1)[0];
    if (target === '/healthz') {
      outgoing.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
      }).end(JSON.stringify({ status: 'ok' }));
      return;
    }
    if (preview && (path === '/' || path === '/index.html' || modules.get(path) !== undefined)) {
      const isModule = modules.has(path);
      outgoing.writeHead(200, {
        'content-type': isModule ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
      }).end(isModule ? modules.get(path) : preview.indexHtml);
      return;
    }
    if (!target?.startsWith('/api/sepolia/') || target.includes('\\')) {
      outgoing.writeHead(404, { 'cache-control': 'no-store' }).end();
      return;
    }
    const client = new AbortController();
    outgoing.once('close', () => {
      if (!outgoing.writableFinished) client.abort();
    });
    try {
      const request = new Request('http://localhost' + target.slice('/api/sepolia'.length), {
        signal: client.signal
      });
      const response = await handle(request);
      const body = await response.text();
      if (outgoing.destroyed) return;
      outgoing.writeHead(response.status, Object.fromEntries(response.headers)).end(body);
    } catch {
      if (outgoing.destroyed) return;
      outgoing.writeHead(502, { 'cache-control': 'no-store' }).end();
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 8787);
  const host = process.env.HOST ?? (process.env.RENDER === 'true' ? '0.0.0.0' : '127.0.0.1');
  const directory = process.env.SEPOLIA_PREVIEW_DIR;
  const preview = directory ? {
    indexHtml: readFileSync(join(directory, 'index.html')),
    balanceModule: readFileSync(join(directory, 'token-balances.mjs')),
    insightReport: readFileSync(join(directory, 'insight-report.mjs')),
    insightReportView: readFileSync(join(directory, 'insight-report-view.mjs'))
  } : undefined;
  const server = createSepoliaHttpServer({ apiKey: process.env.BLOCKSCOUT_API_KEY?.trim(), preview });
  server.listen(port, host, () => {
    console.log('Sepolia API listening on port', server.address().port);
  });
}
