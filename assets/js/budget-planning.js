// Budget planning and wallet-backed savings transfers.
let monthlyIncomeBase = 12000000;
function getMonthlyIncomeBase(month = getActiveBudgetMonth()) {
    const values = readConfigJSON('monthlyIncomeBases', {});
    const saved = values && typeof values === 'object' ? Number(values[month]) : NaN;
    monthlyIncomeBase = Number.isFinite(saved) && saved > 0 ? saved : 12000000;
    return monthlyIncomeBase;
}
function setMonthlyIncomeBase(amount, month = getActiveBudgetMonth()) {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Base income harus lebih dari nol.');
    const saved = readConfigJSON('monthlyIncomeBases', {});
    const values = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    localStorage.setItem('monthlyIncomeBases', JSON.stringify({ ...values, [month]: amount }));
    monthlyIncomeBase = amount;
}
function allocationPercentage(target, base = getMonthlyIncomeBase()) { return base > 0 ? Math.max(0, Number(target) || 0) / base * 100 : 0; }
function formatAllocationPercent(value) { return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value) + '%'; }
function renderBudgetPlan() {
    const input = document.getElementById('monthly-income-base');
    if (!input) return;
    const base = getMonthlyIncomeBase();
    if (document.activeElement !== input) input.value = base;
    const target = pockets.reduce((sum, p) => p.type === 'budget' ? sum + (Number(p.targetBudget ?? p.target) || 0) : sum, 0);
    const expenseTotal = calculateMonthlyBudgetExpenseTotal(getTransactions(), getActiveBudgetMonth());
    const pct = allocationPercentage(target, base);
    document.getElementById('budget-plan-total').textContent = `Total Terplotting: ${formatAllocationPercent(pct)} dari ${fmtPocketIDR(base)}`;
    document.getElementById('budget-plan-expense').textContent = `Total Expense Budgeting: ${fmtPocketIDR(expenseTotal)}`;
    document.getElementById('budget-plan-note').textContent = `${getActiveBudgetMonth()} · Expense budgeting: ${fmtPocketIDR(expenseTotal)} · Target seluruh kantong: ${fmtPocketIDR(target)} · ${pct > 100 ? 'Melebihi base income' : 'Sisa belum terplotting: ' + fmtPocketIDR(base - target)}`;
}
function budgetExpenseCategories() { return new Set(pockets.filter(p => p.type === 'budget').flatMap(p => p.categories || [])); }
function isMonthlyBudgetExpense(t, activeMonth, categories = budgetExpenseCategories()) {
    const normalized = normalizeTransaction(t);
    return normalized.type === 'expense' && normalized.category !== 'Transfer' && normalized.includeInBudget !== false &&
        categories.has(normalized.category) && transactionMonthKey(normalized.date) === activeMonth && Number.isFinite(Number(normalized.amount));
}
function calculateMonthlyBudgetExpenseByCategory(transactions = getTransactions(), activeMonth = getActiveBudgetMonth()) {
    return transactions.reduce((totals, raw) => {
        const t = normalizeTransaction(raw);
        if (!isMonthlyBudgetExpense(t, activeMonth)) return totals;
        const amount = Math.abs(Number(t.amount)) * (t.currency === 'USD' ? t.exchangeRate : 1);
        totals[t.category] = (totals[t.category] || 0) + amount;
        return totals;
    }, {});
}
function calculateMonthlyBudgetExpenseTotal(transactions = getTransactions(), activeMonth = getActiveBudgetMonth()) {
    return Object.values(calculateMonthlyBudgetExpenseByCategory(transactions, activeMonth)).reduce((sum, amount) => sum + amount, 0);
}
function isSavingsTransfer(t) { return t.category === 'Transfer' && t.subtype === 'saving_allocation' && !!t.savingsPocketId; }
function savingsTransferNet(pocketId, transactions = getTransactions()) {
    return transactions.reduce((sum, raw) => {
        const t = normalizeTransaction(raw);
        if (!isSavingsTransfer(t) || (pocketId && t.savingsPocketId !== pocketId) || !Number.isFinite(Number(t.amount))) return sum;
        return sum + (t.type === 'expense' ? 1 : -1) * Math.abs(Number(t.amount)) * (t.currency === 'USD' ? t.exchangeRate : 1);
    }, 0);
}
function walletBalance(account, currency = getAccountCurrency(account), transactions = getTransactions()) {
    return transactions.reduce((sum, raw) => {
        const t = normalizeTransaction(raw);
        if (t.accountId !== account || (t.currency || 'IDR') !== currency || !Number.isFinite(Number(t.amount))) return sum;
        return sum + (t.type === 'income' ? 1 : -1) * Math.abs(Number(t.amount));
    }, 0);
}
function validateSavingsTransfers(transactions) {
    const ids = new Set(transactions.filter(isSavingsTransfer).map(t => t.savingsPocketId));
    for (const id of ids) {
        if (savingsTransferNet(id, transactions) < -0.01) throw new Error('Alokasi ini sudah ditarik. Hapus transaksi penarikan terkait terlebih dahulu.');
    }
}
let savingsOperationId = null;
function newSavingsOperationId() { return 'saving-' + Date.now() + '-' + Math.random().toString(36).slice(2, 12); }
function previewSavings(pocketId, amountIDR, account, direction = 'add') {
    const pocket = pockets.find(p => p.id === pocketId && p.type === 'saving');
    if (!pocket) throw new Error('Pilih kantong target tabungan.');
    if (!Number.isFinite(amountIDR) || amountIDR <= 0) throw new Error('Nominal harus lebih dari nol.');
    if (!['add', 'sub'].includes(direction)) throw new Error('Jenis alokasi tidak valid.');
    if (!getAccountNames().includes(account) || isInvestmentAccount(account)) throw new Error('Pilih sumber dana bank atau wallet.');
    const currency = getAccountCurrency(account);
    const exchangeRate = currency === 'USD' ? USD_KURS : 1;
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) throw new Error('Kurs USD tidak valid.');
    const amount = amountIDR / exchangeRate;
    const transactions = getTransactions();
    if (direction === 'add' && walletBalance(account, currency, transactions) + 1e-8 < amount) throw new Error('Saldo wallet tidak mencukupi.');
    if (direction === 'sub' && savingsTransferNet(pocketId, transactions) + .001 < amountIDR) {
        throw new Error('Penarikan hanya tersedia untuk saldo yang masuk melalui transfer Menabung. Saldo lama tetap dipertahankan.');
    }
    const derived = derivePockets(transactions).find(p => p.id === pocketId);
    const walletBefore = walletBalance(account, currency, transactions);
    const savingsBefore = derived.balance;
    return { pocket, amount, currency, exchangeRate, walletBefore, savingsBefore,
        walletAfter: walletBefore + (direction === 'add' ? -amount : amount),
        savingsAfter: savingsBefore + (direction === 'add' ? amountIDR : -amountIDR) };
}
function allocateSavings(pocketId, amountIDR, account, direction = 'add', operationId = newSavingsOperationId()) {
    const transactions = getTransactions();
    const existing = transactions.find(t => t.id === operationId);
    if (existing) {
        if (!isSavingsTransfer(existing) || existing.savingsPocketId !== pocketId || existing.accountId !== account ||
            existing.type !== (direction === 'add' ? 'expense' : 'income') ||
            Math.abs(Number(existing.amount) * (existing.currency === 'USD' ? existing.exchangeRate : 1) - amountIDR) > .001) {
            throw new Error('Permintaan transfer sudah digunakan. Buka ulang form untuk transfer baru.');
        }
        return operationId;
    }
    const { pocket, amount, currency, exchangeRate } = previewSavings(pocketId, amountIDR, account, direction);
    const id = operationId;
    transactions.push({ id, date: localDateKey(new Date()), description: `TRANSFER / SAVING ${direction === 'add' ? 'ALLOCATION' : 'WITHDRAWAL'}: ${pocket.name}`,
        type: direction === 'add' ? 'expense' : 'income', category: 'Transfer', subtype: 'saving_allocation', savingsPocketId: pocket.id,
        amount, currency, exchangeRate, accountId: account, paymentMethod: account });
    saveTransactions(transactions);
    return id;
}
function populateSavingsWallets() {
    const select = document.getElementById('pocket-alloc-wallet');
    const previous = select.value;
    select.innerHTML = '<option value="">Pilih bank / wallet...</option>' + getAccountNames().filter(n => !isInvestmentAccount(n)).map(n =>
        `<option value="${escapePocketText(n)}">${escapePocketText(n)} (${getAccountCurrency(n)})</option>`).join('');
    select.value = getAccountNames().includes(previous) && !isInvestmentAccount(previous) ? previous : '';
    updateSavingsWalletHint();
}
function updateSavingsWalletHint() {
    const account = document.getElementById('pocket-alloc-wallet').value;
    const hint = document.getElementById('pocket-alloc-wallet-hint');
    if (!account) { hint.textContent = 'Nominal tabungan dalam IDR; wallet USD dikonversi dengan kurs saat alokasi.'; return; }
    const currency = getAccountCurrency(account);
    hint.textContent = `Saldo: ${fmt(walletBalance(account), currency)}${currency === 'USD' ? ' · 1 USD = ' + fmtPocketIDR(USD_KURS) : ''}`;
}
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('monthly-income-form').addEventListener('submit', event => {
        event.preventDefault();
        try { setMonthlyIncomeBase(Number(document.getElementById('monthly-income-base').value)); renderPockets(); showToast('Base income bulan ini diperbarui', 'success'); }
        catch (error) { showToast(error.message, 'error'); }
    });
    document.getElementById('pocket-alloc-wallet').addEventListener('change', () => { updateSavingsWalletHint(); updateSavingsPreview(); });
    document.getElementById('pocket-alloc-amt').addEventListener('input', updateSavingsPreview);
    document.getElementById('pocket-alloc-amt').addEventListener('blur', () => setTimeout(updateSavingsPreview, 0));
    document.getElementById('budget-reset-btn').addEventListener('click', () => {
        if (!confirm('Reset tampilan budgeting ke bulan berjalan? Transaksi dan histori tidak akan dihapus.')) return;
        selectedBudgetMonth = null;
        document.getElementById('filter-start').value = '';
        document.getElementById('filter-end').value = '';
        renderPockets();
        renderAll();
    });
});

