const fs = require('fs');
let html = fs.readFileSync('0Ref/0ref.html', 'utf-8');

// Replace styles and script
html = html.replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="assets/css/style.css">');
html = html.replace(/<script>\s*document\.addEventListener\('DOMContentLoaded'[\s\S]*?<\/script>/, '<script src="assets/js/script.js"></script>');

// Remove AI elements
html = html.replace(/<div id="gemini-key-container">[\s\S]*?<\/div>/g, '');
html = html.replace(/<div id="groq-key-container"[\s\S]*?<\/div>/g, '');
html = html.replace(/<label class="block text-\[10px\] font-bold text-slate-400 uppercase mb-2 tracking-wider">AI Provider[\s\S]*?<\/select>\s*<\/div>/g, '');

// Remove scan AI button
html = html.replace(/<button id="scan-receipt-btn"[\s\S]*?<\/button>/, '');
html = html.replace(/<input type="file" id="receipt-upload"[\s\S]*?>/, '');

// Add Webhook URL setting
const webhookHtml = `
<div>
    <label class="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">Google Apps Script Webhook URL</label>
    <input type="password" id="webhook-url-input" placeholder="https://script.google.com/..." class="w-full input-glow rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 font-mono">
</div>
<button id="pull-data-btn" class="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-[0_4px_15px_rgba(16,185,129,0.3)] transition-all flex justify-center items-center gap-2"><i class="fas fa-cloud-download-alt"></i> Pull from Spreadsheet</button>
<button id="push-data-btn" class="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-[0_4px_15px_rgba(37,99,235,0.3)] transition-all flex justify-center items-center gap-2"><i class="fas fa-cloud-upload-alt"></i> Push to Spreadsheet</button>
<div id="spreadsheet-status" class="text-xs text-center mt-2"></div>
`;
html = html.replace(/<div class="space-y-4 relative z-10">/, '<div class="space-y-4 relative z-10">' + webhookHtml);

// Fix title
html = html.replace(/<title>MA Finance Tracker V7<\/title>/, '<title>Simple Money Tracker</title>');

// Remove PIN modal
html = html.replace(/<!-- PIN Modal -->[\s\S]*?<\/div>\s*<\/div>/, '');

// Make main content visible by default since we removed PIN
html = html.replace(/id="main-content" class="hidden/, 'id="main-content" class="');
html = html.replace(/id="mobile-nav" class="md:hidden fixed.*?hidden"/, 'id="mobile-nav" class="md:hidden fixed bottom-0 left-0 right-0 glass pb-safe z-40 border-t border-white/5 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]"');

fs.writeFileSync('index.html', html);
console.log('Updated index.html');
