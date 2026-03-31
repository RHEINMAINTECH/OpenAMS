from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from backend.database.engine import get_db
from backend.database.models import Task
from backend.services import audit_service, agent_service

router = APIRouter()


class TaskCreate(BaseModel):
    tenant_id: int
    title: str
    description: Optional[str] = ""
    instruction: Optional[str] = ""
    priority: Optional[int] = 0
    workflow_id: Optional[int] = None
    assigned_agent_id: Optional[int] = None
    due_date: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    instruction: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[int] = None
    assigned_agent_id: Optional[int] = None
    due_date: Optional[str] = None


@router.get("")
def list_tasks(tenant_id: int, status: str = None, limit: int = Query(50, le=200), offset: int = 0, db: Session = Depends(get_db)):
    q = db.query(Task).filter(Task.tenant_id == tenant_id)
    if status:
        q = q.filter(Task.status == status)
    total = q.count()
    items = q.order_by(Task.priority.desc(), Task.created_at.desc()).offset(offset).limit(limit).all()
    return {"total": total, "items": [_serialize(t) for t in items]}


@router.post("")
def create_task(body: TaskCreate, db: Session = Depends(get_db)):
    data = body.model_dump()
    if data.get("due_date"):
        data["due_date"] = datetime.fromisoformat(data["due_date"])
    else:
        data.pop("due_date", None)
    t = Task(**data)
    db.add(t)
    db.commit()
    db.refresh(t)
    audit_service.log_action(db, t.tenant_id, "task.created", "task", t.id, details={"title": t.title})
    return _serialize(t)


@router.get("/{task_id}")
def get_task(task_id: int, db: Session = Depends(get_db)):
    t = db.query(Task).filter(Task.id == task_id).first()
    if not t:
        raise HTTPException(404, "Aufgabe nicht gefunden")
    return _serialize(t)


@router.put("/{task_id}")
def update_task(task_id: int, body: TaskUpdate, db: Session = Depends(get_db)):
    t = db.query(Task).filter(Task.id == task_id).first()
    if not t:
        raise HTTPException(404, "Aufgabe nicht gefunden")
    for field, val in body.model_dump(exclude_none=True).items():
        if field == "due_date" and val:
            val = datetime.fromisoformat(val)
        setattr(t, field, val)
    db.commit()
    db.refresh(t)
    return _serialize(t)


@router.post("/{task_id}/execute")
async def execute_task(task_id: int, db: Session = Depends(get_db)):
    t = db.query(Task).filter(Task.id == task_id).first()
    if not t:
        raise HTTPException(404, "Aufgabe nicht gefunden")
    if not t.assigned_agent_id:
        raise HTTPException(400, "Kein Agent zugewiesen")
    instruction = t.instruction or t.description or t.title
    result = await agent_service.execute_agent_task(
        db, t.assigned_agent_id, t.tenant_id, instruction, {"task_id": t.id, "workflow_id": t.workflow_id}
    )
    t.status = "completed" if "error" not in result else "error"
    t.result_json = result
    db.commit()
    return _serialize(t)


@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    t = db.query(Task).filter(Task.id == task_id).first()
    if not t:
        raise HTTPException(404, "Aufgabe nicht gefunden")
    db.delete(t)
    db.commit()
    return {"ok": True}


def _serialize(t: Task) -> dict:
    return {
        "id": t.id,
        "tenant_id": t.tenant_id,
        "workflow_id": t.workflow_id,
        "assigned_agent_id": t.assigned_agent_id,
        "title": t.title,
        "description": t.description,
        "instruction": t.instruction,
        "status": t.status,
        "priority": t.priority,
        "due_date": t.due_date.isoformat() if t.due_date else None,
        "result_json": t.result_json,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }











