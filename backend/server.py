"""WorkPulse FastAPI server."""
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from database import db  # noqa: E402
from jobs import start_scheduler  # noqa: E402
from routers.auth_router import router as auth_router  # noqa: E402
from routers.employees import router as employees_router  # noqa: E402
from routers.tasks import router as tasks_router  # noqa: E402
from routers.activities import router as activities_router  # noqa: E402
from routers.sheets import router as sheets_router  # noqa: E402
from routers.leaves import router as leaves_router  # noqa: E402
from routers.notifications import router as notifications_router  # noqa: E402
from routers.dashboard import router as dashboard_router  # noqa: E402
from routers.reports import router as reports_router  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.tasks.create_index("assigned_to")
    await db.tasks.create_index("status")
    await db.activity_sheets.create_index([("employee_id", 1), ("date", 1)], unique=True)
    await db.activity_sheets.create_index("date")
    await db.leave_requests.create_index("employee_id")
    await db.leave_requests.create_index("status")
    await db.notifications.create_index([("user_id", 1), ("is_read", 1)])
    start_scheduler()
    yield


app = FastAPI(title="WorkPulse", lifespan=lifespan)

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "WorkPulse API", "version": "1.0.0"}


api_router.include_router(auth_router)
api_router.include_router(employees_router)
api_router.include_router(tasks_router)
api_router.include_router(activities_router)
api_router.include_router(sheets_router)
api_router.include_router(leaves_router)
api_router.include_router(notifications_router)
api_router.include_router(dashboard_router)
api_router.include_router(reports_router)

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
