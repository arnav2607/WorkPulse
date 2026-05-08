from fastapi import APIRouter, HTTPException, Depends
from auth import verify_password, create_token, get_current_user, hash_password
from database import db
from models import LoginRequest, ChangePasswordRequest

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


@router.post("/change-password")
async def change_password(body: ChangePasswordRequest, current=Depends(get_current_user)):
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    user = await db.users.find_one({"id": current["id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(body.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if verify_password(body.new_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="New password must be different from current")
    await db.users.update_one(
        {"id": current["id"]},
        {"$set": {
            "password_hash": hash_password(body.new_password),
            "must_change_password": False,
        }},
    )
    return {"success": True}
