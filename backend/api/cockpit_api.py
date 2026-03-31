import os
import json
import shutil
import zipfile
import io
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.database.engine import get_db
from backend.database.models import CockpitModule
from backend.services import cockpit_service

router = APIRouter()

class CockpitUpdate(BaseModel):
    is_active: Optional[bool] = None
    config_json: Optional[dict] = None

@router.get("")
def list_modules(db: Session = Depends(get_db)):
    cockpit_service.sync_modules_to_db(db)
    modules = db.query(CockpitModule).order_by(CockpitModule.name).all()
    return[{
        "id": m.id,
        "name": m.name,
        "slug": m.slug,
        "description": m.description,
        "version": m.version,
        "author": m.author,
        "is_active": m.is_active,
        "config_json": m.config_json,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    } for m in modules]

@router.get("/{slug}/ui.js")
def get_ui_js(slug: str, db: Session = Depends(get_db)):
    m = db.query(CockpitModule).filter(CockpitModule.slug == slug).first()
    if not m or not m.module_path or not os.path.exists(m.module_path):
        return Response(content="export async function render(c) { c.innerHTML = '<div class=\"empty-state\">Modul nicht gefunden</div>'; }", media_type="application/javascript")
    
    ui_path = os.path.join(m.module_path, "ui.js")
    if not os.path.exists(ui_path):
        return Response(content="export async function render(c) { c.innerHTML = '<div class=\"empty-state\">ui.js fehlt im Modul</div>'; }", media_type="application/javascript")
        
    return FileResponse(ui_path, media_type="application/javascript")

@router.post("/{slug}/api/{method}")
def execute_api(slug: str, method: str, body: dict = {}, db: Session = Depends(get_db)):
    return cockpit_service.execute_api(slug, db, method, body)

@router.put("/{module_id}")
def update_module(module_id: int, body: CockpitUpdate, db: Session = Depends(get_db)):
    m = db.query(CockpitModule).filter(CockpitModule.id == module_id).first()
    if not m: raise HTTPException(404)
    if body.is_active is not None: m.is_active = body.is_active
    if body.config_json is not None: m.config_json = body.config_json
    db.commit()
    return {"ok": True}

@router.delete("/{module_id}")
def delete_module(module_id: int, db: Session = Depends(get_db)):
    m = db.query(CockpitModule).filter(CockpitModule.id == module_id).first()
    if not m: raise HTTPException(404)
    cockpit_service.delete_module_files(m.slug, db)
    db.delete(m)
    db.commit()
    return {"ok": True}

@router.post("/{module_id}/reload")
def reload_module(module_id: int, db: Session = Depends(get_db)):
    m = db.query(CockpitModule).filter(CockpitModule.id == module_id).first()
    if not m: raise HTTPException(404)
    cockpit_service.clear_module_cache(m.slug)
    cockpit_service.sync_modules_to_db(db)
    return {"ok": True}

@router.post("/upload")
async def upload_module(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".zip"): raise HTTPException(400, "Nur .zip Dateien sind erlaubt.")
    content = await file.read()
    temp_dir = cockpit_service.COCKPIT_MODULES_DIR / f"_temp_{os.urandom(4).hex()}"
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as zf: zf.extractall(temp_dir)
        items =[i for i in temp_dir.iterdir() if not i.name.startswith('.')]
        actual_root = items[0] if len(items) == 1 and items[0].is_dir() else temp_dir
            
        errors = cockpit_service.validate_module_structure(actual_root)
        if errors:
            shutil.rmtree(temp_dir)
            return {"ok": False, "errors": errors}
            
        with open(actual_root / "manifest.json", "r") as f: manifest = json.load(f)
        slug = manifest.get("slug")
        target_dir = cockpit_service.COCKPIT_MODULES_DIR / slug
        if target_dir.exists(): shutil.rmtree(target_dir)
        
        cockpit_service.clear_module_cache(slug)
        shutil.move(str(actual_root), str(target_dir))
        cockpit_service.sync_modules_to_db(db)
        return {"ok": True, "slug": slug}
    except Exception as e:
        if temp_dir.exists(): shutil.rmtree(temp_dir)
        raise HTTPException(500, str(e))
    finally:
        if temp_dir.exists(): shutil.rmtree(temp_dir, ignore_errors=True)





