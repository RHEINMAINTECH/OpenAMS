import os
import json
import importlib
import shutil
import zipfile
import io
import inspect
from pathlib import Path
from sqlalchemy.orm import Session
from backend.database.models import AppModule


APP_MODULES_DIR = Path(__file__).resolve().parent.parent / "app_modules"

_loaded_modules = {}
_module_mtimes = {}


def validate_module_structure(module_path: Path) -> list[str]:
    errors = []
    
    manifest_path = module_path / "manifest.json"
    init_path = module_path / "__init__.py"
    ui_path = module_path / "ui.js"
    
    if not manifest_path.exists():
        errors.append("MISSING_FILE: 'manifest.json' not found in module root.")
    if not init_path.exists():
        errors.append("MISSING_FILE: '__init__.py' not found in module root.")
    if not ui_path.exists():
        errors.append("MISSING_FILE: 'ui.js' not found in module root. App modules require a frontend UI.")
        
    if errors: return errors

    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
    except json.JSONDecodeError as e:
        errors.append(f"INVALID_JSON: 'manifest.json' contains syntax errors: {str(e)}")
        return errors

    required_fields = ["name", "slug", "version"]
    for field in required_fields:
        if field not in manifest:
            errors.append(f"MISSING_MANIFEST_FIELD: The field '{field}' is mandatory in manifest.json.")

    return errors


def delete_module_files(slug: str, db: Session):
    mod = db.query(AppModule).filter(AppModule.slug == slug).first()
    if mod and mod.module_path and os.path.exists(mod.module_path):
        shutil.rmtree(mod.module_path)
    
    if slug in _loaded_modules:
        del _loaded_modules[slug]
    if slug in _module_mtimes:
        del _module_mtimes[slug]


def discover_modules():
    modules = []
    if not APP_MODULES_DIR.exists():
        return modules
    for item in APP_MODULES_DIR.iterdir():
        if item.is_dir() and (item / "manifest.json").exists():
            try:
                with open(item / "manifest.json", "r", encoding="utf-8") as f:
                    manifest = json.load(f)
                manifest["_dir"] = str(item)
                modules.append(manifest)
            except:
                continue
    return modules


def sync_modules_to_db(db: Session):
    discovered = discover_modules()
    discovered_slugs = [m.get("slug") for m in discovered]
    
    # Remove records from DB that no longer exist on disk
    db.query(AppModule).filter(AppModule.slug.notin_(discovered_slugs)).delete(synchronize_session=False)

    for m in discovered:
        slug = m.get("slug", "")
        existing = db.query(AppModule).filter(AppModule.slug == slug).first()
        if not existing:
            mod = AppModule(
                name=m.get("name", slug),
                slug=slug,
                description=m.get("description", ""),
                version=m.get("version", "1.0.0"),
                author=m.get("author", ""),
                is_active=False,
                config_json=m.get("default_config", {}),
                input_schema=m.get("input_schema", {}),
                extraction_prompt=m.get("extraction_prompt", ""),
                views_json=m.get("views", {}),
                module_path=m.get("_dir", ""),
            )
            db.add(mod)
        else:
            # Update metadata if changed
            existing.name = m.get("name", existing.name)
            existing.description = m.get("description", existing.description)
            existing.version = m.get("version", existing.version)
            existing.author = m.get("author", existing.author)
            existing.input_schema = m.get("input_schema", existing.input_schema)
            existing.extraction_prompt = m.get("extraction_prompt", existing.extraction_prompt)
            existing.views_json = m.get("views", existing.views_json)
            existing.module_path = m.get("_dir", existing.module_path)
            
            # Update config_json if new default_config keys were added
            current_cfg = existing.config_json or {}
            def_cfg = m.get("default_config", {})
            changed = False
            for k, v in def_cfg.items():
                if k not in current_cfg:
                    current_cfg[k] = v
                    changed = True
            if changed:
                existing.config_json = current_cfg
                
    db.commit()


def load_module(slug: str, db: Session):
    mod_record = db.query(AppModule).filter(AppModule.slug == slug, AppModule.is_active == True).first()
    if not mod_record or not mod_record.module_path:
        return None
        
    module_dir = Path(mod_record.module_path)
    init_file = module_dir / "__init__.py"
    
    if not init_file.exists():
        return None
        
    current_mtime = os.path.getmtime(init_file)
    
    # Hot-Reload Unterstützung für App Module
    if slug in _loaded_modules:
        if _module_mtimes.get(slug) == current_mtime:
            return _loaded_modules[slug]
            
    try:
        spec = importlib.util.spec_from_file_location(
            f"app_modules.{slug}",
            str(init_file),
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _loaded_modules[slug] = mod
        _module_mtimes[slug] = current_mtime
        return mod
    except Exception:
        return None


def execute_app_action(slug: str, db: Session, action: str, params: dict = None, feed_item_id: int = None):
    mod_record = db.query(AppModule).filter(AppModule.slug == slug, AppModule.is_active == True).first()
    if not mod_record:
        return {"error": f"App-Modul '{slug}' nicht verfügbar oder nicht aktiv"}
        
    mod = load_module(slug, db)
    if not mod:
        return {"error": f"App-Modul '{slug}' konnte nicht geladen werden"}
        
    fn = getattr(mod, f"action_{action}", None)
    if not fn:
        return {"error": f"Aktion '{action}' nicht im App-Modul gefunden"}
        
    p = dict(params) if params else {}
    p["config"] = mod_record.config_json or {}
    if feed_item_id:
        p["feed_item_id"] = feed_item_id
    
    res = fn(p, db)
    if isinstance(res, dict) and res.get("status") == "error":
        res["_debug"] = {
            "db_config_injected": p["config"],
            "params_received": params,
            "hint": "Check configuration in App Module Settings"
        }
    return res


def clear_module_cache(slug: str):
    """
    Entfernt das Modul aus dem internen Cache, um ein Neuladen zu erzwingen.
    """
    if slug in _loaded_modules:
        del _loaded_modules[slug]
    if slug in _module_mtimes:
        del _module_mtimes[slug]



