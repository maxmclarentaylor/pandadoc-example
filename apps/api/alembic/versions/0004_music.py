"""Music catalog: artists, listeners, plays, precomputed related artists.

Revision ID: 0004_music
Revises: 0003_identity_links
Create Date: 2026-10-05
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_music"
down_revision: Union[str, Sequence[str], None] = "0003_identity_links"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "music_artists" not in tables:
        op.create_table(
            "music_artists",
            sa.Column("id", sa.Text(), primary_key=True, nullable=False),
            sa.Column("name", sa.Text(), nullable=False),
            sa.Column("scene", sa.Text(), nullable=False),
        )
    if "music_users" not in tables:
        op.create_table(
            "music_users",
            sa.Column("id", sa.Text(), primary_key=True, nullable=False),
            sa.Column("name", sa.Text(), nullable=False),
            sa.Column("scene", sa.Text(), nullable=False),
        )
    if "music_listens" not in tables:
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
        op.create_index("idx_music_listens_artist_plays", "music_listens", ["artist_id", "play_count"])
        op.create_index("idx_music_listens_user_plays", "music_listens", ["user_id", "play_count"])
    if "music_related" not in tables:
        op.create_table(
            "music_related",
            sa.Column("id", sa.Text(), primary_key=True, nullable=False),
            sa.Column(
                "artist_id",
                sa.Text(),
                sa.ForeignKey("music_artists.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "related_id",
                sa.Text(),
                sa.ForeignKey("music_artists.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("rank", sa.Integer(), nullable=False),
            sa.Column("score", sa.Float(), nullable=False),
            sa.Column("shared_listeners", sa.Integer(), nullable=False),
            sa.Column("candidate_listeners", sa.Integer(), nullable=False),
            sa.UniqueConstraint("artist_id", "related_id", name="uq_music_related_pair"),
        )
        op.create_index("idx_music_related_artist_rank", "music_related", ["artist_id", "rank"])


def downgrade() -> None:
    op.drop_index("idx_music_related_artist_rank", table_name="music_related")
    op.drop_table("music_related")
    op.drop_index("idx_music_listens_user_plays", table_name="music_listens")
    op.drop_index("idx_music_listens_artist_plays", table_name="music_listens")
    op.drop_table("music_listens")
    op.drop_table("music_users")
    op.drop_table("music_artists")
