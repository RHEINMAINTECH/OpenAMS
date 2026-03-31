import datetime
import json
import re
import traceback
import logging
from sqlalchemy.orm import Session
from backend.database.models import Agent, Task, FeedItem, Setting, AgentTraceStep, AppModule, Tenant
from backend.services import llm_service, memory_service, audit_service, feed_service, governance_service, tool_service

logger = logging.getLogger(__name__)

_WOCHENTAGE = {
    "Monday": "Montag", "Tuesday": "Dienstag", "Wednesday": "Mittwoch",
    "Thursday": "Donnerstag", "Friday": "Freitag", "Saturday": "Samstag", "Sunday": "Sonntag",
}

# --- STRIKTES FORMAT PROMPT ---
# WICHTIGER HINWEIS: OpenAMS nutzt für KI-generierte Inhalte (Antworten/Extraktion) AUSSCHLIESSLICH XML.
# Die Verwendung von JSON für Agenten-Outputs ist untersagt, da viele Modelle XML-Wrapper zuverlässiger einhalten.

SYSTEM_PROMPT_TEMPLATE = """**SYSTEM VARS:**
CURRENT DATE/TIME: {date}
CURRENT IDENTITY: {identity}

**CONTEXT:**
{company_ctx}
{skills_ctx}
{mem_ctx}
{sql_ctx}

**DATABASE RESTRICTIONS:**
{sql_restriction}
--
**ROLE:**
You are an autonomous OpenAMS worker.
Your goal is to complete the assigned TASK. Use the provided TOOLS ONLY IF they are truly necessary and visible in your context. 

**IMPORTANT: BRAIN OVER TOOLS**
- If the task is about creating content (checklist, summary, advice, plan), generate it directly and use `submit_final_result`.
- DO NOT attempt to use database tools (execsql, insert_record, etc.) if no SQL-TABLES are listed in your context below.
- Do not loop or retry technical tools if they fail; instead, report the result or error to the user in plain text.
- Your primary value is the quality of your thoughts and the final response, not the technical tool usage.

**STRUCTURE REQUIREMENTS:**
You must output your response in a strict XML format containing exactly these 4 tags in this order:
<thought>
[Here you generate your derivative thought about the current state]
</thought>
<next_step>
[Here you define the logical next step based on your thought]
</next_step>
<tool_name>
[ToolName]
</tool_name>
<tool_args>
[JSON_Params]
</tool_args>

**RULES:**
1. Use the provided **SYSTEM VARS** and **CONTEXT** as your primary source of truth. If asked who you are or what time it is, use these variables.
2. Do not use markdown blocks (```xml). Just raw XML.
3. **NEVER** use `<think>` tags. Your reasoning belongs exclusively in the `<thought>` tag.
4. <tool_name> must contain ONLY the exact name of the tool (e.g. submit_final_result).
5. <tool_args> must contain ONLY valid JSON representing the parameters.
6. Only ONE tool per turn.
7. Do NOT nest tags inside each other! Close each tag before opening the next.
8. Provide DETAILED texts in your tool arguments, do not just write "success" or "done".
"""

def _build_sql_schema_context(db: Session, workflow_id: int) -> str:
    if not workflow_id:
        return ""
    from backend.database.models import WorkflowDataStructure, DataStructure
    from backend.services.db_schema_service import _get_table_name
    links = db.query(WorkflowDataStructure).filter(WorkflowDataStructure.workflow_id == workflow_id).all()
    if not links:
        return ""
        
    out = "\n=== VERFÜGBARE DATENBANK-TABELLEN (via Tool 'execsql') ===\n"
    out += "Du kannst diese Tabellen per SQL auslesen und beschreiben.\n"
    out += "Beispiel: <tool>execsql {\"query\": \"INSERT INTO table_name (spalte1, spalte2) VALUES ('W1', 'W2')\"}</tool>\n"
    out += "WICHTIG: Erstelle immer einen passenden Eintrag in der Datenbank, wenn du ein Dokument verarbeitest!\n\n"
    
    for link in links:
        ds = db.query(DataStructure).get(link.data_structure_id)
        if not ds: continue
        t_name = _get_table_name(ds.tenant_id, ds.slug)
        fields = ds.schema_json.get("fields", [])
        cols = []
        for f in fields:
            req = "*" if f.get("required") else ""
            cols.append(f"{f['name']}{req} ({f.get('type', 'TEXT')})")
        
        out += f"SQL-TABELLE (für 'execsql'): {t_name}\n"
        out += f"SLUG (für 'insert_record'): {ds.slug}\n"
        out += f"ZWECK: {ds.description or ds.name}\n"
        out += f"RECHTE: {link.permission}\n"
        out += f"SPALTEN: id (Auto), {', '.join(cols)}\n\n"
        
    out += "Hinweis: Spalten mit * sind Pflicht. Die Spalte 'id' ist automatisch und braucht nicht im INSERT angegeben zu werden.\n"
    return out

def _get_system_params(db: Session, tenant_id: int) -> dict:
    now = datetime.datetime.now()
    wd = _WOCHENTAGE.get(now.strftime("%A"), now.strftime("%A"))
    
    # Standard-Identität ist immer der Name des Mandanten
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    identity = tenant.name if tenant else "OpenAMS"
    
    # Optionale Erweiterung/Überschreibung durch spezifische Firmendaten
    row = db.query(Setting).filter(Setting.tenant_id == tenant_id, Setting.key == "company_info").first()
    if row and row.value_json and row.value_json.get("company_name"):
        identity = row.value_json['company_name']
        
    return {
        "date": f"{wd}, der {now.strftime('%d.%m.%Y')} {now.strftime('%H:%M')} Uhr",
        "identity": identity
    }

def _build_company_context(db: Session, tenant_id: int) -> str:
    row = db.query(Setting).filter(Setting.tenant_id == tenant_id, Setting.key == "company_info").first()
    if not row or not row.value_json: return ""
    info = row.value_json
    parts = []
    mapping = [
        ("company_name", "Firma"), ("street", "Straße"), ("zip_code", "PLZ"), ("city", "Ort"),
        ("tax_number", "Steuernummer"), ("vat_id", "USt-IdNr."), ("contact_person", "Ansprechpartner"),
        ("phone", "Telefon"), ("email", "E-Mail"), ("registry", "Handelsregister"), ("notes", "Zusatzinfos"),
    ]
    for key, label in mapping:
        val = info.get(key, "")
        if val: parts.append(f"{label}: {val}")
    return "UNTERNEHMENSDATEN:\n" + "\n".join(parts) if parts else ""

