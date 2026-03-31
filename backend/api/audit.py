from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.database.engine import get_db
from backend.services import audit_service

router = APIRouter()


import csv
import io
import datetime
from fastapi.responses import StreamingResponse

@router.get("")
def list_audit_logs(
    tenant_id: int,
    entity_type: str = None,
    agent_id: int = None,
    workflow_id: int = None,
    start_date: str = None,
    end_date: str = None,
    limit: int = Query(100, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
):
    s_date = datetime.datetime.fromisoformat(start_date) if start_date else None
    e_date = datetime.datetime.fromisoformat(end_date) if end_date else None
    
    items, total = audit_service.get_audit_logs(
        db, tenant_id, limit, offset, entity_type, agent_id, workflow_id, s_date, e_date
    )
    return {
        "total": total,
        "items": [
            {
                "id": a.id,
                "tenant_id": a.tenant_id,
                "agent_id": a.agent_id,
                "workflow_id": a.workflow_id,
                "action": a.action,
                "entity_type": a.entity_type,
                "entity_id": a.entity_id,
                "details_json": a.details_json,
                "timestamp": a.timestamp.isoformat() if a.timestamp else None,
            }
            for a in items
        ],
    }

@router.get("/export")
def export_audit_logs(
    tenant_id: int,
    entity_type: str = None,
    agent_id: int = None,
    workflow_id: int = None,
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db),
):
    s_date = datetime.datetime.fromisoformat(start_date) if start_date else None
    e_date = datetime.datetime.fromisoformat(end_date) if end_date else None
    
    # Export ignores pagination
    items, _ = audit_service.get_audit_logs(
        db, tenant_id, 10000, 0, entity_type, agent_id, workflow_id, s_date, e_date
    )
    
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';', quoting=csv.QUOTE_MINIMAL)
    writer.writerow(["ID", "Timestamp", "AgentID", "WorkflowID", "Action", "EntityType", "EntityID", "Details"])
    
    for a in items:
        writer.writerow([
            a.id,
            a.timestamp.isoformat() if a.timestamp else "",
            a.agent_id or "",
            a.workflow_id or "",
            a.action,
            a.entity_type,
            a.entity_id or "",
            str(a.details_json)
        ])
    
    output.seek(0)
    filename = f"audit_export_{tenant_id}_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )











