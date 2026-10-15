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
run("pockets = [{ id: 'food', type: 'budget', target: 1500000, balance: 1500000, categories: ['Makan'] }]; saveTransactions([])");
run("selectedBudgetMonth = '2026-09'");
const expense = { date: '2026-09-01', id: 'one', type: 'expense', category: 'Makan', amount: 500000, paymentMethod: 'Seabank' };
context.input = [expense];
run('saveTransactions(input); renderPockets()');
assert.equal(pocket().usedAmount, 500000);
assert.equal(pocket().balance, 1000000);
assert.equal(pocket().targetBudget, 1500000);
assert.equal(run("calculateMonthlyBudgetExpenseTotal(getTransactions(), '2026-09')"), 500000);
assert.equal(JSON.parse(storage.get('transactions'))[0].accountId, 'Seabank');
assert.match(elements.get('budget-pockets-grid').innerHTML, /Terpakai Bulan (Ini|Terpilih): Rp 500.000 \/ Rp 1.500.000/);
assert.match(elements.get('budget-pockets-grid').innerHTML, /width: 33\.333/);
assert.match(elements.get('budget-pockets-grid').innerHTML, /<span>Makan<\/span>/);
context.input = [{ ...expense, amount: 2000000 }];
run('saveTransactions(input); saveTransactions(getTransactions()); renderPockets()');
assert.equal(pocket().usedAmount, 2000000);
assert.equal(pocket().balance, 0);
assert.match(elements.get('budget-pockets-grid').innerHTML, /133% Terpakai/);
assert.match(elements.get('budget-pockets-grid').innerHTML, /width: 100%/);
context.input = [{ ...expense, amount: 2000000, includeInBudget: false }];
run('saveTransactions(input); renderPockets()');
assert.equal(pocket().usedAmount, 0);
assert.equal(run("calculateMonthlyBudgetExpenseTotal(getTransactions(), '2026-09')"), 0);
run('saveTransactions([])');
assert.equal(pocket().balance, 1500000);
assert.equal(pocket().usedAmount, 0);
// Legacy migration retains allocations and transaction metadata without guessing categories.
context.input = [{ ...expense, pocketId: 'food' }];
run("pockets = [{id:'food', type:'budget', balance:1000000, target:1500000}]; saveTransactions(input); saveTransactions(getTransactions())");
assert.equal(pocket().allocatedAmount, 1500000);
assert.deepEqual(pocket().categories, []);
assert.equal(pocket().usedAmount, 0);
assert.equal(JSON.parse(storage.get('transactions'))[0].pocketId, 'food');
run("pockets[0].categories = ['Makan']; renderPockets()");
assert.equal(pocket().usedAmount, 500000);
assert.equal(pocket().balance, 1000000);
context.input = [{ ...expense, currency: 'USD', amount: 10, exchangeRate: 16000 }];
run('saveTransactions(input); USD_KURS = 20000; saveTransactions(getTransactions())');
assert.equal(pocket().usedAmount, 160000);
// Changing category mappings immediately reassigns all historical expenses.
run("pockets.push({id:'transport', type:'budget', balance:0, allocatedAmount:0, targetBudget:100000, categories:['Transportasi']});");
context.input = [{ ...expense, category: 'Transportasi', pocketId: 'food', amount: 25000 }];
run('saveTransactions(input)');
assert.equal(pocket().usedAmount, 0);
assert.equal(JSON.parse(storage.get('pockets'))[1].usedAmount, 25000);
run("pockets[1].categories = []; pockets[0].categories = ['Transportasi']; renderPockets()");
assert.equal(pocket().usedAmount, 25000);
assert.equal(JSON.parse(storage.get('pockets'))[1].usedAmount, 0);
assert.equal(run("pocketCategoryConflict(['Transportasi'], 'transport').id"), 'food');
assert.equal(run("pocketCategoryConflict(['Transportasi'], 'food')"), undefined);
context.input = [{ ...expense, category: 'Transfer' }, { ...expense, type: 'income' }, { ...expense, amount: 'invalid' }];
run("pockets[0].categories = ['Transfer', 'Makan']; saveTransactions(input)");
assert.equal(pocket().usedAmount, 0);
// Savings allocation behavior remains compatible.
context.input = [{ ...expense, pocketId: 'saving' }];
run("pockets = [{id:'saving', type:'saving', balance:500000, target:2000000}]; saveTransactions(input); saveTransactions(getTransactions())");
assert.equal(pocket().balance, 500000);
assert.equal(pocket().allocatedAmount, 1000000);
run('saveTransactions([])');
assert.equal(pocket().balance, 1000000);
// Pure helper reads storage by default and counts duplicate mappings only once.
context.input = [expense, { ...expense, amount: 100000, category: 'Jajan' }];
run('saveTransactions(input)');
assert.equal(run("calculatePocketUsage({categories:['Makan','Makan','Jajan']})"), 600000);
assert.equal(run("calculatePocketUsage({categories:[]})"), 0);
storage.set('transactions', '{broken');
assert.equal(run('getTransactions().length'), 0);
assert.equal(storage.get('transactions-invalid-backup'), '{broken');
assert.equal(run("escapePocketText('<img>')"), '&lt;img&gt;');
console.log('Pocket category mapping regression checks passed.');

