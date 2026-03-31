import { api } from '../api.js';
import { getState } from '../state.js';
import { icon, modal, closeModal, timeAgo } from '../components.js';

export const title = 'Systemwerkzeuge';

export async function render(container) {
    const { tenantId } = getState();
    if (!tenantId) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Kein Mandant ausgewählt.</div></div>';
        return;
    }

    container.innerHTML = `
        <div class="page-header">
            <div><h1 class="page-title">Systemwerkzeuge</h1><p class="page-subtitle">Werkzeuge zum Testen und Optimieren des Systems und der externen Schnittstellen</p></div>
        </div>
        <div class="tabs" id="werkzeuge-tabs">
            <div class="tab active" data-tab="tooltester">Tooltester</div>
            <div class="tab" data-tab="system-tools">System-Tools</div>
            <div class="tab" data-tab="app-tester">App-Tester (UI)</div>
            <div class="tab" data-tab="llm-logs">System-Logs (LLM)</div>
            <div class="tab" data-tab="audit-files">Datei-Audit</div>
        </div>
        <div id="tab-content"></div>
    `;

    const tabContent = container.querySelector('#tab-content');

    function showTab(tab) {
        container.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        if (tab === 'tooltester') renderTooltester(tabContent, tenantId);
        else if (tab === 'system-tools') renderSystemTools(tabContent);
        else if (tab === 'llm-logs') renderLLMLogs(tabContent);
        else if (tab === 'app-tester') renderAppTester(tabContent, tenantId);
        else if (tab === 'audit-files') renderAuditFiles(tabContent, tenantId);
    }

    container.querySelectorAll('.tab').forEach(t => { t.onclick = () => showTab(t.dataset.tab); });
    showTab('tooltester');
}

