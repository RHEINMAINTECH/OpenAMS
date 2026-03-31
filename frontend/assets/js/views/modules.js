import { api } from '../api.js';
import { icon, modal, closeModal } from '../components.js';

export const title = 'Module';

export async function render(container) {
    container.innerHTML = `
        <div class="page-header">
            <div>
                <h1 class="page-title">Module & Erweiterungen</h1>
                <p class="page-subtitle">Verwaltung von Schnittstellen zu externen Systemen und Agenten</p>
            </div>
        </div>
        <div class="tabs" id="modules-tabs">
            <div class="tab active" data-tab="mcp">MCP-Module</div>
            <div class="tab" data-tab="a2a">A2A-Module</div>
            <div class="tab" data-tab="cockpit">Cockpit-Module</div>
            <div class="tab" data-tab="app">App-Module</div>
        </div>
        <div id="module-content"></div>
    `;

    const contentDiv = container.querySelector('#module-content');
    const tabs = container.querySelectorAll('#modules-tabs .tab');

    const switchTab = async (tabName) => {
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
        contentDiv.innerHTML = '<div class="feed-loader">Lade Module...</div>';
        if (tabName === 'mcp') {
            await renderMCP(contentDiv);
        } else if (tabName === 'a2a') {
            await renderA2A(contentDiv);
        } else if (tabName === 'app') {
            await renderAppModules(contentDiv);
        } else {
            await renderCockpits(contentDiv);
        }
    };

    tabs.forEach(t => {
        t.onclick = () => switchTab(t.dataset.tab);
    });

    // Initial render
    switchTab('mcp');
}

async function renderCockpits(container) {
    const modules = await api.get('/cockpit-modules');

    container.innerHTML = `
        <div style="display:flex; justify-content:flex-end; margin-bottom:16px;">
            <button class="btn btn-primary" id="btn-upload-cockpit">${icon('upload')} Cockpit-Modul hochladen</button>
        </div>
        <div class="card"><table>
            <thead><tr><th>Name</th><th>Version</th><th>Autor</th><th>Status</th><th>Aktionen</th></tr></thead>
            <tbody>
                ${modules.map(m => `<tr>
                        <td><strong>${m.name}</strong><br><small style="color:var(--text-muted)">${m.description||''}</small></td>
                        <td>${m.version}</td>
                        <td>${m.author||'–'}</td>
                        <td><span class="tag ${m.is_active?'tag-active':'tag-inactive'}">${m.is_active?'Aktiv':'Inaktiv'}</span></td>
                        <td>
                            <div style="display:flex; gap:4px; flex-wrap:wrap;">
                                <button class="btn btn-ghost btn-sm c-toggle" data-id="${m.id}" data-active="${m.is_active}">${m.is_active?'Deaktivieren':'Aktivieren'}</button>
                                <button class="btn btn-ghost btn-sm c-reload" data-id="${m.id}" title="Neu laden (Manifest & Code)">${icon('zap')}</button>
                                <button class="btn btn-ghost btn-sm c-config" data-id="${m.id}" title="Konfigurieren">${icon('settings')}</button>
                                <button class="btn btn-ghost btn-sm c-delete" data-id="${m.id}" title="Löschen" style="color:var(--danger)">${icon('x')}</button>
                            </div>
                        </td>
                    </tr>`).join('')}
            </tbody>
        </table></div>
        ${modules.length===0?'<div class="empty-state"><div class="empty-state-text">Keine Cockpit-Module gefunden.</div></div>':''}`;

    container.querySelectorAll('.c-toggle').forEach(btn => {
        btn.onclick = async () => {
            const isActive = btn.dataset.active === 'true';
            await api.put(`/cockpit-modules/${btn.dataset.id}`, { is_active: !isActive });
            
            const s = (await import('../state.js')).getState;
            const setState = (await import('../state.js')).setState;
            const res = await api.get('/cockpit-modules');
            setState({ cockpits: res });
            
            const contentDiv = document.querySelector('#module-content');
            if (contentDiv) renderCockpits(contentDiv);
        };
    });

    container.querySelectorAll('.c-reload').forEach(btn => {
        btn.onclick = async () => {
            try {
                await api.post(`/cockpit-modules/${btn.dataset.id}/reload`, {});
                renderCockpits(container);
            } catch (e) { alert('Fehler beim Neuladen: ' + e.message); }
        };
    });

    container.querySelectorAll('.c-config').forEach(btn => {
        btn.onclick = async () => {
            const m = modules.find(x => x.id == btn.dataset.id);
            modal(`Konfiguration – ${m.name}`, `
                <div class="form-group"><label class="form-label">Konfiguration (JSON)</label>
                <textarea class="form-textarea" id="c-cfg" style="min-height:200px;font-family:monospace;">${JSON.stringify(m.config_json||{},null,2)}</textarea></div>
            `, `<button class="btn btn-primary" id="c-save">Speichern</button><button class="btn btn-ghost" id="c-cancel">Abbrechen</button>`);
            document.getElementById('c-cancel').onclick = closeModal;
            document.getElementById('c-save').onclick = async () => {
                let cfg;
                try { cfg = JSON.parse(document.getElementById('c-cfg').value); } catch { alert('Ungültiges JSON'); return; }
                await api.put(`/cockpit-modules/${m.id}`, { config_json: cfg });
                closeModal();
                renderCockpits(container);
            };
        };
    });

    container.querySelectorAll('.c-delete').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Dieses Cockpit-Modul wirklich deinstallieren?')) {
                await api.del(`/cockpit-modules/${btn.dataset.id}`);
                renderCockpits(container);
            }
        };
    });

    container.querySelector('#btn-upload-cockpit').onclick = () => {
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.zip';
        inp.onchange = async () => {
            if (!inp.files.length) return;
            const fd = new FormData(); fd.append('file', inp.files[0]);
            try {
                const res = await api.upload('/cockpit-modules/upload', fd);
                if (res.ok) renderCockpits(container);
                else if (res.errors) {
                    modal('Validierungsfehler', `<ul style="font-size:12px; font-family:monospace;">${res.errors.map(e=>`<li>${e}</li>`).join('')}</ul>`, `<button class="btn btn-primary" onclick="closeModal()">OK</button>`);
                }
            } catch (e) { alert(e.message); }
        };
        inp.click();
    };
}

