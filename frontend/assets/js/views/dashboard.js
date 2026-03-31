import { api } from '../api.js';
import { getState } from '../state.js';
import { feedCard, icon, modal, closeModal, bindFeedEvents } from '../components.js';

export const title = 'Feed';

const PAGE_SIZE = 10;

let pollTimer = null;
let scrollState = null;
let activeScrollCleanup = null;
let filterCat = '';
let filterStatus = '';

export async function render(container) {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (activeScrollCleanup) { activeScrollCleanup(); activeScrollCleanup = null; }

    scrollState = { offset: 0, loading: false, hasMore: true };
    filterCat = ''; 
    filterStatus = '';

    const { tenantId } = getState();
    if (!tenantId) { container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Kein Mandant ausgewählt.</div></div>'; return; }

    let stats, agents;
    try {
        [stats, agents] = await Promise.all([
            api.get(`/feed/stats?tenant_id=${tenantId}`),
            api.get(`/agents?tenant_id=${tenantId}`),
        ]);
    } catch (e) { container.innerHTML = `<div class="empty-state"><div class="empty-state-text">Fehler: ${e.message}</div></div>`; return; }

    const activeAgents = agents.filter(a => a.is_active);
    const agentOpts = activeAgents.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

    container.innerHTML = `
        <div class="page-header" style="max-width: 720px; margin: 0 auto 24px auto;">
            <div><h1 class="page-title">Feed</h1><p class="page-subtitle">Zentrale Steuerung Ihres AMS</p></div>
            <div style="display:flex;gap:8px;">
                <button class="btn btn-primary" id="btn-toggle-task" style="border-radius:24px;">${icon('plus')} Aufgabe</button>
            </div>
        </div>
        <div class="task-input-card" id="task-input-card" style="display: none; max-width: 720px; margin: 0 auto 24px auto; border-radius: 20px; border: 1px solid var(--accent);">
            <div class="task-input-header">${icon('zap')} <span>Aufgabe an den Agenten</span></div>
            <textarea id="task-input" class="task-input-textarea" placeholder="Beschreiben Sie die Aufgabe in natürlicher Sprache… z. B. „Lies dieses Dokument und speichere es in der Buchhaltung.""></textarea>
            
            <div style="margin-bottom:12px; display:flex; align-items:center; gap:12px;">
                <label class="btn btn-ghost btn-sm" style="cursor:pointer;">
                    ${icon('upload')} Datei anhängen
                    <input type="file" id="task-file" style="display:none;" accept=".pdf,.png,.jpg,.jpeg">
                </label>
                <span id="task-file-name" style="font-size:12px;color:var(--text-secondary);">Keine Datei ausgewählt</span>
            </div>

            <div class="task-input-bar">
                <select class="form-select" id="task-cat">
                    ${(getState().workflows || []).map(w => `<option value="${w.slug}">${w.name}</option>`).join('')}
                    <option value="general">Allgemein (Kein Workflow)</option>
                </select>
                <select class="form-select" id="task-agent"><option value="">Standard-Agent</option>${agentOpts}</select>
                <button class="btn btn-primary" id="task-submit">${icon('zap')} Absenden</button>
            </div>
        </div>
        <div class="toolbar" style="max-width: 720px; margin: 0 auto 24px auto; justify-content: center; gap: 12px; background: var(--bg-tertiary); padding: 8px; border-radius: 30px; border: 1px solid var(--border);">
            <select class="form-select" id="feed-filter-cat" style="background:transparent; border:none; width: auto; font-weight:600;">
                <option value="">Alle Bereiche</option>
                ${(getState().workflows || []).map(w => `<option value="${w.slug}">${w.name}</option>`).join('')}
            </select>
            <div style="width:1px; height:20px; background:var(--border);"></div>
            <select class="form-select" id="feed-filter-status" style="background:transparent; border:none; width: auto; font-weight:600;">
                <option value="">Alle Status</option>
                <option value="pending">Offen</option>
                <option value="processing">Läuft</option>
                <option value="approved">Erledigt</option>
            </select>
        </div>
        <div class="feed-list" id="feed-list"></div>
        <div class="feed-loader" id="feed-loader" style="display:none;">Weitere Einträge werden geladen…</div>
        <div id="load-more-container" style="text-align:center; padding:20px; display:none;">
            <button id="btn-load-more" class="btn btn-ghost">Mehr laden</button>
        </div>
        <div class="feed-end" id="feed-end" style="display:none;">Keine weiteren Einträge.</div>`;

    const refresh = () => {
        const list = container.querySelector('#feed-list');
        const end = container.querySelector('#feed-end');
        if (list) list.innerHTML = '';
        if (end) end.style.display = 'none';
        scrollState.offset = 0;
        scrollState.hasMore = true;
        scrollState.loading = false;
        loadMore(container, refresh);
    };

    bindAll(container, refresh);
    startPolling(container, refresh);
    
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && scrollState && !scrollState.loading && scrollState.hasMore) {
            loadMore(container, refresh);
        }
    }, { threshold: 0.1 });
    const sentinel = container.querySelector('#load-more-container');
    if (sentinel) observer.observe(sentinel);
    activeScrollCleanup = () => observer.disconnect();

    await loadMore(container, refresh);

    return () => {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        if (activeScrollCleanup) { activeScrollCleanup(); activeScrollCleanup = null; }
    };
}

