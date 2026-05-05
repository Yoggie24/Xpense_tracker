document.addEventListener('DOMContentLoaded', () => {
            const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzt2el5OeYDohIdAKM3x_GEdth5XroKsOkSALeJi3UfM6u8_C8oUiC26epdw2lMoNEVJw/exec";

            let SYSTEM_CONFIG = { exp: [], inc: [], walletsIDR: [], walletsUSD: [], pin: null };
            let masterData = [], itemToDelete = null, sortState = { k: 'date', o: 'desc' }, calendarDate = new Date(), exchangeRate = 16000;
            let isEditing = false, editItem = null;

            document.getElementById('entry-date').valueAsDate = new Date();
            loadSystemConfig();

            async function loadSystemConfig() {
                try {
                    const response = await fetch(WEB_APP_URL, { method: 'POST', body: JSON.stringify({ action: 'getSystemConfig' }) });
                    const result = await response.json();
                    if (result.status === 'success') {
                        SYSTEM_CONFIG = result;
                        updateWalletOptions('IDR', 'entry-acc-source');
                        updateWalletOptions('IDR', 'entry-acc-target');
                        updateCategoryOptions('expense');
                        document.getElementById('init-loader').classList.add('hidden');
                        checkAuth();
                    } else throw new Error("Failed");
                } catch (e) {
                    document.getElementById('init-loader').innerHTML = '<p class="text-rose-400 font-medium">Connection Failed. Refresh.</p>';
                }
            }

            function updateWalletOptions(currency, selectId) {
                const sel = document.getElementById(selectId);
                const list = currency === 'USD' ? SYSTEM_CONFIG.walletsUSD : SYSTEM_CONFIG.walletsIDR;
                const safeList = (list && list.length > 0) ? list : ["General"];
                sel.innerHTML = safeList.map(w => `<option value="${w}">${w}</option>`).join('');
            }

            document.getElementById('entry-curr-source').addEventListener('change', (e) => updateWalletOptions(e.target.value, 'entry-acc-source'));
            document.getElementById('entry-curr-target').addEventListener('change', (e) => updateWalletOptions(e.target.value, 'entry-acc-target'));

            function handleUrlParams() {
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.has('amount') || urlParams.has('desc')) {
                    setTimeout(() => {
                        updateTabUI('view-add');

                        if (urlParams.has('amount')) document.getElementById('entry-amt-source').value = urlParams.get('amount');
                        if (urlParams.has('desc')) document.getElementById('entry-desc').value = urlParams.get('desc');
                        if (urlParams.has('date')) document.getElementById('entry-date').value = urlParams.get('date');

                        if (urlParams.has('cat')) {
                            const cat = urlParams.get('cat');
                            const catSelect = document.getElementById('entry-cat');
                            if ([...catSelect.options].map(o => o.value).includes(cat)) {
                                catSelect.value = cat;
                                document.getElementById('entry-cat-other').classList.add('hidden');
                            } else {
                                catSelect.value = 'Other';
                                document.getElementById('entry-cat-other').classList.remove('hidden');
                                document.getElementById('entry-cat-other').style.display = 'block';
                                document.getElementById('entry-cat-other').value = cat;
                            }
                        }

                        showToast("Receipt data imported!", "success");
                        window.history.replaceState({}, document.title, window.location.pathname);
                    }, 500);
                }
            }

            function checkAuth() {
                if (sessionStorage.getItem('auth') === 'true') {
                    document.getElementById('pin-modal').classList.add('hidden');
                    document.getElementById('main-content').classList.remove('hidden');
                    document.getElementById('mobile-nav').classList.remove('hidden');
                    fetchData();
                    handleUrlParams();
                } else document.getElementById('pin-modal').classList.remove('hidden');
            }

            document.getElementById('pin-form').addEventListener('submit', e => {
                e.preventDefault();
                if (document.getElementById('pin-input').value === SYSTEM_CONFIG.pin) {
                    sessionStorage.setItem('auth', 'true');
                    document.getElementById('pin-modal').classList.add('hidden');
                    document.getElementById('main-content').classList.remove('hidden');
                    document.getElementById('mobile-nav').classList.remove('hidden');
                    fetchData();
                    handleUrlParams();
                } else document.getElementById('pin-error').textContent = "Incorrect PIN";
            });
            document.getElementById('logout-btn').addEventListener('click', () => { sessionStorage.removeItem('auth'); location.reload(); });

            // Tab Navigation Logic
            const deskNavBtns = document.querySelectorAll('.desk-nav-btn');
            const mobNavBtns = document.querySelectorAll('.mob-nav-btn');

            function updateTabUI(viewId) {
                // Hide all views
                document.querySelectorAll('.tab-view').forEach(v => v.classList.add('hidden'));
                document.getElementById(viewId).classList.remove('hidden');

                // Update Desktop Nav
                deskNavBtns.forEach(btn => {
                    if (btn.dataset.target === viewId) {
                        btn.classList.add('desk-nav-active');
                        btn.classList.remove('text-slate-400');
                    } else {
                        btn.classList.remove('desk-nav-active');
                        btn.classList.add('text-slate-400');
                    }
                });

                // Update Mobile Nav
                mobNavBtns.forEach(btn => {
                    if (btn.dataset.target === viewId) {
                        btn.classList.add('mob-nav-active');
                        btn.classList.remove('text-slate-500');
                    } else {
                        btn.classList.remove('mob-nav-active');
                        btn.classList.add('text-slate-500');
                    }
                });
            }

            deskNavBtns.forEach(b => b.addEventListener('click', e => updateTabUI(e.currentTarget.dataset.target)));
            mobNavBtns.forEach(b => b.addEventListener('click', e => updateTabUI(e.currentTarget.dataset.target)));

            // Expose switchTab globally for edit buttons
            window.switchTab = updateTabUI;

            window.applyDatePreset = (type) => {
                const now = new Date();
                let start, end;
                if (type === 'thisMonth') { start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth() + 1, 0); }
                else if (type === 'lastMonth') { start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0); }
                else if (type === 'last30') { end = new Date(); start = new Date(); start.setDate(now.getDate() - 30); }
                else if (type === 'thisYear') { start = new Date(now.getFullYear(), 0, 1); end = new Date(now.getFullYear(), 11, 31); }
                else { document.getElementById('filter-start').value = ''; document.getElementById('filter-end').value = ''; renderAll(); document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('preset-active')); return; }
                document.getElementById('filter-start').value = start.toISOString().split('T')[0]; document.getElementById('filter-end').value = end.toISOString().split('T')[0]; renderAll();
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('preset-active')); if (event) event.target.classList.add('preset-active');
            };

            function updateCategoryOptions(type) {
                const sel = document.getElementById('entry-cat'); sel.innerHTML = '';
                let options = type === 'income' ? SYSTEM_CONFIG.inc : SYSTEM_CONFIG.exp;
                if (!options || options.length === 0) options = ["General"];
                options.forEach(cat => { const o = document.createElement('option'); o.value = cat; o.textContent = cat; sel.appendChild(o); });
                const otherOpt = document.createElement('option'); otherOpt.value = 'Other'; otherOpt.textContent = 'Other...'; sel.appendChild(otherOpt);
                document.getElementById('entry-cat-other').classList.add('hidden');
            }

            const typeRadios = document.getElementsByName('entry-type');
            const segmentIndicator = document.getElementById('segment-indicator');

            function updateSegmentIndicator(val) {
                if (val === 'expense') { segmentIndicator.style.transform = 'translateX(0%)'; segmentIndicator.className = "absolute top-1 bottom-1 left-1 rounded-lg shadow-sm transition-all duration-300 ease-[cubic-bezier(0.4,0.0,0.2,1)] border border-rose-500/20 bg-rose-500/10 w-[calc(33.33%-4px)]"; }
                else if (val === 'income') { segmentIndicator.style.transform = 'translateX(100%)'; segmentIndicator.className = "absolute top-1 bottom-1 left-1 rounded-lg shadow-sm transition-all duration-300 ease-[cubic-bezier(0.4,0.0,0.2,1)] border border-emerald-500/20 bg-emerald-500/10 w-[calc(33.33%-4px)]"; }
                else if (val === 'transfer') { segmentIndicator.style.transform = 'translateX(200%)'; segmentIndicator.className = "absolute top-1 bottom-1 left-1 rounded-lg shadow-sm transition-all duration-300 ease-[cubic-bezier(0.4,0.0,0.2,1)] border border-blue-500/20 bg-blue-500/10 w-[calc(33.33%-4px)]"; }
            }

            typeRadios.forEach(r => r.addEventListener('change', () => {
                const val = document.querySelector('input[name="entry-type"]:checked').value;
                updateSegmentIndicator(val);
                updateUIForType(val);
            }));

            function updateUIForType(val) {
                const tg = document.getElementById('transfer-target-group'), cg = document.getElementById('category-group'), ls = document.getElementById('lbl-source-acc'), btn = document.getElementById('submit-btn');
                if (val === 'transfer') {
                    tg.classList.remove('hidden'); cg.classList.add('hidden'); ls.innerHTML = '<i class="fas fa-arrow-right mr-1 text-slate-600"></i> FROM / SOURCE';
                    btn.innerHTML = `<span>${isEditing ? "Update Transfer" : "Process Transfer"}</span> <i class="fas fa-exchange-alt"></i>`;
                    btn.className = "w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold py-4 rounded-2xl shadow-[0_8px_20px_rgba(37,99,235,0.3)] hover:shadow-[0_8px_25px_rgba(37,99,235,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4";
                } else {
                    tg.classList.add('hidden'); cg.classList.remove('hidden'); ls.innerHTML = '<i class="fas fa-arrow-right mr-1 text-slate-600"></i> FROM / ACCOUNT';
                    btn.innerHTML = `<span>${isEditing ? "Update Transaction" : "Save Transaction"}</span> <i class="fas fa-check"></i>`;
                    updateCategoryOptions(val);
                    if (val === 'income') btn.className = isEditing ? "w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-4 rounded-2xl shadow-[0_8px_20px_rgba(249,115,22,0.3)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4" : "w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold py-4 rounded-2xl shadow-[0_8px_20px_rgba(16,185,129,0.3)] hover:shadow-[0_8px_25px_rgba(16,185,129,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4";
                    else btn.className = isEditing ? "w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-4 rounded-2xl shadow-[0_8px_20px_rgba(249,115,22,0.3)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4" : "w-full bg-gradient-to-r from-rose-500 to-rose-600 text-white font-bold py-4 rounded-2xl shadow-[0_8px_20px_rgba(225,29,72,0.3)] hover:shadow-[0_8px_25px_rgba(225,29,72,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4";
                }
            }
            document.getElementById('entry-cat').addEventListener('change', e => document.getElementById('entry-cat-other').classList.toggle('hidden', e.target.value !== 'Other'));

            async function fetchData() {
                try {
                    const response = await fetch(WEB_APP_URL, {
                        method: 'POST',
                        body: JSON.stringify({ action: 'getData' })
                    });
                    const result = await response.json();

                    if (result.status !== 'success') throw new Error(result.message || "Failed to load");

                    masterData = [];
                    exchangeRate = result.rate || 16000;

                    const parse = (rows, type) => {
                        if (!rows || rows.length < 2) return;
                        for (let i = 1; i < rows.length; i++) {
                            const r = rows[i];
                            if (!r[0]) continue;
                            let dateStr = typeof r[0] === 'string' ? r[0].split('T')[0] : r[0];
                            let amt = typeof r[5] === 'string' ? parseFloat(r[5].replace(/,/g, '')) : r[5];
                            masterData.push({ type, date: dateStr, desc: r[1], cat: r[2], acc: r[3], curr: r[4], amt: Math.abs(amt || 0) });
                        }
                    };

                    parse(result.income, 'income');
                    parse(result.expenses, 'expense');

                    const cats = [...new Set(masterData.map(d => d.cat))].sort(), accs = [...new Set(masterData.map(d => d.acc))].sort();
                    document.getElementById('filter-cat').innerHTML = '<option value="all">All Categories</option>' + cats.map(c => `<option>${c}</option>`).join('');
                    document.getElementById('filter-acc').innerHTML = '<option value="all">All Accounts</option>' + accs.map(a => `<option>${a}</option>`).join('');
                    renderAll();
                } catch (e) { showToast("Error loading data: " + e.message, 'error'); }
            }

            function fmt(n, c) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: c === 'IDR' ? 0 : 2 }).format(n); }
            function showToast(msg, type) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.remove('hidden'); t.classList.remove('translate-y-[-100px]', 'opacity-0'); setTimeout(() => t.classList.add('translate-y-[-100px]', 'opacity-0'), 3000); }

            function renderAll() {
                const bals = {}; let incIDR = 0, expIDR = 0, incUSD = 0, expUSD = 0;
                masterData.forEach(d => {
                    const k = `${d.acc}-${d.curr}`;
                    if (!bals[k]) bals[k] = { n: d.acc, c: d.curr, v: 0 };
                    if (d.type === 'income') {
                        bals[k].v += d.amt;
                        if (d.cat !== 'Transfer' && d.cat !== 'Initial Balance') { if (d.curr === 'IDR') incIDR += d.amt; else incUSD += d.amt; }
                    } else {
                        bals[k].v -= d.amt;
                        if (d.cat !== 'Transfer') { if (d.curr === 'IDR') expIDR += d.amt; else expUSD += d.amt; }
                    }
                });

                document.getElementById('account-balances-container').innerHTML = Object.values(bals).sort((a, b) => a.n.localeCompare(b.n)).map((b, idx) => {
                    const isUSD = b.c === 'USD';
                    const id = `bal-${idx}`;
                    return `
                    <div class="bg-black/30 p-4 rounded-2xl border border-white/5 hover:border-white/10 transition flex flex-col justify-center min-h-[80px] relative group shadow-inner">
                        <span class="text-[10px] text-slate-400 uppercase font-bold tracking-widest truncate mb-1" title="${b.n}">${b.n}</span>
                        <span id="${id}" class="font-bold font-mono text-sm tracking-tighter truncate ${b.v >= 0 ? 'text-theme-primaryLight' : 'text-rose-400'} ${isUSD ? 'cursor-pointer' : ''}" onclick="${isUSD ? `toggleCurrency('${id}', ${b.v})` : ''}">
                            ${fmt(b.v, b.c)}
                        </span>
                        ${isUSD ? '<div class="absolute top-2 right-2 text-[8px] bg-white/5 p-1 rounded text-slate-500 group-hover:text-theme-primaryLight transition"><i class="fas fa-exchange-alt"></i></div>' : ''}
                    </div>
                `;
                }).join('');

                const totalIncReal = incIDR + (incUSD * exchangeRate);
                const totalExpReal = expIDR + (expUSD * exchangeRate);
                const netCashFlowIDR = totalIncReal - totalExpReal;
                let totalAssetIDR = 0; Object.values(bals).forEach(b => { if (b.c === 'IDR') totalAssetIDR += b.v; if (b.c === 'USD') totalAssetIDR += (b.v * exchangeRate); });

                document.querySelector('#summary-income .stat-value').textContent = fmt(totalIncReal, 'IDR');
                document.querySelector('#summary-expense .stat-value').textContent = fmt(totalExpReal, 'IDR');
                const netEl = document.querySelector('#summary-net .stat-value');
                netEl.textContent = fmt(netCashFlowIDR, 'IDR');
                netEl.className = `stat-value text-[13px] sm:text-base md:text-2xl font-bold truncate z-10 font-mono tracking-tighter ${netCashFlowIDR >= 0 ? 'text-slate-200' : 'text-rose-400'}`;

                document.getElementById('rate-display').textContent = `1 USD = ${fmt(exchangeRate, 'IDR').replace('IDR', '').trim()}`;
                document.getElementById('wealth-display').textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalAssetIDR);

                const s = document.getElementById('filter-search').value.toLowerCase(), start = document.getElementById('filter-start').value, end = document.getElementById('filter-end').value, fCat = document.getElementById('filter-cat').value, fAcc = document.getElementById('filter-acc').value;
                let filtered = masterData.filter(d => {
                    if (start && d.date < start) return false; if (end && d.date > end) return false;
                    if (fCat !== 'all' && d.cat !== fCat) return false; if (fAcc !== 'all' && d.acc !== fAcc) return false;
                    if (s && !d.desc.toLowerCase().includes(s)) return false; return true;
                }).sort((a, b) => sortState.o === 'asc' ? (a[sortState.k] > b[sortState.k] ? 1 : -1) : (a[sortState.k] < b[sortState.k] ? 1 : -1));

                document.getElementById('mobile-trans-list').innerHTML = filtered.map(d => `
                <div class="glass p-4 rounded-2xl flex justify-between items-center active:scale-[0.98] transition-transform">
                    <div class="flex flex-col max-w-[60%] space-y-1.5">
                        <span class="text-sm font-bold text-slate-100 truncate">${d.desc}</span>
                        <div class="flex flex-wrap items-center gap-2 text-[10px] font-medium text-slate-400">
                            <span class="bg-black/30 px-2 py-1 rounded-md border border-white/5">${d.date.slice(5)}</span>
                            <span class="bg-theme-primary/10 text-theme-primaryLight px-2 py-1 rounded-md border border-theme-primary/20 uppercase tracking-wider">${d.acc}</span>
                        </div>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                        <span class="font-bold font-mono text-sm ${d.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}">${d.type === 'income' ? '+' : '-'} ${fmt(d.amt, d.curr)}</span>
                        <div class="flex gap-2">
                            <button class="bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg p-1.5 w-8 h-8 flex items-center justify-center transition edit-btn" data-item='${JSON.stringify(d)}'><i class="fas fa-pen text-xs"></i></button>
                            <button class="bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg p-1.5 w-8 h-8 flex items-center justify-center transition del-btn" data-item='${JSON.stringify(d)}'><i class="fas fa-trash text-xs"></i></button>
                        </div>
                    </div>
                </div>
            `).join('');
                if (filtered.length === 0) document.getElementById('mobile-trans-list').innerHTML = '<div class="text-center text-slate-500 py-10 text-sm italic glass rounded-2xl">No transactions found</div>';

                document.getElementById('data-body').innerHTML = filtered.map(d => `
                <tr class="hover:bg-white/5 transition border-b border-white/5 last:border-0 group">
                    <td class="px-6 py-4 text-sm text-slate-400 whitespace-nowrap font-mono">${d.date}</td>
                    <td class="px-6 py-4 text-sm text-slate-200 font-medium">${d.desc}</td>
                    <td class="px-6 py-4 text-sm"><span class="bg-theme-primary/10 text-theme-primaryLight border border-theme-primary/20 px-2.5 py-1 rounded-lg text-xs font-medium">${d.acc}</span></td>
                    <td class="px-6 py-4 text-sm text-slate-400"><span class="bg-black/30 border border-white/5 px-2.5 py-1 rounded-lg text-xs">${d.cat}</span></td>
                    <td class="px-6 py-4 text-sm text-right font-mono font-bold ${d.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}">${d.type === 'income' ? '+' : '-'} ${fmt(d.amt, d.curr)}</td>
                    <td class="px-4 py-4 text-center">
                        <div class="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition">
                            <button class="w-8 h-8 bg-white/5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition edit-btn" data-item='${JSON.stringify(d)}'><i class="fas fa-pen text-xs"></i></button>
                            <button class="w-8 h-8 bg-rose-500/10 rounded-lg text-rose-400 hover:bg-rose-500/20 transition del-btn" data-item='${JSON.stringify(d)}'><i class="fas fa-trash text-xs"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
                if (filtered.length === 0) document.getElementById('data-body').innerHTML = '<tr><td colspan="6" class="text-center py-10 text-slate-500 text-sm italic">No data found</td></tr>';

                renderDaily(masterData); renderCalendar(masterData); updateChart(masterData); updateTrendChart(masterData); renderDashWidgets(masterData);
            }

            window.toggleCurrency = (id, usdVal) => {
                const el = document.getElementById(id);
                if (el.textContent.includes('$')) { const idrVal = usdVal * exchangeRate; el.textContent = fmt(idrVal, 'IDR'); el.classList.add('text-yellow-400'); } else { el.textContent = fmt(usdVal, 'USD'); el.classList.remove('text-yellow-400'); }
            };

            function renderDaily(data) {
                const dly = {}; data.filter(d => d.type === 'expense' && d.cat !== 'Transfer').forEach(d => { if (!dly[d.date]) dly[d.date] = { idr: 0, usd: 0 }; if (d.curr === 'IDR') dly[d.date].idr += d.amt; else dly[d.date].usd += d.amt; });
                document.getElementById('daily-body').innerHTML = Object.keys(dly).sort().reverse().map(dt => `<tr class="hover:bg-white/5 transition border-b border-white/5 last:border-0"><td class="px-6 py-4 text-sm text-slate-300 font-medium font-mono">${dt}</td><td class="px-6 py-4 text-sm text-right text-rose-400 font-mono">${dly[dt].idr > 0 ? fmt(dly[dt].idr, 'IDR') : '-'}</td><td class="px-6 py-4 text-sm text-right text-rose-400 font-mono">${dly[dt].usd > 0 ? fmt(dly[dt].usd, 'USD') : '-'}</td></tr>`).join('');
            }

            function renderCalendar(data) {
                const g = document.getElementById('calendar-grid'); g.innerHTML = ''; const y = calendarDate.getFullYear(), m = calendarDate.getMonth(); document.getElementById('calendar-header').textContent = calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });
                for (let i = 0; i < new Date(y, m, 1).getDay(); i++) g.appendChild(document.createElement('div'));
                for (let d = 1; d <= new Date(y, m + 1, 0).getDate(); d++) {
                    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, items = data.filter(i => i.date === dateStr), el = document.createElement('div');
                    el.className = "calendar-day bg-black/20 border border-white/5 rounded-2xl p-2 flex flex-col items-center justify-start cursor-pointer relative overflow-hidden group";
                    el.innerHTML = `<span class="text-xs text-slate-400 mb-1 font-bold z-10 group-hover:text-white transition">${d}</span>`;
                    if (items.length > 0) {
                        el.innerHTML += `<div class="flex gap-1.5 mt-auto pb-1 z-10">${items.some(x => x.type === 'income') ? '<div class="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]"></div>' : ''}${items.some(x => x.type === 'expense') ? '<div class="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_5px_rgba(225,29,72,0.8)]"></div>' : ''}</div>`;
                        el.onclick = () => {
                            document.getElementById('cal-detail-title').textContent = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                            document.getElementById('cal-detail-content').innerHTML = items.map(x => `<div class="flex justify-between items-center p-4 bg-black/30 rounded-2xl border border-white/5 mb-2 hover:bg-black/50 transition"><div class="flex items-center gap-3"><div class="w-2 h-2 rounded-full ${x.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}"></div><div><div class="text-sm text-white font-bold">${x.desc}</div><div class="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-bold">${x.cat} • ${x.acc}</div></div></div><div class="${x.type === 'income' ? 'text-emerald-400' : 'text-rose-400'} font-mono text-sm font-bold bg-white/5 px-2 py-1 rounded-lg">${fmt(x.amt, x.curr)}</div></div>`).join('');
                            document.getElementById('calendar-detail-modal').classList.remove('hidden');
                        };
                    }
                    g.appendChild(el);
                }
            }
            document.getElementById('prev-month').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(masterData); });
            document.getElementById('next-month').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(masterData); });
            document.getElementById('cal-close').addEventListener('click', () => document.getElementById('calendar-detail-modal').classList.add('hidden'));

            let myChart;
            function updateChart(data) {
                const curr = document.getElementById('chart-currency-toggle').value; const exps = data.filter(d => d.type === 'expense' && d.curr === curr && d.cat !== 'Transfer'); const totals = {}; exps.forEach(d => totals[d.cat] = (totals[d.cat] || 0) + d.amt);
                const ctx = document.getElementById('expense-pie-chart').getContext('2d'); if (myChart) myChart.destroy();

                // Premium color palette for pie chart
                const chartColors = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#F43F5E', '#8B5CF6', '#EC4899', '#14B8A6', '#6366F1'];

                myChart = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: Object.keys(totals),
                        datasets: [{
                            data: Object.values(totals),
                            backgroundColor: chartColors,
                            borderWidth: 2,
                            borderColor: '#0B1325',
                            hoverOffset: 6
                        }]
                    },
                    options: {
                        plugins: {
                            legend: { display: false },
                            tooltip: { backgroundColor: 'rgba(11, 19, 37, 0.9)', titleColor: '#fff', bodyColor: '#cbd5e1', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 12, cornerRadius: 12, displayColors: true }
                        },
                        cutout: '75%',
                        responsive: true,
                        maintainAspectRatio: false
                    }
                });

                document.getElementById('expense-details').innerHTML = Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([k, v], i) => `<div class="flex justify-between items-center text-xs py-2 border-b border-white/5 last:border-0"><div class="flex items-center gap-2"><div class="w-2.5 h-2.5 rounded-full" style="background-color: ${chartColors[i % chartColors.length]}"></div><span class="text-slate-300 font-medium">${k}</span></div><span class="font-mono text-white font-bold bg-white/5 px-2 py-0.5 rounded-md">${fmt(v, curr)}</span></div>`).join('');
            }

            let trendChart;
            function updateTrendChart(data) {
                const ctx = document.getElementById('trend-line-chart').getContext('2d');
                if (trendChart) trendChart.destroy();
                const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const rawData = data.filter(d => d.type === 'expense' && d.cat !== 'Transfer' && new Date(d.date) >= thirtyDaysAgo);
                const dailyTotals = {}; rawData.forEach(d => { const date = d.date; const amountIDR = d.curr === 'USD' ? d.amt * exchangeRate : d.amt; dailyTotals[date] = (dailyTotals[date] || 0) + amountIDR; });
                const sortedDates = Object.keys(dailyTotals).sort(); const values = sortedDates.map(date => dailyTotals[date]);
                const labels = sortedDates.map(d => { const dateObj = new Date(d); return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); });

                trendChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Total Expenses (IDR)',
                            data: values,
                            borderColor: '#4F46E5',
                            backgroundColor: (context) => { const ctx = context.chart.ctx; const gradient = ctx.createLinearGradient(0, 0, 0, 300); gradient.addColorStop(0, 'rgba(79, 70, 229, 0.5)'); gradient.addColorStop(1, 'rgba(79, 70, 229, 0.0)'); return gradient; },
                            borderWidth: 3,
                            tension: 0.4,
                            pointRadius: 0,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#4F46E5',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            fill: true
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        plugins: {
                            legend: { display: false },
                            tooltip: { backgroundColor: 'rgba(11, 19, 37, 0.9)', titleColor: '#fff', bodyColor: '#cbd5e1', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 12, cornerRadius: 12 }
                        },
                        scales: {
                            x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10, family: "'Inter', sans-serif" } } },
                            y: { border: { display: false }, grid: { color: 'rgba(255,255,255,0.05)', borderDash: [4, 4] }, ticks: { color: '#64748b', font: { size: 10, family: "'JetBrains Mono', monospace" }, callback: function (value) { return value >= 1000000 ? (value / 1000000).toFixed(1) + 'M' : (value / 1000).toFixed(0) + 'k'; } } }
                        }
                    }
                });
            }

            document.getElementById('add-entry-form').addEventListener('submit', e => {
                e.preventDefault(); const btn = document.getElementById('submit-btn'); const origTxt = btn.innerHTML; btn.innerHTML = '<div class="loader w-5 h-5 border-2 border-white border-t-transparent"></div>'; btn.disabled = true;
                const type = document.querySelector('input[name="entry-type"]:checked').value, date = document.getElementById('entry-date').value, desc = document.getElementById('entry-desc').value;
                let payload = {};

                if (isEditing) {
                    let cat = document.getElementById('entry-cat').value; if (cat === 'Other') cat = document.getElementById('entry-cat-other').value;
                    payload = {
                        action: 'edit',
                        oldSheetName: editItem.type === 'income' ? 'Income' : 'Expenses',
                        originalData: editItem,
                        newSheetName: type === 'income' ? 'Income' : 'Expenses',
                        newData: { date, description: desc, category: cat, account: document.getElementById('entry-acc-source').value, currency: document.getElementById('entry-curr-source').value, amount: Math.abs(parseFloat(document.getElementById('entry-amt-source').value)) }
                    };
                } else {
                    if (type === 'transfer') {
                        const fromAmt = parseFloat(document.getElementById('entry-amt-source').value), toAmtInput = document.getElementById('entry-amt-target').value, toAmt = toAmtInput ? parseFloat(toAmtInput) : fromAmt;
                        if (document.getElementById('entry-acc-source').value === document.getElementById('entry-acc-target').value && document.getElementById('entry-curr-source').value === document.getElementById('entry-curr-target').value) { showToast("Source and Target are identical!", 'error'); btn.innerHTML = origTxt; btn.disabled = false; return; }
                        payload = { action: 'transfer', date, description: desc, fromAccount: document.getElementById('entry-acc-source').value, fromCurrency: document.getElementById('entry-curr-source').value, fromAmount: Math.abs(fromAmt), toAccount: document.getElementById('entry-acc-target').value, toCurrency: document.getElementById('entry-curr-target').value, toAmount: Math.abs(toAmt) };
                    } else {
                        let cat = document.getElementById('entry-cat').value; if (cat === 'Other') cat = document.getElementById('entry-cat-other').value;
                        payload = { action: 'add', sheetName: type === 'income' ? 'Income' : 'Expenses', date, description: desc, category: cat, account: document.getElementById('entry-acc-source').value, currency: document.getElementById('entry-curr-source').value, amount: Math.abs(parseFloat(document.getElementById('entry-amt-source').value)) };
                    }
                }

                fetch(WEB_APP_URL, { method: 'POST', body: JSON.stringify(payload) }).then(r => r.json()).then(d => {
                    if (d.status === 'success') { showToast(d.message, 'success'); resetForm(); setTimeout(fetchData, 1500); } else throw new Error(d.message);
                }).catch(e => showToast("Error: " + e.message, 'error')).finally(() => { btn.innerHTML = origTxt; btn.disabled = false; });
            });

            function resetForm() {
                document.getElementById('add-entry-form').reset(); document.getElementById('entry-date').valueAsDate = new Date();
                isEditing = false; editItem = null; document.getElementById('form-title').innerHTML = '<div class="w-10 h-10 rounded-xl bg-theme-primary/20 flex items-center justify-center text-theme-primaryLight border border-theme-primary/30"><i class="fas fa-plus"></i></div> New Entry'; document.getElementById('cancel-edit-btn').classList.add('hidden');
                updateWalletOptions('IDR', 'entry-acc-source'); updateWalletOptions('IDR', 'entry-acc-target');
                document.querySelector('input[name="entry-type"][value="expense"]').checked = true; document.querySelector('input[name="entry-type"][value="expense"]').dispatchEvent(new Event('change'));
            }
            document.getElementById('cancel-edit-btn').addEventListener('click', resetForm);

            document.addEventListener('click', e => {
                const btnEdit = e.target.closest('.edit-btn'), btnDel = e.target.closest('.del-btn');

                if (btnDel) {
                    itemToDelete = JSON.parse(btnDel.dataset.item);
                    document.getElementById('del-item-preview').innerHTML = `<div class="font-bold text-white text-base mb-1">${itemToDelete.desc}</div><div class="${itemToDelete.type === 'income' ? 'text-emerald-400' : 'text-rose-400'} font-mono text-xl font-bold">${fmt(itemToDelete.amt, itemToDelete.curr)}</div><div class="text-[10px] uppercase font-bold tracking-wider text-slate-500 mt-3">${itemToDelete.date} • ${itemToDelete.acc}</div>`;
                    document.getElementById('delete-modal').classList.remove('hidden');
                }

                if (btnEdit) {
                    const item = JSON.parse(btnEdit.dataset.item);
                    if (item.cat === 'Transfer') { showToast("Please delete and recreate transfer.", 'error'); return; }
                    isEditing = true; editItem = item;
                    document.getElementById('form-title').innerHTML = '<div class="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400 border border-orange-500/30"><i class="fas fa-pen"></i></div> Edit Entry'; document.getElementById('cancel-edit-btn').classList.remove('hidden');

                    // Switch to Add Tab
                    updateTabUI('view-add');

                    document.querySelector(`input[name="entry-type"][value="${item.type}"]`).checked = true;
                    updateSegmentIndicator(item.type);
                    updateUIForType(item.type);

                    document.getElementById('entry-desc').value = item.desc;
                    document.getElementById('entry-date').value = item.date;

                    const catSelect = document.getElementById('entry-cat');
                    if ([...catSelect.options].map(o => o.value).includes(item.cat)) catSelect.value = item.cat;
                    else { catSelect.value = 'Other'; document.getElementById('entry-cat-other').classList.remove('hidden'); document.getElementById('entry-cat-other').value = item.cat; }

                    document.getElementById('entry-curr-source').value = item.curr;
                    updateWalletOptions(item.curr, 'entry-acc-source');
                    document.getElementById('entry-acc-source').value = item.acc;
                    document.getElementById('entry-amt-source').value = item.amt;
                }
            });

            document.getElementById('del-cancel').addEventListener('click', () => document.getElementById('delete-modal').classList.add('hidden'));
            document.getElementById('del-confirm').addEventListener('click', () => {
                const btn = document.getElementById('del-confirm'); const origTxt = btn.textContent; btn.innerHTML = '<div class="loader w-4 h-4 border-2 border-white border-t-transparent mx-auto"></div>';
                fetch(WEB_APP_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'delete', sheetName: itemToDelete.type === 'income' ? 'Income' : 'Expenses', originalData: itemToDelete })
                }).then(r => r.json()).then(d => {
                    document.getElementById('delete-modal').classList.add('hidden'); btn.textContent = origTxt; if (d.status === 'success') { showToast("Deleted successfully", 'success'); fetchData(); } else showToast(d.message, 'error');
                });
            });

            function fmt(n, c) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: c, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n); }
            function showToast(m, type) {
                const t = document.getElementById('toast');
                t.className = `fixed top-5 left-1/2 transform -translate-x-1/2 glass text-white px-6 py-4 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.5)] border z-[90] flex items-center gap-3 min-w-[250px] justify-center transition-all duration-300 translate-y-0 opacity-100 ${type === 'error' ? 'border-rose-500/30 bg-rose-950/80' : 'border-emerald-500/30 bg-emerald-950/80'}`;
                t.innerHTML = `${type === 'error' ? '<div class="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400"><i class="fas fa-exclamation-circle text-lg"></i></div>' : '<div class="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400"><i class="fas fa-check text-lg"></i></div>'} <span class="font-medium text-sm tracking-wide">${m}</span>`;
                t.classList.remove('hidden');
                setTimeout(() => { t.classList.add('translate-y-[-100px]', 'opacity-0'); setTimeout(() => t.classList.add('hidden'), 300); }, 3000);
            }

            ['filter-start', 'filter-end', 'filter-cat', 'filter-acc', 'filter-search'].forEach(i => document.getElementById(i).addEventListener('input', renderAll));
            document.getElementById('chart-currency-toggle').addEventListener('change', () => updateChart(masterData));
            document.querySelectorAll('.sortable').forEach(s => s.addEventListener('click', e => { sortState.k = e.target.dataset.sort; sortState.o = sortState.o === 'asc' ? 'desc' : 'asc'; renderAll(); }));
            document.getElementById('export-btn').addEventListener('click', async () => {
                const el = document.getElementById('main-content');
                const bgClass = document.body.className;
                document.body.className = "bg-[#050B14] min-h-screen text-slate-300"; // Ensure export has clean bg

                // Temporarily hide mobile nav for export if visible
                const mobNav = document.getElementById('mobile-nav');
                const mobNavWasHidden = mobNav.classList.contains('hidden');
                mobNav.classList.add('hidden');

                try {
                    const c = await html2canvas(el, { backgroundColor: '#050B14', scale: 2, ignoreElements: (e) => e.id === 'toast' || e.id === 'init-loader' || e.tagName === 'NAV' });
                    const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = 'finance_dashboard.png'; a.click();
                } finally {
                    document.body.className = bgClass;
                    if (!mobNavWasHidden) mobNav.classList.remove('hidden');
                }
            });
            function renderDashWidgets(data) {
                // Recent Activity
                const sortedData = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
                const recent = sortedData.slice(0, 5);
                document.getElementById('dash-recent-list').innerHTML = recent.map(d => `
                <div class="bg-black/20 p-3 rounded-2xl flex justify-between items-center border border-white/5 hover:border-white/10 transition">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm ${d.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}">
                            <i class="fas ${d.type === 'income' ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                        </div>
                        <div>
                            <div class="text-sm font-bold text-slate-200 truncate max-w-[150px] sm:max-w-[200px]">${d.desc}</div>
                            <div class="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-0.5">${d.date} • ${d.cat}</div>
                        </div>
                    </div>
                    <div class="font-mono text-sm font-bold ${d.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}">
                        ${d.type === 'income' ? '+' : '-'} ${fmt(d.amt, d.curr)}
                    </div>
                </div>
            `).join('');
                if (recent.length === 0) document.getElementById('dash-recent-list').innerHTML = '<div class="text-center text-slate-500 py-4 text-xs italic">No activity yet</div>';

                // Top Categories (This Month)
                const now = new Date();
                const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                const thisMonthExps = data.filter(d => d.type === 'expense' && d.cat !== 'Transfer' && d.date.startsWith(thisMonth));

                let totalThisMonth = 0;
                const catTotals = {};
                thisMonthExps.forEach(d => {
                    const amtIDR = d.curr === 'USD' ? d.amt * exchangeRate : d.amt;
                    catTotals[d.cat] = (catTotals[d.cat] || 0) + amtIDR;
                    totalThisMonth += amtIDR;
                });

                const topCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 4);
                const chartColors = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#F43F5E'];

                document.getElementById('dash-top-cat-list').innerHTML = topCats.map((c, i) => {
                    const percentage = totalThisMonth > 0 ? (c[1] / totalThisMonth) * 100 : 0;
                    return `
                <div class="space-y-1.5">
                    <div class="flex justify-between items-end">
                        <span class="text-xs font-bold text-slate-300">${c[0]}</span>
                        <span class="font-mono text-xs text-white bg-white/5 px-2 py-0.5 rounded-md border border-white/5">${fmt(c[1], 'IDR')}</span>
                    </div>
                    <div class="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                        <div class="h-full rounded-full" style="width: ${percentage}%; background-color: ${chartColors[i % chartColors.length]}; box-shadow: 0 0 10px ${chartColors[i % chartColors.length]}80;"></div>
                    </div>
                </div>`;
                }).join('');
                if (topCats.length === 0) document.getElementById('dash-top-cat-list').innerHTML = '<div class="text-center text-slate-500 py-4 text-xs italic">No expenses this month</div>';
            }

            document.getElementById('export-csv-btn').addEventListener('click', () => {
                if (masterData.length === 0) { showToast("No data to export", "error"); return; }
                let csvContent = "Type,Date,Description,Category,Account,Currency,Amount\n";
                masterData.forEach(d => {
                    const row = [d.type, d.date, `"${d.desc.replace(/"/g, '""')}"`, `"${d.cat}"`, `"${d.acc}"`, d.curr, d.amt];
                    csvContent += row.join(",") + "\n";
                });
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", `finance_tracker_export_${new Date().toISOString().split('T')[0]}.csv`);
                document.body.appendChild(link);
                link.click();
                setTimeout(() => {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 100);
                showToast("CSV Exported successfully", "success");
            });

            // Settings & AI Receipt Scanner
            const aiProviderSelect = document.getElementById('ai-provider-select');
            const geminiContainer = document.getElementById('gemini-key-container');
            const groqContainer = document.getElementById('groq-key-container');

            aiProviderSelect.addEventListener('change', (e) => {
                if (e.target.value === 'groq') {
                    geminiContainer.classList.add('hidden');
                    groqContainer.classList.remove('hidden');
                } else {
                    groqContainer.classList.add('hidden');
                    geminiContainer.classList.remove('hidden');
                }
            });

            document.getElementById('settings-btn').addEventListener('click', () => {
                const provider = localStorage.getItem('aiProvider') || 'gemini';
                aiProviderSelect.value = provider;
                aiProviderSelect.dispatchEvent(new Event('change'));

                document.getElementById('gemini-api-key').value = localStorage.getItem('geminiApiKey') || '';
                document.getElementById('groq-api-key').value = localStorage.getItem('groqApiKey') || '';
                document.getElementById('settings-modal').classList.remove('hidden');
            });
            document.getElementById('settings-close').addEventListener('click', () => document.getElementById('settings-modal').classList.add('hidden'));
            document.getElementById('save-settings-btn').addEventListener('click', () => {
                localStorage.setItem('aiProvider', aiProviderSelect.value);
                localStorage.setItem('geminiApiKey', document.getElementById('gemini-api-key').value.trim());
                localStorage.setItem('groqApiKey', document.getElementById('groq-api-key').value.trim());
                document.getElementById('settings-modal').classList.add('hidden');
                showToast("Settings saved", "success");
            });

            const scanBtn = document.getElementById('scan-receipt-btn');
            const uploadInput = document.getElementById('receipt-upload');
            scanBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const provider = localStorage.getItem('aiProvider') || 'gemini';
                const key = provider === 'groq' ? localStorage.getItem('groqApiKey') : localStorage.getItem('geminiApiKey');

                if (!key) {
                    showToast(`Please save your ${provider === 'groq' ? 'Groq' : 'Gemini'} API Key first`, "error");
                    document.getElementById('settings-btn').click();
                    return;
                }
                uploadInput.click();
            });

            uploadInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const origHtml = scanBtn.innerHTML;
                scanBtn.innerHTML = '<div class="loader w-4 h-4 border-2 border-emerald-500 border-t-transparent mx-auto"></div>';
                scanBtn.disabled = true;

                try {
                    const base64Img = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            const img = new Image();
                            img.onload = () => {
                                const canvas = document.createElement('canvas');
                                let w = img.width, h = img.height;
                                const maxD = 1024;
                                if (w > h && w > maxD) { h *= maxD / w; w = maxD; }
                                else if (h > maxD) { w *= maxD / h; h = maxD; }
                                canvas.width = w; canvas.height = h;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(img, 0, 0, w, h);
                                resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
                            };
                            img.onerror = reject;
                            img.src = ev.target.result;
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });

                    const provider = localStorage.getItem('aiProvider') || 'gemini';
                    const apiKey = provider === 'groq' ? localStorage.getItem('groqApiKey') : localStorage.getItem('geminiApiKey');
                    const prompt = `You are a receipt data extractor. Analyze this receipt and extract:
1. Total Amount (number only, no currency symbols)
2. Description (store name or short summary)
3. Date (YYYY-MM-DD format, if not visible return current date)
4. Category (choose the most appropriate one: Food, Shopping, Transport, Utilities, Health, Entertainment, Error, Transfer, Charity, Salary, Interest, Deposit)
Return ONLY a valid JSON object matching this exact structure:
{"amount": 100000, "description": "Store Name", "date": "2024-05-05", "category": "Food"}
Do not wrap in markdown tags like \`\`\`json.`;

                    let text = "";

                    if (provider === 'groq') {
                        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${apiKey}`
                            },
                            body: JSON.stringify({
                                model: "meta-llama/llama-4-scout-17b-16e-instruct",
                                messages: [{
                                    role: "user",
                                    content: [
                                        { type: "text", text: prompt },
                                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Img}` } }
                                    ]
                                }],
                                temperature: 0.1,
                                max_tokens: 1024
                            })
                        });

                        if (res.status === 429) throw new Error("Groq Rate Limit Exceeded.");
                        if (!res.ok) {
                            const errData = await res.json().catch(() => null);
                            const errMsg = errData && errData.error ? errData.error.message : await res.text();
                            throw new Error(`Groq API Error: ${res.status} - ${errMsg}`);
                        }
                        const data = await res.json();
                        text = data.choices[0].message.content.trim();

                    } else {
                        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{
                                    parts: [
                                        { text: prompt },
                                        { inlineData: { mimeType: 'image/jpeg', data: base64Img } }
                                    ]
                                }],
                                generationConfig: { temperature: 0.1 }
                            })
                        });

                        if (res.status === 429) throw new Error("Google AI Rate Limit Exceeded. Please wait a minute before trying again.");
                        if (!res.ok) throw new Error(`API Error: ${res.status}`);
                        const data = await res.json();
                        text = data.candidates[0].content.parts[0].text.trim();
                    }

                    if (text.startsWith('```json')) text = text.replace(/^```json/, '').replace(/```$/, '').trim();

                    const parsed = JSON.parse(text);

                    // Switch to expense implicitly
                    document.querySelector('input[name="entry-type"][value="expense"]').checked = true;
                    document.querySelector('input[name="entry-type"][value="expense"]').dispatchEvent(new Event('change'));

                    if (parsed.amount) document.getElementById('entry-amt-source').value = parsed.amount;
                    if (parsed.description) document.getElementById('entry-desc').value = parsed.description;
                    if (parsed.date && parsed.date.length === 10) document.getElementById('entry-date').value = parsed.date;

                    if (parsed.category) {
                        const catSelect = document.getElementById('entry-cat');
                        if ([...catSelect.options].map(o => o.value).includes(parsed.category)) {
                            catSelect.value = parsed.category;
                            document.getElementById('entry-cat-other').classList.add('hidden');
                        } else {
                            catSelect.value = 'Other';
                            document.getElementById('entry-cat-other').classList.remove('hidden');
                            document.getElementById('entry-cat-other').style.display = 'block';
                            document.getElementById('entry-cat-other').value = parsed.category;
                        }
                    }
                    showToast("Receipt scanned successfully!", "success");
                } catch (err) {
                    console.error(err);
                    showToast("Failed to scan receipt: " + err.message, "error");
                } finally {
                    scanBtn.innerHTML = origHtml;
                    scanBtn.disabled = false;
                    uploadInput.value = '';
                }
            });
        });
    