"""replace vehicle_info with vehicle_brand and vehicle_color

Revision ID: vehicle_brand_color
Revises: ratings_001
Create Date: 2025-01-15 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'vehicle_brand_color'
down_revision = 'ratings_001'
branch_labels = None
depends_on = None


def upgrade():
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Get existing columns in rides table
    if 'rides' in inspector.get_table_names():
        existing_columns = [col['name'] for col in inspector.get_columns('rides')]
        
        # Add new columns
        if 'vehicle_brand' not in existing_columns:
            op.add_column('rides', sa.Column('vehicle_brand', sa.String(length=100), nullable=True))
        if 'vehicle_color' not in existing_columns:
            op.add_column('rides', sa.Column('vehicle_color', sa.String(length=50), nullable=True))
        
        # Drop old vehicle_info column if it exists
        if 'vehicle_info' in existing_columns:
            op.drop_column('rides', 'vehicle_info')


def downgrade():
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # Get existing columns in rides table
    if 'rides' in inspector.get_table_names():
        existing_columns = [col['name'] for col in inspector.get_columns('rides')]
        
        # Add back vehicle_info column
        if 'vehicle_info' not in existing_columns:
            op.add_column('rides', sa.Column('vehicle_info', sa.String(length=200), nullable=True))
        
        # Drop new columns
        if 'vehicle_brand' in existing_columns:
            op.drop_column('rides', 'vehicle_brand')
        if 'vehicle_color' in existing_columns:
            op.drop_column('rides', 'vehicle_color')



