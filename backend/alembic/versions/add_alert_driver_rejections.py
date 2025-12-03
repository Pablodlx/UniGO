"""add alert driver rejections table

Revision ID: add_alert_driver_rejections
Revises: 
Create Date: 2025-12-02 23:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_alert_driver_rejections'
down_revision = 'add_stripe_connect_account_id'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Create table to track which drivers have rejected bookings for specific alerts/trips.
    This prevents infinite retry loops.
    """
    # Check if table already exists
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'alert_driver_rejections' not in inspector.get_table_names():
        op.create_table(
            'alert_driver_rejections',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('alert_id', sa.Integer(), nullable=False),
            sa.Column('trip_id', sa.Integer(), nullable=False),
            sa.Column('driver_id', sa.Integer(), nullable=False),
            sa.Column('rejected_at', sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['alert_id'], ['search_alerts.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['trip_id'], ['rides.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['driver_id'], ['users.id'], ondelete='CASCADE'),
        )
        
        # Create unique index to prevent duplicate entries
        op.create_index(
            'idx_alert_trip_driver_unique',
            'alert_driver_rejections',
            ['alert_id', 'trip_id', 'driver_id'],
            unique=True
        )
        
        # Create index for faster lookups
        op.create_index(
            'idx_alert_driver_rejections_alert_id',
            'alert_driver_rejections',
            ['alert_id']
        )


def downgrade() -> None:
    """Drop the alert_driver_rejections table"""
    op.drop_index('idx_alert_driver_rejections_alert_id', table_name='alert_driver_rejections')
    op.drop_index('idx_alert_trip_driver_unique', table_name='alert_driver_rejections')
    op.drop_table('alert_driver_rejections')

