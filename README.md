# OpenAMS - Agentic Management System

OpenAMS is an isolated, modular, and configurable agentic white-box system designed for the autonomous management of back-office tasks. It bridges the gap between raw AI capabilities and structured business processes.

## 🚀 Overview

OpenAMS implements business workflows as autonomous agentic processes. It captures documents (PDF/Images), categorizes data, prioritizes tasks, and prepares decisions—all within a transparent "White-Box" architecture where every thought and action of the AI is audited and visible.

### Key Features

- **Multi-Tenant Architecture** – Logically separated management for multiple organizations or departments.
- **Multi-Layer Memory** – Event-based and object-based long-term memory allowing agents to "learn" business rules.
- **Advanced Document Processing** – Automated PDF/Image ingestion with OCR and multimodal analysis.
- **Decision Feeds** – Categorized task feeds (Marketing, Finance, Tax & Legal) for human-in-the-loop oversight.
- **Governance Layer** – Strict controls preventing agents from autonomous external write access without approval.
- **Modular Extension (MCP)** – Plugin interface for connecting external systems (CRMs, ERPs, APIs).
- **Audit Trails** – Complete logging of every LLM call, tool usage, and human interaction.

## 🏗 Architecture

OpenAMS follows a modular full-stack approach:
- **Backend:** FastAPI (Python 3.11+) with SQLAlchemy and PostgreSQL.
- **Frontend:** Pure ESM JavaScript (Vanilla) with a reactive state management system.
- **Agents:** Configurable workers using WilmaGPT, OpenAI, or Anthropic models.

## 🛠 Included Modules (Public Release)

This version includes the following core modules:
- **App Modules:** `email-sender` (Interactive email processing).
- **Cockpit Modules:** `verwaltung-org` (Central administrative control center).
- **MCP Modules:** `email-fetcher` (IMAP integration), `beispiel-crm` (Template for CRM connectors).

## 💻 Installation

### Requirements
- Debian 12 / Ubuntu 22.04+
- Python 3.11+
- PostgreSQL
- Tesseract OCR (for document analysis)

### Automated Setup
git clone https://github.com/your-org/OpenAMS.git
cd OpenAMS
sudo bash deploy.sh

## 📜 License

Distributed under the Apache License 2.0. See `LICENSE` for more information.

---
*Built for autonomous business excellence.*
