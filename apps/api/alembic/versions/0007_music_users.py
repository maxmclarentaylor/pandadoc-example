"""Listeners and how often each one plays a chart artist.

Revision ID: 0007_music_users
Revises: 0006_musical_rank
Create Date: 2026-10-05
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007_music_users"
down_revision: Union[str, Sequence[str], None] = "0006_musical_rank"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "music_users",
        sa.Column("id", sa.Text(), primary_key=True, nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
    )
    op.create_table(
        "music_listens",
        sa.Column("id", sa.Text(), primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            sa.Text(),
            sa.ForeignKey("music_users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "artist_id",
            sa.Text(),
            sa.ForeignKey("music_artists.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("play_count", sa.Integer(), nullable=False),
        sa.UniqueConstraint("user_id", "artist_id", name="uq_music_listens_user_artist"),
    )
    op.create_index("idx_music_listens_user", "music_listens", ["user_id"])


def downgrade() -> None:
    op.drop_index("idx_music_listens_user", table_name="music_listens")
    op.drop_table("music_listens")
    op.drop_table("music_users")
