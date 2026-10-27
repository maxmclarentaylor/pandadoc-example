"""Keep only the artist chart. Drop listener and recommendation tables.

Revision ID: 0005_music_artists_only
Revises: 0004_music
Create Date: 2026-10-05
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_music_artists_only"
down_revision: Union[str, Sequence[str], None] = "0004_music"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    # Listen and recommendation rows point at artists, so they go first.
    for table_name in ("music_related", "music_listens", "music_users", "music_artists"):
        if table_name in tables:
            op.drop_table(table_name)

    op.create_table(
        "music_artists",
        sa.Column("id", sa.Text(), primary_key=True, nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("music_artists")
