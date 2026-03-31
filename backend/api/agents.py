from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.database.engine import get_db
from backend.database.models import Agent, Skill, AgentSkill
from backend.services import audit_service

router = APIRouter()


class AgentCreate(BaseModel):
    tenant_id: int
    name: str
    description: Optional[str] = ""
    agent_type: Optional[str] = "custom"
    system_prompt: Optional[str] = ""
    llm_model: Optional[str] = "qwen-large"
    llm_temperature: Optional[float] = 0.7
    llm_config_json: Optional[dict] = {}
    system_tools: Optional[list] = ["execsql", "set_memory", "delete_memory", "get_database_schema", "insert_record"]
    allowed_files: Optional[list] = ["pdf", "image", "text"]


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    llm_model: Optional[str] = None
    llm_temperature: Optional[float] = None
    llm_config_json: Optional[dict] = None
    system_tools: Optional[list] = None
    allowed_files: Optional[list] = None
    is_active: Optional[bool] = None


@router.get("")
def list_agents(tenant_id: int, db: Session = Depends(get_db)):
    from backend.database.models import AgentTenantAccess
    # Eigene Agenten + freigegebene Agenten
    shared_ids = db.query(AgentTenantAccess.agent_id).filter(AgentTenantAccess.tenant_id == tenant_id).all()
    shared_ids = [r[0] for r in shared_ids]
    
    agents = db.query(Agent).filter(
        (Agent.tenant_id == tenant_id) | (Agent.id.in_(shared_ids))
    ).order_by(Agent.name).all()
    return [_serialize(a) for a in agents]

@router.get("/{agent_id}/permissions")
def get_agent_permissions(agent_id: int, db: Session = Depends(get_db)):
    from backend.database.models import AgentTenantAccess
    access = db.query(AgentTenantAccess).filter(AgentTenantAccess.agent_id == agent_id).all()
    return [a.tenant_id for a in access]

@router.put("/{agent_id}/permissions")
def update_agent_permissions(agent_id: int, body: dict, db: Session = Depends(get_db)):
    from backend.database.models import AgentTenantAccess
    tenant_ids = body.get("tenant_ids", [])
    db.query(AgentTenantAccess).filter(AgentTenantAccess.agent_id == agent_id).delete()
    for tid in tenant_ids:
        db.add(AgentTenantAccess(agent_id=agent_id, tenant_id=tid))
    db.commit()
    return {"ok": True}


@router.post("")
def create_agent(body: AgentCreate, db: Session = Depends(get_db)):
    a = Agent(**body.model_dump())
    db.add(a)
    db.commit()
    db.refresh(a)
    audit_service.log_action(db, a.tenant_id, "agent.created", "agent", a.id, details={"name": a.name})
    return _serialize(a)


@router.get("/{agent_id}")
def get_agent(agent_id: int, db: Session = Depends(get_db)):
    a = db.query(Agent).filter(Agent.id == agent_id).first()
    if not a:
        raise HTTPException(404, "Agent nicht gefunden")
    return _serialize(a)


@router.put("/{agent_id}")
def update_agent(agent_id: int, body: AgentUpdate, db: Session = Depends(get_db)):
    a = db.query(Agent).filter(Agent.id == agent_id).first()
    if not a:
        raise HTTPException(404, "Agent nicht gefunden")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(a, field, val)
    db.commit()
    db.refresh(a)
    audit_service.log_action(db, a.tenant_id, "agent.updated", "agent", a.id)
    return _serialize(a)


@router.delete("/{agent_id}")
def delete_agent(agent_id: int, db: Session = Depends(get_db)):
    a = db.query(Agent).filter(Agent.id == agent_id).first()
    if not a:
        raise HTTPException(404, "Agent nicht gefunden")
    tid = a.tenant_id
    db.delete(a)
    db.commit()
    audit_service.log_action(db, tid, "agent.deleted", "agent", agent_id)
    return {"ok": True}


@router.post("/{agent_id}/execute")
async def execute_agent(agent_id: int, body: dict, db: Session = Depends(get_db)):
    from backend.services.agent_service import execute_agent_task
    tenant_id = body.get("tenant_id")
    instruction = body.get("instruction", "")
    context = body.get("context")
    if not tenant_id or not instruction:
        raise HTTPException(400, "tenant_id und instruction erforderlich")
    result = await execute_agent_task(db, agent_id, tenant_id, instruction, context)
    return result


@router.get("/{agent_id}/skills")
def get_agent_skills(agent_id: int, db: Session = Depends(get_db)):
    links = db.query(AgentSkill).filter(AgentSkill.agent_id == agent_id).all()
    if not links:
        return []
    s_ids = [l.skill_id for l in links]
    items = db.query(Skill).filter(Skill.id.in_(s_ids)).all()
    return [{"id": s.id, "name": s.name, "category": s.category} for s in items]


@router.put("/{agent_id}/skills")
def set_agent_skills(agent_id: int, body: dict, db: Session = Depends(get_db)):
    skill_ids = body.get("skill_ids", [])
    db.query(AgentSkill).filter(AgentSkill.agent_id == agent_id).delete()
    for sid in skill_ids:
        db.add(AgentSkill(agent_id=agent_id, skill_id=sid))
    db.commit()
    audit_service.log_action(
        db, db.query(Agent).filter(Agent.id == agent_id).first().tenant_id,
        "agent.skills.updated", "agent", agent_id, details={"skill_ids": skill_ids},
    )
    return {"ok": True, "skill_ids": skill_ids}


def _serialize(a: Agent) -> dict:
    return {
        "id": a.id,
        "tenant_id": a.tenant_id,
        "name": a.name,
        "description": a.description,
        "agent_type": a.agent_type,
        "system_prompt": a.system_prompt,
        "llm_model": a.llm_model,
        "llm_temperature": a.llm_temperature,
        "llm_config_json": a.llm_config_json,
        "system_tools": a.system_tools or [],
        "allowed_files": a.allowed_files or [],
        "is_active": a.is_active,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }











