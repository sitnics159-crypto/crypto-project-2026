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
    if (value <= (1n << 256n) - 1n) {
      const fraction = (value % base).toString().padStart(d, '0').replace(/0+$/, '');
      amount = String(value / base) + (fraction ? '.' + fraction : '');
    }
  }
  return { address, symbol: typeof token.symbol === 'string' ? token.symbol.slice(0, 80) : '', name: typeof token.name === 'string' ? token.name.slice(0, 160) : '', amount };
}

// Blockscout token-balances returns an array, not transfer history.
export function normalizeTokenBalances(payload) {
  if (!Array.isArray(payload)) throw new TypeError('Invalid token balances response');
  const balances = [], positions = new Map();
  let incomplete = false;
  for (const item of payload) {
    if (item?.token?.type !== 'ERC-20') { if (!item?.token?.type) incomplete = true; continue; }
    const balance = normalizeTokenBalance(item);
    if (!balance) { incomplete = true; continue; }
    const key = balance.address.toLowerCase();
    if (positions.has(key)) {
      incomplete = true;
      const index = positions.get(key);
      if (balances[index].amount === null && balance.amount !== null) balances[index] = balance;
      continue;
    }
    positions.set(key, balances.length);
    if (balance.amount === null) incomplete = true;
    balances.push(balance);
  }
  return { balances, incomplete };
}

export class TokenBalanceHttpError extends Error {
  constructor(status, retryAfter) {
    super('Token balance HTTP ' + status);
    this.name = 'TokenBalanceHttpError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function tokenBalanceErrorMessage(error) {
  if (error?.status === 429) {
    const seconds = typeof error.retryAfter === 'number' && Number.isFinite(error.retryAfter)
      ? Math.min(3600, Math.max(1, Math.ceil(error.retryAfter))) : null;
    return seconds
      ? 'Сервис временно ограничил частоту запросов. Подождите ' + seconds + ' сек. и повторите загрузку.'
      : 'Сервис временно ограничил частоту запросов. Повторите загрузку немного позже.';
  }
  if (error?.status === 503) {
    return 'Сервис данных Sepolia временно недоступен. Повторите попытку позже.';
  }
  if (error?.status === 502) {
    return 'Источник данных Sepolia временно не отвечает. Повторите попытку позже.';
  }
  return 'Балансы временно недоступны. Попробуйте ещё раз.';
}

export async function fetchTokenBalances(address, { signal, fetcher = globalThis.fetch } = {}) {
  if (typeof address !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(address)) throw new TypeError('Invalid address');
  const response = await fetcher('https://crypto-project-2026.onrender.com/api/sepolia/addresses/' + encodeURIComponent(address) + '/token-balances', { signal, headers: { Accept: 'application/json' }, credentials: 'omit', redirect: 'error' });
  if (!response.ok) {
    const retryValue = response.headers?.get?.('retry-after');
    const retryAfter = retryValue && /^\d{1,10}$/.test(retryValue) ? Number(retryValue) : null;
    throw new TokenBalanceHttpError(response.status, retryAfter);
  }
  return normalizeTokenBalances(await response.json());
}

if (typeof document !== 'undefined') {
  const button = document.querySelector('#token-balances-load');
  const status = document.querySelector('#token-balances-status');
  const list = document.querySelector('#token-balances-list');
  let pending;

  document.querySelector('#address-form').addEventListener('submit', () => {
    pending?.abort();
    pending = undefined;
    button.disabled = false;
    status.textContent = '';
    list.replaceChildren();
  });

  button.addEventListener('click', async () => {
    const address = document.querySelector('#a-hash').textContent;
    const controller = new AbortController();
    pending = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    button.disabled = true;
    list.replaceChildren();
    status.textContent = 'Загружаем балансы…';
    try {
      const { balances, incomplete } = await fetchTokenBalances(address, { signal: controller.signal });
      if (pending !== controller) return;
      for (const balance of balances) {
        const row = document.createElement('li');
        row.textContent = [balance.symbol || balance.name, balance.address,
          balance.amount ?? 'баланс недоступен'].filter(Boolean).join(' · ');
        list.append(row);
      }
      status.textContent = incomplete ? 'Blockscout вернул неполные данные о балансах.'
        : balances.length ? 'Балансы загружены.' : 'Blockscout не вернул балансы ERC‑20.';
    } catch (error) {
      if (pending === controller) status.textContent = tokenBalanceErrorMessage(error);
    } finally {
      clearTimeout(timeout);
      if (pending === controller) {
        pending = undefined;
        button.disabled = false;
      }
    }
  });
  button.hidden = false;
}
