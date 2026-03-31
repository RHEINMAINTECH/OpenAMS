import { api } from '/assets/js/api.js';
import { icon } from '/assets/js/components.js';

export const title = "E-Mail Übersicht";

export async function render(container, initialData, feedItemId, onClose) {
    container.innerHTML = `
        <div style="padding: 24px;">
            <div class="page-header">
                <div>
                    <h3 style="margin:0;">Gesendete Nachrichten</h3>
                    <p style="font-size:12px; color:var(--text-secondary);">Verlauf der über das System versandten E-Mails</p>
                </div>
            </div>
            
            <div class="card" style="background: var(--bg-tertiary);">
                <table style="font-size: 13px;">
                    <thead>
                        <tr><th>Datum</th><th>Empfänger</th><th>Betreff</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Heute, 10:15</td>
                            <td>kunde@beispiel.de</td>
                            <td>Rechnungsanfrage</td>
                            <td><span class="tag tag-active">Versendet</span></td>
                        </tr>
                        <tr>
                            <td>Gestern, 16:40</td>
                            <td>support@provider.com</td>
                            <td>Ticket #12345</td>
                            <td><span class="tag tag-active">Versendet</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div style="margin-top: 24px; display: flex; justify-content: flex-end;">
                <button class="btn btn-ghost" id="btn-app-close">Schließen</button>
            </div>
        </div>
    `;

    container.querySelector('#btn-app-close').onclick = () => onClose({ action: 'close' });
}



