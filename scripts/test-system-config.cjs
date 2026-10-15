const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function harness(seed = {}) {
    const storage = new Map(Object.entries(seed).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
    const elements = new Map(), ready = [];
    let failWrites = false;
    const element = id => {
        if (!elements.has(id)) elements.set(id, {
            value: '', innerHTML: '', textContent: '', children: [], disabled: false,
            classList: { contains: () => true, toggle() {}, add() {}, remove() {} },
            addEventListener(type, fn) { this['on' + type] = fn; },
            focus() {}, closest() { return { querySelector: () => ({ disabled: false }) }; }
        });
        return elements.get(id);
    };
    const context = vm.createContext({ console, Intl, Date, setTimeout, window: {},
        document: { addEventListener: (event, fn) => ready.push(fn), getElementById: element, querySelector: () => ({ value: 'expense' }) },
        localStorage: {
            getItem: key => storage.get(key) ?? null,
            setItem(key, value) { if (failWrites) throw new Error('Quota exceeded'); storage.set(key, String(value)); }
        }
    });
    for (const file of ['system-config.js', 'budget-planning.js', 'gold-price.js', 'script.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js/', file), 'utf8'), context);
    return { run: code => vm.runInContext(code, context), storage, elements, element, ready, fail: value => { failWrites = value; } };
}
const h = harness({ customCategories: ['Freelance', 'Kopi'], deletedCategories: ['Rokok'],
    transactions: [{ type: 'income', category: 'Freelance', paymentMethod: 'Cash', amount: 100 }] });
