// Default configuration for the Money Tracker app
const DEFAULT_CONFIG = {
    "categories": [
        "Makan", "Minuman", "Sedekah", "Fashion", "Gold", "Transportasi", "Rokok", "Pindah uang", "Kesehatan", "Social", "Jajan", "Gaji", "Bonus", "Sisa", "Transfer"
    ],
    "paymentMethods": [
        "Shopeepay", "Gopay", "Seabank", "BCA", "Mandiri", "Jenius", "Jenius USD", "BCA Vallas", "Gold", "Stocks", "Cash"
    ]
};

let USD_KURS = parseFloat(localStorage.getItem('USD_KURS')) || 16000;
let GOLD_PRICE = initialGoldPrice();
let masterData = [];
let itemToDelete = null;
let sortState = { k: 'date', o: 'desc' };
let calendarDate = new Date();
let isEditing = false;
let editItem = null;
let pockets = [];
// null follows the current local month; an explicit selection is YYYY-MM.
let selectedBudgetMonth = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('entry-date').valueAsDate = new Date();
    loadSystemConfig();
    pockets = readStoredArray('pockets');
    fetchData();

    // Tab Navigation Logic
    const deskNavBtns = document.querySelectorAll('.desk-nav-btn');
    const mobNavBtns = document.querySelectorAll('.mob-nav-btn');

    function updateTabUI(viewId) {
        const pageTitles = { 'view-dashboard': 'Ringkasan', 'view-add': 'Catat transaksi', 'view-transactions': 'Riwayat transaksi', 'view-pockets': 'Kantong & tujuan', 'view-daily': 'Laporan harian', 'view-calendar': 'Kalender keuangan' };
        document.getElementById('workspace-page-title').textContent = pageTitles[viewId] || 'FinTracker';
        if (viewId === 'view-pockets') renderPockets();
        document.querySelectorAll('.tab-view').forEach(v => v.classList.add('hidden'));
        document.getElementById(viewId).classList.remove('hidden');

        deskNavBtns.forEach(btn => {
            btn.setAttribute('aria-current', btn.dataset.target === viewId ? 'page' : 'false');
            if (btn.dataset.target === viewId) {
                btn.classList.add('desk-nav-active');
                btn.classList.remove('text-slate-400');
            } else {
                btn.classList.remove('desk-nav-active');
                btn.classList.add('text-slate-400');
            }
        });

        mobNavBtns.forEach(btn => {
            btn.setAttribute('aria-current', btn.dataset.target === viewId ? 'page' : 'false');
            if (btn.dataset.target === viewId) {
                btn.classList.add('mob-nav-active');
                btn.classList.remove('text-slate-400');
            } else {
                btn.classList.remove('mob-nav-active');
                btn.classList.add('text-slate-400');
            }
        });
    }

    deskNavBtns.forEach(b => b.addEventListener('click', e => updateTabUI(e.currentTarget.dataset.target)));
    mobNavBtns.forEach(b => b.addEventListener('click', e => updateTabUI(e.currentTarget.dataset.target)));
    window.switchTab = updateTabUI;

    window.applyDatePreset = (type) => {
        const now = new Date();
        selectedBudgetMonth = type === 'lastMonth' ? localMonthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)) : null;
        let start, end;
        if (type === 'thisMonth') { start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth() + 1, 0); }
        else if (type === 'lastMonth') { start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0); }
        else if (type === 'last30') { end = new Date(); start = new Date(); start.setDate(now.getDate() - 30); }
        else if (type === 'thisYear') { start = new Date(now.getFullYear(), 0, 1); end = new Date(now.getFullYear(), 11, 31); }
        else { document.getElementById('filter-start').value = ''; document.getElementById('filter-end').value = ''; renderAll(); document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('preset-active')); return; }
        document.getElementById('filter-start').value = localDateKey(start); document.getElementById('filter-end').value = localDateKey(end); renderAll();
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('preset-active')); if (event) event.target.classList.add('preset-active');
    };

    const typeRadios = document.getElementsByName('entry-type');
    const segmentIndicator = document.getElementById('segment-indicator');

    function updateSegmentIndicator(val) {
        if (val === 'expense') { segmentIndicator.style.transform = 'translateX(0%)'; segmentIndicator.className = "absolute top-1 bottom-1 left-1 rounded-lg shadow-sm transition-all duration-300 ease-[cubic-bezier(0.4,0.0,0.2,1)] border border-rose-500/20 bg-rose-500/10 w-[calc(33.33%-4px)]"; }
        else if (val === 'income') { segmentIndicator.style.transform = 'translateX(100%)'; segmentIndicator.className = "absolute top-1 bottom-1 left-1 rounded-lg shadow-sm transition-all duration-300 ease-[cubic-bezier(0.4,0.0,0.2,1)] border border-emerald-500/20 bg-emerald-500/10 w-[calc(33.33%-4px)]"; }
        else if (val === 'transfer') { segmentIndicator.style.transform = 'translateX(200%)'; segmentIndicator.className = "absolute top-1 bottom-1 left-1 rounded-lg shadow-sm transition-all duration-300 ease-[cubic-bezier(0.4,0.0,0.2,1)] border border-blue-500/20 bg-blue-500/10 w-[calc(33.33%-4px)]"; }
    }

    typeRadios.forEach(r => r.addEventListener('change', () => {
        const val = document.querySelector('input[name="entry-type"]:checked').value;
        updateSegmentIndicator(val);
        updateUIForType(val);
        loadSystemConfig(val);
    }));

    function updateUIForType(val) {
        const tg = document.getElementById('transfer-target-group'), cg = document.getElementById('category-group'), budgetToggle = document.getElementById('budget-inclusion-group'), ls = document.getElementById('lbl-source-acc'), btn = document.getElementById('submit-btn');
        budgetToggle.classList.toggle('hidden', val !== 'expense');
        if (val === 'transfer') {
            tg.classList.remove('hidden'); cg.classList.add('hidden'); ls.innerHTML = '<i class="fas fa-arrow-right mr-1 text-slate-300"></i> FROM / SOURCE';
            btn.innerHTML = `<span>${isEditing ? "Update Transfer" : "Process Transfer"}</span> <i class="fas fa-exchange-alt"></i>`;
            btn.className = "w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold py-4 rounded-2xl shadow-[0_8px_20px_rgba(37,99,235,0.3)] hover:shadow-[0_8px_25px_rgba(37,99,235,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4";
        } else {
            tg.classList.add('hidden'); cg.classList.remove('hidden'); ls.innerHTML = '<i class="fas fa-arrow-right mr-1 text-slate-300"></i> SUMBER DANA / AKUN BANK';
            btn.innerHTML = `<span>${isEditing ? "Update Transaction" : "Save Transaction"}</span> <i class="fas fa-check"></i>`;
            if (val === 'income') btn.className = isEditing ? "w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-4 rounded-2xl shadow-[0_8px_20px_rgba(249,115,22,0.3)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4" : "w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold py-4 rounded-2xl shadow-[0_8px_20px_rgba(16,185,129,0.3)] hover:shadow-[0_8px_25px_rgba(16,185,129,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4";
            else btn.className = isEditing ? "w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-4 rounded-2xl shadow-[0_8px_20px_rgba(249,115,22,0.3)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4" : "w-full bg-gradient-to-r from-rose-500 to-rose-600 text-white font-bold py-4 rounded-2xl shadow-[0_8px_20px_rgba(225,29,72,0.3)] hover:shadow-[0_8px_25px_rgba(225,29,72,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4";
        }
    }
    updateUIForType(document.querySelector('input[name="entry-type"]:checked').value);
    document.getElementById('entry-cat').addEventListener('change', e => document.getElementById('entry-cat-other').classList.toggle('hidden', e.target.value !== 'Other'));

    const updateCurrByAcc = (accElId, currElId) => {
        document.getElementById(accElId).addEventListener('change', e => {
            const val = e.target.value;
            const currSel = document.getElementById(currElId);
            currSel.value = getAccountCurrency(val);
        });
    };
    updateCurrByAcc('entry-acc-source', 'entry-curr-source');
    updateCurrByAcc('entry-acc-target', 'entry-curr-target');

    document.getElementById('add-entry-form').addEventListener('submit', e => {
        e.preventDefault();
        const btn = document.getElementById('submit-btn'); const origTxt = btn.innerHTML; btn.innerHTML = '<div class="loader w-5 h-5 border-2 border-white border-t-transparent"></div>'; btn.disabled = true;
        try {
        const type = document.querySelector('input[name="entry-type"]:checked').value;
        const date = document.getElementById('entry-date').value;
        const desc = document.getElementById('entry-desc').value;

        let txType = type === 'income' ? 'income' : 'expense';
        let cat = document.getElementById('entry-cat').value;
        if (cat === 'Other') {
            cat = document.getElementById('entry-cat-other').value.trim();
            if (cat && type !== 'transfer') {
                const key = type === 'income' ? 'incomeCategories' : 'expenseCategories';
                const existing = getAppConfig()[key].find(c => c.toLowerCase() === cat.toLowerCase());
                if (existing) cat = existing;
                else changeConfigItem(key, cat);
                loadSystemConfig(type);
                document.getElementById('entry-cat').value = cat;
            }
        }
        if (type === 'transfer') cat = 'Transfer';

        const accSource = document.getElementById('entry-acc-source').value;
        const currSource = document.getElementById('entry-curr-source').value;
        const amtSource = Math.abs(parseFloat(document.getElementById('entry-amt-source').value));
        const includeInBudget = type === 'expense' && document.getElementById('entry-include-budget').checked;

        if (!Number.isFinite(amtSource) || amtSource <= 0 || !accSource || !cat) {
            showToast('Nominal, sumber dana, atau kategori tidak valid', 'error');
            btn.innerHTML = origTxt; btn.disabled = false; return;
        }
        let txs = getTransactions();

        if (isEditing) {
            const idx = txs.findIndex(t => t.id == editItem.id);
            if (idx !== -1) {
                // Apply new transaction data
                txs[idx] = {
                    id: editItem.id,
                    date: date,
                    description: desc,
                    category: cat,
                    paymentMethod: accSource, accountId: accSource,
                    type: txType,
                    amount: amtSource,
                    currency: currSource,
                    includeInBudget: type === 'expense' ? includeInBudget : true,
                    exchangeRate: currSource === 'USD' ? USD_KURS : 1
                };

            }
        } else {
            if (type === 'transfer') {
                const accTarget = document.getElementById('entry-acc-target').value;
                const currTarget = document.getElementById('entry-curr-target').value;
                const amtTargetInput = document.getElementById('entry-amt-target').value;

                let amtTarget = amtSource;
                if (amtTargetInput) {
                    amtTarget = Math.abs(parseFloat(amtTargetInput));
                } else {
                    if (currSource === 'USD' && currTarget === 'IDR') {
                        amtTarget = amtSource * USD_KURS;
                    } else if (currSource === 'IDR' && currTarget === 'USD') {
                        amtTarget = amtSource / USD_KURS;
                    }
                }

                if (!accTarget || !Number.isFinite(amtTarget) || amtTarget <= 0) {
                    showToast('Akun tujuan dan nominal transfer harus valid', 'error');
                    return;
                }
                if (accSource === accTarget && currSource === currTarget) {
                    showToast("Source and Target are identical!", 'error');
                    btn.innerHTML = origTxt; btn.disabled = false; return;
                }

                // Create expense from source
                txs.push({ id: Date.now().toString() + "-out", date, description: desc + " (Transfer Out)", category: cat, paymentMethod: accSource, accountId: accSource, type: 'expense', amount: amtSource, currency: currSource });
                // Create income to target
                txs.push({ id: Date.now().toString() + "-in", date, description: desc + " (Transfer In)", category: cat, paymentMethod: accTarget, type: 'income', amount: amtTarget, currency: currTarget });
            } else {
                txs.push({
                    id: Date.now().toString(),
                    date: date,
                    description: desc,
                    category: cat,
                    paymentMethod: accSource, accountId: accSource,
                    type: txType,
                    amount: amtSource,
                    currency: currSource,
                    includeInBudget: type === 'expense' ? includeInBudget : true,
                    exchangeRate: currSource === 'USD' ? USD_KURS : 1
                });
            }
        }

        saveTransactions(txs);
        fetchData();
        showToast("Transaction saved", "success");
        resetForm();
        btn.innerHTML = origTxt; btn.disabled = false;

        // Auto-sync after adding
        syncToSpreadsheet();
        } catch (error) {
            console.error('Transaction save failed', error);
            showToast('Transaksi gagal diproses. Periksa penyimpanan browser.', 'error');
        } finally {
            btn.innerHTML = origTxt; btn.disabled = false;
        }
    });

    document.getElementById('cancel-edit-btn').addEventListener('click', resetForm);

    document.addEventListener('click', e => {
        const btnEdit = e.target.closest('.edit-btn'), btnDel = e.target.closest('.del-btn');

        if (btnDel) {
            itemToDelete = JSON.parse(btnDel.dataset.item);
            document.getElementById('del-item-preview').innerHTML = `<div class="font-bold text-white text-base mb-1">${itemToDelete.desc}</div><div class="${itemToDelete.type === 'income' ? 'text-emerald-400' : 'text-rose-400'} font-mono text-xl font-bold">${fmt(itemToDelete.amt, itemToDelete.curr)}</div><div class="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-3">${itemToDelete.date} • ${escapePocketText(itemToDelete.acc)}</div>`;
            document.getElementById('delete-modal').classList.remove('hidden');
        }

        if (btnEdit) {
            const item = JSON.parse(btnEdit.dataset.item);
            if (item.cat === 'Transfer') { showToast("Please delete and recreate transfer.", 'error'); return; }
            isEditing = true; editItem = item;
            document.getElementById('form-title').innerHTML = '<div class="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400 border border-orange-500/30"><i class="fas fa-pen"></i></div> Edit Entry'; document.getElementById('cancel-edit-btn').classList.remove('hidden');

            updateTabUI('view-add');
            document.querySelector(`input[name="entry-type"][value="${item.type}"]`).checked = true;
            updateSegmentIndicator(item.type);
            updateUIForType(item.type);
            loadSystemConfig(item.type);

            document.getElementById('entry-desc').value = item.desc;
            document.getElementById('entry-date').value = item.date;

            const catSelect = document.getElementById('entry-cat');
            if ([...catSelect.options].map(o => o.value).includes(item.cat)) catSelect.value = item.cat;
            else { catSelect.value = 'Other'; document.getElementById('entry-cat-other').classList.remove('hidden'); document.getElementById('entry-cat-other').value = item.cat; }

            document.getElementById('entry-curr-source').value = item.curr;
            document.getElementById('entry-acc-source').value = item.acc;
            document.getElementById('entry-amt-source').value = item.amt;
            document.getElementById('entry-include-budget').checked = item.includeInBudget !== false;

        }

        // Quick Edit click handler
        const amtEdit = e.target.closest('.inline-amount-edit');
        if (amtEdit) {
            const item = JSON.parse(amtEdit.dataset.item);
            if (item.subtype === 'saving_allocation') { showToast('Untuk mengubah alokasi, hapus lalu buat ulang melalui Menabung.', 'error'); return; }
            document.getElementById('qe-id').value = item.id;
            document.getElementById('qe-desc').textContent = item.desc + ' • ' + item.date;
            document.getElementById('qe-curr').textContent = item.curr;
            document.getElementById('qe-amt').value = item.amt;
            document.getElementById('quick-edit-modal').classList.remove('hidden');
        }

        // Balance Edit click handler
        const balEdit = e.target.closest('.inline-balance-edit');
        if (balEdit) {
            const acc = balEdit.dataset.acc;
            const curr = balEdit.dataset.curr;
            const val = balEdit.dataset.val;

            document.getElementById('adj-acc').value = acc;
            document.getElementById('adj-curr').value = curr;
            document.getElementById('adj-old-amt').value = val;

            document.getElementById('adj-desc').textContent = 'Account: ' + acc;
            document.getElementById('adj-curr-lbl').textContent = curr;
            document.getElementById('adj-amt').value = val;
            document.getElementById('balance-adj-modal').classList.remove('hidden');
        }
    });

    document.getElementById('del-cancel').addEventListener('click', () => document.getElementById('delete-modal').classList.add('hidden'));
    document.getElementById('del-confirm').addEventListener('click', () => {
        let txs = getTransactions();
        txs = txs.filter(t => t.id != itemToDelete.id);
        try { saveTransactions(txs); } catch (error) { showToast(error.message, 'error'); return; }
        document.getElementById('delete-modal').classList.add('hidden');
        showToast("Deleted successfully", 'success');
        fetchData();
        syncToSpreadsheet();
    });

    // Quick Edit logic
    document.getElementById('qe-cancel').addEventListener('click', () => document.getElementById('quick-edit-modal').classList.add('hidden'));
    document.getElementById('qe-save').addEventListener('click', () => {
        const id = document.getElementById('qe-id').value;
        const newAmt = parseFloat(document.getElementById('qe-amt').value);
        if (isNaN(newAmt) || newAmt < 0) {
            showToast("Invalid amount", 'error');
            return;
        }
        let txs = getTransactions();
        const idx = txs.findIndex(t => t.id == id);
        if (idx !== -1) {
            txs[idx].amount = newAmt;
            saveTransactions(txs);
            document.getElementById('quick-edit-modal').classList.add('hidden');
            showToast("Amount updated", 'success');
            fetchData();
            syncToSpreadsheet();
        }
    });

    // Balance Adjustment logic
    document.getElementById('adj-cancel').addEventListener('click', () => document.getElementById('balance-adj-modal').classList.add('hidden'));
    document.getElementById('adj-save').addEventListener('click', () => {
        const acc = document.getElementById('adj-acc').value;
        const curr = document.getElementById('adj-curr').value;
        const oldAmt = parseFloat(document.getElementById('adj-old-amt').value);
        const newAmt = parseFloat(document.getElementById('adj-amt').value);

        if (isNaN(newAmt)) {
            showToast("Invalid amount", 'error');
            return;
        }

        const diff = newAmt - oldAmt;
        if (diff !== 0) {
            let txs = getTransactions();
            const dateStr = document.getElementById('entry-date').value || new Date().toISOString().split('T')[0];

            txs.push({
                id: Date.now().toString(),
                date: dateStr,
                description: 'Balance Adjustment',
                category: 'Initial Balance',
                paymentMethod: acc,
                type: diff > 0 ? 'income' : 'expense',
                amount: Math.abs(diff),
                currency: curr
            });
            saveTransactions(txs);
            showToast("Balance adjusted", 'success');
            fetchData();
            syncToSpreadsheet();
        }
        document.getElementById('balance-adj-modal').classList.add('hidden');
    });

    ['filter-start', 'filter-end', 'filter-cat', 'filter-acc', 'filter-search'].forEach(i => document.getElementById(i).addEventListener('input', () => {
        if (i === 'filter-start' || i === 'filter-end') selectBudgetMonthFromFilters();
        renderAll();
    }));
    const dashPeriodEl = document.getElementById('dashboard-period');
    if (dashPeriodEl) dashPeriodEl.addEventListener('change', () => {
        selectedBudgetMonth = null;
        renderAll();
    });
    document.getElementById('chart-currency-toggle').addEventListener('change', () => {
        const dashPeriod = document.getElementById('dashboard-period') ? document.getElementById('dashboard-period').value : 'month';
        updateChart(filterDataByPeriod(masterData, dashPeriod));
    });
    document.querySelectorAll('.sortable').forEach(s => s.addEventListener('click', e => { sortState.k = e.target.dataset.sort; sortState.o = sortState.o === 'asc' ? 'desc' : 'asc'; renderAll(); }));

    document.getElementById('settings-btn').addEventListener('click', openSystemConfig);
    document.getElementById('settings-close').addEventListener('click', closeSystemConfig);
    document.getElementById('save-settings-btn').addEventListener('click', closeSystemConfig);

    // Add Google sheets listener
    document.getElementById('webhook-url-input').addEventListener('input', (e) => {
        localStorage.setItem('gas_webhook_url', e.target.value.trim());
    });

    document.getElementById('push-data-btn').addEventListener('click', syncToSpreadsheet);
    document.getElementById('pull-data-btn').addEventListener('click', loadFromSpreadsheet);

    // Math Evaluation logic
    document.addEventListener('blur', (e) => {
        if (e.target.classList && e.target.classList.contains('math-input')) {
            const val = e.target.value.trim();
            if (!val) return;
            try {
                const sanitized = val.replace(/[^0-9\.\+\-\*\/\(\)]/g, '');
                if (sanitized) {
                    const result = new Function('return ' + sanitized)();
                    if (!isNaN(result) && isFinite(result)) {
                        e.target.value = result;
                    }
                }
            } catch (err) { }
        }
    }, true);

    // Live Rates Setup
    const syncAllBtn = document.getElementById('syncAll');
    if (syncAllBtn) syncAllBtn.addEventListener('click', syncAllRates);
    updateRatesDisplay();

    // Initial setups
    setTimeout(() => {
        document.getElementById('init-loader').classList.add('hidden');
    }, 500);
});

