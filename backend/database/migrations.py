import datetime
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from backend.database.engine import engine, Base, SessionLocal
from backend.database.models import (
    Tenant, Agent, Workflow, DataStructure, MCPModule, CockpitModule, Setting, 
    WorkflowMCPModule, WorkflowDataStructure, AgentMemory, A2AModule, 
    WorkflowA2AModule, WorkflowTrigger, Goal, AppModule, WorkflowAgent
)

def init_db():
    _cleanup_duplicate_settings()
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    db = SessionLocal()
    try:
        _seed_defaults(db)
        _ensure_settings(db)
    finally:
        db.close()

def _cleanup_duplicate_settings():
    db = SessionLocal()
    try:
        inspector = inspect(engine)
        if "settings" not in inspector.get_table_names():
            return
        sql = text("SELECT key, tenant_id FROM settings GROUP BY key, tenant_id HAVING COUNT(*) > 1")
        res = db.execute(sql).fetchall()
        for row in res:
            key, tid = row[0], row[1]
            q = db.query(Setting).filter(Setting.key == key)
            if tid is None:
                q = q.filter(Setting.tenant_id.is_(None))
            else:
                q = q.filter(Setting.tenant_id == tid)
            items = q.order_by(Setting.updated_at.desc()).all()
            if len(items) > 1:
                for redundant in items[1:]:
                    db.delete(redundant)
        db.commit()
    except Exception as e:
        print(f"Settings Cleanup failed: {e}")
    finally:
        db.close()

def _run_migrations():
    inspector = inspect(engine)
    try:
        table_names = inspector.get_table_names()
    except Exception:
        table_names = []

    # Access Tables (PostgreSQL SERIAL)
    with engine.begin() as conn:
        if "agent_tenant_access" not in table_names:
            conn.execute(text("CREATE TABLE agent_tenant_access (id SERIAL PRIMARY KEY, agent_id INTEGER REFERENCES agents(id), tenant_id INTEGER REFERENCES tenants(id))"))
        if "workflow_tenant_access" not in table_names:
            conn.execute(text("CREATE TABLE workflow_tenant_access (id SERIAL PRIMARY KEY, workflow_id INTEGER REFERENCES workflows(id), tenant_id INTEGER REFERENCES tenants(id))"))
        if "data_structure_tenant_access" not in table_names:
            conn.execute(text("CREATE TABLE data_structure_tenant_access (id SERIAL PRIMARY KEY, data_structure_id INTEGER REFERENCES data_structures(id), tenant_id INTEGER REFERENCES tenants(id))"))

    # Feed Item Updates
    if "feed_items" in table_names:
        cols = [c["name"].lower() for c in inspector.get_columns("feed_items")]
        with engine.begin() as conn:
            if "feedback_text" not in cols:
                conn.execute(text("ALTER TABLE feed_items ADD COLUMN feedback_text TEXT DEFAULT ''"))
            if "parent_id" not in cols:
                conn.execute(text("ALTER TABLE feed_items ADD COLUMN parent_id INTEGER REFERENCES feed_items(id)"))

    # Audit Log Updates
    if "audit_logs" in table_names:
        cols = [c["name"].lower() for c in inspector.get_columns("audit_logs")]
        if "workflow_id" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE audit_logs ADD COLUMN workflow_id INTEGER REFERENCES workflows(id)"))

    # Agent Memory Updates
    if "agent_memories" in table_names:
        cols = [c["name"].lower() for c in inspector.get_columns("agent_memories")]
        if "context_json" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE agent_memories ADD COLUMN context_json JSONB DEFAULT '{}'::jsonb"))

    # Trace Step Updates (Linking to LLM Logs)
    if "agent_trace_steps" in table_names:
        cols = [c["name"].lower() for c in inspector.get_columns("agent_trace_steps")]
        if "llm_log_id" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE agent_trace_steps ADD COLUMN llm_log_id INTEGER REFERENCES llm_logs(id)"))

    # AppModule Updates
    if "app_modules" in table_names:
        cols = [c["name"].lower() for c in inspector.get_columns("app_modules")]
        if "views_json" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE app_modules ADD COLUMN views_json JSONB DEFAULT '{}'::jsonb"))
        if "extraction_prompt" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE app_modules ADD COLUMN extraction_prompt TEXT DEFAULT ''"))

    # Agent Tools Updates
    if "agents" in table_names:
        cols = [c["name"].lower() for c in inspector.get_columns("agents")]
        with engine.begin() as conn:
            if "system_tools" not in columns if "columns" in locals() else "system_tools" not in cols:
                conn.execute(text("ALTER TABLE agents ADD COLUMN system_tools JSONB DEFAULT '[]'::jsonb"))
            if "allowed_files" not in columns if "columns" in locals() else "allowed_files" not in cols:
                conn.execute(text("ALTER TABLE agents ADD COLUMN allowed_files JSONB DEFAULT '[]'::jsonb"))

    # Seed Onboard Models
    session = SessionLocal()
    try:
        if not session.query(Setting).filter(Setting.key == "onboard_models").first():
            session.add(Setting(tenant_id=None, key="onboard_models", value_json={"models": [
                {"id": "sys-ocr", "label": "System OCR (Tesseract/MuPDF)"},
                {"id": "sys-vision", "label": "System Vision (Auto-Multimodal)"}
            ]}))
            session.commit()
    except: pass
    finally: session.close()

