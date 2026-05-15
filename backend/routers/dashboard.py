from datetime import datetime, timezone, date as ddate, timedelta
from collections import defaultdict

from fastapi import APIRouter, Depends

from auth import get_current_user, require_admin, require_employee
from database import db

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/admin")
async def admin_dashboard(_admin=Depends(require_admin)):
    today = ddate.today().isoformat()
    today_dt = ddate.today()
    # Metrics
    total_employees = await db.users.count_documents({"role": "employee", "is_active": True})
    pending_tasks = await db.tasks.count_documents({"status": {"$in": ["pending", "in_progress"]}})
    overdue_tasks = await db.tasks.count_documents({
        "deadline": {"$lt": today, "$ne": None},
        "status": {"$nin": ["closed", "approved", "done"]},
    })
    sheets_today = await db.activity_sheets.count_documents({"date": today, "status": "submitted"})
    on_leave_today = await db.leave_requests.count_documents({
        "status": "approved",
        "from_date": {"$lte": today},
        "to_date": {"$gte": today},
    })

    # Bar chart: weekly task completion per employee (last 7 days, count of done/approved/closed)
    week_ago = (today_dt - timedelta(days=6)).isoformat()
    employees = await db.users.find(
        {"role": "employee", "is_active": True}, {"_id": 0, "id": 1, "name": 1}
    ).to_list(500)
    weekly_completion = []
    for emp in employees:
        cnt = await db.tasks.count_documents({
            "assigned_to": emp["id"],
            "status": {"$in": ["done", "approved", "closed"]},
            "updated_at": {"$gte": week_ago},
        })
        weekly_completion.append({"name": emp["name"].split(" ")[0][:12], "completed": cnt})

    # Line chart: daily sheet submission rate % (last 30 days)
    submission_trend = []
    for i in range(29, -1, -1):
        d = (today_dt - timedelta(days=i)).isoformat()
        submitted = await db.activity_sheets.count_documents({"date": d, "status": "submitted"})
        rate = round((submitted / total_employees) * 100, 1) if total_employees else 0
        submission_trend.append({"date": d[5:], "rate": rate})

    # Pie chart: task status distribution
    pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    cursor = db.tasks.aggregate(pipeline)
    status_dist = []
    async for row in cursor:
        status_dist.append({"name": row["_id"], "value": row["count"]})

    # Recent activity: last 10 task remarks + status updates
    recent_remarks = await db.task_remarks.find({}, {"_id": 0}).sort("created_at", -1).to_list(10)
    return {
        "success": True,
        "data": {
            "metrics": {
                "total_employees": total_employees,
                "pending_tasks": pending_tasks,
                "overdue_tasks": overdue_tasks,
                "sheets_today": sheets_today,
                "on_leave_today": on_leave_today,
            },
            "weekly_completion": weekly_completion,
            "submission_trend": submission_trend,
            "status_distribution": status_dist,
            "recent_activity": recent_remarks,
        },
    }

@router.get("/admin/employee-stats")
async def employee_stats(_admin=Depends(require_admin)):
    employees = await db.users.find(
        {"role": "employee", "is_active": True}, {"_id": 0, "id": 1, "name": 1}
    ).to_list(500)
    res = []
    thirty_days_ago = (ddate.today() - timedelta(days=30)).isoformat()
    
    for emp in employees:
        # Task distribution for this employee
        pipeline = [
            {"$match": {"assigned_to": emp["id"]}},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}}
        ]
        task_cursor = db.tasks.aggregate(pipeline)
        task_dist = []
        async for row in task_cursor:
            task_dist.append({"name": row["_id"], "value": row["count"]})
            
        # Sheet distribution (last 30 days)
        sheet_pipeline = [
            {"$match": {"employee_id": emp["id"], "date": {"$gte": thirty_days_ago}}},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}}
        ]
        sheet_cursor = db.activity_sheets.aggregate(sheet_pipeline)
        sheet_dist = []
        async for row in sheet_cursor:
            sheet_dist.append({"name": row["_id"], "value": row["count"]})
            
        res.append({
            "id": emp["id"],
            "name": emp["name"],
            "task_distribution": task_dist,
            "sheet_distribution": sheet_dist
        })
        
    return {"success": True, "data": res}



@router.get("/employee")
async def employee_dashboard(emp=Depends(require_employee)):
    today = ddate.today().isoformat()
    today_dt = ddate.today()
    sheet = await db.activity_sheets.find_one({"employee_id": emp["id"], "date": today}, {"_id": 0})
    pending_tasks = await db.tasks.find(
        {"assigned_to": emp["id"], "status": {"$in": ["pending", "in_progress", "needs_rework"]}},
        {"_id": 0}
    ).sort("deadline", 1).to_list(50)
    upcoming_cutoff = (today_dt + timedelta(days=7)).isoformat()
    upcoming = [t for t in pending_tasks if t.get("deadline") and today <= t["deadline"] <= upcoming_cutoff]
    # Leave balance
    year = today_dt.year
    balance = await db.leave_balances.find_one({"employee_id": emp["id"], "year": year}, {"_id": 0})
    if not balance:
        balance = {"casual_total": 12, "sick_total": 6, "casual_used": 0, "sick_used": 0}
    # Recent admin remarks on my tasks
    my_task_ids = [t["id"] for t in pending_tasks]
    all_my_tasks = await db.tasks.find({"assigned_to": emp["id"]}, {"_id": 0, "id": 1, "title": 1}).to_list(500)
    task_titles = {t["id"]: t["title"] for t in all_my_tasks}
    recent_remarks = await db.task_remarks.find(
        {"task_id": {"$in": list(task_titles.keys())}, "author_role": "admin"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(5)
    for r in recent_remarks:
        r["task_title"] = task_titles.get(r["task_id"], "")
    return {
        "success": True,
        "data": {
            "today_sheet_status": (sheet or {}).get("status", "not_started"),
            "pending_tasks": pending_tasks[:10],
            "pending_count": len(pending_tasks),
            "upcoming_deadlines": upcoming,
            "leave_balance": balance,
            "recent_remarks": recent_remarks,
        },
    }
