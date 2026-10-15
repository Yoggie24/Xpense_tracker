// System Config: persistent domain state + six reusable chip managers.
const CONFIG_SECTIONS = [
    { key: 'expenseCategories', title: 'Expense Categories', tone: 'rose', icon: 'arrow-up', hint: 'Kategori pengeluaran dan pemetaan kantong.' },
    { key: 'incomeCategories', title: 'Income Categories', tone: 'emerald', icon: 'arrow-down', hint: 'Kategori khusus transaksi pemasukan.' },
    { key: 'idrWallets', title: 'IDR Wallets', tone: 'blue', icon: 'wallet', hint: 'Bank dan e-wallet dalam Rupiah.' },
    { key: 'usdWallets', title: 'USD Wallets', tone: 'cyan', icon: 'dollar-sign', hint: 'Akun dalam USD; mata uang dipilih otomatis.' },
    { key: 'investmentAccounts', title: 'Investment Accounts (Names)', tone: 'purple', icon: 'chart-line', hint: 'Platform investasi dicatat dalam IDR. Gold tetap dalam gram.' },
    { key: 'burnRateExclusions', title: 'Exclude From Daily Burn Rate', tone: 'amber', icon: 'filter', hint: 'Pengecualian hanya memengaruhi burn rate, bukan total pengeluaran atau budget.' }
];
const CONFIG_ACCOUNT_KEYS = ['idrWallets', 'usdWallets', 'investmentAccounts'];
let appConfig = null;
let configReturnFocus = null;

function readConfigJSON(key, fallback) {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    try { return JSON.parse(raw); }
    catch { localStorage.setItem(key + '-invalid-backup', raw); return fallback; }
}

function cleanConfigNames(values) {
    const seen = new Set();
    return (Array.isArray(values) ? values : []).filter(v => typeof v === 'string').map(v => v.trim()).filter(v => {
        const key = v.toLocaleLowerCase();
        if (!v || seen.has(key)) return false;
        seen.add(key); return true;
    });
}

function getAppConfig() {
    if (appConfig) return appConfig;
    const raw = localStorage.getItem('appConfig');
    const stored = readConfigJSON('appConfig', null);
    const valid = stored && typeof stored === 'object' && !Array.isArray(stored);
    if (raw && !valid) localStorage.setItem('appConfig-invalid-backup', raw);
    const deleted = cleanConfigNames(readConfigJSON('deletedCategories', []));
    const legacy = cleanConfigNames([...DEFAULT_CONFIG.categories, ...cleanConfigNames(readConfigJSON('customCategories', []))])
        .filter(c => !deleted.includes(c) && !['Transfer', 'Initial Balance', 'Other'].includes(c));
    const history = readConfigJSON('transactions', []);
    const transactions = Array.isArray(history) ? history.filter(t => t && typeof t === 'object') : [];
    const incomeNames = new Set(['Gaji', 'Bonus', 'Sisa', ...transactions.filter(t => t.type === 'income').map(t => t.category)]);
    const expenseNames = new Set(transactions.filter(t => t.type === 'expense').map(t => t.category));
    const defaults = {
        expenseCategories: legacy.filter(c => !incomeNames.has(c) || expenseNames.has(c)),
        incomeCategories: legacy.filter(c => incomeNames.has(c)),
        idrWallets: DEFAULT_CONFIG.paymentMethods.filter(n => !['Gold', 'Stocks'].includes(n) && !/USD|Vallas/i.test(n)),
        usdWallets: DEFAULT_CONFIG.paymentMethods.filter(n => /USD|Vallas/i.test(n)),
        investmentAccounts: ['Gold', 'Stocks'], burnRateExclusions: []
    };
    const next = { ...(valid ? stored : {}), version: 1 };
    CONFIG_SECTIONS.forEach(({ key }) => {
        next[key] = cleanConfigNames(valid && Array.isArray(stored[key]) ? stored[key] : defaults[key]);
    });
    const reserved = new Set(['transfer', 'initial balance', 'other']);
    ['expenseCategories', 'incomeCategories'].forEach(key => { next[key] = next[key].filter(n => !reserved.has(n.toLowerCase())); });
    // One account name has one currency/type; retain metadata for deleted historical accounts.
    next.accountMetadata = valid && stored.accountMetadata && typeof stored.accountMetadata === 'object' && !Array.isArray(stored.accountMetadata)
        ? { ...stored.accountMetadata } : {};
    const accounts = new Set();
    CONFIG_ACCOUNT_KEYS.forEach(key => {
        next[key] = next[key].filter(name => {
            if (accounts.has(name.toLowerCase())) return false;
            accounts.add(name.toLowerCase());
            next.accountMetadata = { ...next.accountMetadata, [name]: { currency: key === 'usdWallets' ? 'USD' : 'IDR', investment: key === 'investmentAccounts' } };
            return true;
        });
    });
    next.burnRateExclusions = next.burnRateExclusions.filter(c => next.expenseCategories.includes(c));
    localStorage.setItem('appConfig', JSON.stringify(next));
    appConfig = next;
    return appConfig;
}

