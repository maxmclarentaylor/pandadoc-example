"""Store page lock flag and content hash in Postgres.

Revision ID: 0012_page_lock
Revises: 0011_page_y_state
Create Date: 2026-10-18
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012_page_lock"
down_revision: Union[str, Sequence[str], None] = "0011_page_y_state"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "pages",
        sa.Column("locked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column("pages", sa.Column("content_hash", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("pages", "content_hash")
    op.drop_column("pages", "locked")
