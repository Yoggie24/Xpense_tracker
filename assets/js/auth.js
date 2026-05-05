// ============================================================
// auth.js — PIN login and security management
// ============================================================

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
