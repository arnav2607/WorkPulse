"""Pydantic models for WorkPulse."""
from datetime import datetime, date
from typing import Optional, List, Literal
import uuid

from pydantic import BaseModel, EmailStr, Field, ConfigDict


def now_utc() -> datetime:
    return datetime.now().astimezone()


def new_id() -> str:
    return str(uuid.uuid4())


# =================== Users / Employees ===================
class UserOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    email: EmailStr
    role: Literal["admin", "employee"]
    department: Optional[str] = None
    is_active: bool = True
    created_at: Optional[str] = None


class EmployeeCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    department: Optional[str] = None
    role: Literal["admin", "employee"] = "employee"


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None
    role: Optional[Literal["admin", "employee"]] = None


class AssignActivities(BaseModel):
    template_ids: Optional[List[str]] = None  # None = all (default)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    success: bool
    token: str
    user: UserOut


# =================== Tasks ===================
TaskStatus = Literal["pending", "in_progress", "done", "blocked", "approved", "needs_rework", "closed"]
TaskPriority = Literal["low", "medium", "high", "urgent"]


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    assigned_to: str
    priority: TaskPriority = "medium"
    deadline: Optional[str] = None  # ISO date string


class TaskStatusUpdate(BaseModel):
    status: Literal["pending", "in_progress", "done", "blocked"]


class TaskReviewUpdate(BaseModel):
    status: Literal["approved", "needs_rework", "closed"]
    remark: Optional[str] = None


class RemarkCreate(BaseModel):
    remark: str


# =================== Activity Template & Sheets ===================
class ActivityTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    is_required: bool = True
    frequency: Literal["daily", "weekly", "monthly", "annually"] = "daily"
    frequency_value: Optional[str] = None



class ActivityTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_required: Optional[bool] = None
    is_active: Optional[bool] = None
    frequency: Optional[Literal["daily", "weekly", "monthly", "annually"]] = None
    frequency_value: Optional[str] = None



SheetEntryStatus = Literal["done", "not_done", "not_required"]


class SheetEntryInput(BaseModel):
    template_id: str
    status: SheetEntryStatus
    remarks: Optional[str] = ""


class SheetSubmit(BaseModel):
    entries: List[SheetEntryInput]


class SheetDraftSave(BaseModel):
    entries: List[SheetEntryInput]


# =================== Leaves ===================
LeaveType = Literal["casual", "sick", "half_day", "wfh"]
LeaveStatus = Literal["pending", "approved", "rejected", "cancelled"]


class LeaveCreate(BaseModel):
    leave_type: LeaveType
    from_date: str  # ISO date
    to_date: str    # ISO date
    reason: str


class LeaveDecision(BaseModel):
    admin_comment: Optional[str] = ""


# =================== Common ===================
class ApiResponse(BaseModel):
    success: bool = True
    data: Optional[dict] = None
