// Default configuration hardcoded from Keuangan.xlsx
const DEFAULT_CONFIG = {
    "categories": [
        { "name": "Makan", "icon": "", "starting": 0, "type": "Outcome" },
        { "name": "Minuman", "icon": "", "starting": 0, "type": "Outcome" },
        { "name": "Sedekah", "icon": "", "starting": 0, "type": "Outcome" },
        { "name": "Fashion", "icon": "", "starting": 0, "type": "Outcome" },
        { "name": "Gold", "icon": "", "starting": 0, "type": "Outcome" },
        { "name": "Transportasi", "icon": "", "starting": 0, "type": "Outcome" },
        { "name": "Other", "icon": "", "starting": 0, "type": "Outcome" },
        { "name": "Rokok", "icon": "", "starting": 0, "type": "Outcome" },
        { "name": "Pindah uang", "icon": "", "starting": 0, "type": "Outcome" },
        { "name": "Kesehatan", "icon": "", "starting": 0, "type": "Outcome" },
        { "name": "Social", "icon": "", "starting": 0, "type": "Outcome" },
        { "name": "Jajan", "icon": "", "starting": 0, "type": "Outcome" },
        { "name": "Gaji", "icon": "", "starting": 0, "type": "Income" },
        { "name": "Bonus", "icon": "", "starting": 0, "type": "Income" },
        { "name": "Sisa", "icon": "", "starting": 0, "type": "Income" },
        { "name": "Other", "icon": "", "starting": 0, "type": "Income" }
    ],
    "paymentMethods": [
        { "name": "Shopeepay", "icon": "", "starting": 0 },
        { "name": "Gopay", "icon": "", "starting": 0 },
        { "name": "Seabank", "icon": "", "starting": 3283419.0 },
        { "name": "BCA", "icon": "", "starting": 192698.0 },
        { "name": "Mandiri", "icon": "", "starting": 21550.0 },
        { "name": "Jenius", "icon": "", "isUSD": true, "starting": 705.0 },
        { "name": "BCA Vallas", "icon": "", "isUSD": true, "starting": 5.0 },
        { "name": "Gold", "icon": "", "starting": 0, "isInvestment": true },
        { "name": "Stocks", "icon": "", "starting": 0, "isInvestment": true },
        { "name": "Cash", "icon": "", "starting": 0.0 }
    ]
};

let dailyChartInstance = null;
let incomePieChartInstance = null;
let outcomePieChartInstance = null;
let USD_KURS = 16000; // Default Kurs USD
let TREND_RANGE = 7; // Default chart range (7 days)

// Google Drive Client
let tokenClient;
let gapiInited = false;
let gisInited = false;

// Get/Load Kurs from storage
function getKurs() {
    const savedKurs = localStorage.getItem('usd_kurs');
    return savedKurs ? parseFloat(savedKurs) : 16000;
}

// Save Kurs to storage
function saveKurs(val) {
    localStorage.setItem('usd_kurs', val);
    USD_KURS = val;
    updateBalance();
}

// Get all transactions from browser storage
function getTransactions() {
    const transactions = localStorage.getItem('transactions');
    return transactions ? JSON.parse(transactions) : [];
}

// Save transactions to browser storage
function saveTransactions(transactions) {
    localStorage.setItem('transactions', JSON.stringify(transactions));
}

// Format number to Indonesian Rupiah
function formatMoney(amount, currency = 'IDR') {
    if (currency === 'USD') {
        return '$ ' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return 'Rp ' + amount.toLocaleString('id-ID');
}

// Thousand separator helpers for input fields
function addThousandSeparator(value) {
    // Strip non-digits, then format with dots
    const num = String(value).replace(/[^0-9]/g, '');
    if (!num) return '';
    return parseInt(num, 10).toLocaleString('id-ID');
}

function parseFormattedNumber(value) {
    // Remove dots (id-ID thousand separator) and parse
    return parseFloat(String(value).replace(/\./g, '').replace(/,/g, '.')) || 0;
}

// Get/Load configuration
// Get/Load configuration
function getConfig() {
    const configStr = localStorage.getItem('moneyTrackerConfig');
    let config = configStr ? JSON.parse(configStr) : JSON.parse(JSON.stringify(DEFAULT_CONFIG));

    // MIGRATION: Ensure correct flags for specific assets
    let changed = false;
    config.paymentMethods.forEach(m => {
        const name = m.name.toLowerCase();

        // Fix USD Assets
        if (name.includes('jenius') || name.includes('vallas')) {
            if (!m.isUSD) {
                m.isUSD = true;
                changed = true;
            }
        }

        // Fix Investment Assets
        if (name.includes('investasi') || name.includes('gold') || name.includes('saham') || name.includes('stock') || name.includes('reksadana')) {
            if (!m.isInvestment) {
                m.isInvestment = true;
                changed = true;
            }
            // MIGRATION: Rename "Investasi" -> "Gold", "Saham" -> "Stocks"
            if (m.name === 'Investasi') {
                m.name = 'Gold';
                changed = true;
            }
            if (m.name === 'Saham') {
                m.name = 'Stocks';
                changed = true;
            }
            // Ensure Qty/Price properties exist for Gold/Stocks
            if ((name.includes('gold') || name.includes('stock') || name.includes('saham')) && m.qty === undefined) {
                m.qty = 0;
                m.price = 0;
                changed = true;
            }
        }

        // MIGRATION: Stripping icons for minimalist look
        if (m.icon !== "") {
            m.icon = "";
            changed = true;
        }
    });

    config.categories.forEach(c => {
        if (c.icon !== "") {
            c.icon = "";
            changed = true;
        }
    });

    // Ensure Stocks row exists if missing (it's a new default)
    if (!config.paymentMethods.find(m => m.name === 'Stocks')) {
        config.paymentMethods.push({ "name": "Stocks", "icon": "", "starting": 0, "isInvestment": true, "qty": 0, "price": 0 });
        changed = true;
    }

    // Ensure new Outcome categories exist
    ['Social', 'Jajan'].forEach(newCat => {
        if (!config.categories.find(c => c.name === newCat && c.type === 'Outcome')) {
            config.categories.push({ "name": newCat, "icon": "", "starting": 0, "type": "Outcome" });
            changed = true;
        }
    });

    if (changed) {
        saveConfig(config);
    }

    // MIGRATION: Update transactions to use "Gold"/"Stocks" instead of "Investasi"/"Saham"
    const transactions = getTransactions();
    let transChanged = false;
    transactions.forEach(t => {
        if (t.paymentMethod === 'Investasi') {
            t.paymentMethod = 'Gold';
            transChanged = true;
        }
        if (t.paymentMethod === 'Saham') {
            t.paymentMethod = 'Stocks';
            transChanged = true;
        }
        if (t.category === 'Investasi') {
            t.category = 'Gold';
            transChanged = true;
        }
        if (t.category === 'Saham') {
            t.category = 'Stocks';
            transChanged = true;
        }
    });
    if (transChanged) {
        saveTransactions(transactions);
    }

    return config;
}

// Save configuration
function saveConfig(config) {
    localStorage.setItem('moneyTrackerConfig', JSON.stringify(config));
    populateSelects();
}

// Populate select elements based on config
function populateSelects() {
    try {
        const config = getConfig();
        const categorySelect = document.getElementById('category');
        const paymentSelect = document.getElementById('paymentMethod');
        const typeInput = document.getElementById('type');

        if (!categorySelect || !paymentSelect || !typeInput) return;

        const type = typeInput.value; // 'expense' or 'income'
        // Normalize type matching to be case-insensitive and robust
        const targetType = type.toLowerCase() === 'expense' ? 'outcome' : 'income';

        // Clear existing options (except placeholder)
        categorySelect.innerHTML = '<option value="">Select Category</option>';
        paymentSelect.innerHTML = '<option value="">Select Payment Method</option>';

        // Filter categories by type (case-insensitive)
        const filteredCategories = config.categories.filter(cat => {
            if (!cat.type) return true; // Show if type is missing
            return cat.type.toLowerCase() === targetType;
        });

        filteredCategories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = `${cat.icon || '🛍️'} ${cat.name}`;
            categorySelect.appendChild(option);
        });

        config.paymentMethods.forEach(method => {
            const option = document.createElement('option');
            option.value = method.name;
            option.textContent = `${method.icon || '🏦'} ${method.name}`;
            paymentSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error populating selects:", error);
    }
}

// Export config to CSV
function exportConfig() {
    const config = getConfig();
    let csv = 'Type,Name,Icon\n';

    config.categories.forEach(c => csv += `Category,${c.name},${c.icon}\n`);
    config.paymentMethods.forEach(m => csv += `PaymentMethod,${m.name},${m.icon}\n`);

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', 'money-tracker-config.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Import config (Supports both CSV and Excel)
// Modified to specifically handle Keuangan.xlsx structure
// mode: 'all' (default), 'data' (transactions/balances only), 'format' (categories/methods only)
function importConfig(file, isSilent = false, mode = 'all') {
    const reader = new FileReader();
    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Standardize sheet name lookup (case-insensitive)
        const sheetNames = workbook.SheetNames;
        const findSheet = (name) => sheetNames.find(s => s.toLowerCase() === name.toLowerCase());

        const listSheetName = findSheet('List');
        const rasioSheetName = findSheet('Rasio');
        const trackerSheetName = findSheet('Money_tracker');

        const currentConfig = getConfig();
        const newFormat = { categories: [], paymentMethods: [] };
        let transactionsToSave = null;

        // 1. Process Format (Sheet: 'List')
        if (listSheetName && (mode === 'all' || mode === 'format')) {
            const listSheet = workbook.Sheets[listSheetName];
            const listData = XLSX.utils.sheet_to_json(listSheet);

            listData.forEach(row => {
                // Find keys case-insensitively
                const getVal = (obj, keyName) => {
                    const foundKey = Object.keys(obj).find(k => k.toLowerCase().trim() === keyName.toLowerCase());
                    return foundKey ? obj[foundKey] : null;
                };

                const metodo = getVal(row, 'Metode');
                const outcomeItem = getVal(row, 'Outcome List');
                const incomeItem = getVal(row, 'Income List');

                if (metodo) {
                    newFormat.paymentMethods.push({ name: metodo, icon: '', starting: 0 });
                }
                if (outcomeItem) {
                    newFormat.categories.push({ name: outcomeItem, icon: '', starting: 0, type: 'Outcome' });
                }
                if (incomeItem) {
                    newFormat.categories.push({ name: incomeItem, icon: '', starting: 0, type: 'Income' });
                }
            });
        }

        // 2. Process Starting Balances (Sheet: 'Rasio')
        if (rasioSheetName && (mode === 'all' || mode === 'data')) {
            const rasioSheet = workbook.Sheets[rasioSheetName];
            const rasioData = XLSX.utils.sheet_to_json(rasioSheet, { header: 1 });

            let headers = [];
            let headerRowIdx = -1;
            for (let i = 0; i < Math.min(rasioData.length, 10); i++) {
                const row = rasioData[i] || [];
                const rowStr = row.map(v => String(v).toLowerCase());
                if (rowStr.includes('item') && (rowStr.includes('idr') || rowStr.includes('saldo'))) {
                    headers = row;
                    headerRowIdx = i;
                    break;
                }
            }

            if (headerRowIdx !== -1) {
                const findIdx = (names) => headers.findIndex(h => names.includes(String(h).toLowerCase().trim()));
                const itemIdx = findIdx(['item']);
                const idrIdx = findIdx(['idr', 'saldo', 'balance']);
                const usdIdx = findIdx(['usd']);

                const targetMethods = (mode === 'data') ? currentConfig.paymentMethods : newFormat.paymentMethods;

                for (let i = headerRowIdx + 1; i < rasioData.length; i++) {
                    const row = rasioData[i];
                    if (!row) continue;
                    const itemName = row[itemIdx];
                    if (!itemName || itemName === 'Grand Total') continue;

                    const idrValue = parseFloat(row[idrIdx] || 0);
                    const usdValue = usdIdx !== -1 ? parseFloat(row[usdIdx] || 0) : 0;

                    const method = targetMethods.find(m => m.name.trim().toLowerCase() === String(itemName).trim().toLowerCase());
                    if (method) {
                        if (usdValue > 0 || itemName.toLowerCase().includes('vallas') || itemName.toLowerCase().includes('jenius')) {
                            method.isUSD = true;
                            method.starting = usdValue;
                        } else {
                            method.starting = idrValue;
                        }
                        if (['gold', 'saham', 'investasi', 'stocks'].some(kw => itemName.toLowerCase().includes(kw))) {
                            method.isInvestment = true;
                            if (method.qty === undefined) { method.qty = 0; method.price = 0; }
                        }
                    }
                }
            }
        }

        // 3. Process Transactions (Sheet: 'Money_tracker')
        if (trackerSheetName && (mode === 'all' || mode === 'data')) {
            const trackerSheet = workbook.Sheets[trackerSheetName];
            const trackerData = XLSX.utils.sheet_to_json(trackerSheet);
            const transactions = [];

            trackerData.forEach((row, index) => {
                const getVal = (obj, keyName) => {
                    const foundKey = Object.keys(obj).find(k => k.toLowerCase().trim() === keyName.toLowerCase());
                    return foundKey ? obj[foundKey] : null;
                };

                const jenis = String(getVal(row, 'Jenis') || '').toLowerCase().trim();
                const type = (jenis === 'income' || jenis === 'pemasukan' || jenis === 'in') ? 'income' : 'expense';
                const jumlah = parseFloat(getVal(row, 'Jumlah') || 0);

                if (jumlah > 0) {
                    transactions.push({
                        id: Date.now() + index,
                        description: getVal(row, 'Keterangan') || 'Imported',
                        amount: jumlah,
                        category: getVal(row, 'Kategori') || 'Other',
                        type: type,
                        paymentMethod: getVal(row, 'Metode Pembayaran') || 'Cash',
                        date: getVal(row, 'Date') ? new Date(getVal(row, 'Date')).toISOString() : new Date().toISOString()
                    });
                }
            });
            if (transactions.length > 0) transactionsToSave = transactions;
        }

        // Execute Save Logic
        let success = false;
        if (mode === 'format' && newFormat.categories.length > 0) {
            currentConfig.categories = newFormat.categories;
            currentConfig.paymentMethods = newFormat.paymentMethods;
            saveConfig(currentConfig);
            success = true;
        } else if (mode === 'data') {
            if (transactionsToSave) saveTransactions(transactionsToSave);
            saveConfig(currentConfig); // Saves adjusted starting balances
            success = true;
        } else if (mode === 'all' && (newFormat.categories.length > 0 || transactionsToSave)) {
            if (newFormat.categories.length > 0) {
                newFormat.categories.forEach(c => currentConfig.categories.push(c)); // Simplified merge
                // Better: overwrite if all
                saveConfig(newFormat);
            }
            if (transactionsToSave) saveTransactions(transactionsToSave);
            success = true;
        }

        if (success) {
            populateSelects();
            updateBalance();
            displayTransactions();
            if (!isSilent) alert(`Successfully synced ${mode} from ${file.name}!`);
        } else if (!isSilent) {
            alert('Could not find requested data in the file.');
        }
    };
    reader.readAsArrayBuffer(file);
}

// End of importConfig


// Calculate totals including starting balances and periodic summaries
function calculateTotals() {
    const transactions = getTransactions();
    const config = getConfig();

    let totalIncome = 0;
    let totalExpense = 0;
    const methodTotals = {};

    // Periodic summaries
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    let weeklyOutcome = 0;
    let monthlyOutcome = 0;

    // Initialize method totals with starting balances or Qty*Price
    config.paymentMethods.forEach(method => {
        if (method.isInvestment && method.qty !== undefined) {
            methodTotals[method.name] = (method.qty || 0) * (method.price || 0);
        } else {
            methodTotals[method.name] = method.starting || 0;
        }
    });

    transactions.forEach(transaction => {
        const amount = transaction.amount;
        const method = transaction.paymentMethod;
        const transDate = new Date(transaction.date);

        if (methodTotals[method] === undefined) {
            methodTotals[method] = 0;
        }

        // For Qty-based assets, transactions act as IDR value adjustments if they exist, 
        // but usually we rely on Qty*Price. Let's make it so transactions still apply 
        // unless it's specifically a Qty asset where we might want to track Qty change?
        // To keep it simple, we'll let transactions apply to the "Total" value.
        // However, if it's Gold/Saham, the user wants to see Qty and Price.

        if (transaction.type === 'income') {
            totalIncome += amount;
            methodTotals[method] += amount;
        } else {
            totalExpense += amount;
            methodTotals[method] -= amount;

            if (transDate >= startOfWeek) weeklyOutcome += amount;
            if (transDate >= startOfMonth) monthlyOutcome += amount;
        }
    });

    // Total balance is sum of all method current totals
    const usdMethods = config.paymentMethods.filter(m => m.isUSD).map(m => m.name);
    const balance = Object.keys(methodTotals).reduce((sum, name) => {
        const val = methodTotals[name];
        const methodConfig = config.paymentMethods.find(m => m.name === name);
        if (methodConfig && methodConfig.isUSD) {
            return sum + (val * getKurs());
        }
        return sum + val;
    }, 0);

    return { totalIncome, totalExpense, balance, methodTotals, weeklyOutcome, monthlyOutcome };
}

// Update balance display and summary table
function updateBalance() {
    const { totalIncome, totalExpense, balance, methodTotals, weeklyOutcome, monthlyOutcome } = calculateTotals();
    const config = getConfig();

    const totalBalanceEl = document.getElementById('totalBalance');
    const totalIncomeEl = document.getElementById('totalIncome');
    const totalExpenseEl = document.getElementById('totalExpense');

    if (totalBalanceEl) totalBalanceEl.textContent = formatMoney(balance);
    if (totalIncomeEl) totalIncomeEl.textContent = formatMoney(totalIncome);
    if (totalExpenseEl) totalExpenseEl.textContent = formatMoney(totalExpense);

    // Update Periodic Summary in UI
    const weeklyEl = document.getElementById('weeklyOutcome');
    const monthlyEl = document.getElementById('monthlyOutcome');
    if (weeklyEl) weeklyEl.textContent = formatMoney(weeklyOutcome);
    if (monthlyEl) monthlyEl.textContent = formatMoney(monthlyOutcome);

    // Update Asset Summary Table (Rasio)
    // Update Asset Summary Tables (IDR, USD, Investment)
    const tableIDR = document.querySelector('#assetTableIDR tbody');
    const tableUSD = document.querySelector('#assetTableUSD tbody');
    const tableInvest = document.querySelector('#assetTableInvest tbody');

    if (tableIDR && tableUSD && tableInvest) {
        const idrAssets = config.paymentMethods.filter(m => !m.isUSD && !m.isInvestment);
        const usdAssets = config.paymentMethods.filter(m => m.isUSD);
        const investAssets = config.paymentMethods.filter(m => m.isInvestment);

        const kurs = getKurs();

        // 1. Render IDR Assets
        let htmlIDR = '';
        idrAssets.forEach(m => {
            const current = methodTotals[m.name] || 0;
            htmlIDR += `
                <tr>
                    <td>${m.icon || '🏦'} ${m.name}</td>
                    <td class="editable-cell" onclick="handleManualAdjustment('${m.name}', ${current})">
                        ${formatMoney(current)}
                    </td>
                    <td>
                        <button class="icon-btn-small" onclick="handleManualAdjustment('${m.name}', ${current})">✏️</button>
                    </td>
                </tr>
            `;
        });
        tableIDR.innerHTML = htmlIDR;

        // 2. Render USD Assets
        let htmlUSD = '';
        usdAssets.forEach(m => {
            const currentUSD = methodTotals[m.name] || 0; // This is actually stored as USD value if it's starting balance? 
            // Wait, calculateTotals converts everything to IDR in 'methodTotals'??
            // checking calculateTotals:
            // if (method.isUSD) we do methodTotals[m.name] = method.starting. 
            // In calculateTotals, "return sum + (val * getKurs())" for balance.
            // So methodTotals[name] holds the RAW value (USD amount).

            const totalIDR = currentUSD * kurs;


            htmlUSD += `
                <tr>
                    <td>${m.icon || '🏦'} ${m.name}</td>
                    <td class="editable-cell" onclick="handleManualAdjustment('${m.name}', ${currentUSD})">
                        ${formatMoney(currentUSD, 'USD')}
                    </td>
                    <td class="editable-cell" onclick="handleKursPrompt()">
                        ${formatMoney(kurs)}
                    </td>
                    <td>${formatMoney(totalIDR)}</td>
                </tr>
            `;
        });
        tableUSD.innerHTML = htmlUSD;

        // 3. Render Investment Assets
        let htmlInvest = '';
        investAssets.forEach(m => {
            const qty = m.qty || 0;
            const price = m.price || 0;
            const totalValue = qty * price;

            htmlInvest += `
                <tr>
                    <td>${m.icon || ''} ${m.name}</td>
                    <td class="editable-cell" onclick="handleInvestmentAdjust('${m.name}', 'qty')">
                        ${qty.toLocaleString()}
                    </td>
                    <td class="editable-cell" onclick="handleInvestmentAdjust('${m.name}', 'price')">
                        ${formatMoney(price)}
                    </td>
                    <td>${formatMoney(totalValue)}</td>
                </tr>
            `;
        });
        tableInvest.innerHTML = htmlInvest;
    }

    const totalCurrentEl = document.getElementById('totalCurrent');
    if (totalCurrentEl) totalCurrentEl.textContent = formatMoney(balance);

    // Render charts if Dashboard is active
    if (document.getElementById('dashboard-page') && document.getElementById('dashboard-page').classList.contains('active')) {
        renderDailyChart();
        renderPieCharts();
    }
}
// Switch between tabs
function switchTab(tabId) {
    const pages = document.querySelectorAll('.page');
    const tabBtns = document.querySelectorAll('.tab-btn');

    pages.forEach(p => p.classList.remove('active'));
    tabBtns.forEach(b => b.classList.remove('active'));

    const activePage = document.getElementById(`${tabId}-page`);
    const activeBtn = document.getElementById(`tab-${tabId}`);

    if (activePage) activePage.classList.add('active');
    if (activeBtn) activeBtn.classList.add('active');

    if (tabId === 'dashboard') {
        renderDailyChart();
        renderPieCharts();
    } else if (tabId === 'settings') {
        updateRatesDisplay();
    }
}

// Handle Kurs Update Prompt
function handleKursPrompt() {
    const currentKurs = getKurs();
    const input = prompt("Enter current USD to IDR Kurs:", addThousandSeparator(currentKurs));
    if (input === null || input === "") return;

    const newKurs = parseFormattedNumber(input);
    if (newKurs > 0) {
        saveKurs(newKurs);
        alert(`Kurs updated to ${formatMoney(newKurs)}`);
    } else {
        alert("Please enter a valid number.");
    }
}
// Fetch latest USD/IDR exchange rate
async function fetchKurs() {
    const syncStatus = document.getElementById('syncStatus');
    try {
        const resp = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await resp.json();

        if (data && data.rates && data.rates.IDR) {
            const newKurs = data.rates.IDR;
            saveKurs(newKurs);
            updateBalance();
            updateRatesDisplay();
            if (syncStatus) {
                syncStatus.textContent = `✅ USD Kurs updated: ${formatMoney(newKurs)} (${new Date().toLocaleTimeString()})`;
                syncStatus.style.color = '#10b981';
            }
            alert(`USD Kurs updated!\nNew rate: ${formatMoney(newKurs)}`);
            return true;
        }
    } catch (e) {
        console.error("Kurs Sync Error:", e);
    }
    if (syncStatus) {
        syncStatus.textContent = "❌ Failed to update USD Kurs.";
        syncStatus.style.color = '#ef4444';
    }
    alert("Failed to fetch USD Kurs. Check your connection.");
    return false;
}


// Fetch latest Gold price (XAU/USD → IDR/gram)
async function fetchGoldPrice() {
    const syncStatus = document.getElementById('syncStatus');
    const GOLD_URL = 'https://data-asg.goldprice.org/dbXRates/USD';
    const PROXY_URL = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(GOLD_URL);

    let goldData = null;

    // Use CORS proxy as primary (direct goldprice.org is CORS-blocked in browsers)
    try {
        const resp = await fetch(PROXY_URL);
        if (resp.ok) {
            goldData = await resp.json();
        }
    } catch (e) {
        console.warn("Proxy gold fetch failed, trying direct...", e);
    }

    // Fallback: try direct (in case proxy is down)
    if (!goldData) {
        try {
            const resp = await fetch(GOLD_URL);
            if (resp.ok) {
                goldData = await resp.json();
            }
        } catch (e2) {
            console.error("Direct gold fetch also failed:", e2);
        }
    }

    if (goldData && goldData.items && goldData.items.length > 0) {
        const xauUsd = goldData.items[0].xauPrice;
        const kurs = getKurs();
        const goldIdrPerGram = Math.round((xauUsd * kurs) / 31.1035);

        const config = getConfig();
        const goldAsset = config.paymentMethods.find(m => m.name === 'Gold');
        if (goldAsset) {
            goldAsset.price = goldIdrPerGram;
            saveConfig(config);
            updateBalance();
            updateRatesDisplay();
            if (syncStatus) {
                syncStatus.textContent = `✅ Gold: ${formatMoney(goldIdrPerGram)}/gram (XAU: $${xauUsd.toLocaleString()}) — ${new Date().toLocaleTimeString()}`;
                syncStatus.style.color = '#10b981';
            }
            alert(`Gold price updated!\nXAU/USD: $${xauUsd.toLocaleString()}\nIDR/gram: ${formatMoney(goldIdrPerGram)}`);
            return true;
        } else {
            alert("Gold asset not found in your configuration.");
        }
    } else {
        if (syncStatus) {
            syncStatus.textContent = "❌ Failed to update Gold price.";
            syncStatus.style.color = '#ef4444';
        }
        alert("Failed to fetch Gold price. Check your connection.");
    }
    return false;
}

// Sync all rates at once
async function syncAllRates() {
    const syncStatus = document.getElementById('syncStatus');
    if (syncStatus) {
        syncStatus.textContent = "⏳ Syncing all rates...";
        syncStatus.style.color = 'var(--text-muted)';
    }

    const kursOk = await fetchKursQuiet();
    const goldOk = await fetchGoldQuiet();

    const parts = [];
    if (kursOk) parts.push(`Kurs: ${formatMoney(getKurs())}`);
    if (goldOk) {
        const config = getConfig();
        const g = config.paymentMethods.find(m => m.name === 'Gold');
        if (g) parts.push(`Gold: ${formatMoney(g.price)}/gram`);
    }

    updateBalance();
    updateRatesDisplay();

    if (kursOk || goldOk) {
        if (syncStatus) {
            syncStatus.textContent = `✅ Synced: ${new Date().toLocaleTimeString()} — ${parts.join(' | ')}`;
            syncStatus.style.color = '#10b981';
        }
        alert(`Rates updated!\n${parts.join('\n')}`);
    } else {
        if (syncStatus) {
            syncStatus.textContent = "❌ Sync failed. Check your connection.";
            syncStatus.style.color = '#ef4444';
        }
        alert("Failed to fetch rates. Check your internet connection.");
    }
}

// Quiet versions (no individual alerts, for use in syncAll)
async function fetchKursQuiet() {
    try {
        const resp = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await resp.json();
        if (data && data.rates && data.rates.IDR) {
            saveKurs(data.rates.IDR);
            return true;
        }
    } catch (e) { console.error("Kurs Sync Error:", e); }
    return false;
}

async function fetchGoldQuiet() {
    const GOLD_URL = 'https://data-asg.goldprice.org/dbXRates/USD';
    const PROXY_URL = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(GOLD_URL);
    let goldData = null;

    try {
        const resp = await fetch(PROXY_URL);
        if (resp.ok) goldData = await resp.json();
    } catch (e) {
        try {
            const resp = await fetch(GOLD_URL);
            if (resp.ok) goldData = await resp.json();
        } catch (e2) { console.error("Gold fetch failed:", e2); }
    }

    if (goldData && goldData.items && goldData.items.length > 0) {
        const xauUsd = goldData.items[0].xauPrice;
        const kurs = getKurs();
        const goldIdrPerGram = Math.round((xauUsd * kurs) / 31.1035);
        const config = getConfig();
        const goldAsset = config.paymentMethods.find(m => m.name === 'Gold');
        if (goldAsset) {
            goldAsset.price = goldIdrPerGram;
            saveConfig(config);
            return true;
        }
    }
    return false;
}

// Display current saved rates in settings panel
function updateRatesDisplay() {
    const display = document.getElementById('currentRatesDisplay');
    if (!display) return;

    const kurs = getKurs();
    const config = getConfig();
    const goldAsset = config.paymentMethods.find(m => m.name === 'Gold');
    const goldPrice = goldAsset ? goldAsset.price || 0 : 0;

    display.innerHTML = `
        <div class="rate-item">
            <span class="rate-label">💵 USD Kurs</span>
            <span class="rate-value">${formatMoney(kurs)}</span>
        </div>
        <div class="rate-item">
            <span class="rate-label">🥇 Gold Price/gram</span>
            <span class="rate-value">${formatMoney(goldPrice)}</span>
        </div>
    `;
}


// Handle Investment Qty/Price adjustment
function handleInvestmentAdjust(methodName, field) {
    const config = getConfig();
    const methodConfig = config.paymentMethods.find(m => m.name === methodName);
    if (!methodConfig) return;

    const currentValue = field === 'qty' ? methodConfig.qty || 0 : methodConfig.price || 0;
    const label = field === 'qty' ? 'Quantity' : 'Price';
    const input = prompt(`Enter new ${label} for ${methodName}:`, addThousandSeparator(currentValue));

    if (input === null || input === "") return;

    const newValue = parseFormattedNumber(input);
    if (newValue >= 0) {
        if (field === 'qty') {
            methodConfig.qty = newValue;
        } else {
            methodConfig.price = newValue;
        }
        saveConfig(config);
        updateBalance();
        alert(`${methodName} ${label} updated to ${field === 'qty' ? newValue.toLocaleString('id-ID') : formatMoney(newValue)}`);
    } else {
        alert("Please enter a valid number.");
    }
}

// Handle manual adjustment of asset total
function handleManualAdjustment(methodName, currentValue) {
    const input = prompt(`Enter new total for ${methodName}:`, addThousandSeparator(currentValue));
    if (input === null || input === "") return;

    const newTotal = parseFormattedNumber(input);
    if (newTotal === 0 && input.replace(/[^0-9]/g, '') !== '0') {
        alert("Please enter a valid number.");
        return;
    }

    const config = getConfig();
    const transactions = getTransactions();

    // Calculate current transaction effect
    let transactionEffect = 0;
    transactions.forEach(t => {
        if (t.paymentMethod === methodName) {
            transactionEffect += (t.type === 'income' ? t.amount : -t.amount);
        }
    });

    // New Starting = Target Total - Transaction Effect
    const newStarting = newTotal - transactionEffect;

    const methodConfig = config.paymentMethods.find(m => m.name === methodName);
    if (methodConfig) {
        methodConfig.starting = newStarting;
        saveConfig(config);
        updateBalance();
        alert(`${methodName} adjusted to ${formatMoney(newTotal)}`);
    }
}

// Group outcomes for Chart.js
function groupOutcomesByDate(days = 7) {
    const transactions = getTransactions();
    const labels = [];
    const data = [];

    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];

        const dayTotal = transactions
            .filter(t => t.type === 'expense' && t.date.split('T')[0] === dateStr)
            .reduce((sum, t) => sum + t.amount, 0);

        // Format label: short weekday for 7D, numeric for 30D
        const labelText = days <= 7
            ? d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' })
            : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

        labels.push(labelText);
        data.push(dayTotal);
    }

    return { labels, data };
}

// Update Trend Range
function updateTrendRange(days) {
    TREND_RANGE = days;

    // Update UI buttons
    document.querySelectorAll('.trend-range-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.days) === days);
    });

    renderDailyChart();
}

// Render Daily Trend Chart
function renderDailyChart() {
    const canvas = document.getElementById('dailyChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const chartData = groupOutcomesByDate(TREND_RANGE);

    if (dailyChartInstance) {
        dailyChartInstance.destroy();
    }

    dailyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Outcome Trend',
                data: chartData.data,
                borderColor: '#0060af',
                backgroundColor: 'rgba(0, 96, 175, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: TREND_RANGE > 7 ? 4 : 6,
                pointBackgroundColor: '#0060af',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: (v) => formatMoney(v) }
                },
                x: {
                    ticks: {
                        autoSkip: true,
                        maxRotation: 0,
                        font: { size: 10 }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (c) => ` Outcome: ${formatMoney(c.raw)}`
                    }
                }
            }
        }
    });
}

// Aggregate monthly category data
function aggregateMonthlyCategories() {
    const transactions = getTransactions();
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const incomeData = {};
    const outcomeData = {};

    transactions.forEach(t => {
        const transDate = new Date(t.date);
        if (transDate >= startOfMonth) {
            const cat = t.category || 'Other';
            if (t.type === 'income') {
                incomeData[cat] = (incomeData[cat] || 0) + t.amount;
            } else {
                outcomeData[cat] = (outcomeData[cat] || 0) + t.amount;
            }
        }
    });

    return {
        income: {
            labels: Object.keys(incomeData),
            values: Object.values(incomeData)
        },
        outcome: {
            labels: Object.keys(outcomeData),
            values: Object.values(outcomeData)
        }
    };
}

