from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.database.engine import get_db
import asyncio
import traceback
import sys
from sqlalchemy import case
from backend.database.models import FeedItem, Agent
from backend.services import feed_service, audit_service, agent_service

router = APIRouter()


class FeedCreate(BaseModel):
    tenant_id: int
    category: str = "general"
    title: str
    description: Optional[str] = ""
    priority: Optional[int] = 0
    action_type: Optional[str] = "info"
    action_data_json: Optional[dict] = {}
    workflow_id: Optional[int] = None


# Model no longer strictly used for /submit-task since we switch to Form Data, but kept for reference if needed.


class FeedResolve(BaseModel):
    status: str = "approved"
    result_json: Optional[dict] = {}
    feedback_text: Optional[str] = ""
    force_app_slug: Optional[str] = None


class FeedUpdate(BaseModel):
    priority: Optional[int] = None
    category: Optional[str] = None
    title: Optional[str] = None


@router.get("")
def list_feed(
    tenant_id: int,
    category: str = None,
    workflow_id: int = None,
    status: str = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
):
    q = db.query(FeedItem).filter(FeedItem.tenant_id == tenant_id)
    if category:
        q = q.filter(FeedItem.category == category)
    if workflow_id:
        q = q.filter(FeedItem.workflow_id == workflow_id)
    if status:
        q = q.filter(FeedItem.status == status)
    total = q.count()
    score = (
        case(
            (FeedItem.status == "processing", 500),
            (FeedItem.status == "pending", 400),
            (FeedItem.status == "deferred", 200),
            (FeedItem.status == "rejected", 100),
            (FeedItem.status == "approved", 50),
            (FeedItem.status == "archived", 0),
            else_=10,
        )
        + FeedItem.priority * 5
    )
    items = q.order_by(score.desc(), FeedItem.created_at.desc()).offset(offset).limit(limit).all()
    return {"total": total, "items": [_serialize(i) for i in items]}


@router.post("")
async def create_feed(body: FeedCreate, db: Session = Depends(get_db)):
    # Wenn es eine Agenten-Aufgabe ist, setzen wir sie direkt auf 'processing'
    # damit sie im Frontend nicht sofort als 'pending' (mit Genehmigen-Buttons) erscheint.
    initial_status = "pending"
    if body.action_type == "agent_task":
        initial_status = "processing"

    workflow_id = body.workflow_id
    if not workflow_id and body.category:
        from backend.database.models import Workflow
        wf = db.query(Workflow).filter(
            Workflow.tenant_id == body.tenant_id,
            Workflow.category == body.category,
            Workflow.is_active == True
        ).first()
        if wf:
            workflow_id = wf.id

    item = feed_service.create_feed_item(
        db,
        tenant_id=body.tenant_id,
        category=body.category,
        title=body.title,
        description=body.description,
        priority=body.priority,
        action_type=body.action_type,
        action_data=body.action_data_json,
        workflow_id=workflow_id,
    )
    
    # Status explizit erzwingen, falls abweichend vom Default des Feed-Services
    if initial_status == "processing":
        item.status = "processing"
        
        # Falls kein Agent im Action-Data vorhanden ist, suchen wir einen passenden Agenten
        agent_id = body.action_data_json.get("agent_id")
        if not agent_id:
            agent = agent_service.find_available_agent(db, body.tenant_id, workflow_id)
            if agent:
                agent_id = agent.id
                item.agent_id = agent_id
        
        db.commit()
        db.refresh(item)
        
        # Hintergrundverarbeitung durch den Agenten triggern
        if agent_id:
            instruction = body.description or body.title
            asyncio.ensure_future(agent_service.run_task_background(item.id, body.tenant_id, instruction, agent_id, item.workflow_id))
    
    return _serialize(item)


@router.get("/stats")
def feed_stats(tenant_id: int, db: Session = Depends(get_db)):
    q = db.query(FeedItem).filter(FeedItem.tenant_id == tenant_id)
    total = q.count()
    pending = q.filter(FeedItem.status == "pending").count()
    processing = q.filter(FeedItem.status == "processing").count()
    approved = q.filter(FeedItem.status == "approved").count()
    rejected = q.filter(FeedItem.status == "rejected").count()

    categories = {}
    for cat in ["marketing", "finance", "tax_legal", "documents", "general"]:
        cq = db.query(FeedItem).filter(FeedItem.tenant_id == tenant_id, FeedItem.category == cat)
        categories[cat] = {"total": cq.count(), "pending": cq.filter(FeedItem.status == "pending").count()}

    return {"total": total, "pending": pending, "processing": processing, "approved": approved, "rejected": rejected, "categories": categories}