function getAccountNames() { const config = getAppConfig(); return CONFIG_ACCOUNT_KEYS.flatMap(key => config[key]); }
function getAccountCurrency(name) { return getAppConfig().accountMetadata[name]?.currency || (/USD|Vallas/i.test(name) ? 'USD' : 'IDR'); }
function isInvestmentAccount(name) { return getAppConfig().accountMetadata[name]?.investment === true || ['Gold', 'Stocks'].includes(name); }
function getTransactionCategories(type = 'expense') { return getAppConfig()[type === 'income' ? 'incomeCategories' : 'expenseCategories']; }

function changeConfigItem(key, value, remove = false) {
    if (!CONFIG_SECTIONS.some(s => s.key === key)) throw new Error('Grup konfigurasi tidak valid.');
    const config = getAppConfig();
    const name = String(value ?? '').trim();
    if (!name || name.length > 80) throw new Error('Isi nama antara 1–80 karakter.');
    const next = JSON.parse(JSON.stringify(config));
    if (remove) {
        next[key] = next[key].filter(n => n !== name);
        if (key === 'expenseCategories') next.burnRateExclusions = next.burnRateExclusions.filter(n => n !== name);
    } else {
        if (next[key].some(n => n.toLowerCase() === name.toLowerCase())) throw new Error('Item sudah ada dalam grup ini.');
        if (['expenseCategories', 'incomeCategories'].includes(key) && ['transfer', 'initial balance', 'other'].includes(name.toLowerCase())) {
            throw new Error('Nama ini digunakan otomatis oleh sistem.');
        }
        if (CONFIG_ACCOUNT_KEYS.includes(key)) {
            if (getAccountNames().some(n => n.toLowerCase() === name.toLowerCase())) throw new Error('Nama akun sudah dipakai di grup wallet atau investasi lain.');
            const archivedName = Object.keys(next.accountMetadata).find(n => n.toLowerCase() === name.toLowerCase());
            const currency = key === 'usdWallets' ? 'USD' : 'IDR';
            const investment = key === 'investmentAccounts';
            if (archivedName && (archivedName !== name || next.accountMetadata[archivedName].currency !== currency || next.accountMetadata[archivedName].investment !== investment)) {
                throw new Error('Akun lama harus memakai nama, mata uang, dan grup asal agar riwayat tetap konsisten.');
            }
            next.accountMetadata = { ...next.accountMetadata, [name]: { currency, investment } };
        }
        if (key === 'burnRateExclusions' && !next.expenseCategories.includes(name)) throw new Error('Pilih kategori pengeluaran yang tersedia.');
        next[key].push(name);
    }
    // Write first: failed persistence must not update in-memory data or dropdowns.
    localStorage.setItem('appConfig', JSON.stringify(next));
    appConfig = next;
    return next;
}

function refreshConfigApplication() {
    loadSystemConfig();
    renderConfigManager();
    if (!document.getElementById('pocket-modal').classList.contains('hidden')) {
        const selected = Array.from(document.querySelectorAll('#pocket-categories input:checked'), el => el.value);
        renderPocketCategories(selected);
    }
    renderAll();
}

function renderConfigManager() {
    const grid = document.getElementById('config-sections');
    if (!grid) return;
    const config = getAppConfig();
    if (!grid.children.length) {
        grid.innerHTML = CONFIG_SECTIONS.map(({ key, title, tone, icon, hint }) => `
            <section class="config-card border rounded-xl p-4 shadow-sm" data-tone="${tone}" aria-labelledby="config-title-${key}">
                <h4 id="config-title-${key}"><i class="fas fa-${icon}" aria-hidden="true"></i> ${title}<span id="config-count-${key}" class="config-count"></span></h4>
                <p class="config-hint">${hint}</p>
                <div id="config-list-${key}" class="config-chip-list" aria-label="${title}"></div>
                <form class="config-input-row" data-config-key="${key}">
                    <label class="sr-only" for="config-input-${key}">${title}: item baru</label>
                    ${key === 'burnRateExclusions' ? `<select id="config-input-${key}" class="input-formal rounded-lg" required></select>` : `<input id="config-input-${key}" class="input-formal rounded-lg" type="text" placeholder="New item..." maxlength="80" autocomplete="off" required>`}
                    <button type="submit" class="config-add" aria-label="Tambah ${title}"><i class="fas fa-plus" aria-hidden="true"></i></button>
                </form>
            </section>`).join('');
    }
    CONFIG_SECTIONS.forEach(({ key }) => {
        document.getElementById('config-count-' + key).textContent = config[key].length;
        document.getElementById('config-list-' + key).innerHTML = config[key].length ? config[key].map(name =>
            `<span class="config-chip"><span>${escapePocketText(name)}</span><button type="button" data-config-remove="${key}" data-name="${escapePocketText(name)}" aria-label="Hapus ${escapePocketText(name)}"><i class="fas fa-times" aria-hidden="true"></i></button></span>`
        ).join('') : '<span class="config-empty">Belum ada item.</span>';
    });
    const select = document.getElementById('config-input-burnRateExclusions');
    const selected = select.value;
    const available = config.expenseCategories.filter(c => !config.burnRateExclusions.includes(c));
    select.innerHTML = '<option value="">Pilih kategori pengeluaran...</option>' + available.map(c => `<option value="${escapePocketText(c)}">${escapePocketText(c)}</option>`).join('');
    select.value = available.includes(selected) ? selected : '';
    select.disabled = !available.length;
    select.closest('form').querySelector('button').disabled = !available.length;
}