// Monthly isolation, including year boundaries, invalid dates, and all-time savings.
context.input = [
    { ...expense, date: '2026-09-01', amount: 100 },
    { ...expense, date: '2026-09-30', amount: 200 },
    { ...expense, date: '2026-08-31', amount: 400 },
    { ...expense, date: '2025-09-15', amount: 800 },
    { ...expense, date: '2026-12-31', amount: 1600 },
    { ...expense, date: '2027-01-01', amount: 3200 },
    { ...expense, date: '2026-09-31', amount: 6400 },
    { ...expense, date: '', amount: 12800 },
    { ...expense, date: '2026-09-10', type: 'income', amount: 9999 },
    { ...expense, date: '2026-09-10', category: 'Transfer', amount: 9999 }
];
run("pockets = [{id:'monthly', type:'budget', targetBudget:1000, categories:['Makan'], allocatedAmount:1000}, {id:'saving', type:'saving', target:10000, allocatedAmount:5000}]; saveTransactions(input); renderPockets()");
assert.equal(pocket().usedAmount, 300);
assert.match(elements.get('budget-pockets-grid').innerHTML, /September 2026/);
const savedTransactions = storage.get('transactions');
run("selectedBudgetMonth = '2026-10'; renderPockets()");
assert.equal(pocket().usedAmount, 0);
assert.equal(JSON.parse(storage.get('pockets'))[1].balance, 5000);
run("selectedBudgetMonth = '2025-09'; renderPockets()");
assert.equal(pocket().usedAmount, 800);
run("selectedBudgetMonth = '2026-12'; renderPockets()");
assert.equal(pocket().usedAmount, 1600);
run("selectedBudgetMonth = '2027-01'; renderPockets()");
assert.equal(pocket().usedAmount, 3200);
assert.equal(storage.get('transactions'), savedTransactions);
run("document.getElementById('filter-start').value = '2026-08-15'; document.getElementById('filter-end').value = '2026-09-30'; selectBudgetMonthFromFilters(); renderPockets()");
assert.equal(pocket().usedAmount, 400);
run("document.getElementById('filter-start').value = ''; selectBudgetMonthFromFilters(); renderPockets()");
assert.equal(pocket().usedAmount, 300);
run("document.getElementById('filter-end').value = ''; selectBudgetMonthFromFilters()");
assert.equal(run('getActiveBudgetMonth()'), run('localMonthKey(new Date())'));
assert.equal(run("localDateKey(new Date(2026, 8, 1))"), '2026-09-01');
assert.equal(run("transactionMonthKey('2026-02-30')"), null);
assert.equal(run("transactionMonthKey('2026-09-01T00:00:00Z')"), '2026-09');
// Moving an expense between months, then deleting it, updates usage without compounding.
context.input = [{ ...expense, amount: 750 }];
run("selectedBudgetMonth = '2026-09'; saveTransactions(input)");
assert.equal(pocket().usedAmount, 750);
context.input[0].date = '2026-10-01';
run('saveTransactions(input)');
assert.equal(pocket().usedAmount, 0);
run("selectedBudgetMonth = '2026-10'; renderPockets()");
assert.equal(pocket().usedAmount, 750);
run('saveTransactions([])');
assert.equal(pocket().usedAmount, 0);
console.log('Monthly budget regression checks passed.');

// Semantic budget alerts supplement glow; percentage remains truthful above 100%.
context.input = [{ ...expense, amount: 1100 }];
run("selectedBudgetMonth = '2026-09'; saveTransactions(input); renderPockets()");
assert.match(elements.get('budget-pockets-grid').innerHTML, /data-state="over"/);
assert.match(elements.get('budget-pockets-grid').innerHTML, /Overbudget/);
assert.match(elements.get('budget-pockets-grid').innerHTML, /aria-valuenow="100"/);
assert.match(elements.get('budget-pockets-grid').innerHTML, /aria-valuetext="110% Overbudget"/);
context.input[0].amount = 850;
run('saveTransactions(input); renderPockets()');
assert.match(elements.get('budget-pockets-grid').innerHTML, /data-state="warning"/);
context.input[0].amount = 200;
run('saveTransactions(input); renderPockets()');
assert.match(elements.get('budget-pockets-grid').innerHTML, /data-state="safe"/);
console.log('Pocket visual state checks passed.');
