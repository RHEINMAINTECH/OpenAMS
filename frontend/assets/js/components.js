import { getState } from './state.js';

export function icon(name) {
    const icons = {
        home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
        mail: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
        megaphone: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',
        wallet: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>',
        scale: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v18"/><path d="M7 6h10"/><path d="M7 6l-3 4"/><path d="M17 6l3 4"/><path d="M4 10v2"/><path d="M20 10v2"/><path d="M2.5 12h7"/><path d="M14.5 12h7"/><path d="M3.5 12a3.5 3.5 0 0 0 7 0"/><path d="M13.5 12a3.5 3.5 0 0 0 7 0"/><path d="M9 21h6"/></svg>',
        puzzle: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.315 8.685a.98.98 0 0 1 .837-.276c.47.07.802.48.968.925a2.501 2.501 0 1 0 3.214-3.214c-.446-.166-.855-.497-.925-.968a.979.979 0 0 1 .276-.837l1.61-1.61a2.404 2.404 0 0 1 1.705-.706c.618 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02z"/></svg>',
        bot: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>',
        workflow: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>',
        database: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
        shield: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
        settings: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
        bell: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
        plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
        check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
        x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
        upload: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>',
        layers: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
        zap: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
        tool: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
        brain: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>',
        trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>',
        brand: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
        menu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>',
        trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>',
    };
    return icons[name] || '';
}

export function renderSidebar(currentRoute, workflows = [], unreadCount = 0, cockpits = []) {
    const menuItems = (workflows || []).filter(w => w.has_menu_entry).map(w => ({
        route: `workflow_${w.slug}`,
        label: w.name,
        ic: 'layers'
    }));

    const nav = [
        {
            section: 'Übersicht', items: [
                { route: 'dashboard', label: 'Feed', ic: 'home' },
                { route: 'cockpits', label: 'Cockpits', ic: 'layers' },
                { route: 'messages', label: 'Nachrichten', ic: 'mail', badge: unreadCount || null },
            ]
        },
        { section: 'Workflows', items: menuItems },
        {
            section: 'System', items: [
                { route: 'modules', label: 'Module', ic: 'puzzle' },
                { route: 'agents', label: 'Agenten', ic: 'bot' },
                { route: 'workflows', label: 'Workflows', ic: 'workflow' },
                { route: 'data_structures', label: 'Datenstrukturen', ic: 'database' },
                { route: 'audit', label: 'Audit-Trails', ic: 'shield' },
                { route: 'system_werkzeuge', label: 'Systemwerkzeuge', ic: 'tool' },
                { route: 'settings', label: 'Einstellungen', ic: 'settings' },
            ]
        },
    ];

    let html = `
        <div class="sidebar-brand">
            <div class="logo">${icon('brand')}</div>
            <div class="brand-info">
                <span class="brand-title">OpenAMS</span>
                <span class="brand-subtitle">Agentic Management System</span>
            </div>
        </div>
        <nav class="sidebar-nav">`;

    for (const sec of nav) {
        html += `<div class="nav-section"><div class="nav-section-title">${sec.section}</div>`;
        for (const item of sec.items) {
            const active = currentRoute === item.route ? ' active' : '';
            const badge = item.badge ? `<span class="badge">${item.badge}</span>` : '';
            html += `<div class="nav-item${active}" data-route="${item.route}">
                <span class="nav-icon">${icon(item.ic)}</span>${item.label}${badge}</div>`;
        }
        html += '</div>';
    }
    html += '</nav>';
    return html;
}

export function renderHeader(title, tenants, currentTenantId) {
    const opts = tenants.map(t =>
        `<option value="${t.id}" ${t.id === currentTenantId ? 'selected' : ''}>${t.name}</option>`
    ).join('');
    return `
        <div class="header-left">
            <button class="header-btn" id="sidebar-toggle" title="Menü umschalten">${icon('menu')}</button>
        </div>
        <div class="header-right">
            <select id="tenant-select" class="header-tenant-select">${opts}</select>
            <button class="header-btn" id="notif-btn">${icon('bell')}<span class="notif-dot" id="notif-dot" style="display:none"></span></button>
        </div>`;
}

export function feedCard(item) {
    const { workflows } = getState();
    const wf = (workflows ||[]).find(w => w.id === item.workflow_id || w.slug === item.category);
    const pClass = item.priority >= 7 ? 'p-high' : item.priority >= 4 ? 'p-medium' : 'p-low';
    const catClass = `cat-${item.category}`;
    const sClass = `s-${item.status}`;
    const catLabel = wf ? wf.name : (item.category || 'Allgemein');
    
    const now = new Date();
    const createdDate = new Date(item.created_at);
    const diffMs = now - createdDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    let timeStr = diffMins < 60 ? `${diffMins}m` : diffHours < 24 ? `${diffHours}h` : createdDate.toLocaleDateString('de-DE', {day:'2-digit', month:'short'});

    let displayDesc = (item.description || '').trim();
    if (!displayDesc || displayDesc === '{}' || displayDesc === '{ }') {
        if (item.trace_steps && item.trace_steps.length > 0) {
            const lastStep = item.trace_steps[item.trace_steps.length - 1];
            displayDesc = lastStep.thought || lastStep.next_step || '';
        }
    }

    const actions = item.status === 'pending' ? `
        <button class="btn btn-primary feed-reply" data-id="${item.id}" style="border-radius:20px; padding:6px 14px;">${icon('bot')} Antworten</button>
        <button class="btn btn-success feed-approve" data-id="${item.id}" style="border-radius:20px; padding:6px 14px;">${icon('check')} OK</button>
        <button class="btn btn-ghost feed-reject" data-id="${item.id}" style="border-radius:20px; padding:6px 10px; color:var(--danger); border-color:transparent;">${icon('x')}</button>`
        : item.status === 'processing' ? `
        <div style="display:flex; align-items:center; gap:12px; width:100%;">
            <span style="font-size:13px;color:var(--accent);font-weight:600;display:flex;align-items:center;gap:6px;">
                <span class="feed-status s-processing" style="width:8px;height:8px;border-radius:50%;display:inline-block;"></span>
                Agent bearbeitet...
            </span>
            <button class="btn btn-ghost btn-sm feed-cancel" data-id="${item.id}" style="color:var(--danger); margin-left:auto;">Stoppen</button>
        </div>` : '';
    
    const parentTag = item.parent_id ? `<span style="font-size:10px; color:var(--accent); background:var(--accent-bg); padding:2px 6px; border-radius:10px; font-weight:600;">RE: #${item.parent_id}</span>` : '';
    const feedbackBlock = item.feedback_text ? `<div style="font-size:13px; color:var(--warning); margin-bottom:20px; padding:14px; background:rgba(245,158,11,0.15); border-radius:12px; border:1px solid rgba(245,158,11,0.3); border-left:4px solid var(--warning);"><strong>Admin:</strong> ${item.feedback_text}</div>` : '';
    const sLabel = { pending: 'Neu', approved: 'Erledigt', rejected: 'Abgelehnt', deferred: 'Wartet', archived: 'Archiv', processing: 'Läuft', replied: 'Feedback' }[item.status] || item.status;
    
    // Vermeide doppelte Anzeige wenn Beschreibung und Empfehlung identisch sind
    const recText = (item.action_data_json && item.action_data_json.recommended_action) || '';
    const recAction = (recText && recText !== displayDesc)
        ? `<div style="margin-bottom:16px; padding:16px; background:var(--info-bg); border-radius:12px; border-left:4px solid var(--info); border:1px solid rgba(59,130,246,0.2);">
            <div style="color:var(--info); font-size:10px; font-weight:800; text-transform:uppercase; margin-bottom:6px; letter-spacing:0.05em;">Handlungsempfehlung</div>
            <div style="font-size:14px; color:var(--text-primary); line-height:1.5;">${renderMarkdown(shorten(recText, 180))}</div>
           </div>`
        : '';
        
    const proposedApp = (item.action_data_json && item.action_data_json.proposed_app)
        ? `<div style="margin-bottom:16px; padding:14px; background:var(--accent-bg); border-radius:12px; border-left:4px solid var(--accent);">
            <div style="color:var(--accent); font-size:11px; font-weight:800; text-transform:uppercase; margin-bottom:4px; letter-spacing:0.05em;">App-Aktion vorgeschlagen</div>
            <div style="font-size:14px; color:var(--text-primary); line-height:1.4;">
                <strong>${item.action_data_json.proposed_app.slug}</strong> ist bereit zur Ausführung.
            </div>
           </div>`
        : '';

    return `
    <div class="feed-card" data-id="${item.id}" data-status="${item.status}">
        <div class="feed-card-top">
            <span class="feed-priority ${pClass}"></span>
            <span class="feed-category ${catClass}" style="font-size:11px; font-weight:700;">${catLabel.toUpperCase()}</span>
            ${parentTag}
            <span style="margin-left:auto; font-size:12px; color:var(--text-muted); font-weight:500;">${timeStr}</span>
        </div>
        
        <div class="feed-title">${item.title}</div>
        
        ${feedbackBlock}
        ${recAction}
        ${proposedApp}
        
        <div class="feed-desc">${renderMarkdown(shorten(displayDesc, 250))}</div>
        
        <div class="feed-actions">
            ${actions}
            ${!actions && !proposedApp ? `<span class="feed-status ${sClass}" style="font-size:11px; padding:4px 10px; border-radius:20px;">${sLabel.toUpperCase()}</span>` : ''}
            ${proposedApp ? `<button class="btn btn-primary btn-sm feed-open-app" data-id="${item.id}" style="border-radius:20px; padding:6px 14px;">${icon('zap')} App öffnen</button>` : ''}
            <button class="btn btn-ghost btn-sm feed-archive" data-id="${item.id}" style="margin-left:auto; border:none; opacity:0.5;" title="Archivieren">${icon('upload')}</button>
        </div>
    </div>`;
}

