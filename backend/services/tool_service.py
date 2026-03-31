import json
from sqlalchemy.orm import Session
from backend.database.models import DataStructure, WorkflowMCPModule, MCPModule, WorkflowA2AModule, A2AModule
from backend.services import mcp_service, a2a_service


def get_system_tools() -> list[dict]:
    """
    Definiert die Basis-Werkzeuge des Systems.
    """
    return [
        {
            "name": "submit_final_result",
            "description": "PFLICHT: Beendet die Aufgabe und liefert das Ergebnis an den Benutzer zurück. Das Ergebnis MUSS die eigentliche inhaltliche Antwort enthalten (nicht nur 'success').",
            "parameters": {
                "final_answer": "Die vollständige, detaillierte Antwort, Zusammenfassung oder Information für den Benutzer.",
                "recommended_action": "Optional: Konkrete Handlungsempfehlung für den Administrator (Was soll der Mensch als Nächstes tun?)."
            }
        },
        {
            "name": "update_priority",
            "description": "Passt die Priorität/Dringlichkeit des aktuellen Vorgangs an. Nutze dies, wenn du erkennst, dass ein Vorgang besonders eilig (z.B. Fristsetzung, Beschwerde) oder unwichtig ist.",
            "parameters": {
                "priority": "Ganzzahl von 1 (sehr niedrig) bis 10 (kritisch/sofort)."
            }
        },
        {
            "name": "mark_as_irrelevant",
            "description": "Markiert den aktuellen Vorgang (z.B. Spam-Mail, Newsletter, irrelevante Info) als irrelevant. Der Vorgang wird sofort archiviert und erfordert KEINE menschliche Bearbeitung. Verwende dies anstelle von submit_final_result, wenn der Vorgang völlig unwichtig ist.",
            "parameters": {"reason": "Eine detaillierte Begründung, warum dieser Vorgang ignoriert/archiviert wird. Wichtig für das Audit-Log."}
        },
        {
            "name": "mark_as_failed",
            "description": "Markiert den aktuellen Vorgang als fehlgeschlagen. Nutze dieses Tool NUR, wenn ein unlösbarer technischer Fehler auftritt (z.B. Datenbank-Tabelle fehlt, Berechtigungen verweigert) und du die Aufgabe unmöglich abschließen kannst.",
            "parameters": {"reason": "Eine genaue technische Beschreibung des Fehlers für den Administrator."}
        },
        {
            "name": "propose_app_action",
            "description": "Schlägt dem Benutzer vor, eine bestimmte App zu öffnen (z.B. E-Mail senden). WICHTIG: Bereite die Daten in 'app_data' sorgfältig vor. Nutze konsequent XML-Tags innerhalb deiner Gedanken (<thought>), um die Inhalte zu strukturieren. OpenAMS verwendet KEIN JSON für KI-generierte Inhalte.",
            "parameters": {
                "app_slug": "Der Slug der App (z.B. 'email-sender')",
                "app_data": "Ein Dictionary-Objekt mit den extrahierten Feldern."
            }
        },
        {
            "name": "execsql",
            "description": "Nur verwenden, wenn SQL-TABELLEN in deinem Kontext aufgeführt sind. Erlaubt SQL-Operationen auf freigegebenen Tabellen.",
            "parameters": {"query": "Die auszuführende SQL-Anweisung"}
        },
        {
            "name": "insert_record",
            "description": "Nur verwenden, wenn eine Ziel-Tabelle (Slug) in deinem Kontext definiert ist. Speichert strukturierte Daten.",
            "parameters": {
                "slug": "Der Slug der Ziel-Datenstruktur (z.B. 'dokumente')",
                "data": "Das JSON Objekt mit den Werten für die Spalten"
            }
        },
        {
            "name": "set_memory",
            "description": "Speichert eine kurze, sachliche Erinnerung (Key-Value), die bei zukünftigen Aufgaben in diesem Mandanten automatisch in den Kontext geladen wird. Nützlich für spezifische Lerninhalte (z.B. Besonderheiten bei Lieferantenrechnungen).",
            "parameters": {
                "key": "Eindeutiger, großgeschriebener Schlüssel", 
                "value": "Die zu merkende Information",
                "context_description": "(Optional) Kurze Beschreibung, auf was sich diese Erinnerung bezieht (z.B. 'Rechnungen von Lieferant XY')"
            }
        },
        {
            "name": "delete_memory",
            "description": "Löscht eine bestehende Erinnerung anhand ihres Schlüssels.",
            "parameters": {"key": "Der zu löschende Schlüssel"}
        },
        {
            "name": "get_database_schema",
            "description": "Zeigt alle verfügbaren Tabellen, Spalten und Datentypen im aktuellen Workflow als einfachen Text an. Hilfreich vor INSERT-Befehlen.",
            "parameters": {}
        }
    ]


