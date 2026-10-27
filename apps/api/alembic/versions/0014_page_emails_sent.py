"""Track whether a locked page has been sent for signature (flag only).

Revision ID: 0014_page_emails_sent
Revises: 0013_page_assignees
Create Date: 2026-10-19
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014_page_emails_sent"
down_revision: Union[str, Sequence[str], None] = "0013_page_assignees"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "pages",
        sa.Column("emails_sent", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade() -> None:
    op.drop_column("pages", "emails_sent")