function getAllCategories() {
    return [...new Set([...getAppConfig().expenseCategories, ...getAppConfig().incomeCategories])].sort();
}

function loadSystemConfig(type = document.querySelector('input[name="entry-type"]:checked')?.value || 'expense') {
    const accounts = getAccountNames();
    const updateSelect = (id, names, placeholder, historical = null) => {
        const select = document.getElementById(id);
        const previous = select.value;
        const values = [...names];
        if (historical && !values.includes(historical)) values.push(historical);
        select.innerHTML = values.length ? values.map(name => `<option value="${escapePocketText(name)}">${escapePocketText(name)}${name === historical && !names.includes(name) ? ' (riwayat)' : ''}</option>`).join('') : `<option value="">${placeholder}</option>`;
        select.value = values.includes(previous) ? previous : values[0] || '';
        return previous !== select.value;
    };
    const sourceChanged = updateSelect('entry-acc-source', accounts, 'Tambahkan wallet di System Config', isEditing ? editItem?.acc : null);
    const targetChanged = updateSelect('entry-acc-target', accounts, 'Tambahkan wallet di System Config');
    if (sourceChanged) document.getElementById('entry-curr-source').value = getAccountCurrency(document.getElementById('entry-acc-source').value);
    if (targetChanged) document.getElementById('entry-curr-target').value = getAccountCurrency(document.getElementById('entry-acc-target').value);
    const historicalCategory = isEditing && editItem?.type === type ? editItem.cat : null;
    updateSelect('entry-cat', [...getTransactionCategories(type), 'Other'], 'Tambahkan kategori', historicalCategory);
    document.getElementById('entry-cat-other').classList.toggle('hidden', document.getElementById('entry-cat').value !== 'Other');
}

