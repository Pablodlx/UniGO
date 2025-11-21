"""Replace ride_intent with home_address fields

Revision ID: a1b2c3d4e5f6
Revises: favorites_001
Create Date: 2025-01-XX XX:XX:XX.XXXXXX
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "favorites_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add home_address columns
    op.add_column("users", sa.Column("home_address_formatted", sa.String(length=500), nullable=True))
    op.add_column("users", sa.Column("home_address_place_id", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("home_address_lat", sa.Float(), nullable=True))
    op.add_column("users", sa.Column("home_address_lng", sa.Float(), nullable=True))
    
    # Remove ride_intent column
    op.drop_column("users", "ride_intent")
    
    # Drop the rideintent enum type if it exists (PostgreSQL specific)
    # Use bind.execute for better compatibility
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        from sqlalchemy import text
        bind.execute(text("DROP TYPE IF EXISTS rideintent"))


def downgrade() -> None:
    # Recreate ride_intent column
    ride_enum = sa.Enum("offers", "seeks", "both", name="rideintent")
    ride_enum.create(op.get_bind(), checkfirst=True)
    op.add_column("users", sa.Column("ride_intent", ride_enum, nullable=True))
    
    # Remove home_address columns
    op.drop_column("users", "home_address_lng")
    op.drop_column("users", "home_address_lat")
    op.drop_column("users", "home_address_place_id")
    op.drop_column("users", "home_address_formatted")

