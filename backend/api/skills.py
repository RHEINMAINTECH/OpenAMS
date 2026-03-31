from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.database.engine import get_db
from backend.database.models import Skill, AgentSkill
from backend.services import audit_service

router = APIRouter()


class SkillCreate(BaseModel):
    tenant_id: int
    name: str
    description: Optional[str] = ""
    content: str = ""
    category: Optional[str] = "general"


class SkillUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("")
def list_skills(tenant_id: int, db: Session = Depends(get_db)):
    items = db.query(Skill).filter(Skill.tenant_id == tenant_id).order_by(Skill.category, Skill.name).all()
    return [_serialize(s) for s in items]


@router.post("")
def create_skill(body: SkillCreate, db: Session = Depends(get_db)):
    s = Skill(**body.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    audit_service.log_action(db, s.tenant_id, "skill.created", "skill", s.id, details={"name": s.name})
    return _serialize(s)


@router.get("/{skill_id}")
def get_skill(skill_id: int, db: Session = Depends(get_db)):
    s = db.query(Skill).filter(Skill.id == skill_id).first()
    if not s:
        raise HTTPException(404, "Skill nicht gefunden")
    return _serialize(s)


@router.put("/{skill_id}")
def update_skill(skill_id: int, body: SkillUpdate, db: Session = Depends(get_db)):
    s = db.query(Skill).filter(Skill.id == skill_id).first()
    if not s:
        raise HTTPException(404, "Skill nicht gefunden")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(s, field, val)
    db.commit()
    db.refresh(s)
    audit_service.log_action(db, s.tenant_id, "skill.updated", "skill", s.id)
    return _serialize(s)


@router.delete("/{skill_id}")
def delete_skill(skill_id: int, db: Session = Depends(get_db)):
    s = db.query(Skill).filter(Skill.id == skill_id).first()
    if not s:
        raise HTTPException(404, "Skill nicht gefunden")
    tid = s.tenant_id
    db.delete(s)
    db.commit()
    audit_service.log_action(db, tid, "skill.deleted", "skill", skill_id)
    return {"ok": True}


def _serialize(s: Skill) -> dict:
    return {
        "id": s.id,
        "tenant_id": s.tenant_id,
        "name": s.name,
        "description": s.description,
        "content": s.content,
        "category": s.category,
        "is_active": s.is_active,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }











