from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from database import db

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(user=Depends(get_current_user)):
    items = await db.notifications.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort([("is_read", 1), ("created_at", -1)]).to_list(200)
    unread_count = sum(1 for i in items if not i.get("is_read"))
    return {"success": True, "data": {"items": items, "unread_count": unread_count}}


@router.patch("/{notif_id}/read")
async def mark_read(notif_id: str, user=Depends(get_current_user)):
    res = await db.notifications.update_one(
        {"id": notif_id, "user_id": user["id"]}, {"$set": {"is_read": True}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"success": True}


@router.patch("/read-all")
async def mark_all_read(user=Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": user["id"], "is_read": False}, {"$set": {"is_read": True}}
    )
    return {"success": True}
