const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness(search = '?demo=1') {
    const values = new Map([
        ['transactions', JSON.stringify([{ id: 'private', amount: 999 }])],
        ['gas_webhook_url', 'https://private.example/webhook'],
        ['fintracker-demo:visitor-note', 'old demo data']
    ]);
    const nativeStorage = {
        get length() { return values.size; },
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); },
        key(index) { return [...values.keys()][index] ?? null; },
        clear() { values.clear(); }
    };
    const document = { addEventListener() {} };
    const window = {
        location: { search, href: 'https://example.test/Xpense_tracker/?demo=1' },
        localStorage: nativeStorage
    };
    const context = vm.createContext({ window, document, URL, URLSearchParams, Date });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js/demo-mode.js'), 'utf8'), context);
    return { window, nativeStorage, values };
}

const demo = harness();
assert.equal(demo.window.IS_DEMO_MODE, true);
assert.notEqual(demo.window.localStorage, demo.nativeStorage);
assert.equal(JSON.parse(demo.window.localStorage.getItem('transactions')).length, 11);
assert.equal(demo.window.localStorage.getItem('gas_webhook_url'), null);
assert.equal(demo.nativeStorage.getItem('transactions'), JSON.stringify([{ id: 'private', amount: 999 }]));
assert.equal(demo.nativeStorage.getItem('gas_webhook_url'), 'https://private.example/webhook');
assert.equal(demo.window.localStorage.getItem('visitor-note'), 'old demo data');

demo.window.localStorage.setItem('transactions', 'updated demo only');
assert.equal(demo.window.localStorage.getItem('transactions'), 'updated demo only');
assert.equal(demo.nativeStorage.getItem('transactions'), JSON.stringify([{ id: 'private', amount: 999 }]));
assert.deepEqual(
    Array.from({ length: demo.window.localStorage.length }, (_, index) => demo.window.localStorage.key(index)).sort(),
    ['GOLD_PRICE', 'USD_KURS', 'appConfig', 'monthlyIncomeBases', 'pockets', 'transactions', 'visitor-note'].sort()
);
demo.window.localStorage.clear();
assert.equal(demo.window.localStorage.length, 0);
assert.equal(demo.nativeStorage.getItem('transactions'), JSON.stringify([{ id: 'private', amount: 999 }]));

const normal = harness('');
assert.equal(normal.window.IS_DEMO_MODE, false);
assert.equal(normal.window.localStorage, normal.nativeStorage);
assert.equal(normal.nativeStorage.getItem('transactions'), JSON.stringify([{ id: 'private', amount: 999 }]));

console.log('Demo mode checks passed: sample data isolation, reset scope, and normal mode storage.');
