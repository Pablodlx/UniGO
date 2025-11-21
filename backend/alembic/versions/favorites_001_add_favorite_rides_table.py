"""add favorite_rides table

Revision ID: favorites_001
Revises: ratings_001
Create Date: 2025-01-15 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'favorites_001'
down_revision = 'vehicle_brand_color'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('favorite_rides',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('departure_city', sa.String(length=100), nullable=False),
    sa.Column('destination_city', sa.String(length=100), nullable=False),
    sa.Column('departure_lat', sa.Float(), nullable=True),
    sa.Column('departure_lng', sa.Float(), nullable=True),
    sa.Column('destination_lat', sa.Float(), nullable=True),
    sa.Column('destination_lng', sa.Float(), nullable=True),
    sa.Column('departure_time', sa.String(length=10), nullable=True),
    sa.Column('available_seats', sa.Integer(), nullable=True),
    sa.Column('price_per_seat', sa.Float(), nullable=True),
    sa.Column('vehicle_brand', sa.String(length=100), nullable=True),
    sa.Column('vehicle_color', sa.String(length=50), nullable=True),
    sa.Column('additional_details', sa.Text(), nullable=True),
    sa.Column('from_address', sa.Text(), nullable=True),
    sa.Column('to_address', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_favorite_rides_user_id'), 'favorite_rides', ['user_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_favorite_rides_user_id'), table_name='favorite_rides')
    op.drop_table('favorite_rides')

