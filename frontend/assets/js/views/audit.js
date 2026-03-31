import { api } from '../api.js';
import { getState } from '../state.js';
import { timeAgo, icon } from '../components.js';

export const title = 'Audit-Trails';

export async function render(container) {
    const { tenantId } = getState();
    if (!tenantId) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Kein Mandant ausgewählt.</div></div>';
        return;
    }

    let state = {
        currentPage: 1,
        pageSize: 50,
        total: 0,
        loading: false,
        filters: {
            type: '',
            workflowId: '',
            start: ''
        }
    };

    let workflows = [];
    try { workflows = await api.get(`/workflows?tenant_id=${tenantId}`); } catch(e) { console.error(e); }

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title">Audit-Trails</h1>
                <p class="page-subtitle">Lückenlose Dokumentation aller Aktionen</p>
            </div>
            <div style="display:flex; gap:8px;">
                <button class="btn btn-ghost" id="btn-export-audit">${icon('upload')} CSV Export</button>
            </div>
        </div>
        
        <div class="toolbar">
            <div class="form-group" style="margin-bottom:0">
                <label class="form-label" style="font-size:10px;">Typ</label>
                <select class="form-select" id="audit-filter-type">
                    <option value="">Alle</option>
                    <option value="agent">Agent</option>
                    <option value="document">Dokument</option>
                    <option value="feed_item">Feed</option>
                    <option value="workflow">Workflow</option>
                </select>
            </div>
            <div class="form-group" style="margin-bottom:0">
                <label class="form-label" style="font-size:10px;">Workflow</label>
                <select class="form-select" id="audit-filter-workflow">
                    <option value="">Alle</option>
                    ${workflows.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group" style="margin-bottom:0">
                <label class="form-label" style="font-size:10px;">Von</label>
                <input type="datetime-local" class="form-input" id="audit-filter-start">
            </div>
            <div style="display:flex; align-items:flex-end;">
                <button class="btn btn-primary" id="btn-audit-apply" style="height:38px;">Filtern</button>
            </div>
        </div>

        <div class="card">
            <div class="card-body" style="padding:0;" id="audit-list"></div>
            <div class="pagination-bar">
                <button class="btn btn-ghost btn-sm" id="btn-audit-prev">← Zurück</button>
                <span class="page-info" id="audit-page-info">Seite 1</span>
                <button class="btn btn-ghost btn-sm" id="btn-audit-next">Weiter →</button>
            </div>
        </div>
    `;

    const listContainer = container.querySelector('#audit-list');
    const pageInfo = container.querySelector('#audit-page-info');
    const btnPrev = container.querySelector('#btn-audit-prev');
    const btnNext = container.querySelector('#btn-audit-next');

    const updateUI = () => {
        const totalPages = Math.ceil(state.total / state.pageSize) || 1;
        pageInfo.textContent = `Seite ${state.currentPage} von ${totalPages}`;
        btnPrev.disabled = state.currentPage <= 1 || state.loading;
        btnNext.disabled = state.currentPage >= totalPages || state.loading;
    };

    const loadPage = async (page) => {
        if (state.loading) return;
        state.loading = true;
        state.currentPage = page;
        updateUI();

        listContainer.innerHTML = '<div class="feed-loader" style="padding:40px;">Daten werden geladen...</div>';

        try {
            const offset = (state.currentPage - 1) * state.pageSize;
            let url = `/audit?tenant_id=${tenantId}&limit=${state.pageSize}&offset=${offset}`;
            
            if (state.filters.type) url += `&entity_type=${state.filters.type}`;
            if (state.filters.workflowId) url += `&workflow_id=${state.filters.workflowId}`;
            if (state.filters.start) {
                url += `&start_date=${new Date(state.filters.start).toISOString()}`;
            }

            const data = await api.get(url);
            state.total = data.total || 0;
            const items = data.items || [];

            if (items.length === 0) {
                listContainer.innerHTML = '<div class="empty-state"><div class="empty-state-text">Keine Log-Einträge gefunden.</div></div>';
            } else {
                listContainer.innerHTML = items.map(item => auditItemTemplate(item)).join('');
            }
        } catch (e) {
            listContainer.innerHTML = `<div class="empty-state" style="color:var(--danger)">Fehler: ${e.message}</div>`;
        } finally {
            state.loading = false;
            updateUI();
            // Scroll to top of the card
            listContainer.closest('.card').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    // Events
    container.querySelector('#btn-audit-apply').onclick = () => {
        state.filters.type = container.querySelector('#audit-filter-type').value;
        state.filters.workflowId = container.querySelector('#audit-filter-workflow').value;
        state.filters.start = container.querySelector('#audit-filter-start').value;
        loadPage(1);
    };

    btnPrev.onclick = () => {
        if (state.currentPage > 1) loadPage(state.currentPage - 1);
    };

    btnNext.onclick = () => {
        const totalPages = Math.ceil(state.total / state.pageSize);
        if (state.currentPage < totalPages) loadPage(state.currentPage + 1);
    };

    container.querySelector('#btn-export-audit').onclick = () => {
        let url = `/api/v1/audit/export?tenant_id=${tenantId}`;
        if (state.filters.type) url += `&entity_type=${state.filters.type}`;
        if (state.filters.workflowId) url += `&workflow_id=${state.filters.workflowId}`;
        window.open(url, '_blank');
    };

    // Initial load
    await loadPage(1);
}

function auditItemTemplate(a) {
    const detailsStr = a.details_json && Object.keys(a.details_json).length > 0
        ? JSON.stringify(a.details_json, null, 2) : '';
    const details = detailsStr ? `<div class="audit-details">${escapeHtml(detailsStr)}</div>` : '';
    
    return `<div class="audit-item" style="padding:16px 20px; border-bottom:1px solid var(--border);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span>
                <span class="audit-action">${escapeHtml(a.action)}</span> 
                <span style="color:var(--text-muted); font-size:11px; margin-left:8px;">
                    ${a.entity_type ? `[${a.entity_type}${a.entity_id ? '#'+a.entity_id : ''}]` : ''}
                    ${a.workflow_id ? `<span style="color:var(--accent);"> (WF#${a.workflow_id})</span>` : ''}
                </span>
            </span>
            <span class="audit-time">${timeAgo(a.timestamp)}</span>
        </div>
        ${details}
    </div>`;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}