async function renderTooltester(container, tenantId) {
    let sysTools = [];
    let mcpModules = [];
    let workflows = [];

    try {
        sysTools = await api.get('/tools');
        mcpModules = await api.get('/mcp-modules');
        workflows = await api.get(`/workflows?tenant_id=${tenantId}`);
    } catch (e) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-text">Fehler beim Laden: ${e.message}</div></div>`;
        return;
    }

    const allTools = [];
    sysTools.forEach(t => {
        allTools.push({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
            type: 'System'
        });
    });

    mcpModules.filter(m => m.is_active).forEach(m => {
        const caps = m.capabilities_json || {};
        (caps.read || []).forEach(c => {
            allTools.push({
                name: `mcp_read_${m.slug}_${c}`,
                description: `MCP Modul '${m.name}': Lese-Zugriff für '${c}'.`,
                parameters: { type: 'object', properties: { params: { type: 'object' } } },
                type: 'MCP'
            });
        });
        (caps.write || []).forEach(c => {
            allTools.push({
                name: `mcp_write_${m.slug}_${c}`,
                description: `MCP Modul '${m.name}': Schreib-Zugriff für '${c}'.`,
                parameters: { type: 'object', properties: { params: { type: 'object' } } },
                type: 'MCP'
            });
        });
    });

    container.innerHTML = `
        <div class="card" style="margin-top:16px;">
            <div class="card-body">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Workflow-Kontext (optional)</label>
                        <select class="form-select" id="tt-workflow">
                            <option value="">Kein Workflow (Global)</option>
                            ${workflows.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Zu testendes Tool auswählen</label>
                        <select class="form-select" id="tt-select">
                            <option value="">-- Bitte wählen --</option>
                            <optgroup label="System-Tools">
                                ${allTools.filter(t => t.type === 'System').map(t => `<option value="${t.name}">${t.name}</option>`).join('')}
                            </optgroup>
                            <optgroup label="MCP-Tools">
                                ${allTools.filter(t => t.type === 'MCP').map(t => `<option value="${t.name}">${t.name}</option>`).join('')}
                            </optgroup>
                        </select>
                    </div>
                </div>

                <div id="tt-details" style="display:none; margin-bottom:16px;">
                    <div style="font-size:13px; margin-bottom:12px; padding:12px; background:var(--bg-tertiary); border-radius:var(--radius); border: 1px solid var(--border);">
                        <strong id="tt-desc" style="display:block; margin-bottom:8px; color:var(--accent);"></strong>
                        <div style="font-family:monospace; font-size:11px; color:var(--text-muted); white-space:pre-wrap;" id="tt-schema"></div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">JSON-Argumente (Payload)</label>
                        <textarea class="form-textarea" id="tt-args" style="font-family:monospace; min-height:120px; font-size:12px;">{}</textarea>
                        <small style="color:var(--text-muted); display:block; margin-top:4px;">Dieses Objekt wird als "arguments" an die Tool-Ausführung gesendet.</small>
                    </div>
                    <button class="btn btn-primary" id="tt-exec">Manuell Ausführen</button>
                </div>

                <div class="form-group" style="margin-top:24px;">
                    <label class="form-label">Ergebnis / Rückgabe</label>
                    <textarea class="form-textarea" id="tt-result" style="font-family:monospace; min-height:250px; font-size:12px; background:#0f1117; color:var(--success);" readonly></textarea>
                </div>
            </div>
        </div>
    `;

    const select = container.querySelector('#tt-select');
    const details = container.querySelector('#tt-details');
    const desc = container.querySelector('#tt-desc');
    const schema = container.querySelector('#tt-schema');
    const args = container.querySelector('#tt-args');
    const exec = container.querySelector('#tt-exec');
    const res = container.querySelector('#tt-result');

    select.onchange = () => {
        const val = select.value;
        if (!val) {
            details.style.display = 'none';
            return;
        }
        const tool = allTools.find(t => t.name === val);
        if (tool) {
            details.style.display = 'block';
            desc.textContent = tool.description;
            schema.textContent = 'Erwartetes Schema:\n' + JSON.stringify(tool.parameters, null, 2);
            
            const skeleton = {};
            if (tool.parameters && tool.parameters.properties) {
                Object.keys(tool.parameters.properties).forEach(k => {
                    skeleton[k] = "";
                    if (k === 'params' && tool.type === 'MCP') {
                        skeleton[k] = {};
                    }
                });
            }
            args.value = JSON.stringify(skeleton, null, 2);
            res.value = '';
        }
    };

    exec.onclick = async () => {
        const val = select.value;
        const wfVal = container.querySelector('#tt-workflow').value;
        if (!val) return;

        let parsedArgs = {};
        try {
            parsedArgs = JSON.parse(args.value);
        } catch (e) {
            alert('Ungültiges JSON in den Argumenten.');
            return;
        }

        exec.disabled = true;
        exec.textContent = 'Ausführen...';
        res.value = 'Wird ausgeführt...';

        try {
            const body = {
                tenant_id: tenantId,
                tool_name: val,
                arguments: parsedArgs
            };
            if (wfVal) {
                body.workflow_id = parseInt(wfVal, 10);
            }

            const response = await api.post('/tools/execute', body);
            res.value = JSON.stringify(response, null, 2);
        } catch (e) {
            res.value = 'Fehler bei der Ausführung:\\n' + e.message;
        } finally {
            exec.disabled = false;
            exec.textContent = 'Manuell Ausführen';
        }
    };
}

