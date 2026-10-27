"""Track assignee signed_at and page signing_complete.

Revision ID: 0017_signing_complete
Revises: 0016_assignee_demo_entra_upn
Create Date: 2026-10-23
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017_signing_complete"
down_revision: Union[str, Sequence[str], None] = "0016_assignee_demo_entra_upn"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "page_assignees",
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "pages",
        sa.Column(
            "signing_complete",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("pages", "signing_complete")
    op.drop_column("page_assignees", "signed_at")
