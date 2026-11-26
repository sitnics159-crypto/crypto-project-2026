// Pure normalization of public Blockscout token balance records.
export function normalizeTokenBalance(item) {
  const token = item?.token;
  if (!token || token.type !== 'ERC-20') return null;
  const address = token.address_hash;
  if (typeof address !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(address)) return null;
  const raw = item.value;
  const decimals = token.decimals;
  let amount = null;
  if (typeof raw === 'string' && /^[0-9]{1,78}$/.test(raw) &&
      (typeof decimals === 'string' || typeof decimals === 'number') &&
      /^[0-9]{1,3}$/.test(String(decimals)) && Number(decimals) <= 255) {
    const d = Number(decimals), value = BigInt(raw), base = 10n ** BigInt(d);
    if (value > (1n << 256n) - 1n) return { address, symbol: '', name: '', amount: null };
    const fraction = (value % base).toString().padStart(d, '0').replace(/0+$/, '');
    amount = String(value / base) + (fraction ? '.' + fraction : '');
  }
  return { address, symbol: typeof token.symbol === 'string' ? token.symbol.slice(0, 80) : '', name: typeof token.name === 'string' ? token.name.slice(0, 160) : '', amount };
}

// Blockscout token-balances returns an array, not transfer history.
export function normalizeTokenBalances(payload) {
  if (!Array.isArray(payload)) throw new TypeError('Invalid token balances response');
  const balances = [], seen = new Set();
  let incomplete = false;
  for (const item of payload) {
    if (item?.token?.type !== 'ERC-20') { if (!item?.token?.type) incomplete = true; continue; }
    const balance = normalizeTokenBalance(item);
    if (!balance) { incomplete = true; continue; }
    const key = balance.address.toLowerCase();
    if (seen.has(key)) { incomplete = true; continue; }
    seen.add(key);
    if (balance.amount === null) incomplete = true;
    balances.push(balance);
  }
  return { balances, incomplete };
}

export async function fetchTokenBalances(address, { signal, fetcher = globalThis.fetch } = {}) {
  if (typeof address !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(address)) throw new TypeError('Invalid address');
  const response = await fetcher('https://eth-sepolia.blockscout.com/api/v2/addresses/' + encodeURIComponent(address) + '/token-balances', { signal, headers: { Accept: 'application/json' }, credentials: 'omit', redirect: 'error' });
  if (!response.ok) throw new Error('Token balance HTTP ' + response.status);
  return normalizeTokenBalances(await response.json());
}