function startPolling(container, refreshCallback) {
    pollTimer = setInterval(async () => {
        const processingCards = container.querySelectorAll('.feed-card[data-status="processing"]');
        if (processingCards.length === 0) return;

        for (const card of processingCards) {
            try {
                const item = await api.get(`/feed/${card.dataset.id}`);
                if (item.status !== 'processing') {
                    const temp = document.createElement('div');
                    temp.innerHTML = feedCard(item);
                    card.replaceWith(temp.firstElementChild);
                    const list = container.querySelector('#feed-list');
                    if (list) {
                        bindFeedEvents(list, refreshCallback);
                    }
                }
            } catch (e) {}
        }
    }, 5000);
}

async function loadMore(container, refreshCallback) {
    if (!scrollState || scrollState.loading || !scrollState.hasMore) return;
    
    scrollState.loading = true;
    const { tenantId } = getState();
    const loader = container.querySelector('#feed-loader');
    if (loader) loader.style.display = 'block';
    
    try {
        let url = `/feed?tenant_id=${tenantId}&limit=${PAGE_SIZE}&offset=${scrollState.offset}`;
        if (filterCat) url += `&category=${filterCat}`;
        if (filterStatus) url += `&status=${filterStatus}`;
        
        const data = await api.get(url);
        const items = data.items || [];
        
        const list = container.querySelector('#feed-list');
        if (!list) return;

        if (scrollState.offset === 0 && items.length === 0) {
            list.innerHTML = '<div class="empty-state"><div class="empty-state-text">Keine Feed-Einträge.</div></div>';
            scrollState.hasMore = false;
        } else {
            if (scrollState.offset === 0) list.innerHTML = '';
            items.forEach(i => list.insertAdjacentHTML('beforeend', feedCard(i)));
            bindFeedEvents(list, refreshCallback);
            
            scrollState.offset += items.length;
            if (items.length < PAGE_SIZE || scrollState.offset >= data.total) {
                scrollState.hasMore = false;
            }
        }
    } catch(e) {
        console.error('Dashboard loadMore error:', e);
    } finally {
        if (loader) loader.style.display = 'none';
        const btnCont = container.querySelector('#load-more-container');
        if (btnCont) btnCont.style.display = scrollState.hasMore ? 'block' : 'none';
        const end = container.querySelector('#feed-end');
        if (end) end.style.display = (!scrollState.hasMore && scrollState.offset > 0) ? 'block' : 'none';
        scrollState.loading = false;
    }
}

