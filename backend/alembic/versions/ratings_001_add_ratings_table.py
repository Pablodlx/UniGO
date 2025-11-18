"""add_ratings_table

Revision ID: ratings_001
Revises: bookings_001
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ratings_001'
down_revision = 'add_coords_duration'
branch_labels = None
depends_on = None


def upgrade():
    # Create ratings table
    op.create_table('ratings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('booking_id', sa.Integer(), nullable=False),
    sa.Column('rater_id', sa.Integer(), nullable=False),
    sa.Column('rated_id', sa.Integer(), nullable=False),
    sa.Column('rating', sa.Integer(), nullable=False),
    sa.Column('comment', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['booking_id'], ['bookings.id'], ),
    sa.ForeignKeyConstraint(['rater_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['rated_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('booking_id', 'rater_id', name='uq_rating_booking_rater')
    )
    op.create_index(op.f('ix_ratings_booking_id'), 'ratings', ['booking_id'], unique=False)
    op.create_index(op.f('ix_ratings_rater_id'), 'ratings', ['rater_id'], unique=False)
    op.create_index(op.f('ix_ratings_rated_id'), 'ratings', ['rated_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_ratings_rated_id'), table_name='ratings')
    op.drop_index(op.f('ix_ratings_rater_id'), table_name='ratings')
    op.drop_index(op.f('ix_ratings_booking_id'), table_name='ratings')
    op.drop_table('ratings')

