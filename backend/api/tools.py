from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.database.engine import get_db
from backend.services.tool_service import get_system_tools, execute_tool
import json

router = APIRouter()

class ToolExecute(BaseModel):
    tenant_id: int
    workflow_id: Optional[int] = None
    tool_name: str
    arguments: dict

@router.get("")
def list_system_tools():
    return get_system_tools()

@router.post("/execute")
def execute_tool_endpoint(body: ToolExecute, db: Session = Depends(get_db)):
    ctx = {"workflow_id": body.workflow_id}
    res = execute_tool(db, body.tenant_id, ctx, body.tool_name, body.arguments)
    try:
        return json.loads(res)
    except:
        return {"result": res}











