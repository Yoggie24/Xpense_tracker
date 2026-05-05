// ============================================================
// utils.js — Formatting helpers
// ============================================================

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
