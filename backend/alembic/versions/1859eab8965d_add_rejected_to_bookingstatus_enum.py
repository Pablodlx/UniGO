"""add_rejected_to_bookingstatus_enum

Revision ID: 1859eab8965d
Revises: a10fc208aa37
Create Date: 2025-11-26 12:55:42.499335

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1859eab8965d'
down_revision: Union[str, None] = 'a10fc208aa37'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add 'rejected' value to bookingstatus enum
    # Note: In PostgreSQL, you cannot remove enum values, so downgrade is not possible
    op.execute("ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'rejected'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values directly
    # This would require recreating the enum, which is complex and risky
    # For now, we'll leave it as a no-op
    # If you really need to remove it, you would need to:
    # 1. Create a new enum without 'rejected'
    # 2. Update all columns to use the new enum
    # 3. Drop the old enum
    # 4. Rename the new enum to the old name
    pass
