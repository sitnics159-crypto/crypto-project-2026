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
    const fraction = (value % base).toString().padStart(d, '0').replace(/0+$/, '');
    amount = String(value / base) + (fraction ? '.' + fraction : '');
  }
  return { address, symbol: typeof token.symbol === 'string' ? token.symbol.slice(0, 80) : '', name: typeof token.name === 'string' ? token.name.slice(0, 160) : '', amount };
}
