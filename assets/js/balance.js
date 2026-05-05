// ============================================================
// balance.js — Calculate totals and update asset summary UI
// ============================================================

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
            const currentUSD = methodTotals[m.name] || 0;
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
