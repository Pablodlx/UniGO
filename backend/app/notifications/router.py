from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.db.session import get_db
from app.auth.models import User, Notification, Ride, Message, TripGroupMessage
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


class ChatNotificationOut(BaseModel):
    id: int
    type: str
    message: str
    ride_id: int | None
    trip_title: str
    sender_id: int | None
    sender_name: str
    sender_avatar_url: str | None
    created_at: str
    read_at: str | None

    class Config:
        from_attributes = True


@router.get("")
def get_notifications(
    unread: Optional[bool] = Query(None, description="Filter by unread status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get notifications for the current user.
    If unread=true, only return unread chat notifications with sender details.
    Returns List[ChatNotificationOut] if unread=true, otherwise List[NotificationOut].
    """
    query = db.query(Notification).filter(Notification.receiver_id == current_user.id)
    
    if unread is True:
        query = query.filter(Notification.read_at.is_(None))
        # Only return chat-related notifications (new_message, new_group_message)
        query = query.filter(
            or_(
                Notification.type == "new_message",
                Notification.type == "new_group_message"
            )
        )
    
    notifications = query.order_by(Notification.created_at.desc()).all()
    
    if unread is True:
        # For unread chat notifications, enrich with sender and trip info
        result = []
        for n in notifications:
            trip_title = ""
            sender_id = None
            sender_name = "Usuario"
            sender_avatar_url = None
            
            if n.ride_id:
                ride = db.query(Ride).filter(Ride.id == n.ride_id).first()
                if ride:
                    trip_title = f"{ride.departure_city} → {ride.destination_city}"
                    
                    # Extract sender name from notification message (format: "Sender Name: message text")
                    # and find the sender user
                    if ":" in n.message:
                        potential_sender_name = n.message.split(":")[0].strip()
                        # Find user by name or email
                        sender_user = (
                            db.query(User)
                            .filter(
                                or_(
                                    User.full_name == potential_sender_name,
                                    User.email == potential_sender_name
                                )
                            )
                            .first()
                        )
                        if sender_user:
                            sender_id = sender_user.id
                            sender_name = sender_user.full_name or sender_user.email
                            sender_avatar_url = sender_user.avatar_url
                        else:
                            # Fallback: try to find from most recent message
                            if n.type == "new_message":
                                message = (
                                    db.query(Message)
                                    .filter(
                                        Message.trip_id == n.ride_id,
                                        Message.receiver_id == current_user.id,
                                        Message.read_at.is_(None)
                                    )
                                    .order_by(Message.timestamp.desc())
                                    .first()
                                )
                                if message:
                                    sender_id = message.sender_id
                                    sender = db.query(User).filter(User.id == sender_id).first()
                                    if sender:
                                        sender_name = sender.full_name or sender.email
                                        sender_avatar_url = sender.avatar_url
                            elif n.type == "new_group_message":
                                group_message = (
                                    db.query(TripGroupMessage)
                                    .filter(
                                        TripGroupMessage.trip_id == n.ride_id,
                                        TripGroupMessage.sender_id != current_user.id
                                    )
                                    .order_by(TripGroupMessage.timestamp.desc())
                                    .first()
                                )
                                if group_message:
                                    sender_id = group_message.sender_id
                                    sender = db.query(User).filter(User.id == sender_id).first()
                                    if sender:
                                        sender_name = sender.full_name or sender.email
                                        sender_avatar_url = sender.avatar_url
                    else:
                        # No sender name in message, try to find from most recent message
                        if n.type == "new_message":
                            message = (
                                db.query(Message)
                                .filter(
                                    Message.trip_id == n.ride_id,
                                    Message.receiver_id == current_user.id,
                                    Message.read_at.is_(None)
                                )
                                .order_by(Message.timestamp.desc())
                                .first()
                            )
                            if message:
                                sender_id = message.sender_id
                                sender = db.query(User).filter(User.id == sender_id).first()
                                if sender:
                                    sender_name = sender.full_name or sender.email
                                    sender_avatar_url = sender.avatar_url
                        elif n.type == "new_group_message":
                            group_message = (
                                db.query(TripGroupMessage)
                                .filter(
                                    TripGroupMessage.trip_id == n.ride_id,
                                    TripGroupMessage.sender_id != current_user.id
                                )
                                .order_by(TripGroupMessage.timestamp.desc())
                                .first()
                            )
                            if group_message:
                                sender_id = group_message.sender_id
                                sender = db.query(User).filter(User.id == sender_id).first()
                                if sender:
                                    sender_name = sender.full_name or sender.email
                                    sender_avatar_url = sender.avatar_url
            
            result.append(ChatNotificationOut(
                id=n.id,
                type=n.type,
                message=n.message,
                ride_id=n.ride_id,
                trip_title=trip_title,
                sender_id=sender_id,
                sender_name=sender_name,
                sender_avatar_url=sender_avatar_url,
                created_at=n.created_at.isoformat(),
                read_at=n.read_at.isoformat() if n.read_at else None,
            ))
        
        return result
    
    # For all notifications (unread=False or not specified), return simple format
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


@router.patch("/{notification_id}/mark-read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mark a notification as read.
    """
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.receiver_id == current_user.id
        )
        .first()
    )
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    if notification.read_at is None:
        notification.read_at = datetime.now()
        db.commit()
        db.refresh(notification)
    
    return NotificationOut(
        id=notification.id,
        type=notification.type,
        message=notification.message,
        ride_id=notification.ride_id,
        created_at=notification.created_at.isoformat(),
        read_at=notification.read_at.isoformat() if notification.read_at else None,
    )

