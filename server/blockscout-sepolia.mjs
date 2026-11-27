const upstreamBase = 'https://api.blockscout.com/11155111/api/v2';
const address = '0x[0-9a-fA-F]{40}';
const routes = [
  { pattern: new RegExp('^/transactions/0x[0-9a-fA-F]{64}$'), query: [] },
  { pattern: new RegExp('^/addresses/' + address + '$'), query: [] },
  { pattern: new RegExp('^/addresses/' + address + '/transactions$'), query: ['block_number', 'index', 'items_count'] },
  { pattern: new RegExp('^/addresses/' + address + '/token-transfers$'), query: ['type', 'filter', 'block_number', 'index', 'log_index', 'items_count'] },
  { pattern: new RegExp('^/addresses/' + address + '/token-balances$'), query: [] },
  { pattern: new RegExp('^/tokens/' + address + '$'), query: [] }
];

function failure(status, message, headers = {}) {
  return Response.json({ message }, { status, headers: { ...headers, 'cache-control': 'no-store' } });
}

export function createBlockscoutHandler({ apiKey, fetchUpstream = fetch, now = Date.now } = {}) {
  let recentRequests = [];

  return async function handle(request) {
    if (request.method !== 'GET') return failure(405, 'Method not allowed', { allow: 'GET' });
    const input = new URL(request.url);
    const route = routes.find(entry => entry.pattern.test(input.pathname));
    if (!route) return failure(404, 'Unknown Sepolia operation');
    const upstream = new URL(upstreamBase + input.pathname);

    for (const [name, value] of input.searchParams) {
      if (upstream.searchParams.has(name) || !route.query.includes(name) ||
          !(name === 'type' ? value === 'ERC-20' : name === 'filter' ? /^(from|to)$/.test(value) : /^\d{1,20}$/.test(value))) {
        return failure(400, 'Invalid request parameter');
      }
      upstream.searchParams.set(name, value);
    }

    if (input.pathname.endsWith('/token-transfers')) upstream.searchParams.set('type', 'ERC-20');

    if (!apiKey) return failure(503, 'Data service is not configured');
    const time = now();
    recentRequests = recentRequests.filter(started => time - started < 1000);
    if (recentRequests.length >= 5) return failure(429, 'Try again shortly', { 'retry-after': '1' });
    recentRequests.push(time);
    upstream.searchParams.set('apikey', apiKey);

    try {
      const response = await fetchUpstream(upstream, {
        headers: { accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(10000)
      });
      if (response.status === 404) return failure(404, 'Data not found');
      if (response.status === 429) return failure(429, 'Provider rate limit reached');
      if (!response.ok) return failure(502, 'Provider request failed');
      return Response.json(await response.json(), { headers: { 'cache-control': 'no-store' } });
    } catch {
      return failure(502, 'Provider response unavailable');
    }
  };
}
