from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from backend.database.engine import get_db
from backend.services import wizard_service

router = APIRouter()

class WizardPrompt(BaseModel):
    tenant_id: int
    instruction: str

class WizardExecute(BaseModel):
    tenant_id: int
    plan: dict

@router.post("/plan")
async def create_plan(body: WizardPrompt, db: Session = Depends(get_db)):
    try:
        plan = await wizard_service.generate_proposal(db, body.tenant_id, body.instruction)
        return plan
    except Exception as e:
        raise HTTPException(500, f"Fehler bei der Plan-Erstellung: {str(e)}")

@router.post("/execute")
async def execute_wizard_plan(body: WizardExecute, db: Session = Depends(get_db)):
    try:
        result = await wizard_service.execute_plan(db, body.tenant_id, body.plan)
        return result
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Fehler bei der Umsetzung: {str(e)}")



