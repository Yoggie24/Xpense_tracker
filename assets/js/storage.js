// ============================================================
// storage.js — Low-level localStorage read/write
// ============================================================

// Get all transactions from browser storage
function getTransactions() {
    const transactions = localStorage.getItem('transactions');
    return transactions ? JSON.parse(transactions) : [];
}

// Save transactions to browser storage
function saveTransactions(transactions) {
    localStorage.setItem('transactions', JSON.stringify(transactions));
}

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
