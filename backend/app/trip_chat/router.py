from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.db.session import get_db
from app.auth.models import User, Ride, Booking, BookingStatus, TripGroupMessage, Notification
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
    sender_avatar_url: Optional[str] = None
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
    
    # Create notifications for all participants (except sender)
    sender_name = current_user.full_name or current_user.email
    all_participants = [ride.driver_id] + passenger_ids
    
    for participant_id in all_participants:
        if participant_id != current_user.id:  # Don't notify yourself
            # Store sender info in notification message
            notification_message = f"{sender_name}: {message_data.message}"
            notification = Notification(
                receiver_id=participant_id,
                type="new_group_message",
                message=notification_message,
                ride_id=message_data.trip_id
            )
            db.add(notification)
    
    db.commit()
    db.refresh(message)
    
    return GroupMessageOut(
        id=message.id,
        trip_id=message.trip_id,
        sender_id=message.sender_id,
        sender_name=message.sender_name,
        sender_avatar_url=current_user.avatar_url,
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
    
    # Get all messages for this trip with sender info
    messages = db.query(TripGroupMessage).filter(
        TripGroupMessage.trip_id == trip_id
    ).order_by(TripGroupMessage.timestamp.asc()).all()
    
    # Get sender avatars
    result = []
    for msg in messages:
        # Get sender user to get avatar_url
        sender_user = db.query(User).filter(User.id == msg.sender_id).first()
        sender_avatar_url = sender_user.avatar_url if sender_user else None
        
        result.append(
            GroupMessageOut(
                id=msg.id,
                trip_id=msg.trip_id,
                sender_id=msg.sender_id,
                sender_name=msg.sender_name,
                sender_avatar_url=sender_avatar_url,
                message=msg.message,
                timestamp=msg.timestamp.isoformat()
            )
        )
    
    return result


class UnreadMessageOut(BaseModel):
    id: int
    sender_id: int
    sender_name: str
    message: str
    timestamp: int
    trip_id: int
    trip_title: str

    class Config:
        from_attributes = True


class UnreadResponse(BaseModel):
    unread: bool
    latest_message_timestamp: int
    messages: List[UnreadMessageOut]


@router.get("/unread", response_model=UnreadResponse)
def get_unread_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get unread messages for the current user from all trip group chats they participate in.
    Returns messages that the user hasn't seen yet (messages sent after their last activity).
    """
    user_id = current_user.id

    # Get all trips where user participates (as driver or confirmed passenger)
    driver_rides = db.query(Ride).filter(Ride.driver_id == user_id).all()
    ride_ids = [ride.id for ride in driver_rides]

    bookings = db.query(Booking).filter(
        Booking.passenger_id == user_id,
        Booking.status == BookingStatus.confirmed
    ).all()
    ride_ids.extend([booking.ride_id for booking in bookings])
    ride_ids = list(set(ride_ids))

    if not ride_ids:
        return UnreadResponse(
            unread=False,
            latest_message_timestamp=0,
            messages=[]
        )

    # Get all group messages from user's trips
    all_messages = (
        db.query(TripGroupMessage)
        .filter(TripGroupMessage.trip_id.in_(ride_ids))
        .order_by(TripGroupMessage.timestamp.desc())
        .all()
    )

    if not all_messages:
        return UnreadResponse(
            unread=False,
            latest_message_timestamp=0,
            messages=[]
        )

    # Find the last message the user sent (if any)
    user_last_message = None
    for msg in all_messages:
        if msg.sender_id == user_id:
            user_last_message = msg
            break

    # Get unread messages (messages after user's last message, excluding user's own messages)
    unread_messages = []
    latest_timestamp = 0

    for msg in all_messages:
        # Convert timestamp to milliseconds (Unix timestamp)
        msg_timestamp = int(msg.timestamp.timestamp() * 1000)

        # If user never sent a message, include all messages that aren't theirs
        if user_last_message is None:
            if msg.sender_id != user_id:
                unread_messages.append(msg)
                if msg_timestamp > latest_timestamp:
                    latest_timestamp = msg_timestamp
        else:
            # Include messages after user's last message that aren't from the user
            if msg.timestamp > user_last_message.timestamp and msg.sender_id != user_id:
                unread_messages.append(msg)
                if msg_timestamp > latest_timestamp:
                    latest_timestamp = msg_timestamp
            elif msg.timestamp <= user_last_message.timestamp:
                # We've reached messages the user has seen
                break

    # Get trip titles
    trip_cache = {}
    for msg in unread_messages:
        if msg.trip_id not in trip_cache:
            trip = db.query(Ride).filter(Ride.id == msg.trip_id).first()
            if trip:
                trip_cache[msg.trip_id] = f"{trip.departure_city} → {trip.destination_city}"
            else:
                trip_cache[msg.trip_id] = f"Trip {msg.trip_id}"

    # Format messages
    formatted_messages = []
    for msg in unread_messages:
        formatted_messages.append(
            UnreadMessageOut(
                id=msg.id,
                sender_id=msg.sender_id,
                sender_name=msg.sender_name,
                message=msg.message,
                timestamp=int(msg.timestamp.timestamp() * 1000),
                trip_id=msg.trip_id,
                trip_title=trip_cache.get(msg.trip_id, f"Trip {msg.trip_id}")
            )
        )

    # Sort by timestamp descending (newest first)
    formatted_messages.sort(key=lambda x: x.timestamp, reverse=True)

    return UnreadResponse(
        unread=len(formatted_messages) > 0,
        latest_message_timestamp=latest_timestamp,
        messages=formatted_messages
    )

