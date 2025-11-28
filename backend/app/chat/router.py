from fastapi import APIRouter, Depends, HTTPException, status, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, UTC
from jose import JWTError, jwt

from app.db.session import get_db
from app.auth.models import User, Ride, Booking, BookingStatus, Message, TripGroupMessage, Notification
from app.auth.router import get_current_user
from app.chat.manager import manager
from app.core.config import settings
import asyncio

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


def get_user_from_token(token: str, db: Session) -> User:
    """
    Helper function to get user from JWT token.
    Reuses the same logic as get_current_user.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        data = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        sub = data.get("sub")
        if not sub:
            raise credentials_exception
        user = db.get(User, int(sub))
        if not user:
            raise credentials_exception
        return user
    except JWTError:
        raise credentials_exception from None


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


@router.websocket("/ws")
async def chat_notifications_ws(websocket: WebSocket):
    """
    WebSocket endpoint for real-time chat notifications.
    Authenticates user via token query parameter.
    """
    token = websocket.query_params.get("token")
    if not token:
        print("WebSocket: Missing token")
        await websocket.close(code=1008, reason="Missing token")
        return

    # WebSocket endpoints can't use Depends, so we need to get the DB session manually
    from app.db.session import SessionLocal
    db = SessionLocal()
    
    try:
        user = get_user_from_token(token, db)
        user_id = user.id
        print(f"WebSocket: User {user_id} ({user.email}) connected")
        
        await manager.connect(user_id, websocket)

        try:
            while True:
                # Mantener la conexión viva, aunque no usemos el mensaje
                await websocket.receive_text()
        except WebSocketDisconnect:
            print(f"WebSocket: User {user_id} disconnected")
            manager.disconnect(user_id, websocket)
    except HTTPException as e:
        print(f"WebSocket: Authentication failed: {e.detail}")
        await websocket.close(code=1008, reason="Invalid token")
    except Exception as e:
        print(f"WebSocket: Error: {e}")
        await websocket.close(code=1011, reason="Internal error")
    finally:
        db.close()


@router.post("/send", response_model=MessageOut)
async def send_message(
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
    
    # Create notification for the receiver
    sender = db.query(User).filter(User.id == message.sender_id).first()
    receiver = db.query(User).filter(User.id == message.receiver_id).first()
    
    # Store sender info in notification message for easier retrieval
    sender_name = sender.full_name or sender.email if sender else "Usuario"
    notification_message = f"{sender_name}: {message.message}"
    
    notification = Notification(
        receiver_id=message.receiver_id,
        type="new_message",
        message=notification_message,
        ride_id=message.trip_id
    )
    db.add(notification)
    
    db.commit()
    db.refresh(message)
    
    # Get unread summary for the receiver to include in notification
    summary = None
    try:
        # Create a temporary user context to get unread summary
        unread_messages = (
            db.query(Message)
            .filter(
                Message.receiver_id == message.receiver_id,
                Message.read_at.is_(None)
            )
            .all()
        )
        
        if unread_messages:
            chats = {}
            max_message_id = 0
            
            for msg in unread_messages:
                chat_id = msg.trip_id
                if chat_id not in chats:
                    trip = db.query(Ride).filter(Ride.id == chat_id).first()
                    trip_title = ""
                    if trip:
                        trip_title = f"{trip.departure_city} → {trip.destination_city}"
                    
                    other_user_id = msg.sender_id
                    sender_user = db.query(User).filter(User.id == other_user_id).first()
                    other_user_name = sender_user.full_name or sender_user.email if sender_user else "Usuario"
                    
                    chats[chat_id] = {
                        "chat_id": chat_id,
                        "unread_count": 0,
                        "last_message_id": 0,
                        "trip_title": trip_title,
                        "other_user_name": other_user_name,
                        "other_user_id": other_user_id
                    }
                
                c = chats[chat_id]
                c["unread_count"] += 1
                if msg.id > c["last_message_id"]:
                    c["last_message_id"] = msg.id
                if msg.id > max_message_id:
                    max_message_id = msg.id
            
            summary = {
                "total_unread": sum(c["unread_count"] for c in chats.values()),
                "max_message_id": max_message_id,
                "chats": list(chats.values())
            }
    except Exception as e:
        print(f"Error building summary for notification: {e}")
    
    # Send WebSocket notification to receiver
    asyncio.create_task(
        manager.send_to_user(
            message.receiver_id,
            {
                "type": "NEW_MESSAGE",
                "message_id": message.id,
                "trip_id": message.trip_id,
                "sender_id": message.sender_id,
                "summary": summary,
            },
        )
    )
    
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


@router.get("/unread-summary")
def get_unread_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user_id = current_user.id

    # 1. Obtener mensajes 1-to-1 sin leer
    unread_messages = (
        db.query(Message)
        .filter(
            Message.receiver_id == user_id,
            Message.read_at.is_(None)
        )
        .all()
    )

    # 2. Obtener trayectos donde el usuario participa (como conductor o pasajero confirmado)
    # Como conductor
    driver_rides = db.query(Ride).filter(Ride.driver_id == user_id).all()
    ride_ids = [ride.id for ride in driver_rides]
    
    # Como pasajero confirmado
    bookings = db.query(Booking).filter(
        Booking.passenger_id == user_id,
        Booking.status == BookingStatus.confirmed
    ).all()
    ride_ids.extend([booking.ride_id for booking in bookings])
    ride_ids = list(set(ride_ids))  # Eliminar duplicados

    # 3. Obtener mensajes grupales de esos trayectos
    # Para cada trayecto, obtener el último mensaje grupal
    group_messages_by_trip = {}
    
    if ride_ids:
        # Obtener todos los mensajes grupales de los trayectos del usuario
        all_group_messages = (
            db.query(TripGroupMessage)
            .filter(TripGroupMessage.trip_id.in_(ride_ids))
            .order_by(TripGroupMessage.timestamp.desc())
            .all()
        )
        
        # Agrupar por trip_id y contar mensajes nuevos
        for msg in all_group_messages:
            if msg.trip_id not in group_messages_by_trip:
                group_messages_by_trip[msg.trip_id] = []
            group_messages_by_trip[msg.trip_id].append(msg)

    # 4. Combinar mensajes 1-to-1 y grupales
    chats = {}
    max_message_id = 0

    # Procesar mensajes 1-to-1
    for msg in unread_messages:
        chat_id = msg.trip_id

        if chat_id not in chats:
            trip = db.query(Ride).filter(Ride.id == chat_id).first()
            trip_title = ""
            if trip:
                trip_title = f"{trip.departure_city} → {trip.destination_city}"
            
            other_user_id = msg.sender_id
            sender = db.query(User).filter(User.id == other_user_id).first()
            other_user_name = sender.full_name or sender.email if sender else "Usuario"
            other_user_avatar_url = sender.avatar_url if sender else None
            
            chats[chat_id] = {
                "chat_id": chat_id,
                "other_user_id": other_user_id,
                "unread_count": 0,
                "last_message_id": 0,
                "trip_title": trip_title,
                "other_user_name": other_user_name,
                "other_user_avatar_url": other_user_avatar_url,
                "is_group_chat": False
            }

        c = chats[chat_id]
        c["unread_count"] += 1

        if msg.id > c["last_message_id"]:
            c["last_message_id"] = msg.id
        
        if msg.id > max_message_id:
            max_message_id = msg.id

    # Procesar mensajes grupales
    for trip_id, group_msgs in group_messages_by_trip.items():
        if not group_msgs:
            continue
        
        # Obtener el último mensaje (el más reciente)
        last_group_msg = group_msgs[0]  # Ya están ordenados por timestamp desc
        
        # Si el usuario es el que envió el último mensaje, no contar como no leído
        if last_group_msg.sender_id == user_id:
            continue
        
        trip = db.query(Ride).filter(Ride.id == trip_id).first()
        if not trip:
            continue
        
        trip_title = f"{trip.departure_city} → {trip.destination_city}"
        
        # Encontrar el último mensaje que el usuario envió (si existe)
        user_last_message_timestamp = None
        for msg in group_msgs:
            if msg.sender_id == user_id:
                user_last_message_timestamp = msg.timestamp
                break
        
        # Contar mensajes después del último del usuario (o todos si nunca envió)
        unread_count = 0
        last_message_id = 0
        for msg in group_msgs:
            # Si el usuario nunca envió un mensaje, contar todos los que no son suyos
            # Si envió mensajes, contar solo los posteriores a su último mensaje
            if user_last_message_timestamp is None:
                # Usuario nunca envió mensaje, contar todos los que no son suyos
                if msg.sender_id != user_id:
                    unread_count += 1
                    if msg.id > last_message_id:
                        last_message_id = msg.id
            else:
                # Contar solo mensajes posteriores al último del usuario
                if msg.timestamp > user_last_message_timestamp and msg.sender_id != user_id:
                    unread_count += 1
                    if msg.id > last_message_id:
                        last_message_id = msg.id
                elif msg.timestamp <= user_last_message_timestamp:
                    # Ya llegamos a los mensajes que el usuario vio
                    break
        
        if unread_count > 0:
            # Obtener nombre del último remitente
            last_sender = db.query(User).filter(User.id == last_group_msg.sender_id).first()
            other_user_name = last_sender.full_name or last_sender.email if last_sender else "Usuario"
            other_user_avatar_url = last_sender.avatar_url if last_sender else None
            
            if trip_id not in chats:
                chats[trip_id] = {
                    "chat_id": trip_id,
                    "other_user_id": last_group_msg.sender_id,
                    "unread_count": 0,
                    "last_message_id": 0,
                    "trip_title": trip_title,
                    "other_user_name": other_user_name,
                    "other_user_avatar_url": other_user_avatar_url,
                    "is_group_chat": True
                }
            
            c = chats[trip_id]
            c["unread_count"] += unread_count
            if last_message_id > c["last_message_id"]:
                c["last_message_id"] = last_message_id
            
            if last_message_id > max_message_id:
                max_message_id = last_message_id

    chat_list = list(chats.values())

    return {
        "total_unread": sum(c["unread_count"] for c in chat_list),
        "max_message_id": max_message_id,
        "chats": chat_list
    }


@router.post("/{chat_id}/mark-read", status_code=204)
def mark_chat_as_read(
    chat_id: int,  # This is actually trip_id
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Mark all unread messages in a chat as read.
    Updates read_at to current timestamp for all messages where:
    - receiver_id == current_user.id
    - trip_id == chat_id (using trip_id as chat_id)
    - read_at IS NULL
    """
    # Verify user can access this chat
    can_access, ride, reserved_by_user_id = _can_access_chat(db, current_user.id, chat_id)
    if not can_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chat not available"
        )
    
    # Mark all unread messages as read
    now = datetime.now(UTC)
    db.query(Message).filter(
        and_(
            Message.trip_id == chat_id,
            Message.receiver_id == current_user.id,
            Message.read_at.is_(None)
        )
    ).update({"read_at": now}, synchronize_session=False)
    
    db.commit()
    return None