@router.post("/submit-task")
async def submit_task(
    tenant_id: int = Form(...),
    instruction: str = Form(...),
    category: str = Form("general"),
    priority: int = Form(5),
    agent_id: Optional[int] = Form(None),
    workflow_id: Optional[int] = Form(None),
    force_app_slug: Optional[str] = Form(None),
    file: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    try:
        if not agent_id:
            agent = agent_service.find_available_agent(db, tenant_id, workflow_id)
            if not agent:
                raise HTTPException(400, "Kein aktiver Agent verfügbar")
            agent_id = agent.id

        if not workflow_id and category:
            from backend.database.models import Workflow
            wf = db.query(Workflow).filter(
                Workflow.tenant_id == tenant_id,
                Workflow.slug == category,
                Workflow.is_active == True
            ).first()
            if wf:
                workflow_id = wf.id

        pdf_strategy = "auto"
        image_strategy = "ocr"
        
        current_stage_index = 0
        if workflow_id:
            from backend.database.models import Workflow
            wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
            if wf and wf.config_json:
                fp = wf.config_json.get("file_processing", {})
                pdf_strategy = fp.get("pdf", "auto")
                image_strategy = fp.get("image", "ocr")
                
                stages = wf.config_json.get("stages", [])
                if stages and len(stages) > 0 and stages[0].get("agent_id"):
                    agent_id = int(stages[0]["agent_id"])
                elif wf.config_json.get("classifier_agent_id"):
                    agent_id = int(wf.config_json["classifier_agent_id"])

        action_data = {
            "instruction": instruction,
            "original_instruction": instruction,
            "current_stage_index": current_stage_index,
            "file_context": ""
        }
        
        file_context = ""

        if file:
            from backend.services.file_service import create_file_asset
            content = await file.read()
            mime = file.content_type or "application/octet-stream"
            fname_lower = file.filename.lower()
            if mime == "application/octet-stream":
                if fname_lower.endswith(".pdf"): mime = "application/pdf"
                elif fname_lower.endswith((".png", ".jpg", ".jpeg")): mime = "image/jpeg"
                
            asset = create_file_asset(db, tenant_id, file.filename, content, mime, pdf_strategy, image_strategy)
            action_data["file_id"] = asset.id
            action_data["filename"] = file.filename
            
            if asset.metadata_json.get("extraction_method") == "vision":
                action_data["use_vision"] = True
                file_context = f"\n\n=== ANGEHÄNGTES BILD: {file.filename} ===\n(Wird per Vision-API analysiert)"
            elif asset.extracted_text:
                # Limit massiv erhöht, um auch mehrseitige Rechnungen komplett zu erfassen
                file_context = f"\n\n=== ANGEHÄNGTES DOKUMENT: {file.filename} ===\n{asset.extracted_text}"
                
        action_data["file_context"] = file_context
        
        # Build the full context header for the agent
        # This ensures the original email/document is ALWAYS visible to the model
        context_header = ""
        if instruction:
            context_header += f"=== URSPRÜNGLICHE AUFGABE ===\n{instruction}\n\n"
        if file_context:
            context_header += f"=== KONTEXT (EMAIL/DATEI-INHALT) ===\n{file_context}\n\n"

        # If app is forced, append that instruction
        if force_app_slug:
            action_data["force_app_slug"] = force_app_slug
            instruction += f"\n\n[SYSTEM-ANWEISUNG]: Der Nutzer hat explizit die App '{force_app_slug}' angefordert. Du MUSST zwingend das Tool 'propose_app_action' nutzen. Rufe dieses Tool auf mit 'app_slug'='{force_app_slug}' und fülle 'app_data' mit den passenden Inhalten."

        from backend.services.agent_service import build_stage_instruction
        # We pass the combined context header + current instruction
        final_instruction = build_stage_instruction(
            db, tenant_id, workflow_id, current_stage_index, 
            context_header + instruction, 
            previous_result=None, 
            file_context="" # Merged above to avoid duplication
        )
                
        item = feed_service.create_feed_item(
            db, tenant_id=tenant_id, category=category,
            title=instruction[:120], description="⏳ Agent bearbeitet die Aufgabe…",
            priority=priority, action_type="agent_task",
            action_data=action_data, agent_id=agent_id,
            workflow_id=workflow_id,
        )
        item.status = "processing"
        db.commit()
        db.refresh(item)

        asyncio.ensure_future(agent_service.run_task_background(item.id, tenant_id, final_instruction, agent_id, item.workflow_id))
        
        return _serialize(item)
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"ERROR in submit_task: {error_trace}", file=sys.stderr)
        return JSONResponse(
            status_code=500,
            content={
                "detail": str(e),
                "traceback": error_trace,
                "msg": "Bitte diesen Fehler an den Entwickler weitergeben."
            }
        )


