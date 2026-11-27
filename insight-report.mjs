const validAddress = value => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
export function summarizeTransfers(address, transfers) {
  if (!validAddress(address)) throw new TypeError('Invalid Sepolia address');
  if (transfers == null) return null;
  if (!Array.isArray(transfers)) throw new TypeError('Invalid transfers');
  const target = address.toLowerCase();
  const result = { loaded: transfers.length, incoming: 0, outgoing: 0, self: 0, unknown: 0 };
  for (const item of transfers) {
    const from = item?.from?.hash, to = item?.to?.hash;
    if (!validAddress(from) || !validAddress(to)) { result.unknown++; continue; }
    const a = from.toLowerCase() === target, b = to.toLowerCase() === target;
    if (a && b) result.self++;
    else if (a) result.outgoing++;
    else if (b) result.incoming++;
    else result.unknown++;
  }
  return result;
}
