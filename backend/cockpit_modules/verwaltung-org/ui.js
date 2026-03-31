import { api } from '/assets/js/api.js';
import { getState } from '/assets/js/state.js';
import { icon, modal, closeModal } from '/assets/js/components.js';

export const title = "Verwaltung & Organisation";

export async function render(container) {
    const { tenantId } = getState();
    
    container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title">Verwaltung & Organisation</h1>
                <p class="page-subtitle">Zentrales Nervensystem für administrative Vorgänge und Zielsetzungen</p>
            </div>
            <div style="display:flex; gap:8px;">
                <button class="btn btn-ghost" id="btn-manage-goals">${icon('zap')} Alle Ziele verwalten</button>
            </div>
        </div>
        
        <div class="stats-grid" id="vo-stats">
            <div class="stat-card"><div class="stat-value">...</div><div class="stat-label">Laden...</div></div>
        </div>
        
        <!-- Schnellaktionen -->
        <div style="margin-bottom: 24px;">
            <h3 style="font-size: 14px; margin-bottom: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Vorgang erfassen</h3>
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                <button class="btn btn-primary action-btn" data-action="doc" style="padding: 12px 20px; font-size: 14px;">
                    ${icon('upload')} Dokument verarbeiten
                </button>
                <button class="btn btn-primary action-btn" data-action="email" style="padding: 12px 20px; font-size: 14px;">
                    ${icon('mail')} E-Mail / Nachricht erfassen
                </button>
                <button class="btn btn-primary action-btn" data-action="antrag" style="padding: 12px 20px; font-size: 14px;">
                    ${icon('plus')} Antrag stellen
                </button>
            </div>
        </div>

        <div class="grid-2">
            <!-- Linke Spalte: Aktuelle Vorgänge -->
            <div class="card" style="display: flex; flex-direction: column;">
                <div class="card-header">
                    <span class="card-title">Aktuelle Vorgänge (Feed)</span>
                    <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/dashboard'">Zum Feed →</button>
                </div>
                <div class="card-body" id="vo-feed" style="max-height: 500px; overflow-y: auto; padding: 0;">
                    <div class="feed-loader" style="padding: 20px;">Lade Vorgänge...</div>
                </div>
            </div>
            
            <!-- Rechte Spalte: Ziele und Aktivitäten -->
            <div style="display: flex; flex-direction: column; gap: 20px;">
                <div class="card">
                    <div class="card-header">
                        <span class="card-title">Aktive Zielsetzungen & Strategien</span>
                        <button class="btn btn-ghost btn-sm" id="btn-new-goal">${icon('plus')} Neues Ziel</button>
                    </div>
                    <div class="card-body" id="vo-goals" style="max-height: 250px; overflow-y: auto; padding: 12px 20px;">
                        <div class="feed-loader">Lade Ziele...</div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <span class="card-title">Letzte System-Aktivitäten</span>
                        <button class="btn btn-ghost btn-sm" onclick="window.location.hash='#/audit'">Alle →</button>
                    </div>
                    <div class="card-body" id="vo-activity" style="max-height: 230px; overflow-y: auto; padding: 12px 20px;">
                        <div class="feed-loader">Lade Aktivitäten...</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const loadData = async () => {
        try {
            const[statsRes, goalsRes, auditRes, feedRes] = await Promise.all([
                api.post('/cockpit-modules/verwaltung-org/api/get_stats', {tenant_id: tenantId}),
                api.get('/goals?tenant_id=' + tenantId),
                api.get('/audit?tenant_id=' + tenantId + '&limit=15'),
                api.get('/feed?tenant_id=' + tenantId + '&status=pending&limit=10')
            ]);
            
            if(statsRes.status === 'ok') {
                const d = statsRes.data;
                container.querySelector('#vo-stats').innerHTML = `
                    <div class="stat-card accent"><div class="stat-value">${d.pending_feed}</div><div class="stat-label">Offene Entscheidungen</div></div>
                    <div class="stat-card warning"><div class="stat-value">${d.active_tasks}</div><div class="stat-label">Laufende Aufgaben</div></div>
                    <div class="stat-card success"><div class="stat-value">${d.total_feed}</div><div class="stat-label">Vorgänge Gesamt</div></div>
                    <div class="stat-card" style="--c:var(--info);"><div class="stat-value" style="color:var(--info);">${d.total_docs}</div><div class="stat-label">Dokumente im System</div></div>
                `;
            }
            
            // Goals
            const activeGoals = goalsRes.filter(g => g.status === 'active');
            const goalsHtml = activeGoals.length > 0 ? activeGoals.map(g => {
                const ms = g.milestones_json ||[];
                const done = ms.filter(m => m.status === 'done').length;
                const progress = ms.length > 0 ? Math.round((done / ms.length) * 100) : 0;
                
                return `
                <div style="background:var(--bg-tertiary); padding:12px; border-radius:var(--radius); border-left:3px solid var(--success); margin-bottom:12px; cursor:pointer;" onclick="window.location.hash='#/goals'">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <strong style="font-size:13px; color:var(--text-primary);">${g.name}</strong>
                        <span style="font-size:11px; color:var(--success); font-weight:600;">${progress}%</span>
                    </div>
                    <div style="font-size:12px; color:var(--text-secondary); margin-bottom: 8px;">${g.description || ''}</div>
                    <div style="width: 100%; background: var(--bg-primary); height: 6px; border-radius: 3px; overflow: hidden;">
                        <div style="width: ${progress}%; background: var(--success); height: 100%;"></div>
                    </div>
                </div>`;
            }).join('') : '<div class="empty-state" style="padding:20px;"><div class="empty-state-text">Keine aktiven Ziele.</div></div>';
            container.querySelector('#vo-goals').innerHTML = goalsHtml;
            
            // Activity
            const actHtml = auditRes.items.length > 0 ? auditRes.items.map(a => `
                <div style="padding:10px 0; border-bottom:1px solid var(--border); font-size:12px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <strong style="color:var(--text-primary);">${a.action}</strong>
                        <span style="color:var(--text-muted);">${new Date(a.timestamp).toLocaleTimeString('de-DE')}</span>
                    </div>
                    <span style="color:var(--text-secondary);">Typ: ${a.entity_type} ${a.entity_id ? '#'+a.entity_id : ''}</span>
                </div>
            `).join('') : '<div class="empty-state"><div class="empty-state-text">Keine Aktivitäten.</div></div>';
            container.querySelector('#vo-activity').innerHTML = actHtml;
            
            // Feed
            const feedItems = feedRes.items ||[];
            const feedHtml = feedItems.length > 0 ? feedItems.map(f => `
                <div style="padding: 16px 20px; border-bottom: 1px solid var(--border); cursor:pointer; transition:var(--transition);" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''" onclick="window.location.hash='#/dashboard'">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                        <span class="feed-priority ${f.priority >= 7 ? 'p-high' : f.priority >= 4 ? 'p-medium' : 'p-low'}"></span>
                        <strong style="font-size:13px; color:var(--text-primary);">${f.title}</strong>
                        <span style="font-size:11px; margin-left:auto; color:var(--warning); background:var(--warning-bg); padding:2px 6px; border-radius:4px;">Offen</span>
                    </div>
                    <div style="font-size:12px; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${f.description || 'Keine Beschreibung'}
                    </div>
                </div>
            `).join('') : '<div class="empty-state" style="padding:40px;"><div class="empty-state-text">Keine offenen Vorgänge. Alles erledigt!</div></div>';
            container.querySelector('#vo-feed').innerHTML = feedHtml;

        } catch(e) { console.error(e); }
    };
    
    await loadData();
    
    // Polling every 15 seconds
    const poll = setInterval(loadData, 15000);
    
    // Actions
    container.querySelector('#btn-manage-goals').onclick = () => window.location.hash = '#/goals';
    
    container.querySelector('#btn-new-goal').onclick = async () => {
        const agents = await api.get(`/agents?tenant_id=${tenantId}`);
        const agentOpts = agents.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
        
        modal('Neues Ziel / Strategie', `
            <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">Definieren Sie eine neue strategische Vorgabe, die von einem Agenten langfristig verfolgt werden soll.</p>
            <div class="form-group">
                <label class="form-label">Titel</label>
                <input class="form-input" id="goal-title" placeholder="Z.B. Ausgaben senken">
            </div>
            <div class="form-group">
                <label class="form-label">Kurzbeschreibung</label>
                <input class="form-input" id="goal-desc" placeholder="Kurze Beschreibung...">
            </div>
            <div class="form-group">
                <label class="form-label">Strategie-Vorgabe (Prompt)</label>
                <textarea class="form-textarea" id="goal-strategy" placeholder="Wie soll der Agent vorgehen?"></textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Verantwortlicher Agent (Optional)</label>
                <select class="form-select" id="goal-agent">
                    <option value="">-- Standard Agent --</option>
                    ${agentOpts}
                </select>
            </div>
        `, `<button class="btn btn-primary" id="goal-save">Ziel anlegen</button><button class="btn btn-ghost" onclick="document.getElementById('modal-close').click()">Abbrechen</button>`);
        
        document.getElementById('goal-save').onclick = async () => {
            const name = document.getElementById('goal-title').value.trim();
            const desc = document.getElementById('goal-desc').value.trim();
            const strat = document.getElementById('goal-strategy').value.trim();
            const agId = document.getElementById('goal-agent').value;
            
            if(!name) return;
            
            try {
                await api.post('/goals', {
                    tenant_id: tenantId,
                    name: name,
                    description: desc,
                    strategy_prompt: strat,
                    status: 'active',
                    agent_id: agId ? parseInt(agId) : null,
                    milestones_json:[]
                });
                closeModal();
                loadData();
            } catch(e) { alert(e.message); }
        };
    };
    
    // Quick Actions
    container.querySelectorAll('.action-btn').forEach(btn => {
        btn.onclick = () => {
            const action = btn.dataset.action;
            let title = '';
            let placeholder = '';
            let showFile = false;
            let cat = 'general';
            
            if (action === 'doc') {
                title = 'Dokument verarbeiten';
                placeholder = 'Bitte laden Sie ein Dokument hoch und beschreiben Sie, was damit geschehen soll (z.B. "Rechnung prüfen und buchen").';
                showFile = true;
                cat = 'documents';
            } else if (action === 'email') {
                title = 'E-Mail / Nachricht erfassen';
                placeholder = 'Fügen Sie hier den Text der E-Mail oder Nachricht ein. Der Agent wird sie analysieren und die notwendigen Schritte einleiten.';
                cat = 'general';
            } else if (action === 'antrag') {
                title = 'Antrag stellen';
                placeholder = 'Welcher Antrag soll gestellt werden? (z.B. "Urlaubsantrag für nächste Woche", "Freigabe für neues Software-Abo beantragen")';
                cat = 'general';
            }
            
            modal(title, `
                <div class="form-group">
                    <label class="form-label">Anweisung an das System</label>
                    <textarea class="form-textarea" id="qa-text" style="min-height: 120px;" placeholder="${placeholder}"></textarea>
                </div>
                ${showFile ? `
                <div class="form-group" style="background:var(--bg-tertiary); padding:12px; border-radius:var(--radius); border:1px dashed var(--border);">
                    <label class="form-label" style="margin-bottom:8px;">Datei anhängen</label>
                    <input type="file" id="qa-file" class="form-input" style="padding:6px;">
                </div>
                ` : ''}
            `, `<button class="btn btn-primary" id="qa-submit">${icon('zap')} An Agenten übergeben</button><button class="btn btn-ghost" onclick="document.getElementById('modal-close').click()">Abbrechen</button>`);
            
            document.getElementById('qa-submit').onclick = async () => {
                const instr = document.getElementById('qa-text').value.trim();
                if(!instr && action !== 'doc') { alert('Bitte Text eingeben.'); return; }
                
                const sb = document.getElementById('qa-submit');
                sb.disabled = true; sb.textContent = 'Wird übergeben...';
                
                const fd = new FormData();
                fd.append('tenant_id', tenantId);
                fd.append('instruction', instr);
                fd.append('category', cat); 
                
                if (showFile) {
                    const f = document.getElementById('qa-file').files[0];
                    if (f) fd.append('file', f);
                    else if (!instr) { alert('Bitte Text eingeben oder Datei hochladen.'); sb.disabled = false; return; }
                }
                
                try {
                    await api.upload('/feed/submit-task', fd);
                    closeModal();
                    alert('Erfolgreich an das System übergeben! Sie finden den Vorgang im Feed.');
                    loadData();
                } catch(e) {
                    alert('Fehler: ' + e.message);
                    sb.disabled = false; sb.textContent = 'Erneut versuchen';
                }
            };
        };
    });
    
    // Cleanup function when view changes
    return () => clearInterval(poll);
}