async function applyFilter(container, refreshCallback) {
    const list = container.querySelector('#feed-list');
    const end = container.querySelector('#feed-end');
    if (list) list.innerHTML = '';
    if (end) end.style.display = 'none';

    scrollState.offset = 0;
    scrollState.hasMore = true;
    scrollState.loading = false;
    await loadMore(container, refreshCallback);
}

function bindAll(container, refreshCallback) {
    const { tenantId } = getState();

    // Toggle Task-Input visibility
    const toggleBtn = container.querySelector('#btn-toggle-task');
    const taskCard = container.querySelector('#task-input-card');
    if (toggleBtn && taskCard) {
        toggleBtn.onclick = () => {
            const isHidden = taskCard.style.display === 'none';
            taskCard.style.display = isHidden ? 'block' : 'none';
            toggleBtn.classList.toggle('btn-primary', isHidden);
            toggleBtn.classList.toggle('btn-ghost', !isHidden);
            if (isHidden) container.querySelector('#task-input').focus();
        };
    }

    container.querySelector('#feed-filter-cat').onchange = (e) => { filterCat = e.target.value; applyFilter(container, refreshCallback); };
    container.querySelector('#feed-filter-status').onchange = (e) => { filterStatus = e.target.value; applyFilter(container, refreshCallback); };

    const fileInput = container.querySelector('#task-file');
    const fileNameSpan = container.querySelector('#task-file-name');
    if (fileInput) {
        fileInput.onchange = () => {
            fileNameSpan.textContent = fileInput.files[0] ? fileInput.files[0].name : 'Keine Datei ausgewählt';
            fileNameSpan.style.color = fileInput.files[0] ? 'var(--accent)' : 'var(--text-secondary)';
        };
    }

    container.querySelector('#task-submit').onclick = async () => {
        const input = container.querySelector('#task-input');
        const instr = input.value.trim();
        if (!instr) { input.focus(); return; }
        const cat = container.querySelector('#task-cat').value;
        const agentSel = container.querySelector('#task-agent').value;
        const fileObj = fileInput.files[0];
        
        const btn = container.querySelector('#task-submit');
        const originalHtml = btn.innerHTML;
        btn.disabled = true; 
        btn.textContent = 'Wird gesendet…';
        
        const fd = new FormData();
        fd.append('tenant_id', tenantId);
        fd.append('instruction', instr);
        fd.append('category', cat);
        if (agentSel) fd.append('agent_id', agentSel);
        if (fileObj) fd.append('file', fileObj);

        try {
            await api.upload('/feed/submit-task', fd);
            input.value = '';
            fileInput.value = '';
            fileNameSpan.textContent = 'Keine Datei ausgewählt';
            fileNameSpan.style.color = 'var(--text-secondary)';
            refreshCallback();
        } catch (e) { 
            alert('Fehler: ' + e.message); 
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    };
    
    container.querySelector('#task-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) container.querySelector('#task-submit').click();
    });

    // Automatisches Ausblenden der Stats-Grid im Social-Media-Stil für mehr Fokus auf den Feed
    // Aber wir lassen sie dezent oben, falls gewünscht. Hier zentrieren wir sie aber auch.
    const statsGrid = container.querySelector('.stats-grid');
    if (statsGrid) {
        statsGrid.style.maxWidth = '720px';
        statsGrid.style.margin = '0 auto 24px auto';
        statsGrid.style.gridTemplateColumns = 'repeat(4, 1fr)';
        statsGrid.querySelectorAll('.stat-card').forEach(c => {
            c.style.padding = '12px';
            c.querySelector('.stat-value').style.fontSize = '20px';
            c.querySelector('.stat-label').style.fontSize = '9px';
        });
    }

    container.querySelector('#btn-load-more').onclick = () => loadMore(container, refreshCallback);
}

