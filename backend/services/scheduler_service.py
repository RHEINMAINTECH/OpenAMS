import asyncio
import datetime
import os
import logging
from sqlalchemy.orm import Session
from backend.database.engine import SessionLocal
from backend.database.models import WorkflowTrigger, Workflow, FeedItem, FileAsset, Agent, WorkflowAgent
from backend.services import file_service, feed_service, agent_service

logger = logging.getLogger(__name__)

_scheduler_task = None
_stop_event = asyncio.Event()

def start_scheduler():
    global _scheduler_task
    _stop_event.clear()
    _scheduler_task = asyncio.create_task(_loop())

def stop_scheduler():
    _stop_event.set()

async def _loop():
    while not _stop_event.is_set():
        await asyncio.sleep(15)  # Check every 15 seconds
        db = SessionLocal()
        try:
            now = datetime.datetime.utcnow()
            triggers = db.query(WorkflowTrigger).filter(WorkflowTrigger.is_active == True).all()
            for t in triggers:
                if t.next_run and t.next_run > now:
                    continue
                
                try:
                    if t.trigger_type == "folder_watch":
                        await _process_folder_watch(db, t)
                    elif t.trigger_type == "interval":
                        await _process_interval(db, t)
                    elif t.trigger_type == "email_fetch":
                        await _process_email_fetch(db, t)
                except Exception as e:
                    logger.error(f"Error processing workflow trigger ID {t.id}: {e}")
                
                interval = int(t.config_json.get("interval_minutes", 60))
                t.last_run = datetime.datetime.utcnow()
                t.next_run = t.last_run + datetime.timedelta(minutes=max(1, interval))
                db.commit()
        except Exception as e:
            logger.error(f"Scheduler loop error: {e}")
        finally:
            db.close()

async def _process_folder_watch(db: Session, trigger: WorkflowTrigger):
    folder_path = trigger.config_json.get("folder_path")
    if not folder_path or not os.path.isdir(folder_path):
        return
        
    wf = trigger.workflow
    tenant_id = wf.tenant_id
    wf_config = wf.config_json or {}
    
    # Priority for Folder Watch: Stage 0 Agent > Classifier Agent > Workflow Assigned Agent > Default Agent
    stages = wf_config.get("stages", [])
    if stages and stages[0].get("agent_id"):
        agent_id = int(stages[0]["agent_id"])
    elif wf_config.get("classifier_agent_id"):
        agent_id = int(wf_config.get("classifier_agent_id"))
    else:
        wf_agent = db.query(WorkflowAgent).filter(WorkflowAgent.workflow_id == wf.id).first()
        agent_id = wf_agent.agent_id if wf_agent else None
    
    if not agent_id:
        agent = agent_service.find_available_agent(db, tenant_id, wf.id)
        if agent: agent_id = agent.id
        else: return

    existing_docs = {d[0] for d in db.query(FileAsset.filename).filter(FileAsset.tenant_id == tenant_id).all()}
    
    for fname in os.listdir(folder_path):
        if not fname.lower().endswith(".pdf"): continue
        if fname in existing_docs: continue
        
        fpath = os.path.join(folder_path, fname)
        if not os.path.isfile(fpath): continue
        
        with open(fpath, "rb") as f:
            content = f.read()
            
        wf_config = wf.config_json or {}
        fp = wf_config.get("file_processing", {})
        pdf_strategy = fp.get("pdf", "auto")
        image_strategy = fp.get("image", "ocr")
        
        doc = file_service.create_file_asset(db, tenant_id, fname, content, "application/pdf", pdf_strategy, image_strategy)
        
        if doc.extracted_text and len(doc.extracted_text.strip()) > 10:
            base_instruction = trigger.config_json.get("instruction", f"Bitte verarbeite das neue Dokument: {fname}")
            # Voller Text für Folder-Watch Importe
            file_context = f"\n\n=== DOKUMENTEN-TEXT ===\n{doc.extracted_text}"
            
            from backend.services.agent_service import build_stage_instruction
            full_instruction = build_stage_instruction(db, tenant_id, wf.id, 0, base_instruction, previous_result=None, file_context=file_context)
            
            action_data = {
                "document_id": doc.id, 
                "filename": fname, 
                "instruction": base_instruction,
                "original_instruction": base_instruction,
                "file_context": file_context,
                "current_stage_index": 0
            }
            
            item = feed_service.create_feed_item(
                db, tenant_id=tenant_id, category=wf.slug,
                title=f"Eingang: {fname}", description="⏳ Agent analysiert Dokument...",
                priority=5, action_type="agent_task",
                action_data=action_data,
                workflow_id=wf.id, agent_id=agent_id
            )
            item.status = "processing"
            db.commit()
            db.refresh(item)
            
            asyncio.ensure_future(agent_service.run_task_background(item.id, tenant_id, full_instruction, agent_id, wf.id))

async def _process_interval(db: Session, trigger: WorkflowTrigger):
    wf = trigger.workflow
    tenant_id = wf.tenant_id
    
    wf_config = wf.config_json or {}
    stages = wf_config.get("stages", [])
    if stages and stages[0].get("agent_id"):
        agent_id = int(stages[0]["agent_id"])
    else:
        wf_agent = db.query(WorkflowAgent).filter(WorkflowAgent.workflow_id == wf.id).first()
        agent_id = wf_agent.agent_id if wf_agent else None
    
    if not agent_id:
        agent = agent_service.find_available_agent(db, tenant_id, wf.id)
        if agent: agent_id = agent.id
        else: return

    instruction = trigger.config_json.get("instruction", "Führe die geplante Überprüfung durch.")
    
    from backend.services.agent_service import build_stage_instruction
    full_instruction = build_stage_instruction(db, tenant_id, wf.id, 0, instruction)
    
    action_data = {
        "instruction": instruction,
        "original_instruction": instruction,
        "file_context": "",
        "current_stage_index": 0
    }
    
    item = feed_service.create_feed_item(
        db, tenant_id=tenant_id, category=wf.slug,
        title=f"Automatische Routine: {wf.name}", description="⏳ Agent startet Routine...",
        priority=3, action_type="agent_task",
        action_data=action_data,
        workflow_id=wf.id, agent_id=agent_id
    )
    item.status = "processing"
    db.commit()
    db.refresh(item)
    
    asyncio.ensure_future(agent_service.run_task_background(item.id, tenant_id, full_instruction, agent_id, wf.id))

async def _process_email_fetch(db: Session, trigger: WorkflowTrigger):
    from backend.services import mcp_service
    wf = trigger.workflow
    
    # Wir führen die sync_inbox Methode des email-fetcher Moduls aus
    # Die Konfiguration wird aus dem Trigger-Config gelesen
    res = mcp_service.execute_read("email-fetcher", db, "sync_inbox", {
        "tenant_id": wf.tenant_id,
        "workflow_id": wf.id,
        "config": trigger.config_json  # IMAP Daten liegen hier
    })
    
    if res.get("status") == "error":
        logger.error(f"Email fetch failed for Workflow {wf.id}: {res.get('message')}")