// Recover invalid legacy values without discarding the original stored payload.
function readStoredArray(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    try {
        const value = JSON.parse(raw);
        if (Array.isArray(value)) return value.filter(item => item && typeof item === 'object');
    } catch (error) { /* Preserve malformed data for recovery below. */ }
    localStorage.setItem(key + '-invalid-backup', raw);
    return [];
}

function normalizeTransaction(t) {
    const account = String(t.accountId || t.paymentMethod || 'Cash').trim();
    const accountId = getAccountNames().find(a => a.toLowerCase() === account.toLowerCase()) || account;
    return {
        ...t, accountId, paymentMethod: accountId,
        pocketId: t.type === 'expense' && t.category !== 'Transfer' ? t.pocketId || null : null,
        includeInBudget: t.includeInBudget !== false,
        exchangeRate: Number(t.exchangeRate) > 0 ? Number(t.exchangeRate) : (t.currency === 'USD' ? USD_KURS : 1)
    };
}

function getTransactions() {
    return readStoredArray('transactions').map(normalizeTransaction);
}

function localMonthKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function localDateKey(date) {
    return `${localMonthKey(date)}-${String(date.getDate()).padStart(2, '0')}`;
}

// Read calendar dates without UTC conversion (which can shift month boundaries).
function transactionMonthKey(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(String(value || ''));
    if (!match) return null;
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
        ? `${match[1]}-${match[2]}` : null;
}

function selectBudgetMonthFromFilters() {
    const start = document.getElementById('filter-start')?.value;
    const end = document.getElementById('filter-end')?.value;
    selectedBudgetMonth = transactionMonthKey(start) || transactionMonthKey(end);
}

function getActiveBudgetMonth() {
    return selectedBudgetMonth || localMonthKey();
}

// Monthly budgets use the whole selected month, independent of category/search filters.
function calculatePocketUsage(pocket, transactions = getTransactions(), activeMonth = getActiveBudgetMonth()) {
    const categories = new Set(pocket.categories || []);
    return transactions.reduce((total, raw) => {
        const t = normalizeTransaction(raw);
        const amount = Number(t.amount);
        if (t.type !== 'expense' || t.category === 'Transfer' || t.includeInBudget === false ||
            !categories.has(t.category) || !Number.isFinite(amount) ||
            (pocket.type !== 'saving' && transactionMonthKey(t.date) !== activeMonth)) return total;
        return total + Math.abs(amount) * (t.currency === 'USD' ? t.exchangeRate : 1);
    }, 0);
}

function derivePockets(transactions, activeMonth = getActiveBudgetMonth()) {
    return pockets.map(original => {
        const p = { ...original };
        // Preserve the old allocation independently of the new category mapping.
        const legacyUsage = transactions.reduce((sum, raw) => {
            const t = normalizeTransaction(raw);
            return t.type === 'expense' && t.category !== 'Transfer' && t.pocketId === p.id && Number.isFinite(Number(t.amount))
                ? sum + Math.abs(Number(t.amount)) * (t.currency === 'USD' ? t.exchangeRate : 1) : sum;
        }, 0);
        if (!Number.isFinite(p.allocatedAmount)) {
            p.allocatedAmount = Math.max(0, Number(p.balance) || 0) + legacyUsage;
        }
        p.categories = [...new Set((Array.isArray(p.categories) ? p.categories : []).filter(c => typeof c === 'string' && c.trim()))];
        p.type = p.type || 'budget';
        p.target = Math.max(0, Number(p.targetBudget ?? p.target) || 0);
        p.targetBudget = p.target;
        p.usedAmount = p.type === 'budget' ? calculatePocketUsage(p, transactions, activeMonth) : legacyUsage;
        p.savingsTransferred = p.type === 'saving' ? savingsTransferNet(p.id, transactions) : 0;
        p.balance = Math.max(0, p.allocatedAmount - p.usedAmount + p.savingsTransferred);
        return p;
    });
}

// Balances are a derived cache. A cache failure must never turn a committed
// transfer into a failed operation that the user might inadvertently repeat.
function cachePocketBalances() {
    try { localStorage.setItem('pockets', JSON.stringify(pockets)); }
    catch { /* Reload reconstructs balances from the authoritative ledger. */ }
}
function reconcilePockets(transactions = getTransactions(), activeMonth = getActiveBudgetMonth()) {
    pockets = derivePockets(transactions, activeMonth);
    cachePocketBalances();
}

function saveTransactions(transactions) {
    const normalized = transactions.map(normalizeTransaction);
    validateSavingsTransfers(normalized);
    const nextPockets = derivePockets(normalized);
    // One atomic localStorage write is the commit point. No state changes before it.
    const payload = JSON.stringify(normalized);
    if (localStorage.getItem('transactions') !== payload) localStorage.setItem('transactions', payload);
    pockets = nextPockets;
    cachePocketBalances();
}

function getGASUrl() {
    return localStorage.getItem('gas_webhook_url') || "";
}

