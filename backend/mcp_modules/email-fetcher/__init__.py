import imaplib
import email
from email.header import decode_header
import datetime
import json
import os
from sqlalchemy.orm import Session
from backend.services import db_schema_service, file_service, feed_service, agent_service

def read_sync_inbox(params: dict, db: Session) -> dict:
    """
    Verbindet sich mit dem Postfach, lädt neue Mails, speichert sie in der 
    E-Mail-Datenstruktur und erstellt Feed-Tasks für den Agenten.
    """
    config = params.get("config", {})
    tenant_id = params.get("tenant_id")
    workflow_id = params.get("workflow_id")
    
    if not tenant_id:
        return {"status": "error", "message": "tenant_id fehlt in Parametern."}

    host = config.get("imap_host")
    user = config.get("imap_user")
    pw = config.get("imap_pass")
    port = int(config.get("imap_port", 993))
    
    if not host or not user or not pw:
        return {"status": "error", "message": "IMAP-Konfiguration unvollständig."}

    processed_count = 0
    errors = []

    try:
        # 1. Verbindung herstellen
        mail = imaplib.IMAP4_SSL(host, port)
        mail.login(user, pw)
        mail.select(config.get("folder", "INBOX"))

        # 2. Suche nach ungelesenen Nachrichten
        status, messages = mail.search(None, 'UNSEEN')
        if status != 'OK':
            return {"status": "ok", "processed": 0, "message": "Keine neuen Nachrichten gefunden."}

        msg_ids = messages[0].split()
        
        for m_id in msg_ids:
            res, data = mail.fetch(m_id, '(RFC822)')
            if res != 'OK': continue
            
            raw_email = data[0][1]
            msg = email.message_from_bytes(raw_email)
            
            # Metadata extrahieren
            subject = _decode_mime_header(msg.get("Subject", "(Kein Betreff)"))
            sender = _decode_mime_header(msg.get("From", ""))
            recipient = _decode_mime_header(msg.get("To", ""))
            date_str = msg.get("Date", "")
            
            # Body extrahieren
            body = ""
            attachments = []
            
            if msg.is_multipart():
                for part in msg.walk():
                    content_type = part.get_content_type()
                    filename = part.get_filename()
                    
                    if content_type == "text/plain" and not filename:
                        payload = part.get_payload(decode=True)
                        charset = part.get_content_charset() or "utf-8"
                        try:
                            body += payload.decode(charset, errors="replace")
                        except:
                            body += str(payload)
                    elif filename:
                        filename = _decode_mime_header(filename)
                        content = part.get_payload(decode=True)
                        attachments.append({"filename": filename, "content": content, "mime": content_type})
            else:
                body = msg.get_payload(decode=True).decode(msg.get_content_charset() or "utf-8", errors="replace")

            # 3. Anhänge in das Dateisystem und DB laden
            asset_ids = []
            file_contexts = []
            
            for att in attachments:
                # Wir nutzen die Standard-Workflow-Strategie für PDFs/Bilder
                asset = file_service.create_file_asset(
                    db, tenant_id, att["filename"], att["content"], att["mime"]
                )
                asset_ids.append(asset.id)
                if asset.extracted_text:
                    file_contexts.append(f"--- ANHANG: {att['filename']} ---\n{asset.extracted_text}")
                elif asset.metadata_json.get("extraction_method") == "vision":
                    file_contexts.append(f"--- ANHANG: {att['filename']} (Bild zur Vision-Analyse bereit) ---")

            # 4. In die E-Mail Datenstruktur einfügen (deterministisch)
            email_record = {
                "subject": subject,
                "sender": sender,
                "recipient": recipient,
                "body": body,
                "received_at": date_str,
                "attachment_ids": json.dumps(asset_ids)
            }
            
            # Wir versuchen den Datensatz in 'emails' zu speichern (Standard-Slug)
            try:
                db_schema_service.insert_dynamic_record(db, tenant_id, "emails", email_record)
            except Exception as e:
                errors.append(f"DB-Insert fehlgeschlagen für '{subject}': {str(e)}")

            # 5. Agenten suchen BEVOR der Feed-Item erstellt wird
            from backend.database.models import Agent, WorkflowAgent
            agent_id = None
            if workflow_id:
                wa = db.query(WorkflowAgent).filter(WorkflowAgent.workflow_id == workflow_id).first()
                if wa: agent_id = wa.agent_id
            
            if not agent_id:
                ag = agent_service.find_available_agent(db, tenant_id, workflow_id)
                if ag: agent_id = ag.id

            # 6. Feed-Task für Agenten erzeugen
            full_instruction = f"Eingehende E-Mail von {sender}.\n\nBetreff: {subject}\n\nInhalt:\n{body}\n\n"
            file_context_str = ""
            if file_contexts:
                file_context_str = "\nZugehörige Dokumente wurden extrahiert:\n" + "\n".join(file_contexts)
                full_instruction += file_context_str
            
            action_data = {
                "sender": sender,
                "subject": subject,
                "email_body": body,
                "attachment_ids": asset_ids,
                "original_instruction": full_instruction,
                "file_context": file_context_str
            }
            
            # Task im Feed anlegen
            item = feed_service.create_feed_item(
                db, tenant_id=tenant_id, category="general",
                title=f"E-Mail: {subject[:100]}",
                description=f"Neue Nachricht von {sender}.",
                priority=5, action_type="agent_task",
                action_data=action_data,
                workflow_id=workflow_id,
                agent_id=agent_id
            )
            item.status = "processing"
            db.commit()
            
            # Agenten triggern (Background)
            if agent_id:
                import asyncio
                from backend.services.agent_service import run_task_background
                asyncio.ensure_future(run_task_background(item.id, tenant_id, full_instruction, agent_id, workflow_id))

            processed_count += 1
            
            if config.get("delete_after_import"):
                mail.store(m_id, '+FLAGS', '\\Deleted')

        mail.close()
        mail.logout()

        return {
            "status": "ok", 
            "processed": processed_count, 
            "errors": errors,
            "message": f"{processed_count} E-Mails erfolgreich verarbeitet."
        }

    except Exception as e:
        return {"status": "error", "message": f"IMAP Fehler: {str(e)}"}

def _decode_mime_header(s: str) -> str:
    if not s: return ""
    decoded_parts = decode_header(s)
    result = ""
    for content, charset in decoded_parts:
        if isinstance(content, bytes):
            result += content.decode(charset or "utf-8", errors="replace")
        else:
            result += str(content)
    return result