const { run, storage, element } = h;
run('getAppConfig()');
assert.equal(run("getAppConfig().expenseCategories.includes('Kopi')"), true);
assert.equal(run("getAppConfig().incomeCategories.includes('Freelance')"), true);
assert.equal(run("getAppConfig().expenseCategories.includes('Rokok')"), false);
assert.equal(run("getAppConfig().expenseCategories.includes('Transfer')"), false);
assert.equal(run("getAccountCurrency('BCA Vallas')"), 'USD');
const originalHistory = storage.get('transactions');
run("changeConfigItem('expenseCategories', 'Makan', true); appConfig = null; getAppConfig()");
assert.equal(run("getAppConfig().expenseCategories.includes('Makan')"), false, 'Deleted defaults must not resurrect');
assert.equal(storage.get('transactions'), originalHistory);
run("changeConfigItem('expenseCategories', '  Makan  ')");
assert.throws(() => run("changeConfigItem('expenseCategories', 'makan')"), /sudah ada/);
assert.throws(() => run("changeConfigItem('expenseCategories', '  ')"), /karakter/);
assert.throws(() => run("changeConfigItem('expenseCategories', 'Transfer')"), /otomatis/);
assert.throws(() => run("changeConfigItem('unknown', 'Test')"), /tidak valid/);
run("changeConfigItem('usdWallets', 'PayPal'); changeConfigItem('investmentAccounts', 'Bibit'); loadSystemConfig('income')");
assert.equal(run("getAccountCurrency('PayPal')"), 'USD');
assert.equal(run("isInvestmentAccount('Bibit')"), true);
assert.match(element('entry-acc-source').innerHTML, /PayPal/);
assert.match(element('entry-acc-target').innerHTML, /Bibit/);
assert.match(element('entry-cat').innerHTML, /Gaji/);
assert.doesNotMatch(element('entry-cat').innerHTML, />Makan</);
assert.throws(() => run("changeConfigItem('idrWallets', 'paypal')"), /sudah dipakai/);
run("changeConfigItem('usdWallets', 'PayPal', true); loadSystemConfig('expense')");
assert.doesNotMatch(element('entry-acc-source').innerHTML, /PayPal/);
assert.equal(run("getAccountCurrency('PayPal')"), 'USD', 'Deleted historical account retains currency');
assert.throws(() => run("changeConfigItem('idrWallets', 'PayPal')"), /Akun lama/);
run("changeConfigItem('usdWallets', 'PayPal'); changeConfigItem('investmentAccounts', 'Bibit', true)");
assert.equal(run("isInvestmentAccount('Bibit')"), true);
run("changeConfigItem('expenseCategories', '<img src=x>'); renderConfigManager(); loadSystemConfig('expense')");
assert.match(element('config-list-expenseCategories').innerHTML, /&lt;img src=x&gt;/);
assert.doesNotMatch(element('config-list-expenseCategories').innerHTML, /<img/);
assert.match(element('entry-cat').innerHTML, /&lt;img src=x&gt;/);
assert.match(element('config-sections').innerHTML, /data-config-key="burnRateExclusions"/);
assert.equal((element('config-sections').innerHTML.match(/<form /g) || []).length, 6);
// Failed storage writes do not mutate memory.
const before = run('JSON.stringify(getAppConfig())');
h.fail(true);
assert.throws(() => run("changeConfigItem('idrWallets', 'New Wallet')"), /Quota/);
assert.equal(run('JSON.stringify(getAppConfig())'), before);
h.fail(false);
// A removal cascades only to burn-rate exclusions, not historical pockets/transactions.
run("changeConfigItem('burnRateExclusions', 'Makan'); pockets = [{id:'budget',type:'budget',target:1000,categories:['Makan'],allocatedAmount:1000}]");
assert.throws(() => run("changeConfigItem('burnRateExclusions', 'Gaji')"), /kategori pengeluaran/);
run("changeConfigItem('expenseCategories', 'Makan', true)");
assert.equal(run("getAppConfig().burnRateExclusions.includes('Makan')"), false);
assert.equal(run("pockets[0].categories[0]"), 'Makan');
// Burn rate uses calendar days, historic USD rate, selected month, and exclusions only here.
run("changeConfigItem('expenseCategories','Makan'); changeConfigItem('burnRateExclusions','Kopi')");
run(`selectedBudgetMonth = '2026-09'; saveTransactions([
 {type:'expense', category:'Makan', amount:180000, date:'2026-09-01'},
 {type:'expense', category:'Kopi', amount:360000, date:'2026-09-01'},
 {type:'expense', category:'Makan', currency:'USD', exchangeRate:16000, amount:10, date:'2026-09-18'},
 {type:'expense', category:'Transfer', amount:999999, date:'2026-09-01'},
 {type:'income', category:'Makan', amount:999999, date:'2026-09-01'},
 {type:'expense', category:'Makan', amount:999999, date:'2025-09-01'},
 {type:'expense', category:'Makan', amount:999999, date:'2026-09-19'}
]);`);
assert.equal(run("calculateDailyBurnRate(getTransactions(), '2026-09', new Date(2026,8,18)).total"), 340000);
assert.equal(run("calculateDailyBurnRate(getTransactions(), '2026-09', new Date(2026,8,18)).days"), 18);
assert.equal(run("calculateDailyBurnRate(getTransactions(), '2026-09', new Date(2026,9,1)).days"), 30);
assert.equal(run("calculateDailyBurnRate(getTransactions(), '2026-10', new Date(2026,8,18)).daily"), 0);
const usage = run('pockets[0].usedAmount');
run("changeConfigItem('burnRateExclusions','Makan'); reconcilePockets()");
assert.equal(run('pockets[0].usedAmount'), usage);
assert.equal(run("calculateDailyBurnRate(getTransactions(), '2026-09', new Date(2026,8,18)).total"), 0);
// Existing empty arrays are intentional and survive reload, malformed payloads are backed up.
const empty = harness({ appConfig: { expenseCategories: [], incomeCategories: [], idrWallets: [], usdWallets: [], investmentAccounts: [], burnRateExclusions: [] } });
assert.equal(empty.run('getAccountNames().length'), 0);
assert.equal(empty.run('getAllCategories().length'), 0);
empty.run("loadSystemConfig('expense')");
assert.match(empty.element('entry-acc-source').innerHTML, /Tambahkan wallet/);
const broken = harness({ appConfig: '{broken' });
broken.run('getAppConfig()');
assert.equal(broken.storage.get('appConfig-invalid-backup'), '{broken');
// Saving from forms uses delegated native submit, so both Enter and + take the same path.
h.ready[0]();
run('renderAll = () => {};');
const input = { value: 'Dana Liburan', focus() {} };
element('config-sections').onsubmit({ preventDefault() {}, target: { closest: () => ({ dataset: { configKey: 'idrWallets' }, querySelector: () => input }) } });
assert.equal(run("getAccountNames().includes('Dana Liburan')"), true);
assert.match(element('entry-acc-source').innerHTML, /Dana Liburan/);
element('config-sections').onclick({ target: { closest: () => ({ dataset: { configRemove: 'idrWallets', name: 'Dana Liburan' } }) } });
assert.equal(run("getAccountNames().includes('Dana Liburan')"), false);
assert.doesNotMatch(element('entry-acc-source').innerHTML, /Dana Liburan/);
console.log('System Config checks passed: migration, chips, dropdown sync, currencies, history preservation, persistence failures, burn rate.');
