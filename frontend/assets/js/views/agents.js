import { api } from '../api.js';
import { getState } from '../state.js';
import { icon, modal, closeModal } from '../components.js';

export const title = 'Agenten';

export async function render(container) {
    const { tenantId } = getState();
    if (!tenantId) { container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Kein Mandant ausgewählt.</div></div>'; return; }

    const [agents, settings] = await Promise.all([
        api.get(`/agents?tenant_id=${tenantId}`),
        api.get('/settings')
    ]);

    const getModels = (provider) => {
        const s = settings.find(x => x.key === `${provider}_models`);
        return s?.value_json?.models || [];
    };

    const MODELS_CONFIG = [
        { group: 'Onboard-Modelle (Spezial)', items: getModels('onboard') },
        { group: 'WilmaGPT', items: getModels('wilma') },
        { group: 'OpenAI (ChatGPT)', items: getModels('openai') },
        { group: 'Anthropic (Claude)', items: getModels('anthropic') }
    ];

    container.innerHTML = `
        <div class="page-header">
            <div><h1 class="page-title">Agenten</h1><p class="page-subtitle">Verwaltung und Konfiguration aller KI-Agenten</p></div>
            <div style="display:flex;gap:8px;">
                <button class="btn btn-ghost" id="btn-agent-skills">${icon('zap')} Skills</button>
                <button class="btn btn-ghost" id="btn-agent-memory">${icon('brain')} Agenten-Gedächtnis</button>
                <button class="btn btn-primary" id="btn-new-agent">${icon('plus')} Neuer Agent</button>
            </div>
        </div>
        <div class="card"><table>
            <thead><tr><th>Name</th><th>Typ</th><th>Modell</th><th>Temp.</th><th>Skills</th><th>Status</th><th>Aktionen</th></tr></thead>
            <tbody>
                ${agents.map(a => `<tr>
                    <td><strong>${a.name}</strong><br><small style="color:var(--text-muted)">${a.description || ''}</small></td>
                    <td><span class="tag ${a.agent_type === 'standard' ? 'tag-standard' : ''}">${a.agent_type}</span></td>
                    <td>${a.llm_model}</td>
                    <td>${a.llm_temperature}</td>
                    <td><span class="agent-skill-count" data-agent-id="${a.id}">…</span></td>
                    <td><span class="tag ${a.is_active ? 'tag-active' : 'tag-inactive'}">${a.is_active ? 'Aktiv' : 'Inaktiv'}</span></td>
                    <td>
                        <button class="btn btn-ghost btn-sm agent-perm" data-id="${a.id}">Mandanten</button>
                        <button class="btn btn-ghost btn-sm agent-edit" data-id="${a.id}">Bearbeiten</button>
                        <button class="btn btn-ghost btn-sm agent-del" data-id="${a.id}">Löschen</button>
                    </td>
                </tr>`).join('')}
            </tbody>
        </table></div>`;

    agents.forEach(async a => {
        try {
            const skills = await api.get(`/agents/${a.id}/skills`);
            const el = container.querySelector(`.agent-skill-count[data-agent-id="${a.id}"]`);
            if (el) el.textContent = skills.length > 0 ? skills.map(s => s.name).join(', ') : '–';
        } catch { }
    });

    container.querySelector('#btn-agent-skills').onclick = () => window.location.hash = '#/skills';
    container.querySelector('#btn-agent-memory').onclick = () => window.location.hash = '#/memory';
    container.querySelector('#btn-new-agent').onclick = () => showAgentForm(container, null, MODELS_CONFIG);
    container.querySelectorAll('.agent-edit').forEach(btn => {
        btn.onclick = async () => { const a = await api.get(`/agents/${btn.dataset.id}`); showAgentForm(container, a, MODELS_CONFIG); };
    });
    container.querySelectorAll('.agent-del').forEach(btn => {
        btn.onclick = async () => { if (confirm('Agent wirklich löschen?')) { await api.del(`/agents/${btn.dataset.id}`); render(container); } };
    });
    container.querySelectorAll('.agent-perm').forEach(btn => {
        btn.onclick = () => showPermissionModal('agents', btn.dataset.id, render, container);
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

async function showAgentForm(container, agent, modelsConfig) {
    const { tenantId } = getState();
    const isEdit = !!agent;

    let modelOpts = '<option value="">-- Modell wählen --</option>';
    modelsConfig.forEach(group => {
        if (group.items.length > 0) {
            modelOpts += `<optgroup label="${group.group}">`;
            group.items.forEach(i => {
                const sel = agent?.llm_model === i.id ? 'selected' : '';
                modelOpts += `<option value="${i.id}" ${sel}>${i.label} (${i.id})</option>`;
            });
            modelOpts += `</optgroup>`;
        }
    });

    let allSkills = [], agentSkillIds = new Set();
    try {
        allSkills = await api.get(`/skills?tenant_id=${tenantId}`);
        if (isEdit) {
            const as = await api.get(`/agents/${agent.id}/skills`);
            agentSkillIds = new Set(as.map(s => s.id));
        }
    } catch {}

    const skillTagsHtml = allSkills.length > 0
        ? allSkills.map(s => {
            const sel = agentSkillIds.has(s.id) ? ' selected' : '';
            const catLabel = { general: 'Allg.', marketing: 'Mkt.', finance: 'Fin.', tax_legal: 'Tax', communication: 'Komm.', research: 'Rech.', formatting: 'Format.' }[s.category] || s.category;
            return `<div class="skill-tag${sel}" data-skill-id="${s.id}" title="${(s.description||'').substring(0,100)}">${s.name} <span style="font-size:10px;opacity:.6;">${catLabel}</span></div>`;
        }).join('')
        : '<span style="color:var(--text-muted);font-size:12px;">Keine Skills vorhanden. Erstellen Sie Skills im Skills-Bereich.</span>';

    modal(isEdit ? 'Agent bearbeiten' : 'Neuer Agent', `
        <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="a-name" value="${agent?.name || ''}"></div>
        <div class="form-group"><label class="form-label">Beschreibung</label><input class="form-input" id="a-desc" value="${agent?.description || ''}"></div>
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Modell</label>
                <select class="form-select" id="a-model-select">${modelOpts}</select>
                <p style="font-size:11px;color:var(--text-muted);margin-top:6px;">Fehlt ein Modell? In den <strong>Einstellungen</strong> unter <strong>Modelle</strong> hinzufügen.</p>
            </div>
            <div class="form-group"><label class="form-label">Temperatur</label><input class="form-input" id="a-temp" type="number" step="0.1" min="0" max="2" value="${agent?.llm_temperature ?? 0.7}"></div>
        </div>
        <div class="form-group"><label class="form-label">System-Prompt</label><textarea class="form-textarea" id="a-prompt">${agent?.system_prompt || ''}</textarea></div>
        
        <div class="form-group">
            <label class="form-label">Erlaubte Dateiformate</label>
            <div style="font-size:12px; margin-bottom:8px; color:var(--text-muted);">Auf welche Dateien soll dieser Agent reagieren? (Dient zur Steuerung in Workflows)</div>
            <div style="display:flex; flex-wrap:wrap; gap:12px; background:var(--bg-tertiary); padding:12px; border-radius:var(--radius); border:1px solid var(--border);">
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" class="a-file-type" value="pdf" ${(agent?.allowed_files||[]).includes('pdf')?'checked':''}> PDF Dokumente</label>
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" class="a-file-type" value="image" ${(agent?.allowed_files||[]).includes('image')?'checked':''}> Bilder (PNG, JPG)</label>
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" class="a-file-type" value="text" ${(agent?.allowed_files||[]).includes('text')?'checked':''}> Text / Code</label>
            </div>
        </div>

        <div class="form-group">
            <label class="form-label">Erlaubte System-Tools</label>
            <div style="font-size:12px; margin-bottom:8px; color:var(--text-muted);">Welche Kern-Werkzeuge darf dieser Agent nutzen? (submit_final_result & mark_as_irrelevant sind immer aktiv)</div>
            <div style="display:flex; flex-wrap:wrap; gap:12px; background:var(--bg-tertiary); padding:12px; border-radius:var(--radius); border:1px solid var(--border);">
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" class="a-sys-tool" value="execsql" ${(agent?.system_tools||[]).includes('execsql')?'checked':''}> execsql (Freies SQL)</label>
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" class="a-sys-tool" value="get_database_schema" ${(agent?.system_tools||[]).includes('get_database_schema')?'checked':''}> get_database_schema</label>
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" class="a-sys-tool" value="insert_record" ${(agent?.system_tools||[]).includes('insert_record')?'checked':''}> insert_record (Strikte Klassifizierung)</label>
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" class="a-sys-tool" value="set_memory" ${(agent?.system_tools||[]).includes('set_memory')?'checked':''}> set_memory</label>
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" class="a-sys-tool" value="delete_memory" ${(agent?.system_tools||[]).includes('delete_memory')?'checked':''}> delete_memory</label>
            </div>
        </div>

        <div class="form-group"><label class="form-label">Skills zuweisen <span style="font-weight:400;color:var(--text-muted);">(Klick zum Aus-/Abwählen)</span></label><div class="skill-tags" id="a-skills">${skillTagsHtml}</div></div>
        <div class="form-group"><label class="form-label">Aktiv</label><select class="form-select" id="a-active"><option value="true" ${agent?.is_active !== false ? 'selected' : ''}>Ja</option><option value="false" ${agent?.is_active === false ? 'selected' : ''}>Nein</option></select></div>
    `, `<button class="btn btn-primary" id="a-save">Speichern</button><button class="btn btn-ghost" id="a-cancel">Abbrechen</button>`);

    const modelSelect = document.getElementById('a-model-select');

    document.querySelectorAll('#a-skills .skill-tag').forEach(tag => { tag.onclick = () => tag.classList.toggle('selected'); });

    document.getElementById('a-cancel').onclick = closeModal;
    document.getElementById('a-save').onclick = async () => {
        const finalModel = modelSelect.value;
        if (!finalModel) { alert('Bitte ein Modell auswählen.'); return; }

        const data = {
            name: document.getElementById('a-name').value,
            description: document.getElementById('c-desc')?.value || document.getElementById('a-desc').value,
            llm_model: finalModel,
            llm_temperature: parseFloat(document.getElementById('a-temp').value),
            system_prompt: document.getElementById('a-prompt').value,
            is_active: document.getElementById('a-active').value === 'true',
            allowed_files: [...document.querySelectorAll('.a-file-type:checked')].map(cb => cb.value),
            system_tools: [...document.querySelectorAll('.a-sys-tool:checked')].map(cb => cb.value)
        };
        const selectedSkillIds = [...document.querySelectorAll('#a-skills .skill-tag.selected')].map(t => parseInt(t.dataset.skillId));

        if (isEdit) {
            await api.put(`/agents/${agent.id}`, data);
            await api.put(`/agents/${agent.id}/skills`, { skill_ids: selectedSkillIds });
        } else {
            data.tenant_id = tenantId;
            const created = await api.post('/agents', data);
            if (selectedSkillIds.length > 0) {
                await api.put(`/agents/${created.id}/skills`, { skill_ids: selectedSkillIds });
            }
        }
        closeModal();
        render(container);
    };
}