def _build_agent_memory_context(db: Session, tenant_id: int) -> str:
    from backend.database.models import AgentMemory
    memories = db.query(AgentMemory).filter(AgentMemory.tenant_id == tenant_id).all()
    if not memories:
        return ""
    out = "\n=== SYSTEM-GEDÄCHTNIS (Wichtige Hinweise & Gelerntes) ===\n"
    out += "Beachte diese Hinweise bei deiner Arbeit strikt. Nutze den angegebenen Bezug/Kontext, um zu entscheiden, ob der Hinweis auf deinen aktuellen Fall zutrifft:\n"
    for m in memories:
        ctx_desc = (m.context_json or {}).get("description", "Allgemein")
        out += f"- {m.key}: {m.value} (Bezug/Kontext: {ctx_desc})\n"
    return out

def _build_skills_context(db: Session, agent_id: int) -> str:
    from backend.database.models import Skill, AgentSkill
    links = db.query(AgentSkill).filter(AgentSkill.agent_id == agent_id).all()
    if not links: return ""
    skills = db.query(Skill).filter(Skill.id.in_([l.skill_id for l in links]), Skill.is_active == True).all()
    out = ""
    for s in skills:
        out += f"\n=== ZUSÄTZLICHER SKILL ({s.name}) ===\n{s.content}\n"
    return out

def _build_history_from_db(db: Session, feed_item_id: int, max_steps: int = 15) -> str:
    """Erstellt die Historie rekursiv auch über Parent-Elemente hinweg."""
    if not feed_item_id:
        return "(No actions yet)"
    
    from backend.database.models import FeedItem
    all_steps = []
    current_id = feed_item_id
    
    # Sammle Steps rückwärts über den Feed-Stammbaum
    while current_id and len(all_steps) < max_steps:
        steps = db.query(AgentTraceStep).filter(AgentTraceStep.feed_item_id == current_id).order_by(AgentTraceStep.step_number.desc()).all()
        all_steps.extend(steps)
        
        fi = db.query(FeedItem).filter(FeedItem.id == current_id).first()
        if fi and fi.parent_id:
            current_id = fi.parent_id
        else:
            break
            
    # Da wir von hinten nach vorne gesammelt haben, Liste umdrehen
    all_steps = all_steps[:max_steps]
    all_steps.reverse()

    if not all_steps:
        return "(No actions yet)"
    
    out = ""
    if len(all_steps) == max_steps:
        out += f"\n... [Older steps hidden] ...\n"

    for step in all_steps:
        out += f"\n<thought>\n{step.thought}\n</thought>\n"
        out += f"<next_step>\n{step.next_step}\n</next_step>\n"
        out += f"<tool_name>\n{step.action}\n</tool_name>\n"
        args = step.action_input if step.action_input else "{}"
        out += f"<tool_args>\n{args}\n</tool_args>\n"
        
        obs = step.observation or "(No observation)"
        if "Bitte erfinde keine eigenen Tools" in obs:
            obs = obs.split("Bitte erfinde keine eigenen Tools")[0].strip() + " [Tool-Liste gekürzt]"

        # Truncation entfernt: Der Agent benötigt den vollen Kontext für die Datenextraktion
        out += f"<observation>\n{obs}\n</observation>\n"
            
    return out

def _extract_tag_content(tag: str, text: str) -> str | None:
    """Einfache String-Suche ohne Regex, um Parsing-Probleme zu minimieren."""
    start_marker = f"<{tag}>"
    end_marker = f"</{tag}>"
    
    start_idx = text.find(start_marker)
    if start_idx == -1:
        # Fallback: Case-insensitive search
        lower_text = text.lower()
        start_idx = lower_text.find(start_marker.lower())
        if start_idx == -1:
            return None
    
    content_start = start_idx + len(start_marker)
    
    end_idx = text.find(end_marker, content_start)
    if end_idx == -1:
        # Fallback: Case-insensitive search for end tag
        lower_text = text.lower()
        end_idx = lower_text.find(end_marker.lower(), content_start)
        if end_idx == -1:
             # Wenn End-Tag fehlt, nehmen wir den Rest des Strings (Notfall)
            return text[content_start:].strip()
            
    return text[content_start:end_idx].strip()

def _parse_agent_response_strict(response: str):
    clean = response.strip()
    
    if "<think>" in clean and "</think>" in clean:
        end_think = clean.find("</think>") + 8
        clean = clean[end_think:].strip()

    thought = _extract_tag_content("thought", clean)
    next_step = _extract_tag_content("next_step", clean)
    
    # Check for both old <tool> and new <tool_name>/<tool_args> tags for backwards compatibility during session
    tool_raw = _extract_tag_content("tool", clean)
    tool_name = _extract_tag_content("tool_name", clean)
    tool_args = _extract_tag_content("tool_args", clean)
    
    hallucinated_obs = _extract_tag_content("observation", clean)

    if tool_raw and not tool_name:
        tool_raw_cleaned = re.sub(r'</?(action|input|step|parameters)[^>]*>', ' ', tool_raw, flags=re.IGNORECASE)
        tool_raw_cleaned = re.sub(r'\s+', ' ', tool_raw_cleaned).strip()
        parts = tool_raw_cleaned.split(maxsplit=1)
        tool_name = parts[0] if parts else ""
        tool_args = parts[1] if len(parts) > 1 else "{}"

    tool_name = (tool_name or "").strip()
    tool_args = (tool_args or "").strip()

    # FIX: If the model put JSON inside <tool_name> by mistake
    if tool_name.startswith("{") or tool_name.startswith("["):
        tool_args = tool_name
        tool_name = "submit_final_result"  # default fallback
        
        # Try to infer tool from next_step if available
        if next_step:
            ns_lower = next_step.lower()
            if "sql" in ns_lower: tool_name = "execsql"
            elif "memory" in ns_lower: tool_name = "set_memory"
            elif "schema" in ns_lower: tool_name = "get_database_schema"
            elif "insert" in ns_lower: tool_name = "insert_record"
            elif "irrelevant" in ns_lower: tool_name = "mark_as_irrelevant"
            elif "fail" in ns_lower or "error" in ns_lower: tool_name = "mark_as_failed"

    if not thought or not next_step or not tool_name:
        missing = []
        if not thought: missing.append("<thought>")
        if not next_step: missing.append("<next_step>")
        if not tool_name: missing.append("<tool_name>")
        raise ValueError(f"Invalid XML structure. Missing tags: {', '.join(missing)}.")

    if not tool_args:
        tool_args = "{}"

    if tool_name.lower() == "submit_final_result" and tool_args == "{}" and hallucinated_obs:
        tool_args = hallucinated_obs

    return tool_name, tool_args, thought, next_step

