"""
Payment router for Stripe integration.
"""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Header, Request
from sqlalchemy.orm import Session
from typing import Optional, List

from app.db.session import get_db
from app.auth.router import get_current_user
from app.auth.models import User, Booking, Ride
from app.core.stripe import get_stripe_client, is_stripe_enabled
from app.core.config import settings
from app.payments.schemas import (
    SetupIntentCreateRequest,
    SetupIntentCreateResponse,
    ConfirmSetupIntentRequest,
    ConfirmSetupIntentResponse,
    PaymentOut,
    CompleteRideRequest,
    CompleteRideResponse,
    PaymentMethodOut,
    StripeConnectOnboardingRequest,
    StripeConnectOnboardingResponse,
)
from app.payments.models import Payment, PaymentStatus
from app.payments.service import get_app_commission_percent
from app.payments.test_utils import add_test_balance, is_test_mode

log = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/create-setup-intent", response_model=SetupIntentCreateResponse)
def create_setup_intent(
    request: SetupIntentCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a SetupIntent to collect payment method.
    This is called when passenger wants to save their card.
    """
    if not is_stripe_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment service is not configured"
        )
    
    try:
        stripe_client = get_stripe_client()
        if not stripe_client:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Stripe client not available"
            )
        
        # Get or create Stripe customer
        customer_id = current_user.stripe_customer_id
        if not customer_id:
            # Create Stripe customer
            import stripe
            customer = stripe.Customer.create(
                email=current_user.email,
                name=current_user.full_name or current_user.email,
                metadata={
                    "user_id": str(current_user.id),
                }
            )
            customer_id = customer.id
            
            # Save customer ID to user
            current_user.stripe_customer_id = customer_id
            db.commit()
            db.refresh(current_user)
        
        # Create SetupIntent
        import stripe
        setup_intent = stripe.SetupIntent.create(
            customer=customer_id,
            payment_method_types=["card"],
            usage="off_session",  # For future payments
        )
        
        log.info(f"Created SetupIntent {setup_intent.id} for user {current_user.id}")
        
        return SetupIntentCreateResponse(
            client_secret=setup_intent.client_secret,
            setup_intent_id=setup_intent.id
        )
        
    except Exception as e:
        import stripe
        if isinstance(e, stripe.error.StripeError):
            log.error(f"Stripe error creating SetupIntent: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Stripe error: {str(e)}"
            )
        log.error(f"Error creating SetupIntent: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create setup intent: {str(e)}"
        )


@router.post("/confirm-setup-intent", response_model=ConfirmSetupIntentResponse)
def confirm_setup_intent(
    request: ConfirmSetupIntentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Confirm SetupIntent and save payment method to user.
    Called after frontend confirms the SetupIntent.
    """
    if not is_stripe_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment service is not configured"
        )
    
    try:
        stripe_client = get_stripe_client()
        if not stripe_client:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Stripe client not available"
            )
        
        # Retrieve SetupIntent to verify status
        import stripe
        setup_intent = stripe.SetupIntent.retrieve(request.setup_intent_id)
        
        if setup_intent.status != "succeeded":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"SetupIntent not succeeded. Status: {setup_intent.status}"
            )
        
        payment_method_id = request.payment_method_id or setup_intent.payment_method
        if not payment_method_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment method ID not found"
            )
        
        customer_id = request.customer_id or setup_intent.customer
        if not customer_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Customer ID not found"
            )
        
        # Attach payment method to customer if not already attached
        try:
            stripe.PaymentMethod.attach(
                payment_method_id,
                customer=customer_id,
            )
        except stripe.error.StripeError as e:
            # Payment method might already be attached, that's OK
            if "already been attached" not in str(e):
                raise
        
        # Set as default payment method
        stripe.Customer.modify(
            customer_id,
            invoice_settings={
                "default_payment_method": payment_method_id
            }
        )
        
        # Save to user
        current_user.stripe_customer_id = customer_id
        current_user.stripe_payment_method_id = payment_method_id
        db.commit()
        db.refresh(current_user)
        
        log.info(f"Saved payment method {payment_method_id} for user {current_user.id}")
        
        return ConfirmSetupIntentResponse(
            success=True,
            customer_id=customer_id,
            payment_method_id=payment_method_id
        )
        
    except Exception as e:
        import stripe
        if isinstance(e, stripe.error.StripeError):
            log.error(f"Stripe error confirming SetupIntent: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Stripe error: {str(e)}"
            )
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error confirming SetupIntent: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to confirm setup intent: {str(e)}"
        )


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
    stripe_signature: str = Header(None, alias="stripe-signature"),
):
    """
    Stripe webhook endpoint to handle payment events.
    """
    if not is_stripe_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment service is not configured"
        )
    
    webhook_secret = getattr(settings, "stripe_webhook_secret", None)
    if not webhook_secret:
        log.warning("STRIPE_WEBHOOK_SECRET not configured, webhook verification disabled")
    
    try:
        body = await request.body()
        import stripe
        
        if not stripe.api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Stripe client not available"
            )
        
        # Verify webhook signature
        if webhook_secret:
            try:
                event = stripe.Webhook.construct_event(
                    body, stripe_signature, webhook_secret
                )
            except ValueError as e:
                log.error(f"Invalid payload: {e}")
                raise HTTPException(status_code=400, detail="Invalid payload")
            except stripe.error.SignatureVerificationError as e:
                log.error(f"Invalid signature: {e}")
                raise HTTPException(status_code=400, detail="Invalid signature")
        else:
            # Development mode: parse without verification
            import json
            event = json.loads(body)
        
        # Handle the event
        event_type = event.get("type")
        event_data = event.get("data", {}).get("object", {})
        
        log.info(f"Received Stripe webhook: {event_type}")
        
        if event_type == "payment_intent.succeeded":
            payment_intent_id = event_data.get("id")
            payment = db.query(Payment).filter(
                Payment.stripe_payment_intent_id == payment_intent_id
            ).first()
            if payment:
                payment.status = PaymentStatus.succeeded
                db.commit()
                log.info(f"Updated payment {payment.id} status to succeeded")
        
        elif event_type == "payment_intent.canceled":
            payment_intent_id = event_data.get("id")
            payment = db.query(Payment).filter(
                Payment.stripe_payment_intent_id == payment_intent_id
            ).first()
            if payment:
                payment.status = PaymentStatus.canceled
                db.commit()
                log.info(f"Updated payment {payment.id} status to canceled")
        
        elif event_type == "payment_intent.payment_failed":
            payment_intent_id = event_data.get("id")
            payment = db.query(Payment).filter(
                Payment.stripe_payment_intent_id == payment_intent_id
            ).first()
            if payment:
                payment.status = PaymentStatus.requires_payment_method
                db.commit()
                log.info(f"Updated payment {payment.id} status to requires_payment_method")
        
        return {"status": "success"}
        
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error processing webhook: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Webhook processing failed: {str(e)}"
        )


