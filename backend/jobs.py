"""Daily cron job to mark missed sheets at 23:59."""
import logging
from datetime import datetime, timezone, date as ddate

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from database import db

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def mark_missed_sheets():
    today = ddate.today().isoformat()
    logger.info(f"[cron] Marking missed sheets for {today}")
    employees = await db.users.find(
        {"role": "employee", "is_active": True}, {"_id": 0, "id": 1}
    ).to_list(1000)
    for emp in employees:
        sheet = await db.activity_sheets.find_one({"employee_id": emp["id"], "date": today})
        # Check if employee on leave
        leave = await db.leave_requests.find_one({
            "employee_id": emp["id"], "status": "approved",
            "from_date": {"$lte": today}, "to_date": {"$gte": today},
        })
        if leave:
            target_status = "on_leave"
        else:
            target_status = "missed"
        if not sheet:
            await db.activity_sheets.insert_one({
                "id": __import__("uuid").uuid4().hex,
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


def start_scheduler():
    if not scheduler.running:
        scheduler.add_job(mark_missed_sheets, CronTrigger(hour=23, minute=59), id="mark_missed_sheets", replace_existing=True)
        scheduler.start()
        logger.info("Scheduler started")
