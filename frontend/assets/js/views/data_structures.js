import { api } from '../api.js';
import { getState } from '../state.js';
import { icon, modal, closeModal } from '../components.js';

export const title = 'Datenstrukturen';

export async function render(container) {
    const { tenantId } = getState();
    if (!tenantId) { container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Kein Mandant ausgewählt.</div></div>'; return; }

    const items = await api.get(`/data-structures?tenant_id=${tenantId}`);

    container.innerHTML = `
        <div class="page-header">
            <div><h1 class="page-title">Datenstrukturen</h1><p class="page-subtitle">Standard- und individuelle Datenobjekte des Mandanten</p></div>
            <button class="btn btn-primary" id="btn-new-ds">${icon('plus')} Neue Datenstruktur</button>
        </div>
        <div class="card"><table>
            <thead><tr><th>Name</th><th>Slug</th><th>Kategorie</th><th>Typ</th><th>Aktionen</th></tr></thead>
            <tbody>
                ${items.map(d => `<tr>
                    <td><strong>${d.name}</strong><br><small style="color:var(--text-muted)">${d.description||''}</small></td>
                    <td><code>${d.slug}</code></td>
                    <td>${d.category}</td>
                    <td><span class="tag ${d.is_standard?'tag-standard':''}">${d.is_standard?'Standard':'Individuell'}</span></td>
                    <td>
                        <button class="btn btn-ghost btn-sm ds-perm" data-id="${d.id}">Mandanten</button>
                        <button class="btn btn-ghost btn-sm ds-records" data-id="${d.id}" data-name="${d.name}">Datensätze</button>
                        <button class="btn btn-ghost btn-sm ds-edit" data-id="${d.id}">Bearbeiten</button>
                        ${d.is_standard?'':`<button class="btn btn-ghost btn-sm ds-del" data-id="${d.id}">Löschen</button>`}
                    </td>
                </tr>`).join('')}
            </tbody>
        </table></div>`;

    container.querySelector('#btn-new-ds').onclick = () => showDSForm(container, null);
    container.querySelectorAll('.ds-edit').forEach(btn => {
        btn.onclick = async () => {
            const d = await api.get(`/data-structures/${btn.dataset.id}`);
            showDSForm(container, d);
        };
    });
    container.querySelectorAll('.ds-del').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Datenstruktur wirklich löschen?')) {
                await api.del(`/data-structures/${btn.dataset.id}`);
                render(container);
            }
        };
    });
    container.querySelectorAll('.ds-records').forEach(btn => {
        btn.onclick = () => showRecordsModal(btn.dataset.id, btn.dataset.name);
    });
    container.querySelectorAll('.ds-perm').forEach(btn => {
        btn.onclick = () => showPermissionModal('data-structures', btn.dataset.id, render, container);
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

async function showRecordsModal(dsId, dsName) {
    const [res, ds] = await Promise.all([
        api.get(`/data-structures/${dsId}/records?limit=100`),
        api.get(`/data-structures/${dsId}`)
    ]);
    const records = res.items || [];
    const fields = ds.schema_json?.fields || [];
    
    // Dynamische Spaltenüberschriften basierend auf dem Schema
    const headers = fields.map(f => `<th>${f.name}</th>`).join('');
    
    const recordsHtml = records.map(r => {
        // Zelleninhalt für jedes Feld im Schema generieren.
        // Da wir jetzt auf flachen SQLite-Tabellen arbeiten, liegen die Daten direkt in 'r'
        const cells = fields.map(f => {
            let val = r[f.name];
            let displayVal = val !== undefined && val !== null ? val : '<span style="color:var(--text-muted)">–</span>';
            
            // Formatierung komplexer Typen
            if (typeof val === 'object' && val !== null) {
                displayVal = `<span class="data-cell-json" title='${JSON.stringify(val)}'>{...}</span>`;
            } else if (typeof val === 'boolean' || val === 1 || val === 0) {
                if(f.type === 'boolean') displayVal = val ? '✓' : '✗';
            }
            
            return `<td>${displayVal}</td>`;
        }).join('');

        return `
            <tr data-record-id="${r.id}">
                <td>${r.id}</td>
                ${cells}
                <td>
                    <div style="display:flex; gap:4px; justify-content: flex-end;">
                        <button class="btn btn-ghost btn-sm record-edit" data-id="${r.id}" title="Bearbeiten">${icon('settings')}</button>
                        <button class="btn btn-ghost btn-sm record-del" data-id="${r.id}" style="color:var(--danger);" title="Löschen">${icon('x')}</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    modal(`Datensätze – ${dsName}`, `
        <div style="padding: 24px; display: flex; flex-direction: column; height: 100%; overflow: hidden;">
            <div style="margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-shrink: 0;">
                <div>
                    <p style="font-size:13px; color:var(--text-primary); margin-bottom:4px; font-weight:600;">Vorhandene Einträge</p>
                    <p style="font-size:11px; color:var(--text-muted);">Anzeige basierend auf dem Schema: <code>${fields.length > 0 ? fields.map(f => f.name).join(', ') : 'Kein Schema'}</code></p>
                </div>
                <button class="btn btn-primary" id="btn-new-record" style="border-radius:20px; padding: 6px 16px;">${icon('plus')} Neuer Datensatz</button>
            </div>
            <div style="flex: 1; overflow:auto; border:1px solid var(--border); border-radius:var(--radius-lg); background: var(--bg-tertiary);">
                <table style="width:100%; min-width:800px; border-collapse: separate; border-spacing: 0;">
                    <thead style="position: sticky; top: 0; z-index: 10;">
                        <tr>
                            <th style="width:60px; background: var(--bg-hover); border-bottom: 1px solid var(--border);">ID</th>
                            ${headers.replace(/<th>/g, '<th style="background: var(--bg-hover); border-bottom: 1px solid var(--border);">')}
                            <th style="width:120px; text-align:right; background: var(--bg-hover); border-bottom: 1px solid var(--border);">Aktionen</th>
                        </tr>
                    </thead>
                    <tbody id="records-tbody">
                        ${recordsHtml}
                    </tbody>
                </table>
                ${records.length === 0 ? '<div id="no-records-msg" style="padding:60px; text-align:center; color:var(--text-muted);"><div style="font-size:32px; margin-bottom:12px; opacity:0.2;">' + icon('database') + '</div>Keine Datensätze vorhanden.</div>' : ''}
            </div>
        </div>
    `, `<button class="btn btn-ghost" id="ds-records-close" style="border-radius:20px; padding: 6px 20px;">Schließen</button>`, 'modal-xl');

    document.getElementById('ds-records-close').onclick = closeModal;
    document.getElementById('btn-new-record').onclick = () => showRecordForm(dsId, dsName, null);
    
    document.querySelectorAll('.record-edit').forEach(b => {
        b.onclick = () => {
            const rec = records.find(r => r.id == b.dataset.id);
            showRecordForm(dsId, dsName, rec);
        };
    });

    document.querySelectorAll('.record-del').forEach(b => {
        b.onclick = async () => {
            if (confirm('Datensatz unwiderruflich löschen?')) {
                await api.del(`/data-structures/${dsId}/records/${b.dataset.id}`);
                showRecordsModal(dsId, dsName); // Refresh
            }
        };
    });
}

function showRecordForm(dsId, dsName, record) {
    const isEdit = !!record;
    const { tenantId } = getState();
    
    // Wir filtern 'id' aus dem record für das Edit-Formular, damit es nicht manuell überschrieben wird.
    const cleanRecord = { ...record };
    delete cleanRecord.id;

    modal(isEdit ? `Datensatz bearbeiten (#${record.id})` : `Neuer Datensatz in ${dsName}`, `
        <div class="form-group">
            <label class="form-label">Daten (JSON)</label>
            <textarea class="form-textarea" id="rec-json" style="min-height:300px; font-family:monospace;">${JSON.stringify(isEdit ? cleanRecord : {}, null, 2)}</textarea>
        </div>
        <div id="rec-error" style="color:var(--danger); font-size:12px; margin-top:8px;"></div>
    `, `
        <button class="btn btn-primary" id="rec-save">Speichern</button>
        <button class="btn btn-ghost" id="rec-back">Zurück zur Liste</button>
    `);

    document.getElementById('rec-back').onclick = () => showRecordsModal(dsId, dsName);

    document.getElementById('rec-save').onclick = async () => {
        const errEl = document.getElementById('rec-error');
        let dataJson;
        try {
            dataJson = JSON.parse(document.getElementById('rec-json').value);
        } catch (e) {
            errEl.textContent = 'Ungültiges JSON: ' + e.message;
            return;
        }

        try {
            if (isEdit) {
                await api.put(`/data-structures/${dsId}/records/${record.id}`, { data_json: dataJson });
            } else {
                await api.post(`/data-structures/${dsId}/records`, { tenant_id: tenantId, data_json: dataJson });
            }
            showRecordsModal(dsId, dsName);
        } catch (e) {
            errEl.textContent = 'Fehler beim Speichern: ' + e.message;
        }
    };
}

function showDSForm(container, ds) {
    const { tenantId } = getState();
    const isEdit = !!ds;
    modal(isEdit ? 'Datenstruktur bearbeiten' : 'Neue Datenstruktur', `
        <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="ds-name" value="${ds?.name||''}"></div>
        <div class="form-group"><label class="form-label">Slug</label><input class="form-input" id="ds-slug" value="${ds?.slug||''}" ${isEdit?'disabled':''}></div>
        <div class="form-group"><label class="form-label">Beschreibung</label><input class="form-input" id="ds-desc" value="${ds?.description||''}"></div>
        <div class="form-group"><label class="form-label">Kategorie</label><input class="form-input" id="ds-cat" value="${ds?.category||'custom'}"></div>
        <div class="form-group">
            <label class="form-label">Schema (JSON)</label>
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;line-height:1.4;background:var(--bg-tertiary);padding:8px;border-radius:var(--radius);">
                <strong>Format-Anleitung für KI-Agenten:</strong> Das Schema beschreibt, wie Datensätze in dieser Struktur aufgebaut sein sollen. Es muss ein valides JSON-Objekt sein, das ein Array <code>"fields"</code> enthält.<br>
                <strong>Felder-Eigenschaften:</strong> <code>name</code> (Pflicht), <code>type</code> (string, integer, boolean, array, object), <code>description</code> (Beschreibung für den Agenten), <code>required</code> (true/false).
            </div>
            <textarea class="form-textarea" id="ds-schema" style="min-height:350px;font-family:monospace;white-space:pre;overflow-wrap:normal;overflow-x:auto;">${JSON.stringify(ds?.schema_json||{fields:[]},null,2)}</textarea>
        </div>
        <div id="ds-error" style="color:var(--danger); font-size:12px; margin-top:8px;"></div>
    `, `<button class="btn btn-primary" id="ds-save">Speichern</button><button class="btn btn-ghost" id="ds-cancel">Abbrechen</button>`);

    document.getElementById('ds-cancel').onclick = closeModal;
    document.getElementById('ds-save').onclick = async () => {
        const errEl = document.getElementById('ds-error');
        const btn = document.getElementById('ds-save');
        errEl.textContent = '';
        
        let schema;
        try { 
            schema = JSON.parse(document.getElementById('ds-schema').value); 
        } catch(e) { 
            errEl.textContent = 'Syntaxfehler: Ungültiges JSON. Bitte überprüfen Sie Ihre Eingabe (Kommata, Anführungszeichen, fehlende Klammern). Details: ' + e.message; 
            return; 
        }
        
        btn.disabled = true;
        btn.textContent = 'Speichert...';

        const data = {
            name: document.getElementById('ds-name').value,
            description: document.getElementById('ds-desc').value,
            category: document.getElementById('ds-cat').value,
            schema_json: schema,
        };
        
        try {
            if (isEdit) {
                await api.put(`/data-structures/${ds.id}`, data);
            } else {
                data.tenant_id = tenantId;
                data.slug = document.getElementById('ds-slug').value;
                await api.post('/data-structures', data);
            }
            closeModal();
            render(container);
        } catch(e) {
            errEl.textContent = 'Fehler beim Speichern (Server): ' + e.message;
            btn.disabled = false;
            btn.textContent = 'Speichern';
        }
    };
}









