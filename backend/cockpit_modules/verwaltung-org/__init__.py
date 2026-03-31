from sqlalchemy.orm import Session

def api_get_stats(params: dict, db: Session) -> dict:
    tenant_id = params.get("tenant_id")
    if not tenant_id:
        return {"status": "error", "message": "tenant_id missing"}
        
    from backend.database.models import FeedItem, Task, FileAsset
    
    feed_count = db.query(FeedItem).filter(FeedItem.tenant_id == tenant_id).count()
    pending_feed = db.query(FeedItem).filter(FeedItem.tenant_id == tenant_id, FeedItem.status == 'pending').count()
    active_tasks = db.query(Task).filter(Task.tenant_id == tenant_id, Task.status == 'open').count()
    total_docs = db.query(FileAsset).filter(FileAsset.tenant_id == tenant_id).count()
    
    return {
        "status": "ok",
        "data": {
            "total_feed": feed_count,
            "pending_feed": pending_feed,
            "active_tasks": active_tasks,
            "total_docs": total_docs
        }
    }





