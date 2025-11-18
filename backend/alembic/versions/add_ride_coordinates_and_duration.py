"""add ride coordinates and estimated duration

Revision ID: add_coords_duration
Revises: bookings_001
Create Date: 2025-01-15 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_coords_duration'
down_revision = 'bookings_001'
branch_labels = None
depends_on = None


def upgrade():
    # Check if columns already exist before adding them
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Get existing columns in rides table
    if 'rides' in inspector.get_table_names():
        existing_columns = [col['name'] for col in inspector.get_columns('rides')]
        
        # Add coordinate fields for departure and destination
        if 'departure_lat' not in existing_columns:
            op.add_column('rides', sa.Column('departure_lat', sa.Float(), nullable=True))
        if 'departure_lng' not in existing_columns:
            op.add_column('rides', sa.Column('departure_lng', sa.Float(), nullable=True))
        if 'destination_lat' not in existing_columns:
            op.add_column('rides', sa.Column('destination_lat', sa.Float(), nullable=True))
        if 'destination_lng' not in existing_columns:
            op.add_column('rides', sa.Column('destination_lng', sa.Float(), nullable=True))
        # Add estimated duration in minutes
        if 'estimated_duration_minutes' not in existing_columns:
            op.add_column('rides', sa.Column('estimated_duration_minutes', sa.Integer(), nullable=True))
    else:
        # Table doesn't exist, but this shouldn't happen if migrations are run in order
        # Add columns anyway (they will fail if table doesn't exist, which is expected)
        op.add_column('rides', sa.Column('departure_lat', sa.Float(), nullable=True))
        op.add_column('rides', sa.Column('departure_lng', sa.Float(), nullable=True))
        op.add_column('rides', sa.Column('destination_lat', sa.Float(), nullable=True))
        op.add_column('rides', sa.Column('destination_lng', sa.Float(), nullable=True))
        op.add_column('rides', sa.Column('estimated_duration_minutes', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('rides', 'estimated_duration_minutes')
    op.drop_column('rides', 'destination_lng')
    op.drop_column('rides', 'destination_lat')
    op.drop_column('rides', 'departure_lng')
    op.drop_column('rides', 'departure_lat')

