import { api } from '../api.js';
import { getState } from '../state.js';
import { icon, modal, closeModal } from '../components.js';

export const title = 'Workflows';

export async function render(container) {
    const { tenantId } = getState();
    if (!tenantId) { container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Kein Mandant ausgewählt.</div></div>'; return; }

    const workflows = await api.get(`/workflows?tenant_id=${tenantId}`);

    container.innerHTML = `
        <div class="page-header">
            <div><h1 class="page-title">Workflows</h1><p class="page-subtitle">Verwaltung aller Standard- und individuellen Workflows</p></div>
            <div style="display:flex; gap:8px;">
                <button class="btn btn-ghost" id="btn-wizard-wf" style="border-color:var(--accent); color:var(--accent);">${icon('zap')} Workflow-Wizard</button>
                <button class="btn btn-primary" id="btn-new-wf">${icon('plus')} Neuer Workflow</button>
            </div>
        </div>
        <div class="card"><table>
            <thead><tr><th>Name</th><th>Kategorie</th><th>Typ</th><th>Menü</th><th>Feed</th><th>Status</th><th>Aktionen</th></tr></thead>
            <tbody>
                ${workflows.map(w => `<tr>
                    <td><strong>${w.name}</strong><br><small style="color:var(--text-muted)">${w.description || ''}</small></td>
                    <td>${w.category}</td>
                    <td><span class="tag ${w.is_standard ? 'tag-standard' : ''}">${w.is_standard ? 'Standard' : 'Individuell'}</span></td>
                    <td>${w.has_menu_entry ? '✓' : '–'}</td>
                    <td>${w.has_feed ? '✓' : '–'}</td>
                    <td><span class="tag ${w.is_active ? 'tag-active' : 'tag-inactive'}">${w.is_active ? 'Aktiv' : 'Inaktiv'}</span></td>
                    <td>
                        <button class="btn btn-ghost btn-sm wf-perm" data-id="${w.id}">Mandanten</button>
                        <button class="btn btn-ghost btn-sm wf-edit" data-id="${w.id}">Bearbeiten</button>
                        ${w.is_standard ? '' : `<button class="btn btn-ghost btn-sm wf-del" data-id="${w.id}">Löschen</button>`}
                    </td>
                </tr>`).join('')}
            </tbody>
        </table></div>`;

    container.querySelector('#btn-new-wf').onclick = () => showForm(container, null);
    container.querySelector('#btn-wizard-wf').onclick = () => showWizard(container);
    container.querySelectorAll('.wf-edit').forEach(btn => {
        btn.onclick = async () => {
            const w = await api.get(`/workflows/${btn.dataset.id}`);
            showForm(container, w);
        };
    });
    container.querySelectorAll('.wf-del').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Workflow wirklich löschen?')) {
                await api.del(`/workflows/${btn.dataset.id}`);
                render(container);
            }
        };
    });
    container.querySelectorAll('.wf-perm').forEach(btn => {
        btn.onclick = () => showPermissionModal('workflows', btn.dataset.id, render, container);
    });
}

async function showPermissionModal(type, entityId, refreshFn, container) {
    const tenants = await api.get('/tenants');
    const activePerms = await api.get(`/${type}/${entityId}/permissions`);
    const permSet = new Set(activePerms);

    modal('Mandanten-Berechtigungen', `
        <p style="font-size:13px; color:var(--text-secondary); margin-bottom:16px;">Wählen Sie aus, welche Mandanten Zugriff auf diese Ressource haben sollen.</p>
        <div style="display:flex; flex-direction:column; gap:8px;">
            ${tenants.map(t => `
                <label style="display:flex; align-items:center; gap:10px; padding:10px; background:var(--bg-tertiary); border-radius:var(--radius); cursor:pointer;">
                    <input type="checkbox" class="perm-tenant-cb" value="${t.id}" ${permSet.has(t.id) ? 'checked' : ''}>
                    <span>${t.name} <small style="opacity:0.6">(${t.slug})</small></span>
                </label>
            `).join('')}
        </div>
    `, `<button class="btn btn-primary" id="perm-save">Freigaben speichern</button><button class="btn btn-ghost" id="perm-cancel">Abbrechen</button>`);

    document.getElementById('perm-cancel').onclick = closeModal;
    document.getElementById('perm-save').onclick = async () => {
        const tenantIds = [...document.querySelectorAll('.perm-tenant-cb:checked')].map(cb => parseInt(cb.value));
        await api.put(`/${type}/${entityId}/permissions`, { tenant_ids: tenantIds });
        closeModal();
        refreshFn(container);
    };
}

