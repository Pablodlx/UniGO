"""
Bank account (IBAN) management endpoints
"""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.auth.router import get_current_user
from app.auth.models import User
from app.core.stripe import is_stripe_enabled
from app.payments.bank_account_schemas import (
    BankAccountCreateRequest,
    BankAccountResponse,
    BankAccountInfo,
)

log = logging.getLogger(__name__)
router = APIRouter(prefix="/bank-account", tags=["Bank Account"])


@router.post("/create-or-update", response_model=BankAccountResponse)
def create_or_update_bank_account(
    request: BankAccountCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create or update Stripe Connect account with bank account (IBAN) for driver.
    
    If the user already has a stripe_account_id, this will update the existing account.
    Otherwise, it creates a new Stripe Connect Custom account.
    """
    if not is_stripe_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment service is not configured"
        )
    
    try:
        import stripe
        
        # Check if user already has a Stripe Connect account
        if current_user.stripe_account_id:
            log.info(f"Updating existing Stripe Connect account for user {current_user.id}")
            
            # Update existing account
            account_id = current_user.stripe_account_id
            
            # Update individual information
            stripe.Account.modify(
                account_id,
                individual={
                    "first_name": request.first_name,
                    "last_name": request.last_name,
                    "dob": {
                        "day": request.dob_day,
                        "month": request.dob_month,
                        "year": request.dob_year,
                    },
                    "id_number": request.id_number,
                    "email": current_user.email,
                    "phone": request.phone if request.phone else None,
                    "address": {
                        "line1": request.address_line1,
                        "city": request.address_city,
                        "postal_code": request.address_postal_code,
                        "country": "ES",
                    },
                },
            )
            
            # Add or update external account (IBAN)
            # First, list existing external accounts
            existing_accounts = stripe.Account.list_external_accounts(
                account_id,
                object="bank_account",
                limit=10
            )
            
            # Delete old bank accounts
            for ext_account in existing_accounts.data:
                stripe.Account.delete_external_account(
                    account_id,
                    ext_account.id
                )
            
            # Add new bank account
            stripe.Account.create_external_account(
                account_id,
                external_account={
                    "object": "bank_account",
                    "country": "ES",
                    "currency": "eur",
                    "account_number": request.iban,
                }
            )
            
            log.info(f"Updated Stripe Connect account {account_id} for user {current_user.id}")
            
            return BankAccountResponse(
                success=True,
                message="Cuenta bancaria actualizada correctamente",
                stripe_account_id=account_id
            )
        
        else:
            log.info(f"Creating new Stripe Connect account for user {current_user.id}")
            
            # Create new Stripe Connect Custom account
            individual_data = {
                "first_name": request.first_name,
                "last_name": request.last_name,
                "dob": {
                    "day": request.dob_day,
                    "month": request.dob_month,
                    "year": request.dob_year,
                },
                "id_number": request.id_number,
                "email": current_user.email,
                "address": {
                    "line1": request.address_line1,
                    "city": request.address_city,
                    "postal_code": request.address_postal_code,
                    "country": "ES",
                },
            }
            
            if request.phone:
                individual_data["phone"] = request.phone
            
            account = stripe.Account.create(
                type="custom",
                country="ES",
                email=current_user.email,
                capabilities={
                    "transfers": {"requested": True},
                },
                business_type="individual",
                individual=individual_data,
                business_profile={
                    "url": "https://unigo.app",
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
                    "ip": "127.0.0.1",
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
            
            return BankAccountResponse(
                success=True,
                message="Cuenta bancaria configurada correctamente",
                stripe_account_id=account.id
            )
        
    except stripe.error.StripeError as e:
        log.error(f"Stripe error managing bank account: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error de Stripe: {str(e)}"
        )
    except Exception as e:
        log.error(f"Error managing bank account: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to manage bank account: {str(e)}"
        )


@router.get("/info", response_model=BankAccountInfo)
def get_bank_account_info(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get bank account information for the current user.
    Returns last 4 digits of IBAN if configured.
    """
    if not is_stripe_enabled():
        return BankAccountInfo(has_bank_account=False)
    
    if not current_user.stripe_account_id:
        return BankAccountInfo(has_bank_account=False)
    
    try:
        import stripe
        
        # Retrieve account from Stripe
        account = stripe.Account.retrieve(current_user.stripe_account_id)
        
        # Get external accounts (bank accounts)
        if hasattr(account, 'external_accounts') and account.external_accounts.data:
            bank_account = account.external_accounts.data[0]  # Get first bank account
            
            return BankAccountInfo(
                has_bank_account=True,
                last4=bank_account.last4,
                bank_name=bank_account.bank_name if hasattr(bank_account, 'bank_name') else None,
                country=bank_account.country,
                stripe_account_id=current_user.stripe_account_id
            )
        else:
            return BankAccountInfo(
                has_bank_account=False,
                stripe_account_id=current_user.stripe_account_id
            )
        
    except Exception as e:
        log.error(f"Error retrieving bank account info: {e}")
        return BankAccountInfo(has_bank_account=False)


@router.delete("", status_code=204)
def delete_bank_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete bank account (IBAN) and Stripe Connect account.
    This will remove the stripe_account_id from the user.
    """
    if not is_stripe_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment service is not configured"
        )
    
    if not current_user.stripe_account_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User does not have a bank account configured"
        )
    
    try:
        import stripe
        
        # Delete Stripe Connect account
        stripe.Account.delete(current_user.stripe_account_id)
        
        # Remove from database
        current_user.stripe_account_id = None
        db.commit()
        
        log.info(f"Deleted Stripe Connect account for user {current_user.id}")
        
        from fastapi import Response
        return Response(status_code=204)
        
    except stripe.error.StripeError as e:
        log.error(f"Stripe error deleting bank account: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error de Stripe: {str(e)}"
        )
    except Exception as e:
        log.error(f"Error deleting bank account: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete bank account: {str(e)}"
        )

