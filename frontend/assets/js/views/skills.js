import { api } from '../api.js';
import { getState } from '../state.js';
import { icon, modal, closeModal } from '../components.js';

export const title = 'Skills';

const CATEGORIES = [
    { value: 'general', label: 'Allgemein' },
    { value: 'marketing', label: 'Marketing & Vertrieb' },
    { value: 'finance', label: 'Finance & Buchhaltung' },
    { value: 'tax_legal', label: 'Steuer & Legal' },
    { value: 'communication', label: 'Kommunikation' },
    { value: 'research', label: 'Recherche' },
    { value: 'formatting', label: 'Formatierung & CI' },
];

export async function render(container) {
    const { tenantId } = getState();
    if (!tenantId) { container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Kein Mandant ausgewählt.</div></div>'; return; }

    const skills = await api.get(`/skills?tenant_id=${tenantId}`);

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title">Agenten-Skills</h1>
                <p class="page-subtitle">Prompt-Snippets die Agenten als zusätzliche Fähigkeiten zugewiesen werden können</p>
            </div>
            <div style="display:flex; gap:8px;">
                <button class="btn btn-ghost" id="btn-back-agents">← Zurück zu Agenten</button>
                <button class="btn btn-primary" id="btn-new-skill">${icon('plus')} Neuer Skill</button>
            </div>
        </div>
        <div class="card"><table>
            <thead><tr><th>Name</th><th>Kategorie</th><th>Status</th><th>Inhalt (Vorschau)</th><th>Aktionen</th></tr></thead>
            <tbody>
                ${skills.map(s => `<tr>
                    <td><strong>${s.name}</strong><br><small style="color:var(--text-muted)">${s.description || ''}</small></td>
                    <td>${CATEGORIES.find(c => c.value === s.category)?.label || s.category}</td>
                    <td><span class="tag ${s.is_active ? 'tag-active' : 'tag-inactive'}">${s.is_active ? 'Aktiv' : 'Inaktiv'}</span></td>
                    <td style="max-width:300px;"><code style="font-size:11px;color:var(--text-muted);display:block;max-height:40px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(s.content || '').substring(0, 120)}</code></td>
                    <td>
                        <button class="btn btn-ghost btn-sm sk-edit" data-id="${s.id}">Bearbeiten</button>
                        <button class="btn btn-ghost btn-sm sk-del" data-id="${s.id}">Löschen</button>
                    </td>
                </tr>`).join('')}
            </tbody>
        </table></div>
        ${skills.length === 0 ? '<div class="empty-state"><div class="empty-state-text">Noch keine Skills erstellt.</div></div>' : ''}`;

    container.querySelector('#btn-back-agents').onclick = () => window.location.hash = '#/agents';
    container.querySelector('#btn-new-skill').onclick = () => showForm(container, null);
    
    container.querySelectorAll('.sk-edit').forEach(btn => {
        btn.onclick = async () => { const s = await api.get(`/skills/${btn.dataset.id}`); showForm(container, s); };
    });
    
    container.querySelectorAll('.sk-del').forEach(btn => {
        btn.onclick = async () => { if (confirm('Skill löschen?')) { await api.del(`/skills/${btn.dataset.id}`); render(container); } };
    });
}

function showForm(container, skill) {
    const { tenantId } = getState();
    const isEdit = !!skill;
    const catOpts = CATEGORIES.map(c => `<option value="${c.value}" ${skill?.category === c.value ? 'selected' : ''}>${c.label}</option>`).join('');

    modal(isEdit ? 'Skill bearbeiten' : 'Neuer Skill', `
        <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="sk-name" value="${skill?.name || ''}" placeholder="z. B. Social-Media-Beitragsformat"></div>
        <div class="form-group"><label class="form-label">Beschreibung</label><input class="form-input" id="sk-desc" value="${skill?.description || ''}" placeholder="Kurze Beschreibung des Skills"></div>
        <div class="form-row">
            <div class="form-group"><label class="form-label">Kategorie</label><select class="form-select" id="sk-cat">${catOpts}</select></div>
            <div class="form-group"><label class="form-label">Aktiv</label><select class="form-select" id="sk-active"><option value="true" ${skill?.is_active !== false ? 'selected' : ''}>Ja</option><option value="false" ${skill?.is_active === false ? 'selected' : ''}>Nein</option></select></div>
        </div>
        <div class="form-group"><label class="form-label">Skill-Inhalt (Prompt-Snippet)</label>
            <textarea class="form-textarea" id="sk-content" style="min-height:200px;font-family:monospace;font-size:12px;" placeholder="Der Text, der dem Agenten als zusätzlicher Kontext nach dem System-Prompt bereitgestellt wird…">${skill?.content || ''}</textarea>
        </div>
    `, `<button class="btn btn-primary" id="sk-save">Speichern</button><button class="btn btn-ghost" id="sk-cancel">Abbrechen</button>`);

    document.getElementById('sk-cancel').onclick = closeModal;
    document.getElementById('sk-save').onclick = async () => {
        const data = {
            name: document.getElementById('sk-name').value,
            description: document.getElementById('sk-desc').value,
            category: document.getElementById('sk-cat').value,
            is_active: document.getElementById('sk-active').value === 'true',
            content: document.getElementById('sk-content').value,
        };
        if (!data.name || !data.content) { alert('Name und Inhalt sind Pflichtfelder.'); return; }
        if (isEdit) { await api.put(`/skills/${skill.id}`, data); }
        else { data.tenant_id = tenantId; await api.post('/skills', data); }
        closeModal();
        render(container);
    };
}