async function uploadSingle(file, tenantId, container, refreshCallback) {
    const fd = new FormData(); fd.append('file', file); fd.append('tenant_id', tenantId); fd.append('auto_analyze', 'true');
    try {
        const res = await api.upload('/documents/upload', fd);
        if (res.duplicate) { await showDup(res, file, tenantId, container, refreshCallback); } else { refreshCallback(); }
    } catch (e) { alert('Upload-Fehler: ' + e.message); }
}

function showDup(res, file, tenantId, container, refreshCallback) {
    return new Promise(resolve => {
        const doc = res.existing_document;
        const links = (res.related_feed_ids || []).map(id => `<span class="dup-link" data-fid="${id}">#${id}</span>`).join(', ');
        modal('Dokument bereits vorhanden', `
            <div class="dup-info"><strong>⚠ ${res.message}</strong></div>
            <div class="card"><div class="card-body"><div style="font-size:13px;line-height:1.8;">Dateiname: <strong>${doc.filename}</strong><br>Hochgeladen: ${doc.created_at ? new Date(doc.created_at).toLocaleString('de-DE') : '–'}<br>Status: ${doc.status} | Kategorie: ${doc.category}<br>${links ? 'Feed-Einträge: ' + links : ''}</div></div></div>
        `, `<button class="btn btn-primary" id="dup-force">${icon('upload')} Trotzdem hochladen</button><button class="btn btn-ghost" id="dup-cancel">Abbrechen</button>`);
        document.getElementById('dup-cancel').onclick = () => { closeModal(); resolve(); };
        document.getElementById('dup-force').onclick = async () => {
            const fd = new FormData(); fd.append('file', file); fd.append('tenant_id', tenantId); fd.append('auto_analyze', 'true'); fd.append('force', 'true');
            try { await api.upload('/documents/upload', fd); closeModal(); refreshCallback(); } catch (e) { alert(e.message); }
            resolve();
        };
    });
}

function showSyncModal(tenantId, container, refreshCallback) {
    modal('Ordner synchronisieren', `
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">Server-Ordner angeben. Neue PDFs werden importiert, vorhandene übersprungen.</p>
        <div class="form-group"><label class="form-label">Ordnerpfad</label><input class="form-input" id="sync-path" placeholder="/pfad/zum/ordner"></div>
        <div class="form-group"><label class="form-label">Auto-Analyse</label><select class="form-select" id="sync-az"><option value="true">Ja</option><option value="false">Nein</option></select></div>
        <div id="sync-res"></div>
    `, `<button class="btn btn-primary" id="sync-go">${icon('database')} Synchronisieren</button><button class="btn btn-ghost" id="sync-no">Abbrechen</button>`);
    document.getElementById('sync-no').onclick = closeModal;
    document.getElementById('sync-go').onclick = async () => {
        const p = document.getElementById('sync-path').value.trim(); if (!p) return;
        const btn = document.getElementById('sync-go'); btn.disabled = true; btn.textContent = 'Läuft…';
        const rd = document.getElementById('sync-res');
        try {
            const r = await api.post('/documents/sync-folder', { tenant_id: tenantId, folder_path: p, auto_analyze: document.getElementById('sync-az').value === 'true' });
            rd.innerHTML = `<div style="padding:12px;background:var(--bg-tertiary);border-radius:var(--radius);font-size:13px;margin-top:12px;"><strong style="color:var(--success)">${r.imported}</strong> importiert, <strong style="color:var(--text-muted)">${r.skipped}</strong> übersprungen${r.errors > 0 ? `, <strong style="color:var(--danger)">${r.errors}</strong> Fehler` : ''}</div>`;
            btn.textContent = 'Fertig';
            refreshCallback();
        } catch (e) { rd.innerHTML = `<span style="color:var(--danger)">Fehler: ${e.message}</span>`; btn.disabled = false; btn.textContent = 'Synchronisieren'; }
    };
}







