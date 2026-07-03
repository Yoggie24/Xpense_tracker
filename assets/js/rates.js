// ============================================================
// rates.js — Live exchange rates, gold price, and asset adjustment
// ============================================================

let USD_KURS = 16000; // Default Kurs USD

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
        <div class="bg-black/30 p-3 rounded-xl border border-white/5 flex flex-col items-center justify-center">
            <span class="text-[10px] text-slate-500 font-bold uppercase mb-1">💵 USD Kurs</span>
            <span class="text-emerald-400 font-mono font-bold">${formatMoney(kurs)}</span>
        </div>
        <div class="bg-black/30 p-3 rounded-xl border border-white/5 flex flex-col items-center justify-center">
            <span class="text-[10px] text-slate-500 font-bold uppercase mb-1">🥇 Gold / g</span>
            <span class="text-yellow-400 font-mono font-bold">${formatMoney(goldPrice)}</span>
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
