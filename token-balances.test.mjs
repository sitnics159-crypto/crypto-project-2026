import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTokenBalance, normalizeTokenBalances, fetchTokenBalances } from './token-balances.mjs';
const record = (value, decimals = '18') => ({value, token: {type:'ERC-20', address_hash:'0x'+'a'.repeat(40), symbol:'TEST', decimals}});
test('exact large balance', () => assert.equal(normalizeTokenBalance(record('123456789012345678901234567890')).amount,'123456789012.34567890123456789'));
test('zero balance', () => assert.equal(normalizeTokenBalance(record('0')).amount,'0'));
test('smallest unit', () => assert.equal(normalizeTokenBalance(record('1')).amount,'0.000000000000000001'));
test('zero decimals', () => assert.equal(normalizeTokenBalance(record('42','0')).amount,'42'));
test('missing and malformed values remain unknown', () => { for(const value of [null,undefined,'','-1','1.5',42]) assert.equal(normalizeTokenBalance(record(value)).amount,null); });
test('invalid decimals remain unknown', () => { for(const d of [null,'256','-1','1.5']) assert.equal(normalizeTokenBalance(record('1',d)).amount,null); });
test('invalid contract and non ERC-20 rejected', () => { const r=record('1'); r.token.address_hash='invalid'; assert.equal(normalizeTokenBalance(r),null); r.token.address_hash='0x'+'a'.repeat(40); r.token.type='ERC-721'; assert.equal(normalizeTokenBalance(r),null); });

test('uint256 boundary',()=>{const max=(1n<<256n)-1n;assert.equal(normalizeTokenBalance(record(String(max),'0')).amount,String(max));assert.equal(normalizeTokenBalance(record(String(max+1n),'0')).amount,null);});
test('empty and invalid response',()=>{assert.deepEqual(normalizeTokenBalances([]),{balances:[],incomplete:false});assert.throws(()=>normalizeTokenBalances({items:[]}),TypeError);});
test('duplicates and incomplete records flagged',()=>{const r=normalizeTokenBalances([record('1'),record('2'),null]);assert.equal(r.balances.length,1);assert.equal(r.incomplete,true);});
test('unknown balance flagged',()=>{const r=normalizeTokenBalances([record(null)]);assert.equal(r.balances[0].amount,null);assert.equal(r.incomplete,true);});

test('overflow leaves the balance unknown and preserves token metadata', () => {
  const item = record(String(1n << 256n), '0');
  item.token.name = 'Test token';
  const balance = normalizeTokenBalance(item);
  assert.equal(balance.amount, null);
  assert.equal(balance.symbol, 'TEST');
  assert.equal(balance.name, 'Test token');
});

test('a case-insensitive duplicate can recover an unknown amount', () => {
  const valid = record('42', '0');
  valid.token.address_hash = '0x' + 'A'.repeat(40);
  const result = normalizeTokenBalances([record(null), valid, record('100', '0')]);
  assert.deepEqual(result, { balances: [normalizeTokenBalance(valid)], incomplete: true });
});
test('API request uses Sepolia and omits credentials',async()=>{const address='0x'+'b'.repeat(40),signal=new AbortController().signal;const r=await fetchTokenBalances(address,{signal,fetcher:async(url,options)=>{assert.equal(url,'https://crypto-project-2026.onrender.com/api/sepolia/addresses/'+address+'/token-balances');assert.equal(options.signal,signal);assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');return {ok:true,json:async()=>[record('1')]};}});assert.equal(r.balances.length,1);});
test('API rejects invalid address without request',async()=>{await assert.rejects(fetchTokenBalances('invalid',{fetcher:()=>assert.fail('unexpected request')}),TypeError);});
test('API HTTP failure is not zero balance',async()=>{await assert.rejects(fetchTokenBalances('0x'+'b'.repeat(40),{fetcher:async()=>({ok:false,status:429})}),/429/);});
test('API cancellation propagates',async()=>{const error=new Error('aborted');await assert.rejects(fetchTokenBalances('0x'+'b'.repeat(40),{fetcher:async()=>{throw error;}}),e=>e===error);});
