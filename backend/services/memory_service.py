import datetime
from sqlalchemy.orm import Session
from backend.database.models import MemoryEvent, MemoryObject


def create_event_memory(
    db: Session,
    tenant_id: int,
    event_type: str,
    summary: str,
    agent_id: int = None,
    context: dict = None,
):
    entry = MemoryEvent(
        tenant_id=tenant_id,
        agent_id=agent_id,
        event_type=event_type,
        summary=summary,
        context_json=context or {},
        timestamp=datetime.datetime.utcnow(),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def create_object_memory(
    db: Session,
    tenant_id: int,
    object_type: str,
    object_id: int,
    summary: str,
    agent_id: int = None,
    context: dict = None,
):
    existing = (
        db.query(MemoryObject)
        .filter(
            MemoryObject.tenant_id == tenant_id,
            MemoryObject.object_type == object_type,
            MemoryObject.object_id == object_id,
        )
        .first()
    )
    if existing:
        existing.summary = summary
        existing.context_json = context or existing.context_json
        existing.agent_id = agent_id or existing.agent_id
        existing.updated_at = datetime.datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing

    entry = MemoryObject(
        tenant_id=tenant_id,
        agent_id=agent_id,
        object_type=object_type,
        object_id=object_id,
        summary=summary,
        context_json=context or {},
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def get_event_memories(db: Session, tenant_id: int, limit: int = 50, event_type: str = None):
    q = db.query(MemoryEvent).filter(MemoryEvent.tenant_id == tenant_id)
    if event_type:
        q = q.filter(MemoryEvent.event_type == event_type)
    return q.order_by(MemoryEvent.timestamp.desc()).limit(limit).all()


def get_object_memory(db: Session, tenant_id: int, object_type: str, object_id: int):
    return (
        db.query(MemoryObject)
        .filter(
            MemoryObject.tenant_id == tenant_id,
            MemoryObject.object_type == object_type,
            MemoryObject.object_id == object_id,
        )
        .first()
    )


def get_object_memories(db: Session, tenant_id: int, limit: int = 50, object_type: str = None):
    q = db.query(MemoryObject).filter(MemoryObject.tenant_id == tenant_id)
    if object_type:
        q = q.filter(MemoryObject.object_type == object_type)
    return q.order_by(MemoryObject.updated_at.desc()).limit(limit).all()











