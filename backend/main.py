from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from backend.config import settings
from backend.database.migrations import init_db
from backend.api.router import api_router
from backend.services.scheduler_service import start_scheduler

app = FastAPI(title=settings.APP_TITLE, docs_url="/api/docs", redoc_url=None)

app.include_router(api_router)

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="assets")


@app.on_event("startup")
def on_startup():
    import logging
    logger = logging.getLogger("uvicorn.error")
    
    logger.info(f"--- STARTING OpenAMS (PostgreSQL Mode) ---")
    
    try:
        init_db()
        logger.info("Database initialized successfully.")
        
        # Garantiert, dass die dynamischen Tabellen in SQLite wirklich physisch existieren
        from backend.database.engine import SessionLocal
        from backend.database.models import DataStructure
        from backend.services.db_schema_service import sync_dynamic_table
        from backend.services.cockpit_service import sync_modules_to_db as sync_cockpits
        from backend.services.app_module_service import sync_modules_to_db as sync_apps
        
        db = SessionLocal()
        try:
            # WICHTIG: Zuerst Datenstrukturen synchronisieren, damit SQL Tabellen existieren
            all_ds = db.query(DataStructure).all()
            logger.info(f"Syncing {len(all_ds)} dynamic data structures...")
            for ds in all_ds:
                sync_dynamic_table(db, ds.tenant_id, ds.slug, ds.schema_json or {})
                
            sync_cockpits(db)
            sync_apps(db)
            
            from backend.database.models import CockpitModule
            vo = db.query(CockpitModule).filter(CockpitModule.slug == 'verwaltung-org').first()
            if vo and not vo.is_active:
                vo.is_active = True
                db.commit()
                
        except Exception as e:
            logger.error(f"Error during data sync: {e}")
        finally:
            db.close()
            
        start_scheduler()
        logger.info("Scheduler started.")
        
    except Exception as fatal:
        logger.critical(f"FATAL STARTUP ERROR: {fatal}")
        # Wir lassen die Exception absichtlich weiterlaufen, damit uvicorn/systemd den Fehler bemerken
        raise fatal


@app.get("/")
async def serve_index():
    return FileResponse(str(FRONTEND_DIR / "index.html"))


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    file_path = FRONTEND_DIR / full_path
    if file_path.is_file():
        return FileResponse(str(file_path))
    return FileResponse(str(FRONTEND_DIR / "index.html"))











