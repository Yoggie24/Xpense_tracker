// Run in <head> to apply the saved palette before the first paint.
function applyAppTheme(theme) {
    const dark = theme === 'dark';
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const button = document.getElementById('theme-toggle');
    if (button) {
        button.setAttribute('aria-pressed', String(dark));
        button.setAttribute('aria-label', dark ? 'Aktifkan Light Mode' : 'Aktifkan Dark Mode');
        button.innerHTML = `<i class="fas fa-${dark ? 'sun' : 'moon'}" aria-hidden="true"></i><span>${dark ? 'Light Mode' : 'Dark Mode'}</span>`;
    }
}
try { applyAppTheme(localStorage.getItem('fintracker-theme') === 'dark' ? 'dark' : 'light'); }
catch { applyAppTheme('light'); }
document.addEventListener('DOMContentLoaded', () => {
    applyAppTheme(document.documentElement.dataset.theme);
    document.getElementById('theme-toggle').addEventListener('click', () => {
        const theme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        try { localStorage.setItem('fintracker-theme', theme); } catch { /* Theme can still work for this session. */ }
        applyAppTheme(theme);
        renderAll();
    });
});
