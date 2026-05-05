// ============================================================
// transactions.js — Transaction CRUD, display, and export
// ============================================================

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

// Reset everything: clear all transactions AND reset all starting balances to 0
function resetAll() {
    if (confirm('⚠️ RESET ALL?\n\nThis will:\n- Delete ALL transactions\n- Reset ALL asset starting balances to 0\n\nThis action CANNOT be undone!')) {
        // Clear transactions
        localStorage.removeItem('transactions');

        // Reset all starting balances to 0 in config
        const config = getConfig();
        config.paymentMethods.forEach(m => {
            m.starting = 0;
            if (m.qty !== undefined) m.qty = 0;
            if (m.price !== undefined) m.price = 0;
        });
        saveConfig(config);

        updateBalance();
        displayTransactions();
        alert('✅ All data has been reset.');
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

    alert(`Exported ${transactions.length} transactions to ${filename}\n\nMatching Keuangan.xlsx format!`);
}
