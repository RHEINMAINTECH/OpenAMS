const listeners = [];
let state = {
    tenantId: null,
    tenants: [],
    unreadCount: 0,
    workflows:[],
    cockpits:[],
};

export function getState() {
    return state;
}

export function setState(patch) {
    state = { ...state, ...patch };
    localStorage.setItem('openams_tenant_id', state.tenantId);
    listeners.forEach(fn => fn(state));
}

export function onStateChange(fn) {
    listeners.push(fn);
}

export function initState() {
    const saved = localStorage.getItem('openams_tenant_id');
    if (saved) state.tenantId = parseInt(saved, 10);
}











