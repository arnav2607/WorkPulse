from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import require_admin, hash_password
from database import db
from models import EmployeeCreate, EmployeeUpdate, new_id

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("")
async def list_employees(
    department: Optional[str] = None,
    is_active: Optional[bool] = None,
    role: Optional[str] = None,
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
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)

    # Create default leave balance for current year
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
    doc.pop("password_hash", None)
    doc.pop("_id", None)
    return {"success": True, "data": doc}


@router.patch("/{employee_id}")
async def update_employee(employee_id: str, body: EmployeeUpdate, _admin=Depends(require_admin)):
    update = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "password" in update:
        update["password_hash"] = hash_password(update.pop("password"))
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