def _save_step(db: Session, feed_item_id: int, step_num: int, action: str, inp: str, obs: str, thought: str, next_step: str, llm_log_id: int = None):
    if not feed_item_id: return
    safe_obs = obs[:50000] if obs else ""
    step = AgentTraceStep(
        feed_item_id=feed_item_id,
        step_number=step_num,
        action=action,
        action_input=inp,
        observation=safe_obs,
        thought=thought,
        next_step=next_step,
        llm_log_id=llm_log_id,
        created_at=datetime.datetime.utcnow()
    )
    db.add(step)
    db.commit()

# --- CORE EXECUTION LOOP ---

def build_stage_instruction(db: Session, tenant_id: int, workflow_id: int, stage_index: int, original_instruction: str, previous_result: str = None, file_context: str = "") -> str:
    # Ensure inputs are strings to avoid concatenation errors
    original_instruction = original_instruction or ""
    file_context = file_context or ""
    
    if not workflow_id:
        return original_instruction + file_context
        
    from backend.database.models import Workflow, DataStructure
    
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf or not wf.config_json or "stages" not in wf.config_json:
        if wf and wf.config_json and wf.config_json.get("target_ds") and stage_index == 0:
            target_slug = wf.config_json["target_ds"]
            ds = db.query(DataStructure).filter(DataStructure.tenant_id == tenant_id, DataStructure.slug == target_slug).first()
            if ds:
                schema_str = json.dumps(ds.schema_json.get("fields", []), ensure_ascii=False)
                return f"{original_instruction}\n\n[INFO]: Falls sinnvoll, kannst du die Ergebnisse in der Tabelle '{target_slug}' speichern (Tool: insert_record).\nErwartetes Schema: {schema_str}\nFalls die Aufgabe aber primär eine Auswertung oder Erstellung ist, antworte direkt per 'submit_final_result'.{file_context}"
        return original_instruction + file_context
        
    stages = wf.config_json.get("stages", [])
    if stage_index >= len(stages):
        return original_instruction + file_context
        
    stage = stages[stage_index]
    target_slug = stage.get("target_ds")
    stage_instruction = stage.get("instruction", "").strip()
    
    prompt = f"Du befindest dich in STUFE {stage_index + 1} eines Multi-Agenten Workflows.\n\n"
    prompt += f"=== URSPRÜNGLICHE GESAMTAUFGABE ===\n{original_instruction}\n"
    
    if previous_result:
        prompt += f"\n=== ERGEBNIS DER VORHERIGEN STUFE ===\n{previous_result}\n"
        
    if stage_instruction:
        prompt += f"\n=== DEINE SPEZIFISCHE AUFGABE IN DIESER STUFE ===\n{stage_instruction}\n"
    else:
        prompt += f"\n=== DEINE SPEZIFISCHE AUFGABE IN DIESER STUFE ===\nFühre basierend auf den bisherigen Ergebnissen den nächsten logischen Schritt aus.\n"
        
    if target_slug:
        ds = db.query(DataStructure).filter(DataStructure.tenant_id == tenant_id, DataStructure.slug == target_slug).first()
        if ds:
            schema_str = json.dumps(ds.schema_json.get("fields", []), ensure_ascii=False)
            prompt += f"\n\n[OPTIONALE DATENSPEICHERUNG]: Du kannst das Tool 'insert_record' nutzen, um Daten in '{target_slug}' zu sichern.\nSchema: {schema_str}\nSollte die Speicherung fehlschlagen oder für die Aufgabe zweitrangig sein, liefere dein Ergebnis direkt an den Nutzer."
            
    prompt += file_context
    return prompt

def find_available_agent(db: Session, tenant_id: int, workflow_id: int = None) -> Agent | None:
    """
    Sucht den bestmöglichen aktiven Agenten für einen Mandanten, 
    unter Berücksichtigung von Workflow-Zuweisungen und Mandanten-Freigaben.
    """
    from backend.database.models import AgentTenantAccess, Workflow, WorkflowAgent
    
    # 1. Workflow-Spezifische Suche
    if workflow_id:
        wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
        if wf and wf.config_json:
            stages = wf.config_json.get("stages", [])
            if stages and len(stages) > 0 and stages[0].get("agent_id"):
                try:
                    ag_id = int(stages[0]["agent_id"])
                    ag = db.query(Agent).filter(Agent.id == ag_id, Agent.is_active == True).first()
                    if ag: return ag
                except: pass
        
        wa = db.query(WorkflowAgent).filter(WorkflowAgent.workflow_id == workflow_id).first()
        if wa:
            ag = db.query(Agent).filter(Agent.id == wa.agent_id, Agent.is_active == True).first()
            if ag: return ag

    # 2. Eigene Agenten des Mandanten
    ag = db.query(Agent).filter(Agent.tenant_id == tenant_id, Agent.is_active == True).first()
    if ag: return ag
    
    # 3. Freigegebene Agenten von anderen Mandanten (Multi-Tenant Sharing)
    shared_ids = db.query(AgentTenantAccess.agent_id).filter(AgentTenantAccess.tenant_id == tenant_id).all()
    shared_ids = [r[0] for r in shared_ids]
    if shared_ids:
        ag = db.query(Agent).filter(Agent.id.in_(shared_ids), Agent.is_active == True).first()
        if ag: return ag
        
    return None

