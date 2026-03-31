import shutil
import zipfile
import io
import os
import json
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.database.engine import get_db
from backend.database.models import MCPModule
from backend.services import mcp_service, audit_service

router = APIRouter()


class MCPUpdate(BaseModel):
    is_active: Optional[bool] = None
    config_json: Optional[dict] = None


@router.get("")
def list_modules(db: Session = Depends(get_db)):
    mcp_service.sync_modules_to_db(db)
    modules = db.query(MCPModule).order_by(MCPModule.name).all()
    return [_serialize(m) for m in modules]


@router.get("/{module_id}")
def get_module(module_id: int, db: Session = Depends(get_db)):
    m = db.query(MCPModule).filter(MCPModule.id == module_id).first()
    if not m:
        raise HTTPException(404, "MCP-Modul nicht gefunden")
    return _serialize(m)


@router.put("/{module_id}")
def update_module(module_id: int, body: MCPUpdate, db: Session = Depends(get_db)):
    m = db.query(MCPModule).filter(MCPModule.id == module_id).first()
    if not m:
        raise HTTPException(404, "MCP-Modul nicht gefunden")
    if body.is_active is not None:
        m.is_active = body.is_active
    if body.config_json is not None:
        m.config_json = body.config_json
    db.commit()
    db.refresh(m)
    return _serialize(m)


@router.delete("/{module_id}")
def delete_module(module_id: int, db: Session = Depends(get_db)):
    m = db.query(MCPModule).filter(MCPModule.id == module_id).first()
    if not m:
        raise HTTPException(404, "MCP-Modul nicht gefunden")
    
    slug = m.slug
    mcp_service.delete_module_files(slug, db)
    db.delete(m)
    db.commit()
    
    return {"ok": True, "message": f"Modul '{slug}' wurde erfolgreich deinstalliert."}


@router.get("/{module_id}/download")
def download_module(module_id: int, db: Session = Depends(get_db)):
    m = db.query(MCPModule).filter(MCPModule.id == module_id).first()
    if not m or not m.module_path or not os.path.exists(m.module_path):
        raise HTTPException(404, "Moduldateien nicht gefunden")
    
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        base_path = Path(m.module_path)
        for root, _, files in os.walk(base_path):
            for file in files:
                fpath = Path(root) / file
                zf.write(fpath, fpath.relative_to(base_path))
    
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/x-zip-compressed",
        headers={"Content-Disposition": f"attachment; filename=mcp_{m.slug}.zip"}
    )


@router.post("/{module_id}/reload")
def reload_module(module_id: int, db: Session = Depends(get_db)):
    m = db.query(MCPModule).filter(MCPModule.id == module_id).first()
    if not m:
        raise HTTPException(404, "MCP-Modul nicht gefunden")
    
    # 1. Cache leeren
    mcp_service.clear_module_cache(m.slug)
    
    # 2. DB Sync erzwingen (liest Manifest neu ein)
    mcp_service.sync_modules_to_db(db)
    
    # 3. Aktualisiertes Objekt laden
    db.refresh(m)
    return {"ok": True, "message": f"Modul '{m.name}' wurde neu initialisiert.", "module": _serialize(m)}

@router.post("/upload")
async def upload_module(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".zip"):
        raise HTTPException(400, "Nur .zip Dateien sind erlaubt.")
    
    content = await file.read()
    temp_dir = mcp_service.MCP_MODULES_DIR / f"_temp_{os.urandom(4).hex()}"
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            zf.extractall(temp_dir)
        
        # Determine actual root (handle if zip contained a single top-level folder)
        items = [i for i in temp_dir.iterdir() if not i.name.startswith('.')]
        if len(items) == 1 and items[0].is_dir():
            actual_root = items[0]
        else:
            actual_root = temp_dir
            
        errors = mcp_service.validate_module_structure(actual_root)
        if errors:
            shutil.rmtree(temp_dir)
            return {"ok": False, "errors": errors}
            
        # Get Slug from manifest
        with open(actual_root / "manifest.json", "r") as f:
            manifest = json.load(f)
        slug = manifest.get("slug")
        
        # Check if exists and replace
        target_dir = mcp_service.MCP_MODULES_DIR / slug
        if target_dir.exists():
            shutil.rmtree(target_dir)
            
        # Clear Memory Cache for Hot-Reload
        if slug in mcp_service._loaded_modules:
            del mcp_service._loaded_modules[slug]
        if hasattr(mcp_service, "_module_mtimes") and slug in mcp_service._module_mtimes:
            del mcp_service._module_mtimes[slug]
        
        shutil.move(str(actual_root), str(target_dir))
        mcp_service.sync_modules_to_db(db)
        
        return {"ok": True, "slug": slug}
        
    except Exception as e:
        if temp_dir.exists(): shutil.rmtree(temp_dir)
        raise HTTPException(500, f"Upload fehlgeschlagen: {str(e)}")
    finally:
        if temp_dir.exists(): 
            try: shutil.rmtree(temp_dir)
            except: pass


@router.post("/{slug}/read/{method}")
def read_method(slug: str, method: str, body: dict = {}, db: Session = Depends(get_db)):
    result = mcp_service.execute_read(slug, db, method, body.get("params", {}))
    return result


@router.post("/{slug}/write/{method}")
def write_method(slug: str, method: str, body: dict = {}, db: Session = Depends(get_db)):
    result = mcp_service.execute_write(slug, db, method, body.get("params", {}))
    return result


def _serialize(m: MCPModule) -> dict:
    return {
        "id": m.id,
        "name": m.name,
        "slug": m.slug,
        "description": m.description,
        "version": m.version,
        "author": m.author,
        "is_active": m.is_active,
        "config_json": m.config_json,
        "capabilities_json": m.capabilities_json,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }





