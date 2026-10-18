"""Identity merge: anonymous_id → canonical user_id.

Revision ID: 0003_identity_links
Revises: 0002_destinations
Create Date: 2026-09-28
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_identity_links"
down_revision: Union[str, Sequence[str], None] = "0002_destinations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "identity_links" not in tables:
        op.create_table(
            "identity_links",
            sa.Column("id", sa.Text(), primary_key=True, nullable=False),
            sa.Column("anonymous_id", sa.Text(), nullable=False),
            sa.Column(
                "user_id",
                sa.Text(),
                sa.ForeignKey("profiles.user_id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.UniqueConstraint("anonymous_id", name="uq_identity_links_anonymous_id"),
        )
        op.create_index("idx_identity_links_user_id", "identity_links", ["user_id"])


def downgrade() -> None:
    op.drop_index("idx_identity_links_user_id", table_name="identity_links")
    op.drop_table("identity_links")
