"""Add pages table for saved editor documents.

Revision ID: 0010_pages
Revises: 0009_drop_product_tables
Create Date: 2026-10-14
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0010_pages"
down_revision: Union[str, Sequence[str], None] = "0009_drop_product_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pages",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("owner_oid", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("chunks", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("idx_pages_owner_oid", "pages", ["owner_oid"])


def downgrade() -> None:
    op.drop_index("idx_pages_owner_oid", table_name="pages")
    op.drop_table("pages")
