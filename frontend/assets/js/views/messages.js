import { api } from '../api.js';
import { getState, setState } from '../state.js';
import { timeAgo, openFeedDetail, icon } from '../components.js';

export const title = 'Nachrichten';

let showUnreadOnly = true;

export async function render(container) {
    const { tenantId } = getState();
    if (!tenantId) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Kein Mandant ausgewählt.</div></div>';
        return;
    }

    const loadMessages = async () => {
        const data = await api.get(`/messages?tenant_id=${tenantId}&unread_only=${showUnreadOnly}&limit=50`);
        const items = data.items || [];
        renderList(items);
    };

    const renderList = (items) => {
        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Inbox</h1>
                    <p class="page-subtitle">Aktuelle System-Benachrichtigungen und wichtige Ereignisse</p>
                </div>
                <div style="display:flex; gap:12px; align-items:center;">
                    <div style="display:flex; background:var(--bg-tertiary); padding:4px; border-radius:var(--radius); border:1px solid var(--border);">
                        <button class="btn btn-sm ${showUnreadOnly ? 'btn-primary' : 'btn-ghost'}" id="toggle-unread" style="border-radius:6px; font-size:11px;">Ungelesen</button>
                        <button class="btn btn-sm ${!showUnreadOnly ? 'btn-primary' : 'btn-ghost'}" id="toggle-all" style="border-radius:6px; font-size:11px;">Alle</button>
                    </div>
                    <button class="btn btn-ghost" id="btn-mark-all" title="Alle als gelesen markieren">${icon('check')} Alle gelesen</button>
                </div>
            </div>

            <div class="msg-grid">
                ${items.length ? items.map(m => `
                    <div class="msg-card ${m.is_read ? '' : 'unread'} ${m.priority >= 7 ? 'high-priority' : ''}" 
                         data-id="${m.id}" data-feed="${m.feed_item_id || ''}">
                        <div class="msg-card-icon">
                            ${m.feed_item_id ? icon('zap') : icon('bell')}
                        </div>
                        <div class="msg-card-content">
                            <div class="msg-card-header">
                                <span class="msg-card-title">${m.title}</span>
                                <span class="msg-card-time">${timeAgo(m.created_at)}</span>
                            </div>
                            <div class="msg-card-body">${m.body || ''}</div>
                            <div class="msg-card-actions">
                                ${m.feed_item_id ? `<button class="btn btn-primary btn-sm btn-view-task" data-feed="${m.feed_item_id}">Zum Vorgang</button>` : ''}
                                ${!m.is_read ? `<button class="btn btn-ghost btn-sm btn-mark-read" data-id="${m.id}">${icon('check')} Gelesen</button>` : ''}
                            </div>
                        </div>
                    </div>
                `).join('') : `
                    <div class="empty-state">
                        <div class="empty-state-icon">${icon('mail')}</div>
                        <div class="empty-state-text">Posteingang ist leer.<br><small style="color:var(--text-muted)">Alle wichtigen Aufgaben wurden bereits bearbeitet.</small></div>
                    </div>
                `}
            </div>
        `;

        // Event: Toggle Filter
        container.querySelector('#toggle-unread').onclick = () => { showUnreadOnly = true; loadMessages(); };
        container.querySelector('#toggle-all').onclick = () => { showUnreadOnly = false; loadMessages(); };

        // Event: Mark All Read
        container.querySelector('#btn-mark-all').onclick = async () => {
            await api.put(`/messages/read-all?tenant_id=${tenantId}`);
            setState({ unreadCount: 0 });
            loadMessages();
        };

        // Click on Card (Open Task or Mark Read)
        container.querySelectorAll('.msg-card').forEach(card => {
            card.onclick = (e) => {
                if (e.target.closest('.btn')) return;
                const feedId = card.dataset.feed;
                if (feedId) {
                    openFeedDetail(feedId, () => loadMessages());
                } else {
                    markSingleRead(card.dataset.id);
                }
            };
        });

        // Specific Button Actions
        container.querySelectorAll('.btn-view-task').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                openFeedDetail(btn.dataset.feed, () => loadMessages());
            };
        });

        container.querySelectorAll('.btn-mark-read').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                markSingleRead(btn.dataset.id);
            };
        });
    };

    const markSingleRead = async (msgId) => {
        await api.put(`/messages/${msgId}/read`);
        const s = getState();
        setState({ unreadCount: Math.max(0, (s.unreadCount || 1) - 1) });
        
        if (showUnreadOnly) {
            // Aus der Liste entfernen für "Inbox Zero" Effekt
            const card = container.querySelector(`.msg-card[data-id="${msgId}"]`);
            if (card) {
                card.style.opacity = '0';
                card.style.transform = 'translateX(20px)';
                setTimeout(() => loadMessages(), 200);
            }
        } else {
            loadMessages();
        }
    };

    await loadMessages();
}



