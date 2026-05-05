// ============================================================
// gsheet.js — Google Sheets & Drive synchronization
// ============================================================

// Global state for Google API
let tokenClient;
let gapiInited = false;
let gisInited = false;
let syncOutbox = JSON.parse(localStorage.getItem('gsheet_outbox') || '[]');
let isProcessingQueue = false;
let authInterval = null;

// ---- UI Helpers ----

function toggleAdvanced() {
    const adv = document.getElementById('advanced-creds');
    adv.style.display = adv.style.display === 'none' ? 'block' : 'none';
}

function saveGDriveCreds() {
    const clientId = document.getElementById('gdrive-client-id').value;
    const apiKey = document.getElementById('gdrive-api-key').value;
    const sheetId = document.getElementById('gdrive-sheet-id').value;

    if (sheetId) {
        localStorage.setItem('gsheet_id', sheetId);
        if (clientId) localStorage.setItem('gdrive_client_id', clientId);
        if (apiKey) localStorage.setItem('gdrive_api_key', apiKey);

        // Hide advanced again if they were showing
        document.getElementById('advanced-creds').style.display = 'none';

        alert("Configuration saved!");
        location.reload();
    } else {
        alert("Please enter at least the Spreadsheet ID.");
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

// ---- Auth ----

function handleAuthClick(isSilent = false) {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            updateSyncStatus('error', 'Auth Failed');
            throw (resp);
        }
        localStorage.setItem('gsheet_token', JSON.stringify(resp));
        updateAuthUI(true);
        // Automatically fetch data after successful auth
        fetchGSheetData('all');
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: isSilent ? '' : 'consent' });
    } else {
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

function updateAuthUI(isAuthorized) {
    updateSyncStatus(isAuthorized ? 'ready' : 'offline', isAuthorized ? 'Cloud Connected' : 'Offline (Unauthenticated)');

    // If we just got authorized, try to process any pending items
    if (isAuthorized) {
        processGSheetQueue();
    }
}

function updateSyncStatus(state, message) {
    const dot = document.getElementById('sync-dot');
    const text = document.getElementById('sync-text');
    if (!dot || !text) return;

    text.innerText = message;
    switch (state) {
        case 'syncing':
            dot.style.background = '#3b82f6'; // blue
            dot.style.boxShadow = '0 0 8px #3b82f6';
            break;
        case 'ready':
            dot.style.background = '#22c55e'; // green
            dot.style.boxShadow = 'none';
            break;
        case 'pending':
            dot.style.background = '#f59e0b'; // amber
            dot.style.boxShadow = '0 0 8px #f59e0b';
            break;
        case 'error':
            dot.style.background = '#ef4444'; // red
            dot.style.boxShadow = 'none';
            break;
        default:
            dot.style.background = '#cbd5e1'; // grey
            dot.style.boxShadow = 'none';
    }
}

async function autoAuthorize() {
    if (!gisInited || !gapiInited) return;

    const storedToken = localStorage.getItem('gsheet_token');
    const clientId = localStorage.getItem('gdrive_client_id');

    if (storedToken) {
        const token = JSON.parse(storedToken);
        gapi.client.setToken(token);
        updateAuthUI(true);
        fetchGSheetData('all');
    } else if (clientId) {
        console.log("Attempting silent authorization...");
        handleAuthClick(true);
    } else {
        updateAuthUI(false);
    }
}

// ---- Data Sync ----

async function fetchGSheetData(mode = 'all') {
    const sheetId = localStorage.getItem('gsheet_id');
    if (!sheetId) return;

    const status = document.getElementById('gdrive-status');
    if (status) status.innerText = `Status: Refreshing Cloud Data...`;

    try {
        const ranges = ['List!A:C', 'Rasio!A1:Z100', 'Money_tracker!A:K'];
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

        if (newFormat.categories.length > 0) saveConfig(newFormat);
        if (transactionsToSave) saveTransactions(transactionsToSave);

        updateBalance();
        displayTransactions();
        populateSelects();

        if (status) status.innerText = `Status: Cloud Synced (${new Date().toLocaleTimeString()})`;
    } catch (err) {
        if (err.status === 401) {
            console.log("Auth expired during fetch. Retrying auth...");
            handleAuthClick(true);
        } else {
            if (status) status.innerText = `Status: Sync failed`;
            console.error("GSheet Sync Error:", err);
        }
    }
}

async function pushTransactionToGSheet(t) {
    const sheetId = localStorage.getItem('gsheet_id');
    if (!sheetId || !gapi.client.sheets) return;

    // Check online status
    if (!navigator.onLine) {
        queueTransaction(t);
        return;
    }

    updateSyncStatus('syncing', 'Syncing...');
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
        updateSyncStatus('ready', 'Synced');
        console.log("Transaction pushed to GSheet successfully");
    } catch (err) {
        console.error("Error pushing to GSheet:", err);
        if (err.status === 401) {
            console.log("Auth expired during push. Retrying auth...");
            handleAuthClick(true);
            queueTransaction(t); // Keep in queue for retry after auth
        } else {
            queueTransaction(t);
        }
    }
}

function queueTransaction(t) {
    if (syncOutbox.find(item => item.id === t.id)) return;
    syncOutbox.push(t);
    localStorage.setItem('gsheet_outbox', JSON.stringify(syncOutbox));
    updateSyncStatus('pending', `${syncOutbox.length} Pending`);
}

async function processGSheetQueue() {
    if (isProcessingQueue || syncOutbox.length === 0 || !navigator.onLine) return;
    if (!gapi.client.getToken()) return;

    isProcessingQueue = true;
    updateSyncStatus('syncing', `Syncing ${syncOutbox.length}...`);

    while (syncOutbox.length > 0) {
        const t = syncOutbox[0];
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
                spreadsheetId: localStorage.getItem('gsheet_id'),
                range: 'Money_tracker!A:G',
                valueInputOption: 'USER_ENTERED',
                resource: { values: values }
            });

            syncOutbox.shift();
            localStorage.setItem('gsheet_outbox', JSON.stringify(syncOutbox));
            updateSyncStatus('syncing', syncOutbox.length > 0 ? `Syncing ${syncOutbox.length}...` : 'Synced');
        } catch (err) {
            console.error("Queue processing error:", err);
            if (err.status === 401) {
                console.log("Auth expired during queue processing. Retrying auth...");
                handleAuthClick(true);
                break; // Stop loop, auth callback will restart queue
            }
            updateSyncStatus('error', 'Retry in 30s');
            break;
        }
    }

    isProcessingQueue = false;
    if (syncOutbox.length === 0) {
        updateSyncStatus('ready', 'Synced');
    } else {
        updateSyncStatus('pending', `${syncOutbox.length} Pending`);
    }
}

window.addEventListener('online', processGSheetQueue);
setInterval(processGSheetQueue, 30000); // Check every 30s

// ---- Google Drive Backup / Restore ----

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
            request = gapi.client.request({
                'path': '/upload/drive/v3/files/' + fileId,
                'method': 'PATCH',
                'params': { 'uploadType': 'multipart' },
                'headers': { 'Content-Type': 'multipart/related; boundary=' + boundary },
                'body': multipartRequestBody
            });
        } else {
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

// ---- Google API Init ----

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
        autoAuthorize();
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
    autoAuthorize();
}

// Initialize GDrive scripts dynamically
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