def _ensure_settings(db: Session):
    from backend.database.models import Setting as S, Tenant as T
    for t in db.query(T).all():
        if not db.query(S).filter(S.tenant_id == t.id, S.key == "company_info").first():
            db.add(S(tenant_id=t.id, key="company_info", value_json={
                "company_name": "", "street": "", "zip_code": "", "city": "",
                "tax_number": "", "vat_id": "", "contact_person": "",
                "phone": "", "email": "", "registry": "", "notes": "",
            }))
    db.commit()

def _seed_defaults(db: Session):
    new_keys = [
        ("wilma_api_url", {"value": "https://playground.wilmagpt.com/v1/chat/completions"}),
        ("wilma_api_key", {"value": ""}),
        ("openai_api_url", {"value": "https://api.openai.com/v1/chat/completions"}),
        ("openai_api_key", {"value": ""}),
        ("anthropic_api_url", {"value": "https://api.anthropic.com/v1/messages"}),
        ("anthropic_api_key", {"value": ""}),
        ("wilma_models", {"models": [
            {"id": "qwen-fast", "label": "Qwen 3 – 8B (Fast)"},
            {"id": "qwen-faster", "label": "Qwen 3 – 4B Q8 (Faster)"},
            {"id": "qwen-large", "label": "Qwen 3 – 32B (Large)"}
        ]}),
        ("openai_models", {"models": [
            {"id": "gpt-4o", "label": "GPT-4o"},
            {"id": "gpt-4o-mini", "label": "GPT-4o Mini"},
            {"id": "gpt-4-turbo", "label": "GPT-4 Turbo"}
        ]}),
        ("anthropic_models", {"models": [
            {"id": "claude-3-5-sonnet-latest", "label": "Claude 3.5 Sonnet"},
            {"id": "claude-3-opus-latest", "label": "Claude 3 Opus"},
            {"id": "claude-3-haiku-20240307", "label": "Claude 3 Haiku"}
        ]}),
        ("wizard_model", {"value": "qwen-large"}),
    ]
    for key, val in new_keys:
        if not db.query(Setting).filter(Setting.key == key, Setting.tenant_id.is_(None)).first():
            db.add(Setting(tenant_id=None, key=key, value_json=val))
    db.commit()

    if db.query(Tenant).count() > 0: return

    tenant = Tenant(name="Standard-Mandant", slug="standard", description="Automatisch erstellter Standard-Mandant")
    db.add(tenant)
    db.flush()

    # 1. Datenstrukturen anlegen
    ds_docs = DataStructure(
        tenant_id=tenant.id, name="Dokumenten-Archiv", slug="documents", 
        description="Zentrales Verzeichnis für analysierte Dokumente und Rechnungen",
        category="documents", is_standard=True,
        schema_json={"fields": [
            {"name": "document_id", "type": "integer", "required": True, "description": "ID der Datei im System"},
            {"name": "category", "type": "string", "description": "Art des Dokuments (Rechnung, Vertrag, etc.)"},
            {"name": "date", "type": "string", "description": "Belegdatum"},
            {"name": "sender", "type": "string", "description": "Absender / Firma"},
            {"name": "amount", "type": "float", "description": "Brutto-Betrag falls vorhanden"},
            {"name": "summary", "type": "string", "description": "Kurze Zusammenfassung des Inhalts"}
        ]}
    )
    ds_emails = DataStructure(
        tenant_id=tenant.id, name="E-Mail Archiv", slug="emails", 
        description="Verzeichnis aller eingegangenen und verarbeiteten E-Mails",
        category="communication", is_standard=True,
        schema_json={"fields": [
            {"name": "subject", "type": "string", "required": True},
            {"name": "sender", "type": "string"},
            {"name": "recipient", "type": "string"},
            {"name": "body", "type": "string"},
            {"name": "received_at", "type": "string"},
            {"name": "attachment_ids", "type": "string", "description": "JSON Liste der Datei-IDs"}
        ]}
    )
    db.add_all([ds_docs, ds_emails])
    db.flush()

    # 2. Spezialisierte Agenten anlegen
    ag_main = Agent(
        tenant_id=tenant.id, name="General-Manager", 
        description="Zentraler Agent für allgemeine Koordinationsaufgaben",
        agent_type="standard", system_prompt="Du bist der Haupt-Agent. Koordiniere Aufgaben und antworte präzise auf Deutsch.",
        llm_model="qwen-large", llm_temperature=0.3, is_active=True,
        system_tools=["execsql", "insert_record", "get_database_schema", "set_memory"]
    )
    ag_docs = Agent(
        tenant_id=tenant.id, name="Dokumenten-Spezialist", 
        description="Agent zur Extraktion und Klassifizierung von Dokumentendaten",
        agent_type="standard", system_prompt="Du bist Experte für Dokumentenanalyse. Extrahiere Metadaten (Datum, Betrag, Absender) und nutze 'insert_record' um sie im Archiv zu speichern.",
        llm_model="qwen-large", llm_temperature=0.1, is_active=True,
        system_tools=["execsql", "insert_record", "get_database_schema"]
    )
    ag_mail = Agent(
        tenant_id=tenant.id, name="E-Mail-Manager", 
        description="Agent zur Bearbeitung und Einsortierung von E-Mails",
        agent_type="standard", system_prompt="Analysiere eingehende E-Mails. Erfasse Absender und Betreff im E-Mail-Archiv und schlage dem Nutzer Antworten oder App-Aktionen vor.",
        llm_model="qwen-large", llm_temperature=0.4, is_active=True,
        system_tools=["execsql", "insert_record", "propose_app_action"]
    )
    db.add_all([ag_main, ag_docs, ag_mail])
    db.flush()

    # 3. Workflows anlegen
    wf_docs = Workflow(
        tenant_id=tenant.id, name="Dokumenteneingang", slug="documents", 
        description="Standard-Workflow für die Verarbeitung hochgeladener Dokumente",
        category="documents", is_active=True, is_standard=True, has_menu_entry=True, has_feed=True,
        config_json={
            "stages": [
                {"agent_id": ag_docs.id, "target_ds": "documents", "instruction": "Analysiere das Dokument und speichere die Metadaten in der Tabelle 'documents'."},
                {"agent_id": ag_main.id, "instruction": "Prüfe das Ergebnis der Analyse und erstelle eine finale Handlungsempfehlung für den Administrator."}
            ]
        }
    )
    wf_mail = Workflow(
        tenant_id=tenant.id, name="E-Mail Eingang", slug="emails", 
        description="Standard-Workflow für den Empfang und die Analyse von E-Mails",
        category="emails", is_active=True, is_standard=True, has_menu_entry=True, has_feed=True,
        config_json={
            "stages": [
                {"agent_id": ag_mail.id, "target_ds": "emails", "instruction": "Erfasse die E-Mail im System und extrahiere wichtige Informationen."},
                {"agent_id": ag_main.id, "instruction": "Entscheide basierend auf dem E-Mail Inhalt, ob eine Antwort oder eine App-Aktion (z.B. E-Mail Sender) nötig ist."}
            ]
        }
    )
    db.add_all([wf_docs, wf_mail])
    db.flush()

    # 4. Verknüpfungen (Permissions & Assignment)
    # Dokumenten-Workflow Verknüpfungen
    db.add(WorkflowAgent(workflow_id=wf_docs.id, agent_id=ag_docs.id, role="classifier"))
    db.add(WorkflowDataStructure(workflow_id=wf_docs.id, data_structure_id=ds_docs.id, permission="RW"))
    
    # E-Mail-Workflow Verknüpfungen
    db.add(WorkflowAgent(workflow_id=wf_mail.id, agent_id=ag_mail.id, role="handler"))
    db.add(WorkflowDataStructure(workflow_id=wf_mail.id, data_structure_id=ds_emails.id, permission="RW"))

    db.commit()



