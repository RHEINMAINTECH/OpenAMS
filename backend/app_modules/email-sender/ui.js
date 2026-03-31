import { api } from '/assets/js/api.js';
import { icon } from '/assets/js/components.js';

export const title = "E-Mail senden";

export async function render(container, initialData, feedItemId, onClose) {
    const data = initialData || { to: "", subject: "", body: "" };
    
    container.innerHTML = `
        <div style="padding: 24px;">
            <div class="form-group">
                <label class="form-label">Empfänger (To)</label>
                <input class="form-input" id="app-email-to" value="${data.to || ''}" placeholder="kunde@beispiel.de">
            </div>
            <div class="form-group">
                <label class="form-label">Betreff (Subject)</label>
                <input class="form-input" id="app-email-subject" value="${data.subject || ''}" placeholder="Ihre Anfrage">
            </div>
            <div class="form-group">
                <label class="form-label">Nachricht (Body)</label>
                <textarea class="form-textarea" id="app-email-body" style="min-height: 300px; font-family: monospace; font-size: 13px;">${data.body || ''}</textarea>
            </div>
            <div style="margin-top: 24px; display: flex; justify-content: space-between; align-items: center;">
                <button class="btn btn-ghost" id="btn-app-cancel">Abbrechen</button>
                <button class="btn btn-primary" id="btn-app-send">${icon('zap')} Jetzt senden</button>
            </div>
            <div id="app-status" style="margin-top: 16px;"></div>
        </div>
    `;

    const setStatus = (msg, isError = false) => {
        const el = document.getElementById('app-status');
        el.innerHTML = `<div style="color: ${isError ? 'var(--danger)' : 'var(--success)'}; font-size: 13px;">${msg}</div>`;
    };

    container.querySelector('#btn-app-cancel').onclick = () => {
        if (confirm('Fenster schließen ohne zu senden?')) {
            onClose({ sent: false });
        }
    };

    container.querySelector('#btn-app-send').onclick = async () => {
        const payload = {
            to: document.getElementById('app-email-to').value,
            subject: document.getElementById('app-email-subject').value,
            body: document.getElementById('app-email-body').value
        };

        if (!payload.to || !payload.subject) {
            setStatus('Bitte Empfänger und Betreff ausfüllen.', true);
            return;
        }

        const btn = container.querySelector('#btn-app-send');
        btn.disabled = true;
        btn.textContent = 'Sende...';

        try {
            // Execute the backend action
            const res = await api.post(`/app-modules/email-sender/execute/send`, {
                params: payload,
                feed_item_id: feedItemId
            });

            if (res.status === 'ok') {
                setStatus('E-Mail erfolgreich versendet!');
                setTimeout(() => {
                    onClose({ sent: true, response: res });
                }, 1500);
            } else {
                throw new Error(res.message || 'Unbekannter Fehler');
            }
        } catch (e) {
            setStatus('Fehler: ' + e.message, true);
            btn.disabled = false;
            btn.textContent = 'Erneut versuchen';
        }
    };
}