export function modal(title, bodyHtml, footerHtml = '', sizeClass = '') {
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="modal-overlay" id="modal-overlay">
        <div class="modal ${sizeClass}">
            <div class="modal-header">
                <span class="modal-title">${title}</span>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>
            <div class="modal-body">${bodyHtml}</div>
            ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
        </div>
    </div>`;
    document.getElementById('modal-close').onclick = closeModal;
    document.getElementById('modal-overlay').onclick = (e) => {
        if (e.target === e.currentTarget) closeModal();
    };
}

export function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
}

export function bindFeedEvents(container, refreshCallback) {
    container.querySelectorAll('.feed-title').forEach(el => {
        el.onclick = (e) => {
            e.stopPropagation();
            const card = el.closest('.feed-card');
            if (card) openFeedDetail(card.dataset.id, refreshCallback);
        };
    });

    container.querySelectorAll('.feed-card').forEach(card => {
        card.style.cursor = 'pointer';
        card.onclick = (e) => {
            if (e.target.closest('.btn')) return;
            openFeedDetail(card.dataset.id, refreshCallback);
        };
    });

    container.querySelectorAll('.feed-reply').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            openFeedDetail(btn.dataset.id, refreshCallback);
        };
    });

    container.querySelectorAll('.feed-approve').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            await (await import('./api.js')).api.post(`/feed/${btn.dataset.id}/resolve`, { status: 'approved' });
            refreshCallback();
        };
    });

    container.querySelectorAll('.feed-reject').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            openFeedDetail(btn.dataset.id, refreshCallback);
        };
    });

    container.querySelectorAll('.feed-defer').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            await (await import('./api.js')).api.post(`/feed/${btn.dataset.id}/resolve`, { status: 'deferred' });
            refreshCallback();
        };
    });

    container.querySelectorAll('.feed-archive').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            if (confirm('Diesen Vorgang wirklich archivieren?')) {
                await (await import('./api.js')).api.post(`/feed/${btn.dataset.id}/resolve`, { status: 'archived' });
                refreshCallback();
            }
        };
    });

    container.querySelectorAll('.feed-cancel').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            if (confirm('Aufgabe wirklich abbrechen?')) {
                await (await import('./api.js')).api.post(`/feed/${btn.dataset.id}/resolve`, { status: 'archived', feedback_text: 'Manuell abgebrochen' });
                refreshCallback();
            }
        };
    });
    
    container.querySelectorAll('.feed-open-app').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            openFeedDetail(btn.dataset.id, refreshCallback);
        };
    });
}

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function shorten(str, limit = 200) {
    if (!str) return '';
    // Für die Vorschau entfernen wir Markdown-Marker, um Textumbrüche sauberer zu halten
    let clean = str.replace(/[*#`_]/g, '').trim();
    if (clean.length <= limit) return clean;
    return clean.substring(0, limit).trim() + '...';
}

