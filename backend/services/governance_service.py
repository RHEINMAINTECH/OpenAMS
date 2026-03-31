from sqlalchemy.orm import Session
from backend.services import audit_service, memory_service

GOVERNANCE_RULES = {
    "agent_can_read": True,
    "agent_can_write_internal": True,
    "agent_can_write_external": False,
    "require_admin_approval": True,
}


def check_permission(action: str) -> bool:
    if action == "read_external":
        return GOVERNANCE_RULES["agent_can_read"]
    if action == "write_internal":
        return GOVERNANCE_RULES["agent_can_write_internal"]
    if action == "write_external":
        return False
    return False


def requires_approval(action_type: str) -> bool:
    auto_actions = {"read", "analyze", "summarize", "categorize", "memory.write"}
    if action_type in auto_actions:
        return False
    return GOVERNANCE_RULES["require_admin_approval"]


def execute_approved_action(db: Session, feed_item) -> dict | None:
    action_data = feed_item.action_data_json or {}
    execute_config = action_data.get("execute_on_approve")

    if not execute_config:
        audit_service.log_action(
            db,
            tenant_id=feed_item.tenant_id,
            action="governance.approved_no_execution",
            entity_type="feed_item",
            entity_id=feed_item.id,
            details={"info": "Genehmigt ohne ausführbare Aktion."},
        )
        return None

    configs = execute_config if isinstance(execute_config, list) else [execute_config]
    results = []

    for config in configs:
        action_type = config.get("type", "")
        description = config.get("description", action_type)

        audit_service.log_action(
            db,
            tenant_id=feed_item.tenant_id,
            action="governance.execution_started",
            entity_type="feed_item",
            entity_id=feed_item.id,
            details={
                "action_type": action_type,
                "description": description,
                "config": config,
            },
        )

        res = {"status": "error", "message": "Unbekannter Aktionstyp"}

        if action_type == "mcp_write":
            from backend.services import mcp_service
            slug = config.get("mcp_slug", "")
            method = config.get("method", "")
            params = config.get("params", {})

            if not slug or not method:
                res = {"status": "error", "message": "MCP-Slug oder Methode fehlt"}
            else:
                res = mcp_service.execute_write(slug, db, method, params)

        elif action_type == "a2a_write":
            from backend.services import a2a_service
            slug = config.get("a2a_slug", "")
            method = config.get("method", "")
            params = config.get("params", {})

            if not slug or not method:
                res = {"status": "error", "message": "A2A-Slug oder Methode fehlt"}
            else:
                res = a2a_service.execute_write(slug, db, method, params)

        elif action_type == "notify_agent":
            notification = config.get("notification", "Aktion wurde ausgeführt.")
            memory_service.create_event_memory(
                db,
                tenant_id=feed_item.tenant_id,
                event_type="admin.action_completed",
                summary=notification,
                agent_id=feed_item.agent_id,
                context={"feed_item_id": feed_item.id},
            )
            res = {"status": "ok", "message": notification}

        elif action_type == "log_only":
            res = {"status": "ok", "message": description}

        else:
            res = {"status": "skipped", "message": f"Aktionstyp '{action_type}' nicht implementiert."}

        audit_service.log_action(
            db,
            tenant_id=feed_item.tenant_id,
            action="governance.execution_completed",
            entity_type="feed_item",
            entity_id=feed_item.id,
            details={
                "action_type": action_type,
                "description": description,
                "result": res,
            },
        )
        
        results.append(res)

    final_result = {"status": "ok", "results": results} if len(results) > 1 else results[0]

    memory_service.create_event_memory(
        db,
        tenant_id=feed_item.tenant_id,
        event_type="action.executed",
        summary=f"Genehmigte Aktion(en) ausgeführt.",
        agent_id=feed_item.agent_id,
        context={"feed_item_id": feed_item.id, "result": final_result},
    )

    return final_result











