import { api } from '../api.js';
import { getState } from '../state.js';
import { icon, modal, closeModal } from '../components.js';

export const title = 'Agent-Gedächtnis';

export async function render(container) {
    const { tenantId } = getState();
    if (!tenantId) { container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Kein Mandant ausgewählt.</div></div>'; return; }

    const memories = await api.get(`/memory/agent-memories?tenant_id=${tenantId}`);

    container.innerHTML = `
        <div class="page-header">
            <div><h1 class="page-title">Agent-Gedächtnis</h1><p class="page-subtitle">Kontextuelles Wissen und Erinnerungen der KI-Agenten</p></div>
            <button class="btn btn-primary" id="btn-new-memory">${icon('plus')} Neue Erinnerung</button>
        </div>
        <div class="card"><table>
            <thead><tr><th>Schlüssel (Key)</th><th>Inhalt (Wert)</th><th>Bezug / Kontext</th><th>Zuletzt geändert</th><th>Aktionen</th></tr></thead>
            <tbody>
                ${memories.map(m => {
                    const ctx = m.context_json || {};
                    const desc = ctx.description || 'Allgemein';
                    const refs = [];
                    if (ctx.workflow_id) refs.push(`WF#${ctx.workflow_id}`);
                    if (ctx.document_id) refs.push(`Doc#${ctx.document_id}`);
                    const refStr = refs.length ? `<br><small style="color:var(--text-muted)">Refs: ${refs.join(', ')}</small>` : '';

                    return `<tr>
                    <td><strong>${m.key}</strong></td>
                    <td style="max-width:350px; white-space:pre-wrap;">${m.value}</td>
                    <td><span style="font-weight:600;color:var(--accent);">${desc}</span>${refStr}</td>
                    <td>${new Date(m.updated_at).toLocaleString('de-DE')}</td>
                    <td>
                        <button class="btn btn-ghost btn-sm mem-edit" data-id="${m.id}">Bearbeiten</button>
                        <button class="btn btn-ghost btn-sm mem-del" data-id="${m.id}" style="color:var(--danger)">Löschen</button>
                    </td>
                </tr>`;
                }).join('')}
            </tbody>
        </table></div>
        ${memories.length === 0 ? '<div class="empty-state"><div class="empty-state-text">Das System-Gedächtnis ist leer. Der Agent kann sich Dinge merken, indem du ihn anweist, etwas in seinem Gedächtnis zu speichern.</div></div>' : ''}
    `;

    container.querySelector('#btn-new-memory').onclick = () => showForm(container, null);
    container.querySelectorAll('.mem-edit').forEach(btn => {
        btn.onclick = () => {
            const m = memories.find(x => x.id == btn.dataset.id);
            showForm(container, m);
        };
    });
    container.querySelectorAll('.mem-del').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Erinnerung wirklich löschen?')) {
                await api.del(`/memory/agent-memories/${btn.dataset.id}`);
                render(container);
            }
        };
    });
}

function showForm(container, mem) {
    const { tenantId } = getState();
    const isEdit = !!mem;

    modal(isEdit ? 'Erinnerung bearbeiten' : 'Neue Erinnerung', `
        <div class="form-group">
            <label class="form-label">Schlüssel (Key)</label>
            <input class="form-input" id="mem-key" value="${mem?.key || ''}" placeholder="z. B. LIEFERANT_MUELLER" style="text-transform:uppercase;">
            <small style="color:var(--text-muted);display:block;margin-top:4px;">Ein eindeutiger, großgeschriebener Begriff.</small>
        </div>
        <div class="form-group">
            <label class="form-label">Kontext / Bezug</label>
            <input class="form-input" id="mem-ctx-desc" value="${mem?.context_json?.description || ''}" placeholder="z. B. Rechnungen von Lieferant XY">
            <small style="color:var(--text-muted);display:block;margin-top:4px;">Hilft dem Agenten einzuordnen, wann diese Erinnerung relevant ist.</small>
        </div>
        <div class="form-group">
            <label class="form-label">Inhalt (Value)</label>
            <textarea class="form-textarea" id="mem-value" style="min-height:100px;">${mem?.value || ''}</textarea>
            <small style="color:var(--text-muted);display:block;margin-top:4px;">Die Information, die der Agent für diesen Kontext immer parat haben soll.</small>
        </div>
    `, `<button class="btn btn-primary" id="mem-save">Speichern</button><button class="btn btn-ghost" id="mem-cancel">Abbrechen</button>`);

    document.getElementById('mem-cancel').onclick = closeModal;
    document.getElementById('mem-save').onclick = async () => {
        const key = document.getElementById('mem-key').value.trim().toUpperCase();
        const desc = document.getElementById('mem-ctx-desc').value.trim();
        const val = document.getElementById('mem-value').value.trim();
        if (!key || !val) { alert('Key und Value Felder sind erforderlich.'); return; }

        const context_json = mem?.context_json || {};
        if (desc) {
            context_json.description = desc;
        } else {
            delete context_json.description;
        }

        try {
            if (isEdit) {
                await api.put(`/memory/agent-memories/${mem.id}`, { key, value: val, context_json });
            } else {
                await api.post(`/memory/agent-memories`, { tenant_id: tenantId, key, value: val, context_json });
            }
            closeModal();
            render(container);
        } catch(e) {
            alert('Fehler beim Speichern: ' + e.message);
        }
    };
}











