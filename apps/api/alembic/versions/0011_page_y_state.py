"""Store the Yjs document for a page next to its JSON snapshot.

Revision ID: 0011_page_y_state
Revises: 0010_pages
Create Date: 2026-10-14
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011_page_y_state"
down_revision: Union[str, Sequence[str], None] = "0010_pages"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("pages", sa.Column("y_state", sa.LargeBinary(), nullable=True))


def downgrade() -> None:
    op.drop_column("pages", "y_state")
