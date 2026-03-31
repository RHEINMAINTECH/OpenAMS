import { api } from '../api.js';
import { getState } from '../state.js';
import { icon, modal, closeModal } from '../components.js';

export const title = 'Einstellungen';

let settingsState = {
    valMap: {},
    settings: []
};

async function refreshSettingsState() {
    const settings = await api.get('/settings');
    settingsState.settings = settings;
    settingsState.valMap = {};
    settings.forEach(s => {
        if (s.value_json && s.value_json.value !== undefined) {
            settingsState.valMap[s.key] = s.value_json.value;
        }
    });
}

export async function render(container) {
    await refreshSettingsState();

    container.innerHTML = `
        <div class="page-header"><div><h1 class="page-title">Einstellungen</h1><p class="page-subtitle">System- und Modellkonfiguration</p></div></div>
        <div class="tabs" id="settings-tabs">
            <div class="tab active" data-tab="general">Allgemein</div>
            <div class="tab" data-tab="company">Unternehmensdaten</div>
            <div class="tab" data-tab="model">Modelleinstellungen</div>
            <div class="tab" data-tab="tenants">Mandanten</div>
        </div>
        <div id="tab-content"></div>`;

    const tabContent = container.querySelector('#tab-content');

    function showTab(tab) {
        container.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        if (tab === 'general') renderGeneral(tabContent);
        else if (tab === 'company') renderCompany(tabContent);
        else if (tab === 'model') renderModel(tabContent);
        else if (tab === 'tenants') renderTenants(tabContent);
    }

    container.querySelectorAll('.tab').forEach(t => { t.onclick = () => showTab(t.dataset.tab); });
    showTab('general');
}

function renderGeneral(container) {
    const { valMap } = settingsState;
    container.innerHTML = `
        <div class="card" style="margin-top:16px;"><div class="card-body">
            <div class="form-group"><label class="form-label">Sprache</label>
                <select class="form-select" id="s-lang"><option value="de" selected>Deutsch</option></select></div>
            <div class="form-group"><label class="form-label">Governance: Auto-Genehmigung</label>
                <select class="form-select" id="s-auto-approve">
                    <option value="false" ${!valMap.governance_auto_approve?'selected':''}>Nein (empfohlen)</option>
                    <option value="true" ${valMap.governance_auto_approve==='true'||valMap.governance_auto_approve===true?'selected':''}>Ja</option>
                </select></div>
            <button class="btn btn-primary" id="s-gen-save">Speichern</button>
        </div></div>`;

    container.querySelector('#s-gen-save').onclick = async () => {
        await api.put('/settings', { key: 'governance_auto_approve', value_json: { value: container.querySelector('#s-auto-approve').value === 'true' } });
        await refreshSettingsState();
        alert('Einstellungen gespeichert.');
    };
}