function renderMarkdown(str) {
    if (!str) return '';
    let html = escHtml(str);

    // 0. Headings (Markdown)
    html = html.replace(/^###\s+(.*)(\r?\n)?/gm, '<div style="margin-top:16px; margin-bottom:8px; font-size:14px; font-weight:700; color:var(--text-primary); white-space:normal;">$1</div>');
    html = html.replace(/^##\s+(.*)(\r?\n)?/gm, '<div style="margin-top:20px; margin-bottom:12px; font-size:16px; font-weight:700; color:var(--text-primary); white-space:normal;">$1</div>');
    html = html.replace(/^#\s+(.*)(\r?\n)?/gm, '<div style="margin-top:24px; margin-bottom:16px; font-size:18px; font-weight:800; color:var(--text-primary); white-space:normal;">$1</div>');

    // 1. Bold: **text** -> <strong>text</strong>
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // 2. Italic: *text* -> <em>text</em>
    // Wir nutzen einen Lookahead/Lookbehind Ersatz um nicht mit Listen-Sternchen zu kollidieren
    html = html.replace(/([^\*])\*([^\*\s][^\*]*[^\*\s])\*([^\*])/g, '$1<em>$2</em>$3');
    // Fall für Zeilenanfang/Ende
    html = html.replace(/^\*([^\*\s][^\*]*[^\*\s])\*/g, '<em>$1</em>');

    // 3. Unordered Lists: - oder * am Zeilenanfang
    html = html.replace(/^\s*[-*]\s+(.*)$/gm, '• $1');

    // 4. Ordered Lists: 1. 2. etc am Zeilenanfang (Einrücken für Optik)
    html = html.replace(/^\s*(\d+)\.\s+(.*)$/gm, '<span style="display:inline-block; width:20px;">$1.</span> $2');

    // Hinweis: Wir verzichten hier auf <br>, da CSS "white-space: pre-wrap" nutzt.
    // Das verhindert doppelte Zeilenabstände und erhält die natürliche Struktur.
    return html;
}

function renderAgentHistory(history) {
    if (!history || !history.length) return '';
    
    let html = `<div class="detail-section" style="margin-top:24px; padding-top:16px; border-top:1px solid var(--border);">
    <div class="detail-section-title" style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
        <span>Trace / Historie (${history.length} Schritte)</span>
    </div>
    <div id="agent-history-container">`;
    
    history.forEach((step, idx) => {
        const isLast = idx === history.length - 1;
        // Auto-Open the last 2 steps, close others to save space
        const isOpen = isLast || (idx === history.length - 2); 
        
        html += `
        <div class="step-item">
            <div class="step-header" style="display:flex; justify-content:space-between; align-items:center; cursor:default;">
                <div style="cursor:pointer; flex:1;" onclick="this.parentElement.nextElementSibling.style.display = this.parentElement.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                    <span>#${step.step_number} &nbsp; <strong>${escHtml(step.action)}</strong></span>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                    ${step.llm_log_id ? `<button class="btn btn-ghost btn-sm btn-show-raw" data-log-id="${step.llm_log_id}" style="padding:2px 8px; font-size:10px; height:20px; border-color:var(--accent); color:var(--accent);">RAW Call</button>` : ''}
                    <span style="opacity:0.7; font-size:10px;">${timeAgo(step.created_at)}</span>
                </div>
            </div>
            <div class="step-body" style="display:${isOpen ? 'block' : 'none'};">
                <div style="margin-bottom:10px;">
                    <span class="step-label">Gedanke (Thought)</span>
                    <div style="color:var(--text-primary); white-space:pre-wrap; word-break:break-word;">${renderMarkdown(step.thought)}</div>
                </div>
                ${step.action_input && step.action_input !== '{}' ? `
                <div style="margin-bottom:10px;">
                    <span class="step-label">Input</span>
                    <div class="step-content-box" style="color:var(--accent-hover);">${escHtml(step.action_input)}</div>
                </div>` : ''}
                ${step.observation ? `
                <div>
                    <span class="step-label">${step.action === 'USER_FEEDBACK' ? 'Feedback Text' : 'Ergebnis (Observation)'}</span>
                    <div class="step-content-box" style="color:${step.action === 'USER_FEEDBACK' ? 'var(--warning)' : 'var(--text-secondary)'}; max-height:none;">${escHtml(step.observation)}</div>
                </div>` : ''}
            </div>
        </div>`;
    });
    
    html += `</div></div>`;
    return html;
}

function formatWorkProduct(data) {
    if (!data || Object.keys(data).length === 0) return '';
    let html = '';

    // NEU: Involvierte Dokumente extrahieren und anzeigen
    const fileIds = new Set();
    if (data.document_id) fileIds.add(parseInt(data.document_id));
    if (data.file_id) fileIds.add(parseInt(data.file_id));
    if (Array.isArray(data.attachment_ids)) {
        data.attachment_ids.forEach(id => fileIds.add(parseInt(id)));
    } else if (typeof data.attachment_ids === 'string') {
        try {
            const parsed = JSON.parse(data.attachment_ids);
            if (Array.isArray(parsed)) parsed.forEach(id => fileIds.add(parseInt(id)));
        } catch(e) {}
    }

    if (fileIds.size > 0) {
        html += `<div class="detail-section">
            <div class="detail-section-title">Involvierte Dokumente</div>
            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
                ${Array.from(fileIds).map(id => `
                    <button class="btn btn-ghost btn-sm btn-view-attached-file" data-id="${id}" style="border-color:var(--accent); color:var(--accent); font-weight:600;">
                        ${icon('upload')} Dokument #${id} öffnen
                    </button>
                `).join('')}
            </div>
        </div>`;
    }

    // Spezifische Anzeige für die ursprüngliche Anweisung
    if (data.instruction) {
        html += `<div class="detail-section">
            <div class="detail-section-title">Ursprüngliche Anweisung</div>
            <div class="detail-content compact" style="font-style: italic; color: var(--text-secondary); border-left: 3px solid var(--border-light);">
                ${renderMarkdown(data.instruction)}
            </div>
        </div>`;
    }

    if (data.execute_on_approve) {
        const execs = Array.isArray(data.execute_on_approve) ? data.execute_on_approve : [data.execute_on_approve];
        html += `<div class="detail-section"><div class="detail-section-title" style="color:var(--warning)">Geplante Aktionen (wird ausgeführt bei Klick auf Genehmigen)</div>`;
        execs.forEach((exec, idx) => {
            html += `<div class="detail-content" style="border-left: 3px solid var(--warning); margin-bottom:8px;">
                <strong>Aktion ${execs.length > 1 ? idx+1 : ''}:</strong> ${escHtml(exec.description || exec.type)}<br>
                <pre style="margin-top:8px;font-size:11px;background:var(--bg-secondary);padding:8px;border-radius:4px;overflow-x:auto;">${JSON.stringify(exec.params || {}, null, 2)}</pre>
            </div>`;
        });
        html += `</div>`;
    }

    const meta = {};
    if (data.text_length) meta['Textlänge'] = data.text_length + ' Zeichen';
    
    // Felder, die bereits oben oder links gerendert wurden, aus dem JSON-Block ausschließen
    const skip = new Set([
        'analysis','revision_response','email_draft','result',
        'previous_feedback','admin_instruction','document_id', 'file_id',
        'filename','text_length','original_instruction',
        'original_context','execute_on_approve','agent_history',
        'instruction', 'agent_name', 'recommended_action'
    ]);
    const extra = Object.entries(data).filter(([k]) => !skip.has(k));
    if (extra.length > 0) {
        html += `<div class="detail-section"><div class="detail-section-title">Weitere Daten</div><div class="detail-content compact"><pre style="margin:0;font-size:12px;">${JSON.stringify(Object.fromEntries(extra), null, 2)}</pre></div></div>`;
    }

    return html;
}

export async function openFeedDetail(itemId, refreshCallback) {
    const { api } = await import('./api.js');
    let item;
    try { item = await api.get(`/feed/${itemId}`); } catch (e) { alert('Fehler: ' + e.message); return; }

    let activeApps =[];
    try {
        const mods = await api.get('/app-modules');
        activeApps = mods.filter(m => m.is_active);
    } catch(e) {}

    const catLabel = { marketing: 'Marketing', finance: 'Finance', tax_legal: 'Steuer & Legal', documents: 'Dokumente', general: 'Allgemein' }[item.category] || item.category;
    const statusLabel = { pending: 'Offen', approved: 'Genehmigt', rejected: 'Abgelehnt', deferred: 'Verschoben', archived: 'Archiviert', processing: '⏳ In Bearbeitung', replied: 'Beantwortet' }[item.status] || item.status;
    const pLabel = item.priority >= 7 ? 'Hoch' : item.priority >= 4 ? 'Mittel' : 'Niedrig';
    const created = item.created_at ? new Date(item.created_at).toLocaleString('de-DE') : '';
    const resolved = item.resolved_at ? new Date(item.resolved_at).toLocaleString('de-DE') : '–';
    
    const agentDisplay = (item.action_data_json && item.action_data_json.agent_name) 
        ? item.action_data_json.agent_name 
        : (item.agent_id ? `Agent #${item.agent_id}` : 'System');

    const docId = (item.action_data_json || {}).document_id || (item.action_data_json || {}).file_id;
    const docBtnHtml = docId
        ? `<button class="btn btn-ghost btn-sm" id="detail-view-doc" data-doc-id="${docId}" style="width:100%; justify-content:center; flex-shrink:0; margin-bottom:12px; border-color:var(--border-light);">${icon('upload')} Datei anzeigen</button>`
        : '';

    // Status-Helper am Anfang definieren, damit sie überall im Template verfügbar sind
    const isPending = item.status === 'pending';
    const isProcessing = item.status === 'processing';
    const isTerminal = !isPending && !isProcessing;
    const hasProposedApp = item.action_data_json && item.action_data_json.proposed_app;

    // -- LEFT COLUMN --
    const metaBlock = `
        <div class="meta-block">
            <div class="meta-row"><span class="meta-label">Status</span><span class="feed-status s-${item.status}" style="font-size:10px;">${statusLabel}</span></div>
            <div class="meta-row"><span class="meta-label">Kategorie</span><span class="meta-val">${catLabel}</span></div>
            <div class="meta-row">
                <span class="meta-label">Priorität</span>
                <select class="form-select" id="detail-priority-sel" style="width:100px; padding:2px 4px; font-size:11px; height:24px;">
                    ${[1,2,3,4,5,6,7,8,9,10].map(p => `<option value="${p}" ${item.priority === p ? 'selected' : ''}>${p} ${p>=7?'(H)':p<=3?'(N)':'(M)'}</option>`).join('')}
                </select>
            </div>
            <div class="meta-row"><span class="meta-label">Erstellt</span><span class="meta-val">${created}</span></div>
            <div class="meta-row"><span class="meta-label">Letzte Aktivität</span><span class="meta-val">${item.trace_steps?.length > 0 ? timeAgo(item.trace_steps[item.trace_steps.length-1].created_at) : created}</span></div>
            <div class="meta-row"><span class="meta-label">Agent</span><span class="meta-val" style="color:var(--accent);">${agentDisplay}</span></div>
        </div>
    `;

    const parentLink = item.parent_id 
        ? `<div style="padding:10px; background:var(--bg-secondary); border-radius:var(--radius); border:1px solid var(--border); margin-bottom:16px; font-size:12px; cursor:pointer;" onclick="this.nextElementSibling.click()">
             <span style="color:var(--accent);">↪ Überarbeitung von #${item.parent_id}</span>
           </div><button style="display:none" class="feed-reply" data-id="${item.parent_id}"></button>`
        : '';

    // Original Input now shown in Chat View, removed from Left Column to avoid duplication
    // We only keep Document context here
    let inputContent = '';
    const fileCtx = (item.action_data_json || {}).file_context || '';
    if (fileCtx && fileCtx.length > 50) { // Only show if substantial
         // Extract text length
         const len = fileCtx.length;
         inputContent += `<div style="margin-bottom:16px;">
            <strong style="display:block; font-size:11px; text-transform:uppercase; color:var(--text-muted); margin-bottom:6px;">Kontext-Daten</strong>
            <div style="font-size:11px; color:var(--text-secondary);">Enthält extrahierten Text (${Math.round(len/1000)}k Zeichen).</div>
        </div>`;
    }
    
    // Feedback also moved to Chat View
    let feedbackHtml = '';

    // -- RIGHT COLUMN (TABS) --
    const recVal = (item.action_data_json && item.action_data_json.recommended_action);
    const descVal = (item.action_data_json && item.action_data_json.analysis) ? item.action_data_json.analysis : item.description;
    const proposedApp = item.action_data_json?.proposed_app;
    
    let recContent = '';
    if (recVal || descVal) {
        recContent = `
        <div style="margin-bottom:24px;">
            ${recVal ? `
                <div style="padding:24px; border-left:4px solid var(--info); background:var(--info-bg); border-radius:0 12px 12px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border:1px solid rgba(59,130,246,0.2);">
                    <strong style="color:var(--info); display:block; margin-bottom:12px; font-size:12px; text-transform:uppercase; letter-spacing:0.05em;">Handlungsempfehlung des Agenten</strong>
                    <div style="font-size:16px; color:var(--text-primary); line-height:1.6; font-weight:500; white-space:pre-wrap; word-break:break-word;">${renderMarkdown(recVal)}</div>
                </div>
            ` : ''}
            ${(descVal && descVal !== recVal) ? `
                <div style="margin-top:24px; padding: ${recVal ? '0 8px' : '24px'}; border-left: ${recVal ? 'none' : '4px solid var(--accent)'}; background: ${recVal ? 'transparent' : 'var(--accent-bg)'}; border-radius: 12px;">
                    <strong style="display:block; margin-bottom:8px; font-size:11px; text-transform:uppercase; color:var(--text-muted);">Analyse / Ergebnis</strong>
                    <div style="font-size:15px; color:var(--text-primary); line-height:1.6; white-space:pre-wrap; word-break:break-word;">${renderMarkdown(descVal)}</div>
                </div>
            ` : ''}
        </div>`;
    } else {
        recContent = '<div class="empty-state"><div class="empty-state-text">Keine Daten für diesen Schritt vorhanden.</div></div>';
    }

    // --- CHAT HISTORY BUILDER (REVERSED) ---
    let chatEntries = [];

    // 1. Initial User Instruction (Oldest)
    const origInstr = (item.action_data_json || {}).original_instruction || (item.action_data_json || {}).instruction || item.title;
    if (origInstr) {
        chatEntries.push(`
            <div class="chat-entry user">
                <div class="chat-header"><span>${icon('zap')} Initiale Aufgabe</span> <span style="opacity:0.5; font-weight:400;">${created}</span></div>
                <div class="chat-bubble">${renderMarkdown(origInstr)}</div>
            </div>`);
    }

    // 2. Trace Steps
    const steps = (item.trace_steps ||[]).sort((a, b) => a.step_number - b.step_number);
    steps.forEach(step => {
        let contentHtml = '';
        let type = 'agent';
        let header = agentDisplay;
        let isFinal = false;

        if (step.action === 'USER_FEEDBACK') {
            type = 'user';
            header = 'Admin-Feedback / Antwort';
            contentHtml = renderMarkdown(step.observation || step.action_input); 
        } 
        else {
            // Alle anderen Schritte sind Agenten- oder Systemschritte
            let data = {};
            try { data = JSON.parse(step.action_input); } catch(e) {}
            
            const thought = step.thought;
            const analysis = data.analysis || data.message || data.result || data.answer || data.final_answer;
            const rec = data.recommended_action || data.recommendation;
            
            let partsHtml = [];
            
            // Gedanken immer anzeigen, wenn vorhanden
            if (thought) {
                partsHtml.push(`<div style="color:var(--text-secondary); font-style:italic; font-size:12px;"><strong>Gedanke:</strong><br>${renderMarkdown(thought)}</div>`);
            }
            
            if (step.action.toLowerCase().includes('mark_as_')) {
                type = 'system';
                header = 'System';
                let reason = data.reason || step.action_input;
                partsHtml.push(`<div><strong>Aktion (${step.action}):</strong><br>${renderMarkdown(reason)}</div>`);
            }
            else if (step.action === 'SYSTEM_HANDOVER') {
                type = 'system';
                header = 'Workflow Übergabe';
                partsHtml.push(`<div><strong>Übergabe:</strong><br>${renderMarkdown(step.action_input)}</div>`);
            }
            else {
                // Reguläre Agenten-Antwort
                type = 'agent';
                if (analysis && !['success','done','{}'].includes(analysis)) {
                    partsHtml.push(`<div><strong>Analyse / Ergebnis:</strong><br>${renderMarkdown(analysis)}</div>`);
                }
                if (rec) {
                    partsHtml.push(`<div style="padding:12px; background:var(--info-bg); border-left:4px solid var(--info); border-radius:4px; margin-top:10px; border:1px solid rgba(59,130,246,0.2);">
                        <strong style="color:var(--info); font-size:11px; text-transform:uppercase;">Handlungsempfehlung:</strong><br>${renderMarkdown(rec)}</div>`);
                }
                
                if (step.action.toLowerCase() === 'submit_final_result') {
                    isFinal = true;
                    header = agentDisplay + ' (Antwort)';
                    // Falls nichts extrahiert wurde, den kompletten Input zeigen
                    if (partsHtml.length <= 1 && step.action_input && step.action_input !== '{}') {
                         partsHtml.push(`<div>${renderMarkdown(step.action_input)}</div>`);
                    }
                }
            }

            // Wir zeigen die Blase nur, wenn sie substanziellen Inhalt hat
            if (partsHtml.length > 0 && (thought || analysis || rec || isFinal || type === 'system')) {
                contentHtml = partsHtml.join('<div style="margin:12px 0; border-top:1px solid rgba(255,255,255,0.08);"></div>');
            }
        }

        if (contentHtml) {
            chatEntries.push(`
                <div class="chat-entry ${type}">
                    <div class="chat-header"><span>${header}</span> <span style="opacity:0.5; font-weight:400;">${timeAgo(step.created_at)}</span></div>
                    <div class="chat-bubble ${isFinal ? 'final' : ''}">${contentHtml}</div>
                </div>`);
        }
    });

    // 3. Current Processing (Newest)
    if (isProcessing) {
        chatEntries.push(`
            <div class="chat-entry agent">
                <div class="chat-header" style="color:var(--accent);"><span>${agentDisplay}</span></div>
                <div class="chat-bubble" style="border-style: dashed; display:flex; align-items:center; gap:12px;">
                    <div class="feed-status s-processing" style="animation: pulse 1s infinite; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center;">⚡</div>
                    <span style="color:var(--text-secondary);">Agent denkt nach und bearbeitet die Anfrage...</span>
                </div>
            </div>`);
    }

    // --- REVERSE ORDER ---
    const resultHtml = `<div class="chat-view">${chatEntries.reverse().join('') || '<div class="empty-state">Kein Verlauf.</div>'}</div>`;

    // 2. Data
    const workProduct = formatWorkProduct(item.action_data_json || {}); 

    // 3. History
    const historyData = item.trace_steps && item.trace_steps.length ? item.trace_steps : (item.action_data_json || {}).agent_history ||[];
    const historyHtmlWrap = `<div id="agent-history-container-wrap">${renderAgentHistory(historyData)}</div>`;

    // 4. Apps Tab Preparation
    const forceAppSlug = item.action_data_json?.force_app_slug;
    let appsTabHtml = '';
    let appsTabButton = '';
    
    // activeApps is already defined at the top of this function
    
    // Decide which data to pass to the app
    // Priority: proposed_app.data > extracted_data > action_data_json
    let appPayloads = [];
    
    if (proposedApp && proposedApp.data) {
        appPayloads.push({ slug: proposedApp.slug, name: proposedApp.name, data: proposedApp.data });
    } else if (item.action_data_json?.extracted_data) {
        // If agent extracted data for a specific app
        appPayloads.push({ slug: forceAppSlug || 'unknown', name: forceAppSlug || 'Unbekannte App', data: item.action_data_json.extracted_data });
    } else {
        // Default & Fallback using activeApps
        let foundApp = false;
        
        // 1. Try to find valid app data in the action_data_json
        for (const app of activeApps) {
            const schema = app.input_schema || {};
            const requiredKeys = Object.keys(schema).filter(k => schema[k].required);
            if (requiredKeys.length > 0 && requiredKeys.every(k => item.action_data_json?.[k])) {
                appPayloads.push({ slug: app.slug, name: app.name, data: item.action_data_json });
                foundApp = true;
                break;
            }
        }

        // 2. FALLBACK: Scan trace steps for XML or JSON data dynamically against active apps
        if (!foundApp && historyData && historyData.length > 0) {
            const lastStep = historyData[historyData.length - 1];
            const text = lastStep.observation || lastStep.action_input || '';
            
            for (const app of activeApps) {
                const schema = app.input_schema || {};
                const keys = Object.keys(schema);
                const requiredKeys = keys.filter(k => schema[k].required);
                
                if (keys.length === 0) continue;

                let data = null;
                // Versuch 1: XML parsen (Neuer Standard)
                const xmlData = {};
                let foundXml = false;
                keys.forEach(t => {
                    const match = text.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`, 'i'));
                    if (match) { xmlData[t] = match[1].trim(); foundXml = true; }
                });
                
                if (foundXml && requiredKeys.every(k => xmlData[k])) {
                    data = xmlData;
                } else {
                    // Versuch 2: JSON (Legacy)
                    try {
                        const parsed = JSON.parse(text);
                        if (requiredKeys.every(k => parsed[k])) data = parsed;
                    } catch(e) {}
                }

                if (data) {
                    appPayloads.push({ slug: app.slug, name: app.name, data: data });
                    break;
                }
            }
        }
    }

    if (appPayloads.length > 0) {
        appsTabButton = `<div class="feed-tab" data-tab="apps" style="color:var(--accent); font-weight:700;">Apps (${appPayloads.length})</div>`;
        
        appsTabHtml = `<div id="ft-apps" class="feed-tab-content">
            <div style="margin-bottom:20px;">
                <h4 style="font-size:14px; margin-bottom:12px;">Vorbereitete App-Aktionen</h4>
                <p style="font-size:13px; color:var(--text-secondary);">Der Agent hat Daten für folgende Apps vorbereitet. Klicken Sie auf "Öffnen", um die Daten in der App weiterzuverarbeiten.</p>
            </div>
            <div style="display:flex; flex-direction:column; gap:16px;">
                ${appPayloads.map((p, idx) => {
                    const appMeta = activeApps.find(a => a.slug === p.slug) || { name: p.name };
                    return `
                    <div class="card" style="background:var(--bg-tertiary);">
                        <div class="card-body" style="padding:16px; display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <div style="font-weight:600; color:var(--text-primary); margin-bottom:4px;">${appMeta.name}</div>
                                <div style="font-size:12px; color:var(--text-muted); font-family:monospace;">Slug: ${p.slug}</div>
                                <div style="font-size:11px; color:var(--text-muted); margin-top:4px; white-space: pre-wrap;">${JSON.stringify(p.data, null, 2).substring(0, 150)}...</div>
                            </div>
                            <button class="btn btn-primary btn-sm trigger-app-open" data-slug="${p.slug}" data-payload='${JSON.stringify(p.data).replace(/'/g, "\\'")}' style="border-radius:20px; padding: 6px 16px; white-space:nowrap;">
                                ${icon('zap')} Öffnen
                            </button>
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
        </div>`;
    }

    // -- FOOTER --
    let footerHtml = '';
    
    // Kompakte App-Auswahl Logik
    let appSelector = '';
    if (activeApps.length > 0) {
        appSelector = `
            <div style="position:relative; display:flex; align-items:center; width:36px; height:36px; background:var(--bg-tertiary); border:1px solid var(--border-light); border-radius:50%; cursor:pointer;" id="force-app-container">
                <select class="form-select" id="detail-force-app" title="App erzwingen" style="position:absolute; inset:0; opacity:0; z-index:2; cursor:pointer;">
                    <option value="">+</option>
                    ${activeApps.map(a => `<option value="${a.slug}" data-schema="${encodeURIComponent(JSON.stringify(a.input_schema||{}))}">${a.name}</option>`).join('')}
                </select>
                <div id="force-app-icon" style="position:absolute; left:50%; top:50%; transform:translate(-50%, -50%); color:var(--text-secondary); z-index:1;">${icon('plus')}</div>
            </div>
        `;
    }

    const inputField = `<div class="footer-input-wrapper"><textarea class="form-textarea" id="detail-instruction" placeholder="Feedback / Anweisung eingeben..."></textarea></div>`;
    
    // App-Selector Icon-Feedback
    const appSelEl = document.getElementById('detail-force-app');
    if (appSelEl) {
        appSelEl.addEventListener('change', (e) => {
            const container = document.getElementById('force-app-container');
            const iconDiv = document.getElementById('force-app-icon');
            if (e.target.value) {
                container.style.borderColor = 'var(--accent)';
                iconDiv.style.color = 'var(--accent)';
                iconDiv.innerHTML = icon('zap');
            } else {
                container.style.borderColor = '';
                iconDiv.style.color = '';
                iconDiv.innerHTML = icon('plus');
            }
        });
    }

    if (hasProposedApp) {
        footerHtml = `
            <div style="flex:1;">
                <div style="background:var(--accent-bg); padding:12px 20px; border-radius:20px; display:flex; align-items:center; gap:12px;">
                    <span style="color:var(--accent); font-weight:600; font-size:13px;">${icon('zap')} App-Aktion '${proposedApp.name || proposedApp.slug}' wurde vorbereitet.</span>
                </div>
            </div>
            <div class="footer-actions">
                <button class="btn btn-primary btn-pill" id="detail-open-app-tab">${icon('zap')} App öffnen</button>
                <button class="btn btn-ghost btn-pill" id="detail-dismiss-app">Verwerfen</button>
            </div>`;
    } else if (isPending) {
        footerHtml = `
            ${inputField}
            <div class="footer-actions">
                ${appSelector}
                <button class="btn btn-primary btn-pill" id="detail-reply">${icon('bot')} Antwort</button>
                <button class="btn btn-success btn-icon" id="detail-approve" title="Genehmigen" style="background:var(--success); color:#fff; border-radius:50%;">${icon('check')}</button>
                <div style="width:1px; height:24px; background:var(--border); margin:0 4px;"></div>
                <button class="btn btn-ghost btn-icon" id="detail-reject" title="Ablehnen" style="color:var(--danger);">${icon('x')}</button>
                <button class="btn btn-ghost btn-icon" id="detail-archive" title="Archivieren" style="color:var(--text-muted);">${icon('upload')}</button>
                <button class="btn btn-ghost btn-icon" id="detail-delete" title="Endgültig löschen" style="color:var(--danger); opacity:0.6;">${icon('trash')}</button>
            </div>`;
    } else if (isProcessing) {
        footerHtml = `
            <div style="flex:1; display:flex; align-items:center; gap:10px; color:var(--accent);">
                <span class="feed-status s-processing" style="font-size:13px;">⚡ Agent verarbeitet Anfrage...</span>
            </div>
            <div class="footer-actions">
                <button class="btn btn-danger btn-pill" id="detail-cancel">Abbrechen</button>
            </div>`;
    } else if (isTerminal) {
        footerHtml = `
            ${inputField}
            <div class="footer-actions">
                ${appSelector}
                <button class="btn btn-primary btn-pill" id="detail-resume">${icon('zap')} Fortsetzen</button>
                <button class="btn btn-ghost btn-icon" id="detail-archive-terminal" title="Archivieren">${icon('upload')}</button>
                <button class="btn btn-ghost btn-icon" id="detail-delete" title="Endgültig löschen" style="color:var(--danger); opacity:0.6;">${icon('trash')}</button>
            </div>`;
    }

    // -- ASSEMBLE HTML --
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="modal-overlay" id="modal-overlay">
        <div class="modal modal-xl">
            <div class="modal-header">
                <div style="display:flex;align-items:center;gap:12px;">
                    <span class="modal-title">${escHtml(item.title)}</span>
                    <span style="font-size:12px;color:var(--text-secondary);">#${item.id}</span>
                </div>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>
            
            <div class="feed-detail-layout">
                <!-- Links: Kontext (Input) -->
                <div class="feed-col-left">
                    ${docBtnHtml}
                    ${metaBlock}
                    ${parentLink}
                    ${inputContent}
                    ${feedbackHtml}
                </div>

                <!-- Rechts: Tabs (Output) -->
                <div class="feed-col-right">
                    <div class="feed-tabs">
                        <div class="feed-tab active" data-tab="overview">Ergebnis &amp; Handlung</div>
                        ${appsTabButton}
                        <div class="feed-tab" data-tab="data">Daten &amp; Details</div>
                        <div class="feed-tab" data-tab="history">Agent-Historie</div>
                    </div>

                    <div class="feed-scroll-content">
                        <div id="ft-overview" class="feed-tab-content active">
                            ${recContent}
                            ${resultHtml}
                        </div>
                        ${appsTabHtml}
                        <div id="ft-data" class="feed-tab-content">
                            ${workProduct || '<div class="empty-state"><div class="empty-state-text">Keine strukturierten Daten vorhanden.</div></div>'}
                        </div>
                        <div id="ft-history" class="feed-tab-content">
                            ${historyHtmlWrap}
                        </div>
                        <div style="height:20px;"></div>
                    </div>
                    
                    <div class="feed-sticky-footer">
                        ${footerHtml}
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    // Events
    let detailPollTimer = null;
    const cleanupDetailPoll = () => { if (detailPollTimer) clearInterval(detailPollTimer); };

    document.getElementById('modal-close').onclick = () => { cleanupDetailPoll(); closeModal(); };
    document.getElementById('modal-overlay').onclick = (e) => { if (e.target === e.currentTarget) { cleanupDetailPoll(); closeModal(); } };

    const prioSel = document.getElementById('detail-priority-sel');
    if (prioSel) {
        prioSel.onchange = async () => {
            const newPrio = parseInt(prioSel.value);
            try {
                await api.put(`/feed/${item.id}`, { priority: newPrio });
                if (refreshCallback) refreshCallback();
            } catch (e) { alert('Priorität konnte nicht geändert werden: ' + e.message); }
        };
    }

    const viewDocBtn = document.getElementById('detail-view-doc');

    if (viewDocBtn) {
        viewDocBtn.onclick = () => openPdfViewer(parseInt(viewDocBtn.dataset.docId));
    }

    // Bind event for attached file buttons in "Daten & Details" tab
    document.querySelectorAll('.btn-view-attached-file').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            openPdfViewer(parseInt(btn.dataset.id));
        };
    });

    // --- TAB LOGIC ---
    const tabs = document.querySelectorAll('.feed-tab');
    if (tabs.length > 0) {
        tabs.forEach(t => {
            t.onclick = async () => {
                document.querySelectorAll('.feed-tab').forEach(x => x.classList.remove('active'));
                document.querySelectorAll('.feed-tab-content').forEach(x => x.classList.remove('active'));
                t.classList.add('active');
                const targetId = `ft-${t.dataset.tab}`;
                const targetContent = document.getElementById(targetId);
                if (targetContent) targetContent.classList.add('active');
            };
        });
    }
    
    // --- APP TRIGGER BUTTON LOGIC ---
    document.querySelectorAll('.trigger-app-open').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const slug = btn.dataset.slug;
            let payload = {};
            try {
                payload = JSON.parse(btn.dataset.payload);
            } catch(err) {
                console.error("Payload parse error", err);
            }

            // Create a professional overlay wrapper
            const overlay = document.createElement('div');
            overlay.className = 'pdf-overlay'; // Reusing the nice PDF overlay styles
            overlay.innerHTML = `
                <div class="pdf-popover" style="max-width: 900px; height: 90vh; display:flex; flex-direction:column;">
                    <div class="pdf-overlay-header">
                        <span class="pdf-overlay-title">${icon('zap')} ${slug}</span>
                        <button class="btn btn-ghost pdf-close-btn">✕ Schließen</button>
                    </div>
                    <div id="app-content-mount" style="flex:1; overflow:auto; position:relative; background:var(--bg-tertiary); display:flex; flex-direction:column;">
                        <div class="feed-loader" style="padding:40px;">Initialisiere App...</div>
                    </div>
                </div>`;
            document.body.appendChild(overlay);

            const close = () => {
                overlay.remove();
                document.removeEventListener('keydown', escH);
            };
            overlay.querySelector('.pdf-close-btn').onclick = close;
            const escH = (ev) => { if (ev.key === 'Escape') close(); };
            document.addEventListener('keydown', escH);

            const mount = overlay.querySelector('#app-content-mount');

            try {
                const uiModule = await import(`/api/v1/app-modules/${slug}/ui.js?t=${Date.now()}`);
                if (uiModule.render) {
                    mount.innerHTML = '';
                    // Pass a close callback to the app so it can close itself
                    await uiModule.render(mount, payload, item.id, (res) => {
                        close();
                        refreshCallback();
                    });
                } else {
                    mount.innerHTML = `<div class="empty-state" style="color:var(--danger)">App '${slug}' hat keine Render-Funktion.</div>`;
                }
            } catch (e) {
                mount.innerHTML = `<div class="empty-state" style="color:var(--danger); padding:40px; text-align:center;">
                    <h3>Fehler beim Laden der App</h3>
                    <p>${e.message}</p>
                </div>`;
            }
        };
    });

    // --- Action Bindings ---
    const setActionLoading = (msg) => {
        // Switch to chat view (overview)
        const chatTab = document.querySelector('.feed-tabs[data-tab="overview"]');
        if (chatTab) chatTab.click();
        
        const chatView = document.querySelector('.chat-view');
        if (chatView) {
            const tempBubble = document.createElement('div');
            tempBubble.className = 'chat-entry agent';
            tempBubble.innerHTML = `
                <div class="chat-header" style="color:var(--accent);"><span>System</span></div>
                <div class="chat-bubble" style="border-style: dashed; display:flex; align-items:center; gap:12px;">
                    <div class="feed-status s-processing" style="animation: pulse 1s infinite; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center;">⚡</div>
                    <span style="color:var(--text-secondary);">${msg}</span>
                </div>`;
            // Bei Reverse-Order muss das neue Element oben eingefügt werden
            chatView.prepend(tempBubble);
            
            const scrollArea = document.querySelector('.feed-scroll-content');
            if (scrollArea) scrollArea.scrollTop = 0;
        }

        document.querySelectorAll('.footer-actions .btn').forEach(b => b.disabled = true);
        const txt = document.getElementById('detail-instruction');
        if (txt) { txt.disabled = true; txt.style.opacity = '0.5'; }
    };

    const getFeedbackParams = () => {
        const textEl = document.getElementById('detail-instruction');
        const msg = textEl ? textEl.value.trim() : '';
        const forceAppSel = document.getElementById('detail-force-app');
        const appSlug = forceAppSel ? forceAppSel.value : null;
        
        return {
            feedback_text: msg || (appSlug ? "Bitte bereite die App-Aktion vor." : ""),
            force_app_slug: appSlug
        };
    };

    // Helper for Submit
    const submitReply = async () => {
        const params = getFeedbackParams();
        if (!params.feedback_text && !params.force_app_slug) { 
            alert('Bitte eine Nachricht eingeben.'); 
            document.getElementById('detail-instruction').focus(); 
            return; 
        }
        
        setActionLoading('Antwort wird gesendet & verarbeitet...');
        
        try {
            await api.post(`/feed/${item.id}/resolve`, { 
                status: 'replied', 
                feedback_text: params.feedback_text,
                force_app_slug: params.force_app_slug
            });
            if (refreshCallback) refreshCallback();
            
            // Starte Polling im selben Fenster (dieser Aufruf initialisiert polling logic neu)
            // Wir müssen openFeedDetail neu aufrufen, um den State zu refreshen, aber UI soll smooth bleiben
            openFeedDetail(item.id, refreshCallback); 
        } catch (e) { 
            alert(e.message); 
            openFeedDetail(item.id, refreshCallback); 
        }
    };

    // Keyboard Shortcut (STRG+ENTER)
    const textArea = document.getElementById('detail-instruction');
    if (textArea) {
        textArea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                // Entscheide basierend auf sichtbaren Buttons, was zu tun ist
                if (isPending) {
                    if (document.getElementById('detail-reply')) submitReply();
                    else if (document.getElementById('detail-approve')) document.getElementById('detail-approve').click();
                } else if (isTerminal) {
                    if (document.getElementById('detail-resume')) document.getElementById('detail-resume').click();
                }
            }
        });
    }

    if (isPending) {
        document.getElementById('detail-reply').onclick = submitReply;
        
        document.getElementById('detail-approve').onclick = async () => {
            const params = getFeedbackParams();
            // Wenn Text da ist ODER eine App erzwungen wird, behandeln wir es als Überarbeitung
            if (params.feedback_text || params.force_app_slug) {
                setActionLoading('Anweisung wird verarbeitet...');
                try {
                    await api.post(`/feed/${item.id}/resolve`, { 
                        status: 'approved', 
                        feedback_text: params.feedback_text,
                        force_app_slug: params.force_app_slug
                    });
                    if (refreshCallback) refreshCallback();
                    openFeedDetail(item.id, refreshCallback);
                } catch (e) { alert(e.message); openFeedDetail(item.id, refreshCallback); }
            } else {
                const btn = document.getElementById('detail-approve'); btn.disabled = true;
                try {
                    await api.post(`/feed/${item.id}/resolve`, { status: 'approved' });
                    closeModal();
                    refreshCallback();
                } catch (e) { alert(e.message); btn.disabled = false; }
            }
        };
        
        document.getElementById('detail-reject').onclick = async () => {
            const params = getFeedbackParams();
            if (!params.feedback_text) { 
                alert('Bitte Begründung im Textfeld eingeben, um die Aufgabe abzulehnen.'); 
                document.getElementById('detail-instruction').focus(); 
                return; 
            }
            setActionLoading('Ablehnung wird verarbeitet...');
            try {
                await api.post(`/feed/${item.id}/resolve`, { 
                    status: 'rejected', 
                    feedback_text: params.feedback_text,
                    force_app_slug: params.force_app_slug
                });
                if (refreshCallback) refreshCallback();
                openFeedDetail(item.id, refreshCallback);
            } catch (e) { alert(e.message); openFeedDetail(item.id, refreshCallback); }
        };
        
        document.getElementById('detail-archive').onclick = async () => {
            if (confirm('Archivieren?')) {
                await api.post(`/feed/${item.id}/resolve`, { status: 'archived' });
                closeModal();
                refreshCallback();
            }
        };
    } else if (hasProposedApp) {
        document.getElementById('detail-dismiss-app').onclick = () => {
            if (confirm('App-Aktion wirklich verwerfen? Der Vorgang bleibt im Feed.')) {
                closeModal();
            }
        };
        document.getElementById('detail-open-app-tab').onclick = () => {
            const tab = document.querySelector('.feed-tab[data-tab="app"]');
            if (tab) tab.click();
        };
    } else if (isTerminal) {
        document.getElementById('detail-resume').onclick = async () => {
            const params = getFeedbackParams();
            if (!params.feedback_text && !params.force_app_slug) { 
                alert('Bitte geben Sie eine Anweisung ein, um den Vorgang fortzusetzen.'); 
                document.getElementById('detail-instruction').focus(); 
                return; 
            }
            setActionLoading('Vorgang wird fortgesetzt...');
            try {
                await api.post(`/feed/${item.id}/resolve`, { 
                    status: 'replied', 
                    feedback_text: params.feedback_text,
                    force_app_slug: params.force_app_slug
                });
                if (refreshCallback) refreshCallback();
                openFeedDetail(item.id, refreshCallback);
            } catch (e) { alert(e.message); openFeedDetail(item.id, refreshCallback); }
        };
        
        document.getElementById('detail-archive-terminal').onclick = async () => {
            await api.post(`/feed/${item.id}/resolve`, { status: 'archived' });
            closeModal();
            refreshCallback();
        };
    }

    // Lösch-Logik (Einmalige Definition für alle Zustände)
    const delBtn = document.getElementById('detail-delete');
    if (delBtn) {
        delBtn.onclick = async () => {
            if (confirm('Diesen Vorgang wirklich UNWIDERRUFLICH löschen? Dies entfernt auch den Audit-Trail Bezug.')) {
                try {
                    await api.del(`/feed/${item.id}`);
                    cleanupDetailPoll();
                    closeModal();
                    if (refreshCallback) refreshCallback();
                } catch (e) { alert('Fehler beim Löschen: ' + e.message); }
            }
        };
    }

    // Lösch-Logik (Zentraler Event-Handler für den Delete-Button)
    const deleteButtonEl = document.getElementById('detail-delete');
    if (deleteButtonEl) {
        deleteButtonEl.onclick = async () => {
            if (confirm('Diesen Vorgang wirklich UNWIDERRUFLICH löschen? Dies entfernt auch die gesamte Historie im Audit-Trail.')) {
                try {
                    await api.del(`/feed/${item.id}`);
                    cleanupDetailPoll();
                    closeModal();
                    if (refreshCallback) refreshCallback();
                } catch (e) { alert('Fehler beim Löschen: ' + e.message); }
            }
        };
    }
    
    if (isProcessing) {
        const cancelBtn = document.getElementById('detail-cancel');
        if(cancelBtn) cancelBtn.onclick = async () => {
            if (confirm('Abbrechen?')) {
                cleanupDetailPoll();
                await api.post(`/feed/${item.id}/resolve`, { status: 'archived', feedback_text: 'Manuell abgebrochen' });
                closeModal();
                if (refreshCallback) refreshCallback();
            }
        };

        detailPollTimer = setInterval(async () => {
            try {
                const newItem = await api.get(`/feed/${itemId}`);
                if (newItem.status !== 'processing') {
                    cleanupDetailPoll();
                    openFeedDetail(itemId, refreshCallback);
                    if (refreshCallback) refreshCallback();
                    return;
                }
                const histCont = document.getElementById('agent-history-container-wrap');
                if (histCont) {
                    const latestHist = newItem.trace_steps && newItem.trace_steps.length ? newItem.trace_steps : (newItem.action_data_json?.agent_history ||[]);
                    const newHtml = renderAgentHistory(latestHist);
                    if (histCont.innerHTML !== newHtml) {
                        histCont.innerHTML = newHtml;
                        const scrollArea = document.querySelector('.feed-scroll-content');
                        if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
                    }
                }
            } catch (e) {}
        }, 3000);
    }
}

export function timeAgo(isoStr) {
    if (!isoStr) return '';
    return new Date(isoStr).toLocaleString('de-DE');
}

export async function openPdfViewer(docId) {
    const { api } = await import('./api.js');
    let doc;
    try { 
        doc = await api.get(`/files/${docId}`); 
    } catch (e) { 
        alert('Datei nicht gefunden: ' + e.message); 
        return; 
    }

    const overlay = document.createElement('div');
    overlay.className = 'pdf-overlay';
    overlay.innerHTML = `
        <div class="pdf-popover">
            <div class="pdf-overlay-header">
                <span class="pdf-overlay-title">📄 ${doc.filename} <span style="font-weight:400;color:var(--text-muted);font-size:12px;">(${doc.page_count || '?'} Seiten)</span></span>
                <button class="btn btn-ghost pdf-close-btn">✕ Schließen</button>
            </div>
            <div id="pdf-viewer-container" style="flex:1; display:flex; flex-direction:column; background:#525659; position:relative;">
                <div class="feed-loader" style="color:#fff; position:absolute; top:50%; left:50%; transform:translate(-50%, -50%);">Dokument wird geladen...</div>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    const close = () => { 
        if (overlay.dataset.blobUrl) URL.revokeObjectURL(overlay.dataset.blobUrl);
        overlay.remove(); 
        document.removeEventListener('keydown', escH); 
    };
    overlay.querySelector('.pdf-close-btn').onclick = close;
    const escH = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', escH);

    try {
        const response = await fetch(`/api/v1/files/${docId}/content`);
        if (!response.ok) throw new Error('Server-Fehler beim Abruf der Datei');
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        overlay.dataset.blobUrl = url;

        const container = document.getElementById('pdf-viewer-container');
        
        if (doc.mime_type && doc.mime_type.startsWith('image/')) {
            container.innerHTML = `<img src="${url}" style="max-width:100%; max-height:100%; object-fit:contain; margin:auto; display:block;">`;
        } else {
            container.innerHTML = `<iframe src="${url}#toolbar=1&navpanes=0" class="pdf-frame" style="height:100%; width:100%;"></iframe>`;
        }
    } catch (e) {
        document.getElementById('pdf-viewer-container').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-text" style="color:#fff;">Vorschau konnte nicht geladen werden.<br>${e.message}</div>
                <a href="/api/v1/files/${docId}/content" target="_blank" class="btn btn-primary">Datei manuell öffnen</a>
            </div>`;
    }
}




