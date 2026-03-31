import { api } from '../api.js';
import { getState } from '../state.js';
import { icon, modal, closeModal } from '../components.js';

export const title = 'Ziele';

export async function render(container) {
    const { tenantId } = getState();
    if (!tenantId) { container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Kein Mandant ausgewählt.</div></div>'; return; }

    const [goals, agents] = await Promise.all([
        api.get(`/goals?tenant_id=${tenantId}`),
        api.get(`/agents?tenant_id=${tenantId}`)
    ]);

    container.innerHTML = `
        <div class="page-header">
            <div><h1 class="page-title">Ziele & Strategien</h1><p class="page-subtitle">Übergreifende Missionen und Checklisten für Administrative Agenten</p></div>
            <button class="btn btn-primary" id="btn-new-goal">${icon('plus')} Neues Ziel</button>
        </div>
        <div class="card"><table>
            <thead><tr><th>Ziel / Name</th><th>Status</th><th>Fortschritt (Checkliste)</th><th>Verantwortlicher Agent</th><th>Aktionen</th></tr></thead>
            <tbody>
                ${goals.map(g => {
                    const agent = agents.find(a => a.id === g.agent_id);
                    const agentName = agent ? agent.name : '<span style="color:var(--text-muted)">System-Standard</span>';
                    const ms = g.milestones_json || [];
                    const done = ms.filter(m => m.status === 'done').length;
                    const total = ms.length;
                    const progress = total > 0 ? `${done} / ${total}` : 'Keine';
                    
                    return `<tr>
                    <td><strong>${g.name}</strong><br><small style="color:var(--text-muted)">${g.description || ''}</small></td>
                    <td><span class="tag ${g.status === 'active' ? 'tag-active' : 'tag-inactive'}">${g.status === 'active' ? 'Aktiv' : g.status}</span></td>
                    <td>${progress}</td>
                    <td>${agentName}</td>
                    <td>
                        <button class="btn btn-primary btn-sm g-eval" data-id="${g.id}">Evaluieren (Agent starten)</button>
                        <button class="btn btn-ghost btn-sm g-edit" data-id="${g.id}">Details</button>
                        <button class="btn btn-ghost btn-sm g-del" data-id="${g.id}" style="color:var(--danger)">${icon('x')}</button>
                    </td>
                </tr>`;
                }).join('')}
            </tbody>
        </table></div>
        ${goals.length === 0 ? '<div class="empty-state"><div class="empty-state-text">Legen Sie strategische Ziele fest, die Ihre Agenten fortlaufend verfolgen sollen.</div></div>' : ''}
    `;

    container.querySelector('#btn-new-goal').onclick = () => showGoalForm(container, null, agents);
    container.querySelectorAll('.g-edit').forEach(btn => {
        btn.onclick = () => showGoalForm(container, goals.find(x => x.id == btn.dataset.id), agents);
    });
    container.querySelectorAll('.g-del').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Ziel wirklich löschen?')) {
                await api.del(`/goals/${btn.dataset.id}`);
                render(container);
            }
        };
    });
    container.querySelectorAll('.g-eval').forEach(btn => {
        btn.onclick = async () => {
            btn.disabled = true;
            btn.textContent = 'Startet...';
            try {
                await api.post(`/goals/${btn.dataset.id}/evaluate`);
                alert('Der Agent wurde gestartet! Sie finden die Ergebnisse seiner Überprüfung gleich im Decision-Feed.');
                window.location.hash = '#/dashboard';
            } catch(e) {
                alert('Fehler: ' + e.message);
                btn.disabled = false;
                btn.textContent = 'Evaluieren';
            }
        };
    });
}

function showGoalForm(container, goal, agents) {
    const { tenantId } = getState();
    const isEdit = !!goal;

    const agentOpts = agents.map(a => `<option value="${a.id}" ${goal?.agent_id === a.id ? 'selected' : ''}>${a.name}</option>`).join('');
    
    // Einfache Darstellung der Checkliste als JSON (in einer realen App könnte man hier einen dynamischen Builder bauen)
    const msJson = JSON.stringify(goal?.milestones_json || [], null, 2);

    modal(isEdit ? 'Ziel & Strategie' : 'Neues Ziel', `
        <div class="form-row">
            <div class="form-group"><label class="form-label">Titel</label><input class="form-input" id="g-name" value="${goal?.name || ''}"></div>
            <div class="form-group"><label class="form-label">Verantwortlicher Agent</label>
                <select class="form-select" id="g-agent"><option value="">-- Standard Agent --</option>${agentOpts}</select>
            </div>
        </div>
        <div class="form-group"><label class="form-label">Kurzbeschreibung</label><input class="form-input" id="g-desc" value="${goal?.description || ''}"></div>
        
        <div class="form-group">
            <label class="form-label">Strategie-Vorgabe (Prompt)</label>
            <textarea class="form-textarea" id="g-strategy" style="min-height:120px;" placeholder="Wie soll der Agent vorgehen? Welche Richtlinien gelten für dieses Ziel?">${goal?.strategy_prompt || ''}</textarea>
        </div>
        
        <div class="form-group">
            <label class="form-label">Checkliste / Meilensteine (JSON)</label>
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">Der Agent pflegt dieses Feld selbstständig als sein Langzeitgedächtnis über den Fortschritt. Status: open, in_progress, done.</div>
            <textarea class="form-textarea" id="g-milestones" style="font-family:monospace; min-height:200px;">${msJson}</textarea>
        </div>
        
        <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="g-status" style="width:200px;">
                <option value="active" ${goal?.status==='active'?'selected':''}>Aktiv</option>
                <option value="paused" ${goal?.status==='paused'?'selected':''}>Pausiert</option>
                <option value="completed" ${goal?.status==='completed'?'selected':''}>Abgeschlossen</option>
            </select>
        </div>
    `, `<button class="btn btn-primary" id="g-save">Speichern</button><button class="btn btn-ghost" id="g-cancel">Abbrechen</button>`, 'modal-lg');

    document.getElementById('g-cancel').onclick = closeModal;
    document.getElementById('g-save').onclick = async () => {
        let msData = [];
        try { msData = JSON.parse(document.getElementById('g-milestones').value); } 
        catch(e) { alert('Checkliste muss gültiges JSON sein.'); return; }

        const data = {
            name: document.getElementById('g-name').value,
            description: document.getElementById('g-desc').value,
            strategy_prompt: document.getElementById('g-strategy').value,
            status: document.getElementById('g-status').value,
            agent_id: document.getElementById('g-agent').value ? parseInt(document.getElementById('g-agent').value) : null,
            milestones_json: msData
        };

        if (isEdit) {
            await api.put(`/goals/${goal.id}`, data);
        } else {
            data.tenant_id = tenantId;
            await api.post('/goals', data);
        }
        closeModal();
        render(container);
    };
}