function openSystemConfig() {
    configReturnFocus = document.activeElement;
    renderConfigManager();
    populateGoldConfig();
    document.getElementById('webhook-url-input').value = getGASUrl();
    document.getElementById('config-feedback').textContent = 'Perubahan chip tersimpan otomatis di browser ini.';
    document.getElementById('settings-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('settings-close').focus(), 0);
}
function closeSystemConfig() {
    document.getElementById('settings-modal').classList.add('hidden');
    if (configReturnFocus && !configReturnFocus.closest('[inert]')) configReturnFocus.focus();
    else document.getElementById('settings-btn').focus();
}

// Average per calendar day elapsed; past months use their complete day count.
function calculateDailyBurnRate(transactions = getTransactions(), activeMonth = getActiveBudgetMonth(), now = new Date()) {
    const [year, month] = activeMonth.split('-').map(Number);
    const currentMonth = localMonthKey(now);
    const days = activeMonth > currentMonth ? 0 : activeMonth === currentMonth ? now.getDate() : new Date(year, month, 0).getDate();
    const excluded = new Set(getAppConfig().burnRateExclusions);
    const total = transactions.reduce((sum, raw) => {
        const t = normalizeTransaction(raw);
        if (!days || t.type !== 'expense' || ['Transfer', 'Initial Balance'].includes(t.category) || excluded.has(t.category) ||
            transactionMonthKey(t.date) !== activeMonth || String(t.date).slice(0, 10) > localDateKey(now) || !Number.isFinite(Number(t.amount))) return sum;
        return sum + Math.abs(Number(t.amount)) * (t.currency === 'USD' ? t.exchangeRate : 1);
    }, 0);
    return { total, days, daily: days ? total / days : 0 };
}
function renderDailyBurnRate() {
    const value = document.getElementById('daily-burn-value');
    if (!value) return;
    const month = getActiveBudgetMonth();
    const result = calculateDailyBurnRate(getTransactions(), month);
    value.textContent = fmtPocketIDR(result.daily) + ' / hari';
    document.getElementById('daily-burn-period').textContent = `${month} · ${result.days} hari · Setelah pengecualian`;
}

document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('config-sections');
    const feedback = document.getElementById('config-feedback');
    grid.addEventListener('submit', event => {
        const form = event.target.closest('[data-config-key]');
        if (!form) return;
        event.preventDefault();
        const input = form.querySelector('input, select');
        try {
            changeConfigItem(form.dataset.configKey, input.value);
            input.value = '';
            refreshConfigApplication();
            feedback.textContent = 'Item ditambahkan. Perubahan tersimpan.';
            input.focus();
        } catch (error) { feedback.textContent = 'Gagal menambah: ' + error.message; }
    });
    grid.addEventListener('click', event => {
        const button = event.target.closest('[data-config-remove]');
        if (!button) return;
        const key = button.dataset.configRemove;
        try {
            changeConfigItem(key, button.dataset.name, true);
            refreshConfigApplication();
            feedback.textContent = 'Item dihapus dari pilihan. Riwayat transaksi tetap tersimpan.';
            document.getElementById('config-input-' + key).focus();
        } catch (error) { feedback.textContent = 'Gagal menghapus: ' + error.message; }
    });
    const modal = document.getElementById('settings-modal');
    modal.addEventListener('click', event => { if (event.target === modal) closeSystemConfig(); });
    modal.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeSystemConfig();
        if (event.key !== 'Tab') return;
        const controls = [...modal.querySelectorAll('button, input, select, summary, a')].filter(el => !el.disabled && el.getClientRects().length);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
});
