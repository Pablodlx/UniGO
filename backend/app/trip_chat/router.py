from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List
from pydantic import BaseModel

from app.db.session import get_db
from app.auth.models import User, Ride, Booking, BookingStatus, TripGroupMessage
from app.auth.router import get_current_user

router = APIRouter(prefix="/trip-chat", tags=["trip-chat"])


class SendMessageRequest(BaseModel):
    trip_id: int
    message: str


class GroupMessageOut(BaseModel):
    id: int
    trip_id: int
    sender_id: int
    sender_name: str
    message: str
    timestamp: str

    class Config:
        from_attributes = True


def _can_access_chat(db: Session, user_id: int, trip_id: int) -> tuple[bool, Ride | None, List[int]]:
    """
    Check if user can access group chat for this trip.
    Returns (can_access, ride, passenger_ids) tuple.
    """
    ride = db.query(Ride).filter(Ride.id == trip_id).first()
    if not ride:
        return False, None, []
    
    # Chat is disabled if trip is cancelled
    if not ride.is_active:
        return False, ride, []
    
    # Get all confirmed passenger IDs
    bookings = db.query(Booking).filter(
        and_(
            Booking.ride_id == trip_id,
            Booking.status == BookingStatus.confirmed
        )
    ).all()
    passenger_ids = [booking.passenger_id for booking in bookings]
    
    # User must be either the driver or a confirmed passenger
    if ride.driver_id == user_id:
        return len(passenger_ids) > 0, ride, passenger_ids
    
    if user_id in passenger_ids:
        return True, ride, passenger_ids
    
    return False, ride, passenger_ids


@router.post("/send", response_model=GroupMessageOut)
def send_message(
    message_data: SendMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Send a message in the trip group chat.
    Only driver and confirmed passengers can send messages.
    """
    # Check if user can access chat
    can_access, ride, passenger_ids = _can_access_chat(db, current_user.id, message_data.trip_id)
    if not can_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chat not available"
        )
    
    # Verify trip has reservations
    if len(passenger_ids) == 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chat is only available when the trip has reservations"
        )
    
    # Get sender name
    sender_name = current_user.full_name or current_user.email
    
    # Create message
    message = TripGroupMessage(
        trip_id=message_data.trip_id,
        sender_id=current_user.id,
        sender_name=sender_name,
        message=message_data.message
    )
    
    db.add(message)
    db.commit()
    db.refresh(message)
    
    return GroupMessageOut(
        id=message.id,
        trip_id=message.trip_id,
        sender_id=message.sender_id,
        sender_name=message.sender_name,
        message=message.message,
        timestamp=message.timestamp.isoformat()
    )


@router.get("/messages", response_model=List[GroupMessageOut])
def get_messages(
    trip_id: int = Query(..., description="Trip ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all messages for a trip group chat.
    Only driver and confirmed passengers can access messages.
    """
    # Check if user can access chat
    can_access, ride, passenger_ids = _can_access_chat(db, current_user.id, trip_id)
    if not can_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chat not available"
        )
    
    # Get all messages for this trip
    messages = db.query(TripGroupMessage).filter(
        TripGroupMessage.trip_id == trip_id
    ).order_by(TripGroupMessage.timestamp.asc()).all()
    
    return [
        GroupMessageOut(
            id=msg.id,
            trip_id=msg.trip_id,
            sender_id=msg.sender_id,
            sender_name=msg.sender_name,
            message=msg.message,
            timestamp=msg.timestamp.isoformat()
        )
        for msg in messages
    ]