async function renderMCP(container) {
    const modules = await api.get('/mcp-modules');

    container.innerHTML = `
        <div style="display:flex; justify-content:flex-end; margin-bottom:16px;">
            <button class="btn btn-primary" id="btn-upload-mcp">${icon('upload')} MCP-Modul hochladen</button>
        </div>
        <div class="card"><table>
            <thead><tr><th>Name</th><th>Version</th><th>Autor</th><th>Fähigkeiten</th><th>Status</th><th>Aktionen</th></tr></thead>
            <tbody>
                ${modules.map(m => {
                    const caps = m.capabilities_json || {};
                    const capStr = [...(caps.read||[]).map(c=>`Lesen: ${c}`), ...(caps.write||[]).map(c=>`Schreiben: ${c}`)].join(', ') || '–';
                    return `<tr>
                        <td><strong>${m.name}</strong><br><small style="color:var(--text-muted)">${m.description||''}</small></td>
                        <td>${m.version}</td>
                        <td>${m.author||'–'}</td>
                        <td><small>${capStr}</small></td>
                        <td><span class="tag ${m.is_active?'tag-active':'tag-inactive'}">${m.is_active?'Aktiv':'Inaktiv'}</span></td>
                        <td>
                            <div style="display:flex; gap:4px; flex-wrap:wrap;">
                                <button class="btn btn-ghost btn-sm mcp-toggle" data-id="${m.id}" data-active="${m.is_active}">${m.is_active?'Deaktivieren':'Aktivieren'}</button>
                                <button class="btn btn-ghost btn-sm mcp-reload" data-id="${m.id}" title="Neu laden (Manifest & Code)">${icon('zap')}</button>
                                <button class="btn btn-ghost btn-sm mcp-config" data-id="${m.id}" title="Konfigurieren">${icon('settings')}</button>
                                <button class="btn btn-ghost btn-sm mcp-download" data-id="${m.id}" title="Herunterladen">${icon('upload')}</button>
                                <button class="btn btn-ghost btn-sm mcp-delete" data-id="${m.id}" title="Löschen" style="color:var(--danger)">${icon('x')}</button>
                            </div>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table></div>
        ${modules.length===0?'<div class="empty-state"><div class="empty-state-text">Keine MCP-Module gefunden.</div></div>':''}`;

    container.querySelectorAll('.mcp-toggle').forEach(btn => {
        btn.onclick = async () => {
            const isActive = btn.dataset.active === 'true';
            await api.put(`/mcp-modules/${btn.dataset.id}`, { is_active: !isActive });
            renderMCP(container);
        };
    });

    container.querySelectorAll('.mcp-reload').forEach(btn => {
        btn.onclick = async () => {
            try {
                await api.post(`/mcp-modules/${btn.dataset.id}/reload`, {});
                renderMCP(container);
            } catch (e) { alert('Fehler beim Neuladen: ' + e.message); }
        };
    });

    container.querySelectorAll('.mcp-config').forEach(btn => {
        btn.onclick = async () => {
            const m = await api.get(`/mcp-modules/${btn.dataset.id}`);
            modal(`Konfiguration – ${m.name}`, `
                <div class="form-group"><label class="form-label">Konfiguration (JSON)</label>
                <textarea class="form-textarea" id="mcp-cfg" style="min-height:200px;font-family:monospace;">${JSON.stringify(m.config_json||{},null,2)}</textarea></div>
            `, `<button class="btn btn-primary" id="mcp-save">Speichern</button><button class="btn btn-ghost" id="mcp-cancel">Abbrechen</button>`);
            document.getElementById('mcp-cancel').onclick = closeModal;
            document.getElementById('mcp-save').onclick = async () => {
                let cfg;
                try { cfg = JSON.parse(document.getElementById('mcp-cfg').value); } catch { alert('Ungültiges JSON'); return; }
                await api.put(`/mcp-modules/${m.id}`, { config_json: cfg });
                closeModal();
                renderMCP(container);
            };
        };
    });

    container.querySelectorAll('.mcp-download').forEach(btn => {
        btn.onclick = () => window.open(`/api/v1/mcp-modules/${btn.dataset.id}/download`, '_blank');
    });

    container.querySelectorAll('.mcp-delete').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Dieses MCP-Modul wirklich deinstallieren?')) {
                await api.del(`/mcp-modules/${btn.dataset.id}`);
                renderMCP(container);
            }
        };
    });

    container.querySelector('#btn-upload-mcp').onclick = () => {
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.zip';
        inp.onchange = async () => {
            if (!inp.files.length) return;
            const fd = new FormData(); fd.append('file', inp.files[0]);
            try {
                const res = await api.upload('/mcp-modules/upload', fd);
                if (res.ok) renderMCP(container);
                else if (res.errors) {
                    modal('Validierungsfehler', `<ul style="font-size:12px; font-family:monospace;">${res.errors.map(e=>`<li>${e}</li>`).join('')}</ul>`, `<button class="btn btn-primary" onclick="closeModal()">OK</button>`);
                }
            } catch (e) { alert(e.message); }
        };
        inp.click();
    };
}

async function renderAppModules(container) {
    const modules = await api.get('/app-modules');

    container.innerHTML = `
        <div style="display:flex; justify-content:flex-end; margin-bottom:16px;">
            <button class="btn btn-primary" id="btn-upload-app">${icon('upload')} App-Modul hochladen</button>
        </div>
        <div class="card"><table>
            <thead><tr><th>Name</th><th>Version</th><th>Autor</th><th>Status</th><th>Aktionen</th></tr></thead>
            <tbody>
                ${modules.map(m => `<tr>
                        <td><strong>${m.name}</strong><br><small style="color:var(--text-muted)">${m.description||''}</small></td>
                        <td>${m.version}</td>
                        <td>${m.author||'–'}</td>
                        <td><span class="tag ${m.is_active?'tag-active':'tag-inactive'}">${m.is_active?'Aktiv':'Inaktiv'}</span></td>
                        <td>
                            <div style="display:flex; gap:4px; flex-wrap:wrap;">
                                <button class="btn btn-ghost btn-sm app-toggle" data-id="${m.id}" data-active="${m.is_active}">${m.is_active?'Deaktivieren':'Aktivieren'}</button>
                                <button class="btn btn-ghost btn-sm app-reload" data-id="${m.id}" title="Neu laden">${icon('zap')}</button>
                                <button class="btn btn-ghost btn-sm app-config" data-id="${m.id}" title="Konfigurieren">${icon('settings')}</button>
                                <button class="btn btn-ghost btn-sm app-delete" data-id="${m.id}" title="Löschen" style="color:var(--danger)">${icon('x')}</button>
                            </div>
                        </td>
                    </tr>`).join('')}
            </tbody>
        </table></div>
        ${modules.length===0?'<div class="empty-state"><div class="empty-state-text">Keine App-Module gefunden.</div></div>':''}`;

    container.querySelectorAll('.app-toggle').forEach(btn => {
        btn.onclick = async () => {
            const isActive = btn.dataset.active === 'true';
            await api.put(`/app-modules/${btn.dataset.id}`, { is_active: !isActive });
            renderAppModules(container);
        };
    });

    container.querySelectorAll('.app-reload').forEach(btn => {
        btn.onclick = async () => {
            try {
                await api.post(`/app-modules/${btn.dataset.id}/reload`, {});
                renderAppModules(container);
            } catch (e) { alert('Fehler beim Neuladen: ' + e.message); }
        };
    });

    container.querySelectorAll('.app-config').forEach(btn => {
        btn.onclick = async () => {
            const m = await api.get(`/app-modules/${btn.dataset.id}`);
            modal(`Konfiguration – ${m.name}`, `
                <div class="form-group"><label class="form-label">Konfiguration (JSON)</label>
                <textarea class="form-textarea" id="app-cfg" style="min-height:200px;font-family:monospace;">${JSON.stringify(m.config_json||{},null,2)}</textarea></div>
            `, `<button class="btn btn-primary" id="app-save">Speichern</button><button class="btn btn-ghost" id="app-cancel">Abbrechen</button>`);
            document.getElementById('app-cancel').onclick = closeModal;
            document.getElementById('app-save').onclick = async () => {
                let cfg;
                try { cfg = JSON.parse(document.getElementById('app-cfg').value); } catch { alert('Ungültiges JSON'); return; }
                await api.put(`/app-modules/${m.id}`, { config_json: cfg });
                closeModal();
                renderAppModules(container);
            };
        };
    });

    container.querySelectorAll('.app-delete').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Dieses App-Modul wirklich deinstallieren?')) {
                await api.del(`/app-modules/${btn.dataset.id}`);
                renderAppModules(container);
            }
        };
    });

    container.querySelector('#btn-upload-app').onclick = () => {
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.zip';
        inp.onchange = async () => {
            if (!inp.files.length) return;
            const fd = new FormData(); fd.append('file', inp.files[0]);
            try {
                const res = await api.upload('/app-modules/upload', fd);
                if (res.ok) renderAppModules(container);
                else if (res.errors) {
                    modal('Validierungsfehler', `<ul style="font-size:12px; font-family:monospace;">${res.errors.map(e=>`<li>${e}</li>`).join('')}</ul>`, `<button class="btn btn-primary" onclick="closeModal()">OK</button>`);
                }
            } catch (e) { alert(e.message); }
        };
        inp.click();
    };
}

async function renderA2A(container) {
    const modules = await api.get('/a2a-modules');

    container.innerHTML = `
        <div style="display:flex; justify-content:flex-end; margin-bottom:16px;">
            <button class="btn btn-primary" id="btn-upload-a2a">${icon('upload')} A2A-Modul hochladen</button>
        </div>
        <div class="card"><table>
            <thead><tr><th>Name</th><th>Version</th><th>Autor</th><th>Fähigkeiten</th><th>Status</th><th>Aktionen</th></tr></thead>
            <tbody>
                ${modules.map(m => {
                    const caps = m.capabilities_json || {};
                    const capStr = [...(caps.read||[]).map(c=>`Lesen: ${c}`), ...(caps.write||[]).map(c=>`Delegieren: ${c}`)].join(', ') || '–';
                    return `<tr>
                        <td><strong>${m.name}</strong><br><small style="color:var(--text-muted)">${m.description||''}</small></td>
                        <td>${m.version}</td>
                        <td>${m.author||'–'}</td>
                        <td><small>${capStr}</small></td>
                        <td><span class="tag ${m.is_active?'tag-active':'tag-inactive'}">${m.is_active?'Aktiv':'Inaktiv'}</span></td>
                        <td>
                            <div style="display:flex; gap:4px; flex-wrap:wrap;">
                                <button class="btn btn-ghost btn-sm a2a-toggle" data-id="${m.id}" data-active="${m.is_active}">${m.is_active?'Deaktivieren':'Aktivieren'}</button>
                                <button class="btn btn-ghost btn-sm a2a-reload" data-id="${m.id}" title="Neu laden (Manifest & Code)">${icon('zap')}</button>
                                <button class="btn btn-ghost btn-sm a2a-config" data-id="${m.id}" title="Konfigurieren">${icon('settings')}</button>
                                <button class="btn btn-ghost btn-sm a2a-download" data-id="${m.id}" title="Herunterladen">${icon('upload')}</button>
                                <button class="btn btn-ghost btn-sm a2a-delete" data-id="${m.id}" title="Löschen" style="color:var(--danger)">${icon('x')}</button>
                            </div>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table></div>
        ${modules.length===0?'<div class="empty-state"><div class="empty-state-text">Keine A2A-Module gefunden.</div></div>':''}`;

    container.querySelectorAll('.a2a-toggle').forEach(btn => {
        btn.onclick = async () => {
            const isActive = btn.dataset.active === 'true';
            await api.put(`/a2a-modules/${btn.dataset.id}`, { is_active: !isActive });
            renderA2A(container);
        };
    });

    container.querySelectorAll('.a2a-reload').forEach(btn => {
        btn.onclick = async () => {
            try {
                await api.post(`/a2a-modules/${btn.dataset.id}/reload`, {});
                renderA2A(container);
            } catch (e) { alert('Fehler beim Neuladen: ' + e.message); }
        };
    });

    container.querySelectorAll('.a2a-config').forEach(btn => {
        btn.onclick = async () => {
            const m = await api.get(`/a2a-modules/${btn.dataset.id}`);
            modal(`Konfiguration – ${m.name}`, `
                <div class="form-group"><label class="form-label">Konfiguration (JSON)</label>
                <textarea class="form-textarea" id="a2a-cfg" style="min-height:200px;font-family:monospace;">${JSON.stringify(m.config_json||{},null,2)}</textarea></div>
            `, `<button class="btn btn-primary" id="a2a-save">Speichern</button><button class="btn btn-ghost" id="a2a-cancel">Abbrechen</button>`);
            document.getElementById('a2a-cancel').onclick = closeModal;
            document.getElementById('a2a-save').onclick = async () => {
                let cfg;
                try { cfg = JSON.parse(document.getElementById('a2a-cfg').value); } catch { alert('Ungültiges JSON'); return; }
                await api.put(`/a2a-modules/${m.id}`, { config_json: cfg });
                closeModal();
                renderA2A(container);
            };
        };
    });

    container.querySelectorAll('.a2a-download').forEach(btn => {
        btn.onclick = () => window.open(`/api/v1/a2a-modules/${btn.dataset.id}/download`, '_blank');
    });

    container.querySelectorAll('.a2a-delete').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Dieses A2A-Modul wirklich deinstallieren?')) {
                await api.del(`/a2a-modules/${btn.dataset.id}`);
                renderA2A(container);
            }
        };
    });

    container.querySelector('#btn-upload-a2a').onclick = () => {
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.zip';
        inp.onchange = async () => {
            if (!inp.files.length) return;
            const fd = new FormData(); fd.append('file', inp.files[0]);
            try {
                const res = await api.upload('/a2a-modules/upload', fd);
                if (res.ok) renderA2A(container);
                else if (res.errors) {
                    modal('Validierungsfehler', `<ul style="font-size:12px; font-family:monospace;">${res.errors.map(e=>`<li>${e}</li>`).join('')}</ul>`, `<button class="btn btn-primary" onclick="closeModal()">OK</button>`);
                }
            } catch (e) { alert(e.message); }
        };
        inp.click();
    };
}