function showWizard(container) {
    const { tenantId } = getState();
    
    modal('Workflow-Wizard', `
        <div id="wizard-step-1">
            <p style="font-size:13px; color:var(--text-secondary); margin-bottom:16px;">
                Beschreiben Sie in natürlicher Sprache, welchen Use Case Sie abbilden möchten. Der KI-Architekt wird Agenten, Datenstrukturen und Workflows für Sie entwerfen.
            </p>
            <div class="form-group">
                <label class="form-label">Ihre Anforderung</label>
                <textarea class="form-textarea" id="wiz-prompt" style="min-height:150px;" placeholder="Z.B.: Ich möchte einen Workflow für Urlaubsanträge. Er soll Anträge in einer Tabelle speichern, ein Agent soll prüfen ob genug Resturlaub da ist und mir dann eine Empfehlung im Feed geben."></textarea>
            </div>
            <button class="btn btn-primary" id="btn-wiz-plan" style="width:100%; justify-content:center; padding:12px;">Entwurf generieren</button>
        </div>
        <div id="wizard-step-2" style="display:none;">
            <div id="wiz-explanation" style="padding:16px; background:var(--accent-bg); border-radius:var(--radius); margin-bottom:20px; font-size:14px; line-height:1.6; color:var(--text-primary);"></div>
            <h4 style="font-size:12px; text-transform:uppercase; color:var(--text-muted); margin-bottom:12px;">Geplante Komponenten</h4>
            <div id="wiz-plan-details" style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px;"></div>
            
            <div style="background:var(--bg-tertiary); padding:15px; border-radius:var(--radius); border:1px solid var(--border);">
                <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                    <input type="checkbox" id="wiz-confirm">
                    <span style="font-size:13px; font-weight:600;">Ich habe den Plan geprüft und möchte ihn jetzt umsetzen.</span>
                </label>
            </div>
        </div>
        <div id="wizard-loading" style="display:none; text-align:center; padding:40px;">
            <div class="feed-status s-processing" style="width:40px; height:40px; margin:0 auto 16px auto; border-radius:50%;"></div>
            <div id="wiz-loading-text">Der KI-Architekt erstellt den Entwurf...</div>
        </div>
    `, `
        <button class="btn btn-ghost" id="wiz-cancel">Abbrechen</button>
        <button class="btn btn-primary" id="wiz-execute" style="display:none;" disabled>Setup jetzt ausführen</button>
    `, 'modal-lg');

    const s1 = document.getElementById('wizard-step-1');
    const s2 = document.getElementById('wizard-step-2');
    const ld = document.getElementById('wizard-loading');
    const ldt = document.getElementById('wiz-loading-text');
    const btnPlan = document.getElementById('btn-wiz-plan');
    const btnExec = document.getElementById('wiz-execute');
    
    let currentPlan = null;

    document.getElementById('wiz-cancel').onclick = closeModal;

    btnPlan.onclick = async () => {
        const prompt = document.getElementById('wiz-prompt').value.trim();
        if(!prompt) return;

        s1.style.display = 'none';
        ld.style.display = 'block';

        try {
            const plan = await api.post('/wizard/plan', { tenant_id: tenantId, instruction: prompt });
            currentPlan = plan;
            
            document.getElementById('wiz-explanation').textContent = plan.explanation;
            
            const details = document.getElementById('wiz-plan-details');
            details.innerHTML = plan.plan.map(p => {
                let iconName = 'layers';
                if(p.type === 'create_agent') iconName = 'bot';
                if(p.type === 'create_data_structure') iconName = 'database';
                
                return `
                    <div style="padding:10px 14px; background:var(--bg-secondary); border:1px solid var(--border); border-radius:var(--radius); display:flex; align-items:center; gap:12px;">
                        <span style="color:var(--accent);">${icon(iconName)}</span>
                        <div>
                            <div style="font-size:13px; font-weight:600;">${p.payload.name}</div>
                            <div style="font-size:11px; color:var(--text-muted);">${p.type.replace('create_', '').toUpperCase()}</div>
                        </div>
                    </div>
                `;
            }).join('');

            ld.style.display = 'none';
            s2.style.display = 'block';
            btnExec.style.display = 'inline-flex';
        } catch(e) {
            alert('Fehler: ' + e.message);
            s1.style.display = 'block';
            ld.style.display = 'none';
        }
    };

    document.getElementById('wiz-confirm').onchange = (e) => {
        btnExec.disabled = !e.target.checked;
    };

    btnExec.onclick = async () => {
        if(!currentPlan) return;
        
        s2.style.display = 'none';
        ld.style.display = 'block';
        ldt.textContent = 'Komponenten werden physisch angelegt...';
        btnExec.disabled = true;

        try {
            await api.post('/wizard/execute', { tenant_id: tenantId, plan: currentPlan });
            ld.innerHTML = `
                <div style="color:var(--success); font-size:48px; margin-bottom:16px;">${icon('check')}</div>
                <h3 style="margin-bottom:8px;">Setup erfolgreich!</h3>
                <p style="font-size:14px; color:var(--text-secondary); margin-bottom:24px;">Agenten, Workflows und Tabellen wurden erfolgreich erstellt.</p>
                <button class="btn btn-primary" onclick="location.reload()">System neu laden</button>
            `;
        } catch(e) {
            alert('Umsetzung fehlgeschlagen: ' + e.message);
            s2.style.display = 'block';
            ld.style.display = 'none';
        }
    };
}

