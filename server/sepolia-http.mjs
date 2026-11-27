import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createBlockscoutHandler } from './blockscout-sepolia.mjs';

export function createSepoliaHttpServer(options) {
  const handle = createBlockscoutHandler(options);
  return createServer(async (incoming, outgoing) => {
    if (incoming.method !== 'GET') {
      outgoing.writeHead(405, { allow: 'GET', 'cache-control': 'no-store' }).end();
      return;
    }
    const target = incoming.url;
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
  const host = process.env.HOST ?? '127.0.0.1';
  const server = createSepoliaHttpServer({ apiKey: process.env.BLOCKSCOUT_API_KEY?.trim() });
  server.listen(port, host, () => {
    console.log('Sepolia API listening on port', server.address().port);
  });
}
