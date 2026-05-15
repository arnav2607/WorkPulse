from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user, require_admin
from database import db
from models import ActivityTemplateCreate, ActivityTemplateUpdate, new_id

router = APIRouter(prefix="/activities", tags=["activities"])


@router.get("/template")
async def list_template(_user=Depends(get_current_user)):
    items = await db.activity_templates.find({"is_active": True}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return {"success": True, "data": items}


@router.get("/template/all")
async def list_template_all(_admin=Depends(require_admin)):
    items = await db.activity_templates.find({}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return {"success": True, "data": items}


@router.post("/template")
async def create_template(body: ActivityTemplateCreate, admin=Depends(require_admin)):
    item = {
        "id": new_id(),
        "name": body.name,
        "description": body.description or "",
        "is_required": body.is_required,
        "frequency": body.frequency,
        "frequency_value": body.frequency_value,
        "is_active": True,
        "created_by": admin["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.activity_templates.insert_one(item)
    item.pop("_id", None)
    return {"success": True, "data": item}



@router.patch("/template/{item_id}")
async def update_template(item_id: str, body: ActivityTemplateUpdate, _admin=Depends(require_admin)):
    update = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    res = await db.activity_templates.update_one({"id": item_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    item = await db.activity_templates.find_one({"id": item_id}, {"_id": 0})
    return {"success": True, "data": item}


@router.delete("/template/{item_id}")
async def delete_template(item_id: str, _admin=Depends(require_admin)):
    res = await db.activity_templates.update_one({"id": item_id}, {"$set": {"is_active": False}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"success": True}
