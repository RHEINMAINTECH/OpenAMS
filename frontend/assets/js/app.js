import { api } from './api.js';
import { getState, setState, onStateChange, initState } from './state.js';
import { renderSidebar, renderHeader } from './components.js';
import * as dashboardView from './views/dashboard.js';
import * as messagesView from './views/messages.js';
import { getCategoryView } from './views/category.js';
import * as agentsView from './views/agents.js';
import * as skillsView from './views/skills.js';
import * as workflowsView from './views/workflows.js';
import * as dataStructuresView from './views/data_structures.js';
import * as modulesView from './views/modules.js';
import * as auditView from './views/audit.js';
import * as settingsView from './views/settings.js';
import * as systemWerkzeugeView from './views/system_werkzeuge.js';
import * as memoryView from './views/memory.js';
import * as cockpitsView from './views/cockpits.js';
import * as goalsView from './views/goals.js';

const routes = {
    cockpits: cockpitsView,
    goals: goalsView,
    memory: memoryView,
    dashboard: dashboardView,
    messages: messagesView,

    agents: agentsView,
    skills: skillsView,
    workflows: workflowsView,
    data_structures: dataStructuresView,
    modules: modulesView,
    audit: auditView,
    system_werkzeuge: systemWerkzeugeView,
    settings: settingsView,
};

let currentRoute = 'dashboard';
let currentScrollCleanup = null;

function getRoute() {
    const hash = window.location.hash.replace('#/', '').replace('#', '');
    return hash || 'dashboard';
}

async function navigate(route) {
    currentRoute = route;
    window.location.hash = `#/${route}`;
    
    // Bestehenden Scroll-Listener der vorherigen Ansicht sauber entfernen
    if (currentScrollCleanup) {
        currentScrollCleanup();
        currentScrollCleanup = null;
    }

    const view = routes[route];
    const content = document.getElementById('content');
    const header = document.getElementById('header');
    const sidebar = document.getElementById('sidebar');
    const state = getState();

    let displayTitle = view?.title || route;
    if (route.startsWith('cockpit_')) {
        const slug = route.replace('cockpit_', '');
        const cp = (state.cockpits || []).find(c => c.slug === slug);
        if (cp) displayTitle = cp.name;
    }

    sidebar.innerHTML = renderSidebar(currentRoute, state.workflows, state.unreadCount, state.cockpits);
    header.innerHTML = renderHeader(displayTitle, state.tenants, state.tenantId);
    
    // Add backdrop for mobile if not exists
    if (!document.getElementById('sidebar-backdrop')) {
        const backdrop = document.createElement('div');
        backdrop.id = 'sidebar-backdrop';
        backdrop.className = 'sidebar-backdrop';
        sidebar.after(backdrop);
        backdrop.onclick = () => document.getElementById('app').classList.remove('sidebar-mobile-open');
    }

    // Sidebar Toggle Logic
    const appEl = document.getElementById('app');
    const isSidebarHidden = localStorage.getItem('sidebar_hidden') === 'true';
    appEl.classList.toggle('sidebar-hidden', isSidebarHidden);

    const toggleBtn = document.getElementById('sidebar-toggle');
    if (toggleBtn) {
        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            if (window.innerWidth <= 768) {
                appEl.classList.toggle('sidebar-mobile-open');
            } else {
                const hidden = appEl.classList.toggle('sidebar-hidden');
                localStorage.setItem('sidebar_hidden', hidden);
            }
        };
    }

    sidebar.querySelectorAll('.nav-item').forEach(item => {
        item.onclick = () => navigate(item.dataset.route);
    });

    const tenantSelect = document.getElementById('tenant-select');
    if (tenantSelect) {
        tenantSelect.onchange = (e) => {
            setState({ tenantId: parseInt(e.target.value, 10) });
            navigate(currentRoute);
        };
    }

    const notifBtn = document.getElementById('notif-btn');
    if (notifBtn) notifBtn.onclick = () => navigate('messages');

    // Dynamic Cockpit Module Loading
    if (route.startsWith('cockpit_')) {
        const slug = route.replace('cockpit_', '');
        content.innerHTML = '<div class="feed-loader" style="padding:40px;">Lade Cockpit...</div>';
        try {
            const mod = await import(`/api/v1/cockpit-modules/${slug}/ui.js?t=${Date.now()}`);
            if (mod.render) {
                const cleanup = await mod.render(content);
                if (typeof cleanup === 'function') currentScrollCleanup = cleanup;
            }
        } catch (e) {
            content.innerHTML = `<div class="empty-state"><div class="empty-state-text" style="color:var(--danger)">Cockpit konnte nicht geladen werden: ${e.message}</div></div>`;
        }
        updateNotifDot();
        return;
    }

    if (view && view.render) {
        content.innerHTML = '<div class="empty-state"><div class="empty-state-text">Laden...</div></div>';
        // Reset scroll position for the new view
        content.scrollTop = 0;
        try {
            const cleanup = await view.render(content);
            // Store cleanup if it's a function (scroll listeners, timers, etc.)
            if (typeof cleanup === 'function') {
                currentScrollCleanup = cleanup;
            }
        } catch (e) {
            content.innerHTML = `<div class="empty-state"><div class="empty-state-text">Fehler: ${e.message}</div></div>`;
        }
    } else {
        content.innerHTML = '<div class="empty-state"><div class="empty-state-text">Seite nicht gefunden.</div></div>';
    }

    updateNotifDot();
}

async function updateNotifDot() {
    const state = getState();
    if (!state.tenantId) return;
    try {
        const res = await api.get(`/messages/unread-count?tenant_id=${state.tenantId}`);
        setState({ unreadCount: res.count || 0 });
        const dot = document.getElementById('notif-dot');
        if (dot) dot.style.display = res.count > 0 ? 'block' : 'none';
    } catch {}
}

async function loadWorkflows() {
    const state = getState();
    if (!state.tenantId) return;
    try {
        const [wfs, cpts] = await Promise.all([
            api.get(`/workflows?tenant_id=${state.tenantId}`),
            api.get('/cockpit-modules')
        ]);
        setState({ workflows: wfs, cockpits: cpts });
        wfs.forEach(w => {
            if (w.has_menu_entry) {
                const key = `workflow_${w.slug}`;
                if (!routes[key]) {
                    routes[key] = getCategoryView(w);
                    routes[key].title = w.name;
                }
            }
        });
    } catch (e) { console.error("Error loading workflows/cockpits:", e); }
}

async function init() {
    initState();

    try {
        const tenants = await api.get('/tenants');
        const state = getState();
        let tenantId = state.tenantId;
        if (!tenantId && tenants.length > 0) tenantId = tenants[0].id;
        setState({ tenants, tenantId });
    } catch (e) {
        console.error('Init failed:', e);
    }

    await loadWorkflows();

    window.onhashchange = () => navigate(getRoute());
    navigate(getRoute());

    setInterval(updateNotifDot, 30000);
}

init();











