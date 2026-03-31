from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.database.engine import get_db
from backend.database.models import DataStructure
from backend.services import audit_service, db_schema_service

router = APIRouter()


class DSCreate(BaseModel):
    tenant_id: int
    name: str
    slug: str
    description: Optional[str] = ""
    category: Optional[str] = "custom"
    workflow_id: Optional[int] = None
    schema_json: Optional[dict] = {"fields": []}


class DSUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    schema_json: Optional[dict] = None
    workflow_id: Optional[int] = None


class RecordCreate(BaseModel):
    tenant_id: int
    data_json: dict = {}


@router.get("")
def list_data_structures(tenant_id: int, db: Session = Depends(get_db)):
    from backend.database.models import DataStructureTenantAccess
    shared_ids = db.query(DataStructureTenantAccess.data_structure_id).filter(DataStructureTenantAccess.tenant_id == tenant_id).all()
    shared_ids = [r[0] for r in shared_ids]

    items = db.query(DataStructure).filter(
        (DataStructure.tenant_id == tenant_id) | (DataStructure.id.in_(shared_ids))
    ).order_by(DataStructure.is_standard.desc(), DataStructure.name).all()
    return [_serialize_ds(d) for d in items]

@router.get("/{ds_id}/permissions")
def get_ds_permissions(ds_id: int, db: Session = Depends(get_db)):
    from backend.database.models import DataStructureTenantAccess
    access = db.query(DataStructureTenantAccess).filter(DataStructureTenantAccess.data_structure_id == ds_id).all()
    return [a.tenant_id for a in access]

@router.put("/{ds_id}/permissions")
def update_ds_permissions(ds_id: int, body: dict, db: Session = Depends(get_db)):
    from backend.database.models import DataStructureTenantAccess
    tenant_ids = body.get("tenant_ids", [])
    db.query(DataStructureTenantAccess).filter(DataStructureTenantAccess.data_structure_id == ds_id).delete()
    for tid in tenant_ids:
        db.add(DataStructureTenantAccess(data_structure_id=ds_id, tenant_id=tid))
    db.commit()
    return {"ok": True}


@router.post("")
def create_data_structure(body: DSCreate, db: Session = Depends(get_db)):
    ds = DataStructure(**body.model_dump())
    db.add(ds)
    db.commit()
    db.refresh(ds)
    # Erzeuge echte SQL Tabelle
    db_schema_service.sync_dynamic_table(db, ds.tenant_id, ds.slug, ds.schema_json)
    audit_service.log_action(db, ds.tenant_id, "data_structure.created", "data_structure", ds.id, details={"name": ds.name})
    return _serialize_ds(ds)


@router.get("/{ds_id}")
def get_data_structure(ds_id: int, db: Session = Depends(get_db)):
    ds = db.query(DataStructure).filter(DataStructure.id == ds_id).first()
    if not ds:
        raise HTTPException(404, "Datenstruktur nicht gefunden")
    return _serialize_ds(ds)


@router.put("/{ds_id}")
def update_data_structure(ds_id: int, body: DSUpdate, db: Session = Depends(get_db)):
    ds = db.query(DataStructure).filter(DataStructure.id == ds_id).first()
    if not ds:
        raise HTTPException(404, "Datenstruktur nicht gefunden")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(ds, field, val)
    db.commit()
    db.refresh(ds)
    # Passe reale SQL Tabelle an (neue Spalten)
    if body.schema_json:
        db_schema_service.sync_dynamic_table(db, ds.tenant_id, ds.slug, ds.schema_json)
    return _serialize_ds(ds)


@router.delete("/{ds_id}")
def delete_data_structure(ds_id: int, db: Session = Depends(get_db)):
    ds = db.query(DataStructure).filter(DataStructure.id == ds_id).first()
    if not ds:
        raise HTTPException(404, "Datenstruktur nicht gefunden")
    if ds.is_standard:
        raise HTTPException(400, "Standard-Datenstrukturen können nicht gelöscht werden")
    
    # Droppe reale SQL Tabelle
    db_schema_service.drop_dynamic_table(db, ds.tenant_id, ds.slug)
    
    db.delete(ds)
    db.commit()
    return {"ok": True}


@router.get("/{ds_id}/records")
def list_records(ds_id: int, limit: int = Query(100, le=500), offset: int = 0, db: Session = Depends(get_db)):
    ds = db.query(DataStructure).filter(DataStructure.id == ds_id).first()
    if not ds: raise HTTPException(404, "Datenstruktur nicht gefunden")
    
    records = db_schema_service.get_dynamic_records(db, ds.tenant_id, ds.slug, limit, offset)
    total = db_schema_service.get_dynamic_records_count(db, ds.tenant_id, ds.slug)
    
    return {
        "total": total,
        "items": records,
    }


@router.post("/{ds_id}/records")
def create_record(ds_id: int, body: RecordCreate, db: Session = Depends(get_db)):
    ds = db.query(DataStructure).filter(DataStructure.id == ds_id).first()
    if not ds: raise HTTPException(404, "Datenstruktur nicht gefunden")
    
    from backend.services.data_service import validate_record_data
    is_valid, err = validate_record_data(ds.schema_json or {}, body.data_json)
    if not is_valid: raise HTTPException(400, err)

    rec = db_schema_service.insert_dynamic_record(db, ds.tenant_id, ds.slug, body.data_json)
    return rec


@router.put("/{ds_id}/records/{record_id}")
def update_record(ds_id: int, record_id: int, body: dict, db: Session = Depends(get_db)):
    ds = db.query(DataStructure).filter(DataStructure.id == ds_id).first()
    if not ds: raise HTTPException(404, "Datenstruktur nicht gefunden")
    
    if "data_json" in body:
        from backend.services.data_service import validate_record_data
        is_valid, err = validate_record_data(ds.schema_json or {}, body["data_json"])
        if not is_valid: raise HTTPException(400, err)
        
        rec = db_schema_service.update_dynamic_record(db, ds.tenant_id, ds.slug, record_id, body["data_json"])
        return rec
    return {}


@router.delete("/{ds_id}/records/{record_id}")
def delete_record(ds_id: int, record_id: int, db: Session = Depends(get_db)):
    ds = db.query(DataStructure).filter(DataStructure.id == ds_id).first()
    if not ds: raise HTTPException(404, "Datenstruktur nicht gefunden")
    
    db_schema_service.delete_dynamic_record(db, ds.tenant_id, ds.slug, record_id)
    return {"ok": True}


def _serialize_ds(d: DataStructure) -> dict:
    return {
        "id": d.id,
        "tenant_id": d.tenant_id,
        "workflow_id": d.workflow_id,
        "name": d.name,
        "slug": d.slug,
        "description": d.description,
        "category": d.category,
        "schema_json": d.schema_json,
        "is_standard": d.is_standard,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }











