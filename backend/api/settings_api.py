from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.database.engine import get_db
from backend.database.models import Setting
from backend.services import llm_service

router = APIRouter()


class SettingUpdate(BaseModel):
    key: str
    value_json: dict
    tenant_id: Optional[int] = None


@router.get("")
def list_settings(tenant_id: int = None, db: Session = Depends(get_db)):
    q = db.query(Setting)
    if tenant_id is not None:
        q = q.filter((Setting.tenant_id == tenant_id) | (Setting.tenant_id.is_(None)))
    else:
        q = q.filter(Setting.tenant_id.is_(None))
    items = q.order_by(Setting.key).all()
    return [
        {"id": s.id, "tenant_id": s.tenant_id, "key": s.key, "value_json": s.value_json}
        for s in items
    ]


@router.put("")
def update_setting(body: SettingUpdate, db: Session = Depends(get_db)):
    # Hole ALLE Duplikate, falls welche existieren
    q = db.query(Setting).filter(Setting.key == body.key)
    if body.tenant_id is not None:
        q = q.filter(Setting.tenant_id == body.tenant_id)
    else:
        q = q.filter(Setting.tenant_id.is_(None))
    
    existing_items = q.all()
    
    if existing_items:
        # Update den ersten Eintrag
        s = existing_items[0]
        s.value_json = body.value_json
        # Lösche alle weiteren Duplikate (Sicherheitshalber)
        for extra in existing_items[1:]:
            db.delete(extra)
    else:
        s = Setting(key=body.key, value_json=body.value_json, tenant_id=body.tenant_id)
        db.add(s)
        
    db.commit()
    db.refresh(s)
    return {"id": s.id, "key": s.key, "value_json": s.value_json}
    db.refresh(s)
    return {"id": s.id, "key": s.key, "value_json": s.value_json}


@router.post("/test-llm")
async def test_llm(db: Session = Depends(get_db)):
    result = await llm_service.test_connection(db)
    return result











