"""Rename music_artists.rank to musical_rank.

`rank` is a built-in Postgres function, so selecting that column name fails.

Revision ID: 0006_musical_rank
Revises: 0005_music_artists_only
Create Date: 2026-10-05
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0006_musical_rank"
down_revision: Union[str, Sequence[str], None] = "0005_music_artists_only"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("music_artists", "rank", new_column_name="musical_rank")


def downgrade() -> None:
    op.alter_column("music_artists", "musical_rank", new_column_name="rank")
