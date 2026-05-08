# """Seed initial data: admin user, sample template items."""
# import asyncio
# import os
# from datetime import datetime, timezone
# from pathlib import Path

# from dotenv import load_dotenv

# ROOT_DIR = Path(__file__).parent
# load_dotenv(ROOT_DIR / ".env")

# from database import db  # noqa: E402
# from auth import hash_password  # noqa: E402
# from models import new_id  # noqa: E402


# async def seed():
#     admin_email = "arnavpgoel@gmail.com"
#     existing = await db.users.find_one({"email": admin_email})
#     if not existing:
#         admin_id = new_id()
#         await db.users.insert_one({
#             "id": admin_id,
#             "name": "Arnav Goel",
#             "email": admin_email,
#             "password_hash": hash_password("arnav2607"),
#             "role": "admin",
#             "department": "Management",
#             "is_active": True,
#             "must_change_password": False,
#             "assigned_template_ids": None,
#             "created_at": datetime.now(timezone.utc).isoformat(),
#         })
#         print(f"[seed] Admin created: {admin_email}")
#     else:
#         # Make sure existing seeded admin has the new fields
#         await db.users.update_one(
#             {"email": admin_email},
#             {"$setOnInsert": {}, "$set": {}},
#         )
#         await db.users.update_one(
#             {"email": admin_email, "must_change_password": {"$exists": False}},
#             {"$set": {"must_change_password": False}},
#         )
#         await db.users.update_one(
#             {"email": admin_email, "assigned_template_ids": {"$exists": False}},
#             {"$set": {"assigned_template_ids": None}},
#         )
#         print(f"[seed] Admin exists: {admin_email}")

#     # Default template items
#     default_items = [
#         {"name": "Client Follow-up", "description": "Reach out to assigned clients via call or email"},
#         {"name": "Report Submission", "description": "Submit daily progress report"},
#         {"name": "Meeting Attendance", "description": "Attend scheduled team or client meetings"},
#         {"name": "Documentation", "description": "Update project documentation"},
#         {"name": "Email Responses", "description": "Respond to all pending emails"},
#     ]
#     admin = await db.users.find_one({"email": admin_email}, {"_id": 0})
#     for item in default_items:
#         exists = await db.activity_templates.find_one({"name": item["name"]})
#         if not exists:
#             await db.activity_templates.insert_one({
#                 "id": new_id(),
#                 "name": item["name"],
#                 "description": item["description"],
#                 "is_required": True,
#                 "is_active": True,
#                 "created_by": admin["id"],
#                 "created_at": datetime.now(timezone.utc).isoformat(),
#             })
#             print(f"[seed] Template item: {item['name']}")


# if __name__ == "__main__":
#     asyncio.run(seed())
"""Seed initial data: admin user, sample template items.

Running this script is IDEMPOTENT and SAFE to re-run any time:
- If the admin doesn't exist → creates it.
- If the admin exists → resets the password back to 'arnav2607' and clears any
  must_change_password / inactive flag, so you can always log back in.

Run: cd /app/backend && python seed.py
"""
import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from database import db  # noqa: E402
from auth import hash_password  # noqa: E402
from models import new_id  # noqa: E402

ADMIN_EMAIL = "arnavpgoel@gmail.com"
ADMIN_NAME = "Arnav Goel"
ADMIN_PASSWORD = "arnav2607"


async def seed(reset_password: bool = True):
    """Idempotent seed.

    Args:
        reset_password: when True (default), the admin password is RESET to the
            default. Useful when you've forgotten or changed it. Pass False (or
            CLI flag --no-reset) to leave the existing password untouched.
    """
    existing = await db.users.find_one({"email": ADMIN_EMAIL})

    base_fields = {
        "name": ADMIN_NAME,
        "email": ADMIN_EMAIL,
        "role": "admin",
        "department": "Management",
        "is_active": True,
        "must_change_password": False,
        "assigned_template_ids": None,
    }

    if not existing:
        await db.users.insert_one({
            "id": new_id(),
            **base_fields,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        print(f"[seed] ✅ Admin CREATED: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    else:
        update_set = dict(base_fields)
        if reset_password:
            update_set["password_hash"] = hash_password(ADMIN_PASSWORD)
        await db.users.update_one({"email": ADMIN_EMAIL}, {"$set": update_set})
        if reset_password:
            print(f"[seed] 🔑 Admin password RESET: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
        else:
            print(f"[seed] ✓ Admin exists (password unchanged): {ADMIN_EMAIL}")

    # Default template items (only inserted if missing — never overwritten)
    default_items = [
        {"name": "Client Follow-up",   "description": "Reach out to assigned clients via call or email"},
        {"name": "Report Submission",  "description": "Submit daily progress report"},
        {"name": "Meeting Attendance", "description": "Attend scheduled team or client meetings"},
        {"name": "Documentation",      "description": "Update project documentation"},
        {"name": "Email Responses",    "description": "Respond to all pending emails"},
    ]
    admin = await db.users.find_one({"email": ADMIN_EMAIL}, {"_id": 0})
    inserted = 0
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
            inserted += 1
    if inserted:
        print(f"[seed] ✅ {inserted} template item(s) inserted")
    else:
        print("[seed] ✓ Template items already present")


if __name__ == "__main__":
    reset = "--no-reset" not in sys.argv
    asyncio.run(seed(reset_password=reset))

