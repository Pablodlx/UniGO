"""
Service functions for booking operations.
"""
import logging
from sqlalchemy.orm import Session
from typing import Optional, Any

from app.auth.models import Booking, BookingStatus, Ride, User, Notification
from app.core.email import send_passenger_cancellation_email_sync
from app.notifications.utils import create_notification

log = logging.getLogger(__name__)


def cancel_booking_from_passenger(
    db: Session,
    booking: Booking,
    reason: str = "",
    final_status: BookingStatus = BookingStatus.canceled,
    background_tasks: Optional[Any] = None,
) -> None:
    """
    Centralized function to cancel a booking from passenger side.
    
    This function handles ALL aspects of canceling a booking:
    - Updates booking status to canceled (or specified final_status)
    - Restores available seats if booking was confirmed
    - Creates notification for the driver
    - Sends email to the driver
    - Commits changes to database
    
    Args:
        db: Database session
        booking: The Booking object to cancel
        reason: Optional reason for cancellation (for logging/notifications)
        final_status: Final status to set (default: canceled). 
                     Use BookingStatus.rejected if needed for specific cases.
        background_tasks: Optional BackgroundTasks instance. If provided, email will be
                         sent as a background task. If None, email is sent synchronously.
    
    Raises:
        Exception: If any step fails, the transaction is rolled back
    """
    try:
        # Get the ride
        ride = booking.ride
        if not ride:
            log.error(f"[CANCEL BOOKING] Ride not found for booking {booking.id}")
            return
        
        # Check if booking was confirmed (to restore seats and notify driver)
        was_confirmed = booking.status == BookingStatus.confirmed
        
        # Update booking status
        booking.status = final_status
        
        # Restore available seats (only if it was confirmed)
        if was_confirmed:
            ride.available_seats += booking.seats
            
            # Get passenger user for notification and email
            passenger = db.query(User).filter(User.id == booking.passenger_id).first()
            passenger_name = (
                passenger.full_name if passenger and passenger.full_name 
                else (passenger.email if passenger else "Un pasajero")
            )
            
            # Get driver user for email
            driver = db.query(User).filter(User.id == ride.driver_id).first()
            if not driver:
                log.error(f"[CANCEL BOOKING] Driver not found for ride {ride.id}")
                return
            
            # Create notification for the driver
            notification_message = (
                f"El pasajero {passenger_name} "
                f"ha cancelado su reserva para el viaje "
                f"{ride.departure_city} → {ride.destination_city}."
            )
            
            # Add reason to message if provided
            if reason:
                notification_message += f" {reason}"
            
            notification = create_notification(
                db=db,
                receiver_id=ride.driver_id,
                type="booking_cancelled",
                message=notification_message,
                ride_id=ride.id,
            )
            db.add(notification)
            
            # Commit first to ensure data is saved before sending email
            db.commit()
            db.refresh(ride)
            db.refresh(booking)
            db.refresh(notification)
            
            # Send email to driver (after successful commit)
            try:
                # Format date in Spanish
                departure_date_formatted = ride.departure_date.strftime("%d de %B de %Y")
                months_es = {
                    "January": "enero", "February": "febrero", "March": "marzo",
                    "April": "abril", "May": "mayo", "June": "junio",
                    "July": "julio", "August": "agosto", "September": "septiembre",
                    "October": "octubre", "November": "noviembre", "December": "diciembre"
                }
                for en, es in months_es.items():
                    departure_date_formatted = departure_date_formatted.replace(en, es)
                
                driver_name = driver.full_name if driver.full_name else driver.email
                
                log.info(
                    f"[CANCEL BOOKING] [EMAIL] Enviando email de cancelación de reserva a {driver.email} "
                    f"para booking {booking.id}"
                )
                
                # Send email: use background_tasks if provided, otherwise send synchronously
                if background_tasks is not None:
                    # Use background task to avoid blocking HTTP response
                    background_tasks.add_task(
                        send_passenger_cancellation_email_sync,
                        to_email=driver.email,
                        driver_name=driver_name,
                        passenger_name=passenger_name,
                        departure_city=ride.departure_city,
                        destination_city=ride.destination_city,
                        departure_date=departure_date_formatted,
                        departure_time=ride.departure_time,
                        trip_id=ride.id,
                    )
                    log.info(
                        f"[CANCEL BOOKING] [EMAIL] ✅ Tarea de email añadida a background_tasks para {driver.email}"
                    )
                else:
                    # Send email synchronously (using the sync wrapper)
                    send_passenger_cancellation_email_sync(
                        to_email=driver.email,
                        driver_name=driver_name,
                        passenger_name=passenger_name,
                        departure_city=ride.departure_city,
                        destination_city=ride.destination_city,
                        departure_date=departure_date_formatted,
                        departure_time=ride.departure_time,
                        trip_id=ride.id,
                    )
                    log.info(
                        f"[CANCEL BOOKING] [EMAIL] ✅ Email de cancelación enviado exitosamente a {driver.email}"
                    )
            except Exception as e:
                # Don't fail the cancellation if email fails, just log
                log.error(
                    f"[CANCEL BOOKING] [EMAIL] ❌ Error al enviar email de cancelación: {str(e)}",
                    exc_info=True
                )
        else:
            # Booking was not confirmed, just update status and commit
            db.commit()
            db.refresh(booking)
        
        log.info(
            f"[CANCEL BOOKING] ✅ Booking {booking.id} cancelado exitosamente "
            f"(estado: {final_status.value}, era confirmada: {was_confirmed})"
        )
        
    except Exception as e:
        db.rollback()
        log.error(
            f"[CANCEL BOOKING] ❌ Error al cancelar booking {booking.id}: {str(e)}",
            exc_info=True
        )
        raise

