"""Demo Entra login linked to each assignee (local demo only).

Revision ID: 0016_assignee_demo_entra_upn
Revises: 0015_page_pdf
Create Date: 2026-10-23
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0016_assignee_demo_entra_upn"
down_revision: Union[str, Sequence[str], None] = "0015_page_pdf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "page_assignees",
        sa.Column("demo_entra_upn", sa.Text(), nullable=False, server_default=""),
    )
    op.alter_column("page_assignees", "demo_entra_upn", server_default=None)


def downgrade() -> None:
    op.drop_column("page_assignees", "demo_entra_upn")
