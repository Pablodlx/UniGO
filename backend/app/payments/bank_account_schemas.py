"""
Schemas for bank account management (IBAN)
"""
from typing import Optional
from pydantic import BaseModel, Field


class BankAccountCreateRequest(BaseModel):
    """Request to create or update bank account (IBAN) for driver"""
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    dob_day: int = Field(..., ge=1, le=31)
    dob_month: int = Field(..., ge=1, le=12)
    dob_year: int = Field(..., ge=1900, le=2010)
    iban: str = Field(..., min_length=15, max_length=34)
    id_number: str = Field(..., min_length=8, max_length=20)  # DNI/NIE
    address_line1: str = Field(..., min_length=1, max_length=200)
    address_city: str = Field(..., min_length=1, max_length=100)
    address_postal_code: str = Field(..., min_length=4, max_length=10)
    phone: Optional[str] = Field(None, min_length=9, max_length=20)


class BankAccountResponse(BaseModel):
    """Response after creating/updating bank account"""
    success: bool
    message: str
    stripe_account_id: Optional[str] = None


class BankAccountInfo(BaseModel):
    """Bank account information for display"""
    has_bank_account: bool
    last4: Optional[str] = None
    bank_name: Optional[str] = None
    country: Optional[str] = None
    stripe_account_id: Optional[str] = None

