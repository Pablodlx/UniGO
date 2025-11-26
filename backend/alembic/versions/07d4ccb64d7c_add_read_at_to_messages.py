"""add_read_at_to_messages

Revision ID: 07d4ccb64d7c
Revises: 2bde7ac4d7e0
Create Date: 2025-11-25 23:45:31.869769

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '07d4ccb64d7c'
down_revision: Union[str, None] = '2bde7ac4d7e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add read_at column to messages table
    op.add_column('messages', sa.Column('read_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f('ix_messages_read_at'), 'messages', ['read_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_messages_read_at'), table_name='messages')
    op.drop_column('messages', 'read_at')
