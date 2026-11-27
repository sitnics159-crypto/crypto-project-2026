import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeTransfers, createReportSnapshot } from '../insight-report.mjs';
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

const snapshotInput = {address:a, transfers:[row(b,a)], filter:'incoming', hasMore:true, loading:false, error:'', generatedAt:'2026-11-27T16:00:00Z'};
test('snapshot preserves filter and pagination scope', () => {
  const report = createReportSnapshot(snapshotInput);
  assert.equal(report.network,'Ethereum Sepolia');
  assert.equal(report.source,'Blockscout');
  assert.equal(report.filter,'incoming');
  assert.equal(report.hasMore,true);
  assert.equal(report.scope,'loaded-token-transfer-records');
  assert.equal(report.generatedAt,'2026-11-27T16:00:00.000Z');
  assert.equal(report.summary.incoming,1);
});
test('snapshot refuses unavailable or unfinished data', () => {
  for (const patch of [{loading:true},{error:'unavailable'},{transfers:null}]) assert.equal(createReportSnapshot({...snapshotInput,...patch}),null);
  for (const patch of [{filter:'bad'},{hasMore:null},{generatedAt:'bad'},{address:'bad'}]) assert.throws(()=>createReportSnapshot({...snapshotInput,...patch}),TypeError);
  assert.equal(createReportSnapshot({...snapshotInput,transfers:[],hasMore:false}).summary.loaded,0);
});