async def execute_agent_task(
    db: Session,
    agent_id: int,
    tenant_id: int,
    instruction: str,
    context: dict = None,
) -> dict:
    from backend.database.models import AgentTenantAccess
    
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent: 
        return {"error": "Agent nicht gefunden"}
        
    if agent.tenant_id != tenant_id:
        has_access = db.query(AgentTenantAccess).filter(
            AgentTenantAccess.agent_id == agent_id, 
            AgentTenantAccess.tenant_id == tenant_id
        ).first()
        if not has_access:
            return {"error": f"Zugriff verweigert: Agent #{agent_id} ist nicht für Mandant #{tenant_id} freigegeben."}

    if not agent.is_active: 
        return {"error": "Agent ist deaktiviert"}

    # Fix: Falls agent_id in context als String kommt (z.B. aus Workflow-Stages JSON)
    agent_id = int(agent_id)

    feed_item_id = context.get("feed_item_id") if context else None
    workflow_id = context.get("workflow_id") if context else None

    # Tools
    tools = tool_service.get_workflow_tools(db, tenant_id, workflow_id, agent_id=agent_id)
    tools_text = tool_service.get_tools_text_description(tools)
    sys_params = _get_system_params(db, tenant_id)
    
    # Context Blocks vorbereiten
    company_ctx = _build_company_context(db, tenant_id)
    skills_ctx = _build_skills_context(db, agent_id)
    mem_ctx = _build_agent_memory_context(db, tenant_id)
    sql_ctx = _build_sql_schema_context(db, workflow_id)

    # SQL Restriction Info
    sql_restriction = "You have full access to the SQL tables listed above."
    if not sql_ctx:
        sql_restriction = "IMPORTANT: NO SQL TABLES are assigned to you. You CANNOT use 'execsql', 'insert_record' or 'get_database_schema'. If you need to provide data, lists or plans, include them directly in your 'final_answer' instead of trying to save them."

    # System Prompt assembieren
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        date=sys_params["date"],
        identity=sys_params["identity"],
        company_ctx=company_ctx if company_ctx else "UNTERNEHMENSDATEN: Keine hinterlegt",
        skills_ctx=skills_ctx if skills_ctx else "",
        mem_ctx=mem_ctx if mem_ctx else "",
        sql_ctx=sql_ctx if sql_ctx else "",
        sql_restriction=sql_restriction
    )

    # Step Number Init
    current_step_num = 1
    if feed_item_id:
        count = db.query(AgentTraceStep).filter(AgentTraceStep.feed_item_id == feed_item_id).count()
        current_step_num = count + 1

    # Initial Context Step
    if current_step_num == 1 and context and context.get("document_text"):
        # Visuelle Trennung im Log: Wir zeigen dem User nur, DASS das Dokument geladen wurde.
        # Der Agent bekommt den Inhalt über den 'instruction' Parameter.
        fname = context.get("filename", "Eingangsdatei")
        _save_step(db, feed_item_id, 0, "SYSTEM_INIT", fname, f"Inhalt von '{fname}' wurde zur Analyse geladen.", "Das Dokument wurde vom System erfasst und steht mir zur Bearbeitung zur Verfügung.", "Dokument analysieren")

    MAX_STEPS = 15
    
    # Retry Konfiguration laden
    setting_retries = db.query(Setting).filter(
        (Setting.tenant_id == tenant_id) | (Setting.tenant_id.is_(None)),
        Setting.key == "agent_validation_max_retries"
    ).first()
    try:
        MAX_RETRIES = int(setting_retries.value_json.get("value", 5)) if setting_retries else 5
    except:
        MAX_RETRIES = 5

    vision_image_b64 = None
    vision_mime = None
    if feed_item_id:
        fi = db.query(FeedItem).filter(FeedItem.id == feed_item_id).first()
        if fi and fi.action_data_json and fi.action_data_json.get("use_vision") and fi.action_data_json.get("file_id"):
            from backend.database.models import FileAsset
            file_asset = db.query(FileAsset).filter(FileAsset.id == fi.action_data_json["file_id"]).first()
            if file_asset:
                import base64
                try:
                    with open(file_asset.filepath, "rb") as f:
                        vision_image_b64 = base64.b64encode(f.read()).decode("utf-8")
                        vision_mime = file_asset.mime_type
                except Exception as e:
                    logger.error(f"Failed to read image for vision: {e}")

    final_response = ""

    audit_service.log_action(db, tenant_id, "agent.task.started", "agent", agent.id, details={"instruction": instruction})

    # --- SPECIAL AGENT TYPES (ONBOARD MODELS) ---
    # 1. System OCR Agent
    if agent.llm_model == "sys-ocr":
        if feed_item_id:
            fi = db.query(FeedItem).filter(FeedItem.id == feed_item_id).first()
            if fi:
                ad = fi.action_data_json or {}
                fid = ad.get("file_id") or ad.get("document_id")
                if fid:
                    from backend.database.models import FileAsset
                    from backend.services.file_service import extract_text
                    fa = db.query(FileAsset).filter(FileAsset.id == fid).first()
                    if fa and fa.mime_type == "application/pdf":
                        # Force OCR Extraction
                        txt, pages, method = extract_text(fa.filepath, fa.mime_type, pdf_strategy="ocr", image_strategy="ocr")
                        fa.extracted_text = txt
                        fa.metadata_json = {**(fa.metadata_json or {}), "extraction_method": "ocr_forced"}
                        db.commit()
                        
                        # Kontext aktualisieren für nächste Stufe
                        ad["file_context"] = f"\n\n=== OCR EXTRAHIERTER TEXT ({pages} Seiten) ===\n{txt[:50000]}"
                        fi.action_data_json = ad
                        db.commit()
                        
                        return {"agent": agent.name, "response": f"OCR erfolgreich durchgeführt. Textlänge: {len(txt)} Zeichen. Bereit für nächste Stufe.", "recommended_action": "Weiterverarbeitung starten"}
        
        return {"agent": agent.name, "response": "OCR übersprungen (Keine passende Datei gefunden)."}

    # 2. System Vision Agent (Leitet an Standard-LLM weiter, aber zwingt Bild-Modus)
    if agent.llm_model == "sys-vision":
        # Hier nutzen wir das Standard-Modell des Mandanten, aber wir stellen sicher, dass das Bild im Kontext ist
        # Die Logik läuft dann normal weiter unten in den Loop, aber wir setzen den Prompt um.
        system_prompt = "Du bist ein KI-Vision-Experte. Deine Aufgabe ist es, das angehängte Bild detailliert zu analysieren und alle visuellen Informationen (Texte, Objekte, Layout) strukturiert zu beschreiben."
        # Wir lassen den normalen Loop laufen, der Vision-Support ist ja schon im 'llm_service' Patch drin.
        # Fallback: Falls kein Bild da ist, wird der Agent meckern.

    for i in range(MAX_STEPS):
        # Abbruch-Check
        if feed_item_id:
            db.expire_all() # Cache invalidieren, um Status-Update zu sehen
            check_item = db.query(FeedItem).filter(FeedItem.id == feed_item_id).first()
            if check_item and check_item.status != "processing":
                return {"agent": agent.name, "response": "Vorgang wurde abgebrochen.", "aborted": True}

        history_str = _build_history_from_db(db, feed_item_id)
        
        user_msg = f"""GOAL: {instruction}

HISTORY (Previous Steps):
{history_str}

**AVAILABLE TOOLS:**
{tools_text}

Please generate the next step using the required XML tags."""

        # Retry Loop for XML validation
        valid_response = False
        tool_name, tool_args, thought, next_step = None, None, None, None
        
        current_try = 0
        error_msg = ""
        
        while current_try < MAX_RETRIES:
            try:
                msg_content = user_msg
                if error_msg:
                    msg_content += f"\n\nSYSTEM ERROR: {error_msg}\nPlease correct your format and try again. Use EXACTLY these 4 tags: <thought>, <next_step>, <tool_name>, <tool_args>."

                if vision_image_b64:
                    user_content = [
                        {"type": "text", "text": msg_content},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{vision_mime};base64,{vision_image_b64}"
                            }
                        }
                    ]
                else:
                    user_content = msg_content

                # Wir nutzen die interne Logging-Mechanik, um die ID des Calls zu erhalten
                from backend.database.models import LLMLog
                
                response_raw = await llm_service.chat_completion(
                    db, 
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content}
                    ],
                    model=agent.llm_model,
                    temperature=agent.llm_temperature
                )
                
                # Holen des letzten Log-Eintrags für diesen Agenten
                last_log = db.query(LLMLog).order_by(LLMLog.id.desc()).first()
                current_llm_log_id = last_log.id if last_log else None
                
                # Parse Strict
                tool_name, tool_args, thought, next_step = _parse_agent_response_strict(response_raw)
                valid_response = True
                break
                
            except ValueError as ve:
                error_msg = str(ve)
                current_try += 1
                # print(f"Agent Parsing Error (Try {current_try}): {ve}")
            except Exception as e:
                return {"error": f"LLM Fatal Error: {str(e)}"}

        if not valid_response:
            # Wenn auch nach Retries kein valides XML kommt, brechen wir diesen Step ab
            _save_step(db, feed_item_id, current_step_num, "FORMAT_ERROR", "Failed to produce valid XML after retries", f"Last Error: {error_msg}", "Format Error", "Retry")
            current_step_num += 1
            continue

        # Execution
        if tool_name.lower() == "submit_final_result":
            # Input cleanen
            clean_input = tool_args.strip()
            recommended_action = ""
            if clean_input.startswith("{"):
                try:
                    j = json.loads(clean_input)
                    final_response = j.get("final_answer", j.get("result", j.get("message", j.get("answer", str(j)))))
                    
                    # Fallback, falls das Modell trotz Prompting nur "success" geschrieben hat
                    if isinstance(final_response, str) and final_response.lower() in ["success", "ok", "done"]:
                        for k, v in j.items():
                            if k not in ["result", "status", "recommended_action"] and isinstance(v, str):
                                final_response = v
                                break
                                
                    recommended_action = j.get("recommended_action", "")
                except:
                    final_response = clean_input
            else:
                final_response = clean_input
            
            _save_step(db, feed_item_id, current_step_num, tool_name, tool_args, "Task Completed.", thought, next_step)
            return {"agent": agent.name, "response": final_response, "recommended_action": recommended_action}
            
        elif tool_name.lower() == "mark_as_irrelevant":
            clean_input = tool_args.strip()
            reason = clean_input
            if clean_input.startswith("{") and "reason" in clean_input:
                try:
                    j = json.loads(clean_input)
                    reason = j.get("reason", clean_input)
                except:
                    pass
            
            final_response = f"Automatisch archiviert. Begründung: {reason}"
            
            audit_service.log_action(
                db, tenant_id, "agent.task.auto_archived", "feed_item", feed_item_id, 
                agent_id=agent_id, workflow_id=workflow_id, 
                details={"reason": reason, "thought": thought, "instruction": instruction}
            )
            
            _save_step(db, feed_item_id, current_step_num, tool_name, tool_args, "Task Archived as Irrelevant.", thought, next_step)
            
            return {"agent": agent.name, "response": final_response, "auto_archived": True}

        elif tool_name.lower() == "mark_as_failed":
            clean_input = tool_args.strip()
            reason = clean_input
            if clean_input.startswith("{") and "reason" in clean_input:
                try:
                    j = json.loads(clean_input)
                    reason = j.get("reason", clean_input)
                except:
                    pass
            
            final_response = f"❌ Aufgabe fehlgeschlagen. Grund: {reason}"
            
            audit_service.log_action(
                db, tenant_id, "agent.task.failed", "feed_item", feed_item_id, 
                agent_id=agent_id, workflow_id=workflow_id, 
                details={"reason": reason, "thought": thought, "instruction": instruction}
            )
            
            _save_step(db, feed_item_id, current_step_num, tool_name, tool_args, "Task marked as failed.", thought, next_step)
            
            return {"agent": agent.name, "response": final_response, "failed": True}
        
        # Tool Execution
        tool_result = tool_service.execute_tool(db, tenant_id, context or {}, tool_name, tool_args)
        
        # Save Step mit Verknüpfung zum Raw-Log
        _save_step(db, feed_item_id, current_step_num, tool_name, tool_args, tool_result, thought, next_step, llm_log_id=current_llm_log_id)
        current_step_num += 1

    if not final_response:
        final_response = "Abbruch: Maximale Schrittzahl erreicht ohne Endergebnis."

    return {"agent": agent.name, "response": final_response}


