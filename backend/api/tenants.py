from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.database.engine import get_db
from backend.database.models import Tenant
from backend.services import audit_service

router = APIRouter()


class TenantCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = ""


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("")
def list_tenants(db: Session = Depends(get_db)):
    tenants = db.query(Tenant).order_by(Tenant.name).all()
    return [_serialize(t) for t in tenants]


@router.post("")
def create_tenant(body: TenantCreate, db: Session = Depends(get_db)):
    if db.query(Tenant).filter(Tenant.slug == body.slug).first():
        raise HTTPException(400, "Slug existiert bereits")
    t = Tenant(name=body.name, slug=body.slug, description=body.description)
    db.add(t)
    db.commit()
    db.refresh(t)
    return _serialize(t)


@router.get("/{tenant_id}")
def get_tenant(tenant_id: int, db: Session = Depends(get_db)):
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(404, "Mandant nicht gefunden")
    return _serialize(t)


@router.put("/{tenant_id}")
def update_tenant(tenant_id: int, body: TenantUpdate, db: Session = Depends(get_db)):
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(404, "Mandant nicht gefunden")
    
    if body.name is not None:
        t.name = body.name
    
    if body.slug is not None and body.slug != t.slug:
        # Check if new slug already exists
        if db.query(Tenant).filter(Tenant.slug == body.slug, Tenant.id != tenant_id).first():
            raise HTTPException(400, "Slug wird bereits von einem anderen Mandanten verwendet")
        
        # Rename physical tables before updating slug in DB
        from backend.services import db_schema_service
        db_schema_service.rename_tenant_tables(db, tenant_id, t.slug, body.slug)
        t.slug = body.slug

    if body.description is not None:
        t.description = body.description
    
    if body.is_active is not None:
        t.is_active = body.is_active
        
    db.commit()
    db.refresh(t)
    return _serialize(t)


@router.delete("/{tenant_id}")
def delete_tenant(tenant_id: int, db: Session = Depends(get_db)):
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(404, "Mandant nicht gefunden")
    db.delete(t)
    db.commit()
    return {"ok": True}


def _serialize(t: Tenant) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "slug": t.slug,
        "description": t.description,
        "is_active": t.is_active,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }











