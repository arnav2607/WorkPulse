"""Notification creation helper."""
from datetime import datetime, timezone
import uuid
from typing import Optional
from database import db


async def create_notification(
    user_id: str,
    type_: str,
    message: str,
    reference_id: Optional[str] = None,
    reference_type: Optional[str] = None,
):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": type_,
        "message": message,
        "is_read": False,
        "reference_id": reference_id,
        "reference_type": reference_type,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.notifications.insert_one(doc)
    return doc
