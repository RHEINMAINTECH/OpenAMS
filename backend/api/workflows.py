from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.database.engine import get_db
from backend.database.models import Workflow, WorkflowAgent
from backend.services import audit_service, workflow_service

router = APIRouter()


class WorkflowCreate(BaseModel):
    tenant_id: int
    name: str
    slug: str
    description: Optional[str] = ""
    category: Optional[str] = "custom"
    has_menu_entry: Optional[bool] = False
    has_feed: Optional[bool] = True
    config_json: Optional[dict] = {}


class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None
    has_menu_entry: Optional[bool] = None
    has_feed: Optional[bool] = None
    config_json: Optional[dict] = None


class AgentAssign(BaseModel):
    agent_id: int
    role: Optional[str] = "executor"


@router.get("")
def list_workflows(tenant_id: int, db: Session = Depends(get_db)):
    from backend.database.models import WorkflowTenantAccess
    shared_ids = db.query(WorkflowTenantAccess.workflow_id).filter(WorkflowTenantAccess.tenant_id == tenant_id).all()
    shared_ids = [r[0] for r in shared_ids]
    
    wfs = db.query(Workflow).filter(
        (Workflow.tenant_id == tenant_id) | (Workflow.id.in_(shared_ids))
    ).order_by(Workflow.is_standard.desc(), Workflow.name).all()
    return [_serialize(w) for w in wfs]

@router.get("/{workflow_id}/permissions")
def get_workflow_permissions(workflow_id: int, db: Session = Depends(get_db)):
    from backend.database.models import WorkflowTenantAccess
    access = db.query(WorkflowTenantAccess).filter(WorkflowTenantAccess.workflow_id == workflow_id).all()
    return [a.tenant_id for a in access]

@router.put("/{workflow_id}/permissions")
def update_workflow_permissions(workflow_id: int, body: dict, db: Session = Depends(get_db)):
    from backend.database.models import WorkflowTenantAccess
    tenant_ids = body.get("tenant_ids", [])
    db.query(WorkflowTenantAccess).filter(WorkflowTenantAccess.workflow_id == workflow_id).delete()
    for tid in tenant_ids:
        db.add(WorkflowTenantAccess(workflow_id=workflow_id, tenant_id=tid))
    db.commit()
    return {"ok": True}


@router.post("")
def create_workflow(body: WorkflowCreate, db: Session = Depends(get_db)):
    wf = Workflow(**body.model_dump())
    db.add(wf)
    db.commit()
    db.refresh(wf)
    audit_service.log_action(db, wf.tenant_id, "workflow.created", "workflow", wf.id, details={"name": wf.name})
    return _serialize(wf)


@router.get("/{workflow_id}")
def get_workflow(workflow_id: int, db: Session = Depends(get_db)):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(404, "Workflow nicht gefunden")
    return _serialize(wf)


@router.put("/{workflow_id}")
def update_workflow(workflow_id: int, body: WorkflowUpdate, db: Session = Depends(get_db)):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(404, "Workflow nicht gefunden")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(wf, field, val)
    db.commit()
    db.refresh(wf)
    audit_service.log_action(db, wf.tenant_id, "workflow.updated", "workflow", wf.id)
    return _serialize(wf)


@router.delete("/{workflow_id}")
def delete_workflow(workflow_id: int, db: Session = Depends(get_db)):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(404, "Workflow nicht gefunden")
    if wf.is_standard:
        raise HTTPException(400, "Standard-Workflows können nicht gelöscht werden")
    tid = wf.tenant_id
    db.delete(wf)
    db.commit()
    audit_service.log_action(db, tid, "workflow.deleted", "workflow", workflow_id)
    return {"ok": True}


@router.post("/{workflow_id}/agents")
def assign_agent(workflow_id: int, body: AgentAssign, db: Session = Depends(get_db)):
    link = workflow_service.assign_agent_to_workflow(db, workflow_id, body.agent_id, body.role)
    return {"workflow_id": link.workflow_id, "agent_id": link.agent_id, "role": link.role}


@router.delete("/{workflow_id}/agents/{agent_id}")
def unassign_agent(workflow_id: int, agent_id: int, db: Session = Depends(get_db)):
    workflow_service.remove_agent_from_workflow(db, workflow_id, agent_id)
    return {"ok": True}


@router.get("/{workflow_id}/agents")
def list_workflow_agents(workflow_id: int, db: Session = Depends(get_db)):
    links = workflow_service.get_workflow_agents(db, workflow_id)
    return [{"agent_id": l.agent_id, "role": l.role} for l in links]


@router.get("/{workflow_id}/mcp-modules")
def get_workflow_mcp_modules(workflow_id: int, db: Session = Depends(get_db)):
    from backend.database.models import WorkflowMCPModule
    links = db.query(WorkflowMCPModule).filter(WorkflowMCPModule.workflow_id == workflow_id).all()
    return [l.mcp_module_id for l in links]


