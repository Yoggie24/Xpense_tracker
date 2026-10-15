(() => {
    const params = new URLSearchParams(window.location.search);
    const isDemo = params.get('demo') === '1';
    window.IS_DEMO_MODE = isDemo;

    if (!isDemo) return;

    const storagePrefix = 'fintracker-demo:';
    const originalStorage = window.localStorage;
    const demoKeys = () => {
        const keys = [];
        for (let i = 0; i < originalStorage.length; i += 1) {
            const key = originalStorage.key(i);
            if (key && key.startsWith(storagePrefix)) keys.push(key);
        }
        return keys;
    };
    const demoStorage = new Proxy(originalStorage, {
        get(target, property) {
            if (property === 'length') return demoKeys().length;
            if (property === 'getItem') return key => target.getItem(storagePrefix + key);
            if (property === 'setItem') return (key, value) => target.setItem(storagePrefix + key, String(value));
            if (property === 'removeItem') return key => target.removeItem(storagePrefix + key);
            if (property === 'clear') return () => demoKeys().forEach(key => target.removeItem(key));
            if (property === 'key') return index => {
                const key = demoKeys()[index];
                return key ? key.slice(storagePrefix.length) : null;
            };
            if (typeof property === 'string' && !Reflect.has(target, property)) {
                return target.getItem(storagePrefix + property);
            }
            const value = Reflect.get(target, property, target);
            return typeof value === 'function' ? value.bind(target) : value;
        },
        set(target, property, value) {
            if (typeof property === 'string' && !Reflect.has(target, property)) {
                target.setItem(storagePrefix + property, value);
                return true;
            }
            return Reflect.set(target, property, value, target);
        },
        deleteProperty(target, property) {
            if (typeof property === 'string' && !Reflect.has(target, property)) {
                target.removeItem(storagePrefix + property);
                return true;
            }
            return false;
        }
    });
    Object.defineProperty(window, 'localStorage', { configurable: true, value: demoStorage });

    const dateDaysAgo = days => {
        const date = new Date();
        date.setDate(date.getDate() - days);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    const transactions = [
        { id: 'demo-opening-bca', date: dateDaysAgo(30), description: 'Saldo awal BCA', category: 'Initial Balance', paymentMethod: 'BCA', accountId: 'BCA', type: 'income', amount: 5000000, currency: 'IDR' },
        { id: 'demo-opening-cash', date: dateDaysAgo(30), description: 'Saldo awal tunai', category: 'Initial Balance', paymentMethod: 'Cash', accountId: 'Cash', type: 'income', amount: 1500000, currency: 'IDR' },
        { id: 'demo-opening-gold', date: dateDaysAgo(30), description: 'Saldo awal emas', category: 'Initial Balance', paymentMethod: 'Gold', accountId: 'Gold', type: 'income', amount: 2.5, currency: 'IDR' },
        { id: 'demo-salary', date: dateDaysAgo(3), description: 'Gaji bulanan', category: 'Gaji', paymentMethod: 'BCA', accountId: 'BCA', type: 'income', amount: 18000000, currency: 'IDR' },
        { id: 'demo-food-1', date: dateDaysAgo(1), description: 'Belanja bahan makanan', category: 'Makan', paymentMethod: 'BCA', accountId: 'BCA', type: 'expense', amount: 285000, currency: 'IDR' },
        { id: 'demo-food-2', date: dateDaysAgo(5), description: 'Makan siang', category: 'Makan', paymentMethod: 'Cash', accountId: 'Cash', type: 'expense', amount: 75000, currency: 'IDR' },
        { id: 'demo-transport', date: dateDaysAgo(2), description: 'Transportasi mingguan', category: 'Transportasi', paymentMethod: 'BCA', accountId: 'BCA', type: 'expense', amount: 120000, currency: 'IDR' },
        { id: 'demo-snack', date: dateDaysAgo(1), description: 'Kopi dan camilan', category: 'Jajan', paymentMethod: 'Cash', accountId: 'Cash', type: 'expense', amount: 45000, currency: 'IDR' },
        { id: 'demo-social', date: dateDaysAgo(8), description: 'Makan bersama teman', category: 'Social', paymentMethod: 'Cash', accountId: 'Cash', type: 'expense', amount: 220000, currency: 'IDR' },
        { id: 'demo-health', date: dateDaysAgo(12), description: 'Vitamin dan kebutuhan kesehatan', category: 'Kesehatan', paymentMethod: 'BCA', accountId: 'BCA', type: 'expense', amount: 180000, currency: 'IDR' },
        { id: 'demo-saving', date: dateDaysAgo(10), description: 'TRANSFER / SAVING ALLOCATION: Liburan', category: 'Transfer', subtype: 'saving_allocation', savingsPocketId: 'demo-holiday', paymentMethod: 'BCA', accountId: 'BCA', type: 'expense', amount: 1000000, currency: 'IDR', exchangeRate: 1 }
    ];
    const accountMetadata = {
        BCA: { currency: 'IDR', investment: false },
        Cash: { currency: 'IDR', investment: false },
        Seabank: { currency: 'IDR', investment: false },
        Gold: { currency: 'IDR', investment: true },
        Stocks: { currency: 'IDR', investment: true }
    };
    const month = new Date();
    const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    const sampleData = {
        transactions,
        pockets: [
            { id: 'demo-food-budget', name: 'Makan & Jajan', type: 'budget', target: 2000000, targetBudget: 2000000, categories: ['Makan', 'Jajan'], icon: '🍜', balance: 2000000, allocatedAmount: 2000000 },
            { id: 'demo-transport-budget', name: 'Transportasi', type: 'budget', target: 900000, targetBudget: 900000, categories: ['Transportasi'], icon: '🚌', balance: 900000, allocatedAmount: 900000 },
            { id: 'demo-holiday', name: 'Liburan', type: 'saving', target: 8000000, targetBudget: 8000000, categories: [], icon: '✈️', balance: 1000000, allocatedAmount: 1000000 }
        ],
        appConfig: {
            version: 1,
            expenseCategories: ['Makan', 'Transportasi', 'Jajan', 'Social', 'Kesehatan'],
            incomeCategories: ['Gaji', 'Bonus'],
            idrWallets: ['BCA', 'Cash', 'Seabank'],
            usdWallets: [],
            investmentAccounts: ['Gold', 'Stocks'],
            burnRateExclusions: [],
            accountMetadata
        },
        USD_KURS: '16000',
        GOLD_PRICE: '3000000',
        monthlyIncomeBases: JSON.stringify({ [monthKey]: 18000000 })
    };

    Object.entries(sampleData).forEach(([key, value]) => {
        if (demoStorage.getItem(key) === null) {
            demoStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        const main = document.getElementById('main-content');
        if (!main) return;
        const banner = document.createElement('aside');
        banner.className = 'demo-banner';
        banner.setAttribute('aria-label', 'Informasi mode demo');
        banner.innerHTML = `
            <div class="demo-banner-copy">
                <span class="demo-badge"><i class="fas fa-flask" aria-hidden="true"></i> MODE DEMO</span>
                <p>Data contoh saja. Perubahan tersimpan di browser ini, terpisah dari data asli.</p>
            </div>
            <div class="demo-banner-actions">
                <button type="button" id="reset-demo-data">Ulangi demo</button>
                <a id="exit-demo-mode">Keluar dari demo</a>
            </div>
        `;
        main.insertBefore(banner, main.firstChild);
        document.documentElement.classList.add('demo-mode');
        document.title = 'FinTracker — Demo';

        document.getElementById('reset-demo-data').addEventListener('click', () => {
            demoStorage.clear();
            window.location.reload();
        });
        const exitLink = document.getElementById('exit-demo-mode');
        const normalUrl = new URL(window.location.href);
        normalUrl.searchParams.delete('demo');
        exitLink.href = normalUrl.toString();

        [
            'zpi-api-key',
            'gold-api-save',
            'webhook-url-input',
            'pull-data-btn',
            'push-data-btn'
        ].forEach(id => {
            const control = document.getElementById(id);
            if (control) {
                control.disabled = true;
                control.title = 'Koneksi eksternal dinonaktifkan dalam mode demo.';
            }
        });
        const goldStatus = document.getElementById('gold-api-status');
        if (goldStatus) goldStatus.textContent = 'Koneksi harga live dinonaktifkan dalam mode demo.';
        const spreadsheetStatus = document.getElementById('spreadsheet-status');
        if (spreadsheetStatus) spreadsheetStatus.textContent = 'Sinkronisasi spreadsheet dinonaktifkan dalam mode demo.';
    });
})();
