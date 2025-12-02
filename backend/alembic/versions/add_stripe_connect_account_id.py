"""add_stripe_connect_account_id

Revision ID: add_stripe_connect_account_id
Revises: add_blocked_trip_ids_to_users
Create Date: 2025-01-29 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_stripe_connect_account_id'
down_revision: Union[str, None] = 'add_blocked_trip_ids_to_users'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add stripe_account_id column to users table
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'users' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('users')]
        
        # Add stripe_account_id column
        if 'stripe_account_id' not in columns:
            op.add_column('users', sa.Column('stripe_account_id', sa.String(length=255), nullable=True))
            op.create_index(op.f('ix_users_stripe_account_id'), 'users', ['stripe_account_id'], unique=False)


def downgrade() -> None:
    # Remove stripe_account_id column from users table
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'users' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('users')]
        
        if 'stripe_account_id' in columns:
            op.drop_index(op.f('ix_users_stripe_account_id'), table_name='users')
            op.drop_column('users', 'stripe_account_id')

