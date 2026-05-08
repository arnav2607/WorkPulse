"""APScheduler cron jobs for WorkPulse.

Jobs (all run in TIMEZONE env var, default Asia/Kolkata):
- 09:00 — task_deadline_reminders     → emails employees about tasks due tomorrow
- 18:00 — pending_sheet_reminders     → emails employees who haven't submitted today's sheet
- 23:59 — mark_missed_sheets          → flips draft/missing sheets to 'missed' (or 'on_leave')

Deduplication: a `reminder_log` collection records (kind, target_id, sent_date) so an employee
never gets the same reminder twice on the same day, even if the scheduler is restarted.
"""
import asyncio
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone, date as ddate

try:
    from zoneinfo import ZoneInfo  # Python 3.9+
except ImportError:  # pragma: no cover
    from backports.zoneinfo import ZoneInfo  # type: ignore

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from database import db
from email_service import (
    notify_employee_task_deadline_tomorrow,
    notify_employee_sheet_pending,
)

logger = logging.getLogger(__name__)

TIMEZONE_NAME = os.environ.get("TIMEZONE", "Asia/Kolkata")
try:
    TZ = ZoneInfo(TIMEZONE_NAME)
except Exception:  # noqa: BLE001
    logger.warning("Unknown TIMEZONE %s — falling back to UTC", TIMEZONE_NAME)
    TZ = ZoneInfo("UTC")

scheduler = AsyncIOScheduler(timezone=TZ)


# ------------------------------------------------------------------ helpers
async def _already_sent(kind: str, target_id: str, day: str) -> bool:
    return bool(await db.reminder_log.find_one(
        {"kind": kind, "target_id": target_id, "sent_date": day}
    ))


async def _mark_sent(kind: str, target_id: str, day: str) -> None:
    await db.reminder_log.update_one(
        {"kind": kind, "target_id": target_id, "sent_date": day},
        {"$setOnInsert": {
            "id": uuid.uuid4().hex,
            "kind": kind,
            "target_id": target_id,
            "sent_date": day,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )


def _today_local() -> str:
    return datetime.now(TZ).date().isoformat()


def _tomorrow_local() -> str:
    return (datetime.now(TZ).date() + timedelta(days=1)).isoformat()


# ------------------------------------------------------------------ cron jobs
async def mark_missed_sheets():
    """Run nightly at 23:59 — flip pending sheets to 'missed' or 'on_leave'."""
    today = _today_local()
    logger.info("[cron] mark_missed_sheets for %s", today)
    employees = await db.users.find(
        {"role": "employee", "is_active": True}, {"_id": 0, "id": 1}
    ).to_list(1000)
    for emp in employees:
        sheet = await db.activity_sheets.find_one({"employee_id": emp["id"], "date": today})
        leave = await db.leave_requests.find_one({
            "employee_id": emp["id"], "status": "approved",
            "from_date": {"$lte": today}, "to_date": {"$gte": today},
        })
        target_status = "on_leave" if leave else "missed"
        if not sheet:
            await db.activity_sheets.insert_one({
                "id": uuid.uuid4().hex,
                "employee_id": emp["id"],
                "date": today,
                "status": target_status,
                "submitted_at": None,
                "entries": [],
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        elif sheet.get("status") not in ("submitted", "on_leave"):
            await db.activity_sheets.update_one(
                {"id": sheet["id"]}, {"$set": {"status": target_status}}
            )


async def task_deadline_reminders():
    """09:00 daily — email assignees about tasks whose deadline is tomorrow."""
    today = _today_local()
    tomorrow = _tomorrow_local()
    logger.info("[cron] task_deadline_reminders — checking tasks due %s", tomorrow)

    pending_states = ["pending", "in_progress", "submitted", "rejected"]  # not done/cancelled
    tasks = await db.tasks.find(
        {"deadline": tomorrow, "status": {"$in": pending_states}},
        {"_id": 0},
    ).to_list(2000)
    if not tasks:
        logger.info("[cron] No tasks due tomorrow.")
        return

    sent = 0
    for t in tasks:
        if await _already_sent("task_deadline_t-1", t["id"], today):
            continue
        emp = await db.users.find_one(
            {"id": t["assigned_to"], "is_active": True},
            {"_id": 0, "email": 1, "name": 1},
        )
        if not emp:
            continue
        try:
            await notify_employee_task_deadline_tomorrow(
                emp.get("email", ""), emp.get("name", ""), t,
            )
            await _mark_sent("task_deadline_t-1", t["id"], today)
            sent += 1
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed sending deadline reminder for task %s: %s", t.get("id"), exc)
    logger.info("[cron] task_deadline_reminders → sent %d email(s)", sent)


async def pending_sheet_reminders():
    """18:00 daily — email employees who haven't submitted today's sheet (and aren't on leave)."""
    today = _today_local()
    logger.info("[cron] pending_sheet_reminders for %s", today)

    employees = await db.users.find(
        {"role": "employee", "is_active": True},
        {"_id": 0, "id": 1, "name": 1, "email": 1},
    ).to_list(1000)

    sent = 0
    for emp in employees:
        # Skip if on approved leave today
        on_leave = await db.leave_requests.find_one({
            "employee_id": emp["id"], "status": "approved",
            "from_date": {"$lte": today}, "to_date": {"$gte": today},
        })
        if on_leave:
            continue
        # Skip if already submitted today
        sheet = await db.activity_sheets.find_one(
            {"employee_id": emp["id"], "date": today},
            {"_id": 0, "status": 1},
        )
        if sheet and sheet.get("status") in ("submitted", "on_leave"):
            continue
        # Dedupe per day
        if await _already_sent("sheet_pending_18", emp["id"], today):
            continue
        try:
            await notify_employee_sheet_pending(emp.get("email", ""), emp.get("name", ""))
            await _mark_sent("sheet_pending_18", emp["id"], today)
            sent += 1
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed sending sheet reminder to %s: %s", emp.get("email"), exc)
    logger.info("[cron] pending_sheet_reminders → sent %d email(s)", sent)


# ------------------------------------------------------------------ entrypoint
def start_scheduler():
    if scheduler.running:
        return
    scheduler.add_job(
        task_deadline_reminders,
        CronTrigger(hour=9, minute=0, timezone=TZ),
        id="task_deadline_reminders",
        replace_existing=True,
    )
    scheduler.add_job(
        pending_sheet_reminders,
        CronTrigger(hour=18, minute=0, timezone=TZ),
        id="pending_sheet_reminders",
        replace_existing=True,
    )
    scheduler.add_job(
        mark_missed_sheets,
        CronTrigger(hour=23, minute=59, timezone=TZ),
        id="mark_missed_sheets",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(
        "Scheduler started in %s · jobs: task_deadline_reminders@09:00, pending_sheet_reminders@18:00, mark_missed_sheets@23:59",
        TIMEZONE_NAME,
    )
