#!/usr/bin/env python3
"""
Script de diagnóstico para Stripe Connect
Verifica el estado de las cuentas Connect y detecta problemas comunes
"""
import sys
import os
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.auth.models import User
from app.payments.models import Payment  # Import Payment model to avoid SQLAlchemy errors
from app.core.stripe import get_stripe_client
import stripe


def check_stripe_connect_accounts():
    """Check all Stripe Connect accounts in the database"""
    db: Session = SessionLocal()
    stripe_client = get_stripe_client()
    
    if not stripe_client:
        print("❌ Stripe is not configured")
        return
    
    print("=" * 80)
    print("STRIPE CONNECT DIAGNOSTIC TOOL")
    print("=" * 80)
    print()
    
    # Get all users with stripe_account_id
    users_with_accounts = db.query(User).filter(User.stripe_account_id.isnot(None)).all()
    
    if not users_with_accounts:
        print("⚠️  No users found with Stripe Connect accounts")
        return
    
    print(f"Found {len(users_with_accounts)} user(s) with Stripe Connect accounts\n")
    
    for user in users_with_accounts:
        print("-" * 80)
        print(f"User ID: {user.id}")
        print(f"Email: {user.email}")
        print(f"Full Name: {user.full_name}")
        print(f"Stripe Account ID: {user.stripe_account_id}")
        print()
        
        try:
            # Retrieve account from Stripe
            account = stripe.Account.retrieve(user.stripe_account_id)
            
            print("✅ Account found in Stripe")
            print(f"   Type: {account.type}")
            print(f"   Country: {account.country}")
            print(f"   Email: {account.email}")
            print()
            
            # Check capabilities
            print("📋 Capabilities:")
            capabilities = account.capabilities
            for cap_name, cap_status in capabilities.items():
                icon = "✅" if cap_status == "active" else "⚠️"
                print(f"   {icon} {cap_name}: {cap_status}")
            
            # Check if transfers are active
            transfers_status = capabilities.get('transfers', 'not_requested')
            if transfers_status != 'active':
                print()
                print(f"❌ PROBLEM: Transfers capability is '{transfers_status}', not 'active'")
                print("   This will prevent transfers from being created!")
            
            print()
            
            # Check enabled features
            print("🔧 Account Status:")
            print(f"   Charges enabled: {account.charges_enabled}")
            print(f"   Payouts enabled: {account.payouts_enabled}")
            print(f"   Details submitted: {account.details_submitted}")
            print()
            
            # Check external accounts
            print("💳 External Accounts (Bank Accounts):")
            if hasattr(account, 'external_accounts') and account.external_accounts.data:
                for ext_account in account.external_accounts.data:
                    print(f"   - {ext_account.object}: {ext_account.bank_name if hasattr(ext_account, 'bank_name') else 'N/A'}")
                    print(f"     Last 4: {ext_account.last4}")
                    print(f"     Status: {ext_account.status if hasattr(ext_account, 'status') else 'N/A'}")
            else:
                print("   ⚠️  No external accounts found")
            print()
            
            # Check requirements
            if hasattr(account, 'requirements'):
                print("📝 Requirements:")
                req = account.requirements
                
                if req.currently_due:
                    print(f"   ⚠️  Currently due: {', '.join(req.currently_due)}")
                else:
                    print("   ✅ No requirements currently due")
                
                if req.eventually_due:
                    print(f"   ℹ️  Eventually due: {', '.join(req.eventually_due)}")
                
                if req.past_due:
                    print(f"   ❌ Past due: {', '.join(req.past_due)}")
                
                if req.disabled_reason:
                    print(f"   ❌ DISABLED REASON: {req.disabled_reason}")
            print()
            
            # Summary
            print("📊 Summary:")
            issues = []
            
            if transfers_status != 'active':
                issues.append(f"Transfers capability is {transfers_status}")
            
            if not account.charges_enabled:
                issues.append("Charges not enabled")
            
            if not account.payouts_enabled:
                issues.append("Payouts not enabled")
            
            if not account.details_submitted:
                issues.append("Details not submitted")
            
            if not (hasattr(account, 'external_accounts') and account.external_accounts.data):
                issues.append("No external accounts configured")
            
            if hasattr(account, 'requirements') and account.requirements.disabled_reason:
                issues.append(f"Account disabled: {account.requirements.disabled_reason}")
            
            if issues:
                print("   ❌ Issues found:")
                for issue in issues:
                    print(f"      - {issue}")
            else:
                print("   ✅ Account looks good!")
            
        except stripe.error.PermissionError as e:
            print(f"❌ Permission Error: {e}")
            print("   You may not have access to this account")
        except stripe.error.InvalidRequestError as e:
            print(f"❌ Invalid Request: {e}")
            print("   The account may not exist or be accessible")
        except Exception as e:
            print(f"❌ Error retrieving account: {e}")
        
        print()
    
    print("=" * 80)
    print("DIAGNOSTIC COMPLETE")
    print("=" * 80)
    
    db.close()


if __name__ == "__main__":
    check_stripe_connect_accounts()

