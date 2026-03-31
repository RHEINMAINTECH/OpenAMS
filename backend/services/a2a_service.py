import os
import json
import importlib
import shutil
import zipfile
import io
import inspect
from pathlib import Path
from sqlalchemy.orm import Session
from backend.database.models import A2AModule


A2A_MODULES_DIR = Path(__file__).resolve().parent.parent / "a2a_modules"
A2A_MODULES_DIR.mkdir(parents=True, exist_ok=True)

_loaded_modules = {}
_module_mtimes = {}


def validate_module_structure(module_path: Path) -> list[str]:
    errors = []
    
    manifest_path = module_path / "manifest.json"
    init_path = module_path / "__init__.py"
    
    if not manifest_path.exists():
        errors.append("MISSING_FILE: 'manifest.json' not found in module root.")
    if not init_path.exists():
        errors.append("MISSING_FILE: '__init__.py' not found in module root.")
        
    if errors: return errors

    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
    except json.JSONDecodeError as e:
        errors.append(f"INVALID_JSON: 'manifest.json' contains syntax errors: {str(e)}")
        return errors

    required_fields = ["name", "slug", "version", "capabilities"]
    for field in required_fields:
        if field not in manifest:
            errors.append(f"MISSING_MANIFEST_FIELD: The field '{field}' is mandatory in manifest.json.")

    if not errors:
        try:
            spec = importlib.util.spec_from_file_location(f"val_{os.urandom(4).hex()}", str(init_path))
            temp_mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(temp_mod)
            
            caps = manifest.get("capabilities", {})
            for direction in ["read", "write"]:
                for method in caps.get(direction, []):
                    func_name = f"{direction}_{method}"
                    if not hasattr(temp_mod, func_name):
                        errors.append(f"MISSING_FUNCTION: Capability '{direction}:{method}' is defined in manifest, but function '{func_name}(params: dict)' is missing in __init__.py.")
                    else:
                        sig = inspect.signature(getattr(temp_mod, func_name))
                        if len(sig.parameters) == 0:
                            errors.append(f"INVALID_SIGNATURE: Function '{func_name}' must accept at least one argument (params: dict).")
        except Exception as e:
            errors.append(f"IMPORT_ERROR: Could not load __init__.py for validation: {str(e)}")

    return errors


def delete_module_files(slug: str, db: Session):
    mod = db.query(A2AModule).filter(A2AModule.slug == slug).first()
    if mod and mod.module_path and os.path.exists(mod.module_path):
        shutil.rmtree(mod.module_path)
    
    if slug in _loaded_modules:
        del _loaded_modules[slug]
    if slug in _module_mtimes:
        del _module_mtimes[slug]


def discover_modules():
    modules = []
    if not A2A_MODULES_DIR.exists():
        return modules
    for item in A2A_MODULES_DIR.iterdir():
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
    
    db.query(A2AModule).filter(A2AModule.slug.notin_(discovered_slugs)).delete(synchronize_session=False)

    for m in discovered:
        slug = m.get("slug", "")
        existing = db.query(A2AModule).filter(A2AModule.slug == slug).first()
        if not existing:
            mod = A2AModule(
                name=m.get("name", slug),
                slug=slug,
                description=m.get("description", ""),
                version=m.get("version", "1.0.0"),
                author=m.get("author", ""),
                is_active=False,
                config_json=m.get("default_config", {}),
                capabilities_json=m.get("capabilities", {}),
                module_path=m.get("_dir", ""),
            )
            db.add(mod)
        else:
            existing.name = m.get("name", existing.name)
            existing.description = m.get("description", existing.description)
            existing.version = m.get("version", existing.version)
            existing.author = m.get("author", existing.author)
            existing.capabilities_json = m.get("capabilities", existing.capabilities_json)
            existing.module_path = m.get("_dir", existing.module_path)
            
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
    mod_record = db.query(A2AModule).filter(A2AModule.slug == slug, A2AModule.is_active == True).first()
    if not mod_record or not mod_record.module_path:
        return None
        
    module_dir = Path(mod_record.module_path)
    init_file = module_dir / "__init__.py"
    
    if not init_file.exists():
        return None
        
    current_mtime = os.path.getmtime(init_file)
    
    if slug in _loaded_modules:
        if _module_mtimes.get(slug) == current_mtime:
            return _loaded_modules[slug]
            
    try:
        spec = importlib.util.spec_from_file_location(
            f"a2a_modules.{slug}",
            str(init_file),
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _loaded_modules[slug] = mod
        _module_mtimes[slug] = current_mtime
        return mod
    except Exception:
        return None


def execute_read(slug: str, db: Session, method: str, params: dict = None):
    mod_record = db.query(A2AModule).filter(A2AModule.slug == slug, A2AModule.is_active == True).first()
    if not mod_record:
        return {"error": f"Modul '{slug}' nicht verfügbar oder nicht aktiv"}
        
    mod = load_module(slug, db)
    if not mod:
        return {"error": f"Modul '{slug}' konnte nicht geladen werden"}
        
    fn = getattr(mod, f"read_{method}", None)
    if not fn:
        return {"error": f"Lesemethode '{method}' nicht gefunden"}
        
    p = dict(params) if params else {}
    p["config"] = mod_record.config_json or {}
    
    res = fn(p)
    if isinstance(res, dict) and res.get("status") == "error":
        res["_debug"] = {
            "db_config_injected": p["config"],
            "params_received": params,
            "hint": "Check if API key is empty in the UI (A2A-Module -> Konfigurieren)"
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

def execute_write(slug: str, db: Session, method: str, params: dict = None):
    mod_record = db.query(A2AModule).filter(A2AModule.slug == slug, A2AModule.is_active == True).first()
    if not mod_record:
        return {"error": f"Modul '{slug}' nicht verfügbar oder nicht aktiv"}
        
    mod = load_module(slug, db)
    if not mod:
        return {"error": f"Modul '{slug}' konnte nicht geladen werden"}
        
    fn = getattr(mod, f"write_{method}", None)
    if not fn:
        return {"error": f"Schreibmethode '{method}' nicht gefunden"}
        
    p = dict(params) if params else {}
    p["config"] = mod_record.config_json or {}
    
    res = fn(p)
    if isinstance(res, dict) and res.get("status") == "error":
        res["_debug"] = {
            "db_config_injected": p["config"],
            "params_received": params,
            "hint": "Check if API key is empty in the UI (A2A-Module -> Konfigurieren)"
        }
    return res







