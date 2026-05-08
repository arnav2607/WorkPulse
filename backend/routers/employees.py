from datetime import datetime, timezone, date as ddate
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import require_admin, hash_password
from database import db
from models import EmployeeCreate, EmployeeUpdate, AssignActivities, new_id

router = APIRouter(prefix="/employees", tags=["employees"])


def _strip(doc: dict) -> dict:
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


def _count_days(from_date: str, to_date: str) -> int:
    d1 = ddate.fromisoformat(from_date)
    d2 = ddate.fromisoformat(to_date)
    return (d2 - d1).days + 1


@router.get("")
async def list_employees(
    department: Optional[str] = None,
    is_active: Optional[bool] = None,
    role: Optional[str] = None,
    include_balance: bool = False,
    _admin=Depends(require_admin),
):
    q = {}
    if department:
        q["department"] = department
    if is_active is not None:
        q["is_active"] = is_active
    if role:
        q["role"] = role
    cursor = db.users.find(q, {"_id": 0, "password_hash": 0}).sort("created_at", -1)
    employees = await cursor.to_list(1000)

    if include_balance:
        year = datetime.now(timezone.utc).year
        # Fetch balances + leave totals for all listed employees
        ids = [u["id"] for u in employees]
        balances = await db.leave_balances.find(
            {"employee_id": {"$in": ids}, "year": year}, {"_id": 0}
        ).to_list(2000)
        bal_map = {b["employee_id"]: b for b in balances}
        # Sum approved leaves YTD by employee
        year_start = f"{year}-01-01"
        year_end = f"{year}-12-31"
        approved = await db.leave_requests.find(
            {
                "employee_id": {"$in": ids},
                "status": "approved",
                "from_date": {"$lte": year_end},
                "to_date": {"$gte": year_start},
            },
            {"_id": 0},
        ).to_list(5000)
        total_map: dict = {}
        for lv in approved:
            d1 = max(lv["from_date"], year_start)
            d2 = min(lv["to_date"], year_end)
            days = _count_days(d1, d2)
            total_map.setdefault(lv["employee_id"], 0)
            total_map[lv["employee_id"]] += days
        for u in employees:
            b = bal_map.get(u["id"], {
                "casual_total": 12, "sick_total": 6, "casual_used": 0, "sick_used": 0,
            })
            u["balance"] = {
                "casual_total": b.get("casual_total", 12),
                "sick_total": b.get("sick_total", 6),
                "casual_used": b.get("casual_used", 0),
                "sick_used": b.get("sick_used", 0),
                "total_taken_ytd": total_map.get(u["id"], 0),
            }

    return {"success": True, "data": employees}


@router.post("")
async def create_employee(body: EmployeeCreate, _admin=Depends(require_admin)):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    user_id = new_id()
    doc = {
        "id": user_id,
        "name": body.name,
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "role": body.role,
        "department": body.department,
        "is_active": True,
        "must_change_password": True,
        "assigned_template_ids": None,  # null = all global active templates
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)

    # Default leave balance for current year
    year = datetime.now(timezone.utc).year
    await db.leave_balances.update_one(
        {"employee_id": user_id, "year": year},
        {"$setOnInsert": {
            "id": new_id(),
            "employee_id": user_id,
            "year": year,
            "casual_total": 12,
            "sick_total": 6,
            "casual_used": 0,
            "sick_used": 0,
        }},
        upsert=True,
    )
    out = _strip(dict(doc))
    # Reveal initial password ONCE so admin can share it with the new employee
    out["initial_password"] = body.password
    return {"success": True, "data": out}


@router.patch("/{employee_id}")
async def update_employee(employee_id: str, body: EmployeeUpdate, _admin=Depends(require_admin)):
    update = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "password" in update:
        update["password_hash"] = hash_password(update.pop("password"))
        # If admin resets a password, force the user to change it on next login.
        update["must_change_password"] = True
    if "email" in update:
        update["email"] = update["email"].lower()
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    res = await db.users.update_one({"id": employee_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    user = await db.users.find_one({"id": employee_id}, {"_id": 0, "password_hash": 0})
    return {"success": True, "data": user}


@router.delete("/{employee_id}")
async def deactivate_employee(employee_id: str, _admin=Depends(require_admin)):
    res = await db.users.update_one({"id": employee_id}, {"$set": {"is_active": False}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"success": True}


@router.patch("/{employee_id}/balance")
async def set_balance(
    employee_id: str,
    casual_total: int = Query(...),
    sick_total: int = Query(...),
    _admin=Depends(require_admin),
):
    year = datetime.now(timezone.utc).year
    await db.leave_balances.update_one(
        {"employee_id": employee_id, "year": year},
        {"$set": {"casual_total": casual_total, "sick_total": sick_total},
         "$setOnInsert": {"id": new_id(), "casual_used": 0, "sick_used": 0}},
        upsert=True,
    )
    bal = await db.leave_balances.find_one({"employee_id": employee_id, "year": year}, {"_id": 0})
    return {"success": True, "data": bal}


# ---------- Per-employee activity assignment ----------
@router.get("/{employee_id}/activities")
async def get_assigned_activities(employee_id: str, _admin=Depends(require_admin)):
    user = await db.users.find_one({"id": employee_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")
    all_templates = await db.activity_templates.find(
        {"is_active": True}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    assigned_ids: Optional[List[str]] = user.get("assigned_template_ids")
    if assigned_ids is None:
        # null means all
        effective_ids = [t["id"] for t in all_templates]
        is_all = True
    else:
        effective_ids = list(assigned_ids)
        is_all = False
    return {
        "success": True,
        "data": {
            "all_templates": all_templates,
            "assigned_ids": effective_ids,
            "is_all": is_all,
        },
    }


@router.put("/{employee_id}/activities")
async def set_assigned_activities(
    employee_id: str,
    body: AssignActivities,
    _admin=Depends(require_admin),
):
    user = await db.users.find_one({"id": employee_id})
    if not user:
        raise HTTPException(status_code=404, detail="Employee not found")
    # Persist exactly what was sent: None = all
    await db.users.update_one(
        {"id": employee_id},
        {"$set": {"assigned_template_ids": body.template_ids}},
    )
    return {"success": True}
