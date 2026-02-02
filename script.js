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
function formatMoney(amount) {
    return 'Rp ' + amount.toLocaleString('id-ID');
}

// Calculate totals
function calculateTotals() {
    const transactions = getTransactions();
    
    let totalIncome = 0;
    let totalExpense = 0;
    
    transactions.forEach(transaction => {
        if (transaction.type === 'income') {
            totalIncome += transaction.amount;
        } else {
            totalExpense += transaction.amount;
        }
    });
    
    const balance = totalIncome - totalExpense;
    
    return { totalIncome, totalExpense, balance };
}

// Update balance display
function updateBalance() {
    const { totalIncome, totalExpense, balance } = calculateTotals();
    
    document.getElementById('totalBalance').textContent = formatMoney(balance);
    document.getElementById('totalIncome').textContent = formatMoney(totalIncome);
    document.getElementById('totalExpense').textContent = formatMoney(totalExpense);
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
    
    transactionsList.innerHTML = transactions.map(transaction => `
        <div class="transaction-item ${transaction.type}">
            <div class="transaction-info">
                <div class="transaction-description">${transaction.description}</div>
                <div class="transaction-category">${transaction.category}</div>
            </div>
            <div class="transaction-amount ${transaction.type}">
                ${transaction.type === 'expense' ? '-' : '+'} ${formatMoney(transaction.amount)}
            </div>
            <button class="delete-btn" onclick="deleteTransaction(${transaction.id})">🗑️</button>
        </div>
    `).join('');
}

// Add new transaction
function addTransaction(description, amount, category, type) {
    const transactions = getTransactions();
    
    const newTransaction = {
        id: Date.now(),
        description: description,
        amount: parseFloat(amount),
        category: category,
        type: type,
        date: new Date().toISOString()
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

// Clear all transactions
function clearAllTransactions() {
    if (confirm('Are you sure you want to delete ALL transactions? This cannot be undone!')) {
        localStorage.removeItem('transactions');
        updateBalance();
        displayTransactions();
    }
}

// Initialize the app
function init() {
    // Update balance and display transactions
    updateBalance();
    displayTransactions();
    
    // Handle type button clicks
    const typeButtons = document.querySelectorAll('.type-btn');
    typeButtons.forEach(button => {
        button.addEventListener('click', function() {
            typeButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            document.getElementById('type').value = this.dataset.type;
        });
    });
    
    // Handle form submission
    const form = document.getElementById('transactionForm');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const description = document.getElementById('description').value;
        const amount = document.getElementById('amount').value;
        const category = document.getElementById('category').value;
        const type = document.getElementById('type').value;
        
        if (description && amount && category) {
            addTransaction(description, amount, category, type);
            form.reset();
            
            // Reset type to expense
            typeButtons.forEach(btn => btn.classList.remove('active'));
            typeButtons[0].classList.add('active');
            document.getElementById('type').value = 'expense';
            
            // Show success animation
            const submitBtn = document.querySelector('.submit-btn');
            submitBtn.textContent = '✓ Added!';
            submitBtn.style.background = '#2ed573';
            
            setTimeout(() => {
                submitBtn.textContent = 'Add Transaction';
                submitBtn.style.background = '';
            }, 1500);
        }
    });
    
    // Handle clear all button
    document.getElementById('clearAll').addEventListener('click', clearAllTransactions);
}

// Start the app when page loads
document.addEventListener('DOMContentLoaded', init);
