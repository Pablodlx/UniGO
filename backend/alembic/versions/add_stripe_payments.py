"""add_stripe_payments

Revision ID: add_stripe_payments
Revises: add_alert_fields_to_bookings
Create Date: 2025-12-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'add_stripe_payments'
down_revision: Union[str, None] = 'add_alert_fields_to_bookings'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add Stripe fields to users table
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'users' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('users')]
        
        # Add stripe_customer_id column
        if 'stripe_customer_id' not in columns:
            op.add_column('users', sa.Column('stripe_customer_id', sa.String(length=255), nullable=True))
            op.create_index('ix_users_stripe_customer_id', 'users', ['stripe_customer_id'])
        
        # Add stripe_payment_method_id column
        if 'stripe_payment_method_id' not in columns:
            op.add_column('users', sa.Column('stripe_payment_method_id', sa.String(length=255), nullable=True))
    
    # Create payments table
    if 'payments' not in inspector.get_table_names():
        op.create_table('payments',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('booking_id', sa.Integer(), nullable=False),
            sa.Column('stripe_customer_id', sa.String(length=255), nullable=True),
            sa.Column('stripe_payment_method_id', sa.String(length=255), nullable=True),
            sa.Column('stripe_payment_intent_id', sa.String(length=255), nullable=True),
            sa.Column('amount_cents', sa.BigInteger(), nullable=False),
            sa.Column('currency', sa.String(length=3), nullable=False, server_default='eur'),
            sa.Column('status', sa.String(length=50), nullable=False),
            sa.Column('app_fee_cents', sa.BigInteger(), nullable=True),
            sa.Column('driver_amount_cents', sa.BigInteger(), nullable=True),
            sa.Column('penalty_cents', sa.BigInteger(), nullable=True),
            sa.Column('driver_penalty_cents', sa.BigInteger(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('captured_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['booking_id'], ['bookings.id'], ),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('stripe_payment_intent_id')
        )
        op.create_index('ix_payments_booking_id', 'payments', ['booking_id'])
        op.create_index('ix_payments_stripe_customer_id', 'payments', ['stripe_customer_id'])
        op.create_index('ix_payments_stripe_payment_method_id', 'payments', ['stripe_payment_method_id'])
        op.create_index('ix_payments_stripe_payment_intent_id', 'payments', ['stripe_payment_intent_id'])
        op.create_index('ix_payments_status', 'payments', ['status'])


def downgrade() -> None:
    # Drop payments table
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'payments' in inspector.get_table_names():
        op.drop_index('ix_payments_status', table_name='payments')
        op.drop_index('ix_payments_stripe_payment_intent_id', table_name='payments')
        op.drop_index('ix_payments_stripe_payment_method_id', table_name='payments')
        op.drop_index('ix_payments_stripe_customer_id', table_name='payments')
        op.drop_index('ix_payments_booking_id', table_name='payments')
        op.drop_table('payments')
    
    # Remove Stripe fields from users table
    if 'users' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('users')]
        
        if 'stripe_payment_method_id' in columns:
            op.drop_column('users', 'stripe_payment_method_id')
        
        if 'stripe_customer_id' in columns:
            op.drop_index('ix_users_stripe_customer_id', table_name='users')
            op.drop_column('users', 'stripe_customer_id')