async function showForm(container, wf) {
    const { tenantId } = getState();
    const isEdit = !!wf;
    
    let allDS = [], allMCP = [], allA2A = [], allAgents = [], allTriggers = [];
    let activeDSMap = {}, activeMCP = new Set(), activeA2A = new Set();
    
    try {
        const [dsRes, mcpRes, a2aRes, agentRes] = await Promise.all([
            api.get('/data-structures?tenant_id=' + tenantId),
            api.get('/mcp-modules'),
            api.get('/a2a-modules'),
            api.get('/agents?tenant_id=' + tenantId)
        ]);
        allDS = dsRes;
        allMCP = mcpRes;
        allA2A = a2aRes;
        allAgents = agentRes.filter(a => a.is_active);

        if (isEdit) {
            const [dsLinks, mcpIds, a2aIds, triggers] = await Promise.all([
                api.get('/workflows/' + wf.id + '/data-structures'),
                api.get('/workflows/' + wf.id + '/mcp-modules'),
                api.get('/workflows/' + wf.id + '/a2a-modules'),
                api.get('/workflows/' + wf.id + '/triggers')
            ]);
            dsLinks.forEach(l => activeDSMap[l.id] = l.permission);
            activeMCP = new Set(mcpIds);
            activeA2A = new Set(a2aIds);
            allTriggers = triggers;
        }
    } catch (e) { console.error('Fehler beim Laden von Modulen/Strukturen:', e); }

    const dsTags = allDS.length > 0 ? allDS.map(d => {
        const perm = activeDSMap[d.id];
        const isSel = !!perm;
        return `
            <div class="ds-row" data-id="${d.id}" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:6px;background:var(--bg-tertiary);border-radius:var(--radius);border:1px solid ${isSel ? 'var(--accent)' : 'var(--border)'};">
                <span style="flex:1;">${d.name} <small style="opacity:0.6;">(${d.slug})</small></span>
                <select class="form-select ds-perm-sel" style="width:180px;padding:4px;" ${!isSel ? 'disabled' : ''}>
                    <option value="R" ${perm==='R'?'selected':''}>Lesen (R)</option>
                    <option value="RW" ${perm==='RW'?'selected':''}>Lesen/Schreiben (RW)</option>
                </select>
                <button class="btn btn-sm ${isSel ? 'btn-danger' : 'btn-ghost'} ds-toggle-btn" style="width:90px;">${isSel ? 'Entfernen' : 'Zuweisen'}</button>
            </div>
        `;
    }).join('') : '<span style="font-size:12px;color:var(--text-muted)">Keine Datenstrukturen vorhanden</span>';
    
    const mcpTags = allMCP.length > 0 ? allMCP.map(m => `<div class="skill-tag${activeMCP.has(m.id) ? ' selected' : ''}" data-id="${m.id}">${m.name}</div>`).join('') : '<span style="font-size:12px;color:var(--text-muted)">Keine MCP-Module vorhanden</span>';
    const a2aTags = allA2A.length > 0 ? allA2A.map(m => `<div class="skill-tag${activeA2A.has(m.id) ? ' selected' : ''}" data-id="${m.id}">${m.name}</div>`).join('') : '<span style="font-size:12px;color:var(--text-muted)">Keine A2A-Module vorhanden</span>';

    // Layout: Grid with 2 columns
    const bodyContent = `
    <div style="display:grid; grid-template-columns: 350px 1fr; gap: 0; height: 100%; overflow: hidden;">
        <!-- Left Column: Settings -->
        <div style="border-right: 1px solid var(--border); padding: 24px; overflow-y: auto; background: rgba(255,255,255,0.01);">
            <h4 style="margin-bottom:20px; color:var(--accent); font-size:14px; text-transform:uppercase; letter-spacing:0.5px;">Basis-Einstellungen</h4>
            <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="wf-name" value="${wf?.name || ''}"></div>
            <div class="form-group"><label class="form-label">Slug</label><input class="form-input" id="wf-slug" value="${wf?.slug || ''}" ${isEdit ? 'disabled' : ''}></div>
            <div class="form-group"><label class="form-label">Beschreibung</label><textarea class="form-textarea" id="wf-desc" style="min-height:80px;">${wf?.description || ''}</textarea></div>
            <div class="form-group"><label class="form-label">Kategorie</label>
                <select class="form-select" id="wf-cat">
                    <option value="custom" ${wf?.category==='custom'?'selected':''}>Individuell</option>
                    <option value="marketing" ${wf?.category==='marketing'?'selected':''}>Marketing</option>
                    <option value="finance" ${wf?.category==='finance'?'selected':''}>Finance</option>
                    <option value="tax_legal" ${wf?.category==='tax_legal'?'selected':''}>Steuer & Legal</option>
                    <option value="documents" ${wf?.category==='documents'?'selected':''}>Dokumente</option>
                </select>
            </div>
            <div class="form-group"><label class="form-label">Aktiv</label>
                <select class="form-select" id="wf-active"><option value="true" ${wf?.is_active!==false?'selected':''}>Ja</option><option value="false" ${wf?.is_active===false?'selected':''}>Nein</option></select>
            </div>
            <div class="form-group"><label class="form-label">Menüeintrag</label><select class="form-select" id="wf-menu"><option value="true" ${wf?.has_menu_entry?'selected':''}>Ja</option><option value="false" ${!wf?.has_menu_entry?'selected':''}>Nein</option></select></div>
            <div class="form-group"><label class="form-label">Eigener Feed</label><select class="form-select" id="wf-feed"><option value="true" ${wf?.has_feed!==false?'selected':''}>Ja</option><option value="false" ${wf?.has_feed===false?'selected':''}>Nein</option></select></div>
        </div>

        <!-- Right Column: Tabs -->
        <div style="display:flex; flex-direction:column; overflow:hidden; padding: 0 24px 24px 24px;">
            <div class="tabs" id="wf-modal-tabs" style="margin-bottom:0;">
                <div class="tab active" data-tab="chain">Prozesskette</div>
                <div class="tab" data-tab="ds">Datenstrukturen</div>
                <div class="tab" data-tab="mcp">MCP-Module</div>
                <div class="tab" data-tab="a2a">A2A-Module</div>
                <div class="tab" data-tab="triggers">Triggers</div>
            </div>
            <div id="wf-tab-content" style="flex:1; overflow-y:auto; padding: 20px 4px 0 0;">
                <!-- Tab: Process Chain -->
                <div class="wf-tab-pane" id="tab-chain">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                        <p style="font-size:12px; color:var(--text-secondary); margin:0;">Drag & Drop zum Sortieren der Stufen.</p>
                        <button class="btn btn-primary btn-sm" id="wf-add-stage" style="border-radius:20px; padding: 6px 14px;">${icon('plus')} Stufe hinzufügen</button>
                    </div>
                    <div id="wf-stages-container"></div>
                </div>

                <!-- Tab: Data Structures -->
                <div class="wf-tab-pane" id="tab-ds" style="display:none;">
                    <div id="wf-ds-tags" style="padding-bottom:10px;">${dsTags}</div>
                </div>

                <!-- Tab: MCP -->
                <div class="wf-tab-pane" id="tab-mcp" style="display:none;">
                    <div class="skill-tags" id="wf-mcp-tags" style="padding-bottom:10px;">${mcpTags}</div>
                </div>

                <!-- Tab: A2A -->
                <div class="wf-tab-pane" id="tab-a2a" style="display:none;">
                    <div class="skill-tags" id="wf-a2a-tags" style="padding-bottom:10px;">${a2aTags}</div>
                </div>

                <!-- Tab: Triggers -->
                <div class="wf-tab-pane" id="tab-triggers" style="display:none;">
                    <div id="wf-triggers-tab-content">
                        ${!isEdit ? '<div class="empty-state"><div class="empty-state-text">Triggers können erst nach dem ersten Speichern des Workflows konfiguriert werden.</div></div>' : `
                            <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
                                <p style="font-size:12px;color:var(--text-secondary);">Automatisierungen, die diesen Workflow im Hintergrund starten.</p>
                                <button class="btn btn-primary btn-sm" id="btn-tab-new-trigger">${icon('plus')} Trigger hinzufügen</button>
                            </div>
                            <div id="tab-trigger-list"></div>
                            <div id="tab-new-trigger-form" style="display:none;margin-top:20px;padding:20px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-tertiary);">
                                <div class="form-row">
                                    <div class="form-group"><label class="form-label">Typ</label><select class="form-select" id="tr-tab-type"><option value="interval">Zeit-Intervall</option><option value="folder_watch">Ordner-Überwachung (PDF)</option><option value="email_fetch">E-Mail Abruf (IMAP)</option></select></div>
                                    <div class="form-group"><label class="form-label">Intervall (Minuten)</label><input class="form-input" type="number" id="tr-tab-interval" value="60"></div>
                                </div>
                                <div class="form-group" id="grp-tab-folder" style="display:none;"><label class="form-label">Ordner-Pfad</label><input class="form-input" id="tr-tab-folder" placeholder="/pfad/zum/ordner"></div>
                                <div id="grp-tab-email" style="display:none;">
                                    <div class="form-row">
                                        <div class="form-group"><label class="form-label">IMAP Host</label><input class="form-input" id="tr-tab-imap-host" placeholder="imap.domain.com"></div>
                                        <div class="form-group"><label class="form-label">IMAP Port</label><input class="form-input" type="number" id="tr-tab-imap-port" value="993"></div>
                                    </div>
                                    <div class="form-row">
                                        <div class="form-group"><label class="form-label">Benutzer / E-Mail</label><input class="form-input" id="tr-tab-imap-user" placeholder="ams@domain.com"></div>
                                        <div class="form-group"><label class="form-label">Passwort</label><input class="form-input" type="password" id="tr-tab-imap-pass"></div>
                                    </div>
                                </div>
                                <div class="form-group"><label class="form-label">Anweisung an den Agenten</label><textarea class="form-textarea" id="tr-tab-instruction" placeholder="Was soll der Agent tun, wenn der Trigger auslöst?"></textarea></div>
                                <div style="display:flex; gap:8px;">
                                    <button class="btn btn-success" id="tr-tab-save">Trigger speichern</button>
                                    <button class="btn btn-ghost" id="tr-tab-cancel">Abbrechen</button>
                                </div>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;

    modal(isEdit ? 'Workflow bearbeiten' : 'Neuer Workflow', bodyContent, `<button class="btn btn-primary" id="wf-save">Speichern</button><button class="btn btn-ghost" id="wf-cancel">Abbrechen</button>`, 'modal-xl');

    // Tab Logic
    document.querySelectorAll('#wf-modal-tabs .tab').forEach(t => {
        t.onclick = () => {
            document.querySelectorAll('#wf-modal-tabs .tab').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            document.querySelectorAll('.wf-tab-pane').forEach(p => p.style.display = 'none');
            document.getElementById(`tab-${t.dataset.tab}`).style.display = 'block';
        };
    });

    // --- TRIGGERS TAB LOGIC ---
    if (isEdit) {
        const renderTriggers = (triggerList) => {
            const listEl = document.getElementById('tab-trigger-list');
            if (!listEl) return;
            
            if (triggerList.length === 0) {
                listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:12px;">Keine aktiven Triggers eingerichtet.</div>';
                return;
            }

            listEl.innerHTML = `<table>
                <thead><tr><th>Typ</th><th>Konfiguration</th><th>Status</th><th></th></tr></thead>
                <tbody>${triggerList.map(t => `
                    <tr>
                        <td><span class="tag tag-standard">${t.trigger_type}</span></td>
                        <td><div style="font-size:11px;color:var(--text-secondary);max-width:300px;overflow:hidden;text-overflow:ellipsis;">${JSON.stringify(t.config_json)}</div></td>
                        <td><span class="tag ${t.is_active ? 'tag-active' : 'tag-inactive'}">${t.is_active ? 'Aktiv' : 'Inaktiv'}</span></td>
                        <td style="text-align:right;"><button class="btn btn-ghost btn-sm tr-tab-del" data-id="${t.id}" style="color:var(--danger);">${icon('x')}</button></td>
                    </tr>
                `).join('')}</tbody>
            </table>`;

            listEl.querySelectorAll('.tr-tab-del').forEach(b => {
                b.onclick = async () => {
                    if (confirm('Trigger wirklich entfernen?')) {
                        await api.del(`/workflows/triggers/${b.dataset.id}`);
                        const updated = await api.get(`/workflows/${wf.id}/triggers`);
                        renderTriggers(updated);
                    }
                };
            });
        };

        renderTriggers(allTriggers);

        const newTriggerBtn = document.getElementById('btn-tab-new-trigger');
        const triggerForm = document.getElementById('tab-new-trigger-form');
        const triggerList = document.getElementById('tab-trigger-list');

        if (newTriggerBtn) {
            newTriggerBtn.onclick = () => {
                triggerForm.style.display = 'block';
                triggerList.style.display = 'none';
                newTriggerBtn.style.display = 'none';
            };
        }

        const cancelTriggerBtn = document.getElementById('tr-tab-cancel');
        if (cancelTriggerBtn) {
            cancelTriggerBtn.onclick = () => {
                triggerForm.style.display = 'none';
                triggerList.style.display = 'block';
                newTriggerBtn.style.display = 'inline-flex';
            };
        }

        const triggerTypeSel = document.getElementById('tr-tab-type');
        if (triggerTypeSel) {
            triggerTypeSel.onchange = (e) => {
                document.getElementById('grp-tab-folder').style.display = e.target.value === 'folder_watch' ? 'block' : 'none';
                document.getElementById('grp-tab-email').style.display = e.target.value === 'email_fetch' ? 'block' : 'none';
            };
        }

        const saveTriggerBtn = document.getElementById('tr-tab-save');
        if (saveTriggerBtn) {
            saveTriggerBtn.onclick = async () => {
                const type = document.getElementById('tr-tab-type').value;
                const config = {
                    interval_minutes: parseInt(document.getElementById('tr-tab-interval').value) || 60,
                    instruction: document.getElementById('tr-tab-instruction').value
                };
                if (type === 'folder_watch') config.folder_path = document.getElementById('tr-tab-folder').value;
                if (type === 'email_fetch') {
                    config.imap_host = document.getElementById('tr-tab-imap-host').value;
                    config.imap_port = parseInt(document.getElementById('tr-tab-imap-port').value);
                    config.imap_user = document.getElementById('tr-tab-imap-user').value;
                    config.imap_pass = document.getElementById('tr-tab-imap-pass').value;
                }
                
                try {
                    await api.post(`/workflows/${wf.id}/triggers`, {
                        trigger_type: type,
                        config_json: config,
                        is_active: true
                    });
                    const updated = await api.get(`/workflows/${wf.id}/triggers`);
                    renderTriggers(updated);
                    cancelTriggerBtn.click(); // Hide form
                } catch (e) {
                    alert('Fehler beim Speichern des Triggers: ' + e.message);
                }
            };
        }
    }

    // Tag Selection Logic
    document.querySelectorAll('#wf-mcp-tags .skill-tag').forEach(tag => {
        tag.onclick = () => tag.classList.toggle('selected');
    });
    document.querySelectorAll('#wf-a2a-tags .skill-tag').forEach(tag => {
        tag.onclick = () => tag.classList.toggle('selected');
    });
    document.querySelectorAll('.ds-row').forEach(row => {
        const btn = row.querySelector('.ds-toggle-btn');
        const sel = row.querySelector('.ds-perm-sel');
        btn.onclick = () => {
            if (btn.textContent === 'Zuweisen') {
                btn.textContent = 'Entfernen';
                btn.classList.replace('btn-ghost', 'btn-danger');
                sel.disabled = false;
                row.style.borderColor = 'var(--accent)';
            } else {
                btn.textContent = 'Zuweisen';
                btn.classList.replace('btn-danger', 'btn-ghost');
                sel.disabled = true;
                row.style.borderColor = 'var(--border)';
            }
        };
    });

    // --- STAGES LOGIC ---
    let stages = wf?.config_json?.stages || [];
    
    // Migration: Falls alte classifier_agent_id / target_ds existieren, aber noch keine Stages
    if (stages.length === 0 && (wf?.config_json?.classifier_agent_id || wf?.config_json?.target_ds)) {
        stages.push({
            agent_id: wf.config_json.classifier_agent_id || '',
            target_ds: wf.config_json.target_ds || '',
            instruction: 'Initiale Klassifizierung / Datenextraktion'
        });
        stages.push({
            agent_id: '',
            target_ds: '',
            instruction: 'Hauptaufgabe bearbeiten'
        });
    }
    // Mindestens eine Standard-Stufe
    if (stages.length === 0) {
        stages.push({ agent_id: '', target_ds: '', instruction: '' });
    }

    const renderStages = () => {
        const c = document.getElementById('wf-stages-container');
        c.innerHTML = stages.map((s, idx) => `
            <div class="card stage-card" draggable="true" data-idx="${idx}" style="margin-bottom:12px; border-color:var(--border-light); cursor:grab;">
                <div class="card-header" style="padding:10px 16px; background:var(--bg-tertiary); display:flex; align-items:center;">
                    <span style="margin-right:10px; opacity:0.5;">☰</span>
                    <strong style="font-size:12px; color:var(--accent);">Stufe ${idx + 1}</strong>
                    <button class="btn btn-ghost btn-sm stage-del" data-idx="${idx}" style="color:var(--danger); padding:2px 6px; margin-left:auto;">${icon('x')}</button>
                </div>
                <div class="card-body" style="padding:12px;">
                    <div class="form-row">
                        <div class="form-group" style="margin-bottom:8px;">
                            <label class="form-label">Spezifischer Agent</label>
                            <select class="form-select stage-agent" data-idx="${idx}">
                                <option value="">-- Workflow-Standard nutzen --</option>
                                ${allAgents.map(a => `<option value="${a.id}" ${s.agent_id == a.id ? 'selected' : ''}>${a.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom:8px;">
                            <label class="form-label">Ziel-Tabelle (Klassifizierung)</label>
                            <select class="form-select stage-ds" data-idx="${idx}">
                                <option value="">-- Keine Tabelle (Nur Verarbeitung) --</option>
                                ${allDS.map(d => `<option value="${d.slug}" ${s.target_ds === d.slug ? 'selected' : ''}>${d.name}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label class="form-label">Anweisung für diese Stufe (Optional)</label>
                        <input class="form-input stage-instruction" data-idx="${idx}" value="${s.instruction || ''}" placeholder="z.B. Erstelle einen Blogpost aus den Daten">
                    </div>
                </div>
            </div>
        `).join('');

        // Listeners for Inputs to update array state
        c.querySelectorAll('.stage-agent').forEach(el => el.onchange = e => stages[el.dataset.idx].agent_id = e.target.value);
        c.querySelectorAll('.stage-ds').forEach(el => el.onchange = e => stages[el.dataset.idx].target_ds = e.target.value);
        c.querySelectorAll('.stage-instruction').forEach(el => el.oninput = e => stages[el.dataset.idx].instruction = e.target.value);

        c.querySelectorAll('.stage-del').forEach(b => {
            b.onclick = (e) => {
                e.preventDefault();
                stages.splice(parseInt(b.dataset.idx), 1);
                renderStages();
            };
        });

        // Drag & Drop Handlers
        let dragSrcEl = null;
        c.querySelectorAll('.stage-card').forEach(card => {
            card.addEventListener('dragstart', (e) => {
                dragSrcEl = card;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', card.outerHTML);
                card.style.opacity = '0.4';
            });
            card.addEventListener('dragend', (e) => {
                card.style.opacity = '1';
                c.querySelectorAll('.stage-card').forEach(c => c.style.border = '1px solid var(--border)');
            });
            card.addEventListener('dragover', (e) => {
                if (e.preventDefault) e.preventDefault();
                return false;
            });
            card.addEventListener('dragenter', (e) => {
                card.style.border = '1px dashed var(--accent)';
            });
            card.addEventListener('dragleave', (e) => {
                card.style.border = '1px solid var(--border)';
            });
            card.addEventListener('drop', (e) => {
                e.stopPropagation();
                if (dragSrcEl !== card) {
                    const srcIdx = parseInt(dragSrcEl.dataset.idx);
                    const targetIdx = parseInt(card.dataset.idx);
                    
                    // Move item in array
                    const item = stages[srcIdx];
                    stages.splice(srcIdx, 1);
                    stages.splice(targetIdx, 0, item);
                    
                    renderStages();
                }
                return false;
            });
        });
    };

    renderStages();

    document.getElementById('wf-add-stage').onclick = (e) => {
        e.preventDefault();
        stages.push({ agent_id: '', target_ds: '', instruction: '' });
        renderStages();
    };

    document.getElementById('wf-cancel').onclick = closeModal;
    document.getElementById('wf-save').onclick = async () => {
        const config_json = wf?.config_json || {};
        
        // Sync stages one last time just in case
        document.querySelectorAll('.stage-instruction').forEach(el => { stages[el.dataset.idx].instruction = el.value; });
        document.querySelectorAll('.stage-agent').forEach(el => { stages[el.dataset.idx].agent_id = el.value; });
        document.querySelectorAll('.stage-ds').forEach(el => { stages[el.dataset.idx].target_ds = el.value; });

        config_json.stages = stages;
        // Clean legacy fields
        delete config_json.target_ds;
        delete config_json.classifier_agent_id;
        delete config_json.file_processing; 

        const data = {
            name: document.getElementById('wf-name').value,
            description: document.getElementById('wf-desc').value,
            category: document.getElementById('wf-cat').value,
            is_active: document.getElementById('wf-active').value === 'true',
            has_menu_entry: document.getElementById('wf-menu').value === 'true',
            has_feed: document.getElementById('wf-feed').value === 'true',
            config_json: config_json
        };
        
        let targetId = wf?.id;
        if (isEdit) {
            await api.put(`/workflows/${targetId}`, data);
        } else {
            data.tenant_id = tenantId;
            data.slug = document.getElementById('wf-slug').value;
            const created = await api.post('/workflows', data);
            targetId = created.id;
        }

        const selDS = [];
        document.querySelectorAll('.ds-row').forEach(row => {
            const btn = row.querySelector('.ds-toggle-btn');
            if (btn.textContent === 'Entfernen') {
                selDS.push({
                    id: parseInt(row.dataset.id),
                    permission: row.querySelector('.ds-perm-sel').value
                });
            }
        });
        const selMCP = [...document.querySelectorAll('#wf-mcp-tags .skill-tag.selected')].map(t => parseInt(t.dataset.id));
        const selA2A = [...document.querySelectorAll('#wf-a2a-tags .skill-tag.selected')].map(t => parseInt(t.dataset.id));
        
        await api.put(`/workflows/${targetId}/data-structures`, { ds_links: selDS });
        await api.put(`/workflows/${targetId}/mcp-modules`, { mcp_ids: selMCP });
        await api.put(`/workflows/${targetId}/a2a-modules`, { a2a_ids: selA2A });

        closeModal();
        render(container);
    };
}