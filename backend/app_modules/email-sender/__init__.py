import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# WICHTIGER HINWEIS FÜR ENTWICKLER:
# Innerhalb von OpenAMS ist die Verwendung von JSON für KI-generierte Inhalte (Extraktion/Antworten) untersagt.
# Die Kommunikation mit dem Agenten erfolgt konsequent über XML-Tags. 
# Dieses Modul empfängt die Daten als Dictionary, nachdem der Core-Parser das XML verarbeitet hat.

def action_send(params: dict, db) -> dict:
    """
    Führt den E-Mail-Versand aus.
    """
    config = params.get("config", {})
    
    to_email = params.get("to")
    subject = params.get("subject", "")
    body = params.get("body", "")
    
    # Fallbacks aus Config
    smtp_host = config.get("smtp_host")
    smtp_port = int(config.get("smtp_port", 587))
    smtp_user = config.get("smtp_user")
    smtp_pass = config.get("smtp_pass")
    smtp_from = config.get("smtp_from", smtp_user)

    if not smtp_host:
        # Simulationsmodus: Wenn kein SMTP konfiguriert ist, loggen wir nur.
        print(f"[Email-Sender Simulation] To: {to_email}, Subject: {subject}")
        return {
            "status": "ok", 
            "message": "Simulation: E-Mail wurde nicht physisch versandt (kein SMTP konfiguriert).",
            "data": {"to": to_email, "subject": subject, "body_length": len(body)}
        }

    try:
        msg = MIMEMultipart()
        msg['From'] = smtp_from
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain', 'utf-8'))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            if smtp_user and smtp_pass:
                server.login(smtp_user, smtp_pass)
            server.send_message(msg)
            
        return {
            "status": "ok", 
            "message": "E-Mail erfolgreich versendet.",
            "data": {"to": to_email, "subject": subject}
        }
    except Exception as e:
        return {
            "status": "error", 
            "message": f"SMTP Fehler: {str(e)}"
        }


