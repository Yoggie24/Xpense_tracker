const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const storage = new Map();
const elements = new Map();
const context = vm.createContext({
    console, Intl, Date, setTimeout,
    window: {},
    document: {
        addEventListener() {},
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, { innerHTML: '', value: '', addEventListener() {} });
            return elements.get(id);
        }
    },
    localStorage: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, String(value))
    }
});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../assets/js/system-config.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../assets/js/budget-planning.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../assets/js/gold-price.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../assets/js/script.js'), 'utf8'), context);
const run = code => vm.runInContext(code, context);
const pocket = () => JSON.parse(storage.get('pockets'))[0];

run("selectedBudgetMonth = '2026-09'; pockets = [{id:'saving',name:'Dana Darurat',type:'saving',target:3000000,allocatedAmount:0,categories:[]}, {id:'budget',type:'budget',target:1900000,allocatedAmount:0,categories:['Makan']}]; saveTransactions([{id:'fund',type:'income',category:'Initial Balance',date:'2026-09-01',amount:5000000,currency:'IDR',paymentMethod:'BCA'}])");
assert.equal(run('getMonthlyIncomeBase()'), 12000000);
assert.equal(run('allocationPercentage(3000000)'), 25);
assert.equal(run('formatAllocationPercent(allocationPercentage(1900000))'), '15,8%');
run('renderPockets()');
assert.match(elements.get('saving-pockets-grid').innerHTML, /25% dari Total Budget/);
assert.match(elements.get('budget-plan-total').textContent, /15,8%/);
run('setMonthlyIncomeBase(6000000); renderPockets()');
assert.equal(run('allocationPercentage(3000000)'), 50);
assert.equal(run("getMonthlyIncomeBase('2026-10')"), 12000000);
assert.equal(run("getMonthlyIncomeBase('2026-09')"), 6000000);
assert.throws(() => run('setMonthlyIncomeBase(0)'), /lebih dari nol/);
run("globalThis.deposit = allocateSavings('saving',1000000,'BCA')");
assert.equal(run("walletBalance('BCA')"), 4000000);
assert.equal(run('pockets[0].balance'), 1000000);
assert.equal(run('pockets[1].usedAmount'), 0);
run('renderPockets()');
assert.match(elements.get('budget-plan-total').textContent, /31,7%/);
assert.equal(run("walletBalance('BCA') + savingsTransferNet(null)"), 5000000);
assert.equal(run("getTransactions().find(t => t.id === deposit).category"), 'Transfer');
assert.match(run("getTransactions().find(t => t.id === deposit).description"), /TRANSFER \/ SAVING ALLOCATION/);
assert.equal(run("calculateDailyBurnRate(getTransactions(), localMonthKey(), new Date()).total"), 0);
run("pockets = readStoredArray('pockets'); reconcilePockets(); reconcilePockets()");
assert.equal(run('pockets[0].balance'), 1000000);
assert.throws(() => run("allocateSavings('saving',5000000,'BCA')"), /tidak mencukupi/);
assert.throws(() => run("allocateSavings('saving',1000,'Gold')"), /wallet/);
assert.throws(() => run("allocateSavings('budget',1000,'BCA')"), /tabungan/);
assert.throws(() => run("allocateSavings('saving',NaN,'BCA')"), /Nominal/);
run("globalThis.withdrawal = allocateSavings('saving',250000,'BCA','sub')");
assert.equal(run("walletBalance('BCA')"), 4250000);
assert.equal(run('pockets[0].balance'), 750000);
const before = storage.get('transactions');
assert.throws(() => run('saveTransactions(getTransactions().filter(t => t.id !== deposit))'), /sudah ditarik/);
assert.equal(storage.get('transactions'), before);
run('saveTransactions(getTransactions().filter(t => t.id !== withdrawal)); saveTransactions(getTransactions().filter(t => t.id !== deposit))');
assert.equal(run("walletBalance('BCA')"), 5000000);
assert.equal(run('pockets[0].balance'), 0);
// Routine expenses debit the wallet and only the matching monthly budget.
run("saveTransactions([...getTransactions(),{id:'meal',type:'expense',category:'Makan',date:'2026-09-10',amount:100000,currency:'IDR',paymentMethod:'BCA'}])");
assert.equal(run("walletBalance('BCA')"), 4900000);
assert.equal(run('pockets[1].usedAmount'), 100000);
assert.equal(run('pockets[0].balance'), 0);
// USD debit uses the captured rate, even after the live rate changes.
run("USD_KURS = 16000; saveTransactions([...getTransactions(),{id:'usd-fund',type:'income',category:'Initial Balance',amount:100,currency:'USD',paymentMethod:'Jenius USD'}]); allocateSavings('saving',160000,'Jenius USD'); USD_KURS = 20000; reconcilePockets()");
assert.equal(run("walletBalance('Jenius USD')"), 90);
assert.equal(run('pockets[0].balance'), 160000);
run("selectedBudgetMonth = '2026-10'; reconcilePockets()");
assert.equal(run('pockets[0].balance'), 160000);
assert.equal(run('pockets[1].usedAmount'), 0);
// Legacy reserves are retained without retroactive bank debits.
run("pockets.push({id:'legacy',name:'Legacy',type:'saving',target:2000000,balance:500000}); reconcilePockets()");
assert.equal(run('pockets[2].balance'), 500000);
assert.throws(() => run("allocateSavings('legacy',1000,'BCA','sub')"), /Saldo lama/);
run("allocateSavings('legacy',250000,'BCA')");
assert.equal(run('pockets[2].balance'), 750000);
assert.equal(run('pockets[2].balance - pockets[2].savingsTransferred'), 500000);
console.log('Budget planning checks passed: monthly base, plotting, wallet debits, withdrawals, deletion, USD, legacy reserves, routine expenses.');
// Preview is read-only and uses the exact same checks/calculations as commit.
run("selectedBudgetMonth = '2026-09'; pockets = [{id:'safe',name:'Safety',type:'saving',target:3000000,allocatedAmount:0,categories:[]}]; saveTransactions([{id:'cash',type:'income',category:'Initial Balance',amount:5000000,currency:'IDR',paymentMethod:'BCA'}])");
const previewBefore = storage.get('transactions');
run('renderPockets()');
assert.match(elements.get('budget-plan-total').textContent, /0%/);
assert.equal(run("previewSavings('safe',1000000,'BCA').walletAfter"),4000000);
assert.equal(run("previewSavings('safe',1000000,'BCA').savingsAfter"),1000000);
assert.equal(storage.get('transactions'),previewBefore);
// Failure of the ledger write is an abort: no changes to memory, wallet or cache.
const pocketBeforeFailure = run('JSON.stringify(pockets)');
const cacheBeforeFailure = storage.get('pockets');
const realSetItem = context.localStorage.setItem;
context.localStorage.setItem = (key,value) => { if(key === 'transactions') throw new Error('Storage full'); realSetItem(key,value); };
assert.throws(()=>run("allocateSavings('safe',1000000,'BCA','add','retry-operation')"),/Storage full/);
assert.equal(storage.get('transactions'),previewBefore);
assert.equal(storage.get('pockets'),cacheBeforeFailure);
assert.equal(run('JSON.stringify(pockets)'),pocketBeforeFailure);
context.localStorage.setItem = realSetItem;
run("allocateSavings('safe',1000000,'BCA','add','retry-operation'); allocateSavings('safe',1000000,'BCA','add','retry-operation')");
assert.equal(run("walletBalance('BCA')"),4000000);
assert.equal(run("getTransactions().filter(t=>t.id==='retry-operation').length"),1);
assert.throws(()=>run("allocateSavings('safe',2000000,'BCA','add','retry-operation')"),/sudah digunakan/);
// Derived cache failure still means success; restart and retry recover from the ledger.
context.localStorage.setItem = (key,value) => { if(key === 'pockets') throw new Error('Cache full'); realSetItem(key,value); };
run("allocateSavings('safe',500000,'BCA','add','cache-failure-operation')");
assert.equal(run('pockets[0].balance'),1500000);
run("pockets=readStoredArray('pockets'); reconcilePockets(); allocateSavings('safe',500000,'BCA','add','cache-failure-operation')");
assert.equal(run('pockets[0].balance'),1500000);
assert.equal(run("walletBalance('BCA')"),3500000);
context.localStorage.setItem = realSetItem;
run('reconcilePockets()');
assert.equal(JSON.parse(storage.get('pockets'))[0].balance,1500000);
// Changing a target must not change balances or ledger entries.
const beforeTarget = storage.get('transactions');
run('pockets[0].targetBudget=6000000; reconcilePockets()');
assert.equal(run('pockets[0].balance'),1500000);
assert.equal(storage.get('transactions'),beforeTarget);
// The modal blocks invalid amounts and previews incoming withdrawals as well.
run("savingsOperationId='ui-operation'; document.getElementById('pocket-alloc-id').value='safe'; document.getElementById('pocket-alloc-wallet').value='BCA'; document.getElementById('pocket-alloc-type').value='sub'; document.getElementById('pocket-alloc-amt').value='250000'; updateSavingsPreview()");
assert.equal(elements.get('pocket-alloc-save').disabled,false);
assert.match(elements.get('savings-transfer-preview').innerHTML,/Total aset tetap/);
run("document.getElementById('pocket-alloc-amt').value='2000000'; updateSavingsPreview()");
assert.equal(elements.get('pocket-alloc-save').disabled,true);
console.log('Savings reliability checks passed: preview, atomic ledger commit, failed-cache recovery, retries, and target-only edits.');
