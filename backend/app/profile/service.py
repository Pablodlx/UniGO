import os, hashlib
from sqlalchemy.orm import Session
from fastapi import UploadFile, HTTPException, status
from app.auth.models import User
from app.profile.schemas import ProfileUpdate, ProfileOut

AVATAR_DIR = os.getenv("AVATAR_DIR", "data/avatars")
PUBLIC_PREFIX = os.getenv("AVATAR_PUBLIC_PREFIX", "/static/avatars")
REQUIRED = ("full_name", "university", "degree", "course", "ride_intent")

def get_profile(db: Session, user: User) -> ProfileOut:
    ride = user.ride_intent.name if hasattr(user.ride_intent, "name") else user.ride_intent
    return ProfileOut(
        email=user.email,
        full_name=user.full_name,
        university=user.university,
        degree=user.degree,
        course=user.course,
        ride_intent=ride,
        avatar_url=user.avatar_url,
    )

def update_profile(db: Session, user: User, payload: ProfileUpdate) -> ProfileOut:
    data = payload.dict(exclude_unset=True)
    for k, v in data.items():
        setattr(user, k, v)

    # Validación extra RF-02 por si el validator se cambia
    missing = [k for k in REQUIRED if getattr(user, k, None) in (None, "", 0)]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Faltan campos obligatorios: {', '.join(missing)}"
        )

    db.add(user)
    db.commit()
    db.refresh(user)
    return get_profile(db, user)

async def upload_avatar(db: Session, user: User, file: UploadFile) -> ProfileOut:
    if file.content_type not in {"image/png", "image/jpeg"}:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido")

    os.makedirs(AVATAR_DIR, exist_ok=True)
    raw = await file.read()
    digest = hashlib.sha256(raw).hexdigest()[:16]
    ext = ".jpg" if file.content_type == "image/jpeg" else ".png"
    fname = f"{user.id}_{digest}{ext}"
    with open(os.path.join(AVATAR_DIR, fname), "wb") as f:
        f.write(raw)

    user.avatar_url = f"{PUBLIC_PREFIX}/{fname}"
    db.add(user)
    db.commit()
    db.refresh(user)
    return get_profile(db, user)
