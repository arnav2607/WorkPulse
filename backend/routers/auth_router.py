from fastapi import APIRouter, HTTPException, Depends
from auth import verify_password, create_token, get_current_user
from database import db
from models import LoginRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
async def login(body: LoginRequest):
    user = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], user["name"], user["role"])
    user.pop("password_hash", None)
    return {"success": True, "token": token, "user": user}


@router.get("/me")
async def me(current=Depends(get_current_user)):
    return {"success": True, "data": current}
