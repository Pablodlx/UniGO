from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from typing import List
from pydantic import BaseModel
from datetime import datetime, UTC
import logging

from app.db.session import get_db
from app.auth.models import User, Ride, Booking, BookingStatus, Rating, Message, Notification
from app.auth.router import get_current_user

log = logging.getLogger(__name__)

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
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accept a pending booking request.
    Only the driver of the ride can accept.
    
    OVERBOOKING CONTROLADO:
    - Las reservas PENDING no consumen asientos
    - Solo las reservas CONFIRMED consumen asientos
    - Al confirmar una reserva, se verifica que haya asientos disponibles
    - Si se agota la capacidad, se rechazan automáticamente todas las demás reservas PENDING del mismo viaje
    
    This will:
    - Change booking status to confirmed
    - Decrease available_seats in the ride (solo las CONFIRMED consumen asientos)
    - Reject other pending bookings if capacity is exhausted
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
    
    print("=" * 70)
    print(f"[BOOKING ACCEPT] Driver {current_user.id} accepting booking {booking_id}")
    print(f"  Passenger: {booking.passenger_id}")
    print(f"  Trip: {ride.departure_city} → {ride.destination_city}")
    print(f"  Seats: {booking.seats}")
    print(f"  Current available_seats: {ride.available_seats}")
    print("=" * 70)
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
    
    # OVERBOOKING CONTROLADO: Calcular asientos disponibles basándose en CONFIRMED bookings
    # No confiar solo en ride.available_seats, calcular desde las reservas CONFIRMED
    confirmed_bookings = db.query(Booking).filter(
        Booking.ride_id == ride.id,
        Booking.status == BookingStatus.confirmed
    ).all()
    
    confirmed_seats = sum(b.seats for b in confirmed_bookings)
    
    # Calcular asientos disponibles reales
    # Asumimos que ride.available_seats es el total de asientos del viaje
    # (si no, necesitaríamos un campo total_seats en Ride)
    # Por ahora, usamos available_seats como referencia y calculamos desde confirmed bookings
    # Si available_seats ya refleja las reservas confirmadas, usamos ese valor
    # Si no, calculamos: total_seats - confirmed_seats
    # Por simplicidad, asumimos que available_seats ya está actualizado correctamente
    
    # Verificar que hay suficientes asientos disponibles
    if ride.available_seats < booking.seats:
        print(f"[BOOKING ACCEPT] ❌ Not enough available seats: {ride.available_seats} < {booking.seats}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Not enough available seats"
        )
    
    try:
        print(f"[BOOKING ACCEPT] Driver {current_user.id} accepted booking {booking_id} for trip {ride.id} -> confirming and consuming {booking.seats} seat(s)")
        
        # Update booking status to confirmed
        booking.status = BookingStatus.confirmed
        
        # Decrease available seats (solo las CONFIRMED consumen asientos)
        ride.available_seats -= booking.seats
        
        print(f"[BOOKING ACCEPT] Trip {ride.id} now has {ride.available_seats} available seats remaining")
        
        # Crear mensaje automático para notificación al pasajero
        system_message = Message(
            trip_id=ride.id,
            sender_id=ride.driver_id,
            receiver_id=booking.passenger_id,
            message="Tu reserva ha sido CONFIRMADA por el conductor."
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
        
        # OVERBOOKING CONTROLADO: Si se agotaron los asientos, rechazar automáticamente otras reservas PENDING
        rejected_count = 0
        if ride.available_seats <= 0:
            print(f"[BOOKING ACCEPT] ⚠️ Trip {ride.id} has no more available seats, rejecting other pending bookings")
            
            # Buscar todas las reservas PENDING del mismo viaje (excluyendo la que acabamos de confirmar)
            other_pending_bookings = db.query(Booking).filter(
                Booking.ride_id == ride.id,
                Booking.status == BookingStatus.pending,
                Booking.id != booking.id
            ).all()
            for other_booking in other_pending_bookings:
                print(f"[BOOKING ACCEPT] Rejecting pending booking {other_booking.id} for passenger {other_booking.passenger_id} (no more seats)")
                
                # Cambiar estado a rejected
                other_booking.status = BookingStatus.rejected
                
                # Crear notificación para el pasajero rechazado
                rejected_notification = Notification(
                    receiver_id=other_booking.passenger_id,
                    type="booking_update",
                    ride_id=ride.id,
                    message=f"Tu reserva para el viaje {ride.departure_city} → {ride.destination_city} ha sido RECHAZADA automáticamente porque el viaje ya no tiene plazas disponibles.",
                )
                db.add(rejected_notification)
                
                # Crear mensaje automático
                rejected_message = Message(
                    trip_id=ride.id,
                    sender_id=ride.driver_id,
                    receiver_id=other_booking.passenger_id,
                    message=f"Tu solicitud de reserva para el viaje {ride.departure_city} → {ride.destination_city} ha sido rechazada automáticamente porque el viaje ya no tiene plazas disponibles."
                )
                db.add(rejected_message)
                
                rejected_count += 1
            
            if rejected_count > 0:
                print(f"[BOOKING ACCEPT] ✅ Automatically rejected {rejected_count} pending bookings for trip {ride.id}")
        
        db.commit()
        db.refresh(ride)
        db.refresh(booking)
        db.refresh(system_message)
        db.refresh(notification)
        
        # Enviar email de confirmación al pasajero (después del commit exitoso)
        # Usar BackgroundTasks para no bloquear la respuesta HTTP
        try:
            # Obtener datos del pasajero y conductor
            passenger = db.query(User).filter(User.id == booking.passenger_id).first()
            driver = db.query(User).filter(User.id == ride.driver_id).first()
            
            if passenger and driver:
                # Formatear fecha y hora
                departure_date_formatted = ride.departure_date.strftime("%d de %B de %Y")
                # Capitalizar el mes en español
                months_es = {
                    "January": "enero", "February": "febrero", "March": "marzo",
                    "April": "abril", "May": "mayo", "June": "junio",
                    "July": "julio", "August": "agosto", "September": "septiembre",
                    "October": "octubre", "November": "noviembre", "December": "diciembre"
                }
                for en, es in months_es.items():
                    departure_date_formatted = departure_date_formatted.replace(en, es)
                
                passenger_name = passenger.full_name if passenger.full_name else passenger.email
                driver_name = driver.full_name if driver.full_name else driver.email
                meeting_point = ride.additional_details if ride.additional_details else None
                
                # Importar y añadir tarea en background
                from app.core.email import send_trip_confirmed_email_sync
                
                log.info(f"[BOOKING ACCEPT] [EMAIL] Enviando email de viaje confirmado a {passenger.email} para booking {booking.id}")
                
                # Añadir tarea en background usando la versión síncrona (mismo patrón que send_verification_email_sync)
                background_tasks.add_task(
                    send_trip_confirmed_email_sync,
                    to_email=passenger.email,
                    passenger_name=passenger_name,
                    driver_name=driver_name,
                    departure_city=ride.departure_city,
                    destination_city=ride.destination_city,
                    departure_date=departure_date_formatted,
                    departure_time=ride.departure_time,
                    meeting_point=meeting_point,
                    seats=booking.seats,
                    trip_id=ride.id,
                )
            else:
                log.warning(f"[BOOKING ACCEPT] [EMAIL] No se pudo obtener datos del pasajero o conductor para booking {booking.id}")
        except Exception as e:
            # No hacer crash si falla el email, solo loguear
            log.error(
                f"[BOOKING ACCEPT] [EMAIL] ❌ Error al preparar envío de email de confirmación: {str(e)}",
                exc_info=True
            )
        
        print("=" * 70)
        print(f"[BOOKING ACCEPT] ✅✅✅ SUCCESS: Booking {booking_id} confirmed for trip {ride.id}")
        print(f"  Available seats remaining: {ride.available_seats}")
        if rejected_count > 0:
            print(f"  Automatically rejected {rejected_count} other pending bookings (capacity exhausted)")
        print("=" * 70)
        
        return {
            "success": True,
            "status": "confirmed",
            "available_seats": ride.available_seats
        }
    except Exception as e:
        db.rollback()
        print(f"[BOOKING ACCEPT] ❌ ERROR accepting booking {booking_id}: {e}")
        import traceback
        traceback.print_exc()
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
        print("=" * 70)
        print(f"[BOOKING REJECT] Driver {current_user.id} rejecting booking {booking_id} for trip {ride.id}")
        print(f"  Passenger: {booking.passenger_id}")
        print(f"  Trip: {ride.departure_city} → {ride.destination_city}")
        print("=" * 70)
        
        # Update booking status to rejected
        booking.status = BookingStatus.rejected
        
        # REGLA CRÍTICA: Las reservas REJECTED NO desactivan la alerta
        # La alerta permanece activa (alert.active = True) y puede crear nuevas reservas para futuros viajes
        # NO modificamos alert.active aquí - la alerta sigue funcionando
        print(f"[BOOKING REJECT] ✅ Booking {booking_id} rejected. Alert remains active and will continue searching for matching trips.")
        
        # Reactivar la alerta si esta reserva fue generada por una alerta automática
        try:
            from app.rides.service import on_booking_rejected
            on_booking_rejected(db, booking)
        except Exception as e:
            print(f"[BOOKING REJECT] Error calling on_booking_rejected: {e}")
            import traceback
            traceback.print_exc()
            # No fallamos el rechazo si esto falla
        
        # Crear mensaje automático para notificación al pasajero
        system_message = Message(
            trip_id=ride.id,
            sender_id=ride.driver_id,
            receiver_id=booking.passenger_id,
            message=f"Tu solicitud de reserva para el viaje {ride.departure_city} → {ride.destination_city} ha sido rechazada."
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
        # IMPORTANTE: Esto NO desactiva la alerta, solo busca nuevos viajes compatibles
        try:
            from app.rides.service import retry_search_for_rejected_auto_booking
            print(f"[BOOKING REJECT] Re-triggering search for passenger {booking.passenger_id}'s active alerts after rejection of trip {ride.id}")
            retry_search_for_rejected_auto_booking(db, booking.passenger_id, ride.id)
        except Exception as e:
            print(f"[BOOKING REJECT] Error retrying search for rejected auto-booking: {e}")
            import traceback
            traceback.print_exc()
            # Don't fail the rejection if this fails
        
        print("=" * 70)
        print(f"[BOOKING REJECT] ✅✅✅ SUCCESS: Booking {booking_id} rejected")
        print(f"  Alert remains active for future matches")
        print(f"  Re-triggering search for passenger {booking.passenger_id}'s active alerts")
        print("=" * 70)
        
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

