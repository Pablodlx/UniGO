"""add_blocked_trip_ids_to_users

Revision ID: add_blocked_trip_ids_to_users
Revises: add_stripe_payments
Create Date: 2025-01-29 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'add_blocked_trip_ids_to_users'
down_revision: Union[str, None] = 'add_stripe_payments'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add blocked_trip_ids column to users table
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'users' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('users')]
        
        # Add blocked_trip_ids column
        if 'blocked_trip_ids' not in columns:
            op.add_column('users', sa.Column('blocked_trip_ids', postgresql.ARRAY(sa.Integer()), nullable=True))


def downgrade() -> None:
    # Remove blocked_trip_ids column from users table
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'users' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('users')]
        
        if 'blocked_trip_ids' in columns:
            op.drop_column('users', 'blocked_trip_ids')