function resetForm() {
    document.getElementById('add-entry-form').reset(); document.getElementById('entry-date').valueAsDate = new Date();
    isEditing = false; editItem = null; document.getElementById('form-title').innerHTML = '<div class="w-10 h-10 rounded-xl bg-theme-primary/20 flex items-center justify-center text-theme-primaryLight border border-theme-primary/30"><i class="fas fa-plus"></i></div> New Entry'; document.getElementById('cancel-edit-btn').classList.add('hidden');
    document.querySelector('input[name="entry-type"][value="expense"]').checked = true; document.querySelector('input[name="entry-type"][value="expense"]').dispatchEvent(new Event('change'));
    document.getElementById('entry-include-budget').checked = true;
}

function fetchData() {
    let rawTxs = getTransactions();
    saveTransactions(rawTxs);
    let changed = false;
    masterData = [];
    rawTxs.forEach(t => {
        let acc = t.paymentMethod || 'Cash';
        let normalizedAcc = acc.trim();
        const match = getAccountNames().find(m => m.toLowerCase() === normalizedAcc.toLowerCase());
        if (match && match !== acc) {
            t.paymentMethod = match;
            changed = true;
        } else if (normalizedAcc !== acc) {
            t.paymentMethod = normalizedAcc;
            changed = true;
        }

        masterData.push({
            id: t.id,
            type: t.type,
            date: t.date,
            desc: t.description,
            cat: t.category,
            acc: t.accountId,
            accountId: t.accountId,
            curr: t.currency || 'IDR',
            amt: parseFloat(t.amount),
            includeInBudget: t.includeInBudget !== false,
            pocketId: t.pocketId,
            subtype: t.subtype, savingsPocketId: t.savingsPocketId
        });
    });

    if (changed) {
        saveTransactions(rawTxs);
    }

    const cats = [...new Set(masterData.map(d => d.cat))].sort(), accs = [...new Set(masterData.map(d => d.acc))].sort();
    document.getElementById('filter-cat').innerHTML = '<option value="all">All Categories</option>' + cats.map(c => `<option>${escapePocketText(c)}</option>`).join('');
    document.getElementById('filter-acc').innerHTML = '<option value="all">All Accounts</option>' + accs.map(a => `<option>${escapePocketText(a)}</option>`).join('');
    renderPockets();
    renderAll();
}

function fmt(n, c) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: c, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n); }

function showToast(m, type) {
    const t = document.getElementById('toast');
    t.className = `fixed top-5 left-1/2 transform -translate-x-1/2 glass text-white px-6 py-4 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.5)] border z-[90] flex items-center gap-3 min-w-[250px] justify-center transition-all duration-300 translate-y-0 opacity-100 ${type === 'error' ? 'border-rose-500/30 bg-rose-950/80' : 'border-emerald-500/30 bg-emerald-950/80'}`;
    t.innerHTML = `${type === 'error' ? '<div class="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400"><i class="fas fa-exclamation-circle text-lg"></i></div>' : '<div class="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400"><i class="fas fa-check text-lg"></i></div>'} <span class="font-medium text-sm tracking-wide">${m}</span>`;
    t.classList.remove('hidden');
    setTimeout(() => { t.classList.add('translate-y-[-100px]', 'opacity-0'); setTimeout(() => t.classList.add('hidden'), 300); }, 3000);
}

window.toggleCurrency = (id, usdVal) => {
    const el = document.getElementById(id);
    if (el.textContent.includes('$')) { const idrVal = usdVal * USD_KURS; el.textContent = fmt(idrVal, 'IDR'); el.classList.add('text-yellow-400'); } else { el.textContent = fmt(usdVal, 'USD'); el.classList.remove('text-yellow-400'); }
};

function filterDataByPeriod(data, period) {
    if (period === 'all') return data;
    const todayDate = new Date();
    let dashStartDate = null, dashEndDate = null;
    if (period === 'today') {
        dashStartDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
        dashEndDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
    } else if (period === 'month') {
        dashStartDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
        dashEndDate = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0);
    } else if (period === 'week') {
        const dDate = new Date();
        const day = dDate.getDay();
        const diff = dDate.getDate() - day + (day === 0 ? -6 : 1);
        dashStartDate = new Date(dDate.setDate(diff));
        dashStartDate.setHours(0,0,0,0);
        dashEndDate = new Date(dashStartDate);
        dashEndDate.setDate(dashStartDate.getDate() + 6);
    }

    return data.filter(d => {
        const dObj = new Date(d.date);
        dObj.setHours(0,0,0,0);
        return dObj >= dashStartDate && dObj <= dashEndDate;
    });
}

function renderAll() {
    renderPockets();
    renderDailyBurnRate();
    const bals = {}; let incIDR = 0, expIDR = 0, incUSD = 0, expUSD = 0;
    const dashPeriod = document.getElementById('dashboard-period') ? document.getElementById('dashboard-period').value : 'month';
    const dashFilteredData = filterDataByPeriod(masterData, dashPeriod);
    const periodLabel = { today: 'Hari ini', week: 'Minggu ini', month: 'Bulan ini', all: 'Semua waktu' }[dashPeriod] || 'Bulan ini';
    const overviewLabel = document.getElementById('workspace-period-label');
    if (overviewLabel) overviewLabel.textContent = `Arus masuk/keluar: ${periodLabel} ? Saldo & investasi: semua waktu`;
    const recordCount = document.getElementById('workspace-record-count');
    if (recordCount) recordCount.textContent = new Intl.NumberFormat('id-ID').format(masterData.length);
    const pocketCount = document.getElementById('workspace-pocket-count');
    if (pocketCount) pocketCount.textContent = pockets.length;


    const lbl = document.getElementById('top-cat-period-lbl');
    if (lbl) {
        if (dashPeriod === 'today') lbl.textContent = '(Today)';
        else if (dashPeriod === 'week') lbl.textContent = '(This Week)';
        else if (dashPeriod === 'month') lbl.textContent = '(This Month)';
        else lbl.textContent = '(All Time)';
    }

    // Initialize all payment methods to 0 balance
    const defaultKeys = new Set();
    getAccountNames().forEach(method => {
        const curr = getAccountCurrency(method);
        const k = `${method}-${curr}`;
        bals[k] = { n: method, c: curr, v: 0 };
        defaultKeys.add(k);
    });

    // Calculate all-time balances
    masterData.forEach(d => {
        const k = `${d.acc}-${d.curr}`;
        if (!bals[k]) bals[k] = { n: d.acc, c: d.curr, v: 0 };
        if (d.type === 'income') {
            bals[k].v += d.amt;
        } else {
            bals[k].v -= d.amt;
        }
    });

    // Calculate income/expense based on dashboard period
    dashFilteredData.forEach(d => {
        if (d.type === 'income') {
            if (d.cat !== 'Transfer' && d.cat !== 'Initial Balance') { if (d.curr === 'IDR') incIDR += d.amt; else incUSD += d.amt; }
        } else {
            if (d.cat !== 'Transfer') { if (d.curr === 'IDR') expIDR += d.amt; else expUSD += d.amt; }
        }
    });

    const wallets = [];
    const investments = [];

    Object.values(bals).sort((a, b) => a.n.localeCompare(b.n)).forEach((b, idx) => {
        const k = `${b.n}-${b.c}`;
        // Hide 0 balance accounts that are not in default config
        if (b.v === 0 && !defaultKeys.has(k)) return;

        if (isInvestmentAccount(b.n)) {
            investments.push({...b, id: `inv-${idx}`});
        } else {
            wallets.push({...b, id: `bal-${idx}`});
        }
    });

    const renderCard = (b) => {
        const isUSD = b.c === 'USD';
        const isGold = b.n === 'Gold';
        let displayVal = isGold ? `${b.v.toLocaleString('en-US', {minimumFractionDigits:0, maximumFractionDigits:2})} g` : fmt(b.v, b.c);
        let idrEquivalent = 0;

        if (isGold) idrEquivalent = b.v * GOLD_PRICE;
        else if (isUSD) idrEquivalent = b.v * USD_KURS;
        else idrEquivalent = b.v;

        return `
        <div class="flex justify-between items-center bg-slate-950/50 hover:bg-slate-800/50 p-3 rounded-xl border border-slate-800/80 transition group">
            <span class="text-xs text-slate-200 font-bold truncate max-w-[140px]" title="${escapePocketText(b.n)}">${escapePocketText(b.n)}</span>
            <div class="text-right flex flex-col">
                <span id="${b.id}" class="font-bold font-mono text-sm tracking-tighter ${b.v >= 0 ? (isGold || b.n === 'Stocks' ? 'text-yellow-400' : 'text-slate-100') : 'text-rose-400'} cursor-pointer hover:opacity-70 transition inline-balance-edit" data-acc="${escapePocketText(b.n)}" data-curr="${b.c}" data-val="${b.v}">
                    ${displayVal}
                </span>
                ${(isUSD || isGold) ? `<span class="text-[9px] text-slate-400 font-mono mt-0.5">${isGold ? 'Rp ' + fmt(idrEquivalent, 'IDR').replace('IDR','').trim() : 'Rate applied'}</span>` : ''}
            </div>
        </div>
        `;
    };

    document.getElementById('account-balances-container').innerHTML = wallets.map(renderCard).join('');
    const invContainer = document.getElementById('investment-balances-container');
    if (invContainer) {
        invContainer.innerHTML = investments.map(renderCard).join('');
        if (investments.length === 0) invContainer.innerHTML = '<div class="col-span-full text-center text-slate-400 py-4 text-xs italic">No investments yet</div>';
    }

    const totalIncReal = incIDR + (incUSD * USD_KURS);
    const totalExpReal = expIDR + (expUSD * USD_KURS);
    const netCashFlowIDR = totalIncReal - totalExpReal;

    let totalAssetIDR = 0;
    let totalCashIDR = 0;
    let totalInvestIDR = 0;

    Object.values(bals).forEach(b => {
        let valIDR = 0;
        if (b.n === 'Gold') valIDR = (b.v * GOLD_PRICE);
        else if (b.n === 'Stocks') valIDR = b.v; // Assuming Stocks are tracked in IDR directly
        else if (b.c === 'IDR') valIDR = b.v;
        else if (b.c === 'USD') valIDR = (b.v * USD_KURS);

        totalAssetIDR += valIDR;
        if (isInvestmentAccount(b.n)) {
            totalInvestIDR += valIDR;
        } else {
            totalCashIDR += valIDR;
        }
    });

    document.querySelector('#summary-income .stat-value').textContent = fmt(totalIncReal, 'IDR');
    document.querySelector('#summary-expense .stat-value').textContent = fmt(totalExpReal, 'IDR');
    const netEl = document.querySelector('#summary-net .stat-value');
    if (netEl) {
        netEl.textContent = fmt(netCashFlowIDR, 'IDR');
        netEl.className = `stat-value text-[13px] sm:text-base md:text-2xl font-bold truncate z-10 font-mono tracking-tighter ${netCashFlowIDR >= 0 ? 'text-slate-200' : 'text-rose-400'}`;
    }

    const totalPocketsIDR = pockets.reduce((s, p) => s + Math.max(0, p.balance - (p.savingsTransferred || 0)), 0);
    const unallocatedCashIDR = totalCashIDR - totalPocketsIDR;

    const cashEl = document.querySelector('#summary-cash .stat-value');
    if (cashEl) cashEl.textContent = fmt(unallocatedCashIDR, 'IDR');
    const cashLbl = document.querySelector('#summary-cash .text-slate-400');
    if (cashLbl) cashLbl.innerHTML = '<div class="w-5 h-5 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-400"><i class="fas fa-wallet text-[9px]"></i></div> SALDO BEBAS';

    const investEl = document.querySelector('#summary-invest .stat-value');
    if (investEl) investEl.textContent = fmt(totalInvestIDR, 'IDR');

    document.getElementById('rate-display').textContent = `1 USD = ${fmt(USD_KURS, 'IDR').replace('IDR', '').trim()}`;
    const transferredSavings = savingsTransferNet(null);
    document.getElementById('asset-wallet-total').textContent = fmtPocketIDR(totalCashIDR);
    document.getElementById('asset-savings-total').textContent = fmtPocketIDR(transferredSavings);
    document.getElementById('asset-investment-total').textContent = fmtPocketIDR(totalInvestIDR);
    totalAssetIDR += transferredSavings;
    document.getElementById('wealth-display').textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalAssetIDR);

    const s = document.getElementById('filter-search').value.toLowerCase(), start = document.getElementById('filter-start').value, end = document.getElementById('filter-end').value, fCat = document.getElementById('filter-cat').value, fAcc = document.getElementById('filter-acc').value;
    let filtered = masterData.filter(d => {
        if (start && d.date < start) return false; if (end && d.date > end) return false;
        if (fCat !== 'all' && d.cat !== fCat) return false; if (fAcc !== 'all' && d.acc !== fAcc) return false;
        if (s && !d.desc.toLowerCase().includes(s)) return false; return true;
    }).sort((a, b) => sortState.o === 'asc' ? (a[sortState.k] > b[sortState.k] ? 1 : -1) : (a[sortState.k] < b[sortState.k] ? 1 : -1));

    document.getElementById('mobile-trans-list').innerHTML = filtered.map(d => `
    <div class="formal-card p-4 flex justify-between items-center active:scale-[0.98] transition-transform">
        <div class="flex flex-col max-w-[60%] space-y-1.5">
            <span class="text-sm font-bold text-slate-100 truncate">${d.desc}</span>
            <div class="flex flex-wrap items-center gap-2 text-[10px] font-medium text-slate-400">
                <span class="bg-slate-800/50 px-2 py-1 rounded-md border border-slate-800/80">${d.date.slice(5)}</span>
                <span class="bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded-md border border-indigo-500/20 uppercase tracking-wider">${escapePocketText(d.acc)}</span>
            </div>
        </div>
        <div class="flex flex-col items-end gap-2">
            <span class="font-bold font-mono text-sm ${d.type === 'income' ? 'text-emerald-400' : 'text-rose-400'} cursor-pointer hover:opacity-70 transition inline-amount-edit" data-item='${escapePocketText(JSON.stringify(d))}'>${d.type === 'income' ? '+' : '-'} ${fmt(d.amt, d.curr)}</span>
            <div class="flex gap-2">
                <button class="bg-slate-950/50 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/50 border border-slate-800/80 rounded-lg p-1.5 w-8 h-8 flex items-center justify-center transition edit-btn" data-item='${escapePocketText(JSON.stringify(d))}'><i class="fas fa-pen text-xs"></i></button>
                <button class="bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg p-1.5 w-8 h-8 flex items-center justify-center transition del-btn" data-item='${escapePocketText(JSON.stringify(d))}'><i class="fas fa-trash text-xs"></i></button>
            </div>
        </div>
    </div>
`).join('');
    if (filtered.length === 0) document.getElementById('mobile-trans-list').innerHTML = '<div class="text-center text-slate-400 py-10 text-sm italic glass rounded-2xl">No transactions found</div>';

    document.getElementById('data-body').innerHTML = filtered.map(d => `
    <tr class="hover:bg-slate-950/50 transition border-b border-slate-800/80 last:border-0 group">
        <td class="px-6 py-4 text-sm text-slate-400 whitespace-nowrap font-mono">${d.date}</td>
        <td class="px-6 py-4 text-sm text-slate-100 font-medium">${d.desc}</td>
        <td class="px-6 py-4 text-sm"><span class="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-lg text-xs font-medium">${escapePocketText(d.acc)}</span></td>
        <td class="px-6 py-4 text-sm text-slate-400"><span class="bg-slate-800/50 border border-slate-800/80 px-2.5 py-1 rounded-lg text-xs">${escapePocketText(d.cat)}</span></td>
        <td class="px-6 py-4 text-sm text-right font-mono font-bold ${d.type === 'income' ? 'text-emerald-400' : 'text-rose-400'} cursor-pointer hover:opacity-70 transition inline-amount-edit" data-item='${escapePocketText(JSON.stringify(d))}'>${d.type === 'income' ? '+' : '-'} ${fmt(d.amt, d.curr)}</td>
        <td class="px-4 py-4 text-center">
            <div class="flex justify-center gap-2 opacity-100 transition">
                <button aria-label="Edit transaksi" class="w-8 h-8 bg-slate-950/50 border border-slate-800/80 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800/50 transition edit-btn" data-item='${escapePocketText(JSON.stringify(d))}'><i class="fas fa-pen text-xs"></i></button>
                <button aria-label="Hapus transaksi" class="w-8 h-8 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-500 hover:bg-rose-500/20 transition del-btn" data-item='${escapePocketText(JSON.stringify(d))}'><i class="fas fa-trash text-xs"></i></button>
            </div>
        </td>
    </tr>
`).join('');
    if (filtered.length === 0) document.getElementById('data-body').innerHTML = '<tr><td colspan="6" class="text-center py-10 text-slate-400 text-sm italic">No data found</td></tr>';

    renderDaily(masterData); renderCalendar(masterData); updateChart(dashFilteredData); updateTrendChart(masterData); renderDashWidgets(dashFilteredData);
}

function renderDaily(data) {
    const dly = {}; data.filter(d => d.type === 'expense' && d.cat !== 'Transfer').forEach(d => { if (!dly[d.date]) dly[d.date] = { idr: 0, usd: 0 }; if (d.curr === 'IDR') dly[d.date].idr += d.amt; else dly[d.date].usd += d.amt; });
    document.getElementById('daily-body').innerHTML = Object.keys(dly).sort().reverse().map(dt => `<tr class="hover:bg-white/5 transition border-b border-white/5 last:border-0"><td class="px-6 py-4 text-sm text-slate-300 font-medium font-mono">${dt}</td><td class="px-6 py-4 text-sm text-right text-rose-400 font-mono">${dly[dt].idr > 0 ? fmt(dly[dt].idr, 'IDR') : '-'}</td><td class="px-6 py-4 text-sm text-right text-rose-400 font-mono">${dly[dt].usd > 0 ? fmt(dly[dt].usd, 'USD') : '-'}</td></tr>`).join('');
}

function renderCalendar(data) {
    const g = document.getElementById('calendar-grid'); g.innerHTML = ''; const y = calendarDate.getFullYear(), m = calendarDate.getMonth(); document.getElementById('calendar-header').textContent = calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    for (let i = 0; i < new Date(y, m, 1).getDay(); i++) g.appendChild(document.createElement('div'));
    for (let d = 1; d <= new Date(y, m + 1, 0).getDate(); d++) {
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, items = data.filter(i => i.date === dateStr), el = document.createElement('div');
        el.className = "calendar-day bg-black/20 border border-white/5 rounded-2xl p-2 flex flex-col items-center justify-start cursor-pointer relative overflow-hidden group";
        el.innerHTML = `<span class="text-xs text-slate-400 mb-1 font-bold z-10 group-hover:text-white transition">${d}</span>`;
        if (items.length > 0) {
            el.innerHTML += `<div class="flex gap-1.5 mt-auto pb-1 z-10">${items.some(x => x.type === 'income') ? '<div class="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]"></div>' : ''}${items.some(x => x.type === 'expense') ? '<div class="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_5px_rgba(225,29,72,0.8)]"></div>' : ''}</div>`;
            el.onclick = () => {
                document.getElementById('cal-detail-title').textContent = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                document.getElementById('cal-detail-content').innerHTML = items.map(x => `<div class="flex justify-between items-center p-4 bg-black/30 rounded-2xl border border-white/5 mb-2 hover:bg-black/50 transition"><div class="flex items-center gap-3"><div class="w-2 h-2 rounded-full ${x.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}"></div><div><div class="text-sm text-white font-bold">${x.desc}</div><div class="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-bold">${escapePocketText(x.cat)} • ${escapePocketText(x.acc)}</div></div></div><div class="${x.type === 'income' ? 'text-emerald-400' : 'text-rose-400'} font-mono text-sm font-bold bg-white/5 px-2 py-1 rounded-lg cursor-pointer hover:opacity-70 transition inline-amount-edit" data-item='${JSON.stringify(x).replace(/'/g, "&#39;")}'>${fmt(x.amt, x.curr)}</div></div>`).join('');
                document.getElementById('calendar-detail-modal').classList.remove('hidden');
            };
        }
        g.appendChild(el);
    }
}
document.getElementById('prev-month').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(masterData); });
document.getElementById('next-month').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(masterData); });
document.getElementById('cal-close').addEventListener('click', () => document.getElementById('calendar-detail-modal').classList.add('hidden'));

let myChart;
function updateChart(data) {
    const curr = document.getElementById('chart-currency-toggle').value; const exps = data.filter(d => d.type === 'expense' && d.curr === curr && d.cat !== 'Transfer'); const totals = Object.create(null); exps.forEach(d => totals[d.cat] = (totals[d.cat] || 0) + d.amt);
    const ctx = document.getElementById('expense-pie-chart').getContext('2d'); if (myChart) myChart.destroy();
    const chartColors = ['#6366a3', '#8187ad', '#98a2b3', '#64748b', '#475569', '#a5b4c8', '#71717a', '#52525b', '#cbd5e1'];
    myChart = new Chart(ctx, { type: 'doughnut', data: { labels: Object.keys(totals), datasets: [{ data: Object.values(totals), backgroundColor: chartColors, borderWidth: 2, borderColor: '#0B1325', hoverOffset: 6 }] }, options: { plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(11, 19, 37, 0.9)', titleColor: '#fff', bodyColor: '#cbd5e1', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 12, cornerRadius: 12, displayColors: true } }, cutout: '75%', responsive: true, maintainAspectRatio: false } });
    document.getElementById('expense-details').innerHTML = Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([k, v], i) => `<div class="flex justify-between items-center text-xs py-2 border-b border-white/5 last:border-0"><div class="flex items-center gap-2"><div class="w-2.5 h-2.5 rounded-full" style="background-color: ${chartColors[i % chartColors.length]}"></div><span class="text-slate-300 font-medium">${escapePocketText(k)}</span></div><span class="font-mono text-white font-bold bg-white/5 px-2 py-0.5 rounded-md">${fmt(v, curr)}</span></div>`).join('');
}

let trendChart;
function updateTrendChart(data) {
    const ctx = document.getElementById('trend-line-chart').getContext('2d');
    if (trendChart) trendChart.destroy();
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const rawData = data.filter(d => d.type === 'expense' && d.cat !== 'Transfer' && new Date(d.date) >= thirtyDaysAgo);
    const dailyTotals = {}; rawData.forEach(d => { const date = d.date; const amountIDR = d.curr === 'USD' ? d.amt * USD_KURS : d.amt; dailyTotals[date] = (dailyTotals[date] || 0) + amountIDR; });
    const sortedDates = Object.keys(dailyTotals).sort(); const values = sortedDates.map(date => dailyTotals[date]);
    const labels = sortedDates.map(d => { const dateObj = new Date(d); return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); });

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Expenses (IDR)',
                data: values,
                borderColor: '#8187ad',
                backgroundColor: (context) => {
                    const chartCtx = context.chart.ctx;
                    const gradient = chartCtx.createLinearGradient(0, 0, 0, 300);
                    gradient.addColorStop(0, 'rgba(99, 102, 163, 0.15)');
                    gradient.addColorStop(1, 'rgba(79, 70, 229, 0.0)');
                    return gradient;
                },
                borderWidth: 3,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointBackgroundColor: '#4F46E5',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: 'rgba(11, 19, 37, 0.9)', titleColor: '#fff', bodyColor: '#cbd5e1', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 12, cornerRadius: 12 }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10, family: "'Inter', sans-serif" } } },
                y: { border: { display: false }, grid: { color: 'rgba(255,255,255,0.05)', borderDash: [4, 4] }, ticks: { color: '#94a3b8', font: { size: 10, family: "'JetBrains Mono', monospace" }, callback: function (value) { return value >= 1000000 ? (value / 1000000).toFixed(1) + 'M' : (value / 1000).toFixed(0) + 'k'; } } }
            }
        }
    });
}

function renderDashWidgets(data) {
    const sortedData = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
    const recent = sortedData.slice(0, 5);
    document.getElementById('dash-recent-list').innerHTML = recent.map(d => `
    <div class="bg-slate-950/50 p-3 rounded-2xl flex justify-between items-center border border-slate-800/80 hover:border-slate-800/80 transition">
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm ${d.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}">
                <i class="fas ${d.type === 'income' ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
            </div>
            <div>
                <div class="text-sm font-bold text-slate-100 truncate max-w-[150px] sm:max-w-[200px]">${d.desc}</div>
                <div class="text-[10px] text-slate-400 uppercase tracking-wider font-bold mt-0.5">${d.date} • ${escapePocketText(d.cat)}</div>
            </div>
        </div>
        <div class="font-mono text-sm font-bold ${d.type === 'income' ? 'text-emerald-400' : 'text-rose-400'} cursor-pointer hover:opacity-70 transition inline-amount-edit" data-item='${escapePocketText(JSON.stringify(d))}'>
            ${d.type === 'income' ? '+' : '-'} ${fmt(d.amt, d.curr)}
        </div>
    </div>
`).join('');
    if (recent.length === 0) document.getElementById('dash-recent-list').innerHTML = '<div class="text-center text-slate-400 py-4 text-xs italic">No activity yet</div>';

    const periodExps = data.filter(d => d.type === 'expense' && d.cat !== 'Transfer');

    let totalPeriod = 0;
    const catTotals = Object.create(null);
    periodExps.forEach(d => {
        const amtIDR = d.curr === 'USD' ? d.amt * USD_KURS : d.amt;
        catTotals[d.cat] = (catTotals[d.cat] || 0) + amtIDR;
        totalPeriod += amtIDR;
    });

    const topCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    const chartColors = ['#6366a3', '#8187ad', '#98a2b3', '#64748b', '#475569'];

    document.getElementById('dash-top-cat-list').innerHTML = topCats.map((c, i) => {
        const percentage = totalPeriod > 0 ? (c[1] / totalPeriod) * 100 : 0;
        return `
    <div class="space-y-1.5">
        <div class="flex justify-between items-end">
            <span class="text-xs font-bold text-slate-200">${escapePocketText(c[0])} <span class="text-[10px] text-slate-400 ml-1">(${percentage.toFixed(1)}%)</span></span>
            <span class="font-mono text-xs text-slate-100 bg-slate-800/50 px-2 py-0.5 rounded-md border border-slate-800/80">${fmt(c[1], 'IDR')}</span>
        </div>
        <div class="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden border border-slate-300">
            <div class="h-full rounded-full" style="width: ${percentage}%; background-color: ${chartColors[i % chartColors.length]}; box-shadow: 0 0 10px ${chartColors[i % chartColors.length]}80;"></div>
        </div>
    </div>`;
    }).join('');
    if (topCats.length === 0) document.getElementById('dash-top-cat-list').innerHTML = '<div class="text-center text-slate-400 py-4 text-xs italic">No expenses in this period</div>';
}

// ---------------- Google Sheets Sync Logic ----------------

async function syncToSpreadsheet() {
    const webhookUrl = getGASUrl();
    const status = document.getElementById('spreadsheet-status');

    if (!webhookUrl) {
        if(status) status.innerHTML = "<span class='text-rose-400'>Webhook URL empty. Please set in settings.</span>";
        return;
    }

    if (status) {
        status.innerHTML = '<div class="loader w-4 h-4 border-2 border-slate-500 border-t-white mx-auto inline-block align-middle mr-2"></div><span class="align-middle">Sending to Spreadsheet...</span>';
        status.style.color = 'var(--text-muted)';
    }

    const transactions = getTransactions();

    try {
        const payload = JSON.stringify({
            transactions: transactions,
            action: 'push'
        });

        // Use no-cors mode to completely bypass strict browser CORS policies on POST redirects
        await fetch(webhookUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'data=' + encodeURIComponent(payload)
        });

        if (status) {
            status.textContent = `✅ Synced to Spreadsheet at ${new Date().toLocaleTimeString()}`;
            status.style.color = '#10b981';
        }

    } catch (err) {
        console.error("Spreadsheet Sync Error:", err);
        if (status) {
            status.textContent = `❌ Sync failed: ${err.message}`;
            status.style.color = '#ef4444';
        }
    }
}

