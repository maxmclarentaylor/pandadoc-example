"""Store rendered PDF bytes and hash for locked pages.

Revision ID: 0015_page_pdf
Revises: 0014_page_emails_sent
Create Date: 2026-10-19
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015_page_pdf"
down_revision: Union[str, Sequence[str], None] = "0014_page_emails_sent"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("pages", sa.Column("pdf_bytes", sa.LargeBinary(), nullable=True))
    op.add_column("pages", sa.Column("pdf_hash", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("pages", "pdf_hash")
    op.drop_column("pages", "pdf_bytes")