@router.get("/{item_id}")
def get_feed_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(FeedItem).filter(FeedItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Feed-Element nicht gefunden")
    return _serialize(item)


@router.put("/{item_id}")
def update_feed_item(item_id: int, body: FeedUpdate, db: Session = Depends(get_db)):
    item = db.query(FeedItem).filter(FeedItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Feed-Element nicht gefunden")
    
    if body.priority is not None:
        item.priority = body.priority
    if body.category is not None:
        item.category = body.category
    if body.title is not None:
        item.title = body.title
        
    db.commit()
    db.refresh(item)
    return _serialize(item)


@router.delete("/{item_id}")
def delete_feed_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(FeedItem).filter(FeedItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Feed-Element nicht gefunden")
    
    tid = item.tenant_id
    # Logge die Löschung im Audit-Trail, bevor das Objekt verschwindet
    audit_service.log_action(
        db, tid, "feed.deleted", "feed_item", item_id, 
        details={"title": item.title, "category": item.category}
    )
    
    db.delete(item)
    db.commit()
    return {"ok": True}


@router.post("/{item_id}/resolve")
async def resolve(item_id: int, body: FeedResolve, db: Session = Depends(get_db)):
    item = feed_service.resolve_feed_item(db, item_id, body.status, body.result_json, body.feedback_text)
    if not item:
        raise HTTPException(404, "Feed-Element nicht gefunden")

    try:
        # Wir übergeben NUR den sauberen feedback_text. 
        # Der agent_service kümmert sich intern um die Anreicherung mit Kontext für das LLM,
        # ohne den Trace (die Historie) zu verschmutzen.
        if body.status == "approved" and body.feedback_text:
            from backend.services.agent_service import reprocess_with_instructions
            await reprocess_with_instructions(db, item, body.feedback_text, force_app_slug=body.force_app_slug)

        elif body.status == "approved" and not body.feedback_text:
            from backend.services.governance_service import execute_approved_action
            exec_result = execute_approved_action(db, item)
            if exec_result:
                item.result_json = {**(item.result_json or {}), "execution": exec_result}
                db.commit()
                db.refresh(item)

        elif body.status == "rejected" and body.feedback_text:
            from backend.services.agent_service import reprocess_rejected_feed_item
            await reprocess_rejected_feed_item(db, item, body.feedback_text, force_app_slug=body.force_app_slug)

        elif body.status == "replied" and body.feedback_text:
            from backend.services.agent_service import continue_agent_task
            await continue_agent_task(db, item, body.feedback_text, force_app_slug=body.force_app_slug)

    except Exception as e:
        audit_service.log_action(
            db,
            tenant_id=item.tenant_id,
            action=f"feed.resolve.error",
            entity_type="feed_item",
            entity_id=item.id,
            details={"status": body.status, "error": str(e)},
        )

    return _serialize(item)


def _serialize(i: FeedItem) -> dict:
    # Letzten Thought ermitteln für Fallback in der UI
    last_thought = ""
    sorted_steps = sorted(i.trace_steps, key=lambda x: x.step_number) if i.trace_steps else []
    if sorted_steps:
        last_thought = sorted_steps[-1].thought or sorted_steps[-1].next_step or ""

    # Beschreibung bereinigen: Falls leer oder nur leere JSON-Klammern, 
    # nutzen wir den letzten Gedanken des Agenten als Beschreibung für die Feed-Karte.
    desc = (i.description or "").strip()
    if not desc or desc == "{}" or desc == "{ }":
        desc = last_thought

    return {
        "id": i.id,
        "tenant_id": i.tenant_id,
        "workflow_id": i.workflow_id,
        "agent_id": i.agent_id,
        "category": i.category,
        "title": i.title,
        "description": desc,
        "priority": i.priority,
        "status": i.status,
        "action_type": i.action_type,
        "action_data_json": i.action_data_json,
        "result_json": i.result_json,
        "feedback_text": i.feedback_text or "",
        "parent_id": i.parent_id,
        "trace_steps": [
            {
                "step_number": s.step_number,
                "action": s.action,
                "input": s.action_input,
                "observation": s.observation,
                "thought": s.thought,
                "next_step": s.next_step,
                "llm_log_id": s.llm_log_id,
                "created_at": s.created_at.isoformat() if s.created_at else None
            }
            for s in sorted_steps
        ],
        "created_at": i.created_at.isoformat() if i.created_at else None,
        "resolved_at": i.resolved_at.isoformat() if i.resolved_at else None,
    }











