"""rf01: users + email_codes + is_verified

Revision ID: 72248d0d8184
Revises: f36830aa518f
Create Date: 2025-10-02 00:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "72248d0d8184"
down_revision: str | None = "f36830aa518f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1) Añadir columna con default y nullable para no romper filas existentes
    op.add_column(
        "users",
        sa.Column("is_verified", sa.Boolean(), nullable=True, server_default=sa.false()),
    )

    # 2) Asegurar que todas las filas existentes quedan en FALSE
    op.execute("UPDATE users SET is_verified = FALSE WHERE is_verified IS NULL")

    # 3) Quitar el default (lo controlará la app)
    op.execute("ALTER TABLE users ALTER COLUMN is_verified DROP DEFAULT")

    # 4) Marcar como NOT NULL (ya no hay NULLs)
    op.alter_column("users", "is_verified", existing_type=sa.Boolean(), nullable=False)

    # --- create email_codes table (si no existiese ya) ---
    op.create_table(
        "email_codes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(length=255), nullable=False, index=True),
        sa.Column("code", sa.String(length=10), nullable=False),
        sa.Column(
            "purpose",
            sa.String(length=50),
            nullable=False,
            server_default="verify_email",
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )


def downgrade() -> None:
    # revertir email_codes
    op.drop_table("email_codes")
    # revertir is_verified
    op.alter_column("users", "is_verified", existing_type=sa.Boolean(), nullable=True)
    op.execute("UPDATE users SET is_verified = NULL")
    op.drop_column("users", "is_verified")
