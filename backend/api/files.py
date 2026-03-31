import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from backend.database.engine import get_db
from backend.database.models import FileAsset

router = APIRouter()

@router.get("/orphaned")
def check_orphaned_files(tenant_id: int, db: Session = Depends(get_db)):
    from backend.database.models import DataStructure, FeedItem
    from backend.services.db_schema_service import _get_table_name
    
    all_files = db.query(FileAsset.id, FileAsset.filename, FileAsset.created_at).filter(FileAsset.tenant_id == tenant_id).all()
    linked_ids = set()

    # 1. Check Dynamic Data Structures
    structures = db.query(DataStructure).filter(DataStructure.tenant_id == tenant_id).all()
    for ds in structures:
        fields = ds.schema_json.get("fields", [])
        ref_cols = [f["name"] for f in fields if f["name"] in ["document_id", "file_id"]]
        if not ref_cols: continue
        t_name = _get_table_name(tenant_id, ds.slug)
        try:
            for col in ref_cols:
                col_check = db.execute(text("SELECT 1 FROM information_schema.columns WHERE table_name = :t AND column_name = :c"), {"t": t_name, "c": col.lower()}).scalar()
                if col_check:
                    res = db.execute(text(f"SELECT {col} FROM {t_name} WHERE {col} IS NOT NULL")).fetchall()
                    for row in res:
                        try: linked_ids.add(int(row[0]))
                        except: pass
        except Exception: pass
    
    # 2. Check Feed Items (Important for Email Attachments)
    feed_items = db.query(FeedItem).filter(FeedItem.tenant_id == tenant_id).all()
    for item in feed_items:
        ad = item.action_data_json or {}
        # Single IDs
        for key in ["document_id", "file_id"]:
            val = ad.get(key)
            if val:
                try: linked_ids.add(int(val))
                except: pass
        # List of IDs (Attachments)
        att_ids = ad.get("attachment_ids")
        if att_ids:
            if isinstance(att_ids, list):
                for aid in att_ids:
                    try: linked_ids.add(int(aid))
                    except: pass
            elif isinstance(att_ids, str): # Fallback JSON String
                try:
                    parsed = json.loads(att_ids)
                    if isinstance(parsed, list):
                        for aid in parsed: linked_ids.add(int(aid))
                except: pass
            
    orphaned = [f for f in all_files if f.id not in linked_ids]
    return {
        "total_files": len(all_files),
        "orphaned_count": len(orphaned),
        "orphaned_files": [{"id": f.id, "filename": f.filename, "created_at": f.created_at.isoformat()} for f in orphaned]
    }

@router.get("/{file_id}")
def get_file_metadata(file_id: int, db: Session = Depends(get_db)):
    f = db.query(FileAsset).filter(FileAsset.id == file_id).first()
    if not f: raise HTTPException(404, "Datei nicht gefunden")
    return {
        "id": f.id, "tenant_id": f.tenant_id, "filename": f.filename,
        "mime_type": f.mime_type, "page_count": f.page_count,
        "metadata_json": f.metadata_json, "created_at": f.created_at.isoformat() if f.created_at else None,
    }

@router.get("/{file_id}/content")
def serve_file_content(file_id: int, db: Session = Depends(get_db)):
    f = db.query(FileAsset).filter(FileAsset.id == file_id).first()
    if not f or not os.path.exists(f.filepath): raise HTTPException(404, "Datei nicht gefunden")
    return FileResponse(f.filepath, media_type=f.mime_type)


