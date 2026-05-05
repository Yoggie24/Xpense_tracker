// ============================================================
// app.js — Application bootstrap and initialization
// ============================================================

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

// Automatically sync from cloud if authorized
async function autoSyncOnStartup() {
    console.log("Startup check: Attempting cloud sync...");
    await fetchGSheetData('all');
}

// Wrap addTransaction to also push to GSheet
const originalAddTransaction = addTransaction;
addTransaction = function (...args) {
    originalAddTransaction(...args);
    const transactions = getTransactions();
    const newT = transactions[transactions.length - 1];
    if (newT) pushTransactionToGSheet(newT);
};

// Wrap init to also load GDrive credentials
const originalInit = init;
init = function () {
    originalInit();
    loadGDriveCreds();
};

// Initialize the app
function init() {
    // Populate select elements if needed
    if (document.getElementById('category')) {
        populateSelects();
    }

    // Update balance and display transactions
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
            this.setSelectionRange(cursorPos + (newLen - oldLen), cursorPos + (newLen - oldLen));
        });
    }

    // Handle new transaction form submission
    const form = document.getElementById('transactionForm');
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
                populateSelects();

                // Show success animation
                const submitBtn = document.querySelector('.submit-btn');
                if (submitBtn) {
                    submitBtn.textContent = '✓ Added!';
                    const originalBg = submitBtn.style.background;
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

    // Auto-update rates display if on settings page
    if (document.getElementById('currentRatesDisplay')) {
        updateRatesDisplay();
    }

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

    // Load GDrive credentials into settings form
    loadGDriveCreds();
}

// Start the app when page loads
document.addEventListener('DOMContentLoaded', () => init());