// Render Monthly Pie Charts
function renderPieCharts() {
    const data = aggregateMonthlyCategories();
    // A palette of vibrant, harmonious colors for the pie charts
    const colors = [
        '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b',
        '#858796', '#5a5c69', '#6610f2', '#6f42c1', '#e83e8c'
    ];

    // Income Pie Chart
    const incomeCanvas = document.getElementById('incomePieChart');
    if (incomeCanvas) {
        if (incomePieChartInstance) incomePieChartInstance.destroy();
        if (data.income.labels.length > 0) {
            const total = data.income.values.reduce((a, b) => a + b, 0);
            incomePieChartInstance = new Chart(incomeCanvas, {
                type: 'doughnut',
                data: {
                    labels: data.income.labels,
                    datasets: [{
                        data: data.income.values,
                        backgroundColor: colors,
                        hoverOffset: 12,
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: 12,
                                padding: 15,
                                font: { size: 11, family: "'Inter', sans-serif", weight: '500' }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const value = context.raw;
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return ` ${context.label}: ${formatMoney(value)} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        } else {
            const ctx = incomeCanvas.getContext('2d');
            ctx.clearRect(0, 0, incomeCanvas.width, incomeCanvas.height);
            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#6b7280';
            ctx.textAlign = 'center';
            ctx.fillText('No Income data', incomeCanvas.width / 2, incomeCanvas.height / 2);
        }
    }

    // Outcome Pie Chart
    const outcomeCanvas = document.getElementById('outcomePieChart');
    if (outcomeCanvas) {
        if (outcomePieChartInstance) outcomePieChartInstance.destroy();
        if (data.outcome.labels.length > 0) {
            const total = data.outcome.values.reduce((a, b) => a + b, 0);
            outcomePieChartInstance = new Chart(outcomeCanvas, {
                type: 'doughnut',
                data: {
                    labels: data.outcome.labels,
                    datasets: [{
                        data: data.outcome.values,
                        backgroundColor: colors,
                        hoverOffset: 12,
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: 12,
                                padding: 15,
                                font: { size: 11, family: "'Inter', sans-serif", weight: '500' }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const value = context.raw;
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return ` ${context.label}: ${formatMoney(value)} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        } else {
            const ctx = outcomeCanvas.getContext('2d');
            ctx.clearRect(0, 0, outcomeCanvas.width, outcomeCanvas.height);
            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#6b7280';
            ctx.textAlign = 'center';
            ctx.fillText('No Outcome data', outcomeCanvas.width / 2, outcomeCanvas.height / 2);
        }
    }
}

// Display all transactions
function displayTransactions() {
    const transactions = getTransactions();
    const transactionsList = document.getElementById('transactionsList');

    if (transactions.length === 0) {
        transactionsList.innerHTML = `
            <div class="empty-state">
                <p>No transactions yet</p>
                <p class="empty-subtitle">Add your first transaction above!</p>
            </div>
        `;
        return;
    }

    // Sort by newest first
    transactions.sort((a, b) => b.id - a.id);

    transactionsList.innerHTML = transactions.map(transaction => {
        const config = getConfig();
        const method = config.paymentMethods.find(m => m.name === transaction.paymentMethod);
        const isUSD = method && method.isUSD;

        return `
        <div class="transaction-item ${transaction.type}">
            <div class="transaction-info">
                <div class="transaction-date">${new Date(transaction.date).toLocaleDateString('id-ID')}</div>
                <div class="transaction-description">${transaction.description}</div>
                <div class="transaction-category" onclick="editTransactionCategory(${transaction.id})">🏷️ ${transaction.category}</div>
                <div class="transaction-payment">${transaction.paymentMethod || 'N/A'}</div>
            </div>
            <div class="transaction-amount ${transaction.type}" onclick="editTransactionAmount(${transaction.id})">
                ${transaction.type === 'expense' ? '-' : '+'} ${formatMoney(transaction.amount, isUSD ? 'USD' : 'IDR')}
            </div>
            <button class="delete-btn" onclick="deleteTransaction(${transaction.id})">🗑️</button>
        </div>
    `;
    }).join('');
}

// Add new transaction
function addTransaction(date, description, amount, category, type, paymentMethod) {
    const transactions = getTransactions();

    const newTransaction = {
        id: Date.now(),
        description: description,
        amount: parseFloat(amount),
        category: category,
        type: type,
        paymentMethod: paymentMethod,
        date: date || new Date().toISOString()
    };

    transactions.push(newTransaction);
    saveTransactions(transactions);

    updateBalance();
    displayTransactions();
}

// Delete transaction
function deleteTransaction(id) {
    if (confirm('Are you sure you want to delete this transaction?')) {
        let transactions = getTransactions();
        transactions = transactions.filter(transaction => transaction.id !== id);
        saveTransactions(transactions);

        updateBalance();
        displayTransactions();
    }
}

// Edit transaction category
function editTransactionCategory(id) {
    const transactions = getTransactions();
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;

    const config = getConfig();
    const targetType = transaction.type === 'expense' ? 'Outcome' : 'Income';
    const availableCategories = config.categories
        .filter(cat => !cat.type || cat.type === targetType)
        .map(cat => cat.name);

    const input = prompt(`Enter new category for "${transaction.description}"\nAvailable: ${availableCategories.join(', ')}`, transaction.category);

    if (input && availableCategories.includes(input)) {
        transaction.category = input;
        saveTransactions(transactions);
        updateBalance();
        displayTransactions();
    } else if (input) {
        alert("Invalid category. Please choose from the list.");
    }
}

// Edit transaction amount
function editTransactionAmount(id) {
    const transactions = getTransactions();
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;

    const input = prompt(`Enter new amount for "${transaction.description}":`, addThousandSeparator(transaction.amount));
    if (input === null || input === "") return;

    const newAmount = parseFormattedNumber(input);
    if (newAmount >= 0) {
        transaction.amount = newAmount;
        saveTransactions(transactions);
        updateBalance();
        displayTransactions();
    } else {
        alert("Please enter a valid positive number.");
    }
}


// Clear all transactions
function clearAllTransactions() {
    if (confirm('Are you sure you want to delete ALL transactions? This cannot be undone!')) {
        localStorage.removeItem('transactions');
        updateBalance();
        displayTransactions();
    }
}

// Export to Excel (.xlsx) matching Keuangan.xlsx structure
function exportToExcel() {
    const transactions = getTransactions();
    const config = getConfig();
    const { totalIncome, totalExpense, balance, methodTotals } = calculateTotals();

    if (transactions.length === 0) {
        alert('No transactions to export!');
        return;
    }

    // 1. Create workbook
    const wb = XLSX.utils.book_new();

    // 2. Prepare Money_tracker sheet
    const trackerData = transactions.map((t, index) => ({
        'No': index + 1,
        'Date': new Date(t.date).toISOString().split('T')[0],
        'Jenis': t.type === 'income' ? 'Income' : 'Outcome',
        'Metode Pembayaran': t.paymentMethod,
        'Kategori': t.category,
        'Mata uang': 'IDR',
        'Keterangan': t.description,
        'Jumlah': t.amount
    }));
    const wsTracker = XLSX.utils.json_to_sheet(trackerData);
    XLSX.utils.book_append_sheet(wb, wsTracker, 'Money_tracker');

    // 3. Prepare Rasio sheet
    const rasioData = config.paymentMethods.map(m => {
        const currentTotal = methodTotals[m.name] || 0;
        const percentage = balance !== 0 ? (currentTotal / balance) : 0;
        return {
            'Item': m.name,
            'IDR': currentTotal,
            'USD': 0, // Placeholder
            'Nilai': 1,
            'Harga saat ini': currentTotal,
            'Total': currentTotal,
            'Presentase': percentage
        };
    });
    const wsRasio = XLSX.utils.json_to_sheet(rasioData);
    XLSX.utils.book_append_sheet(wb, wsRasio, 'Rasio');

    // 4. Prepare List sheet
    const maxLen = Math.max(config.paymentMethods.length, config.categories.length);
    const listData = [];
    for (let i = 0; i < maxLen; i++) {
        listData.push({
            'Metode': config.paymentMethods[i] ? config.paymentMethods[i].name : '',
            'Jenis': i < 2 ? (i === 0 ? 'Income' : 'Outcome') : '',
            'Mata Uang': i === 0 ? 'IDR' : (i === 1 ? 'USD' : ''),
            'Outcome List': config.categories[i] ? config.categories[i].name : ''
        });
    }
    const wsList = XLSX.utils.json_to_sheet(listData);
    XLSX.utils.book_append_sheet(wb, wsList, 'List');

    // 5. Download the file
    const filename = `Keuangan-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);

    // Show success message
    alert(`Exported ${transactions.length} transactions to ${filename}\n\nMatching Keuangan.xlsx format!`);
}

// Initialize the app
function init() {
    // Populate select elements if needed
    if (document.getElementById('category')) {
        populateSelects();
    }

    // Update balance and display transactions if on dashboard
    if (document.getElementById('totalBalance')) {
        updateBalance();
    }
    if (document.getElementById('transactionsList')) {
        displayTransactions();
    }

    // Handle type button clicks
    const typeButtons = document.querySelectorAll('.type-btn');
    typeButtons.forEach(button => {
        button.addEventListener('click', function () {
            typeButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            document.getElementById('type').value = this.dataset.type;
            populateSelects(); // Refresh categories when type changes
        });
    });

    // Handle form submission
    const form = document.getElementById('transactionForm');

    // Set default date to today
    const dateInput = document.getElementById('date');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }

    // Live thousand separator on amount input
    const amountInput = document.getElementById('amount');
    if (amountInput) {
        amountInput.addEventListener('input', function () {
            const cursorPos = this.selectionStart;
            const oldLen = this.value.length;
            this.value = addThousandSeparator(this.value);
            const newLen = this.value.length;
            // Adjust cursor position after formatting
            this.setSelectionRange(cursorPos + (newLen - oldLen), cursorPos + (newLen - oldLen));
        });
    }
    // Handle new transaction
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            const dateInput = document.getElementById('date');
            const date = dateInput.value;
            const description = document.getElementById('description').value;
            const amountInput = document.getElementById('amount');
            const amount = parseFormattedNumber(amountInput.value);
            const category = document.getElementById('category').value;
            const type = document.getElementById('type').value;
            const paymentMethod = document.getElementById('paymentMethod').value;

            if (description && amount > 0 && category && paymentMethod) {
                addTransaction(date, description, amount, category, type, paymentMethod);
                form.reset();

                // Re-set default date
                if (dateInput) dateInput.valueAsDate = new Date();

                // Reset type to expense
                typeButtons.forEach(btn => btn.classList.remove('active'));
                typeButtons[0].classList.add('active');
                document.getElementById('type').value = 'expense';

                // Show success animation
                const submitBtn = document.querySelector('.submit-btn');
                if (submitBtn) {
                    submitBtn.textContent = '✓ Added!';
                    let originalBg = submitBtn.style.background; // Declare originalBg
                    submitBtn.style.background = '#2ed573';

                    setTimeout(() => {
                        submitBtn.textContent = 'Add Transaction';
                        submitBtn.style.background = originalBg;
                    }, 1500);
                }
            }
        });
    }

    // Handle clear all button
    const clearBtn = document.getElementById('clearAll');
    if (clearBtn) clearBtn.addEventListener('click', clearAllTransactions);

    // Handle export button
    const exportBtn = document.getElementById('exportExcel');
    if (exportBtn) exportBtn.addEventListener('click', exportToExcel);


    // Settings toggle removed (now a separate page)

    // Auto-update rates display if on settings page
    if (document.getElementById('currentRatesDisplay')) {
        updateRatesDisplay();
    }

    // Handle config import
    // Handle config import
    const importInput = document.getElementById('importConfig');
    if (importInput) {
        importInput.addEventListener('change', function (e) {
            if (e.target.files.length > 0) {
                importConfig(e.target.files[0]);
            }
        });
    }

    // Handle Rate Sync Buttons
    const syncKursBtn = document.getElementById('syncKurs');
    const syncGoldBtn = document.getElementById('syncGold');
    const syncAllBtn = document.getElementById('syncAll');

    if (syncKursBtn) syncKursBtn.addEventListener('click', fetchKurs);
    if (syncGoldBtn) syncGoldBtn.addEventListener('click', fetchGoldPrice);
    if (syncAllBtn) syncAllBtn.addEventListener('click', syncAllRates);

    // PIN Login Integration
    checkLogin();
    updateSecurityUI();

    // Auto-sync data if empty
    autoSyncOnStartup();

    // Listen for Enter key on PIN input
    const loginPinInput = document.getElementById('login-pin');
    if (loginPinInput) {
        loginPinInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') handleLogin();
        });
    }
}

// Start the app when page loads
document.addEventListener('DOMContentLoaded', init);

// Fetch Keuangan.xlsx from repository (GitHub Pages)
async function fetchRepoData(isAuto = false, mode = 'all') {
    if (!isAuto && !confirm(`This will sync ${mode} from the repository. Continue?`)) return;

    // Find the button that triggered this
    let btn = null;
    try {
        if (typeof event !== 'undefined' && event.target) {
            btn = event.target;
            if (btn && btn.tagName !== 'BUTTON') btn = btn.closest('button');
        }
    } catch (e) { }

    let originalText = mode === 'data' ? '📥 Sync Data Only' : '📋 Sync Format Only';
    if (btn) {
        originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Syncing...';
        btn.disabled = true;
    }

    try {
        const resp = await fetch(`Keuangan.xlsx?t=${Date.now()}`);
        if (resp.ok) {
            const blob = await resp.blob();
            const file = new File([blob], 'Keuangan.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            importConfig(file, isAuto, mode);
        } else if (!isAuto) {
            alert('Could not find Keuangan.xlsx in the repository.');
        }
    } catch (e) {
        console.error('Fetch error:', e);
        if (!isAuto) alert('Error syncing from repository: ' + e.message);
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

// Automatically sync from repo if storage is empty
async function autoSyncOnStartup() {
    const transactions = getTransactions();
    const autoSyncRepo = localStorage.getItem('auto_sync_repo') !== 'false'; // Default to true

    if (transactions.length === 0 && autoSyncRepo) {
        console.log("Empty data detected. Attempting auto-sync from repository...");
        await fetchRepoData(true);
    }
}

// Hash the PIN using SHA-256
async function hashPin(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Check if app is locked and handle login
async function checkLogin() {
    const storedHash = localStorage.getItem('pin_hash');
    const loginScreen = document.getElementById('login-screen');

    if (storedHash) {
        loginScreen.style.display = 'flex';
        // Hide container content to prevent layout shift or visual leak
        document.querySelector('.container').style.opacity = '0';
    } else {
        loginScreen.style.display = 'none';
        document.querySelector('.container').style.opacity = '1';
    }
}

// Handle Login Attempt
async function handleLogin() {
    const pinInput = document.getElementById('login-pin');
    const errorMsg = document.getElementById('login-error');
    const inputHash = await hashPin(pinInput.value);
    const storedHash = localStorage.getItem('pin_hash');

    if (inputHash === storedHash) {
        document.getElementById('login-screen').style.display = 'none';
        document.querySelector('.container').style.opacity = '1';
        pinInput.value = '';
        errorMsg.style.display = 'none';
    } else {
        errorMsg.style.display = 'block';
        pinInput.value = '';
        pinInput.focus();
    }
}

// Security Management in Settings
function togglePinSetup() {
    const form = document.getElementById('pin-setup-form');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function saveNewPin() {
    const pinInput = document.getElementById('new-pin');
    const pin = pinInput.value;

    if (!/^\d+$/.test(pin)) {
        alert("Please enter a numeric PIN.");
        return;
    }

    const hash = await hashPin(pin);
    localStorage.setItem('pin_hash', hash);
    pinInput.value = '';
    togglePinSetup();
    updateSecurityUI();
    alert("PIN set successfully!");
}

function removePin() {
    if (confirm("Are you sure you want to remove the PIN? Your data will no longer be protected.")) {
        localStorage.removeItem('pin_hash');
        updateSecurityUI();
        alert("PIN removed.");
    }
}

function updateSecurityUI() {
    const storedHash = localStorage.getItem('pin_hash');
    const setupBtn = document.getElementById('setup-pin-btn');
    const removeBtn = document.getElementById('remove-pin-btn');
    const autoSyncToggle = document.getElementById('auto-sync-toggle');

    if (storedHash) {
        setupBtn.textContent = "Change PIN";
        removeBtn.style.display = 'block';
    } else {
        setupBtn.textContent = "Setup PIN";
        removeBtn.style.display = 'none';
    }

    if (autoSyncToggle) {
        autoSyncToggle.checked = localStorage.getItem('auto_sync_repo') !== 'false';
    }
}

// Google Drive Helper Functions
function saveGDriveCreds() {
    const clientId = document.getElementById('gdrive-client-id').value;
    const apiKey = document.getElementById('gdrive-api-key').value;
    const sheetId = document.getElementById('gdrive-sheet-id').value;

    if (clientId && apiKey) {
        localStorage.setItem('gdrive_client_id', clientId);
        localStorage.setItem('gdrive_api_key', apiKey);
        if (sheetId) localStorage.setItem('gsheet_id', sheetId);
        alert("Google credentials saved!");
        location.reload(); // Reload to initialize with new keys
    } else {
        alert("Please enter both Client ID and API Key.");
    }
}

function loadGDriveCreds() {
    const clientId = localStorage.getItem('gdrive_client_id');
    const apiKey = localStorage.getItem('gdrive_api_key');
    const sheetId = localStorage.getItem('gsheet_id');
    if (clientId) document.getElementById('gdrive-client-id').value = clientId;
    if (apiKey) document.getElementById('gdrive-api-key').value = apiKey;
    if (sheetId) document.getElementById('gdrive-sheet-id').value = sheetId;
}

function handleAuthClick() {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) throw (resp);
        document.getElementById('gdrive-auth-btn').innerText = '✅ Authorized';
        document.getElementById('gdrive-auth-btn').style.background = 'var(--success)';
        document.querySelectorAll('.sync-btn').forEach(btn => btn.disabled = false);
        document.getElementById('gdrive-status').innerText = 'Status: Connected';
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

// Direct Google Sheets Sync
async function fetchGSheetData(mode = 'all') {
    const sheetId = localStorage.getItem('gsheet_id');
    if (!sheetId) {
        alert("Please set a Spreadsheet ID in Settings first.");
        return;
    }

    const status = document.getElementById('gdrive-status');
    status.innerText = `Status: Syncing ${mode}...`;

    try {
        const ranges = [];
        if (mode === 'format' || mode === 'all') ranges.push('List!A:C');
        if (mode === 'data' || mode === 'all') {
            ranges.push('Rasio!A1:Z100');
            ranges.push('Money_tracker!A:K');
        }

        const response = await gapi.client.sheets.spreadsheets.values.batchGet({
            spreadsheetId: sheetId,
            ranges: ranges,
        });

        const valueRanges = response.result.valueRanges;
        let newFormat = { categories: [], paymentMethods: [] };
        let transactionsToSave = null;

        valueRanges.forEach(vr => {
            const range = vr.range;
            const rows = vr.values || [];

            if (range.includes('List')) {
                const headers = rows[0]?.map(h => String(h).toLowerCase().trim()) || [];
                const metodoIdx = headers.indexOf('metode');
                const outcomeIdx = headers.indexOf('outcome list');
                const incomeIdx = headers.indexOf('income list');

                rows.slice(1).forEach(row => {
                    if (metodoIdx !== -1 && row[metodoIdx]) {
                        newFormat.paymentMethods.push({ name: row[metodoIdx], icon: "🏦", starting: 0 });
                    }
                    if (outcomeIdx !== -1 && row[outcomeIdx]) {
                        newFormat.categories.push({ name: row[outcomeIdx], icon: "🛍️", type: "Outcome" });
                    }
                    if (incomeIdx !== -1 && row[incomeIdx]) {
                        newFormat.categories.push({ name: row[incomeIdx], icon: "💰", type: "Income" });
                    }
                });
            } else if (range.includes('Rasio')) {
                let headerIdx = -1;
                rows.forEach((row, idx) => {
                    const rowLower = row.map(v => String(v).toLowerCase());
                    if (rowLower.includes('item') && rowLower.includes('idr')) {
                        headerIdx = idx;
                    }
                });

                if (headerIdx !== -1) {
                    const headers = rows[headerIdx].map(h => String(h).toLowerCase());
                    const itemCol = headers.indexOf('item');
                    const idrCol = headers.indexOf('idr');

                    rows.slice(headerIdx + 1).forEach(row => {
                        const item = row[itemCol];
                        if (!item || item === 'Grand Total') return;

                        const val = parseFloat(String(row[idrCol] || 0).replace(/[Rp.\s,]/g, '')) || 0;
                        const match = newFormat.paymentMethods.find(m => m.name.toLowerCase().trim() === item.toLowerCase().trim());
                        if (match) match.starting = val;
                    });
                }
            } else if (range.includes('Money_tracker')) {
                const headers = rows[0]?.map(h => String(h).toLowerCase().trim()) || [];
                const colMap = {
                    date: headers.indexOf('date'),
                    account: headers.indexOf('account'),
                    category: headers.indexOf('category'),
                    desc: headers.indexOf('description'),
                    amount: headers.indexOf('idr'),
                    type: headers.indexOf('type')
                };

                transactionsToSave = rows.slice(1).filter(row => row[colMap.date]).map(row => {
                    const typeRaw = String(row[colMap.type] || '').toLowerCase();
                    return {
                        id: Date.now() + Math.random(),
                        date: row[colMap.date] || new Date().toISOString(),
                        type: typeRaw.includes('income') ? 'income' : 'expense',
                        category: row[colMap.category] || 'Uncategorized',
                        description: row[colMap.desc] || '',
                        amount: parseFloat(String(row[colMap.amount] || 0).replace(/[Rp.\s,]/g, '')) || 0,
                        paymentMethod: row[colMap.account] || 'Cash'
                    };
                });
            }
        });

        if (mode === 'format' || mode === 'all') {
            if (newFormat.categories.length > 0) saveConfig(newFormat);
        }
        if (mode === 'data' || mode === 'all') {
            if (transactionsToSave) saveTransactions(transactionsToSave);
        }

        updateBalance();
        displayTransactions();
        populateSelects();
        status.innerText = `Status: Sync ${mode} successful`;
        alert(`Google Sheets ${mode} sync successful!`);

    } catch (err) {
        status.innerText = `Status: Sync ${mode} failed`;
        console.error("GSheet Sync Error:", err);
        alert("Failed to sync from Google Sheets. Check your Spreadsheet ID and authorization.");
    }
}

async function pushTransactionToGSheet(t) {
    const sheetId = localStorage.getItem('gsheet_id');
    if (!sheetId || !gapi.client.sheets) return;

    try {
        const values = [[
            t.date.split('T')[0],
            t.paymentMethod,
            t.category,
            t.description,
            '', // Item
            t.amount,
            t.type === 'income' ? 'Income' : 'Outcome'
        ]];

        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: 'Money_tracker!A:G',
            valueInputOption: 'USER_ENTERED',
            resource: { values: values }
        });
        console.log("Transaction pushed to GSheet successfully");
    } catch (err) {
        console.error("Error pushing to GSheet:", err);
    }
}


async function backupToDrive() {
    const status = document.getElementById('gdrive-status');
    status.innerText = 'Status: Backing up...';

    try {
        const transactions = getTransactions();
        const config = getConfig();
        const data = { transactions, config, lastBackup: new Date().toISOString() };
        const content = JSON.stringify(data);

        // Find existing backup file
        const resp = await gapi.client.drive.files.list({
            q: "name = 'money-tracker-backup.json' and trashed = false",
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        const files = resp.result.files;
        const fileId = files.length > 0 ? files[0].id : null;

        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";

        const metadata = {
            'name': 'money-tracker-backup.json',
            'mimeType': 'application/json'
        };

        const multipartRequestBody =
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            content +
            close_delim;

        let request;
        if (fileId) {
            // Update existing
            request = gapi.client.request({
                'path': '/upload/drive/v3/files/' + fileId,
                'method': 'PATCH',
                'params': { 'uploadType': 'multipart' },
                'headers': { 'Content-Type': 'multipart/related; boundary=' + boundary },
                'body': multipartRequestBody
            });
        } else {
            // Create new
            request = gapi.client.request({
                'path': '/upload/drive/v3/files',
                'method': 'POST',
                'params': { 'uploadType': 'multipart' },
                'headers': { 'Content-Type': 'multipart/related; boundary=' + boundary },
                'body': multipartRequestBody
            });
        }

        await request;
        status.innerText = `Status: Last backup ${new Date().toLocaleTimeString()}`;
        console.log("Backup Successful");
    } catch (err) {
        status.innerText = 'Status: Backup failed';
        console.error("Backup Error:", err);
    }
}

async function restoreFromDrive() {
    if (!confirm("Are you sure? This will OVERWRITE all your local data with the backup from Drive.")) return;

    const status = document.getElementById('gdrive-status');
    status.innerText = 'Status: Restoring...';

    try {
        const resp = await gapi.client.drive.files.list({
            q: "name = 'money-tracker-backup.json' and trashed = false",
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        const files = resp.result.files;
        if (files.length === 0) {
            alert("No backup file found in your Google Drive.");
            status.innerText = 'Status: No backup found';
            return;
        }

        const fileId = files[0].id;
        const fileResp = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });

        const data = fileResp.result;
        if (data.transactions && data.config) {
            saveTransactions(data.transactions);
            saveConfig(data.config);
            updateBalance();
            displayTransactions();
            populateSelects();
            status.innerText = 'Status: Restore successful';
            alert("Restore successful! Your data has been updated.");
        } else {
            throw new Error("Invalid backup format");
        }
    } catch (err) {
        status.innerText = 'Status: Restore failed';
        console.error("Restore Error:", err);
        alert("Failed to restore data from Drive.");
    }
}

function toggleGDriveAutoBackup(checkbox) {
    localStorage.setItem('gdrive_auto_backup', checkbox.checked);
}

// Google API Init
function gapiLoaded() {
    const API_KEY = localStorage.getItem('gdrive_api_key');
    if (!API_KEY) return;
    gapi.load('client', async () => {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: [
                'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
                'https://www.googleapis.com/discovery/v1/apis/sheets/v4/rest'
            ],
        });
        gapiInited = true;
    });
}

function gisLoaded() {
    const CLIENT_ID = localStorage.getItem('gdrive_client_id');
    if (!CLIENT_ID) return;
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets',
        callback: '', // defined at usage
    });
    gisInited = true;
}

// Initialize GDrive scripts
(function loadGDriveScripts() {
    const s1 = document.createElement('script');
    s1.src = "https://apis.google.com/js/api.js";
    s1.onload = gapiLoaded;
    document.body.appendChild(s1);

    const s2 = document.createElement('script');
    s2.src = "https://accounts.google.com/gsi/client";
    s2.onload = gisLoaded;
    document.body.appendChild(s2);
})();

// Modify addTransaction to trigger auto-backup and GSheet push
const originalAddTransaction = addTransaction;
addTransaction = function (...args) {
    originalAddTransaction.apply(this, args);
    const transactions = getTransactions();
    const latest = transactions[transactions.length - 1];

    if (localStorage.getItem('gdrive_auto_backup') === 'true' && gapiInited && gapi.client.getToken()) {
        backupToDrive();
    }

    if (latest && gapiInited && gapi.client.getToken()) {
        pushTransactionToGSheet(latest);
    }
};

// Update init to load GDrive settings
const originalInit = init;
init = function () {
    originalInit.apply(this, arguments);
    loadGDriveCreds();
    const autoBackup = localStorage.getItem('gdrive_auto_backup') === 'true';
    document.getElementById('gdrive-auto-backup').checked = autoBackup;
};

