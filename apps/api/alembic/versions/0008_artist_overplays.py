"""Overall play total on each artist.

Revision ID: 0008_artist_overplays
Revises: 0007_music_users
Create Date: 2026-10-09
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008_artist_overplays"
down_revision: Union[str, Sequence[str], None] = "0007_music_users"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "music_artists",
        sa.Column("overplays", sa.Integer(), nullable=False, server_default="0"),
    )
    op.execute(
        """
        UPDATE music_artists AS artist
        SET overplays = COALESCE((
            SELECT SUM(listen.play_count)
            FROM music_listens AS listen
            WHERE listen.artist_id = artist.id
        ), 0)
        """
    )


def downgrade() -> None:
    op.drop_column("music_artists", "overplays")
