import datetime
from sqlalchemy.orm import Session
from backend.database.models import FeedItem, Message
from backend.services import audit_service


def create_feed_item(
    db: Session,
    tenant_id: int,
    category: str,
    title: str,
    description: str = "",
    priority: int = 0,
    action_type: str = "info",
    action_data: dict = None,
    workflow_id: int = None,
    agent_id: int = None,
    parent_id: int = None,
) -> FeedItem:
    item = FeedItem(
        tenant_id=tenant_id,
        workflow_id=workflow_id,
        agent_id=agent_id,
        category=category,
        title=title,
        description=description,
        priority=priority,
        status="pending",
        action_type=action_type,
        action_data_json=action_data or {},
        parent_id=parent_id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    audit_service.log_action(
        db,
        tenant_id=tenant_id,
        action="feed.created",
        entity_type="feed_item",
        entity_id=item.id,
        agent_id=agent_id,
        details={"title": title, "category": category, "priority": priority, "parent_id": parent_id},
    )

    if priority >= 7:
        msg = Message(
            tenant_id=tenant_id,
            title=title,
            body=description,
            priority=priority,
            feed_item_id=item.id,
        )
        db.add(msg)
        db.commit()

    return item


def resolve_feed_item(
    db: Session,
    item_id: int,
    status: str = "approved",
    result: dict = None,
    feedback_text: str = "",
):
    item = db.query(FeedItem).filter(FeedItem.id == item_id).first()
    if not item:
        return None
    
    # Falls wir antworten/weitermachen, ist es noch nicht final resolved
    if status == "replied":
        # Wir setzen status hier NICHT auf replied permanent, 
        # weil agent_service das gleich auf 'processing' setzt.
        # Aber falls der Aufrufer explizit 'replied' sendet, lassen wir es kurz so.
        # Wichtig: resolved_at sollte NULL bleiben/werden, da der Prozess weitergeht.
        item.status = status
        item.resolved_at = None
    else:
        item.status = status
        item.resolved_at = datetime.datetime.utcnow()

    item.result_json = result or {}
    # Feedback Text anhängen oder überschreiben?
    # Überschreiben ist okay, da agent_service es in die Historie (Steps) übernimmt.
    item.feedback_text = feedback_text or ""
    
    db.commit()
    db.refresh(item)

    audit_service.log_action(
        db,
        tenant_id=item.tenant_id,
        action=f"feed.{status}",
        entity_type="feed_item",
        entity_id=item.id,
        details={"result": result, "feedback_text": feedback_text},
    )

    # Verknüpfte Nachrichten automatisch als gelesen markieren, wenn der Task bearbeitet wurde
    db.query(Message).filter(Message.feed_item_id == item_id, Message.is_read == False).update({"is_read": True})
    db.commit()

    return item











