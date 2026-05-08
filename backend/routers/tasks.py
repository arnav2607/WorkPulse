from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user, require_admin
from database import db
from email_service import (
    fire_and_forget,
    notify_employee_task_assigned,
)
from models import TaskCreate, TaskStatusUpdate, TaskReviewUpdate, RemarkCreate, new_id
from notifications_helper import create_notification

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("")
async def create_task(body: TaskCreate, admin=Depends(require_admin)):
    assignee = await db.users.find_one({"id": body.assigned_to}, {"_id": 0, "password_hash": 0})
    if not assignee:
        raise HTTPException(status_code=404, detail="Assignee not found")
    task = {
        "id": new_id(),
        "title": body.title,
        "description": body.description or "",
        "assigned_to": body.assigned_to,
        "assigned_to_name": assignee["name"],
        "created_by": admin["id"],
        "created_by_name": admin["name"],
        "status": "pending",
        "priority": body.priority,
        "deadline": body.deadline,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.tasks.insert_one(task)
    await create_notification(
        body.assigned_to,
        "task_assigned",
        f"New task assigned: {body.title}",
        reference_id=task["id"],
        reference_type="task",
    )
    # Email the employee about the new task (non-blocking)
    fire_and_forget(notify_employee_task_assigned(
        assignee.get("email", ""), assignee.get("name", ""), {**task, "_id": None},
    ))
    task.pop("_id", None)
    return {"success": True, "data": task}


@router.get("")
async def list_tasks(
    status: Optional[str] = None,
    employee_id: Optional[str] = None,
    priority: Optional[str] = None,
    user=Depends(get_current_user),
):
    q = {}
    if user["role"] == "employee":
        q["assigned_to"] = user["id"]
    elif employee_id:
        q["assigned_to"] = employee_id
    if status:
        q["status"] = status
    if priority:
        q["priority"] = priority
    tasks = await db.tasks.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return {"success": True, "data": tasks}


@router.get("/{task_id}")
async def get_task(task_id: str, user=Depends(get_current_user)):
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if user["role"] == "employee" and task["assigned_to"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    remarks = await db.task_remarks.find({"task_id": task_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return {"success": True, "data": {"task": task, "remarks": remarks}}


@router.patch("/{task_id}/status")
async def update_status(task_id: str, body: TaskStatusUpdate, user=Depends(get_current_user)):
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if user["role"] == "employee" and task["assigned_to"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if user["role"] != "employee":
        raise HTTPException(status_code=403, detail="Only employees update progress; admins use review")
    await db.tasks.update_one(
        {"id": task_id},
        {"$set": {"status": body.status, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    # Notify admin (creator)
    await create_notification(
        task["created_by"],
        "task_status_update",
        f"{user['name']} updated task '{task['title']}' to {body.status}",
        reference_id=task_id,
        reference_type="task",
    )
    return {"success": True}


@router.post("/{task_id}/remarks")
async def add_remark(task_id: str, body: RemarkCreate, user=Depends(get_current_user)):
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if user["role"] == "employee" and task["assigned_to"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    remark = {
        "id": new_id(),
        "task_id": task_id,
        "author_id": user["id"],
        "author_name": user["name"],
        "author_role": user["role"],
        "remark": body.remark,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.task_remarks.insert_one(remark)
    # Notify the other party
    target_user_id = task["assigned_to"] if user["role"] == "admin" else task["created_by"]
    if target_user_id != user["id"]:
        await create_notification(
            target_user_id,
            "task_remark",
            f"{user['name']} added a remark on '{task['title']}'",
            reference_id=task_id,
            reference_type="task",
        )
    remark.pop("_id", None)
    return {"success": True, "data": remark}


@router.patch("/{task_id}/review")
async def review_task(task_id: str, body: TaskReviewUpdate, admin=Depends(require_admin)):
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.tasks.update_one(
        {"id": task_id},
        {"$set": {"status": body.status, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if body.remark:
        await db.task_remarks.insert_one({
            "id": new_id(),
            "task_id": task_id,
            "author_id": admin["id"],
            "author_name": admin["name"],
            "author_role": "admin",
            "remark": body.remark,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    await create_notification(
        task["assigned_to"],
        "task_review",
        f"Task '{task['title']}' marked as {body.status}",
        reference_id=task_id,
        reference_type="task",
    )
    return {"success": True}
