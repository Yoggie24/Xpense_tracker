const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const storage = new Map([['zpi-api-key','zpi_test_only'], ['GOLD_PRICE','2000000']]);
const elements = new Map();
let requests = [], response, failure, renders = 0;
const quote = { source:'pegadaian',metal:'gold',currency:'IDR',date:'2026-09-18',buyPerGram:2396000,sellPerGram:2496000,unitGram:0.01,buyPerUnit:23960 };
const context = vm.createContext({ console, Date, Promise, AbortController, setTimeout, clearTimeout,
    GOLD_PRICE:2000000,
    localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v))},
    document:{addEventListener(){},getElementById(id){if(!elements.has(id))elements.set(id,{});return elements.get(id);}},
    updateRatesDisplay(){},renderAll(){renders++},fmtPocketIDR:n=>'Rp '+n,
    fetch: async (url,options)=>{ requests.push({url,options}); if(failure)throw failure; return response; }
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/js/gold-price.js'),'utf8'),context);
const run = code=>vm.runInContext(code,context);
(async()=>{
    response={ok:true,json:async()=>({project:'finance:pegadaian:gold-price',data:quote})};
    assert.equal(await run('fetchGoldPrice()'),true);
    assert.equal(context.GOLD_PRICE,2396000);
    assert.equal(requests[0].url,'https://api.zpi.web.id/v1/finance:pegadaian/gold-price');
    assert.equal(requests[0].options.headers['x-api-key'],'zpi_test_only');
    assert.equal(requests[0].options.redirect,'error');
    assert.equal(storage.get('GOLD_PRICE'),'2396000');
    assert.equal(JSON.parse(storage.get('PEGADAIAN_GOLD_QUOTE')).buyPerGram,2396000);
    assert.doesNotMatch(storage.get('PEGADAIAN_GOLD_QUOTE'),/zpi_test/);
    storage.set('pegadaian-gold-side','sellPerGram');
    assert.equal(run('initialGoldPrice()'),2496000);
    assert.equal(await run('fetchGoldPrice()'),true);
    assert.equal(context.GOLD_PRICE,2496000);
    assert.match(run('goldPriceCaption()'),/jual.*2026-09-18/);
    for(const status of [401,403,429,500]){
        response={ok:false,status};
        assert.equal(await run('fetchGoldPrice()'),false);
        assert.equal(context.GOLD_PRICE,2496000);
        assert.equal(storage.get('GOLD_PRICE'),'2496000');
    }
    response={ok:true,json:async()=>({data:{...quote,currency:'USD'}})};
    assert.equal(await run('fetchGoldPrice()'),false);
    response={ok:true,json:async()=>({data:{...quote,buyPerGram:0}})};
    assert.equal(await run('fetchGoldPrice()'),false);
    response={ok:true,json:async()=>{throw new SyntaxError('Invalid JSON')}};
    assert.equal(await run('fetchGoldPrice()'),false);
    failure=Object.assign(new Error('timeout'),{name:'AbortError'});
    assert.equal(await run('fetchGoldPrice()'),false);
    assert.match(elements.get('gold-api-status').textContent,/15 detik/);
    failure=null;
    storage.set('zpi-api-key','');
    const before=requests.length;
    assert.equal(await run('fetchGoldPrice()'),false);
    assert.equal(requests.length,before);
    assert.equal(context.GOLD_PRICE,2496000);
    storage.set('zpi-api-key','zpi_test_only');
    response={ok:true,json:async()=>({data:quote})};
    const count=requests.length;
    await Promise.all([run('fetchGoldPrice()'),run('fetchGoldPrice()')]);
    assert.equal(requests.length,count+1,'Concurrent syncs share a single request');
    assert.ok(renders>=3);
    console.log('Pegadaian checks passed: authentication, IDR/gram parsing, buy/sell selection, cache, errors, timeout, request deduplication.');
})().catch(error=>{console.error(error);process.exitCode=1;});