def get_workflow_tools(db: Session, tenant_id: int, workflow_id: int, agent_id: int = None) -> list[dict]:
    """
    Sammelt alle verfügbaren Tools (System + MCP) für den aktuellen Kontext und Agenten.
    """
    tools = []
    all_system_tools = get_system_tools()
    
    # Zwingende Basis-Tools (immer vorhanden)
    mandatory = ["submit_final_result", "update_priority", "mark_as_irrelevant", "mark_as_failed", "propose_app_action"]
    for mt in mandatory:
        tools.append(next(t for t in all_system_tools if t["name"] == mt))
    
    # Agenten-spezifische System-Tools (Filterung: SQL-Tools nur wenn Tabellen da sind)
    has_sql_access = False
    if workflow_id:
        from backend.database.models import WorkflowDataStructure
        count = db.query(WorkflowDataStructure).filter(WorkflowDataStructure.workflow_id == workflow_id).count()
        if count > 0:
            has_sql_access = True

    if agent_id:
        from backend.database.models import Agent
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        if agent and agent.system_tools:
            for st_name in agent.system_tools:
                # SQL-Tools Schutz: Nicht anbieten, wenn kein Zugriff konfiguriert ist
                if st_name in ["execsql", "insert_record", "get_database_schema"] and not has_sql_access:
                    continue
                
                st = next((t for t in all_system_tools if t["name"] == st_name), None)
                if st and st_name not in mandatory:
                    tools.append(st)
        elif agent and not agent.system_tools:
            pass # Wenn Liste explizit leer, dann keine weiteren System-Tools
        else:
            # Fallback (Legacy)
            for t in all_system_tools:
                if t["name"] not in mandatory: tools.append(t)
    else:
        for t in all_system_tools:
            if t["name"] not in mandatory: tools.append(t)

    # 2. Workflow-spezifische MCP-Module
    if workflow_id:
        linked_mcps = db.query(MCPModule).join(
            WorkflowMCPModule, WorkflowMCPModule.mcp_module_id == MCPModule.id
        ).filter(WorkflowMCPModule.workflow_id == workflow_id, MCPModule.is_active == True).all()

        for mcp in linked_mcps:
            caps = mcp.capabilities_json or {}
            
            # Read Capabilities
            for read_cap in caps.get("read", []):
                tools.append({
                    "name": f"mcp_read_{mcp.slug}_{read_cap}",
                    "description": f"Modul '{mcp.name}': Liest '{read_cap}'.",
                    "parameters": {"params": "Suchparameter/Filter als JSON"}
                })
            
            # Write Capabilities
            for write_cap in caps.get("write", []):
                tools.append({
                    "name": f"mcp_write_{mcp.slug}_{write_cap}",
                    "description": f"Modul '{mcp.name}': BEREITET Schreibvorgang '{write_cap}' zur manuellen Freigabe vor. Führt die Aktion NICHT sofort aus. Nutze dies, um Daten für den Administrator vorzuschlagen.",
                    "parameters": {"params": "Payload als JSON"}
                })

        # 3. Workflow-spezifische A2A-Module
        linked_a2as = db.query(A2AModule).join(
            WorkflowA2AModule, WorkflowA2AModule.a2a_module_id == A2AModule.id
        ).filter(WorkflowA2AModule.workflow_id == workflow_id, A2AModule.is_active == True).all()

        for a2a in linked_a2as:
            caps = a2a.capabilities_json or {}
            
            for read_cap in caps.get("read", []):
                tools.append({
                    "name": f"a2a_read_{a2a.slug}_{read_cap}",
                    "description": f"A2A-Modul '{a2a.name}': Liest Informationen von anderem Agenten/System '{read_cap}'.",
                    "parameters": {"params": "Suchparameter/Filter als JSON"}
                })
            
            for write_cap in caps.get("write", []):
                tools.append({
                    "name": f"a2a_write_{a2a.slug}_{write_cap}",
                    "description": f"A2A-Modul '{a2a.name}': Beauftragt anderen Agenten/System '{write_cap}'. BEREITET Vorgang zur manuellen Freigabe durch den Administrator vor. Führt die Delegation NICHT sofort aus.",
                    "parameters": {"params": "Payload/Anweisungen als JSON"}
                })

    return tools


def get_tools_text_description(tools: list[dict]) -> str:
    """
    Erstellt die 'Speisekarte' für den Agenten im Text-Format für den System-Prompt.
    """
    if not tools:
        return "(Keine Tools verfügbar)"
    
    lines = []
    for t in tools:
        name = t.get("name")
        desc = t.get("description", "")
        params = t.get("parameters", {})
        
        p_list = []
        for k, v in params.items():
            p_list.append(f'"{k}": "..."')
        
        json_example = "{" + ", ".join(p_list) + "}"
        usage = f"<tool_name>{name}</tool_name>\n<tool_args>{json_example}</tool_args>"
        
        lines.append(f"TOOL: {name}\nDESC: {desc}\nUSAGE:\n{usage}\n")
    
    return "\n".join(lines)


def execute_tool(db: Session, tenant_id: int, context_dict: dict, tool_name: str, action_input: any) -> str:
    # WICHTIGER HINWEIS: Da Agenten nun XML liefern, muss dieser Parser 
    # sowohl JSON (Legacy/System) als auch XML-Tags verarbeiten können.
    
    workflow_id = context_dict.get("workflow_id") if isinstance(context_dict, dict) else None
    
    # 1. Input Normalization
    arguments = {}
    if isinstance(action_input, dict):
        arguments = action_input
    elif isinstance(action_input, str):
        inp = action_input.strip()
        
        # Versuch A: JSON (für System-Calls)
        if inp.startswith("{") and inp.endswith("}"):
            try:
                arguments = json.loads(inp)
            except: pass
            
        # Versuch B: XML-Tag Extraktion (Primärweg für Agenten)
        if not arguments:
            import re
            # Wir suchen nach allen einfachen Tags <key>value</key>
            tags = re.findall(r'<([^>/]+)>([\s\S]*?)</\1>', inp)
            if tags:
                for tag, val in tags:
                    arguments[tag.strip()] = val.strip()
            
        # Versuch C: Fallback auf String
        if not arguments:
            arguments = {"params": inp, "raw": inp}

    try:
        if tool_name.upper() == "SUBMIT_FINAL_RESULT":
            return "DONE" # Signal für den Agent-Loop

        elif tool_name == "update_priority":
            prio = arguments.get("priority")
            feed_item_id = context_dict.get("feed_item_id")
            if not feed_item_id:
                return "FEHLER: Tool erfordert einen Feed-Kontext."
            
            try:
                prio_int = int(prio)
                if prio_int < 1: prio_int = 1
                if prio_int > 10: prio_int = 10
                
                from backend.database.models import FeedItem
                item = db.query(FeedItem).filter(FeedItem.id == feed_item_id).first()
                if item:
                    item.priority = prio_int
                    db.commit()
                    return f"ERFOLG: Priorität auf {prio_int} geändert."
                return "FEHLER: Feed-Item nicht gefunden."
            except:
                return f"FEHLER: Ungültige Priorität '{prio}'. Muss eine Zahl zwischen 1 und 10 sein."

        elif tool_name == "propose_app_action":
            app_slug = arguments.get("app_slug")
            app_data = arguments.get("app_data", {})
            
            if not app_slug:
                return json.dumps({"error": "Parameter 'app_slug' fehlt."})

            feed_item_id = context_dict.get("feed_item_id") if isinstance(context_dict, dict) else None
            
            # Falls Feed-Kontext existiert, speichern wir den Vorschlag dort
            if feed_item_id:
                from backend.database.models import FeedItem
                item = db.query(FeedItem).filter(FeedItem.id == feed_item_id).first()
                if item:
                    ad = item.action_data_json or {}
                    ad["proposed_app"] = {
                        "slug": app_slug,
                        "data": app_data
                    }
                    item.action_data_json = ad
                    db.commit()
                    return json.dumps({"status": "success", "message": f"App '{app_slug}' zur Ausführung vorgeschlagen. Der Administrator wird aufgefordert, die App zu öffnen."})
                return json.dumps({"error": "Feed-Item nicht gefunden."})
            else:
                # Modus für Tooltester / Simulation ohne Feed-Kontext
                return json.dumps({
                    "status": "success", 
                    "simulation": True,
                    "message": f"Simulation: App '{app_slug}' wurde erfolgreich validiert (kein Feed-Kontext vorhanden).",
                    "data": {
                        "app_slug": app_slug,
                        "payload": app_data
                    }
                }, ensure_ascii=False)

        elif tool_name == "set_memory":
            key = arguments.get("key", "").strip().upper()
            val = arguments.get("value", "").strip()
            ctx_desc = arguments.get("context_description", "").strip()
            
            if not key or not val:
                return json.dumps({"error": "Key und Value sind erforderlich."})
            
            # Context erfassen (Workflow, Dokument, Task, Agenten-Beschreibung)
            mem_ctx = {}
            if ctx_desc: mem_ctx["description"] = ctx_desc
            
            if isinstance(context_dict, dict):
                if context_dict.get("workflow_id"): mem_ctx["workflow_id"] = context_dict["workflow_id"]
                if context_dict.get("document_id"): mem_ctx["document_id"] = context_dict["document_id"]
                if context_dict.get("task_id"): mem_ctx["task_id"] = context_dict["task_id"]
            
            from backend.database.models import AgentMemory
            existing = db.query(AgentMemory).filter(AgentMemory.tenant_id == tenant_id, AgentMemory.key == key).first()
            if existing:
                existing.value = val
                merged_ctx = existing.context_json or {}
                merged_ctx.update(mem_ctx)
                existing.context_json = merged_ctx
                db.commit()
                return json.dumps({"status": "success", "message": f"Memory '{key}' erfolgreich aktualisiert."})
            else:
                new_mem = AgentMemory(tenant_id=tenant_id, key=key, value=val, context_json=mem_ctx)
                db.add(new_mem)
                db.commit()
                return json.dumps({"status": "success", "message": f"Memory '{key}' erfolgreich gespeichert."})

        elif tool_name == "delete_memory":
            key = arguments.get("key", "").strip().upper()
            if not key:
                return json.dumps({"error": "Key ist erforderlich."})
            
            from backend.database.models import AgentMemory
            existing = db.query(AgentMemory).filter(AgentMemory.tenant_id == tenant_id, AgentMemory.key == key).first()
            if existing:
                db.delete(existing)
                db.commit()
                return json.dumps({"status": "success", "message": f"Memory '{key}' erfolgreich gelöscht."})
            else:
                return json.dumps({"error": f"Memory '{key}' nicht gefunden."})

        elif tool_name == "insert_record":
            slug = arguments.get("slug")
            data = arguments.get("data", {})
            
            ds = db.query(DataStructure).filter(DataStructure.tenant_id == tenant_id, DataStructure.slug == slug).first()
            if not ds:
                return f"FEHLER: Datenstruktur '{slug}' nicht gefunden."
            
            from backend.services.data_service import validate_record_data
            is_valid, err = validate_record_data(ds.schema_json or {}, data)
            
            if not is_valid:
                schema_str = json.dumps(ds.schema_json.get("fields", []), ensure_ascii=False)
                return f"VALIDIERUNGSFEHLER: {err}\nBitte korrigiere deine 'data' Parameter! Erwartetes Schema für '{slug}': {schema_str}"
                
            try:
                from backend.services.db_schema_service import insert_dynamic_record
                rec = insert_dynamic_record(db, tenant_id, slug, data)
                return json.dumps({
                    "status": "success", 
                    "message": "Datensatz erfolgreich angelegt.", 
                    "inserted_id": rec.get("id")
                }, ensure_ascii=False)
            except Exception as e:
                return f"DATENBANKFEHLER beim Speichern: {str(e)}"

        elif tool_name == "execsql":
            from sqlalchemy import text
            from backend.database.models import WorkflowDataStructure
            from backend.services.db_schema_service import _get_table_name
            
            if not workflow_id:
                return "FEHLER: SQL Ausführung erfordert einen aktiven Workflow-Kontext."

            links = db.query(WorkflowDataStructure).filter(WorkflowDataStructure.workflow_id == workflow_id).all()
            if not links:
                return "FEHLER: Diesem Workflow sind keine Datenstrukturen zugewiesen."

            allowed_tables_write = set()
            for link in links:
                ds = db.query(DataStructure).get(link.data_structure_id)
                if not ds or ds.tenant_id != tenant_id: continue
                if link.permission == "RW":
                    allowed_tables_write.add(_get_table_name(tenant_id, ds.slug).upper())

            query_str = arguments.get("query", "")
            query_upper = query_str.upper().strip()
            
            # Basis-Sicherheit gegen Tabellen-Zerstörung
            if any(query_upper.startswith(kw) for kw in ["CREATE", "DROP", "ALTER", "TRUNCATE"]):
                return "FEHLER: DDL-Befehle (CREATE, DROP, ALTER) sind aus Sicherheitsgründen gesperrt."
                
            # Schreibberechtigungen über einfachen Text-Check absichern
            is_write = any(query_upper.startswith(kw) for kw in ["INSERT", "UPDATE", "DELETE"])
            if is_write:
                table_found = any(t in query_upper for t in allowed_tables_write)
                if not table_found and allowed_tables_write:
                    return f"FEHLER: Keine Schreibberechtigung. Erlaubte Tabellen für Schreibzugriff in diesem Workflow: {', '.join(allowed_tables_write)}"

            try:
                res = db.execute(text(query_str))
                db.commit()
                
                if query_upper.startswith("SELECT"):
                    data = [dict(row._mapping) for row in res]
                    return json.dumps({
                        "status": "success",
                        "rows_returned": len(data),
                        "data": data,
                    }, ensure_ascii=False)
                else:
                    return json.dumps({
                        "status": "success",
                        "rows_affected": res.rowcount
                    }, ensure_ascii=False)

            except Exception as e:
                db.rollback()
                return f"FEHLER bei SQL-Ausführung: {str(e)}"


        elif tool_name == "get_database_schema":
            from backend.database.models import WorkflowDataStructure
            if not workflow_id:
                return "FEHLER: Erfordert einen aktiven Workflow-Kontext."
            
            links = db.query(WorkflowDataStructure).filter(WorkflowDataStructure.workflow_id == workflow_id).all()
            
            from backend.services.db_schema_service import _get_table_name
            out = "Verfügbare Datenbank-Tabellen:\n\n"
            for link in links:
                ds = db.query(DataStructure).get(link.data_structure_id)
                if not ds or ds.tenant_id != tenant_id: continue
                t_name = _get_table_name(tenant_id, ds.slug)
                fields = ds.schema_json.get("fields", [])
                
                cols = []
                for f in fields:
                    req = "*" if f.get("required") else ""
                    cols.append(f"- {f['name']}{req} ({f.get('type', 'string')}) : {f.get('description', '')}")
                
                out += f"SQL-Tabelle (für 'execsql'): {t_name} (Rechte: {link.permission})\n"
                out += f"Slug (für 'insert_record'): {ds.slug}\n"
                out += f"Zweck: {ds.description or ds.name}\n"
                out += f"Spalten:\n- id (integer) [Auto-Generiert]\n"
                out += "\n".join(cols) + "\n\n"
                
            out += "TIPP: Nutze das 'execsql' Tool mit Standard SQL (z.B. INSERT INTO), um Daten zu schreiben."
            return out

        elif tool_name.startswith("a2a_read_") or tool_name.startswith("a2a_write_"):
            active_modules = db.query(A2AModule).filter(A2AModule.is_active == True).all()
            target_mod = None
            target_method = None
            
            is_write = tool_name.startswith("a2a_write_")
            prefix = "a2a_write_" if is_write else "a2a_read_"
            remainder = tool_name[len(prefix):]

            for mod in active_modules:
                if remainder.startswith(mod.slug + "_"):
                    target_mod = mod
                    target_method = remainder[len(mod.slug)+1:]
                    break
            
            if target_mod and target_method:
                params = arguments if isinstance(arguments, dict) else {"raw": arguments}
                if "params" in params and isinstance(params["params"], dict):
                    params = params["params"]

                if is_write:
                    feed_item_id = context_dict.get("feed_item_id") if isinstance(context_dict, dict) else None
                    if feed_item_id:
                        from backend.database.models import FeedItem
                        item = db.query(FeedItem).filter(FeedItem.id == feed_item_id).first()
                        if item:
                            ad = item.action_data_json or {}
                            existing_exec = ad.get("execute_on_approve")
                            new_exec = {
                                "type": "a2a_write",
                                "description": f"Agenten-Delegation via {target_mod.name} ({target_method})",
                                "a2a_slug": target_mod.slug,
                                "method": target_method,
                                "params": params
                            }
                            
                            if existing_exec:
                                if isinstance(existing_exec, list):
                                    existing_exec.append(new_exec)
                                else:
                                    existing_exec = [existing_exec, new_exec]
                                ad["execute_on_approve"] = existing_exec
                            else:
                                ad["execute_on_approve"] = [new_exec]
                                
                            item.action_data_json = ad
                            db.commit()
                            
                        return json.dumps({
                            "status": "staged", 
                            "message": f"Delegation an externen Agenten erfolgreich zur Freigabe vorgemerkt (Modul: {target_mod.name}, Methode: {target_method})."
                        }, ensure_ascii=False)
                    else:
                        result = a2a_service.execute_write(target_mod.slug, db, target_method, params)
                        return json.dumps(result, ensure_ascii=False)
                else:
                    result = a2a_service.execute_read(target_mod.slug, db, target_method, params)
                    return json.dumps(result, ensure_ascii=False)
            else:
                return json.dumps({"error": f"A2A-Modul oder Methode für '{tool_name}' nicht gefunden oder inaktiv."})

        elif tool_name.startswith("mcp_read_") or tool_name.startswith("mcp_write_"):
            # Wir suchen das passende Modul in der DB
            active_modules = db.query(MCPModule).filter(MCPModule.is_active == True).all()
            target_mod = None
            target_method = None
            
            is_write = tool_name.startswith("mcp_write_")
            prefix = "mcp_write_" if is_write else "mcp_read_"
            remainder = tool_name[len(prefix):]

            for mod in active_modules:
                if remainder.startswith(mod.slug + "_"):
                    target_mod = mod
                    target_method = remainder[len(mod.slug)+1:]
                    break
            
            if target_mod and target_method:
                # MCP params extraction
                params = arguments if isinstance(arguments, dict) else {"raw": arguments}
                # Support nested 'params' key if the agent wrapped it
                if "params" in params and isinstance(params["params"], dict):
                    params = params["params"]

                if is_write:
                    # Governance: Intercept MCP writes and stage them for human approval
                    feed_item_id = context_dict.get("feed_item_id") if isinstance(context_dict, dict) else None
                    
                    if feed_item_id:
                        from backend.database.models import FeedItem
                        item = db.query(FeedItem).filter(FeedItem.id == feed_item_id).first()
                        if item:
                            ad = item.action_data_json or {}
                            existing_exec = ad.get("execute_on_approve")
                            new_exec = {
                                "type": "mcp_write",
                                "description": f"Schreibzugriff via {target_mod.name} ({target_method})",
                                "mcp_slug": target_mod.slug,
                                "method": target_method,
                                "params": params
                            }
                            
                            if existing_exec:
                                if isinstance(existing_exec, list):
                                    existing_exec.append(new_exec)
                                else:
                                    existing_exec = [existing_exec, new_exec]
                                ad["execute_on_approve"] = existing_exec
                            else:
                                ad["execute_on_approve"] = [new_exec]
                                
                            item.action_data_json = ad
                            db.commit()
                            
                        return json.dumps({
                            "status": "staged", 
                            "message": f"Erfolgreich zur Freigabe vorgemerkt (Modul: {target_mod.name}, Methode: {target_method}). Dieser Schreibvorgang wird erst nach Abschluss der Aufgabe durch den Administrator ausgeführt. Du kannst nun weitere Tools nutzen oder 'submit_final_result' aufrufen."
                        }, ensure_ascii=False)
                    else:
                        # Fallback for direct execution outside of Agent Workflows (e.g. Systemwerkzeuge / Tooltester)
                        result = mcp_service.execute_write(target_mod.slug, db, target_method, params)
                        return json.dumps(result, ensure_ascii=False)
                else:
                    result = mcp_service.execute_read(target_mod.slug, db, target_method, params)
                    return json.dumps(result, ensure_ascii=False)
            else:
                return json.dumps({"error": f"MCP-Modul oder Methode für '{tool_name}' nicht gefunden oder inaktiv."})

        active_tools = get_workflow_tools(db, tenant_id, workflow_id)
        tools_desc = get_tools_text_description(active_tools)
        
        # Spezialfall: Agent versucht SQL ohne Tabellen
        if tool_name in ["execsql", "insert_record", "get_database_schema"]:
            return "FEHLER: Du hast für diesen Workflow keinen Datenbank-Zugriff. Erledige die Aufgabe inhaltlich und antworte direkt per 'submit_final_result'."

        return json.dumps({
            "error": f"Unbekanntes Tool: '{tool_name}'. Bitte erfinde keine eigenen Tools, sondern verwende AUSSCHLIESSLICH eines der folgenden erlaubten Tools:\n{tools_desc}"
        })

    except Exception as e:
        return json.dumps({"error": f"Fehler bei Tool-Ausführung: {str(e)}"})



