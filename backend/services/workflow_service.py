from sqlalchemy.orm import Session
from backend.database.models import Workflow, WorkflowAgent


def get_workflows_for_tenant(db: Session, tenant_id: int, active_only: bool = True):
    q = db.query(Workflow).filter(Workflow.tenant_id == tenant_id)
    if active_only:
        q = q.filter(Workflow.is_active == True)
    return q.order_by(Workflow.is_standard.desc(), Workflow.name).all()


def get_workflow_agents(db: Session, workflow_id: int):
    return (
        db.query(WorkflowAgent)
        .filter(WorkflowAgent.workflow_id == workflow_id)
        .all()
    )


def assign_agent_to_workflow(db: Session, workflow_id: int, agent_id: int, role: str = "executor"):
    existing = (
        db.query(WorkflowAgent)
        .filter(WorkflowAgent.workflow_id == workflow_id, WorkflowAgent.agent_id == agent_id)
        .first()
    )
    if existing:
        existing.role = role
        db.commit()
        return existing
    link = WorkflowAgent(workflow_id=workflow_id, agent_id=agent_id, role=role)
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


def remove_agent_from_workflow(db: Session, workflow_id: int, agent_id: int):
    link = (
        db.query(WorkflowAgent)
        .filter(WorkflowAgent.workflow_id == workflow_id, WorkflowAgent.agent_id == agent_id)
        .first()
    )
    if link:
        db.delete(link)
        db.commit()
        return True
    return False











