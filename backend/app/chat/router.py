from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional
from pydantic import BaseModel

from app.db.session import get_db
from app.auth.models import User, Ride, Booking, BookingStatus, Message
from app.auth.router import get_current_user

router = APIRouter(prefix="/chat", tags=["chat"])


class MessageCreate(BaseModel):
    trip_id: int
    sender_id: int
    receiver_id: int
    message: str


class MessageOut(BaseModel):
    id: int
    trip_id: int
    sender_id: int
    receiver_id: int
    sender_name: str
    receiver_name: str
    message: str
    timestamp: str

    class Config:
        from_attributes = True


def _get_ride_passenger_ids(db: Session, trip_id: int) -> List[int]:
    """Get list of passenger IDs with confirmed bookings for a trip"""
    bookings = db.query(Booking).filter(
        and_(
            Booking.ride_id == trip_id,
            Booking.status == BookingStatus.confirmed
        )
    ).all()
    return [booking.passenger_id for booking in bookings]


def _can_access_chat(db: Session, user_id: int, trip_id: int) -> tuple[bool, Ride | None, Optional[int]]:
    """
    Check if user can access chat for this trip (1-to-1: only driver and first passenger).
    Returns (can_access, ride, reserved_by_user_id) tuple.
    """
    ride = db.query(Ride).filter(Ride.id == trip_id).first()
    if not ride:
        return False, None, None
    
    # Chat is disabled if trip is cancelled
    if not ride.is_active:
        return False, ride, None
    
    # Get first passenger ID (for 1-to-1 chat)
    passenger_ids = _get_ride_passenger_ids(db, trip_id)
    reserved_by_user_id = passenger_ids[0] if passenger_ids else None
    
    # User must be either the driver or the first passenger who reserved
    if ride.driver_id == user_id:
        # Driver can access if there's a reservation
        return reserved_by_user_id is not None, ride, reserved_by_user_id
    
    if reserved_by_user_id and user_id == reserved_by_user_id:
        return True, ride, reserved_by_user_id
    
    return False, ride, reserved_by_user_id


@router.post("/send", response_model=MessageOut)
def send_message(
    message_data: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Send a message in a trip chat.
    Only driver and passenger with confirmed booking can send messages.
    """
    # Verify sender is current user
    if message_data.sender_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only send messages as yourself"
        )
    
    # Check if user can access chat
    can_access, ride, reserved_by_user_id = _can_access_chat(db, current_user.id, message_data.trip_id)
    if not can_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chat not available"
        )
    
    # Verify receiver is valid (must be driver or first passenger)
    if current_user.id == ride.driver_id:
        # Driver sending to first passenger
        if message_data.receiver_id != reserved_by_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid receiver"
            )
    elif reserved_by_user_id and current_user.id == reserved_by_user_id:
        # First passenger sending to driver
        if message_data.receiver_id != ride.driver_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid receiver"
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid sender"
        )
    
    # Create message
    message = Message(
        trip_id=message_data.trip_id,
        sender_id=message_data.sender_id,
        receiver_id=message_data.receiver_id,
        message=message_data.message
    )
    
    db.add(message)
    db.commit()
    db.refresh(message)
    
    # Get sender and receiver names
    sender = db.query(User).filter(User.id == message.sender_id).first()
    receiver = db.query(User).filter(User.id == message.receiver_id).first()
    
    return MessageOut(
        id=message.id,
        trip_id=message.trip_id,
        sender_id=message.sender_id,
        receiver_id=message.receiver_id,
        sender_name=sender.full_name or sender.email if sender else "Unknown",
        receiver_name=receiver.full_name or receiver.email if receiver else "Unknown",
        message=message.message,
        timestamp=message.timestamp.isoformat()
    )


@router.get("/messages", response_model=List[MessageOut])
def get_messages(
    trip_id: int = Query(..., description="Trip ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all messages for a trip chat (1-to-1 between driver and first passenger).
    Only driver and passenger with confirmed booking can access messages.
    """
    # Check if user can access chat
    can_access, ride, reserved_by_user_id = _can_access_chat(db, current_user.id, trip_id)
    if not can_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chat not available"
        )
    
    # Get messages between driver and first passenger (1-to-1)
    if current_user.id == ride.driver_id:
        # Driver: messages with first passenger
        if reserved_by_user_id:
            messages = db.query(Message).filter(
                and_(
                    Message.trip_id == trip_id,
                    or_(
                        and_(Message.sender_id == current_user.id, Message.receiver_id == reserved_by_user_id),
                        and_(Message.sender_id == reserved_by_user_id, Message.receiver_id == current_user.id)
                    )
                )
            ).order_by(Message.timestamp.asc()).all()
        else:
            messages = []
    elif reserved_by_user_id and current_user.id == reserved_by_user_id:
        # First passenger: messages with driver
        messages = db.query(Message).filter(
            and_(
                Message.trip_id == trip_id,
                or_(
                    and_(Message.sender_id == current_user.id, Message.receiver_id == ride.driver_id),
                    and_(Message.sender_id == ride.driver_id, Message.receiver_id == current_user.id)
                )
            )
        ).order_by(Message.timestamp.asc()).all()
    else:
        messages = []
    
    # Get sender and receiver names
    result = []
    for message in messages:
        sender = db.query(User).filter(User.id == message.sender_id).first()
        receiver = db.query(User).filter(User.id == message.receiver_id).first()
        
        result.append(MessageOut(
            id=message.id,
            trip_id=message.trip_id,
            sender_id=message.sender_id,
            receiver_id=message.receiver_id,
            sender_name=sender.full_name or sender.email if sender else "Unknown",
            receiver_name=receiver.full_name or receiver.email if receiver else "Unknown",
            message=message.message,
            timestamp=message.timestamp.isoformat()
        ))
    
    return result

