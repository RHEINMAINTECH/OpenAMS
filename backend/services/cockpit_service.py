import os
import json
import importlib
import importlib.util
import shutil
import inspect
from pathlib import Path
from sqlalchemy.orm import Session
from backend.database.models import CockpitModule

COCKPIT_MODULES_DIR = Path(__file__).resolve().parent.parent / "cockpit_modules"
COCKPIT_MODULES_DIR.mkdir(parents=True, exist_ok=True)

_loaded_modules = {}
_module_mtimes = {}

def validate_module_structure(module_path: Path) -> list[str]:
    errors =[]
    manifest_path = module_path / "manifest.json"
    init_path = module_path / "__init__.py"
    ui_path = module_path / "ui.js"
    
    if not manifest_path.exists():
        errors.append("MISSING_FILE: 'manifest.json' not found.")
    if not init_path.exists():
        errors.append("MISSING_FILE: '__init__.py' not found. Backend API integration is required.")
    if not ui_path.exists():
        errors.append("MISSING_FILE: 'ui.js' not found. A cockpit requires a frontend UI file.")
        
    if errors: return errors

    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
    except Exception as e:
        errors.append(f"INVALID_JSON: {str(e)}")
        return errors

    for field in ["name", "slug", "version"]:
        if field not in manifest:
            errors.append(f"MISSING_MANIFEST_FIELD: '{field}' is mandatory.")

    return errors

def delete_module_files(slug: str, db: Session):
    mod = db.query(CockpitModule).filter(CockpitModule.slug == slug).first()
    if mod and mod.module_path and os.path.exists(mod.module_path):
        shutil.rmtree(mod.module_path)
    
    if slug in _loaded_modules: del _loaded_modules[slug]
    if slug in _module_mtimes: del _module_mtimes[slug]

def discover_modules():
    modules =[]
    if not COCKPIT_MODULES_DIR.exists(): return modules
    for item in COCKPIT_MODULES_DIR.iterdir():
        if item.is_dir() and (item / "manifest.json").exists():
            try:
                with open(item / "manifest.json", "r", encoding="utf-8") as f:
                    manifest = json.load(f)
                manifest["_dir"] = str(item)
                modules.append(manifest)
            except: pass
    return modules

def sync_modules_to_db(db: Session):
    discovered = discover_modules()
    discovered_slugs =[m.get("slug") for m in discovered]
    db.query(CockpitModule).filter(CockpitModule.slug.notin_(discovered_slugs)).delete(synchronize_session=False)

    for m in discovered:
        slug = m.get("slug", "")
        existing = db.query(CockpitModule).filter(CockpitModule.slug == slug).first()
        if not existing:
            mod = CockpitModule(
                name=m.get("name", slug),
                slug=slug,
                description=m.get("description", ""),
                version=m.get("version", "1.0.0"),
                author=m.get("author", ""),
                is_active=False,
                config_json=m.get("default_config", {}),
                module_path=m.get("_dir", ""),
            )
            db.add(mod)
        else:
            existing.name = m.get("name", existing.name)
            existing.description = m.get("description", existing.description)
            existing.version = m.get("version", existing.version)
            existing.author = m.get("author", existing.author)
            existing.module_path = m.get("_dir", existing.module_path)
            
            current_cfg = existing.config_json or {}
            def_cfg = m.get("default_config", {})
            changed = False
            for k, v in def_cfg.items():
                if k not in current_cfg:
                    current_cfg[k] = v
                    changed = True
            if changed: existing.config_json = current_cfg
                
    db.commit()

def load_module(slug: str, db: Session):
    mod_record = db.query(CockpitModule).filter(CockpitModule.slug == slug, CockpitModule.is_active == True).first()
    if not mod_record or not mod_record.module_path: return None
        
    init_file = Path(mod_record.module_path) / "__init__.py"
    if not init_file.exists(): return None
        
    current_mtime = os.path.getmtime(str(init_file))
    if slug in _loaded_modules and _module_mtimes.get(slug) == current_mtime:
        return _loaded_modules[slug]
            
    try:
        spec = importlib.util.spec_from_file_location(f"cockpit_modules.{slug}", str(init_file))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _loaded_modules[slug] = mod
        _module_mtimes[slug] = current_mtime
        return mod
    except Exception as e:
        import logging
        logging.error(f"Error loading cockpit module {slug}: {e}")
        return None

def execute_api(slug: str, db: Session, method: str, params: dict = None):
    mod_record = db.query(CockpitModule).filter(CockpitModule.slug == slug, CockpitModule.is_active == True).first()
    if not mod_record: return {"status": "error", "message": f"Cockpit '{slug}' nicht aktiv"}
        
    mod = load_module(slug, db)
    if not mod: return {"status": "error", "message": f"Cockpit '{slug}' fehlerhaft oder konnte nicht geladen werden"}
        
    fn = getattr(mod, f"api_{method}", None)
    if not fn: return {"status": "error", "message": f"API Methode 'api_{method}' nicht im Modul gefunden"}
        
    p = dict(params) if params else {}
    p["config"] = mod_record.config_json or {}
    
    try:
        # We pass db instance to allow the cockpit to query openams logic natively
        return fn(p, db)
    except Exception as e:
        return {"status": "error", "message": str(e)}

def clear_module_cache(slug: str):
    if slug in _loaded_modules: del _loaded_modules[slug]
    if slug in _module_mtimes: del _module_mtimes[slug]