async function loadFromSpreadsheet() {
    const webhookUrl = getGASUrl();
    const status = document.getElementById('spreadsheet-status');

    if (!webhookUrl) {
        alert("Please configure your Google Apps Script Webhook URL first in Settings.");
        return;
    }

    const confirmed = confirm("WARNING: This will overwrite your current local data with the data from Google Sheets. Are you sure you want to proceed?");
    if (!confirmed) return;

    if (status) {
        status.innerHTML = '<div class="loader w-4 h-4 border-2 border-slate-500 border-t-white mx-auto inline-block align-middle mr-2"></div><span class="align-middle">Downloading from Spreadsheet...</span>';
    }

    try {
        const pullUrl = webhookUrl + "?action=pull";
        const resp = await fetch(pullUrl);
        const result = await resp.json();

        if (result.status === 'success') {
            const newTxs = result.transactions || [];
            saveTransactions(newTxs);
            fetchData();

            if (status) {
                status.textContent = `✅ Loaded ${newTxs.length} transactions from Spreadsheet`;
                status.style.color = '#10b981';
            }
            showToast("Successfully loaded from Google Sheets", "success");
        } else {
            throw new Error(result.message || "Unknown error during pull");
        }

    } catch (err) {
        console.error("Pull from Spreadsheet Error:", err);
        if (status) {
            status.textContent = `❌ Load failed: ${err.message}`;
            status.style.color = '#ef4444';
        }
        alert("Gagal menarik data: " + err.message);
    }
}

// ---------------- Rates and Gold Sync Logic ----------------
function updateRatesDisplay() {
    const display = document.getElementById('currentRatesDisplay');
    if (!display) return;

    display.innerHTML = `
        <div class="flex flex-col items-end">
            <span class="text-[10px] text-slate-400 font-bold uppercase mb-0.5">💵 USD Kurs</span>
            <span class="text-emerald-400 font-bold">${fmt(USD_KURS, 'IDR').replace('IDR', '').trim()}</span>
        </div>
        <div class="flex flex-col items-end ml-2">
            <span class="text-[10px] text-slate-400 font-bold uppercase mb-0.5">🥇 ${escapePocketText(goldPriceCaption())}</span>
            <span class="text-yellow-400 font-bold">${fmt(GOLD_PRICE, 'IDR').replace('IDR', '').trim()}</span>
        </div>
    `;
}

async function fetchKurs() {
    const syncStatus = document.getElementById('syncStatus');
    if (syncStatus) syncStatus.innerHTML = '<div class="loader w-3 h-3 border-2 border-slate-500 border-t-white mx-auto inline-block align-middle mr-2"></div> Fetching USD...';
    try {
        const resp = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await resp.json();
        if (data && data.rates && data.rates.IDR) {
            USD_KURS = data.rates.IDR;
            localStorage.setItem('USD_KURS', USD_KURS);
            updateRatesDisplay();
            renderAll();
            if (syncStatus) syncStatus.innerHTML = `<span class="text-emerald-400">✅ USD: ${fmt(USD_KURS, 'IDR').replace('IDR', '').trim()}</span>`;
            showToast("USD Kurs updated!", "success");
            return true;
        }
    } catch (e) {
        console.error("Kurs Sync Error:", e);
    }
    if (syncStatus) syncStatus.innerHTML = `<span class="text-rose-400">❌ Failed USD</span>`;
    return false;
}

async function syncAllRates() {
    const syncStatus = document.getElementById('syncStatus');
    if (syncStatus) syncStatus.innerHTML = '<div class="loader w-3 h-3 border-2 border-slate-500 border-t-white mx-auto inline-block align-middle mr-2"></div> Syncing Rates...';

    // Pegadaian returns IDR directly, so it does not depend on USD synchronization.
    const [kursOk, goldOk] = await Promise.all([fetchKurs(), fetchGoldPrice()]);
    if (syncStatus) syncStatus.textContent = kursOk && goldOk
        ? `Kurs dan harga Pegadaian diperbarui (${new Date().toLocaleTimeString()})`
        : `Sinkronisasi: USD ${kursOk ? 'berhasil' : 'gagal'}, Pegadaian ${goldOk ? 'berhasil' : 'belum berhasil; periksa System Config'}. Harga terakhir tetap tersedia.`;

}
// -------------------------------------------------------------
// CATEGORY MANAGEMENT
// -------------------------------------------------------------

// The transaction form's Manage shortcut opens the same source of truth.
function openCategoryManager() { openSystemConfig(); }

// -------------------------------------------------------------
// POCKETS (KANTONG) MANAGEMENT
// -------------------------------------------------------------
function renderPockets() {
    const activeMonth = getActiveBudgetMonth();
    reconcilePockets(getTransactions(), activeMonth);
    renderBudgetPlan();
    const [year, month] = activeMonth.split('-').map(Number);
    const monthLabel = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
    const usageLabel = activeMonth === localMonthKey() ? 'Terpakai Bulan Ini' : 'Terpakai Bulan Terpilih';
    const sGrid = document.getElementById('saving-pockets-grid');
    const bGrid = document.getElementById('budget-pockets-grid');
    if(!sGrid || !bGrid) return;

    let sHTML = '', bHTML = '';
    const budgetExpenseByCategory = calculateMonthlyBudgetExpenseByCategory(getTransactions(), activeMonth);

    pockets.forEach(p => {
        const progress = p.type === 'budget' ? p.usedAmount : p.balance;
        const pct = p.target > 0 ? (progress / p.target) * 100 : 0;

        const state = p.type === 'saving' ? 'saving' : (pct > 100 ? 'over' : pct >= 80 ? 'warning' : 'safe');
        const status = { saving: pct >= 100 ? 'Target tercapai' : 'Sedang terkumpul', over: 'Overbudget', warning: 'Mendekati limit', safe: 'Budget aman' }[state];
        const card = `
        <div class="formal-card pocket-card p-5 transition relative group" data-state="${state}">
            <div class="pocket-actions absolute top-3 right-3 flex gap-2 opacity-100 transition">
                <button aria-label="Edit kantong" onclick="editPocket('${p.id}')" class="w-6 h-6 bg-slate-950/50 text-slate-400 hover:text-indigo-400 rounded-md flex items-center justify-center border border-slate-800/80"><i class="fas fa-pen text-[10px]"></i></button>
                <button aria-label="Hapus kantong" onclick="deletePocket('${p.id}')" class="w-6 h-6 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 rounded-md flex items-center justify-center border border-rose-500/20"><i class="fas fa-trash text-[10px]"></i></button>
            </div>
            <div class="flex items-center gap-3 mb-3 pr-20">
                <div class="w-10 h-10 rounded-xl bg-slate-950/50 border border-slate-800/80 flex items-center justify-center text-xl shadow-sm">
                    ${p.icon || '💰'}
                </div>
                <div>
                    <h4 class="text-sm font-bold text-slate-100">${escapePocketText(p.name)}</h4>
                    ${p.type === 'budget' ? `<p class="text-[10px] text-slate-400">Budget Bulanan ? ${monthLabel}</p>` : ''}
                    <p class="text-[10px] text-slate-400">${p.type === 'budget' ? `${usageLabel}: ${fmtPocketIDR(p.usedAmount)} / ${fmtPocketIDR(p.target)}` : `Terkumpul ${fmtPocketIDR(p.balance)} / Target ${fmtPocketIDR(p.target)}`}</p>
                </div>
            </div>

            ${p.type === 'budget' ? `<div class="pocket-category-tags">${p.categories.length ? p.categories.map(c => `<span>${escapePocketText(c)}</span>`).join('') : '<span>Belum ada kategori terhubung. Edit kantong untuk memilih.</span>'}</div><div class="pocket-expense-breakdown">${p.categories.length ? p.categories.map(c => `<div><span>${escapePocketText(c)}</span><strong>${fmtPocketIDR(budgetExpenseByCategory[c] || 0)}</strong></div>`).join('') : ''}</div>` : ''}
            ${p.type === 'saving' ? `<p class="savings-source-note">Dana dari wallet: ${fmtPocketIDR(p.savingsTransferred)}${p.balance - p.savingsTransferred > 0 ? `<br>Saldo lama (legacy): ${fmtPocketIDR(p.balance - p.savingsTransferred)}<br>Belum terhubung ke sumber dana; tidak dapat ditarik otomatis.` : ''}</p>` : ''}
            <p class="pocket-allocation">${fmtPocketIDR(p.target)} &bull; <strong>${formatAllocationPercent(allocationPercentage(p.target))} dari Total Budget</strong></p>
            <div class="pocket-status"><span class="status-dot" aria-hidden="true"></span>${status}</div>
            <div class="pocket-progress-bar mb-2" role="progressbar" aria-label="${escapePocketText(p.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, Math.max(0, pct)).toFixed(0)}" aria-valuetext="${pct.toFixed(0)}% ${status}">
                <div class="pocket-progress-fill ${p.type === 'saving' ? 'bg-emerald-500' : 'bg-orange-500'}" style="width: ${Math.min(100, Math.max(0, pct))}%"></div>
            </div>

            <div class="flex justify-between items-center text-[10px] font-bold mt-3">
                <span class="${p.type === 'saving' ? 'text-emerald-400' : 'text-orange-400'}">${pct.toFixed(0)}% ${p.type === 'budget' ? 'Terpakai' : 'Terkumpul'}</span>
                ${p.type === 'saving' ? `<button onclick="openAllocateModal('${p.id}')" class="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-3 py-1.5 rounded-lg transition border border-indigo-500/20 shadow-sm">Menabung <i class="fas fa-plus text-[8px] ml-1"></i></button>` : ''}
            </div>
        </div>`;

        if (p.type === 'saving') sHTML += card;
        else bHTML += card;
    });

    sGrid.innerHTML = sHTML || '<div class="col-span-full text-center text-slate-400 text-xs py-4 border border-dashed border-slate-800/80 rounded-xl">Belum ada target tabungan.</div>';
    bGrid.innerHTML = bHTML || '<div class="col-span-full text-center text-slate-400 text-xs py-4 border border-dashed border-slate-800/80 rounded-xl">Belum ada budget bulanan.</div>';
}

