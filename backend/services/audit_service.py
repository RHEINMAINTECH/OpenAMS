import datetime
from sqlalchemy.orm import Session
from backend.database.models import AuditLog


def log_action(
    db: Session,
    tenant_id: int,
    action: str,
    entity_type: str = "",
    entity_id: int = None,
    agent_id: int = None,
    workflow_id: int = None,
    details: dict = None,
):
    entry = AuditLog(
        tenant_id=tenant_id,
        agent_id=agent_id,
        workflow_id=workflow_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details_json=details or {},
        timestamp=datetime.datetime.utcnow(),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def get_audit_logs(
    db: Session,
    tenant_id: int,
    limit: int = 100,
    offset: int = 0,
    entity_type: str = None,
    agent_id: int = None,
    workflow_id: int = None,
    start_date: datetime.datetime = None,
    end_date: datetime.datetime = None,
):
    q = db.query(AuditLog).filter(AuditLog.tenant_id == tenant_id)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if agent_id:
        q = q.filter(AuditLog.agent_id == agent_id)
    if workflow_id:
        q = q.filter(AuditLog.workflow_id == workflow_id)
    if start_date:
        q = q.filter(AuditLog.timestamp >= start_date)
    if end_date:
        q = q.filter(AuditLog.timestamp <= end_date)
        
    total = q.count()
    items = q.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()
    return items, total











