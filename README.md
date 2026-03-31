# OpenAMS — Agentic Management System

[![Python Version](https://img.shields.io/badge/Python-3.11+-3776ab.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-05998b.svg)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791.svg)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Production--Ready-success.svg)]()

OpenAMS ist ein isoliertes, modulares und hochgradig konfigurierbares **Agentic White-Box System** zur autonomen Verwaltung und Steuerung komplexer Back-Office-Prozesse. Es schließt die Lücke zwischen roher KI-Leistung und strukturierten Geschäftsabläufen durch eine transparente Architektur, in der jeder Gedankengang und jede Aktion der KI auditiert wird.

## 🚀 Vision & Kernkonzept

Herkömmliche Automatisierungen scheitern oft an unstrukturierten Daten (E-Mails, PDFs, handschriftliche Vermerke). OpenAMS nutzt **autonome KI-Agenten**, um diese Informationen zu verstehen, in reale Datenstrukturen zu überführen und komplexe Entscheidungsvorlagen für den Menschen vorzubereiten. 

Dabei verfolgt OpenAMS den **White-Box-Ansatz**: Im Gegensatz zu geschlossenen Systemen liefert OpenAMS zu jeder Entscheidung einen vollständigen **Trace (Gedankenprotokoll)**, damit Administratoren exakt nachvollziehen können, warum ein Agent eine bestimmte Empfehlung ausgesprochen hat.

## 💎 Key Features

### 🏢 Multi-Tenant Architektur
Logische Trennung für mehrere Organisationen oder Abteilungen innerhalb einer Instanz. Jeder Mandant verfügt über eigene Agenten, Workflows, Datenbank-Tabellen und Audit-Trails.

### 🧠 Multi-Layer Memory
Agenten lernen aus Interaktionen. Das System verfügt über:
- **Event-Gedächtnis:** Protokollierung kurzfristiger Ereignisse.
- **Objekt-Gedächtnis:** Langfristiges Wissen über spezifische Entitäten (Kunden, Lieferanten).
- **Strategie-Gedächtnis:** Festgelegte Regeln, die bei jedem Task injiziert werden.

### 📄 Advanced Document Processing
Vollautomatische Ingestion von Dokumenten via PDF-Extraktion, OCR (Tesseract) oder Multimodal Vision-Analyse. Agenten klassifizieren Dokumente nicht nur, sondern extrahieren aktiv Metadaten direkt in SQL-Strukturen.

### ⚡ Decision Feeds & Governance
Kategorisierte Feeds für Marketing, Finanzen oder Recht. Ein strikter **Governance-Layer** verhindert, dass Agenten eigenmächtig schreibend auf externe APIs zugreifen – jede kritische Aktion erfordert eine menschliche Freigabe (Human-in-the-loop).

### 🔌 Modular Extension (MCP & A2A)
- **Model Context Protocol (MCP):** Nahtlose Anbindung an CRMs, ERPs oder Web-APIs.
- **Agent-to-Agent (A2A):** Delegation von Aufgaben an spezialisierte externe Agenten-Swarms.

## 🏗 Technische Architektur

Das System setzt auf einen modernen, performanten Tech-Stack:
- **Backend:** FastAPI (Python 3.11+) mit SQLAlchemy und PostgreSQL für maximale Datenintegrität.
- **Frontend:** Pure ESM JavaScript (Vanilla) – schnell, reaktiv und ohne schwerfällige Framework-Ballast.
- **LLM-Orchestrierung:** Unterstützung für WilmaGPT, OpenAI und Anthropic (Claude 3.5 Sonnet/Opus).

## 🛠 Enthaltene Kern-Module

OpenAMS wird standardmäßig mit einsatzbereiten Modulen ausgeliefert:
- **Cockpit: Verwaltung & Organisation** – Die zentrale Schaltzentrale für administrative Vorgänge.
- **App: E-Mail Sender** – Interaktiver Versand von durch Agenten vorbereiteten Entwürfen.
- **App: Überweisungsvorlage** – Automatisierte Extraktion von Zahlungsdaten für das Online-Banking.
- **MCP: E-Mail Fetcher** – Vollautomatischer Posteingangs-Abruf via IMAP.

## 💻 Installation & Setup

### Systemanforderungen
- Debian 12 / Ubuntu 22.04+
- Python 3.11 oder höher
- PostgreSQL Server
- Tesseract OCR (für Dokumenten-Analyse)

### Automatisierte Bereitstellung
Das System kann mit dem mitgelieferten Deployment-Script in wenigen Minuten aufgesetzt werden:

git clone https://github.com/RHEINMAINTECH/OpenAMS.git
cd OpenAMS
sudo bash deploy.sh

Das Script konfiguriert die virtuelle Umgebung, installiert alle Abhängigkeiten, richtet die PostgreSQL-Datenbank ein und startet den Systemd-Service.

## 📜 Lizenz

Dieses Projekt ist unter der **Apache License 2.0** lizenziert. Weitere Details finden Sie in der Datei `LICENSE`.

---
*OpenAMS — Built for autonomous business excellence.*