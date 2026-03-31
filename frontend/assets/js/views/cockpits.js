import { getState } from '../state.js';
import { icon } from '../components.js';

export const title = 'Cockpits';

export async function render(container) {
    const { cockpits } = getState();
    
    if (!cockpits || cockpits.length === 0) {
        container.innerHTML = `
            <div class="page-header">
                <div><h1 class="page-title">Cockpits</h1><p class="page-subtitle">Zentrale Steuerung und Organisation</p></div>
            </div>
            <div class="empty-state">
                <div class="empty-state-text">Es sind noch keine Cockpits installiert oder aktiviert. Gehen Sie zu "System -> Module -> Cockpit-Module", um welche zu aktivieren.</div>
            </div>
        `;
        return;
    }

    const activeCockpits = cockpits.filter(c => c.is_active);
    
    if (activeCockpits.length === 0) {
        container.innerHTML = `
            <div class="page-header">
                <div><h1 class="page-title">Cockpits</h1><p class="page-subtitle">Zentrale Steuerung und Organisation</p></div>
            </div>
            <div class="empty-state">
                <div class="empty-state-text">Alle Cockpits sind derzeit deaktiviert.</div>
            </div>
        `;
        return;
    }

    const cardsHtml = activeCockpits.map(c => `
        <div class="card" style="cursor:pointer; transition:var(--transition);" onclick="window.location.hash='#/cockpit_${c.slug}'" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
            <div class="card-body" style="padding:24px; text-align:center;">
                <div style="font-size:32px; color:var(--accent); margin-bottom:16px;">${icon('layers')}</div>
                <h3 style="margin-bottom:8px; font-size:16px;">${c.name}</h3>
                <p style="font-size:13px; color:var(--text-secondary); line-height:1.5;">${c.description || 'Keine Beschreibung verfügbar.'}</p>
            </div>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="page-header">
            <div><h1 class="page-title">Cockpits</h1><p class="page-subtitle">Zentrale Steuerung und Organisation des agentischen Systems</p></div>
        </div>
        <div class="grid-2">
            ${cardsHtml}
        </div>
    `;
}





