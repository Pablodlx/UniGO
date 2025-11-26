from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from typing import List
from pydantic import BaseModel

from app.db.session import get_db
from app.auth.models import User, Ride, Booking, BookingStatus, Rating
from app.auth.router import get_current_user

router = APIRouter(prefix="/rides", tags=["ride-passengers"])


class ConfirmedUserOut(BaseModel):
    id: int
    full_name: str
    rating: float | None
    avatar_url: str | None
    is_driver: bool

    class Config:
        from_attributes = True


@router.get("/{ride_id}/confirmed-users", response_model=List[ConfirmedUserOut])
def get_confirmed_users(
    ride_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtiene conductor + pasajeros confirmados de un viaje.
    Reutiliza EXACTAMENTE la lógica del chat grupal (_can_access_chat).
    """
    # Copiar la lógica exacta del chat grupal (_can_access_chat)
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride:
        return []
    
    # Chat is disabled if trip is cancelled
    if not ride.is_active:
        return []
    
    # Get all confirmed passenger IDs (lógica exacta del chat grupal)
    bookings = db.query(Booking).filter(
        and_(
            Booking.ride_id == ride_id,
            Booking.status == BookingStatus.confirmed
        )
    ).all()
    passenger_ids = [booking.passenger_id for booking in bookings]
    
    # User must be either the driver or a confirmed passenger (lógica exacta del chat grupal)
    if ride.driver_id == current_user.id:
        if len(passenger_ids) == 0:
            return []
    elif current_user.id not in passenger_ids:
        return []
    
    # Obtener todos los IDs de usuario (conductor + pasajeros)
    user_ids = [ride.driver_id]
    user_ids.extend(passenger_ids)
    user_ids = list(set(user_ids))  # Eliminar duplicados
    
    if not user_ids:
        return []
    
    # Obtener usuarios
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    
    response = []
    for u in users:
        # Calcular rating promedio (igual que en otros endpoints)
        rating = None
        try:
            avg_result = (
                db.query(func.avg(Rating.rating))
                .filter(Rating.rated_id == u.id)
                .scalar()
            )
            if avg_result is not None:
                rating = round(float(avg_result), 1)
        except Exception:
            rating = None
        
        response.append(
            ConfirmedUserOut(
                id=u.id,
                full_name=u.full_name or u.email or "Unknown",
                rating=rating,
                avatar_url=getattr(u, "avatar_url", None),
                is_driver=(u.id == ride.driver_id),
            )
        )
    
    return response


@router.delete("/{ride_id}/passengers/{user_id}")
def remove_passenger_from_ride(
    ride_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Remove a passenger from a ride by deleting their booking.
    Only the driver can use this endpoint.
    """
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride:
        return {"success": False}

    # Solo el conductor puede expulsar
    if ride.driver_id != current_user.id:
        return {"success": False}

    booking = (
        db.query(Booking)
        .filter(
            Booking.ride_id == ride_id,
            Booking.passenger_id == user_id
        )
        .first()
    )

    if not booking:
        return {"success": False}

    # Eliminar booking
    db.delete(booking)
    db.commit()

    return {"success": True}


@router.post("/{ride_id}/free-seat")
def free_seat(
    ride_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Libera un asiento del viaje aumentando available_seats en 1.
    Solo el conductor puede usar este endpoint.
    """
    ride = db.query(Ride).filter(Ride.id == ride_id).first()
    if not ride or ride.driver_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    ride.available_seats += 1
    db.commit()
    db.refresh(ride)

    return {"success": True, "available_seats": ride.available_seats}

