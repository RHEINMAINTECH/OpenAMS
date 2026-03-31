from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.database.engine import get_db
from backend.database.models import Message

router = APIRouter()


class MessageCreate(BaseModel):
    tenant_id: int
    title: str
    body: Optional[str] = ""
    priority: Optional[int] = 5
    feed_item_id: Optional[int] = None


@router.get("")
def list_messages(
    tenant_id: int,
    unread_only: bool = False,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
):
    q = db.query(Message).filter(Message.tenant_id == tenant_id)
    if unread_only:
        q = q.filter(Message.is_read == False)
    total = q.count()
    items = q.order_by(Message.priority.desc(), Message.created_at.desc()).offset(offset).limit(limit).all()
    return {"total": total, "items": [_serialize(m) for m in items]}


@router.post("")
def create_message(body: MessageCreate, db: Session = Depends(get_db)):
    m = Message(**body.model_dump())
    db.add(m)
    db.commit()
    db.refresh(m)
    return _serialize(m)


@router.get("/unread-count")
def unread_count(tenant_id: int, db: Session = Depends(get_db)):
    count = db.query(Message).filter(Message.tenant_id == tenant_id, Message.is_read == False).count()
    return {"count": count}


@router.put("/{msg_id}/read")
def mark_read(msg_id: int, db: Session = Depends(get_db)):
    m = db.query(Message).filter(Message.id == msg_id).first()
    if not m:
        raise HTTPException(404, "Nachricht nicht gefunden")
    m.is_read = True
    db.commit()
    return _serialize(m)


@router.put("/read-all")
def mark_all_read(tenant_id: int, db: Session = Depends(get_db)):
    db.query(Message).filter(Message.tenant_id == tenant_id, Message.is_read == False).update({"is_read": True})
    db.commit()
    return {"ok": True}


@router.delete("/{msg_id}")
def delete_message(msg_id: int, db: Session = Depends(get_db)):
    m = db.query(Message).filter(Message.id == msg_id).first()
    if not m:
        raise HTTPException(404, "Nachricht nicht gefunden")
    db.delete(m)
    db.commit()
    return {"ok": True}


def _serialize(m: Message) -> dict:
    return {
        "id": m.id,
        "tenant_id": m.tenant_id,
        "title": m.title,
        "body": m.body,
        "priority": m.priority,
        "is_read": m.is_read,
        "feed_item_id": m.feed_item_id,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }











