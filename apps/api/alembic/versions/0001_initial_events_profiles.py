"""Initial schema: events + profiles (matches app.orm).

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-27
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    # Idempotent for DBs that already got tables via create_all.
    if "events" not in tables:
        op.create_table(
            "events",
            sa.Column("message_id", sa.Text(), primary_key=True, nullable=False),
            sa.Column("anonymous_id", sa.Text(), nullable=True),
            sa.Column("user_id", sa.Text(), nullable=True),
            sa.Column("event", sa.Text(), nullable=False),
            sa.Column(
                "properties",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=False,
                server_default=sa.text("'{}'::jsonb"),
            ),
            sa.Column("event_timestamp", sa.DateTime(timezone=True), nullable=False),
            sa.Column(
                "received_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
        )
        op.create_index("idx_events_received_at", "events", ["received_at"])
        op.create_index("idx_events_user_id", "events", ["user_id"])
        op.create_index("idx_events_anonymous_id", "events", ["anonymous_id"])

    if "profiles" not in tables:
        op.create_table(
            "profiles",
            sa.Column("user_id", sa.Text(), primary_key=True, nullable=False),
            sa.Column("anonymous_id", sa.Text(), nullable=True),
            sa.Column(
                "traits",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=False,
                server_default=sa.text("'{}'::jsonb"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
        )
        op.create_index("idx_profiles_updated_at", "profiles", ["updated_at"])
        op.create_index("idx_profiles_anonymous_id", "profiles", ["anonymous_id"])


def downgrade() -> None:
    op.drop_index("idx_profiles_anonymous_id", table_name="profiles")
    op.drop_index("idx_profiles_updated_at", table_name="profiles")
    op.drop_table("profiles")
    op.drop_index("idx_events_anonymous_id", table_name="events")
    op.drop_index("idx_events_user_id", table_name="events")
    op.drop_index("idx_events_received_at", table_name="events")
    op.drop_table("events")
