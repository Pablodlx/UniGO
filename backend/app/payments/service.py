"""
Payment service for handling Stripe payments.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.stripe import get_stripe_client, is_stripe_enabled
from app.core.config import settings
from app.payments.models import Payment, PaymentStatus
from app.auth.models import Booking, Ride, User

log = logging.getLogger(__name__)


def calculate_penalty_percent(hours_before: float) -> float:
    """
    Calculate penalty percentage based on hours before departure.
    
    Returns:
        Penalty percentage (0.0 to 1.0)
    """
    if hours_before > 24:
        return 0.0
    elif hours_before >= 12:
        return 0.30
    elif hours_before >= 6:
        return 0.50
    else:
        return 0.80


def calculate_hours_before_departure(ride: Ride) -> Optional[float]:
    """Calculate hours until departure"""
    try:
        from app.rides.service import calculate_departure_datetime
        departure_datetime = calculate_departure_datetime(ride)
        now = datetime.now(timezone.utc)
        delta = departure_datetime - now
        hours = delta.total_seconds() / 3600.0
        return hours
    except Exception as e:
        log.error(f"Error calculating hours before departure: {e}", exc_info=True)
        return None


def get_app_commission_percent() -> float:
    """Get app commission percentage from settings"""
    return float(getattr(settings, "app_commission_percent", 15)) / 100.0


def handle_passenger_cancellation(
    db: Session,
    booking: Booking,
    ride: Ride,
    payment: Optional[Payment]
) -> Tuple[Optional[int], Optional[str]]:
    """
    Handle passenger cancellation with penalty calculation.
    
    Args:
        db: Database session
        booking: Booking being cancelled
        ride: Associated ride
        payment: Payment record if exists
        
    Returns:
        Tuple of (penalty_cents, error_message)
    """
    if not payment or not payment.stripe_payment_intent_id:
        log.info(f"No payment found for booking {booking.id}, no penalty to apply")
        return None, None
    
    hours_before = calculate_hours_before_departure(ride)
    if hours_before is None:
        return None, "Could not calculate time until departure"
    
    penalty_percent = calculate_penalty_percent(hours_before)
    
    if penalty_percent == 0.0:
        # Cancel PaymentIntent (no penalty)
        try:
            import stripe
            if stripe.api_key:
                stripe.PaymentIntent.cancel(payment.stripe_payment_intent_id)
                payment.status = PaymentStatus.canceled
                db.commit()
                log.info(f"PaymentIntent {payment.stripe_payment_intent_id} canceled (no penalty)")
        except Exception as e:
            log.error(f"Error canceling PaymentIntent: {e}")
            return None, str(e)
        return 0, None
    
    # Calculate penalty amount
    penalty_cents = int(payment.amount_cents * penalty_percent)
    refund_cents = payment.amount_cents - penalty_cents
    
    try:
        import stripe
        if not stripe.api_key:
            return None, "Stripe not configured"
        
        # Capture only the penalty, refund the rest
        pi = stripe.PaymentIntent.retrieve(payment.stripe_payment_intent_id)
        
        if pi.status == "requires_capture":
            # Capture penalty amount
            stripe.PaymentIntent.capture(
                payment.stripe_payment_intent_id,
                amount_to_capture=penalty_cents
            )
            payment.status = PaymentStatus.succeeded
            payment.penalty_cents = penalty_cents
            payment.app_fee_cents = int(penalty_cents * get_app_commission_percent())
            payment.driver_amount_cents = penalty_cents - payment.app_fee_cents
            payment.captured_at = datetime.now(timezone.utc)
            db.commit()
            log.info(f"Captured penalty {penalty_cents} cents for booking {booking.id}")
        else:
            log.warning(f"PaymentIntent {payment.stripe_payment_intent_id} status is {pi.status}, cannot capture penalty")
            return None, f"Payment status is {pi.status}"
            
    except Exception as e:
        log.error(f"Error capturing penalty: {e}")
        db.rollback()
        return None, str(e)
    
    return penalty_cents, None