@router.get("/methods", response_model=List[PaymentMethodOut])
def list_payment_methods(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all payment methods for the current user.
    """
    if not is_stripe_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment service is not configured"
        )
    
    if not current_user.stripe_customer_id:
        return []
    
    try:
        import stripe
        
        # List all payment methods for this customer
        payment_methods = stripe.PaymentMethod.list(
            customer=current_user.stripe_customer_id,
            type="card",
        )
        
        # Get default payment method
        customer = stripe.Customer.retrieve(current_user.stripe_customer_id)
        default_payment_method_id = customer.invoice_settings.default_payment_method
        
        result = []
        for pm in payment_methods.data:
            result.append(PaymentMethodOut(
                id=pm.id,
                type=pm.type,
                card=pm.card if hasattr(pm, 'card') else None,
                is_default=pm.id == default_payment_method_id,
                created=pm.created,
            ))
        
        return result
        
    except Exception as e:
        log.error(f"Error listing payment methods: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list payment methods: {str(e)}"
        )


@router.delete("/method/{payment_method_id}")
def delete_payment_method(
    payment_method_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a payment method. If it's the default, removes it from user.
    """
    if not is_stripe_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment service is not configured"
        )
    
    if not current_user.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No payment methods found"
        )
    
    try:
        import stripe
        
        # Verify payment method belongs to this customer
        pm = stripe.PaymentMethod.retrieve(payment_method_id)
        if pm.customer != current_user.stripe_customer_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Payment method does not belong to this user"
            )
        
        # Detach payment method from customer (this effectively deletes it)
        stripe.PaymentMethod.detach(payment_method_id)
        
        # If this was the default payment method, clear it from user
        if current_user.stripe_payment_method_id == payment_method_id:
            current_user.stripe_payment_method_id = None
            db.commit()
            db.refresh(current_user)
            
            # Clear default in Stripe customer
            stripe.Customer.modify(
                current_user.stripe_customer_id,
                invoice_settings={"default_payment_method": None}
            )
        
        log.info(f"Deleted payment method {payment_method_id} for user {current_user.id}")
        
        return {"success": True, "message": "Payment method deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error deleting payment method: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete payment method: {str(e)}"
        )


