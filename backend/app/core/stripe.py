"""
Stripe client and configuration.
"""
import stripe
import logging
from typing import Optional

from app.core.config import settings

log = logging.getLogger(__name__)

# Initialize Stripe with secret key from settings
stripe.api_key = getattr(settings, "stripe_secret_key", None)

if not stripe.api_key:
    log.warning("STRIPE_SECRET_KEY not set. Stripe functionality will be disabled.")

def get_stripe_client():
    """Get Stripe client instance"""
    if not stripe.api_key:
        return None
    return stripe

def is_stripe_enabled() -> bool:
    """Check if Stripe is configured"""
    return bool(stripe.api_key)

