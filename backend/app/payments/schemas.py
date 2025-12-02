"""
Payment schemas for API requests and responses.
"""
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime


class SetupIntentCreateRequest(BaseModel):
    """Request to create a SetupIntent"""
    pass


class SetupIntentCreateResponse(BaseModel):
    """Response with SetupIntent client secret"""
    client_secret: str
    setup_intent_id: str


class ConfirmSetupIntentRequest(BaseModel):
    """Request to confirm SetupIntent and save payment method"""
    setup_intent_id: str
    payment_method_id: str
    customer_id: Optional[str] = None


class ConfirmSetupIntentResponse(BaseModel):
    """Response after confirming SetupIntent"""
    success: bool
    customer_id: str
    payment_method_id: str


class PaymentOut(BaseModel):
    """Payment response schema"""
    id: int
    booking_id: int
    stripe_customer_id: Optional[str] = None
    stripe_payment_method_id: Optional[str] = None
    stripe_payment_intent_id: Optional[str] = None
    amount_cents: int
    currency: str
    status: str
    app_fee_cents: Optional[int] = None
    driver_amount_cents: Optional[int] = None
    penalty_cents: Optional[int] = None
    driver_penalty_cents: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    captured_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class CompleteRideRequest(BaseModel):
    """Request to complete a ride and capture payment"""
    ride_id: int


class CompleteRideResponse(BaseModel):
    """Response after completing ride"""
    success: bool
    message: str
    payment_captured: bool
    app_fee_cents: Optional[int] = None
    driver_amount_cents: Optional[int] = None


class PaymentMethodOut(BaseModel):
    """Payment method response schema"""
    id: str
    type: str
    card: Optional[dict] = None  # Contains last4, brand, exp_month, exp_year
    is_default: bool = False
    created: Optional[int] = None  # Unix timestamp
    
    class Config:
        from_attributes = True


class StripeConnectOnboardingRequest(BaseModel):
    """Request to create Stripe Connect account for driver"""
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    dob_day: int = Field(..., ge=1, le=31)
    dob_month: int = Field(..., ge=1, le=12)
    dob_year: int = Field(..., ge=1900, le=2010)
    iban: str = Field(..., min_length=15, max_length=34)  # IBAN format
    id_number: str = Field(..., min_length=8, max_length=20)  # DNI/NIE
    # Address fields (required by Stripe to activate transfers)
    address_line1: str = Field(..., min_length=1, max_length=200)
    address_city: str = Field(..., min_length=1, max_length=100)
    address_postal_code: str = Field(..., min_length=4, max_length=10)
    # Optional fields
    phone: Optional[str] = Field(None, min_length=9, max_length=20)


class StripeConnectOnboardingResponse(BaseModel):
    """Response after creating Stripe Connect account"""
    success: bool
    message: str
    stripe_account_id: Optional[str] = None

