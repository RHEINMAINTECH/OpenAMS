from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.database.engine import get_db
from backend.database.models import Goal, Agent
from backend.services import feed_service, agent_service
import asyncio

router = APIRouter()

class GoalCreate(BaseModel):
    tenant_id: int
    name: str
    description: Optional[str] = ""
    strategy_prompt: Optional[str] = ""
    agent_id: Optional[int] = None
    milestones_json: Optional[list] = []

class GoalUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    strategy_prompt: Optional[str] = None
    status: Optional[str] = None
    agent_id: Optional[int] = None
    milestones_json: Optional[list] = None

@router.get("")
def list_goals(tenant_id: int, db: Session = Depends(get_db)):
    items = db.query(Goal).filter(Goal.tenant_id == tenant_id).order_by(Goal.status, Goal.created_at.desc()).all()
    return [_serialize(g) for g in items]

@router.post("")
def create_goal(body: GoalCreate, db: Session = Depends(get_db)):
    g = Goal(**body.model_dump())
    db.add(g)
    db.commit()
    db.refresh(g)
    return _serialize(g)

@router.get("/{goal_id}")
def get_goal(goal_id: int, db: Session = Depends(get_db)):
    g = db.query(Goal).filter(Goal.id == goal_id).first()
    if not g: raise HTTPException(404, "Ziel nicht gefunden")
    return _serialize(g)

@router.put("/{goal_id}")
def update_goal(goal_id: int, body: GoalUpdate, db: Session = Depends(get_db)):
    g = db.query(Goal).filter(Goal.id == goal_id).first()
    if not g: raise HTTPException(404, "Ziel nicht gefunden")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(g, field, val)
    db.commit()
    db.refresh(g)
    return _serialize(g)

@router.delete("/{goal_id}")
def delete_goal(goal_id: int, db: Session = Depends(get_db)):
    g = db.query(Goal).filter(Goal.id == goal_id).first()
    if not g: raise HTTPException(404, "Ziel nicht gefunden")
    db.delete(g)
    db.commit()
    return {"ok": True}

@router.post("/{goal_id}/evaluate")
def evaluate_goal(goal_id: int, db: Session = Depends(get_db)):
    g = db.query(Goal).filter(Goal.id == goal_id).first()
    if not g: raise HTTPException(404, "Ziel nicht gefunden")
    
    agent_id = g.agent_id
    if not agent_id:
        def_ag = agent_service.find_available_agent(db, g.tenant_id)
        if def_ag: agent_id = def_ag.id
        else: raise HTTPException(400, "Kein aktiver Agent verfügbar.")

    instruction = f"""Dies ist ein strategischer Evaluierungs-Lauf für das Ziel '{g.name}'.
DEINE STRATEGIE:
{g.strategy_prompt}

DEINE AKTUELLEN MEILENSTEINE:
{g.milestones_json}

AUFGABE:
1. Prüfe den aktuellen Status im System (nutze execsql für Feed- oder Datenabfragen).
2. Nutze das Tool 'update_goal_milestones' mit goal_id={g.id}, falls Meilensteine erreicht wurden oder neue hinzukommen.
3. Nutze 'delegate_task', um Aufgaben an Fach-Agenten zu verteilen.
4. Schließe mit 'submit_final_result' ab und berichte dem Administrator über deine getroffenen Entscheidungen.
"""

    action_data = {
        "instruction": instruction,
        "original_instruction": instruction,
        "is_goal_eval": True,
        "goal_id": g.id
    }

    item = feed_service.create_feed_item(
        db, tenant_id=g.tenant_id, category="general",
        title=f"Strategische Überprüfung: {g.name}",
        description="⏳ Der CEO-Agent evaluiert den Zielfortschritt...",
        priority=8, action_type="agent_task",
        action_data=action_data, agent_id=agent_id
    )
    item.status = "processing"
    db.commit()
    db.refresh(item)

    asyncio.ensure_future(agent_service.run_task_background(item.id, g.tenant_id, instruction, agent_id, None))
    
    return {"ok": True, "feed_item_id": item.id}

def _serialize(g: Goal) -> dict:
    return {
        "id": g.id,
        "tenant_id": g.tenant_id,
        "name": g.name,
        "description": g.description,
        "strategy_prompt": g.strategy_prompt,
        "status": g.status,
        "agent_id": g.agent_id,
        "milestones_json": g.milestones_json,
        "created_at": g.created_at.isoformat() if g.created_at else None,
        "updated_at": g.updated_at.isoformat() if g.updated_at else None,
    }





