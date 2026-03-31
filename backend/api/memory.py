from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.database.engine import get_db
from pydantic import BaseModel
from typing import Optional
from backend.services import memory_service

router = APIRouter()

class AgentMemoryCreate(BaseModel):
    tenant_id: int
    key: str
    value: str
    context_json: Optional[dict] = {}

class AgentMemoryUpdate(BaseModel):
    key: Optional[str] = None
    value: Optional[str] = None
    context_json: Optional[dict] = None

@router.get("/agent-memories")
def list_agent_memories(tenant_id: int, db: Session = Depends(get_db)):
    from backend.database.models import AgentMemory
    memories = db.query(AgentMemory).filter(AgentMemory.tenant_id == tenant_id).order_by(AgentMemory.updated_at.desc()).all()
    return [{"id": m.id, "key": m.key, "value": m.value, "context_json": m.context_json, "updated_at": m.updated_at.isoformat()} for m in memories]

@router.post("/agent-memories")
def create_agent_memory(body: AgentMemoryCreate, db: Session = Depends(get_db)):
    from backend.database.models import AgentMemory
    key = body.key.strip().upper()
    existing = db.query(AgentMemory).filter(AgentMemory.tenant_id == body.tenant_id, AgentMemory.key == key).first()
    if existing:
        existing.value = body.value
        if body.context_json is not None:
            existing.context_json = body.context_json
        db.commit()
        db.refresh(existing)
        return {"id": existing.id, "key": existing.key, "value": existing.value, "context_json": existing.context_json}
    
    m = AgentMemory(tenant_id=body.tenant_id, key=key, value=body.value, context_json=body.context_json)
    db.add(m)
    db.commit()
    db.refresh(m)
    return {"id": m.id, "key": m.key, "value": m.value, "context_json": m.context_json}

@router.put("/agent-memories/{mem_id}")
def update_agent_memory(mem_id: int, body: AgentMemoryUpdate, db: Session = Depends(get_db)):
    from backend.database.models import AgentMemory
    m = db.query(AgentMemory).filter(AgentMemory.id == mem_id).first()
    if not m: return {"error": "Not found"}
    if body.key is not None: m.key = body.key.strip().upper()
    if body.value is not None: m.value = body.value
    if body.context_json is not None: m.context_json = body.context_json
    db.commit()
    db.refresh(m)
    return {"id": m.id, "key": m.key, "value": m.value, "context_json": m.context_json}

@router.delete("/agent-memories/{mem_id}")
def delete_agent_memory(mem_id: int, db: Session = Depends(get_db)):
    from backend.database.models import AgentMemory
    m = db.query(AgentMemory).filter(AgentMemory.id == mem_id).first()
    if m:
        db.delete(m)
        db.commit()
    return {"ok": True}


@router.get("/events")
def list_events(
    tenant_id: int,
    event_type: str = None,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    events = memory_service.get_event_memories(db, tenant_id, limit, event_type)
    return [
        {
            "id": e.id,
            "agent_id": e.agent_id,
            "event_type": e.event_type,
            "summary": e.summary,
            "context_json": e.context_json,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
        }
        for e in events
    ]


@router.get("/objects")
def list_objects(
    tenant_id: int,
    object_type: str = None,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    objects = memory_service.get_object_memories(db, tenant_id, limit, object_type)
    return [
        {
            "id": o.id,
            "agent_id": o.agent_id,
            "object_type": o.object_type,
            "object_id": o.object_id,
            "summary": o.summary,
            "context_json": o.context_json,
            "created_at": o.created_at.isoformat() if o.created_at else None,
            "updated_at": o.updated_at.isoformat() if o.updated_at else None,
        }
        for o in objects
    ]


@router.get("/objects/{object_type}/{object_id}")
def get_object_memory(object_type: str, object_id: int, tenant_id: int, db: Session = Depends(get_db)):
    obj = memory_service.get_object_memory(db, tenant_id, object_type, object_id)
    if not obj:
        return None
    return {
        "id": obj.id,
        "agent_id": obj.agent_id,
        "object_type": obj.object_type,
        "object_id": obj.object_id,
        "summary": obj.summary,
        "context_json": obj.context_json,
        "created_at": obj.created_at.isoformat() if obj.created_at else None,
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
    }











