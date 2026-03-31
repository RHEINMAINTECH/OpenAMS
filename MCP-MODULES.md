# MCP Module Guide: OpenAMS

Dieses Dokument beschreibt die Architektur und die Anforderungen für **Model Context Protocol (MCP) Module** innerhalb des OpenAMS Systems. Es dient als technische Spezifikation für Entwickler und als Anleitung zur Instruktion anderer LLMs.

---

## 1. Modul-Architektur

Ein MCP-Modul ist eine isolierte Erweiterung, die es KI-Agenten ermöglicht, kontrolliert mit externen Systemen (CRM, ERP, Web-APIs) zu kommunizieren. 

### Verzeichnisstruktur
Jedes Modul muss in einem eigenen Unterverzeichnis in `backend/mcp_modules/` liegen. Der Verzeichnisname muss dem `slug` des Moduls entsprechen.

backend/mcp_modules/
└── [mein-modul-slug]/
    ├── manifest.json   # Metadaten und Funktions-Definition
    └── __init__.py     # Logik-Implementierung

---

## 2. Die Datei `manifest.json`

Das Manifest definiert die Identität des Moduls und die Schnittstellen, die für die Governance-Engine und die Agenten sichtbar sind.

### Pflichtfelder:
- `name`: Anzeigename des Moduls.
- `slug`: Eindeutiger Identifikator (nur Kleinbuchstaben, Zahlen, Bindestriche).
- `version`: Semantische Versionierung (z.B. "1.0.0").
- `capabilities`: Ein Objekt mit zwei Listen:
    - `read`: Liste der verfügbaren Lesemethoden.
    - `write`: Liste der verfügbaren Schreibmethoden (erfordern i.d.R. Admin-Freigabe).

### Beispiel:
{
  "name": "E-Commerce Connector",
  "slug": "ecommerce-api",
  "version": "1.0.0",
  "author": "Dev-Team",
  "description": "Schnittstelle zum Shop-System für Bestelldaten.",
  "capabilities": {
    "read": ["orders", "stock_level"],
    "write": ["update_status"]
  },
  "default_config": {
    "api_url": "https://api.myshop.com",
    "api_key": ""
  }
}

---

## 3. Die Datei `__init__.py`

Diese Datei enthält die eigentliche Python-Logik. Für jede in der `capabilities` angegebene Methode muss eine entsprechende Funktion existieren.

### Namenskonvention:
- Lesemethoden: `read_[methoden_name](params: dict) -> dict`
- Schreibmethoden: `write_[methoden_name](params: dict) -> dict`

### Signatur und Rückgabe:
Jede Funktion **muss** ein Dictionary als ersten Parameter akzeptieren (auch wenn es leer bleibt) und **muss** ein Dictionary zurückgeben.

### Beispiel:
def read_orders(params: dict) -> dict:
    # Logik zum Abrufen von Bestellungen
    limit = params.get("limit", 10)
    return {
        "status": "ok",
        "data": [{"id": 1, "total": "49.99"}]
    }

def write_update_status(params: dict) -> dict:
    order_id = params.get("order_id")
    new_status = params.get("status")
    # Logik zum Schreiben
    return {
        "status": "ok", 
        "message": f"Bestellung {order_id} auf {new_status} gesetzt."
    }

---

## 4. Validierungsregeln (Boilerplate-Check)

Das System prüft beim Import folgende Punkte:
1. Existenz von `manifest.json` und `__init__.py`.
2. Alle in `capabilities` genannten Methoden müssen als Funktionen in `__init__.py` existieren.
3. Jede Funktion muss mindestens ein Argument (`params`) entgegennehmen.
4. Das Manifest muss valide JSON-Syntax haben.

---

## 5. Instruktion für ein anderes LLM (Prompt-Vorlage)

Nutze den folgenden Prompt, um eine KI anzuweisen, ein neues Modul für dieses System zu generieren:

> **System-Prompt für Modul-Entwicklung:**
> 
> "Du bist ein Experte für Python-Backend-Entwicklung. Erstelle ein MCP-Modul für das 'OpenAMS' System.
> 
> **Anforderung:**
> Das Modul soll [FUNKTION DES MODULS, z.B. 'HubSpot CRM Integration'] ermöglichen.
> 
> **Zu liefernde Dateien:**
> 
> 1. `manifest.json`:
>    - Setze den Slug auf '[SLUG]'.
>    - Definiere folgende Lesemethoden: [METHODEN].
>    - Definiere folgende Schreibmethoden: [METHODEN].
>    - Füge eine `default_config` mit notwendigen API-Feldern hinzu.
> 
> 2. `__init__.py`:
>    - Implementiere für jede Capability eine Funktion nach dem Muster `read_name(params: dict)` oder `write_name(params: dict)`.
>    - Jede Funktion muss ein Dictionary zurückgeben, das mindestens ein Feld 'status' (z.B. 'ok' oder 'error') enthält.
>    - Implementiere die Logik robust mit Fehlerbehandlung.
> 
> Halte dich exakt an die Namenskonventionen und die Verzeichnisstruktur."

---

## 6. Integration und Test

1. Erstelle einen Ordner unter `backend/mcp_modules/my-slug/`.
2. Kopiere die Dateien hinein.
3. Gehe im Frontend auf den Bereich **MCP-Module**.
4. Klicke auf **Aktivieren**.
5. Das Modul steht nun dem System zur Verfügung. Agenten können über die `capabilities_json` erkennen, welche Werkzeuge sie nutzen können.

---
*Ende der Dokumentation*









