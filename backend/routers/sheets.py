from datetime import datetime, timezone, date as ddate
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user, require_admin, require_employee
from database import db
from models import SheetSubmit, SheetDraftSave, new_id

router = APIRouter(prefix="/sheets", tags=["sheets"])


def today_iso() -> str:
    return datetime.now(timezone.utc).date().isoformat()


async def _get_or_create_today_sheet(employee_id: str):
    today = today_iso()
    sheet = await db.activity_sheets.find_one({"employee_id": employee_id, "date": today}, {"_id": 0})
    if sheet:
        return sheet
    # Check if employee has approved leave today
    leave = await db.leave_requests.find_one({
        "employee_id": employee_id,
        "status": "approved",
        "from_date": {"$lte": today},
        "to_date": {"$gte": today},
    })
    status = "on_leave" if leave else "draft"
    sheet = {
        "id": new_id(),
        "employee_id": employee_id,
        "date": today,
        "status": status,
        "submitted_at": None,
        "entries": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.activity_sheets.insert_one(sheet)
    sheet.pop("_id", None)
    return sheet


@router.get("/today")
async def get_today_sheet(emp=Depends(require_employee)):
    sheet = await _get_or_create_today_sheet(emp["id"])
    template = await db.activity_templates.find({"is_active": True}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return {"success": True, "data": {"sheet": sheet, "template": template}}


@router.post("/draft")
async def save_draft(body: SheetDraftSave, emp=Depends(require_employee)):
    sheet = await _get_or_create_today_sheet(emp["id"])
    if sheet["status"] in ("submitted", "missed", "on_leave"):
        raise HTTPException(status_code=400, detail=f"Sheet is {sheet['status']}, cannot edit")
    entries = [e.model_dump() for e in body.entries]
    await db.activity_sheets.update_one(
        {"id": sheet["id"]},
        {"$set": {"entries": entries, "status": "draft"}},
    )
    return {"success": True}


@router.post("/submit")
async def submit_sheet(body: SheetSubmit, emp=Depends(require_employee)):
    sheet = await _get_or_create_today_sheet(emp["id"])
    if sheet["status"] == "submitted":
        raise HTTPException(status_code=400, detail="Sheet already submitted")
    if sheet["status"] == "on_leave":
        return {"success": True, "data": {"status": "on_leave"}}
    template = await db.activity_templates.find({"is_active": True}, {"_id": 0}).to_list(500)
    required_ids = {t["id"] for t in template if t.get("is_required", True)}
    submitted_ids = {e.template_id for e in body.entries}
    missing = required_ids - submitted_ids
    if missing:
        raise HTTPException(status_code=400, detail="All required activities must be filled")
    entries = [e.model_dump() for e in body.entries]
    await db.activity_sheets.update_one(
        {"id": sheet["id"]},
        {"$set": {
            "entries": entries,
            "status": "submitted",
            "submitted_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"success": True}


@router.get("")
async def list_sheets(
    employee_id: Optional[str] = None,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    status: Optional[str] = None,
    _admin=Depends(require_admin),
):
    q = {}
    if employee_id:
        q["employee_id"] = employee_id
    if status:
        q["status"] = status
    if from_date or to_date:
        date_q = {}
        if from_date:
            date_q["$gte"] = from_date
        if to_date:
            date_q["$lte"] = to_date
        q["date"] = date_q
    sheets = await db.activity_sheets.find(q, {"_id": 0}).sort("date", -1).to_list(5000)
    # Attach employee names
    user_ids = list({s["employee_id"] for s in sheets})
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(1000)
    name_map = {u["id"]: u["name"] for u in users}
    for s in sheets:
        s["employee_name"] = name_map.get(s["employee_id"], "Unknown")
    return {"success": True, "data": sheets}


@router.get("/{employee_id}/{date}")
async def get_specific_sheet(employee_id: str, date: str, _admin=Depends(require_admin)):
    sheet = await db.activity_sheets.find_one({"employee_id": employee_id, "date": date}, {"_id": 0})
    template = await db.activity_templates.find({}, {"_id": 0}).to_list(500)
    return {"success": True, "data": {"sheet": sheet, "template": template}}
