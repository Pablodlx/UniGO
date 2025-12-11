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
    
    Rules:
    - If cancellation is MORE than 24 hours before departure: 0% (no penalty)
    - If cancellation is WITHIN 24 hours before departure: 100% (full penalty)
    
    Returns:
        Penalty percentage (0.0 or 1.0)
    """
    if hours_before > 24:
        return 0.0  # No penalty if more than 24h before
    else:
        return 1.0  # 100% penalty if within 24h


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
    
    # Calculate penalty amount (100% of trip price when within 24h)
    penalty_cents = int(payment.amount_cents * penalty_percent)
    
    # When penalty_percent is 1.0 (100%), penalty_cents should equal payment.amount_cents
    # No refund needed since we're charging 100%
    
    try:
        import stripe
        if not stripe.api_key:
            return None, "Stripe not configured"
        
        # Capture the full penalty amount (100% of trip price)
        pi = stripe.PaymentIntent.retrieve(payment.stripe_payment_intent_id)
        
        if pi.status == "requires_capture":
            # Capture full penalty amount (100% of trip price)
            captured_pi = stripe.PaymentIntent.capture(
                payment.stripe_payment_intent_id,
                amount_to_capture=penalty_cents
            )
            
            # Calculate driver amount: 85% of the amount charged
            # The platform keeps 15% (app_fee_cents)
            driver_amount_cents = int(penalty_cents * 0.85)
            app_fee_cents = penalty_cents - driver_amount_cents
            
            payment.status = PaymentStatus.succeeded
            payment.penalty_cents = penalty_cents
            payment.app_fee_cents = app_fee_cents
            payment.driver_amount_cents = driver_amount_cents
            payment.captured_at = datetime.now(timezone.utc)
            db.commit()
            log.info(f"Captured penalty {penalty_cents} cents (100% of trip) for booking {booking.id}")
            log.info(f"Driver will receive {driver_amount_cents} cents (85% of {penalty_cents} cents)")
            log.info(f"Platform fee: {app_fee_cents} cents (15% of {penalty_cents} cents)")
            
            # TRANSFER TO DRIVER (Stripe Connect) - Only for cancellations within 24h
            # After capturing the penalty, transfer the driver's portion to their Connect account
            try:
                driver = db.query(User).filter(User.id == ride.driver_id).first()
                
                if driver and driver.stripe_account_id:
                    driver_amount_cents = payment.driver_amount_cents
                    
                    log.info(f"[CANCEL PENALTY] [TRANSFER] Starting transfer for driver {ride.driver_id}")
                    log.info(f"[CANCEL PENALTY] [TRANSFER] Driver stripe_account_id: {driver.stripe_account_id}")
                    log.info(f"[CANCEL PENALTY] [TRANSFER] Amount to transfer: {driver_amount_cents} cents")
                    
                    # Verify account status before creating transfer
                    try:
                        account = stripe.Account.retrieve(driver.stripe_account_id)
                        log.info(f"[CANCEL PENALTY] [TRANSFER] Account status: {account.id}")
                        
                        if account.capabilities.get('transfers') != 'active':
                            log.warning(
                                f"[CANCEL PENALTY] [TRANSFER] Account {driver.stripe_account_id} transfers capability "
                                f"is not active: {account.capabilities.get('transfers')}"
                            )
                    except Exception as account_error:
                        log.error(f"[CANCEL PENALTY] [TRANSFER] Error retrieving account: {account_error}")
                    
                    # Create transfer to driver's Connect account
                    log.info(f"[CANCEL PENALTY] [TRANSFER] Creating transfer...")
                    transfer = stripe.Transfer.create(
                        amount=driver_amount_cents,
                        currency="eur",
                        destination=driver.stripe_account_id,
                        transfer_group=f"trip_{ride.id}_cancel_penalty",
                        metadata={
                            "ride_id": str(ride.id),
                            "booking_id": str(booking.id),
                            "driver_id": str(driver.id),
                            "payment_id": str(payment.id),
                            "type": "cancellation_penalty",
                        }
                    )
                    log.info(f"[CANCEL PENALTY] [TRANSFER] ✅ Transfer created successfully!")
                    log.info(f"[CANCEL PENALTY] [TRANSFER] Transfer ID: {transfer.id}")
                    log.info(f"[CANCEL PENALTY] [TRANSFER] Transfer amount: {transfer.amount} cents")
                    log.info(f"[CANCEL PENALTY] [TRANSFER] Transfer destination: {transfer.destination}")
                else:
                    log.warning(
                        f"[CANCEL PENALTY] [TRANSFER] Cannot create transfer: "
                        f"driver={driver is not None}, stripe_account_id={driver.stripe_account_id if driver else 'N/A'}"
                    )
            except stripe.error.StripeError as stripe_error:
                log.error(
                    f"[CANCEL PENALTY] [TRANSFER] ❌ Stripe error creating transfer: {stripe_error}",
                    exc_info=True
                )
                # Don't fail the cancellation if transfer fails, just log the error
            except Exception as transfer_error:
                log.error(
                    f"[CANCEL PENALTY] [TRANSFER] ❌ Error creating transfer: {transfer_error}",
                    exc_info=True
                )
                # Don't fail the cancellation if transfer fails, just log the error
        else:
            log.warning(f"PaymentIntent {payment.stripe_payment_intent_id} status is {pi.status}, cannot capture penalty")
            return None, f"Payment status is {pi.status}"
            
    except Exception as e:
        log.error(f"Error capturing penalty: {e}")
        db.rollback()
        return None, str(e)
    
    return penalty_cents, None

