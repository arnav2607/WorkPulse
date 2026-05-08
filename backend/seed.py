"""Seed initial data: admin user, sample template items."""
import asyncio
import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from database import db  # noqa: E402
from auth import hash_password  # noqa: E402
from models import new_id  # noqa: E402


async def seed():
    admin_email = "arnavpgoel@gmail.com"
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        admin_id = new_id()
        await db.users.insert_one({
            "id": admin_id,
            "name": "Arnav Goel",
            "email": admin_email,
            "password_hash": hash_password("arnav2607"),
            "role": "admin",
            "department": "Management",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        print(f"[seed] Admin created: {admin_email}")
    else:
        print(f"[seed] Admin exists: {admin_email}")

    # Default template items
    default_items = [
        {"name": "Client Follow-up", "description": "Reach out to assigned clients via call or email"},
        {"name": "Report Submission", "description": "Submit daily progress report"},
        {"name": "Meeting Attendance", "description": "Attend scheduled team or client meetings"},
        {"name": "Documentation", "description": "Update project documentation"},
        {"name": "Email Responses", "description": "Respond to all pending emails"},
    ]
    admin = await db.users.find_one({"email": admin_email}, {"_id": 0})
    for item in default_items:
        exists = await db.activity_templates.find_one({"name": item["name"]})
        if not exists:
            await db.activity_templates.insert_one({
                "id": new_id(),
                "name": item["name"],
                "description": item["description"],
                "is_required": True,
                "is_active": True,
                "created_by": admin["id"],
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            print(f"[seed] Template item: {item['name']}")


if __name__ == "__main__":
    asyncio.run(seed())
