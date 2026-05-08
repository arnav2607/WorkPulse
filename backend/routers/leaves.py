import os
from datetime import datetime, timezone, date as ddate, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user, require_admin, require_employee
from database import db
from email_service import (
    fire_and_forget,
    notify_admin_leave_applied,
    notify_employee_leave_decided,
)
from models import LeaveCreate, LeaveDecision, new_id
from notifications_helper import create_notification

router = APIRouter(prefix="/leaves", tags=["leaves"])
ADMIN_EMAIL = os.environ.get("ADMIN_NOTIFICATION_EMAIL", "")


def _count_days(from_date: str, to_date: str) -> int:
    d1 = ddate.fromisoformat(from_date)
    d2 = ddate.fromisoformat(to_date)
    return (d2 - d1).days + 1


@router.post("")
async def apply_leave(body: LeaveCreate, emp=Depends(require_employee)):
    if body.from_date > body.to_date:
        raise HTTPException(status_code=400, detail="Invalid date range")
    leave = {
        "id": new_id(),
        "employee_id": emp["id"],
        "employee_name": emp["name"],
        "leave_type": body.leave_type,
        "from_date": body.from_date,
        "to_date": body.to_date,
        "reason": body.reason,
        "status": "pending",
        "admin_comment": "",
        "reviewed_by": None,
        "reviewed_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.leave_requests.insert_one(leave)
    # Notify admins
    admins = await db.users.find({"role": "admin", "is_active": True}, {"_id": 0, "id": 1}).to_list(50)
    for a in admins:
        await create_notification(
            a["id"], "leave_applied",
            f"{emp['name']} applied for {body.leave_type} leave ({body.from_date} → {body.to_date})",
            reference_id=leave["id"], reference_type="leave",
        )
    # Email admin (non-blocking)
    if ADMIN_EMAIL:
        fire_and_forget(notify_admin_leave_applied(
            ADMIN_EMAIL, emp.get("name", "Employee"), {**leave, "_id": None},
        ))
    leave.pop("_id", None)
    return {"success": True, "data": leave}


@router.get("")
async def list_leaves(
    status: Optional[str] = None,
    employee_id: Optional[str] = None,
    user=Depends(get_current_user),
):
    q = {}
    if user["role"] == "employee":
        q["employee_id"] = user["id"]
    elif employee_id:
        q["employee_id"] = employee_id
    if status:
        q["status"] = status
    leaves = await db.leave_requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return {"success": True, "data": leaves}


async def _apply_on_leave_to_sheets(employee_id: str, from_date: str, to_date: str):
    """Mark sheets between dates as on_leave, creating placeholders if absent."""
    d1 = ddate.fromisoformat(from_date)
    d2 = ddate.fromisoformat(to_date)
    cur = d1
    while cur <= d2:
        date_str = cur.isoformat()
        existing = await db.activity_sheets.find_one({"employee_id": employee_id, "date": date_str})
        if existing:
            if existing.get("status") not in ("submitted",):
                await db.activity_sheets.update_one(
                    {"id": existing["id"]}, {"$set": {"status": "on_leave"}}
                )
        else:
            await db.activity_sheets.insert_one({
                "id": new_id(),
                "employee_id": employee_id,
                "date": date_str,
                "status": "on_leave",
                "submitted_at": None,
                "entries": [],
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        cur = cur + timedelta(days=1)


@router.patch("/{leave_id}/approve")
async def approve_leave(leave_id: str, body: LeaveDecision, admin=Depends(require_admin)):
    leave = await db.leave_requests.find_one({"id": leave_id}, {"_id": 0})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    if leave["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Leave already {leave['status']}")
    await db.leave_requests.update_one(
        {"id": leave_id},
        {"$set": {
            "status": "approved",
            "admin_comment": body.admin_comment or "",
            "reviewed_by": admin["id"],
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    # Update leave balance
    days = _count_days(leave["from_date"], leave["to_date"])
    if leave["leave_type"] in ("casual", "sick"):
        year = datetime.now(timezone.utc).year
        field = "casual_used" if leave["leave_type"] == "casual" else "sick_used"
        await db.leave_balances.update_one(
            {"employee_id": leave["employee_id"], "year": year},
            {"$inc": {field: days}, "$setOnInsert": {
                "id": new_id(), "casual_total": 12, "sick_total": 6,
            }},
            upsert=True,
        )
    # Update sheets
    await _apply_on_leave_to_sheets(leave["employee_id"], leave["from_date"], leave["to_date"])
    await create_notification(
        leave["employee_id"], "leave_approved",
        f"Your leave ({leave['from_date']} → {leave['to_date']}) was approved",
        reference_id=leave_id, reference_type="leave",
    )
    # Email the employee
    employee = await db.users.find_one({"id": leave["employee_id"]}, {"_id": 0, "email": 1, "name": 1})
    if employee:
        fire_and_forget(notify_employee_leave_decided(
            employee.get("email", ""), employee.get("name", ""),
            {**leave, "_id": None}, "approved", body.admin_comment or "",
        ))
    return {"success": True}


@router.patch("/{leave_id}/reject")
async def reject_leave(leave_id: str, body: LeaveDecision, admin=Depends(require_admin)):
    leave = await db.leave_requests.find_one({"id": leave_id}, {"_id": 0})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    if leave["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Leave already {leave['status']}")
    await db.leave_requests.update_one(
        {"id": leave_id},
        {"$set": {
            "status": "rejected",
            "admin_comment": body.admin_comment or "",
            "reviewed_by": admin["id"],
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    await create_notification(
        leave["employee_id"], "leave_rejected",
        f"Your leave ({leave['from_date']} → {leave['to_date']}) was rejected",
        reference_id=leave_id, reference_type="leave",
    )
    # Email the employee
    employee = await db.users.find_one({"id": leave["employee_id"]}, {"_id": 0, "email": 1, "name": 1})
    if employee:
        fire_and_forget(notify_employee_leave_decided(
            employee.get("email", ""), employee.get("name", ""),
            {**leave, "_id": None}, "rejected", body.admin_comment or "",
        ))
    return {"success": True}


@router.delete("/{leave_id}")
async def cancel_leave(leave_id: str, emp=Depends(require_employee)):
    leave = await db.leave_requests.find_one({"id": leave_id}, {"_id": 0})
    if not leave or leave["employee_id"] != emp["id"]:
        raise HTTPException(status_code=404, detail="Leave not found")
    if leave["status"] != "pending":
        raise HTTPException(status_code=400, detail="Only pending leaves can be cancelled")
    await db.leave_requests.update_one({"id": leave_id}, {"$set": {"status": "cancelled"}})
    return {"success": True}


@router.get("/balance/{employee_id}")
async def get_balance(employee_id: str, user=Depends(get_current_user)):
    if user["role"] == "employee" and user["id"] != employee_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    year = datetime.now(timezone.utc).year
    bal = await db.leave_balances.find_one({"employee_id": employee_id, "year": year}, {"_id": 0})
    if not bal:
        bal = {
            "id": new_id(), "employee_id": employee_id, "year": year,
            "casual_total": 12, "sick_total": 6, "casual_used": 0, "sick_used": 0,
        }
        await db.leave_balances.insert_one(dict(bal))
        bal.pop("_id", None)

    # Compute total leaves taken this year across ALL types (approved only)
    year_start = f"{year}-01-01"
    year_end = f"{year}-12-31"
    approved = await db.leave_requests.find({
        "employee_id": employee_id,
        "status": "approved",
        "from_date": {"$lte": year_end},
        "to_date": {"$gte": year_start},
    }, {"_id": 0}).to_list(2000)

    by_type = {"casual": 0, "sick": 0, "half_day": 0, "wfh": 0}
    total_taken = 0
    for lv in approved:
        d1 = ddate.fromisoformat(max(lv["from_date"], year_start))
        d2 = ddate.fromisoformat(min(lv["to_date"], year_end))
        days = (d2 - d1).days + 1
        by_type[lv["leave_type"]] = by_type.get(lv["leave_type"], 0) + days
        total_taken += days

    bal["by_type"] = by_type
    bal["total_taken_ytd"] = total_taken
    return {"success": True, "data": bal}
