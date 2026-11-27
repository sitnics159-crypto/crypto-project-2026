import assert from 'node:assert/strict';
import { normalizeTokenBalances } from '../token-balances.mjs';

const key = process.env.BLOCKSCOUT_API_KEY?.trim();
if (!key) {
  console.error('BLOCKSCOUT_API_KEY is missing or empty. Set it in the local environment or update the GitHub Actions repository secret.');
  process.exit(2);
}

if (!/^proapi_[A-Za-z0-9_-]+$/.test(key)) {
  console.error('Invalid BLOCKSCOUT_API_KEY format. Copy the raw Pro API key (proapi_...) from the Blockscout developer portal into the secret value, without quotes, a URL, or an assignment. Then start a fresh workflow run on main.');
  process.exit(2);
}

const apiOrigin = 'https://api.blockscout.com';
const sepolia = '11155111';
const hash = '0x616c86b82eaa5485aa04e9773bd281bbc8fd9cd6b050efcc2f864bed50707204';
const address = '0xd482cCc8EC97e9cA7a365F2403bf7f228aD149A0';
const token = '0x50B1eF6e0fe05a32F3E63F02f3c0151BD9004C7c';
const addressPath = '/addresses/' + address;

let lastRequestStart = 0;

async function get(label, path, params = {}, chain = sepolia) {
  const delay = 250 - (Date.now() - lastRequestStart);
  if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
  lastRequestStart = Date.now();
  const url = new URL('/' + chain + '/api/v2' + path, apiOrigin);
  for (const [name, value] of Object.entries(params)) {
    if (name.toLowerCase() === 'apikey' || value == null) continue;
    if (!['string', 'number', 'boolean'].includes(typeof value)) {
      throw new Error(label + ': unexpected pagination parameter type');
    }
    url.searchParams.set(name, String(value));
  }
  url.searchParams.set('apikey', key);

  let response;
  try {
    response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  } catch {
    throw new Error(label + ': request failed or timed out');
  }
  if (!response.ok) throw Object.assign(new Error(label + ': HTTP ' + response.status), { status: response.status });
  try {
    return await response.json();
  } catch {
    throw new Error(label + ': invalid JSON response');
  }
}

function transferId(item) {
  const hash = item?.transaction_hash;
  const index = item?.log_index;
  assert.ok(typeof hash === 'string' && /^0x[\da-f]{64}$/i.test(hash),
    'Expected a transfer transaction hash');
  assert.ok((Number.isSafeInteger(index) && index >= 0) ||
    (typeof index === 'string' && /^\d+$/.test(index)), 'Expected a transfer log index');
  return hash.toLowerCase() + ':' + index;
}

try {
  let transaction;
  try {
    transaction = await get('Sepolia transaction', '/transactions/' + hash);
  } catch (error) {
    if (error.status === 401) {
      try {
        await get('Ethereum control request', '/addresses/0xd8da6bf26964af9d7eed9e03e53415d37aa96045/transactions', {}, '1');
        console.error('Ethereum accepted the key; Sepolia rejected the transaction request.');
      } catch (controlError) {
        console.error(controlError.status === 401
          ? 'Both Ethereum and Sepolia rejected authorization. Check that the Pro API key is active in the Blockscout developer portal.'
          : 'The Ethereum control request did not verify authorization.');
      }
    }
    throw error;
  }
  assert.ok(transaction?.hash?.toLowerCase() === hash, 'Expected the requested transaction');
  assert.ok(transaction.fee != null || (transaction.gas_used != null && transaction.gas_price != null),
    'Expected transaction fee or gas fields');

  const overview = await get('address', addressPath);
  assert.ok(overview?.hash?.toLowerCase() === address.toLowerCase(), 'Expected the requested address');
  assert.ok(Object.hasOwn(overview, 'coin_balance'), 'Expected the address balance field');

  const history = await get('address transactions', addressPath + '/transactions');
  assert.ok(Array.isArray(history?.items) && history.items.length > 0, 'Expected address transaction history');

  const transferPath = addressPath + '/token-transfers';
  const transfers = await get('ERC-20 transfers', transferPath, { type: 'ERC-20' });
  assert.ok(Array.isArray(transfers?.items) && transfers.items.length > 0, 'Expected ERC-20 transfers');

  const firstPageIds = new Set(transfers.items.map(transferId));

  const outgoing = await get('outgoing ERC-20 transfers', transferPath, { type: 'ERC-20', filter: 'from' });
  assert.ok(Array.isArray(outgoing?.items) && outgoing.items.length > 0, 'Expected outgoing transfers');
  assert.ok(outgoing.items.every(item => item.from?.hash?.toLowerCase() === address.toLowerCase()),
    'Expected the selected address as the sender of every filtered transfer');

  for (const item of outgoing.items) {
    transferId(item);
    assert.ok(item.token_type === 'ERC-20', 'Expected ERC-20 token type for CSV');
    assert.ok(typeof item.to?.hash === 'string' && /^0x[\da-f]{40}$/i.test(item.to.hash),
      'Expected the transfer recipient for CSV');
    const rawAmount = item.total?.value;
    assert.ok(typeof rawAmount === 'string' && /^\d+$/.test(rawAmount),
      'Expected an exact decimal-string amount for CSV');
  }

  if (transfers.next_page_params) {
    const next = await get('next ERC-20 page', transferPath, { ...transfers.next_page_params, type: 'ERC-20' });
    assert.ok(Array.isArray(next?.items), 'Expected a list on the next page');
    assert.ok(next.items.some(item => !firstPageIds.has(transferId(item))),
      'Expected at least one transfer different from the first page');
    console.log('ERC-20 pagination returned new transfers.');
  } else {
    console.log('ERC-20 pagination unverified: no cursor returned for the sample address.');
  }

  const balancePayload = await get('ERC-20 balances', addressPath + '/token-balances');
  const { balances } = normalizeTokenBalances(balancePayload);
  const sampleBalance = balances.find(item => item.address.toLowerCase() === token.toLowerCase());
  assert.ok(sampleBalance?.amount != null, 'Expected an exact ERC-20 balance for the sample token');
  console.log('Verified an exact ERC-20 balance for the sample token.');

  const metadata = await get('token metadata', '/tokens/' + token);
  assert.ok(metadata?.decimals != null, 'Expected token decimals');
  console.log('Verified Sepolia transaction, fee fields, address, history, outgoing transfers, and token decimals.');
  console.log('Address risk flag field present:', Object.hasOwn(overview, 'is_scam'));
} catch (error) {
  const message = error instanceof Error ? error.message : 'Blockscout check failed.';
  console.error(message.replaceAll(key, '[redacted]'));
  process.exitCode = 1;
}
