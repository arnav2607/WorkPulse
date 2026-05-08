from datetime import datetime, timezone, date as ddate, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query

from auth import require_admin
from database import db

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("")
async def report(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    employee_id: Optional[str] = None,
    _admin=Depends(require_admin),
):
    today = ddate.today()
    if not from_date:
        from_date = (today - timedelta(days=29)).isoformat()
    if not to_date:
        to_date = today.isoformat()

    user_q = {"role": "employee", "is_active": True}
    if employee_id:
        user_q["id"] = employee_id
    employees = await db.users.find(user_q, {"_id": 0, "password_hash": 0}).to_list(500)

    rows = []
    d_from = ddate.fromisoformat(from_date)
    d_to = ddate.fromisoformat(to_date)
    total_days = (d_to - d_from).days + 1

    for emp in employees:
        # Tasks
        assigned = await db.tasks.count_documents({
            "assigned_to": emp["id"],
            "created_at": {"$gte": from_date, "$lte": to_date + "T23:59:59"},
        })
        completed = await db.tasks.count_documents({
            "assigned_to": emp["id"],
            "status": {"$in": ["done", "approved", "closed"]},
            "updated_at": {"$gte": from_date, "$lte": to_date + "T23:59:59"},
        })
        delayed = await db.tasks.count_documents({
            "assigned_to": emp["id"],
            "deadline": {"$lt": today.isoformat(), "$ne": None},
            "status": {"$nin": ["closed", "approved", "done"]},
        })
        # Sheet compliance
        submitted = await db.activity_sheets.count_documents({
            "employee_id": emp["id"],
            "date": {"$gte": from_date, "$lte": to_date},
            "status": "submitted",
        })
        on_leave_count = await db.activity_sheets.count_documents({
            "employee_id": emp["id"],
            "date": {"$gte": from_date, "$lte": to_date},
            "status": "on_leave",
        })
        expected = max(total_days - on_leave_count, 1)
        compliance = round((submitted / expected) * 100, 1)
        # Leaves
        leaves = await db.leave_requests.find({
            "employee_id": emp["id"],
            "status": "approved",
            "from_date": {"$lte": to_date},
            "to_date": {"$gte": from_date},
        }, {"_id": 0}).to_list(100)
        leave_summary = {"casual": 0, "sick": 0, "half_day": 0, "wfh": 0}
        for lv in leaves:
            d1 = ddate.fromisoformat(max(lv["from_date"], from_date))
            d2 = ddate.fromisoformat(min(lv["to_date"], to_date))
            days = (d2 - d1).days + 1
            leave_summary[lv["leave_type"]] = leave_summary.get(lv["leave_type"], 0) + days

        completion_rate = (completed / assigned * 100) if assigned else 0
        productivity = round((completion_rate * compliance) / 100, 1)

        rows.append({
            "employee_id": emp["id"],
            "employee_name": emp["name"],
            "department": emp.get("department", ""),
            "tasks_assigned": assigned,
            "tasks_completed": completed,
            "tasks_delayed": delayed,
            "sheet_compliance": compliance,
            "leaves": leave_summary,
            "productivity_score": productivity,
        })

    return {"success": True, "data": {"from": from_date, "to": to_date, "rows": rows}}
