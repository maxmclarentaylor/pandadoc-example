"""Destinations + deliveries for outbound fan-out pipeline.

Revision ID: 0002_destinations
Revises: 0001_initial
Create Date: 2026-09-28
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_destinations"
down_revision: Union[str, Sequence[str], None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "destinations" not in tables:
        op.create_table(
            "destinations",
            sa.Column("id", sa.Text(), primary_key=True, nullable=False),
            sa.Column("name", sa.Text(), nullable=False),
            sa.Column("url", sa.Text(), nullable=False),
            sa.Column(
                "enabled",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("true"),
            ),
            sa.Column("event_name_filter", sa.Text(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
        )
        op.create_index("idx_destinations_enabled", "destinations", ["enabled"])

    if "deliveries" not in tables:
        op.create_table(
            "deliveries",
            sa.Column("id", sa.Text(), primary_key=True, nullable=False),
            sa.Column(
                "destination_id",
                sa.Text(),
                sa.ForeignKey("destinations.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "message_id",
                sa.Text(),
                sa.ForeignKey("events.message_id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "status",
                sa.Text(),
                nullable=False,
                server_default="pending",
            ),
            sa.Column(
                "attempt_count",
                sa.Integer(),
                nullable=False,
                server_default="0",
            ),
            sa.Column(
                "next_attempt_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column("last_status_code", sa.Integer(), nullable=True),
            sa.Column("last_error", sa.Text(), nullable=True),
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
            sa.UniqueConstraint(
                "destination_id",
                "message_id",
                name="uq_deliveries_dest_message",
            ),
        )
        op.create_index(
            "idx_deliveries_status_next",
            "deliveries",
            ["status", "next_attempt_at"],
        )
        op.create_index("idx_deliveries_message_id", "deliveries", ["message_id"])


def downgrade() -> None:
    op.drop_index("idx_deliveries_message_id", table_name="deliveries")
    op.drop_index("idx_deliveries_status_next", table_name="deliveries")
    op.drop_table("deliveries")
    op.drop_index("idx_destinations_enabled", table_name="destinations")
    op.drop_table("destinations")
