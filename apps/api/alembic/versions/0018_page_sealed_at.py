"""Record when a completed page PDF was sealed.

Revision ID: 0018_page_sealed_at
Revises: 0017_signing_complete
Create Date: 2026-10-23
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0018_page_sealed_at"
down_revision: Union[str, Sequence[str], None] = "0017_signing_complete"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "pages",
        sa.Column("sealed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("pages", "sealed_at")
