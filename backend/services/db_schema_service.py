from sqlalchemy.orm import Session
from sqlalchemy import text
import logging

logger = logging.getLogger(__name__)

def _get_table_name(tenant_id: int, slug: str) -> str:
    return f"ds_{tenant_id}_{slug.replace('-', '_').lower()}"

def sync_dynamic_table(db: Session, tenant_id: int, slug: str, schema_json: dict):
    table_name = _get_table_name(tenant_id, slug)
    fields = schema_json.get("fields", [])
    
    # Create Table with SERIAL
    cols = ["id SERIAL PRIMARY KEY"]
    for f in fields:
        t = "TEXT"
        f_type = f.get("type", "string")
        if f_type == "integer": t = "INTEGER"
        elif f_type == "float": t = "DOUBLE PRECISION"
        elif f_type == "boolean": t = "BOOLEAN"
        cols.append(f"{f['name']} {t}")
        
    db.execute(text(f"CREATE TABLE IF NOT EXISTS {table_name} ({', '.join(cols)})"))
    
    # Sync Columns
    check_sql = text("SELECT column_name FROM information_schema.columns WHERE table_name = :t")
    res = db.execute(check_sql, {"t": table_name}).fetchall()
    existing_cols = [row[0].lower() for row in res]
    
    for f in fields:
        col_name = f["name"].lower()
        if col_name not in existing_cols:
            t = "TEXT"
            f_type = f.get("type", "string")
            if f_type == "integer": t = "INTEGER"
            elif f_type == "float": t = "DOUBLE PRECISION"
            elif f_type == "boolean": t = "BOOLEAN"
            db.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {f['name']} {t}"))
            
    db.commit()

def drop_dynamic_table(db: Session, tenant_id: int, slug: str):
    table_name = _get_table_name(tenant_id, slug)
    db.execute(text(f"DROP TABLE IF EXISTS {table_name} CASCADE"))
    db.commit()

def get_dynamic_records(db: Session, tenant_id: int, slug: str, limit: int, offset: int) -> list:
    table_name = _get_table_name(tenant_id, slug)
    try:
        res = db.execute(text(f"SELECT * FROM {table_name} ORDER BY id DESC LIMIT :l OFFSET :o"), {"l": limit, "o": offset}).mappings().fetchall()
        return [dict(r) for r in res]
    except Exception as e:
        logger.error(f"Error getting records from {table_name}: {e}")
        return []

def get_dynamic_records_count(db: Session, tenant_id: int, slug: str) -> int:
    table_name = _get_table_name(tenant_id, slug)
    try:
        return db.execute(text(f"SELECT COUNT(*) FROM {table_name}")).scalar()
    except Exception:
        return 0

def insert_dynamic_record(db: Session, tenant_id: int, slug: str, data: dict) -> dict:
    table_name = _get_table_name(tenant_id, slug)
    keys = list(data.keys())
    if not keys: return {}
    
    places = [f":{k}" for k in keys]
    sql_str = f"INSERT INTO {table_name} ({', '.join(keys)}) VALUES ({', '.join(places)}) RETURNING *"
    
    res = db.execute(text(sql_str), data).mappings().first()
    db.commit()
    return dict(res) if res else {}

def update_dynamic_record(db: Session, tenant_id: int, slug: str, record_id: int, data: dict) -> dict:
    table_name = _get_table_name(tenant_id, slug)
    if not data: return {}
    
    sets = [f"{k} = :{k}" for k in data.keys()]
    sql = f"UPDATE {table_name} SET {', '.join(sets)} WHERE id = :_id RETURNING *"
    data["_id"] = record_id
    
    res = db.execute(text(sql), data).mappings().first()
    db.commit()
    return dict(res) if res else {}

def delete_dynamic_record(db: Session, tenant_id: int, slug: str, record_id: int):
    table_name = _get_table_name(tenant_id, slug)
    db.execute(text(f"DELETE FROM {table_name} WHERE id = :id"), {"id": record_id})
    db.commit()

def rename_tenant_tables(db: Session, tenant_id: int, old_slug: str, new_slug: str):
    """
    Benennt alle SQL-Tabellen eines Mandanten um, wenn sich sein Slug ändert.
    """
    from backend.database.models import DataStructure
    structures = db.query(DataStructure).filter(DataStructure.tenant_id == tenant_id).all()
    for ds in structures:
        old_name = _get_table_name(tenant_id, old_slug)
        new_name = _get_table_name(tenant_id, new_slug)
        try:
            db.execute(text(f"ALTER TABLE IF EXISTS {old_name} RENAME TO {new_name}"))
        except Exception as e:
            logger.error(f"Could not rename table {old_name} to {new_name}: {e}")
    db.commit()