@router.put("/{workflow_id}/mcp-modules")
def set_workflow_mcp_modules(workflow_id: int, body: dict, db: Session = Depends(get_db)):
    from backend.database.models import WorkflowMCPModule
    mcp_ids = body.get("mcp_ids", [])
    db.query(WorkflowMCPModule).filter(WorkflowMCPModule.workflow_id == workflow_id).delete()
    for mid in mcp_ids:
        db.add(WorkflowMCPModule(workflow_id=workflow_id, mcp_module_id=mid))
    db.commit()
    return {"ok": True}


@router.get("/{workflow_id}/a2a-modules")
def get_workflow_a2a_modules(workflow_id: int, db: Session = Depends(get_db)):
    from backend.database.models import WorkflowA2AModule
    links = db.query(WorkflowA2AModule).filter(WorkflowA2AModule.workflow_id == workflow_id).all()
    return [l.a2a_module_id for l in links]


@router.put("/{workflow_id}/a2a-modules")
def set_workflow_a2a_modules(workflow_id: int, body: dict, db: Session = Depends(get_db)):
    from backend.database.models import WorkflowA2AModule
    a2a_ids = body.get("a2a_ids", [])
    db.query(WorkflowA2AModule).filter(WorkflowA2AModule.workflow_id == workflow_id).delete()
    for mid in a2a_ids:
        db.add(WorkflowA2AModule(workflow_id=workflow_id, a2a_module_id=mid))
    db.commit()
    return {"ok": True}


@router.get("/{workflow_id}/data-structures")
def get_workflow_data_structures(workflow_id: int, db: Session = Depends(get_db)):
    from backend.database.models import WorkflowDataStructure
    links = db.query(WorkflowDataStructure).filter(WorkflowDataStructure.workflow_id == workflow_id).all()
    return [{"id": l.data_structure_id, "permission": l.permission} for l in links]


@router.put("/{workflow_id}/data-structures")
def set_workflow_data_structures(workflow_id: int, body: dict, db: Session = Depends(get_db)):
    from backend.database.models import WorkflowDataStructure
    ds_links = body.get("ds_links", [])
    db.query(WorkflowDataStructure).filter(WorkflowDataStructure.workflow_id == workflow_id).delete()
    for link in ds_links:
        db.add(WorkflowDataStructure(
            workflow_id=workflow_id,
            data_structure_id=link["id"],
            permission=link.get("permission", "R")
        ))
    db.commit()
    return {"ok": True}


class TriggerCreate(BaseModel):
    trigger_type: str
    config_json: dict = {}
    is_active: bool = True

class TriggerUpdate(BaseModel):
    trigger_type: Optional[str] = None
    config_json: Optional[dict] = None
    is_active: Optional[bool] = None

@router.get("/{workflow_id}/triggers")
def list_triggers(workflow_id: int, db: Session = Depends(get_db)):
    from backend.database.models import WorkflowTrigger
    triggers = db.query(WorkflowTrigger).filter(WorkflowTrigger.workflow_id == workflow_id).all()
    return [{
        "id": t.id,
        "trigger_type": t.trigger_type,
        "config_json": t.config_json,
        "is_active": t.is_active,
        "last_run": t.last_run.isoformat() if t.last_run else None,
        "next_run": t.next_run.isoformat() if t.next_run else None,
    } for t in triggers]

@router.post("/{workflow_id}/triggers")
def create_trigger(workflow_id: int, body: TriggerCreate, db: Session = Depends(get_db)):
    from backend.database.models import WorkflowTrigger
    t = WorkflowTrigger(workflow_id=workflow_id, **body.model_dump())
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"id": t.id, "trigger_type": t.trigger_type, "config_json": t.config_json, "is_active": t.is_active}

@router.put("/triggers/{trigger_id}")
def update_trigger(trigger_id: int, body: TriggerUpdate, db: Session = Depends(get_db)):
    from backend.database.models import WorkflowTrigger
    t = db.query(WorkflowTrigger).filter(WorkflowTrigger.id == trigger_id).first()
    if not t: raise HTTPException(404, "Trigger nicht gefunden")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(t, k, v)
    db.commit()
    return {"ok": True}

@router.delete("/triggers/{trigger_id}")
def delete_trigger(trigger_id: int, db: Session = Depends(get_db)):
    from backend.database.models import WorkflowTrigger
    t = db.query(WorkflowTrigger).filter(WorkflowTrigger.id == trigger_id).first()
    if not t: raise HTTPException(404, "Trigger nicht gefunden")
    db.delete(t)
    db.commit()
    return {"ok": True}

def _serialize(w: Workflow) -> dict:
    return {
        "id": w.id,
        "tenant_id": w.tenant_id,
        "name": w.name,
        "slug": w.slug,
        "description": w.description,
        "category": w.category,
        "is_active": w.is_active,
        "is_standard": w.is_standard,
        "has_menu_entry": w.has_menu_entry,
        "has_feed": w.has_feed,
        "config_json": w.config_json,
        "created_at": w.created_at.isoformat() if w.created_at else None,
    }











