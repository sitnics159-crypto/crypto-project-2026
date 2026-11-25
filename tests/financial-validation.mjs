import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const context=vm.createContext({latestEthUsdPrice:3000,usdFormat:new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'})});
for(const name of ['parseUnsigned','weiToEth','validTokenDecimals','formatFeeDisplay']){
 const start=script.indexOf('function '+name+'(');
 assert.ok(start>=0,name);
 const end=script.indexOf('\nfunction ',start+1);
 vm.runInContext(script.slice(start,end<0?undefined:end),context);
}
for(const value of [-1,'-1',' ','0x10','1e3',true,[],null,Number.MAX_SAFE_INTEGER+1]){
 assert.throws(()=>context.parseUnsigned(value));
 assert.equal(context.weiToEth(value),'Не удалось определить');
}
for(const [value,expected] of [['0',0],['18',18],[255,255],[256,null],[-1,null],[' ',null],[true,null],[[],null],['0x12',null],['1e2',null],[null,null],['1.5',null]])assert.equal(context.validTokenDecimals(value),expected);
assert.equal(context.parseUnsigned((2n**256n-1n).toString()),2n**256n-1n);
assert.equal(context.weiToEth('1'),'0.000000000000000001 ETH');
assert.equal(context.weiToEth('1000000000000000000'),'1 ETH');
assert.match(context.formatFeeDisplay('1'),/< \$0\.01/);
assert.match(context.formatFeeDisplay('0'),/\$0\.00/);
console.log('Financial regression assertions passed');