async function renderSystemTools(container) {
    let tools = [];
    try {
        tools = await api.get('/tools');
    } catch (e) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-text">Fehler beim Laden der System-Tools: ${e.message}</div></div>`;
        return;
    }

    container.innerHTML = `
        <div class="card" style="margin-top:16px;">
            <table>
                <thead>
                    <tr>
                        <th>Tool-Name</th>
                        <th>Beschreibung</th>
                        <th>Parameter (JSON Schema)</th>
                    </tr>
                </thead>
                <tbody>
                    ${tools.map(t => {
                        return `
                        <tr>
                            <td style="vertical-align:top;width:250px;">
                                <strong style="color:var(--accent);">${t.name}</strong>
                            </td>
                            <td style="vertical-align:top;width:300px;">
                                <span style="font-size:13px;color:var(--text-secondary);">${t.description}</span>
                            </td>
                            <td style="vertical-align:top;">
                                <pre style="font-size:11px;background:var(--bg-tertiary);padding:10px;border-radius:var(--radius);border:1px solid var(--border);margin:0;white-space:pre-wrap;max-height:250px;overflow-y:auto;color:var(--text-primary);">${JSON.stringify(t.parameters, null, 2)}</pre>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function renderLLMLogs(container) {
    let state = { currentPage: 1, pageSize: 25, total: 0, loading: false };

    container.innerHTML = `
        <div class="card" style="margin-top:16px;">
            <div class="card-body" style="padding:0;" id="log-list"></div>
            <div class="pagination-bar">
                <button class="btn btn-ghost btn-sm" id="btn-log-prev">←</button>
                <span class="page-info" id="log-page-info">...</span>
                <button class="btn btn-ghost btn-sm" id="btn-log-next">→</button>
            </div>
        </div>`;

    const list = container.querySelector('#log-list');
    const info = container.querySelector('#log-page-info');
    const btnPrev = container.querySelector('#btn-log-prev');
    const btnNext = container.querySelector('#btn-log-next');

    const load = async (page) => {
        state.loading = true;
        state.currentPage = page;
        list.innerHTML = '<div class="feed-loader">Lade RAW-Logs...</div>';
        
        try {
            const res = await api.get(`/llm-logs?limit=${state.pageSize}&offset=${(page - 1) * state.pageSize}`);
            state.total = res.total;
            list.innerHTML = res.items.map(l => `
                <div class="audit-item" style="padding:12px 20px; cursor:pointer; border-bottom:1px solid var(--border);" data-id="${l.id}">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span>
                            <strong style="color:var(--accent)">${l.model}</strong> 
                            <small style="color:var(--text-muted); margin-left:10px;">${l.duration_ms}ms</small>
                        </span>
                        <span class="audit-time">${new Date(l.created_at).toLocaleString()}</span>
                    </div>
                    <div style="font-size:11px; color:var(--text-muted); margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        RAW: ${l.prompt_raw.substring(0, 150)}...
                    </div>
                </div>
            `).join('');

            list.querySelectorAll('.audit-item').forEach(el => {
                el.onclick = () => {
                    const item = res.items.find(i => i.id == el.dataset.id);
                    showRawDetail(item);
                };
            });

            const totalPages = Math.ceil(state.total / state.pageSize) || 1;
            info.textContent = `Seite ${state.currentPage} / ${totalPages} (${state.total} Logs)`;
            btnPrev.disabled = state.currentPage <= 1;
            btnNext.disabled = state.currentPage >= totalPages;
        } catch (e) {
            list.innerHTML = `<div class="empty-state" style="color:var(--danger)">Fehler: ${e.message}</div>`;
        } finally { state.loading = false; }
    };

    btnPrev.onclick = () => load(state.currentPage - 1);
    btnNext.onclick = () => load(state.currentPage + 1);
    load(1);
}

