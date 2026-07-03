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
let GOLD_PRICE = parseFloat(localStorage.getItem('GOLD_PRICE')) || 0;
let masterData = [];
let itemToDelete = null;
let sortState = { k: 'date', o: 'desc' };
let calendarDate = new Date();
let isEditing = false;
let editItem = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('entry-date').valueAsDate = new Date();
    loadSystemConfig();
    fetchData();

    // Tab Navigation Logic
    const deskNavBtns = document.querySelectorAll('.desk-nav-btn');
    const mobNavBtns = document.querySelectorAll('.mob-nav-btn');

    function updateTabUI(viewId) {
        document.querySelectorAll('.tab-view').forEach(v => v.classList.add('hidden'));
        document.getElementById(viewId).classList.remove('hidden');

        deskNavBtns.forEach(btn => {
            if (btn.dataset.target === viewId) {
                btn.classList.add('desk-nav-active');
                btn.classList.remove('text-slate-400');
            } else {
                btn.classList.remove('desk-nav-active');
                btn.classList.add('text-slate-400');
            }
        });

        mobNavBtns.forEach(btn => {
            if (btn.dataset.target === viewId) {
                btn.classList.add('mob-nav-active');
                btn.classList.remove('text-slate-500');
            } else {
                btn.classList.remove('mob-nav-active');
                btn.classList.add('text-slate-500');
            }
        });
    }

    deskNavBtns.forEach(b => b.addEventListener('click', e => updateTabUI(e.currentTarget.dataset.target)));
    mobNavBtns.forEach(b => b.addEventListener('click', e => updateTabUI(e.currentTarget.dataset.target)));
    window.switchTab = updateTabUI;

    window.applyDatePreset = (type) => {
        const now = new Date();
        let start, end;
        if (type === 'thisMonth') { start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth() + 1, 0); }
        else if (type === 'lastMonth') { start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0); }
        else if (type === 'last30') { end = new Date(); start = new Date(); start.setDate(now.getDate() - 30); }
        else if (type === 'thisYear') { start = new Date(now.getFullYear(), 0, 1); end = new Date(now.getFullYear(), 11, 31); }
        else { document.getElementById('filter-start').value = ''; document.getElementById('filter-end').value = ''; renderAll(); document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('preset-active')); return; }
        document.getElementById('filter-start').value = start.toISOString().split('T')[0]; document.getElementById('filter-end').value = end.toISOString().split('T')[0]; renderAll();
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
    }));

    function updateUIForType(val) {
        const tg = document.getElementById('transfer-target-group'), cg = document.getElementById('category-group'), ls = document.getElementById('lbl-source-acc'), btn = document.getElementById('submit-btn');
        if (val === 'transfer') {
            tg.classList.remove('hidden'); cg.classList.add('hidden'); ls.innerHTML = '<i class="fas fa-arrow-right mr-1 text-slate-600"></i> FROM / SOURCE';
            btn.innerHTML = `<span>${isEditing ? "Update Transfer" : "Process Transfer"}</span> <i class="fas fa-exchange-alt"></i>`;
            btn.className = "w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold py-4 rounded-2xl shadow-[0_8px_20px_rgba(37,99,235,0.3)] hover:shadow-[0_8px_25px_rgba(37,99,235,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4";
        } else {
            tg.classList.add('hidden'); cg.classList.remove('hidden'); ls.innerHTML = '<i class="fas fa-arrow-right mr-1 text-slate-600"></i> FROM / ACCOUNT';
            btn.innerHTML = `<span>${isEditing ? "Update Transaction" : "Save Transaction"}</span> <i class="fas fa-check"></i>`;
            if (val === 'income') btn.className = isEditing ? "w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-4 rounded-2xl shadow-[0_8px_20px_rgba(249,115,22,0.3)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4" : "w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold py-4 rounded-2xl shadow-[0_8px_20px_rgba(16,185,129,0.3)] hover:shadow-[0_8px_25px_rgba(16,185,129,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4";
            else btn.className = isEditing ? "w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-4 rounded-2xl shadow-[0_8px_20px_rgba(249,115,22,0.3)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4" : "w-full bg-gradient-to-r from-rose-500 to-rose-600 text-white font-bold py-4 rounded-2xl shadow-[0_8px_20px_rgba(225,29,72,0.3)] hover:shadow-[0_8px_25px_rgba(225,29,72,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4";
        }
    }
    document.getElementById('entry-cat').addEventListener('change', e => document.getElementById('entry-cat-other').classList.toggle('hidden', e.target.value !== 'Other'));

    document.getElementById('add-entry-form').addEventListener('submit', e => {
        e.preventDefault();
        const btn = document.getElementById('submit-btn'); const origTxt = btn.innerHTML; btn.innerHTML = '<div class="loader w-5 h-5 border-2 border-white border-t-transparent"></div>'; btn.disabled = true;
        const type = document.querySelector('input[name="entry-type"]:checked').value;
        const date = document.getElementById('entry-date').value;
        const desc = document.getElementById('entry-desc').value;
        
        let txType = type === 'income' ? 'income' : 'expense';
        let cat = document.getElementById('entry-cat').value; 
        if (cat === 'Other') cat = document.getElementById('entry-cat-other').value;
        if (type === 'transfer') cat = 'Transfer';

        const accSource = document.getElementById('entry-acc-source').value;
        const currSource = document.getElementById('entry-curr-source').value;
        const amtSource = Math.abs(parseFloat(document.getElementById('entry-amt-source').value));

        let txs = getTransactions();

        if (isEditing) {
            const idx = txs.findIndex(t => t.id == editItem.id);
            if (idx !== -1) {
                txs[idx] = {
                    id: editItem.id,
                    date: date,
                    description: desc,
                    category: cat,
                    paymentMethod: accSource,
                    type: txType,
                    amount: amtSource,
                    currency: currSource
                };
            }
        } else {
            if (type === 'transfer') {
                const accTarget = document.getElementById('entry-acc-target').value;
                const currTarget = document.getElementById('entry-curr-target').value;
                const amtTargetInput = document.getElementById('entry-amt-target').value;
                const amtTarget = amtTargetInput ? Math.abs(parseFloat(amtTargetInput)) : amtSource;

                if (accSource === accTarget && currSource === currTarget) {
                    showToast("Source and Target are identical!", 'error');
                    btn.innerHTML = origTxt; btn.disabled = false; return;
                }

                // Create expense from source
                txs.push({ id: Date.now().toString() + "-out", date, description: desc + " (Transfer Out)", category: cat, paymentMethod: accSource, type: 'expense', amount: amtSource, currency: currSource });
                // Create income to target
                txs.push({ id: Date.now().toString() + "-in", date, description: desc + " (Transfer In)", category: cat, paymentMethod: accTarget, type: 'income', amount: amtTarget, currency: currTarget });
            } else {
                txs.push({
                    id: Date.now().toString(),
                    date: date,
                    description: desc,
                    category: cat,
                    paymentMethod: accSource,
                    type: txType,
                    amount: amtSource,
                    currency: currSource
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
    });

    document.getElementById('cancel-edit-btn').addEventListener('click', resetForm);

    document.addEventListener('click', e => {
        const btnEdit = e.target.closest('.edit-btn'), btnDel = e.target.closest('.del-btn');

        if (btnDel) {
            itemToDelete = JSON.parse(btnDel.dataset.item);
            document.getElementById('del-item-preview').innerHTML = `<div class="font-bold text-white text-base mb-1">${itemToDelete.desc}</div><div class="${itemToDelete.type === 'income' ? 'text-emerald-400' : 'text-rose-400'} font-mono text-xl font-bold">${fmt(itemToDelete.amt, itemToDelete.curr)}</div><div class="text-[10px] uppercase font-bold tracking-wider text-slate-500 mt-3">${itemToDelete.date} • ${itemToDelete.acc}</div>`;
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

            document.getElementById('entry-desc').value = item.desc;
            document.getElementById('entry-date').value = item.date;

            const catSelect = document.getElementById('entry-cat');
            if ([...catSelect.options].map(o => o.value).includes(item.cat)) catSelect.value = item.cat;
            else { catSelect.value = 'Other'; document.getElementById('entry-cat-other').classList.remove('hidden'); document.getElementById('entry-cat-other').value = item.cat; }

            document.getElementById('entry-curr-source').value = item.curr;
            document.getElementById('entry-acc-source').value = item.acc;
            document.getElementById('entry-amt-source').value = item.amt;
        }

        // Quick Edit click handler
        const amtEdit = e.target.closest('.inline-amount-edit');
        if (amtEdit) {
            const item = JSON.parse(amtEdit.dataset.item);
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
        saveTransactions(txs);
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

    ['filter-start', 'filter-end', 'filter-cat', 'filter-acc', 'filter-search'].forEach(i => document.getElementById(i).addEventListener('input', renderAll));
    document.getElementById('chart-currency-toggle').addEventListener('change', () => updateChart(masterData));
    document.querySelectorAll('.sortable').forEach(s => s.addEventListener('click', e => { sortState.k = e.target.dataset.sort; sortState.o = sortState.o === 'asc' ? 'desc' : 'asc'; renderAll(); }));
    
    document.getElementById('settings-btn').addEventListener('click', () => {
        document.getElementById('webhook-url-input').value = getGASUrl();
        document.getElementById('settings-modal').classList.remove('hidden');
    });
    document.getElementById('settings-close').addEventListener('click', () => document.getElementById('settings-modal').classList.add('hidden'));
    
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

function loadSystemConfig() {
    const selAccS = document.getElementById('entry-acc-source');
    const selAccT = document.getElementById('entry-acc-target');
    const selCat = document.getElementById('entry-cat');
    
    const accs = DEFAULT_CONFIG.paymentMethods;
    selAccS.innerHTML = accs.map(w => `<option value="${w}">${w}</option>`).join('');
    selAccT.innerHTML = accs.map(w => `<option value="${w}">${w}</option>`).join('');
    
    const cats = DEFAULT_CONFIG.categories;
    selCat.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
    selCat.innerHTML += '<option value="Other">Other...</option>';
}

function getTransactions() {
    const transactions = localStorage.getItem('transactions');
    return transactions ? JSON.parse(transactions) : [];
}

function saveTransactions(transactions) {
    localStorage.setItem('transactions', JSON.stringify(transactions));
}

function getGASUrl() {
    return localStorage.getItem('gas_webhook_url') || "";
}

function resetForm() {
    document.getElementById('add-entry-form').reset(); document.getElementById('entry-date').valueAsDate = new Date();
    isEditing = false; editItem = null; document.getElementById('form-title').innerHTML = '<div class="w-10 h-10 rounded-xl bg-theme-primary/20 flex items-center justify-center text-theme-primaryLight border border-theme-primary/30"><i class="fas fa-plus"></i></div> New Entry'; document.getElementById('cancel-edit-btn').classList.add('hidden');
    document.querySelector('input[name="entry-type"][value="expense"]').checked = true; document.querySelector('input[name="entry-type"][value="expense"]').dispatchEvent(new Event('change'));
}

function fetchData() {
    const rawTxs = getTransactions();
    masterData = [];
    rawTxs.forEach(t => {
        masterData.push({
            id: t.id,
            type: t.type,
            date: t.date,
            desc: t.description,
            cat: t.category,
            acc: t.paymentMethod,
            curr: t.currency || 'IDR',
            amt: parseFloat(t.amount)
        });
    });

    const cats = [...new Set(masterData.map(d => d.cat))].sort(), accs = [...new Set(masterData.map(d => d.acc))].sort();
    document.getElementById('filter-cat').innerHTML = '<option value="all">All Categories</option>' + cats.map(c => `<option>${c}</option>`).join('');
    document.getElementById('filter-acc').innerHTML = '<option value="all">All Accounts</option>' + accs.map(a => `<option>${a}</option>`).join('');
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

function renderAll() {
    const bals = {}; let incIDR = 0, expIDR = 0, incUSD = 0, expUSD = 0;
    
    // Initialize all payment methods to 0 balance
    DEFAULT_CONFIG.paymentMethods.forEach(method => {
        let curr = 'IDR';
        if (method.includes('USD')) curr = 'USD';
        if (method === 'Gold') curr = 'IDR';
        const k = `${method}-${curr}`;
        bals[k] = { n: method, c: curr, v: 0 };
    });

    masterData.forEach(d => {
        const k = `${d.acc}-${d.curr}`;
        if (!bals[k]) bals[k] = { n: d.acc, c: d.curr, v: 0 };
        if (d.type === 'income') {
            bals[k].v += d.amt;
            if (d.cat !== 'Transfer' && d.cat !== 'Initial Balance') { if (d.curr === 'IDR') incIDR += d.amt; else incUSD += d.amt; }
        } else {
            bals[k].v -= d.amt;
            if (d.cat !== 'Transfer') { if (d.curr === 'IDR') expIDR += d.amt; else expUSD += d.amt; }
        }
    });

    const wallets = [];
    const investments = [];
    
    Object.values(bals).sort((a, b) => a.n.localeCompare(b.n)).forEach((b, idx) => {
        if (b.n === 'Gold' || b.n === 'Stocks') {
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
        <div class="formal-card p-4 flex flex-col justify-center min-h-[80px] relative group">
            <span class="text-[10px] text-slate-500 uppercase font-bold tracking-widest truncate mb-1" title="${b.n}">${b.n}</span>
            <span id="${b.id}" class="font-bold font-mono text-sm tracking-tighter truncate ${b.v >= 0 ? (isGold || b.n === 'Stocks' ? 'text-yellow-600' : 'text-slate-800') : 'text-rose-600'} cursor-pointer hover:opacity-70 transition inline-balance-edit" data-acc="${b.n}" data-curr="${b.c}" data-val="${b.v}">
                ${displayVal}
            </span>
            ${(isUSD || isGold) ? `<div class="absolute top-2 right-2 text-[8px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 transition font-mono whitespace-nowrap overflow-hidden max-w-[90%] group-hover:text-slate-800 border border-slate-200">${isGold ? 'Rp ' + fmt(idrEquivalent, 'IDR').replace('IDR','').trim() : '<i class="fas fa-exchange-alt"></i>'}</div>` : ''}
        </div>
        `;
    };

    document.getElementById('account-balances-container').innerHTML = wallets.map(renderCard).join('');
    const invContainer = document.getElementById('investment-balances-container');
    if (invContainer) {
        invContainer.innerHTML = investments.map(renderCard).join('');
        if (investments.length === 0) invContainer.innerHTML = '<div class="col-span-full text-center text-slate-500 py-4 text-xs italic">No investments yet</div>';
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
        if (b.n === 'Gold' || b.n === 'Stocks') {
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

    const cashEl = document.querySelector('#summary-cash .stat-value');
    if (cashEl) cashEl.textContent = fmt(totalCashIDR, 'IDR');

    const investEl = document.querySelector('#summary-invest .stat-value');
    if (investEl) investEl.textContent = fmt(totalInvestIDR, 'IDR');

    document.getElementById('rate-display').textContent = `1 USD = ${fmt(USD_KURS, 'IDR').replace('IDR', '').trim()}`;
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
            <span class="text-sm font-bold text-slate-800 truncate">${d.desc}</span>
            <div class="flex flex-wrap items-center gap-2 text-[10px] font-medium text-slate-500">
                <span class="bg-slate-100 px-2 py-1 rounded-md border border-slate-200">${d.date.slice(5)}</span>
                <span class="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md border border-indigo-100 uppercase tracking-wider">${d.acc}</span>
            </div>
        </div>
        <div class="flex flex-col items-end gap-2">
            <span class="font-bold font-mono text-sm ${d.type === 'income' ? 'text-emerald-600' : 'text-rose-600'} cursor-pointer hover:opacity-70 transition inline-amount-edit" data-item='${JSON.stringify(d).replace(/'/g, "&#39;")}'>${d.type === 'income' ? '+' : '-'} ${fmt(d.amt, d.curr)}</span>
            <div class="flex gap-2">
                <button class="bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 border border-slate-200 rounded-lg p-1.5 w-8 h-8 flex items-center justify-center transition edit-btn" data-item='${JSON.stringify(d)}'><i class="fas fa-pen text-xs"></i></button>
                <button class="bg-rose-50 text-rose-500 hover:bg-rose-100 border border-rose-100 rounded-lg p-1.5 w-8 h-8 flex items-center justify-center transition del-btn" data-item='${JSON.stringify(d)}'><i class="fas fa-trash text-xs"></i></button>
            </div>
        </div>
    </div>
`).join('');
    if (filtered.length === 0) document.getElementById('mobile-trans-list').innerHTML = '<div class="text-center text-slate-500 py-10 text-sm italic glass rounded-2xl">No transactions found</div>';

    document.getElementById('data-body').innerHTML = filtered.map(d => `
    <tr class="hover:bg-slate-50 transition border-b border-slate-100 last:border-0 group">
        <td class="px-6 py-4 text-sm text-slate-500 whitespace-nowrap font-mono">${d.date}</td>
        <td class="px-6 py-4 text-sm text-slate-800 font-medium">${d.desc}</td>
        <td class="px-6 py-4 text-sm"><span class="bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-1 rounded-lg text-xs font-medium">${d.acc}</span></td>
        <td class="px-6 py-4 text-sm text-slate-500"><span class="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg text-xs">${d.cat}</span></td>
        <td class="px-6 py-4 text-sm text-right font-mono font-bold ${d.type === 'income' ? 'text-emerald-600' : 'text-rose-600'} cursor-pointer hover:opacity-70 transition inline-amount-edit" data-item='${JSON.stringify(d).replace(/'/g, "&#39;")}'>${d.type === 'income' ? '+' : '-'} ${fmt(d.amt, d.curr)}</td>
        <td class="px-4 py-4 text-center">
            <div class="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition">
                <button class="w-8 h-8 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition edit-btn" data-item='${JSON.stringify(d)}'><i class="fas fa-pen text-xs"></i></button>
                <button class="w-8 h-8 bg-rose-50 border border-rose-100 rounded-lg text-rose-500 hover:bg-rose-100 transition del-btn" data-item='${JSON.stringify(d)}'><i class="fas fa-trash text-xs"></i></button>
            </div>
        </td>
    </tr>
`).join('');
    if (filtered.length === 0) document.getElementById('data-body').innerHTML = '<tr><td colspan="6" class="text-center py-10 text-slate-500 text-sm italic">No data found</td></tr>';

    renderDaily(masterData); renderCalendar(masterData); updateChart(masterData); updateTrendChart(masterData); renderDashWidgets(masterData);
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
                document.getElementById('cal-detail-content').innerHTML = items.map(x => `<div class="flex justify-between items-center p-4 bg-black/30 rounded-2xl border border-white/5 mb-2 hover:bg-black/50 transition"><div class="flex items-center gap-3"><div class="w-2 h-2 rounded-full ${x.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}"></div><div><div class="text-sm text-white font-bold">${x.desc}</div><div class="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-bold">${x.cat} • ${x.acc}</div></div></div><div class="${x.type === 'income' ? 'text-emerald-400' : 'text-rose-400'} font-mono text-sm font-bold bg-white/5 px-2 py-1 rounded-lg cursor-pointer hover:opacity-70 transition inline-amount-edit" data-item='${JSON.stringify(x).replace(/'/g, "&#39;")}'>${fmt(x.amt, x.curr)}</div></div>`).join('');
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
    const curr = document.getElementById('chart-currency-toggle').value; const exps = data.filter(d => d.type === 'expense' && d.curr === curr && d.cat !== 'Transfer'); const totals = {}; exps.forEach(d => totals[d.cat] = (totals[d.cat] || 0) + d.amt);
    const ctx = document.getElementById('expense-pie-chart').getContext('2d'); if (myChart) myChart.destroy();
    const chartColors = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#F43F5E', '#8B5CF6', '#EC4899', '#14B8A6', '#6366F1'];
    myChart = new Chart(ctx, { type: 'doughnut', data: { labels: Object.keys(totals), datasets: [{ data: Object.values(totals), backgroundColor: chartColors, borderWidth: 2, borderColor: '#0B1325', hoverOffset: 6 }] }, options: { plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(11, 19, 37, 0.9)', titleColor: '#fff', bodyColor: '#cbd5e1', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 12, cornerRadius: 12, displayColors: true } }, cutout: '75%', responsive: true, maintainAspectRatio: false } });
    document.getElementById('expense-details').innerHTML = Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([k, v], i) => `<div class="flex justify-between items-center text-xs py-2 border-b border-white/5 last:border-0"><div class="flex items-center gap-2"><div class="w-2.5 h-2.5 rounded-full" style="background-color: ${chartColors[i % chartColors.length]}"></div><span class="text-slate-300 font-medium">${k}</span></div><span class="font-mono text-white font-bold bg-white/5 px-2 py-0.5 rounded-md">${fmt(v, curr)}</span></div>`).join('');
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
                borderColor: '#4F46E5', 
                backgroundColor: (context) => { 
                    const chartCtx = context.chart.ctx; 
                    const gradient = chartCtx.createLinearGradient(0, 0, 0, 300); 
                    gradient.addColorStop(0, 'rgba(79, 70, 229, 0.5)'); 
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
                x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10, family: "'Inter', sans-serif" } } }, 
                y: { border: { display: false }, grid: { color: 'rgba(255,255,255,0.05)', borderDash: [4, 4] }, ticks: { color: '#64748b', font: { size: 10, family: "'JetBrains Mono', monospace" }, callback: function (value) { return value >= 1000000 ? (value / 1000000).toFixed(1) + 'M' : (value / 1000).toFixed(0) + 'k'; } } } 
            } 
        } 
    });
}

function renderDashWidgets(data) {
    const sortedData = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
    const recent = sortedData.slice(0, 5);
    document.getElementById('dash-recent-list').innerHTML = recent.map(d => `
    <div class="bg-black/20 p-3 rounded-2xl flex justify-between items-center border border-white/5 hover:border-white/10 transition">
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm ${d.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}">
                <i class="fas ${d.type === 'income' ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
            </div>
            <div>
                <div class="text-sm font-bold text-slate-200 truncate max-w-[150px] sm:max-w-[200px]">${d.desc}</div>
                <div class="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-0.5">${d.date} • ${d.cat}</div>
            </div>
        </div>
        <div class="font-mono text-sm font-bold ${d.type === 'income' ? 'text-emerald-400' : 'text-rose-400'} cursor-pointer hover:opacity-70 transition inline-amount-edit" data-item='${JSON.stringify(d).replace(/'/g, "&#39;")}'>
            ${d.type === 'income' ? '+' : '-'} ${fmt(d.amt, d.curr)}
        </div>
    </div>
`).join('');
    if (recent.length === 0) document.getElementById('dash-recent-list').innerHTML = '<div class="text-center text-slate-500 py-4 text-xs italic">No activity yet</div>';

    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthExps = data.filter(d => d.type === 'expense' && d.cat !== 'Transfer' && d.date.startsWith(thisMonth));

    let totalThisMonth = 0;
    const catTotals = {};
    thisMonthExps.forEach(d => {
        const amtIDR = d.curr === 'USD' ? d.amt * USD_KURS : d.amt;
        catTotals[d.cat] = (catTotals[d.cat] || 0) + amtIDR;
        totalThisMonth += amtIDR;
    });

    const topCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const chartColors = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#F43F5E'];

    document.getElementById('dash-top-cat-list').innerHTML = topCats.map((c, i) => {
        const percentage = totalThisMonth > 0 ? (c[1] / totalThisMonth) * 100 : 0;
        return `
    <div class="space-y-1.5">
        <div class="flex justify-between items-end">
            <span class="text-xs font-bold text-slate-300">${c[0]}</span>
            <span class="font-mono text-xs text-white bg-white/5 px-2 py-0.5 rounded-md border border-white/5">${fmt(c[1], 'IDR')}</span>
        </div>
        <div class="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
            <div class="h-full rounded-full" style="width: ${percentage}%; background-color: ${chartColors[i % chartColors.length]}; box-shadow: 0 0 10px ${chartColors[i % chartColors.length]}80;"></div>
        </div>
    </div>`;
    }).join('');
    if (topCats.length === 0) document.getElementById('dash-top-cat-list').innerHTML = '<div class="text-center text-slate-500 py-4 text-xs italic">No expenses this month</div>';
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
            <span class="text-[10px] text-slate-500 font-bold uppercase mb-0.5">💵 USD Kurs</span>
            <span class="text-emerald-400 font-bold">${fmt(USD_KURS, 'IDR').replace('IDR', '').trim()}</span>
        </div>
        <div class="flex flex-col items-end ml-2">
            <span class="text-[10px] text-slate-500 font-bold uppercase mb-0.5">🥇 Gold / g</span>
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

async function fetchGoldPrice() {
    const syncStatus = document.getElementById('syncStatus');
    if (syncStatus) syncStatus.innerHTML = '<div class="loader w-3 h-3 border-2 border-slate-500 border-t-white mx-auto inline-block align-middle mr-2"></div> Fetching Gold...';

    try {
        const resp = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
        if (resp.ok) {
            const data = await resp.json();
            if (data && data.usd && data.usd.xau) {
                const xauUsd = 1 / data.usd.xau; // Price of 1 Troy Ounce in USD
                GOLD_PRICE = Math.round((xauUsd * USD_KURS) / 31.1035);
                localStorage.setItem('GOLD_PRICE', GOLD_PRICE);
                updateRatesDisplay();
                renderAll();
                if (syncStatus) syncStatus.innerHTML = `<span class="text-emerald-400"><i class="fas fa-check"></i> Gold updated</span>`;
                showToast("Gold price updated!", "success");
                return true;
            }
        }
    } catch (e) {
        console.error("Gold fetch failed:", e);
    }
    
    if (syncStatus) syncStatus.innerHTML = `<span class="text-rose-400">❌ Failed Gold</span>`;
    return false;
}

async function syncAllRates() {
    const syncStatus = document.getElementById('syncStatus');
    if (syncStatus) syncStatus.innerHTML = '<div class="loader w-3 h-3 border-2 border-slate-500 border-t-white mx-auto inline-block align-middle mr-2"></div> Syncing Rates...';
    
    const kursOk = await fetchKurs();
    if (kursOk) {
        await fetchGoldPrice();
        if (syncStatus) syncStatus.innerHTML = `<span class="text-emerald-400">✅ All rates updated (${new Date().toLocaleTimeString()})</span>`;
    }
}
