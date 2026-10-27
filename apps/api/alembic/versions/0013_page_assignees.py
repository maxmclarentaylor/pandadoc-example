"""Assignees for locked pages (name + email). No email send yet.

Revision ID: 0013_page_assignees
Revises: 0012_page_lock
Create Date: 2026-10-19
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013_page_assignees"
down_revision: Union[str, Sequence[str], None] = "0012_page_lock"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "page_assignees",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("page_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["page_id"], ["pages.id"], ondelete="CASCADE"),
    )
    op.create_index("idx_page_assignees_page_id", "page_assignees", ["page_id"])


def downgrade() -> None:
    op.drop_index("idx_page_assignees_page_id", table_name="page_assignees")
    op.drop_table("page_assignees")
