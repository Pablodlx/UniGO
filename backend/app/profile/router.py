from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.auth.models import User

# Ajusta esta importación si tu dependencia vive en otro lugar:
from app.auth.router import get_current_user
from app.db.session import get_db
from app.profile import service
from app.profile.schemas import ProfileOut, ProfileUpdate

router = APIRouter(prefix="/me", tags=["Profile"])


@router.get("/profile", response_model=ProfileOut)
def get_profile(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    return service.get_profile(db, current_user)


@router.put("/profile", response_model=ProfileOut)
def update_profile(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.update_profile(db, current_user, payload)


@router.post("/avatar", response_model=ProfileOut)
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await service.upload_avatar(db, current_user, file)
