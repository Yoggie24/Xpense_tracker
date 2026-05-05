// ============================================================
// config.js — App configuration, categories, payment methods
// ============================================================

// Default configuration for the Money Tracker app
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
        { "name": "Jenius", "icon": "", "starting": 0 },
        { "name": "BCA Vallas", "icon": "", "isUSD": true, "starting": 5.0 },
        { "name": "Gold", "icon": "", "starting": 0, "isInvestment": true },
        { "name": "Stocks", "icon": "", "starting": 0, "isInvestment": true },
        { "name": "Cash", "icon": "", "starting": 0.0 }
    ]
};

// Get/Load configuration
function getConfig() {
    const configStr = localStorage.getItem('moneyTrackerConfig');
    let config = configStr ? JSON.parse(configStr) : JSON.parse(JSON.stringify(DEFAULT_CONFIG));

    // MIGRATION: Ensure correct flags for specific assets
    let changed = false;
    config.paymentMethods.forEach(m => {
        const name = m.name.toLowerCase();

        // Fix USD Assets (Jenius is now IDR, only BCA Vallas remains USD)
        if (name.includes('vallas')) {
            if (!m.isUSD) {
                m.isUSD = true;
                changed = true;
            }
        }

        // MIGRATION: Remove isUSD flag from Jenius (now tracked in IDR)
        if (name.includes('jenius') && m.isUSD) {
            delete m.isUSD;
            changed = true;
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