function showRawDetail(l) {
    const tryFormat = (str) => {
        try { return JSON.stringify(JSON.parse(str), null, 2); }
        catch(e) { return str; }
    };

    const renderRaw = () => `
        <div class="detail-section">
            <div class="detail-section-title" style="color:var(--accent); display:flex; justify-content:space-between; margin-bottom:8px;">
                <strong>FULL HTTP REQUEST PAYLOAD (Outgoing)</strong>
                <span style="font-size:10px; opacity:0.6; background:var(--bg-primary); padding:2px 6px; border-radius:4px;">Size: ${(new Blob([l.prompt_raw]).size / 1024).toFixed(2)} KB</span>
            </div>
            <textarea class="form-textarea" style="height:480px; font-family:monospace; font-size:11px; background:#000; color:#eee; border-color:#444; line-height:1.4;" readonly>${tryFormat(l.prompt_raw)}</textarea>
        </div>
        <div class="detail-section" style="margin-top:20px;">
            <div class="detail-section-title" style="color:var(--success); display:flex; justify-content:space-between; margin-bottom:8px;">
                <strong>FULL HTTP RESPONSE (Incoming)</strong>
                <span style="font-size:10px; opacity:0.6; background:var(--bg-primary); padding:2px 6px; border-radius:4px;">Duration: ${l.duration_ms}ms</span>
            </div>
            <textarea class="form-textarea" style="height:300px; font-family:monospace; font-size:11px; background:#000; color:var(--success); border-color:#444; line-height:1.4;" readonly>${tryFormat(l.response_raw)}</textarea>
        </div>`;

    const renderReadable = () => {
        let promptHtml = '';
        let responseHtml = '';
        try {
            const prompt = JSON.parse(l.prompt_raw);
            const messages = prompt.messages || [];
            promptHtml = messages.map(m => {
                const roleColor = m.role === 'system' ? '#6366f1' : m.role === 'user' ? '#22c55e' : '#f59e0b';
                return `
                <div style="margin-bottom:16px; border-left: 4px solid ${roleColor}; padding-left:12px;">
                    <div style="font-weight:bold; font-size:11px; text-transform:uppercase; color:${roleColor}; margin-bottom:4px;">${m.role}</div>
                    <div style="font-size:12px; white-space:pre-wrap; line-height:1.5; color:var(--text-primary);">${m.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                </div>`;
            }).join('');
        } catch (e) { promptHtml = '<div style="color:var(--danger)">Fehler beim Parsen des Prompts.</div>'; }

        try {
            const resp = JSON.parse(l.response_raw);
            const content = resp.choices?.[0]?.message?.content || JSON.stringify(resp, null, 2);
            responseHtml = `
            <div style="border-left: 4px solid #f59e0b; padding-left:12px;">
                <div style="font-weight:bold; font-size:11px; text-transform:uppercase; color:#f59e0b; margin-bottom:4px;">Assistant Response</div>
                <div style="font-size:12px; white-space:pre-wrap; line-height:1.5; color:var(--success);">${content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            </div>`;
        } catch (e) { responseHtml = '<div style="color:var(--danger)">Fehler beim Parsen der Response.</div>'; }

        return `
            <div class="detail-section">
                <div class="detail-section-title">Gereinigter Chat-Verlauf</div>
                <div style="background:var(--bg-tertiary); padding:16px; border-radius:var(--radius); border:1px solid var(--border); max-height: 60vh; overflow-y: auto;">
                    ${promptHtml}
                    <hr style="border:none; border-top:1px solid var(--border); margin:20px 0;">
                    ${responseHtml}
                </div>
            </div>`;
    };

    // Debug-Optimierung: Wir starten direkt im RAW-Modus für den Deep Audit
    modal('LLM Deep Audit (Call #' + l.id + ')', `
        <div id="log-detail-content">${renderRaw()}</div>
    `, `
        <button class="btn btn-ghost" id="btn-toggle-view" style="margin-right:auto;">Lese-Modus (Chat)</button>
        <button class="btn btn-primary" id="llm-log-close">Schließen</button>
    `, 'modal-lg');
    
    let isReadable = false;
    const toggleBtn = document.getElementById('btn-toggle-view');
    const contentDiv = document.getElementById('log-detail-content');

    if (toggleBtn) {
        toggleBtn.onclick = () => {
            isReadable = !isReadable;
            toggleBtn.textContent = isReadable ? 'RAW-Modus anzeigen' : 'Menschenlesbare Version';
            contentDiv.innerHTML = isReadable ? renderReadable() : renderRaw();
        };
    }

    document.getElementById('llm-log-close').onclick = closeModal;
}

