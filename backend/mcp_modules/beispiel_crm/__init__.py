def read_contacts(params: dict) -> dict:
    return {
        "status": "ok",
        "data": [],
        "message": "Beispiel-CRM: Keine echte Verbindung konfiguriert.",
    }


def read_deals(params: dict) -> dict:
    return {
        "status": "ok",
        "data": [],
        "message": "Beispiel-CRM: Keine echte Verbindung konfiguriert.",
    }


def write_contacts(params: dict) -> dict:
    return {
        "status": "ok",
        "message": "Beispiel-CRM Schreibzugriff: Nur mit Admin-Freigabe.",
    }


def write_deals(params: dict) -> dict:
    return {
        "status": "ok",
        "message": "Beispiel-CRM Schreibzugriff: Nur mit Admin-Freigabe.",
    }