@router.post("/connect/onboarding", response_model=StripeConnectOnboardingResponse)
def stripe_connect_onboarding(
    request: StripeConnectOnboardingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a Stripe Connect account for a driver with their bank details.
    This uses Custom Connect with invisible onboarding.
    """
    if not is_stripe_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment service is not configured"
        )
    
    # Check if user already has a Stripe Connect account
    if current_user.stripe_account_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already has a Stripe Connect account"
        )
    
    try:
        import stripe
        
        # Create Stripe Connect Custom account
        individual_data = {
            "first_name": request.first_name,
            "last_name": request.last_name,
            "dob": {
                "day": request.dob_day,
                "month": request.dob_month,
                "year": request.dob_year,
            },
            "id_number": request.id_number,  # DNI/NIE
            "email": current_user.email,
            "address": {
                "line1": request.address_line1,
                "city": request.address_city,
                "postal_code": request.address_postal_code,
                "country": "ES",
            },
        }
        
        # Add phone if provided
        if request.phone:
            individual_data["phone"] = request.phone
        
        account = stripe.Account.create(
            type="custom",
            country="ES",  # Spain
            email=current_user.email,
            capabilities={
                "transfers": {"requested": True},
            },
            business_type="individual",
            individual=individual_data,
            business_profile={
                "url": "https://unigo.app",  # Required by Stripe
                "mcc": "4121",  # MCC for taxi/rideshare services
            },
            external_account={
                "object": "bank_account",
                "country": "ES",
                "currency": "eur",
                "account_number": request.iban,
            },
            tos_acceptance={
                "date": int(datetime.now(timezone.utc).timestamp()),
                "ip": "127.0.0.1",  # You should pass the real IP from the request
            },
            metadata={
                "user_id": str(current_user.id),
                "email": current_user.email,
            }
        )
        
        # Save account ID to user
        current_user.stripe_account_id = account.id
        db.commit()
        db.refresh(current_user)
        
        log.info(f"Created Stripe Connect account {account.id} for user {current_user.id}")
        
        return StripeConnectOnboardingResponse(
            success=True,
            message="Cuenta bancaria configurada correctamente",
            stripe_account_id=account.id
        )
        
    except stripe.error.StripeError as e:
        log.error(f"Stripe error creating Connect account: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error de Stripe: {str(e)}"
        )
    except Exception as e:
        log.error(f"Error creating Connect account: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create Connect account: {str(e)}"
        )


# ============================================================================
# TEMPORARY TEST ENDPOINT - REMOVE IN PRODUCTION
# ============================================================================

@router.post("/test/add-funds")
def add_test_funds(
    amount_eur: Optional[float] = 50.0,
    current_user: User = Depends(get_current_user),
):
    """
    **TEMPORARY ENDPOINT FOR TESTING ONLY**
    
    Adds funds to the platform's Stripe test balance using the special
    `tok_bypassPending` token. This allows testing Transfers without waiting
    for payments to settle.
    
    This endpoint:
    - Only works in test mode (sk_test_*)
    - Should be removed before going to production
    - Adds funds directly to the platform's available balance
    
    Args:
        amount_eur: Amount to add in euros (default: 50.0)
    
    Returns:
        JSON with charge details and new balance
    
    Raises:
        403: If not in test mode
        503: If Stripe is not configured
    """
    if not is_stripe_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe is not configured"
        )
    
    if not is_test_mode():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint can only be used in test mode"
        )
    
    # Validate amount
    if amount_eur <= 0 or amount_eur > 10000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Amount must be between 0.01 and 10000 EUR"
        )
    
    amount_cents = int(amount_eur * 100)
    
    try:
        log.info(f"[TEST ENDPOINT] User {current_user.id} requested to add {amount_eur}€ to test balance")
        
        result = add_test_balance(amount_cents)
        
        log.info(f"[TEST ENDPOINT] ✅ Successfully added {amount_eur}€ to test balance")
        
        return {
            "success": True,
            "message": f"Successfully added €{amount_eur} to test balance",
            "details": result
        }
        
    except ValueError as e:
        log.error(f"[TEST ENDPOINT] Validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        log.error(f"[TEST ENDPOINT] Error adding test funds: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add test funds: {str(e)}"
        )

