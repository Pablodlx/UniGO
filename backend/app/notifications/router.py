from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from datetime import datetime

from app.db.session import get_db
from app.auth.models import User, Notification
from app.auth.router import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationOut(BaseModel):
    id: int
    type: str
    message: str
    ride_id: int | None
    created_at: str
    read_at: str | None

    class Config:
        from_attributes = True


@router.get("", response_model=List[NotificationOut])
def get_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get all notifications for the current user, ordered by created_at desc.
    """
    notifications = (
        db.query(Notification)
        .filter(Notification.receiver_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )
    
    return [
        NotificationOut(
            id=n.id,
            type=n.type,
            message=n.message,
            ride_id=n.ride_id,
            created_at=n.created_at.isoformat(),
            read_at=n.read_at.isoformat() if n.read_at else None,
        )
        for n in notifications
    ]

