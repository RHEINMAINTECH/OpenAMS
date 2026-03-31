from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.database.engine import get_db
from backend.database.models import LLMLog

router = APIRouter()

@router.get("")
def list_llm_logs(
    limit: int = Query(50, le=100),
    offset: int = 0,
    db: Session = Depends(get_db)
):
    q = db.query(LLMLog)
    total = q.count()
    items = q.order_by(LLMLog.created_at.desc()).offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "items": [
            {
                "id": l.id,
                "model": l.model,
                "duration_ms": l.duration_ms,
                "prompt_raw": l.prompt_raw,
                "response_raw": l.response_raw,
                "created_at": l.created_at.isoformat()
            }
            for l in items
        ]
    }