# --- BUSINESS WRAPPERS ---

async def continue_agent_task(db: Session, feed_item, message: str, force_app_slug: str = None) -> dict:
    agent_id = feed_item.agent_id
    
    # FALLBACK: Falls kein Agent zugewiesen ist, suchen wir einen passenden Agenten
    if not agent_id:
        if feed_item.workflow_id:
            from backend.database.models import WorkflowAgent
            wa = db.query(WorkflowAgent).filter(WorkflowAgent.workflow_id == feed_item.workflow_id).first()
            if wa: agent_id = wa.agent_id
        if not agent_id:
            ag = db.query(Agent).filter(Agent.tenant_id == feed_item.tenant_id, Agent.is_active == True).first()
            if ag: agent_id = ag.id
        
        if agent_id:
            feed_item.agent_id = agent_id
            db.commit()
            db.refresh(feed_item)

    # Wir erstellen KEINEN neuen Feed-Item, sondern setzen den aktuellen fort.
    # 1. Status zurücksetzen
    feed_item.status = "processing"
    feed_item.resolved_at = None # Reset resolved timestamp
    
    # 2. Nutzer-Input als Trace-Step speichern
    # Wir loggen hier NUR die saubere Nachricht des Benutzers.
    current_count = db.query(AgentTraceStep).filter(AgentTraceStep.feed_item_id == feed_item.id).count()
    step_num = current_count + 1
    
    user_step = AgentTraceStep(
        feed_item_id=feed_item.id,
        step_number=step_num,
        action="USER_FEEDBACK",
        action_input=message,
        observation=message, # Saubere Anzeige im Frontend
        thought="Der Administrator hat eine Anweisung oder Feedback gegeben. Ich werde dies berücksichtigen.",
        next_step="Anweisung verarbeiten",
        created_at=datetime.datetime.utcnow()
    )
    db.add(user_step)
    
    # 3. Action Data aktualisieren (optional, falls wir das Feedback auch im JSON wollen)
    ad = feed_item.action_data_json or {}
    ad["last_feedback"] = message
    feed_item.action_data_json = ad
    
    db.commit()
    db.refresh(feed_item)

    # 4. Kontext für die Execution vorbereiten (Interne Anreicherung für das LLM)
    orig_content = ad.get("original_instruction") or ad.get("instruction") or feed_item.title
    
    # Historie abrufen (WICHTIG: Dies enthält alle bisherigen Gedanken, Tool-Outputs und User-Feedbacks)
    history_str = _build_history_from_db(db, feed_item.id)

    instruction = f"=== URSPRÜNGLICHE NACHRICHT / AUFGABE ===\n{orig_content}\n\n"
    instruction += f"=== BISHERIGER VERLAUF (Trace/Protokoll) ===\n{history_str}\n\n"
    instruction += f"=== NEUE ANWEISUNG / FEEDBACK VOM ADMINISTRATOR ===\n{message}\n\n"
    instruction += "Berücksichtige die ursprüngliche Nachricht, den bisherigen Verlauf (inkl. deiner eigenen Entwürfe) und das neue Feedback, um die Aufgabe fortzusetzen, zu korrigieren oder die Daten final zu extrahieren."
    
    # Erweiterte Suche nach Datei-Kontext (unterstützt nun auch E-Mail Anhänge)
    file_ids = []
    if ad.get("file_id"): file_ids.append(ad["file_id"])
    if ad.get("document_id"): file_ids.append(ad["document_id"])
    if ad.get("attachment_ids"):
        # attachment_ids kommt oft als JSON string oder Liste
        a_ids = ad["attachment_ids"]
        if isinstance(a_ids, str):
            try:
                a_ids = json.loads(a_ids)
            except: pass
        if isinstance(a_ids, list):
            file_ids.extend(a_ids)

    # Dubletten entfernen
    file_ids = list(set(file_ids))

    if file_ids:
        from backend.database.models import FileAsset
        assets = db.query(FileAsset).filter(FileAsset.id.in_(file_ids)).all()
        for asset in assets:
            if ad.get("use_vision") and asset.id == ad.get("file_id"):
                if f"=== ANGEHÄNGTES BILD: {asset.filename} ===" not in instruction:
                    instruction += f"\n\n=== ANGEHÄNGTES BILD: {asset.filename} ===\n(Wird per Vision-API analysiert)"
            elif asset.extracted_text:
                if asset.extracted_text not in instruction:
                    instruction += f"\n\n=== ANGEHÄNGTES DOKUMENT: {asset.filename} ===\n{asset.extracted_text}"

    context = {"feed_item_id": feed_item.id, "workflow_id": feed_item.workflow_id}
    
    # 5. Agent ausführen
    if force_app_slug:
        # --- SPEZIALMODUS: ERZWUNGENE APP-EXTRAKTION (dynamisch via Modul-Manifest) ---
        app_mod = db.query(AppModule).filter(AppModule.slug == force_app_slug).first()
        if not app_mod:
            result = {"error": f"App '{force_app_slug}' nicht gefunden."}
        elif not app_mod.extraction_prompt:
             result = {"error": f"App '{force_app_slug}' hat keinen `extraction_prompt` im Manifest definiert und kann nicht automatisch befüllt werden."}
        else:
            input_schema = app_mod.input_schema or {}
            schema_keys = list(input_schema.keys())

            # System-Kontext laden (Datum, Firma, Gedächtnis)
            sys_params = _get_system_params(db, feed_item.tenant_id)
            company_ctx = _build_company_context(db, feed_item.tenant_id)
            mem_ctx = _build_agent_memory_context(db, feed_item.tenant_id)

            sys_msg = (
                f"**SYSTEM VARS:**\n"
                f"CURRENT DATE/TIME: {sys_params['date']}\n"
                f"CURRENT IDENTITY: {sys_params['identity']}\n\n"
                f"**CONTEXT:**\n"
                f"{company_ctx}\n"
                f"{mem_ctx}\n"
                f"--\n"
                f"Du bist ein KI-Assistent zur Datenaufbereitung für die App '{app_mod.name}'."
            )
            
            # Die Formatierungsanweisung wird nun dynamisch aus dem Modul geladen
            formatting_instruction = app_mod.extraction_prompt
            
            # Füge Schema-Details hinzu, falls nicht im Prompt enthalten
            if "SCHEMA-DETAILS" not in formatting_instruction:
                 formatting_instruction += f"\n\nSCHEMA-DETAILS ZUR ORIENTIERUNG:\n{json.dumps(input_schema, ensure_ascii=False)}"

            usr_msg = (
                f"### KONTEXT (Bisherige Arbeitsschritte & Dokumente) ###\n{instruction}\n\n"
                f"### AKTUELLE ZUSATZ-ANWEISUNG DES NUTZERS ###\n{message}\n\n"
                f"### ZWINGENDE FORMATVORGABE FÜR DIE EXTRAKTION ###\n{formatting_instruction}"
            )

            try:
                # Modell und Temperatur dynamisch ermitteln
                use_model = None
                use_temp = 0.5 # Niedrigere Temperatur für präzisere Extraktion
                if agent_id:
                    try:
                        ag_obj = db.query(Agent).filter(Agent.id == int(agent_id)).first()
                        if ag_obj: 
                            use_model = ag_obj.llm_model
                            use_temp = ag_obj.llm_temperature
                    except: pass
                
                if not use_model:
                    general_agent = db.query(Agent).filter(Agent.tenant_id == feed_item.tenant_id, Agent.is_active == True).order_by(Agent.id).first()
                    if general_agent:
                        use_model = general_agent.llm_model
                        use_temp = general_agent.llm_temperature
                
                if not use_model:
                    from backend.services.llm_service import _get_default_model_config
                    def_cfg = _get_default_model_config(db)
                    use_model = def_cfg["model"]

                raw_res = await llm_service.chat_completion(
                    db, 
                    messages=[
                        {"role": "system", "content": sys_msg},
                        {"role": "user", "content": usr_msg}
                    ],
                    model=use_model,
                    temperature=use_temp
                )
                
                # XML EXTRAKTION (Robust gegen fehlende Root-Tags durch den Parser)
                extracted_data = {}
                content_to_parse = re.sub(r'<think>.*?</think>', '', raw_res, flags=re.DOTALL)
                content_to_parse = content_to_parse.replace("```xml", "").replace("```", "").strip()
                
                # Wir suchen zuerst innerhalb des Root-Tags der App
                root_content = _extract_tag_content(force_app_slug, content_to_parse)
                parse_source = root_content if root_content else content_to_parse

                for key in schema_keys:
                    val = _extract_tag_content(key, parse_source)
                    if val is not None:
                        extracted_data[key] = val.strip()

                if not extracted_data:
                    # Notfall-Check: Hat das Modell doch JSON geliefert trotz Verbot?
                    if "{" in content_to_parse and "}" in content_to_parse:
                        try:
                            match = re.search(r'(\{.*\})', content_to_parse, re.DOTALL)
                            if match:
                                extracted_data = json.loads(match.group(1))
                        except: pass

                if not extracted_data:
                    raise ValueError("Die KI konnte keine strukturierten XML-Daten extrahieren.")
                
                # Erstelle Zusammenfassung
                summary = f"Daten für '{app_mod.name}' wurden per XML-Protokoll extrahiert.\n\n"
                for k, v in extracted_data.items():
                    if v:
                        v_str = str(v)
                        if len(v_str) > 150:
                            v_str = v_str[:150] + "..."
                        summary += f"- **{k}:** {v_str}\n"

                result = {
                    "agent": "System (XML-Extraktor)",
                    "response": summary,
                    "app_extraction": True,
                    "extracted_data": extracted_data
                }
                
                current_count = db.query(AgentTraceStep).filter(AgentTraceStep.feed_item_id == feed_item.id).count()
                _save_step(db, feed_item.id, current_count + 1, "FORCE_APP_ACTION", force_app_slug, raw_res, "App-Daten wurden erfolgreich über XML-Tags extrahiert.", "Extraktion abgeschlossen")
                
            except Exception as e:
                # Wir loggen den Fehler im Trace-Step für volle Transparenz
                current_count = db.query(AgentTraceStep).filter(AgentTraceStep.feed_item_id == feed_item.id).count()
                _save_step(db, feed_item.id, current_count + 1, "EXTRACTION_ERROR", force_app_slug, str(e), "Die Extraktion der App-Daten ist fehlgeschlagen.", "Fehlerbehandlung")
                result = {"error": f"Extraktion fehlgeschlagen: {str(e)}"}
    else:
        # Normaler Reasoning Loop
        result = await execute_agent_task(db, agent_id, feed_item.tenant_id, instruction, context)
    
    # 6. Ergebnis verarbeiten
    # Wir müssen das FeedItem neu laden, da es sich im Hintergrund geändert haben könnte
    feed_item = db.query(FeedItem).filter(FeedItem.id == feed_item.id).first()
    if feed_item:
        if "error" not in result:
            if result.get("auto_archived"):
                feed_item.status = "archived"
                feed_item.result_json = {"auto_archived": True, "reason": result.get("response")}
            else:
                feed_item.status = "pending"
                
            # Beschreibung aktualisieren mit dem neuesten Ergebnis
            feed_item.description = result["response"][:500]
            
            ad = feed_item.action_data_json or {}
            ad["analysis"] = result["response"]
            ad["revision_response"] = result["response"]
            ad["recommended_action"] = result.get("recommended_action", "")
            ad["agent_name"] = result.get("agent", "")
            
            # Falls App-Extraktion stattfand, befüllen wir den App-Vorschlag
            if result.get("app_extraction") and force_app_slug:
                ad["proposed_app"] = {
                    "slug": force_app_slug,
                    "name": app_mod.name,
                    "data": result.get("extracted_data", {})
                }
                
            feed_item.action_data_json = ad
        else:
            feed_item.status = "pending"
            feed_item.description = f"Fehler: {result['error']}"
        db.commit()
    
    return result

