// Pegadaian quotes via Zapi. Credentials are entered locally, never bundled with the site.
const PEGADAIAN_ENDPOINT = 'https://api.zpi.web.id/v1/finance:pegadaian/gold-price';
let goldRequest = null;
function goldValuationSide() { return localStorage.getItem('pegadaian-gold-side') === 'sellPerGram' ? 'sellPerGram' : 'buyPerGram'; }
function parsePegadaianQuote(payload) {
    const quote = payload?.data ?? payload;
    if (!quote || quote.currency !== 'IDR' || quote.source !== 'pegadaian' || quote.metal !== 'gold' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(quote.date || '') ||
        !Number.isFinite(quote.buyPerGram) || quote.buyPerGram <= 0 ||
        !Number.isFinite(quote.sellPerGram) || quote.sellPerGram <= 0) {
        throw new Error('Format harga Pegadaian tidak valid. Harga terakhir tetap digunakan.');
    }
    return { source: 'pegadaian', metal: 'gold', currency: 'IDR', date: quote.date, buyPerGram: quote.buyPerGram, sellPerGram: quote.sellPerGram };
}
function savedPegadaianQuote() {
    try { return parsePegadaianQuote(JSON.parse(localStorage.getItem('PEGADAIAN_GOLD_QUOTE'))); }
    catch { return null; }
}
function initialGoldPrice() {
    const quote = savedPegadaianQuote();
    if (quote) return quote[goldValuationSide()];
    const legacy = Number(localStorage.getItem('GOLD_PRICE'));
    return Number.isFinite(legacy) && legacy > 0 ? legacy : 0;
}
function goldPriceCaption() {
    const quote = savedPegadaianQuote();
    if (!quote) return 'Emas / g · harga tersimpan';
    return `Pegadaian / g · ${goldValuationSide() === 'buyPerGram' ? 'beli kembali' : 'jual'} · ${quote.date}`;
}
function setGoldStatus(message) {
    const status = document.getElementById('gold-api-status');
    if (status) status.textContent = message;
    const sync = document.getElementById('syncStatus');
    if (sync) sync.textContent = message;
}
function applyPegadaianQuote(quote) {
    const price = quote[goldValuationSide()];
    localStorage.setItem('PEGADAIAN_GOLD_QUOTE', JSON.stringify(quote));
    localStorage.setItem('GOLD_PRICE', String(price));
    GOLD_PRICE = price;
    updateRatesDisplay();
    renderAll();
}
async function requestPegadaianPrice() {
    const key = (localStorage.getItem('zpi-api-key') || '').trim();
    if (!key) { setGoldStatus('Isi API key Zapi di System Config → Harga Emas Pegadaian.'); return false; }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    setGoldStatus('Memperbarui harga emas Pegadaian...');
    try {
        const response = await fetch(PEGADAIAN_ENDPOINT, { method: 'GET', headers: { 'x-api-key': key }, signal: controller.signal, credentials: 'omit', redirect: 'error' });
        if (!response.ok) {
            const message = response.status === 401 ? 'API key Zapi tidak valid.' : response.status === 403 ? 'Akses API ditolak. Periksa izin atau paket Zapi.' : response.status === 429 ? 'Batas permintaan Zapi tercapai. Coba lagi nanti.' : `API Pegadaian gagal (HTTP ${response.status}).`;
            throw new Error(message);
        }
        const quote = parsePegadaianQuote(await response.json());
        // A key changed or removed while awaiting a request must not commit stale work.
        if (key !== (localStorage.getItem('zpi-api-key') || '').trim()) return false;
        applyPegadaianQuote(quote);
        setGoldStatus(`Pegadaian ${quote.date}: ${fmtPocketIDR(GOLD_PRICE)} / gram (${goldValuationSide() === 'buyPerGram' ? 'beli kembali' : 'jual'}).`);
        return true;
    } catch (error) {
        const message = error.name === 'AbortError' ? 'Permintaan Pegadaian melewati batas 15 detik.' : error instanceof TypeError ? 'Tidak dapat menghubungi API Pegadaian. Periksa jaringan atau akses browser.' : error.message;
        setGoldStatus(message + ' Harga terakhir tidak dihapus.');
        return false;
    } finally { clearTimeout(timeout); }
}
function fetchGoldPrice() {
    if (!goldRequest) goldRequest = requestPegadaianPrice().finally(() => { goldRequest = null; });
    return goldRequest;
}
function populateGoldConfig() {
    document.getElementById('zpi-api-key').value = localStorage.getItem('zpi-api-key') || '';
    document.getElementById('pegadaian-gold-side').value = goldValuationSide();
}
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('gold-api-save').addEventListener('click', async event => {
        const key = document.getElementById('zpi-api-key').value.trim();
        const button = event.currentTarget;
        if (key && !/^zpi_[A-Za-z0-9]+$/.test(key)) { setGoldStatus('Format API key Zapi tidak valid.'); return; }
        try {
            localStorage.setItem('zpi-api-key', key);
            if (!key) { setGoldStatus('API key dihapus dari browser. Harga terakhir tetap disimpan.'); return; }
            button.disabled = true;
            if (goldRequest) await goldRequest;
            await fetchGoldPrice();
        } catch { setGoldStatus('API key gagal disimpan. Periksa penyimpanan browser.'); }
        finally { button.disabled = false; }
    });
    document.getElementById('pegadaian-gold-side').addEventListener('change', event => {
        try {
            localStorage.setItem('pegadaian-gold-side', event.target.value);
            const quote = savedPegadaianQuote();
            if (quote) { applyPegadaianQuote(quote); setGoldStatus('Dasar valuasi diperbarui dari harga Pegadaian tersimpan (' + quote.date + ').'); }
            else setGoldStatus('Pilihan disimpan. Sinkronkan harga Pegadaian untuk menerapkannya.');
        } catch { setGoldStatus('Pilihan valuasi gagal disimpan.'); }
    });
});