async function renderModel(container) {
    const { settings, valMap } = settingsState;
    const modelData = {
        onboard: settings.find(s => s.key === 'onboard_models')?.value_json?.models || [],
        wilma: settings.find(s => s.key === 'wilma_models')?.value_json?.models || [],
        openai: settings.find(s => s.key === 'openai_models')?.value_json?.models || [],
        anthropic: settings.find(s => s.key === 'anthropic_models')?.value_json?.models || []
    };

    container.innerHTML = `
        <div class="tabs" id="provider-tabs" style="margin-top:20px; border-bottom: 1px solid var(--border);">
            <div class="tab active" data-provider="wilma">WilmaGPT</div>
            <div class="tab" data-provider="openai">OpenAI</div>
            <div class="tab" data-provider="anthropic">Anthropic</div>
            <div class="tab" data-provider="onboard">Onboard-Modelle</div>
            <div class="tab" data-provider="defaults">Standard-Werte</div>
        </div>
        <div id="provider-content" style="padding: 20px 0;"></div>
    `;

    const pContent = container.querySelector('#provider-content');

    const renderProvider = (p) => {
        if (p === 'onboard') {
            pContent.innerHTML = `
                <div class="card"><div class="card-header"><span class="card-title">Integrierte System-Modelle</span></div>
                <div class="card-body">
                    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">Diese Modelle sind fest im Backend integriert und führen spezialisierte Code-Aufgaben aus (z.B. OCR, Bildanalyse). Sie benötigen keinen API-Key.</p>
                    <table style="font-size:12px;">
                        <thead><tr><th>ID</th><th>Funktion</th></tr></thead>
                        <tbody>
                            ${modelData.onboard.map(m => `<tr><td><code>${m.id}</code></td><td>${m.label}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div></div>`;
            return;
        }

        if (p === 'defaults') {
            let modelOpts = '<option value="">-- Modell wählen --</option>';
            ['wilma', 'openai', 'anthropic'].forEach(prov => {
                modelOpts += `<optgroup label="${prov.toUpperCase()}">`;
                modelData[prov].forEach(m => {
                    const sel = valMap.wilma_default_model === m.id ? 'selected' : '';
                    modelOpts += `<option value="${m.id}" ${sel}>${m.label} (${m.id})</option>`;
                });
                modelOpts += `</optgroup>`;
            });

            pContent.innerHTML = `
                <div class="card"><div class="card-body">
                    <div class="form-group">
                        <label class="form-label">Globales Standard-Modell</label>
                        <select class="form-select" id="s-def-model">${modelOpts}</select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Standard-Temperatur</label>
                        <input class="form-input" id="s-def-temp" type="number" step="0.1" value="${valMap.wilma_default_temperature ?? 0.7}">
                    </div>
                    <div class="form-group" style="padding-top:16px; border-top:1px solid var(--border);">
                        <label class="form-label">Wizard-Modell (KI-Architekt)</label>
                        <select class="form-select" id="s-wiz-model">${modelOpts.replace('selected', '')}</select>
                        <p style="font-size:11px;color:var(--text-muted);margin-top:4px;">Dieses Modell wird für die Generierung von Workflows und Strukturen verwendet. Empfehlung: Ein leistungsstarkes Modell nutzen.</p>
                    </div>
                    <button class="btn btn-primary" id="s-save-defaults">Speichern</button>
                    <button class="btn btn-ghost" id="s-test-defaults" style="margin-left:8px;">Verbindung testen</button>
                    <div id="s-test-res" style="margin-top:12px;"></div>
                </div></div>`;

            // Pre-select wizard model
            const wizSelect = document.getElementById('s-wiz-model');
            if (valMap.wizard_model) wizSelect.value = valMap.wizard_model;

            container.querySelector('#s-save-defaults').onclick = async () => {
                await api.put('/settings', { key: 'wilma_default_model', value_json: { value: document.getElementById('s-def-model').value } });
                await api.put('/settings', { key: 'wilma_default_temperature', value_json: { value: parseFloat(document.getElementById('s-def-temp').value) } });
                await api.put('/settings', { key: 'wizard_model', value_json: { value: document.getElementById('s-wiz-model').value } });
                await refreshSettingsState();
                alert('Standards gespeichert.');
            };

            container.querySelector('#s-test-defaults').onclick = async () => {
                const resEl = document.getElementById('s-test-res');
                resEl.innerHTML = '<span style="color:var(--text-muted)">Teste Verbindung...</span>';
                try {
                    const r = await api.post('/settings/test-llm', {});
                    if (r.success) {
                        resEl.innerHTML = `<span style="color:var(--success)">✓ Verbindung erfolgreich!</span><br><small style="color:var(--text-secondary)">${r.response || ''}</small>`;
                    } else {
                        resEl.innerHTML = `<span style="color:var(--danger)">✗ Fehler: ${r.error || 'Unbekannt'}</span>`;
                    }
                } catch (e) {
                    resEl.innerHTML = `<span style="color:var(--danger)">✗ ${e.message}</span>`;
                }
            };
            return;
        }

        const labels = { wilma: 'WilmaGPT', openai: 'OpenAI (ChatGPT)', anthropic: 'Anthropic (Claude)' };
        pContent.innerHTML = `
            <div class="grid-2">
                <div class="card">
                    <div class="card-header"><span class="card-title">${labels[p]} API-Zugang</span></div>
                    <div class="card-body">
                        <div class="form-group"><label class="form-label">API-URL</label><input class="form-input" id="p-url" value="${valMap[p+'_api_url'] || ''}"></div>
                        <div class="form-group"><label class="form-label">API-Key</label><input class="form-input" id="p-key" type="password" value="${valMap[p+'_api_key'] || ''}"></div>
                        <button class="btn btn-primary btn-sm" id="p-save-api">Zugang speichern</button>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <span class="card-title">Verfügbare Modelle</span>
                        <button class="btn btn-primary btn-sm" id="p-add-model">${icon('plus')} Hinzufügen</button>
                    </div>
                    <div class="card-body" style="padding:0;">
                        <table style="font-size:12px;">
                            <thead><tr><th>Name (ID)</th><th>Anzeige</th><th></th></tr></thead>
                            <tbody id="p-model-list">
                                ${modelData[p].map(m => `
                                    <tr>
                                        <td><code>${m.id}</code></td>
                                        <td>${m.label}</td>
                                        <td style="text-align:right;"><button class="btn btn-ghost btn-sm p-del-model" data-id="${m.id}" style="color:var(--danger)">${icon('x')}</button></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;

        container.querySelector('#p-save-api').onclick = async () => {
            const url = document.getElementById('p-url').value;
            const key = document.getElementById('p-key').value;
            await api.put('/settings', { key: p+'_api_url', value_json: { value: url } });
            await api.put('/settings', { key: p+'_api_key', value_json: { value: key } });
            await refreshSettingsState();
            alert('API-Zugang gespeichert.');
        };

        container.querySelector('#p-add-model').onclick = () => {
            modal('Modell hinzufügen', `
                <div class="form-group"><label class="form-label">Modell ID (API-Name)</label><input class="form-input" id="nm-id" placeholder="z.B. gpt-4o-2024-08-06"></div>
                <div class="form-group"><label class="form-label">Anzeigename</label><input class="form-input" id="nm-label" placeholder="z.B. GPT-4o (August Update)"></div>
            `, `<button class="btn btn-primary" id="nm-save">Hinzufügen</button>`);
            document.getElementById('nm-save').onclick = async () => {
                const id = document.getElementById('nm-id').value.trim();
                const label = document.getElementById('nm-label').value.trim();
                if (!id || !label) return;
                modelData[p].push({ id, label });
                await api.put('/settings', { key: p+'_models', value_json: { models: modelData[p] } });
                closeModal();
                renderProvider(p);
            };
        };

        container.querySelectorAll('.p-del-model').forEach(b => {
            b.onclick = async () => {
                if (confirm('Modell aus der Liste entfernen?')) {
                    modelData[p] = modelData[p].filter(m => m.id !== b.dataset.id);
                    await api.put('/settings', { key: p+'_models', value_json: { models: modelData[p] } });
                    renderProvider(p);
                }
            };
        });
    };

    container.querySelectorAll('#provider-tabs .tab').forEach(t => {
        t.onclick = () => {
            container.querySelectorAll('#provider-tabs .tab').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            renderProvider(t.dataset.provider);
        };
    });

    renderProvider('wilma');
}

async function renderCompany(container) {
    const { tenantId } = getState();
    if (!tenantId) { container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Kein Mandant ausgewählt.</div></div>'; return; }

    const allSettings = await api.get(`/settings?tenant_id=${tenantId}`);
    const row = allSettings.find(s => s.key === 'company_info' && s.tenant_id === tenantId);
    const info = row?.value_json || {};

    container.innerHTML = `
        <div class="card" style="margin-top:16px;"><div class="card-body">
            <h3 style="margin-bottom:4px;font-size:15px;">Unternehmensdaten des Mandanten</h3>
            <p style="font-size:12px;color:var(--text-muted);margin-bottom:20px;">
                Diese Daten stehen dem Agenten als Kontext zur Verfügung – z.&nbsp;B. für Schreiben, Anträge und offizielle Korrespondenz.
            </p>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Firmenname</label><input class="form-input" id="c-name" value="${info.company_name || ''}"></div>
                <div class="form-group"><label class="form-label">Ansprechpartner / GF</label><input class="form-input" id="c-contact" value="${info.contact_person || ''}"></div>
            </div>
            <div class="form-group"><label class="form-label">Straße &amp; Hausnummer</label><input class="form-input" id="c-street" value="${info.street || ''}"></div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">PLZ</label><input class="form-input" id="c-zip" value="${info.zip_code || ''}"></div>
                <div class="form-group"><label class="form-label">Ort</label><input class="form-input" id="c-city" value="${info.city || ''}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Steuernummer</label><input class="form-input" id="c-tax" value="${info.tax_number || ''}" placeholder="z. B. 123/456/78910"></div>
                <div class="form-group"><label class="form-label">USt-IdNr.</label><input class="form-input" id="c-vat" value="${info.vat_id || ''}" placeholder="z. B. DE123456789"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Telefon</label><input class="form-input" id="c-phone" value="${info.phone || ''}"></div>
                <div class="form-group"><label class="form-label">E-Mail</label><input class="form-input" id="c-email" value="${info.email || ''}"></div>
            </div>
            <div class="form-group"><label class="form-label">Handelsregister</label><input class="form-input" id="c-registry" value="${info.registry || ''}" placeholder="z. B. HRB 12345, AG Mainz"></div>
            <div class="form-group"><label class="form-label">Weitere Informationen</label><textarea class="form-textarea" id="c-notes" placeholder="Bankverbindung, Branche, besondere Hinweise für den Agenten …">${info.notes || ''}</textarea></div>
            <button class="btn btn-primary" id="c-save">Speichern</button>
            <span id="c-status" style="margin-left:12px;font-size:12px;"></span>
        </div></div>`;

    container.querySelector('#c-save').onclick = async () => {
        const data = {
            company_name: document.getElementById('c-name').value,
            contact_person: document.getElementById('c-contact').value,
            street: document.getElementById('c-street').value,
            zip_code: document.getElementById('c-zip').value,
            city: document.getElementById('c-city').value,
            tax_number: document.getElementById('c-tax').value,
            vat_id: document.getElementById('c-vat').value,
            phone: document.getElementById('c-phone').value,
            email: document.getElementById('c-email').value,
            registry: document.getElementById('c-registry').value,
            notes: document.getElementById('c-notes').value,
        };
        await api.put('/settings', { key: 'company_info', value_json: data, tenant_id: tenantId });
        const st = document.getElementById('c-status');
        st.style.color = 'var(--success)';
        st.textContent = '✓ Gespeichert';
        setTimeout(() => { st.textContent = ''; }, 3000);
    };
}

async function renderTenants(container) {
    const tenants = await api.get('/tenants');
    container.innerHTML = `
        <div class="card" style="margin-top:16px;">
            <div class="card-header"><span class="card-title">Mandanten</span><button class="btn btn-primary btn-sm" id="btn-new-tenant">${icon('plus')} Neuer Mandant</button></div>
            <table>
                <thead><tr><th>Name</th><th>Slug</th><th>Status</th><th>Aktionen</th></tr></thead>
                <tbody>${tenants.map(t => `<tr>
                    <td><strong>${t.name}</strong></td><td><code>${t.slug}</code></td>
                    <td><span class="tag ${t.is_active?'tag-active':'tag-inactive'}">${t.is_active?'Aktiv':'Inaktiv'}</span></td>
                    <td>
                        <button class="btn btn-ghost btn-sm t-edit" data-id="${t.id}">Bearbeiten</button>
                        <button class="btn btn-ghost btn-sm t-del" data-id="${t.id}" style="color:var(--danger)">Löschen</button>
                    </td>
                </tr>`).join('')}</tbody>
            </table>
        </div>`;

    container.querySelector('#btn-new-tenant').onclick = () => {
        modal('Neuer Mandant', `
            <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="t-name"></div>
            <div class="form-group"><label class="form-label">Slug</label><input class="form-input" id="t-slug" placeholder="z.B. mein-unternehmen"></div>
        `, `<button class="btn btn-primary" id="t-save">Erstellen</button><button class="btn btn-ghost" id="t-cancel">Abbrechen</button>`);
        document.getElementById('t-cancel').onclick = closeModal;
        document.getElementById('t-save').onclick = async () => {
            await api.post('/tenants', { name: document.getElementById('t-name').value, slug: document.getElementById('t-slug').value });
            closeModal();
            renderTenants(container);
        };
    };

    container.querySelectorAll('.t-edit').forEach(btn => {
        btn.onclick = () => {
            const t = tenants.find(x => x.id == btn.dataset.id);
            modal('Mandant bearbeiten', `
                <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="et-name" value="${t.name}"></div>
                <div class="form-group">
                    <label class="form-label">Slug</label>
                    <input class="form-input" id="et-slug" value="${t.slug}">
                    <small style="color:var(--warning); display:block; margin-top:4px;">Achtung: Das Ändern des Slugs benennt alle zugehörigen Datenbanktabellen um.</small>
                </div>
            `, `<button class="btn btn-primary" id="et-save">Speichern</button><button class="btn btn-ghost" id="et-cancel">Abbrechen</button>`);
            
            document.getElementById('et-cancel').onclick = closeModal;
            document.getElementById('et-save').onclick = async () => {
                const newName = document.getElementById('et-name').value;
                const newSlug = document.getElementById('et-slug').value;
                await api.put(`/tenants/${t.id}`, { name: newName, slug: newSlug });
                closeModal();
                // Seite neu laden um Änderungen in der Sidebar/Header zu reflektieren
                location.reload(); 
            };
        };
    });

    container.querySelectorAll('.t-del').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Mandant wirklich löschen? Alle zugehörigen Daten gehen verloren.')) {
                await api.del(`/tenants/${btn.dataset.id}`);
                renderTenants(container);
            }
        };
    });
}