function fmtPocketIDR(amount) {
    return 'Rp ' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(amount);
}

function escapePocketText(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function pocketCategoryConflict(categories, id) {
    return pockets.find(p => p.id !== id && p.type === 'budget' &&
        categories.some(c => (p.categories || []).includes(c)));
}

function renderPocketCategories(selected = []) {
    const id = document.getElementById('pocket-id').value;
    const categories = [...new Set([...getAppConfig().expenseCategories, ...getTransactions().filter(t => t.type === 'expense').map(t => t.category), ...selected])]
        .filter(c => typeof c === 'string' && c && c !== 'Transfer').sort();
    document.getElementById('pocket-categories').innerHTML = categories.map(c => {
        const owner = pocketCategoryConflict([c], id);
        return `<label class="pocket-category-option"><input type="checkbox" value="${escapePocketText(c)}" ${selected.includes(c) ? 'checked' : ''} ${owner ? 'disabled' : ''}><span>${escapePocketText(c)}${owner ? `<small>Dipakai: ${escapePocketText(owner.name)}</small>` : ''}</span></label>`;
    }).join('');
    togglePocketCategories();
}

function togglePocketCategories() {
    document.getElementById('pocket-categories-group').classList.toggle('hidden',
        document.querySelector('input[name="pocket-type"]:checked').value !== 'budget');
}

window.editPocket = (id) => {
    const p = pockets.find(x => x.id === id);
    if(!p) return;
    document.getElementById('pocket-id').value = p.id;
    document.getElementById('pocket-name').value = p.name;
    document.getElementById('pocket-target').value = p.target;
    document.getElementById('pocket-icon').value = p.icon || '';
    document.querySelector(`input[name="pocket-type"][value="${p.type}"]`).checked = true;
    renderPocketCategories(p.categories);
    document.getElementById('pocket-modal-title').innerText = 'Edit Kantong';
    document.getElementById('pocket-modal').classList.remove('hidden');
};

window.deletePocket = (id) => {
    if (savingsTransferNet(id) > .001) { showToast('Tarik saldo tabungan ke wallet sebelum menghapus kantong.', 'error'); return; }
    if(confirm('Hapus kantong ini? Riwayat transaksi tetap disimpan.')) {
        pockets = pockets.filter(x => x.id !== id);
        localStorage.setItem('pockets', JSON.stringify(pockets));
        renderPockets();
        renderAll();
    }
};

window.openAllocateModal = (id) => {
    if (!pockets.some(p => p.id === id && p.type === 'saving')) return;
    savingsOperationId = newSavingsOperationId();
    document.getElementById('pocket-alloc-save').disabled = false;
    document.getElementById('pocket-alloc-id').value = id;
    document.getElementById('pocket-alloc-amt').value = '';
    document.getElementById('pocket-alloc-type').value = 'add';
    document.getElementById('btn-alloc-add').className = 'flex-1 py-1.5 text-xs font-bold rounded-md bg-slate-900/60 text-emerald-400 shadow-sm';
    document.getElementById('btn-alloc-sub').className = 'flex-1 py-1.5 text-xs font-bold rounded-md text-slate-400 hover:text-slate-200';
    populateSavingsWallets();
    updateSavingsPreview();
    document.getElementById('pocket-allocate-modal').classList.remove('hidden');
};

document.addEventListener('DOMContentLoaded', () => {
    const btnAddPocket = document.getElementById('add-pocket-btn');
    if(btnAddPocket) btnAddPocket.addEventListener('click', () => {
        document.getElementById('pocket-id').value = '';
        document.getElementById('pocket-name').value = '';
        document.getElementById('pocket-target').value = '';
        document.getElementById('pocket-icon').value = '';
        document.querySelector('input[name="pocket-type"][value="budget"]').checked = true;
        renderPocketCategories();
        document.getElementById('pocket-modal-title').innerText = 'Tambah Kantong';
        document.getElementById('pocket-modal').classList.remove('hidden');
    });

    document.querySelectorAll('input[name="pocket-type"]').forEach(r => r.addEventListener('change', togglePocketCategories));
    const pocketCancel = document.getElementById('pocket-cancel');
    if(pocketCancel) pocketCancel.addEventListener('click', () => document.getElementById('pocket-modal').classList.add('hidden'));

    const pocketSave = document.getElementById('pocket-save');
    if(pocketSave) pocketSave.addEventListener('click', () => {
        const id = document.getElementById('pocket-id').value;
        const name = document.getElementById('pocket-name').value.trim();
        const type = document.querySelector('input[name="pocket-type"]:checked').value;
        const target = parseFloat(document.getElementById('pocket-target').value) || 0;
        const icon = document.getElementById('pocket-icon').value.trim();

        if(!name) { showToast('Nama kantong harus diisi', 'error'); return; }
        if (!Number.isFinite(target) || target <= 0) { showToast('Target budget harus lebih dari nol', 'error'); return; }
        const categories = type === 'budget' ? Array.from(document.querySelectorAll('#pocket-categories input:checked'), el => el.value) : [];
        if (id && type !== 'saving' && savingsTransferNet(id) > .001) { showToast('Tarik dana tabungan sebelum mengubah tipe kantong.', 'error'); return; }
        const conflict = pocketCategoryConflict(categories, id);
        if (conflict) { showToast('Kategori sudah dipakai di kantong ' + conflict.name, 'error'); return; }

        if(id) {
            const idx = pockets.findIndex(p => p.id === id);
            if(idx !== -1) {
                pockets[idx].name = name;
                pockets[idx].type = type;
                pockets[idx].target = target;
                pockets[idx].targetBudget = target;
                pockets[idx].categories = categories;
                pockets[idx].icon = icon;
            }
        } else {
            pockets.push({
                id: 'pkt-' + Date.now(),
                name, type, target, targetBudget: target, categories, icon, balance: 0, allocatedAmount: 0, usedAmount: 0
            });
        }

        localStorage.setItem('pockets', JSON.stringify(pockets));
        document.getElementById('pocket-modal').classList.add('hidden');
        renderPockets();
        renderAll();
        showToast('Kantong berhasil disimpan', 'success');
    });

    const allocAdd = document.getElementById('btn-alloc-add');
    const allocSub = document.getElementById('btn-alloc-sub');
    if(allocAdd) allocAdd.addEventListener('click', () => {
        document.getElementById('pocket-alloc-type').value = 'add';
        updateSavingsPreview();
        allocAdd.className = 'flex-1 py-1.5 text-xs font-bold rounded-md bg-slate-900/60 text-emerald-400 shadow-sm';
        allocSub.className = 'flex-1 py-1.5 text-xs font-bold rounded-md text-slate-400 hover:text-slate-200';
    });
    if(allocSub) allocSub.addEventListener('click', () => {
        document.getElementById('pocket-alloc-type').value = 'sub';
        updateSavingsPreview();
        allocSub.className = 'flex-1 py-1.5 text-xs font-bold rounded-md bg-slate-900/60 text-rose-400 shadow-sm';
        allocAdd.className = 'flex-1 py-1.5 text-xs font-bold rounded-md text-slate-400 hover:text-slate-200';
    });

    const allocCancel = document.getElementById('pocket-alloc-cancel');
    if(allocCancel) allocCancel.addEventListener('click', () => document.getElementById('pocket-allocate-modal').classList.add('hidden'));

    const allocSave = document.getElementById('pocket-alloc-save');
    if(allocSave) allocSave.addEventListener('click', () => {
        if (allocSave.disabled || !savingsOperationId) return;
        const id = document.getElementById('pocket-alloc-id').value;
        const amt = Number(document.getElementById('pocket-alloc-amt').value);
        const type = document.getElementById('pocket-alloc-type').value;

        try {
            allocSave.disabled = true;
            allocateSavings(id, amt, document.getElementById('pocket-alloc-wallet').value, type, savingsOperationId);
            savingsOperationId = null;
            document.getElementById('pocket-allocate-modal').classList.add('hidden');
            fetchData();
            showToast('Transfer tabungan berhasil dicatat', 'success');
            syncToSpreadsheet();
        } catch (error) {
            showToast(savingsOperationId ? error.message : 'Transfer sudah tersimpan. Muat ulang halaman untuk memperbarui tampilan.', 'error');
        }
        finally { allocSave.disabled = !savingsOperationId; }

    });
});
