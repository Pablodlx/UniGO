from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from typing import List
from pydantic import BaseModel
from datetime import datetime, UTC

from app.db.session import get_db
from app.auth.models import User, Ride, Booking, BookingStatus, Rating, Message, Notification
from app.auth.router import get_current_user

router = APIRouter(prefix="/bookings", tags=["bookings"])


class PendingRequestInfo(BaseModel):
    booking_id: int
    passenger_id: int
    passenger_name: str
    passenger_rating: float | None
    passenger_avatar_url: str | None
    seats: int

    class Config:
        from_attributes = True


class PendingRideInfo(BaseModel):
    ride_id: int
    ride_title: str
    date: str
    requests: List[PendingRequestInfo]


class PendingSummaryRide(BaseModel):
    ride_id: int
    ride_title: str
    pending_count: int


class PendingSummaryResponse(BaseModel):
    total_pending: int
    rides: List[PendingSummaryRide]


@router.get("/pending-for-driver", response_model=List[PendingRideInfo])
def get_pending_bookings_for_driver(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all pending booking requests for rides where the current user is the driver.
    Returns list grouped by ride.
    """
    # Find all rides where current_user is the driver
    driver_rides = db.query(Ride).filter(Ride.driver_id == current_user.id).all()
    ride_ids = [ride.id for ride in driver_rides]
    
    if not ride_ids:
        return []
    
    # Get all pending bookings for these rides
    pending_bookings = (
        db.query(Booking)
        .filter(
            and_(
                Booking.ride_id.in_(ride_ids),
                Booking.status == BookingStatus.pending
            )
        )
        .all()
    )
    
    if not pending_bookings:
        return []
    
    # Group by ride_id
    bookings_by_ride = {}
    for booking in pending_bookings:
        if booking.ride_id not in bookings_by_ride:
            bookings_by_ride[booking.ride_id] = []
        bookings_by_ride[booking.ride_id].append(booking)
    
    # Build response
    result = []
    for ride_id, bookings in bookings_by_ride.items():
        ride = db.query(Ride).filter(Ride.id == ride_id).first()
        if not ride:
            continue
        
        ride_title = f"{ride.departure_city} → {ride.destination_city}"
        
        requests = []
        for booking in bookings:
            passenger = db.query(User).filter(User.id == booking.passenger_id).first()
            if not passenger:
                continue
            
            # Calculate passenger rating
            rating = None
            try:
                avg_result = (
                    db.query(func.avg(Rating.rating))
                    .filter(Rating.rated_id == passenger.id)
                    .scalar()
                )
                if avg_result is not None:
                    rating = round(float(avg_result), 1)
            except Exception:
                rating = None
            
            requests.append(
                PendingRequestInfo(
                    booking_id=booking.id,
                    passenger_id=passenger.id,
                    passenger_name=passenger.full_name or passenger.email or "Unknown",
                    passenger_rating=rating,
                    passenger_avatar_url=getattr(passenger, "avatar_url", None),
                    seats=booking.seats,
                )
            )
        
        if requests:
            result.append(
                PendingRideInfo(
                    ride_id=ride_id,
                    ride_title=ride_title,
                    date=ride.departure_date.isoformat(),
                    requests=requests,
                )
            )
    
    return result


@router.get("/pending-summary", response_model=PendingSummaryResponse)
def get_pending_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get summary of pending booking requests for the driver.
    Used for the notification banner.
    """
    # Find all rides where current_user is the driver
    driver_rides = db.query(Ride).filter(Ride.driver_id == current_user.id).all()
    ride_ids = [ride.id for ride in driver_rides]
    
    if not ride_ids:
        return PendingSummaryResponse(total_pending=0, rides=[])
    
    # Get all pending bookings for these rides
    pending_bookings = (
        db.query(Booking)
        .filter(
            and_(
                Booking.ride_id.in_(ride_ids),
                Booking.status == BookingStatus.pending
            )
        )
        .all()
    )
    
    # Group by ride_id and count
    bookings_by_ride = {}
    for booking in pending_bookings:
        if booking.ride_id not in bookings_by_ride:
            bookings_by_ride[booking.ride_id] = 0
        bookings_by_ride[booking.ride_id] += 1
    
    # Build response
    rides = []
    total_pending = len(pending_bookings)
    
    for ride_id, count in bookings_by_ride.items():
        ride = db.query(Ride).filter(Ride.id == ride_id).first()
        if not ride:
            continue
        
        ride_title = f"{ride.departure_city} → {ride.destination_city}"
        rides.append(
            PendingSummaryRide(
                ride_id=ride_id,
                ride_title=ride_title,
                pending_count=count,
            )
        )
    
    return PendingSummaryResponse(total_pending=total_pending, rides=rides)


@router.post("/{booking_id}/accept")
def accept_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accept a pending booking request.
    Only the driver of the ride can accept.
    This will:
    - Change booking status to confirmed
    - Decrease available_seats in the ride
    """
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    # Verify that the current user is the driver of the ride
    ride = db.query(Ride).filter(Ride.id == booking.ride_id).first()
    if not ride:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ride not found"
        )
    
    if ride.driver_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the driver can accept booking requests"
        )
    
    # Verify booking is in pending status
    if booking.status != BookingStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Booking is not in pending status (current: {booking.status})"
        )
    
    # Verify there are enough available seats
    if ride.available_seats < booking.seats:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Not enough available seats"
        )
    
    try:
        # Update booking status to confirmed
        booking.status = BookingStatus.confirmed
        
        # Decrease available seats
        ride.available_seats -= booking.seats
        
        # Crear mensaje automático para notificación al pasajero
        # Este mensaje será detectado por GET /api/chat/unread-summary
        # porque cumple: receiver_id == passenger_id, read_at IS NULL, trip_id == ride.id
        system_message = Message(
            trip_id=ride.id,                        # debe coincidir EXACTAMENTE
            sender_id=ride.driver_id,               # el conductor envía el mensaje
            receiver_id=booking.passenger_id,       # el pasajero recibe la notificación
            message="Tu reserva ha sido CONFIRMADA por el conductor."
            # read_at queda NULL automáticamente (por defecto en el modelo)
        )
        db.add(system_message)
        
        # Crear notificación para el pasajero
        notification = Notification(
            receiver_id=booking.passenger_id,
            type="booking_update",
            ride_id=ride.id,
            message=f"Tu reserva para el viaje {ride.departure_city} → {ride.destination_city} ha sido ACEPTADA.",
        )
        db.add(notification)
        
        db.commit()
        db.refresh(ride)
        db.refresh(booking)
        db.refresh(system_message)
        db.refresh(notification)
        
        return {
            "success": True,
            "status": "confirmed",
            "available_seats": ride.available_seats
        }
    except Exception as e:
        db.rollback()
        print(f"Error accepting booking: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to accept booking: {str(e)}"
        )


@router.post("/{booking_id}/reject")
def reject_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reject a pending booking request.
    Only the driver of the ride can reject.
    This will change booking status to rejected.
    Does NOT modify available_seats.
    """
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    # Verify that the current user is the driver of the ride
    ride = db.query(Ride).filter(Ride.id == booking.ride_id).first()
    if not ride:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ride not found"
        )
    
    if ride.driver_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the driver can reject booking requests"
        )
    
    # Verify booking is in pending status
    if booking.status != BookingStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Booking is not in pending status (current: {booking.status})"
        )
    
    try:
        # Update booking status to rejected
        booking.status = BookingStatus.rejected
        
        # Crear mensaje automático para notificación al pasajero
        # Este mensaje será detectado por GET /api/chat/unread-summary
        # porque cumple: receiver_id == passenger_id, read_at IS NULL, trip_id == ride.id
        system_message = Message(
            trip_id=ride.id,                        # debe coincidir EXACTAMENTE
            sender_id=ride.driver_id,               # el conductor envía el mensaje
            receiver_id=booking.passenger_id,       # el pasajero recibe la notificación
            message=f"Tu solicitud de reserva para el viaje {ride.departure_city} → {ride.destination_city} ha sido rechazada."
            # read_at queda NULL automáticamente (por defecto en el modelo)
        )
        db.add(system_message)
        
        # Crear notificación para el pasajero
        notification = Notification(
            receiver_id=booking.passenger_id,
            type="booking_update",
            ride_id=ride.id,
            message=f"Tu reserva para el viaje {ride.departure_city} → {ride.destination_city} ha sido RECHAZADA.",
        )
        db.add(notification)
        
        db.commit()
        db.refresh(booking)
        db.refresh(system_message)
        db.refresh(notification)
        
        # If this was an automatic booking (from a search alert), 
        # re-trigger search for the passenger's active alerts to find other matching trips
        try:
            from app.rides.service import retry_search_for_rejected_auto_booking
            retry_search_for_rejected_auto_booking(db, booking.passenger_id, ride.id)
        except Exception as e:
            print(f"Error retrying search for rejected auto-booking: {e}")
            import traceback
            traceback.print_exc()
            # Don't fail the rejection if this fails
        
        return {
            "success": True,
            "status": "rejected"
        }
    except Exception as e:
        db.rollback()
        print(f"Error rejecting booking: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reject booking: {str(e)}"
        )