async def reprocess_with_instructions(db: Session, feed_item, instructions: str, force_app_slug: str = None) -> dict:
    return await continue_agent_task(db, feed_item, f"Anweisung zur Überarbeitung: {instructions}", force_app_slug=force_app_slug)

async def reprocess_rejected_feed_item(db: Session, feed_item, feedback_text: str, force_app_slug: str = None) -> dict:
    return await continue_agent_task(db, feed_item, f"Aufgabe wurde abgelehnt. Grund: {feedback_text}. Bitte korrigieren.", force_app_slug=force_app_slug)

async def run_task_background(fid: int, tid: int, instruction: str, aid: int, workflow_id: int = None):
    from backend.database.engine import SessionLocal
    from backend.database.models import FeedItem as FI
    db = SessionLocal()
    try:
        item = db.query(FI).filter(FI.id == fid).first()
        if item and not item.agent_id:
            item.agent_id = aid
            db.commit()
            
        context = {"feed_item_id": fid}
        if workflow_id:
            context["workflow_id"] = workflow_id
        elif item and item.workflow_id:
            context["workflow_id"] = item.workflow_id
            
        result = await execute_agent_task(db, aid, tid, instruction, context)
        item = db.query(FI).filter(FI.id == fid).first()
        if not item or item.status != "processing":
            return
        if "error" in result or result.get("failed"):
            item.status = "pending"
            err_msg = result.get("error", result.get("response", "Unbekannter Fehler"))
            item.description = f"Fehler/Fehlgeschlagen: {str(err_msg)[:400]}"
            item.action_data_json = {**(item.action_data_json or {}), "error": str(err_msg)}
        else:
            is_handover = False
            
            # --- DYNAMISCHE HANDOVER LOGIK (AGENT-CHAINING / STAGES) ---
            if context.get("workflow_id"):
                from backend.database.models import Workflow, WorkflowAgent
                wf = db.query(Workflow).filter(Workflow.id == context["workflow_id"]).first()
                if wf and wf.config_json:
                    ad = dict(item.action_data_json or {})
                    current_index = ad.get("current_stage_index", 0)
                    stages = wf.config_json.get("stages", [])
                    
                    if stages and current_index < len(stages) - 1:
                        # Übergabe an nächste Stufe
                        is_handover = True
                        next_index = current_index + 1
                        next_stage = stages[next_index]
                        
                        next_agent_id = next_stage.get("agent_id")
                        if next_agent_id and str(next_agent_id).strip():
                            next_agent_id = int(next_agent_id)
                        else:
                            # Fallback Workflow-Agent
                            main_wf_agent = db.query(WorkflowAgent).filter(WorkflowAgent.workflow_id == wf.id).first()
                            if main_wf_agent: next_agent_id = main_wf_agent.agent_id
                            else:
                                from backend.database.models import Agent
                                def_ag = db.query(Agent).filter(Agent.tenant_id == tid, Agent.is_active == True, Agent.id != aid).first()
                                if def_ag: next_agent_id = def_ag.id
                        
                        if next_agent_id:
                            item.agent_id = next_agent_id
                            ad["current_stage_index"] = next_index
                            
                            # Original-Anweisung + Kontext sichern
                            orig_instr = ad.get("original_instruction", instruction)
                            ad["original_instruction"] = orig_instr
                            file_ctx = ad.get("file_context", "")
                            
                            item.action_data_json = ad
                            from sqlalchemy.orm.attributes import flag_modified
                            flag_modified(item, "action_data_json")
                            
                            class_res = result.get("response", "")
                            
                            from backend.database.models import AgentTraceStep
                            import datetime
                            step_num = db.query(AgentTraceStep).filter(AgentTraceStep.feed_item_id == fid).count() + 1
                            handover_step = AgentTraceStep(
                                feed_item_id=fid, step_number=step_num, action="SYSTEM_HANDOVER",
                                action_input=f"Stufe {current_index+1} beendet. Start Stufe {next_index+1}.",
                                observation=f"Übergabe an Agent #{next_agent_id}",
                                thought=f"Meine Aufgabe in Stufe {current_index+1} ist abgeschlossen. Ich übergebe das Resultat an den nächsten Agenten in der Prozesskette.",
                                next_step="Nächste Stufe ausführen", created_at=datetime.datetime.utcnow()
                            )
                            db.add(handover_step)
                            db.commit()
                            
                            new_instr = build_stage_instruction(db, tid, wf.id, next_index, orig_instr, class_res, file_ctx)
                            
                            import asyncio
                            asyncio.ensure_future(run_task_background(fid, tid, new_instr, next_agent_id, context["workflow_id"]))

                    # Legacy Fallback (falls noch keine Stages definiert, aber classifier_agent_id existiert)
                    elif not stages and wf.config_json.get("classifier_agent_id"):
                        classifier_id = int(wf.config_json["classifier_agent_id"])
                        # Endlos-Loop Fallback-Check durch current_stage_index
                        if classifier_id == aid and current_index == 0:
                            main_wf_agent = db.query(WorkflowAgent).filter(WorkflowAgent.workflow_id == context["workflow_id"]).first()
                            main_agent_id = main_wf_agent.agent_id if main_wf_agent else None
                            if not main_agent_id:
                                def_ag = db.query(Agent).filter(Agent.tenant_id == tid, Agent.is_active == True, Agent.id != aid).first()
                                if def_ag: main_agent_id = def_ag.id
                                
                            if main_agent_id and main_agent_id != aid:
                                is_handover = True
                                item.agent_id = main_agent_id
                                ad["current_stage_index"] = 1
                                orig_instr = ad.get("original_instruction", instruction.split("\n\n[SYSTEM-KLASSIFIZIERUNG]")[0].strip())
                                ad["original_instruction"] = orig_instr
                                file_ctx = ad.get("file_context", "")
                                
                                item.action_data_json = ad
                                from sqlalchemy.orm.attributes import flag_modified
                                flag_modified(item, "action_data_json")
                                class_res = result.get("response", "")
                                
                                from backend.database.models import AgentTraceStep
                                import datetime
                                step_num = db.query(AgentTraceStep).filter(AgentTraceStep.feed_item_id == fid).count() + 1
                                handover_step = AgentTraceStep(
                                    feed_item_id=fid, step_number=step_num, action="SYSTEM_HANDOVER",
                                    action_input=f"Weitergabe an Haupt-Agent #{main_agent_id}",
                                    observation=f"Initiale Klassifizierung abgeschlossen. Starte Haupt-Workflow.",
                                    thought="Das Dokument wurde erfolgreich klassifiziert. Ich übergebe die weitere Verarbeitung nun an den Haupt-Agenten.",
                                    next_step="Hauptaufgabe bearbeiten", created_at=datetime.datetime.utcnow()
                                )
                                db.add(handover_step)
                                db.commit()
                                
                                new_instr = f"{orig_instr}\n\n[SYSTEM-INFO]: Das Dokument wurde bereits vom Klassifizierungs-Agenten analysiert:\n{class_res}\n\nFühre nun die eigentliche Bearbeitung durch und schließe die Aufgabe ab!\n{file_ctx}"
                                import asyncio
                                asyncio.ensure_future(run_task_background(fid, tid, new_instr, main_agent_id, context["workflow_id"]))

            if not is_handover:
                if result.get("auto_archived"):
                    item.status = "archived"
                    item.result_json = {"auto_archived": True, "reason": result.get("response")}
                else:
                    item.status = "pending"
                    
                item.description = result["response"][:500]
                item.action_data_json = {
                    **(item.action_data_json or {}),
                    "analysis": result["response"],
                    "recommended_action": result.get("recommended_action", ""),
                    "agent_name": result.get("agent", ""),
                }
        db.commit()
    except Exception as exc:
        try:
            item = db.query(FI).filter(FI.id == fid).first()
            if item:
                item.status = "pending"
                item.description = f"Fehler: {str(exc)[:400]}"
                item.action_data_json = {**(item.action_data_json or {}), "error": str(exc)}
                db.commit()
        except:
            pass
    finally:
        db.close()