async function renderAppTester(container, tenantId) {
    container.innerHTML = `<div class="feed-loader">Lade App-Module...</div>`;
    
    try {
        const modules = await api.get('/app-modules');
        const active = modules.filter(m => m.is_active);

        container.innerHTML = `
            <div class="grid-2" style="margin-top:16px;">
                <div class="card">
                    <div class="card-header"><span class="card-title">1. App & View wählen</span></div>
                    <div class="card-body">
                        <div class="form-group">
                            <label class="form-label">Aktive App</label>
                            <select class="form-select" id="at-app-select">
                                <option value="">-- App auswählen --</option>
                                ${active.map(m => `<option value="${m.slug}">${m.name} (${m.slug})</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group" id="at-view-group" style="display:none;">
                            <label class="form-label">UI-Einstiegspunkt (View)</label>
                            <select class="form-select" id="at-view-select"></select>
                        </div>
                    </div>
                </div>

                <div class="card" id="at-payload-card" style="display:none;">
                    <div class="card-header">
                        <span class="card-title">2. Vorbelegung (initialData)</span>
                        <button class="btn btn-ghost btn-sm" id="at-btn-sample">Beispiel laden</button>
                    </div>
                    <div class="card-body">
                        <div class="form-group">
                            <textarea class="form-textarea" id="at-payload" style="font-family:monospace; min-height:150px; font-size:12px;">{}</textarea>
                            <small style="color:var(--text-muted); display:block; margin-top:4px;">Simuliert den Payload, den ein Agent an die App übergeben würde.</small>
                        </div>
                        <button class="btn btn-primary" style="width:100%;" id="at-btn-launch">${icon('zap')} UI mit Daten starten</button>
                    </div>
                </div>
            </div>
            
            <div id="at-no-apps" class="empty-state" style="display:${active.length ? 'none' : 'block'};">
                <div class="empty-state-text">Keine aktiven App-Module gefunden.</div>
            </div>
        `;

        const appSelect = container.querySelector('#at-app-select');
        const viewGroup = container.querySelector('#at-view-group');
        const viewSelect = container.querySelector('#at-view-select');
        const payloadCard = container.querySelector('#at-payload-card');
        const payloadText = container.querySelector('#at-payload');
        const launchBtn = container.querySelector('#at-btn-launch');
        const sampleBtn = container.querySelector('#at-btn-sample');

        appSelect.onchange = () => {
            const slug = appSelect.value;
            if (!slug) {
                viewGroup.style.display = 'none';
                payloadCard.style.display = 'none';
                return;
            }

            const mod = active.find(m => m.slug === slug);
            
            // Dynamisch aus den Views des Moduls lesen
            let views = mod.views_json;
            if (!views || Object.keys(views).length === 0) {
                views = { "default": { "title": "Standard (ui.js)", "file": "ui.js" } };
            }

            viewSelect.innerHTML = Object.entries(views).map(([id, v]) => 
                `<option value="${v.file}">${v.title} (${v.file})</option>`
            ).join('');

            viewGroup.style.display = 'block';
            payloadCard.style.display = 'block';
        };

        sampleBtn.onclick = () => {
            const slug = appSelect.value;
            const mod = active.find(m => m.slug === slug);
            if (mod && mod.input_schema) {
                const sample = {};
                Object.keys(mod.input_schema).forEach(k => {
                    sample[k] = `Test ${k}`;
                });
                payloadText.value = JSON.stringify(sample, null, 2);
            }
        };

        launchBtn.onclick = async () => {
            const slug = appSelect.value;
            const viewFile = viewSelect.value;
            const name = appSelect.options[appSelect.selectedIndex].text;
            
            let data = {};
            try {
                data = JSON.parse(payloadText.value);
            } catch(e) {
                alert('JSON Fehler: ' + e.message);
                return;
            }

            modal(`App Test: ${name}`, `
                <div id="at-run-container" style="min-height: 300px;">
                    <div class="feed-loader">Initialisiere View ${viewFile}...</div>
                </div>
            `, '', 'modal-lg');

            try {
                // Hier nutzen wir den neuen 'file' Parameter der API
                const uiModule = await import(`/api/v1/app-modules/${slug}/ui.js?file=${viewFile}&t=${Date.now()}`);
                const runContainer = document.getElementById('at-run-container');
                if (uiModule.render) {
                    runContainer.innerHTML = '';
                    await uiModule.render(runContainer, data, 0, (result) => {
                        console.log('App Test Result:', result);
                        closeModal();
                    });
                } else {
                    runContainer.innerHTML = '<div class="empty-state">Modul-Export render() fehlt.</div>';
                }
            } catch (e) {
                document.getElementById('at-run-container').innerHTML = `<div style="color:var(--danger); padding:20px;">Ladefehler: ${e.message}</div>`;
            }
        };

    } catch (e) {
        container.innerHTML = `<div class="empty-state" style="color:var(--danger)">Fehler: ${e.message}</div>`;
    }
}

async function renderAuditFiles(container, tenantId) {
    container.innerHTML = `<div class="feed-loader">Prüfe Dateisystem gegen Datenbank...</div>`;
    
    try {
        const res = await api.get(`/files/orphaned?tenant_id=${tenantId}`);
        
        const fileRows = res.orphaned_files.map(f => `
            <tr>
                <td>${f.id}</td>
                <td><strong>${f.filename}</strong></td>
                <td>${new Date(f.created_at).toLocaleString('de-DE')}</td>
                <td>
                    <button class="btn btn-ghost btn-sm" onclick="window.open('/api/v1/files/${f.id}/content', '_blank')">Ansehen</button>
                </td>
            </tr>
        `).join('');

        container.innerHTML = `
            <div class="card" style="margin-top:16px;">
                <div class="card-body">
                    <h3 style="margin-bottom:16px; color:var(--accent);">Consistency Check: Dateien vs. Datensätze</h3>
                    <p style="font-size:13px; color:var(--text-secondary); margin-bottom:20px;">
                        Das System hat <strong>${res.total_files}</strong> hochgeladene Dateien gefunden. 
                        Davon sind <strong>${res.orphaned_count}</strong> Dateien "verwaist" (d.h. sie sind in keiner Datenstruktur in einer Spalte <code>document_id</code> oder <code>file_id</code> verknüpft).
                    </p>
                    
                    ${res.orphaned_count > 0 ? `
                        <div style="background:var(--warning-bg); border-left:3px solid var(--warning); padding:12px; border-radius:4px; margin-bottom:20px; font-size:13px; color:var(--warning);">
                            <strong>Achtung:</strong> Verwaiste Dateien wurden hochgeladen, aber vom Agenten nicht erfolgreich in eine Datenstruktur (z.B. Rechnungen, Verträge) einsortiert.
                        </div>
                        <table>
                            <thead><tr><th>ID</th><th>Dateiname</th><th>Hochgeladen am</th><th>Aktionen</th></tr></thead>
                            <tbody>${fileRows}</tbody>
                        </table>
                    ` : `
                        <div style="background:var(--success-bg); border-left:3px solid var(--success); padding:16px; border-radius:4px; font-size:14px; color:var(--success);">
                            <strong>Hervorragend!</strong> Alle Dateien im System sind sauber mit Datensätzen verknüpft. Es gibt keine verlorenen Dokumente.
                        </div>
                    `}
                </div>
            </div>
        `;
    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : JSON.stringify(e);
        container.innerHTML = `<div class="empty-state"><div class="empty-state-text" style="color:var(--danger)">Fehler beim Audit: ${errorMsg}</div></div>`;
    }
}







