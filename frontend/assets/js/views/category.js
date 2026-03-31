import { api } from '../api.js';
import { getState } from '../state.js';
import { feedCard, icon, modal, closeModal, bindFeedEvents } from '../components.js';

const PAGE_SIZE = 10;

export function getCategoryView(workflow) {
    const meta = { title: workflow.name, cat: workflow.slug, subtitle: workflow.description || `Alle Vorgänge im Bereich ${workflow.name}`, workflowId: workflow.id };

    let scrollState = null;
    let activeScrollCleanup = null;

    async function loadMore(container) {
        if (!scrollState || scrollState.loading || !scrollState.hasMore) return;
        
        scrollState.loading = true;
        const { tenantId } = getState();
        const loader = container.querySelector('#feed-loader');
        if (loader) loader.style.display = 'block';

        try {
            const data = await api.get(`/feed?tenant_id=${tenantId}&workflow_id=${meta.workflowId}&limit=${PAGE_SIZE}&offset=${scrollState.offset}`);
            const items = data.items || [];
            
            const list = container.querySelector('#feed-list');
            if (list) {
                if (scrollState.offset === 0 && items.length === 0) {
                    list.innerHTML = '<div class="empty-state"><div class="empty-state-text">Keine Einträge in diesem Bereich.</div></div>';
                } else {
                    items.forEach(item => list.insertAdjacentHTML('beforeend', feedCard(item)));
                    bindFeedEvents(list, () => renderView(container));
                }
            }

            scrollState.offset += items.length;
            if (items.length < PAGE_SIZE || scrollState.offset >= data.total) {
                scrollState.hasMore = false;
            }
        } catch(e) {
            console.error('Category loadMore error:', e);
        } finally {
            if (loader) loader.style.display = 'none';
            const end = container.querySelector('#feed-end');
            if (end) end.style.display = (!scrollState.hasMore && scrollState.offset > 0) ? 'block' : 'none';
            const btnCont = container.querySelector('#load-more-container');
            if (btnCont) btnCont.style.display = scrollState.hasMore ? 'block' : 'none';
            scrollState.loading = false;
        }
    }

    async function renderView(container) {
        if (activeScrollCleanup) {
            activeScrollCleanup();
            activeScrollCleanup = null;
        }

        scrollState = {
            offset: 0,
            loading: false,
            hasMore: true,
        };

        const { tenantId } = getState();
        if (!tenantId) { 
            container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Kein Mandant ausgewählt.</div></div>'; 
            return; 
        }

        const dataStats = await api.get(`/feed?tenant_id=${tenantId}&workflow_id=${meta.workflowId}&limit=1`);
        const total = dataStats.total || 0;
        const dataPending = await api.get(`/feed?tenant_id=${tenantId}&workflow_id=${meta.workflowId}&status=pending&limit=1`);
        const pending = dataPending.total || 0;
        const catStats = { total, pending };

        container.innerHTML = `
            <div class="page-header" style="max-width: 720px; margin: 0 auto 24px auto;">
                <div><h1 class="page-title">${meta.title}</h1><p class="page-subtitle">${meta.subtitle}</p></div>
                <button class="btn btn-primary" id="btn-new-task" style="border-radius:24px;">${icon('plus')} Aufgabe</button>
            </div>
            <div class="stats-grid" style="max-width: 720px; margin: 0 auto 24px auto; grid-template-columns: 1fr 1fr;">
                <div class="stat-card accent" style="padding:12px;"><div class="stat-value" style="font-size:20px;">${catStats.total}</div><div class="stat-label" style="font-size:9px;">Vorgänge</div></div>
                <div class="stat-card warning" style="padding:12px;"><div class="stat-value" style="font-size:20px;">${catStats.pending}</div><div class="stat-label" style="font-size:9px;">Offen</div></div>
            </div>
            <div class="feed-list" id="feed-list"></div>
            <div class="feed-loader" id="feed-loader" style="display:none;">Weitere Einträge werden geladen…</div>
            <div id="load-more-container" style="text-align:center; padding:20px; display:none;">
                <button id="btn-load-more" class="btn btn-ghost">Mehr laden</button>
            </div>
            <div class="feed-end" id="feed-end" style="display:none;">Keine weiteren Einträge.</div>`;

        container.querySelector('#btn-load-more')?.addEventListener('click', () => loadMore(container));

        container.querySelector('#btn-new-task')?.addEventListener('click', () => {
            const { tenantId: curId } = getState();
            modal(`Neue Aufgabe in ${meta.title}`, `
                <div class="form-group"><label class="form-label">Anweisung</label>
                <textarea class="form-textarea" id="task-instruction" placeholder="Beschreiben Sie die Aufgabe in natürlicher Sprache..."></textarea></div>
                <div class="form-group">
                    <label class="btn btn-ghost btn-sm" style="cursor:pointer;">
                        ${icon('upload')} Datei anhängen (optional)
                        <input type="file" id="task-file" style="display:none;" accept=".pdf,.png,.jpg,.jpeg">
                    </label>
                    <span id="task-file-name" style="font-size:12px;color:var(--text-secondary);margin-left:8px;">Keine Datei ausgewählt</span>
                </div>
            `, `<button class="btn btn-primary" id="task-submit">Erstellen & Senden</button><button class="btn btn-ghost" id="task-cancel">Abbrechen</button>`);
            
            const fileInput = document.getElementById('task-file');
            const fileSpan = document.getElementById('task-file-name');
            fileInput.onchange = () => {
                fileSpan.textContent = fileInput.files[0] ? fileInput.files[0].name : 'Keine Datei ausgewählt';
                fileSpan.style.color = fileInput.files[0] ? 'var(--accent)' : 'var(--text-secondary)';
            };

            document.getElementById('task-cancel').onclick = closeModal;
            document.getElementById('task-submit').onclick = async () => {
                const instr = document.getElementById('task-instruction').value;
                if (!instr) return;
                
                const btn = document.getElementById('task-submit');
                btn.disabled = true; btn.textContent = 'Wird gesendet...';

                const fd = new FormData();
                fd.append('tenant_id', curId);
                fd.append('instruction', instr);
                fd.append('category', meta.cat);
                fd.append('workflow_id', meta.workflowId);
                if (fileInput.files[0]) fd.append('file', fileInput.files[0]);

                try {
                    await api.upload('/feed/submit-task', fd);
                    closeModal();
                    renderView(container);
                } catch(e) {
                    alert('Fehler: ' + e.message);
                    btn.disabled = false; btn.textContent = 'Erstellen & Senden';
                }
            };
        });

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && scrollState && !scrollState.loading && scrollState.hasMore) {
                loadMore(container);
            }
        }, { threshold: 0.1 });
        const sentinel = container.querySelector('#load-more-container');
        if (sentinel) observer.observe(sentinel);
        activeScrollCleanup = () => observer.disconnect();

        await loadMore(container);

        return () => {
            if (activeScrollCleanup) activeScrollCleanup();
        };
    }

    return {
        title: meta.title,
        render: renderView,
    };
}










