"""add_alert_fields_to_bookings

Revision ID: add_alert_fields_to_bookings
Revises: 1859eab8965d
Create Date: 2025-01-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_alert_fields_to_bookings'
down_revision: Union[str, None] = '1859eab8965d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add search_alert_id and created_by_alert columns to bookings table
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    tables = inspector.get_table_names()
    
    # Create search_alerts table if it doesn't exist
    if 'search_alerts' not in tables:
        op.create_table('search_alerts',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('origin', sa.String(length=100), nullable=False),
            sa.Column('destination', sa.String(length=100), nullable=False),
            sa.Column('origin_lat', sa.Float(), nullable=True),
            sa.Column('origin_lng', sa.Float(), nullable=True),
            sa.Column('destination_lat', sa.Float(), nullable=True),
            sa.Column('destination_lng', sa.Float(), nullable=True),
            sa.Column('target_time', sa.String(length=10), nullable=False),
            sa.Column('days_of_week', sa.ARRAY(sa.Integer()), nullable=True),
            sa.Column('specific_dates', sa.ARRAY(sa.Date()), nullable=True),
            sa.Column('flexibility_minutes', sa.Integer(), nullable=False, server_default='30'),
            sa.Column('allow_nearby_search', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('active', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_search_alerts_user_id', 'search_alerts', ['user_id'], unique=False)
    
    if 'bookings' in tables:
        columns = [col['name'] for col in inspector.get_columns('bookings')]
        
        # Add search_alert_id column
        if 'search_alert_id' not in columns:
            op.add_column('bookings', sa.Column('search_alert_id', sa.Integer(), nullable=True))
            op.create_foreign_key(
                'fk_bookings_search_alert_id',
                'bookings',
                'search_alerts',
                ['search_alert_id'],
                ['id'],
                ondelete='SET NULL'
            )
            op.create_index('ix_bookings_search_alert_id', 'bookings', ['search_alert_id'])
        
        # Add created_by_alert column
        if 'created_by_alert' not in columns:
            op.add_column('bookings', sa.Column('created_by_alert', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    # Remove search_alert_id and created_by_alert columns from bookings table
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    tables = inspector.get_table_names()
    
    if 'bookings' in tables:
        columns = [col['name'] for col in inspector.get_columns('bookings')]
        
        if 'created_by_alert' in columns:
            op.drop_column('bookings', 'created_by_alert')
        
        if 'search_alert_id' in columns:
            op.drop_index('ix_bookings_search_alert_id', table_name='bookings')
            op.drop_constraint('fk_bookings_search_alert_id', 'bookings', type_='foreignkey')
            op.drop_column('bookings', 'search_alert_id')
    
    # Note: We don't drop search_alerts table here as it might be needed by other parts of the system

