import json
import logging
from sqlalchemy.orm import Session
from backend.services import llm_service, db_schema_service, workflow_service
from backend.database.models import Agent, Workflow, DataStructure, WorkflowAgent, WorkflowDataStructure, WorkflowTrigger

logger = logging.getLogger(__name__)

SYSTEM_ARCHITECTURE_PROMPT = """Du bist der OpenAMS System-Architekt. Deine Aufgabe ist es, basierend auf einer Benutzeranforderung ein komplettes technisches Setup innerhalb von OpenAMS zu entwerfen.

KENNTNISSE ÜBER DAS SYSTEM:
OpenAMS besteht aus folgenden Komponenten:
1. DATENSTRUKTUREN: Tabellen mit einem Schema. Schema-Format: {"fields": [{"name": "col_name", "type": "string|integer|boolean|float", "required": true/false}]}.
2. AGENTEN: Haben einen system_prompt und system_tools (execsql, insert_record, set_memory, get_database_schema).
3. WORKFLOWS: Steuern den Prozess. config_json enthält "stages": [{"agent_id": int_or_null, "target_ds": "slug_of_ds", "instruction": "..."}].
4. TRIGGERS: Automatischer Start (interval, folder_watch, email_fetch).

DEINE AUFGABE:
Analysiere die Anforderung und erstelle einen detaillierten Plan.
Antworte IMMER im folgenden JSON Format (kein Markdown drumherum!), damit das System die Befehle ausführen kann:

{
  "explanation": "Eine verständliche Erklärung für den Benutzer, wie der Workflow funktionieren wird.",
  "plan": [
    {
      "type": "create_data_structure",
      "payload": { "name": "Anzeigename", "slug": "einzigartiger-slug", "description": "...", "category": "custom", "schema_json": {"fields": [...]} }
    },
    {
      "type": "create_agent",
      "payload": { "name": "Agent Name", "description": "...", "system_prompt": "...", "llm_model": "qwen-large", "llm_temperature": 0.4, "system_tools": ["execsql", "insert_record", "get_database_schema", "set_memory"] }
    },
    {
      "type": "create_workflow",
      "payload": { "name": "Workflow Name", "slug": "workflow-slug", "category": "custom", "description": "...", "has_menu_entry": true, "has_feed": true, "config_json": { "stages": [] } }
    }
  ],
  "links": [
     { "type": "assign_agent_to_workflow", "workflow_index": 0, "agent_index": 0, "role": "executor" },
     { "type": "assign_ds_to_workflow", "workflow_index": 0, "ds_index": 0, "permission": "RW" }
  ]
}

WICHTIGE REGELN:
- Nutze Indizes (agent_index, workflow_index, ds_index), um auf Elemente zu referenzieren, die du im selben Plan erstellst (0-basiert).
- Erstelle sinnvolle, spezialisierte system_prompts für die Agenten.
- Definiere präzise Daten-Schemata.
- Wenn eine Datenstruktur für Dokumente ist, füge immer ein Feld 'document_id' (integer) hinzu.
"""

async def generate_proposal(db: Session, tenant_id: int, instruction: str):
    """
    Erzeugt einen Entwurf (Plan) basierend auf der Benutzer-Anweisung.
    """
    from backend.database.models import Setting
    
    # Spezifisches Modell für den Wizard laden, sonst System-Default
    wizard_cfg = db.query(Setting).filter(Setting.key == "wizard_model", Setting.tenant_id.is_(None)).first()
    use_model = wizard_cfg.value_json.get("value") if wizard_cfg else None

    # Wir laden bestehende Strukturen als Kontext, damit der Wizard nicht alles neu erfinden muss
    existing_ds = db.query(DataStructure).filter(DataStructure.tenant_id == tenant_id).all()
    existing_agents = db.query(Agent).filter(Agent.tenant_id == tenant_id).all()
    
    ctx = f"\nVORHANDENE STRUKTUREN (Nutze diese wenn möglich):\n"
    ctx += f"Agenten: {', '.join([f'{a.name} (ID:{a.id})' for a in existing_agents])}\n"
    ctx += f"Datenstrukturen: {', '.join([f'{d.name} (Slug:{d.slug})' for d in existing_ds])}\n"

    try:
        response_raw = await llm_service.chat_completion(
            db,
            messages=[
                {"role": "system", "content": SYSTEM_ARCHITECTURE_PROMPT},
                {"role": "user", "content": f"MANDANTEN_ID: {tenant_id}{ctx}\n\nANFORDERUNG: {instruction}"}
            ],
            model=use_model,
            temperature=0.2 # Niedrige Temp für präzises JSON
        )
        
        # Säuberung (falls LLM Markdown nutzt)
        clean_json = response_raw.strip()
        if "```json" in clean_json:
            clean_json = clean_json.split("```json")[1].split("```")[0].strip()
        elif "```" in clean_json:
            clean_json = clean_json.split("```")[1].split("```")[0].strip()
            
        return json.loads(clean_json)
    except Exception as e:
        logger.error(f"Wizard Plan generation failed: {e}")
        raise e

async def execute_plan(db: Session, tenant_id: int, plan_data: dict):
    """
    Setzt den generierten und ggf. vom Benutzer bestätigten Plan physisch um.
    """
    results = {
        "data_structures": [],
        "agents": [],
        "workflows": []
    }
    
    # 1. Datenstrukturen anlegen
    for item in plan_data.get("plan", []):
        if item["type"] == "create_data_structure":
            p = item["payload"]
            # Check if slug exists
            existing = db.query(DataStructure).filter(DataStructure.tenant_id == tenant_id, DataStructure.slug == p["slug"]).first()
            if not existing:
                ds = DataStructure(tenant_id=tenant_id, **p)
                db.add(ds)
                db.flush()
                db_schema_service.sync_dynamic_table(db, tenant_id, ds.slug, ds.schema_json)
                results["data_structures"].append(ds)
            else:
                results["data_structures"].append(existing)

        elif item["type"] == "create_agent":
            p = item["payload"]
            agent = Agent(tenant_id=tenant_id, **p)
            db.add(agent)
            db.flush()
            results["agents"].append(agent)

        elif item["type"] == "create_workflow":
            p = item["payload"]
            # Slugs innerhalb von Workflows sind nicht unique über Tenants hinweg, aber wir prüfen trotzdem
            wf = Workflow(tenant_id=tenant_id, **p)
            db.add(wf)
            db.flush()
            results["workflows"].append(wf)

    # 2. Verknüpfungen (Links) herstellen
    for link in plan_data.get("links", []):
        try:
            wf = results["workflows"][link["workflow_index"]]
            
            if link["type"] == "assign_agent_to_workflow":
                ag = results["agents"][link["agent_index"]]
                wa = WorkflowAgent(workflow_id=wf.id, agent_id=ag.id, role=link.get("role", "executor"))
                db.add(wa)
                
                # Wir aktualisieren die Workflow-Config Stages, falls sie noch leer sind
                if not wf.config_json or not wf.config_json.get("stages"):
                    wf.config_json = {"stages": [{"agent_id": ag.id, "instruction": "Bearbeite die Aufgabe basierend auf deinem System-Prompt."}]}

            elif link["type"] == "assign_ds_to_workflow":
                ds = results["data_structures"][link["ds_index"]]
                wds = WorkflowDataStructure(workflow_id=wf.id, data_structure_id=ds.id, permission=link.get("permission", "RW"))
                db.add(wds)
        except Exception as le:
            logger.warning(f"Link failed: {le}")

    db.commit()
    return {"status": "ok", "created_counts": {k: len(v) for k, v in results.items()}}



