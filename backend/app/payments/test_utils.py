"""
Temporary utilities for testing Stripe payments in test mode.
This file should be removed in production.
"""
import stripe
from app.core.stripe import get_stripe_client, is_stripe_enabled
from app.core.config import settings
import logging

log = logging.getLogger(__name__)


def is_test_mode() -> bool:
    """Check if Stripe is in test mode"""
    import os
    stripe_key = os.getenv("STRIPE_SECRET_KEY", "")
    if not stripe_key:
        return False
    return stripe_key.startswith("sk_test_")


def add_test_balance(amount_cents: int = 5000) -> dict:
    """
    Add funds to the platform's test balance using Stripe's special token.
    
    This creates a charge that bypasses pending status and adds funds
    directly to the available balance in test mode.
    
    Args:
        amount_cents: Amount to add in cents (default: 5000 = €50)
    
    Returns:
        dict with charge details and new balance info
    
    Raises:
        ValueError: If not in test mode
        stripe.error.StripeError: If charge creation fails
    """
    if not is_stripe_enabled():
        raise ValueError("Stripe is not configured")
    
    if not is_test_mode():
        raise ValueError("This function can only be used in test mode")
    
    log.info(f"[TEST UTILS] Adding {amount_cents} cents to test balance...")
    
    try:
        # Create a charge using the special test token that bypasses pending
        # This adds funds directly to the platform's available balance
        charge = stripe.Charge.create(
            amount=amount_cents,
            currency="eur",
            source="tok_bypassPending",  # Special Stripe test token
            description=f"Test balance top-up: +€{amount_cents/100:.2f}",
            metadata={
                "purpose": "test_balance_topup",
                "environment": "test"
            }
        )
        
        log.info(f"[TEST UTILS] ✅ Charge created: {charge.id}")
        log.info(f"[TEST UTILS] Amount: {charge.amount} cents (€{charge.amount/100:.2f})")
        log.info(f"[TEST UTILS] Status: {charge.status}")
        
        # Get current balance
        try:
            balance = stripe.Balance.retrieve()
            available_balance = sum(
                item.amount for item in balance.available 
                if item.currency == "eur"
            )
            pending_balance = sum(
                item.amount for item in balance.pending 
                if item.currency == "eur"
            )
            
            log.info(f"[TEST UTILS] New available balance: {available_balance} cents (€{available_balance/100:.2f})")
            log.info(f"[TEST UTILS] Pending balance: {pending_balance} cents (€{pending_balance/100:.2f})")
            
            return {
                "success": True,
                "charge_id": charge.id,
                "amount_added_cents": charge.amount,
                "amount_added_eur": charge.amount / 100,
                "charge_status": charge.status,
                "available_balance_cents": available_balance,
                "available_balance_eur": available_balance / 100,
                "pending_balance_cents": pending_balance,
                "pending_balance_eur": pending_balance / 100,
            }
        except Exception as balance_error:
            log.warning(f"[TEST UTILS] Could not retrieve balance: {balance_error}")
            return {
                "success": True,
                "charge_id": charge.id,
                "amount_added_cents": charge.amount,
                "amount_added_eur": charge.amount / 100,
                "charge_status": charge.status,
                "balance_info": "Could not retrieve balance information"
            }
            
    except stripe.error.StripeError as e:
        log.error(f"[TEST UTILS] ❌ Stripe error: {e}")
        raise
    except Exception as e:
        log.error(f"[TEST UTILS] ❌ Unexpected error: {e}", exc_info=True)
        raise

