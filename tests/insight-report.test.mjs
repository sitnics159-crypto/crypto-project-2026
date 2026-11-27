import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeTransfers } from '../insight-report.mjs';
const a = '0x' + 'a'.repeat(40), b = '0x' + 'b'.repeat(40);
const row = (from,to) => ({from:{hash:from},to:{hash:to}});
test('counts loaded records by direction including self and unknown', () => {
  assert.deepEqual(summarizeTransfers(a,[row(b,a),row(a,b),row(a,a),row(b,b),null]),{loaded:5,incoming:1,outgoing:1,self:1,unknown:2});
});
test('distinguishes missing history from empty history', () => {
  assert.equal(summarizeTransfers(a,null),null);
  assert.deepEqual(summarizeTransfers(a,[]),{loaded:0,incoming:0,outgoing:0,self:0,unknown:0});
  assert.throws(()=>summarizeTransfers('bad',[]),TypeError);
});
