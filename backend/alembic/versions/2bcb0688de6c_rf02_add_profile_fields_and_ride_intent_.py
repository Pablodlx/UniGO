"""RF-02: add profile fields and ride_intent to users

Revision ID: 2bcb0688de6c
Revises: 72248d0d8184
Create Date: 2025-10-06 10:58:33.886409
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2bcb0688de6c"
down_revision: str | None = "72248d0d8184"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Crea el tipo ENUM para ride_intent si no existe
    ride_enum = sa.Enum("offers", "seeks", "both", name="rideintent")
    ride_enum.create(op.get_bind(), checkfirst=True)

    # Añade columnas de perfil (todas NULLables; la obligatoriedad se valida en la app)
    op.add_column("users", sa.Column("full_name", sa.String(length=150), nullable=True))
    op.add_column(
        "users", sa.Column("university", sa.String(length=150), nullable=True)
    )
    op.add_column("users", sa.Column("degree", sa.String(length=150), nullable=True))
    op.add_column("users", sa.Column("course", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("ride_intent", ride_enum, nullable=True))
    op.add_column(
        "users", sa.Column("avatar_url", sa.String(length=300), nullable=True)
    )


def downgrade() -> None:
    # Elimina columnas en orden inverso
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "ride_intent")
    op.drop_column("users", "course")
    op.drop_column("users", "degree")
    op.drop_column("users", "university")
    op.drop_column("users", "full_name")

    # Borra el ENUM (si no está en uso)
    sa.Enum(name="rideintent").drop(op.get_bind(), checkfirst=True)