function updateSavingsPreview() {
    const output = document.getElementById('savings-transfer-preview');
    if (!output) return;
    const direction = document.getElementById('pocket-alloc-type').value;
    document.getElementById('pocket-alloc-wallet-label').textContent = direction === 'sub' ? 'Wallet tujuan penarikan' : 'Sumber dana / bank';
    const amount = Number(document.getElementById('pocket-alloc-amt').value);
    const account = document.getElementById('pocket-alloc-wallet').value;
    const button = document.getElementById('pocket-alloc-save');
    button.disabled = true;
    if (!amount || !account) { output.textContent = 'Pilih wallet dan isi nominal untuk melihat pratinjau.'; return; }
    try {
        const result = previewSavings(document.getElementById('pocket-alloc-id').value, amount, account, direction);
        output.innerHTML = `<dl><div><dt>Wallet ${escapePocketText(account)}</dt><dd>${fmt(result.walletBefore, result.currency)} &rarr; <strong>${fmt(result.walletAfter, result.currency)}</strong></dd></div><div><dt>Tabungan terkumpul</dt><dd>${fmtPocketIDR(result.savingsBefore)} &rarr; <strong>${fmtPocketIDR(result.savingsAfter)}</strong></dd></div></dl><p>Total aset tetap. Transfer ini bukan pengeluaran rutin.</p>`;
        button.disabled = !savingsOperationId;
    } catch (error) { output.textContent = error.message; }
}
