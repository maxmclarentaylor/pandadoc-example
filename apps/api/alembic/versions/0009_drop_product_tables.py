"""Drop Segment and music tables. Auth does not use a table.

Revision ID: 0009_drop_product_tables
Revises: 0008_artist_overplays
Create Date: 2026-10-12
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0009_drop_product_tables"
down_revision: Union[str, Sequence[str], None] = "0008_artist_overplays"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS music_listens")
    op.execute("DROP TABLE IF EXISTS music_users")
    op.execute("DROP TABLE IF EXISTS music_artists")
    op.execute("DROP TABLE IF EXISTS deliveries")
    op.execute("DROP TABLE IF EXISTS destinations")
    op.execute("DROP TABLE IF EXISTS identity_links")
    op.execute("DROP TABLE IF EXISTS events")
    op.execute("DROP TABLE IF EXISTS profiles")


def downgrade() -> None:
    op.execute(
        """
        CREATE TABLE events (
            message_id   TEXT PRIMARY KEY,
            anonymous_id TEXT,
            user_id      TEXT,
            event        TEXT NOT NULL,
            properties   JSONB NOT NULL DEFAULT '{}'::jsonb,
            event_timestamp TIMESTAMPTZ NOT NULL,
            received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute("CREATE INDEX idx_events_received_at ON events (received_at)")
    op.execute("CREATE INDEX idx_events_user_id ON events (user_id)")
    op.execute("CREATE INDEX idx_events_anonymous_id ON events (anonymous_id)")
    op.execute(
        """
        CREATE TABLE profiles (
            user_id      TEXT PRIMARY KEY,
            anonymous_id TEXT,
            traits       JSONB NOT NULL DEFAULT '{}'::jsonb,
            updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute("CREATE INDEX idx_profiles_updated_at ON profiles (updated_at)")
    op.execute("CREATE INDEX idx_profiles_anonymous_id ON profiles (anonymous_id)")
    op.execute(
        """
        CREATE TABLE identity_links (
            id           TEXT PRIMARY KEY,
            anonymous_id TEXT NOT NULL UNIQUE,
            user_id      TEXT NOT NULL REFERENCES profiles (user_id) ON DELETE CASCADE,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute("CREATE INDEX idx_identity_links_user_id ON identity_links (user_id)")
    op.execute(
        """
        CREATE TABLE destinations (
            id                TEXT PRIMARY KEY,
            name              TEXT NOT NULL,
            url               TEXT NOT NULL,
            enabled           BOOLEAN NOT NULL DEFAULT TRUE,
            event_name_filter TEXT,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute("CREATE INDEX idx_destinations_enabled ON destinations (enabled)")
    op.execute(
        """
        CREATE TABLE deliveries (
            id               TEXT PRIMARY KEY,
            destination_id   TEXT NOT NULL REFERENCES destinations (id) ON DELETE CASCADE,
            message_id       TEXT NOT NULL REFERENCES events (message_id) ON DELETE CASCADE,
            status           TEXT NOT NULL DEFAULT 'pending',
            attempt_count    INTEGER NOT NULL DEFAULT 0,
            next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_status_code INTEGER,
            last_error       TEXT,
            created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (destination_id, message_id)
        )
        """
    )
    op.execute("CREATE INDEX idx_deliveries_status_next ON deliveries (status, next_attempt_at)")
    op.execute("CREATE INDEX idx_deliveries_message_id ON deliveries (message_id)")
    op.execute(
        """
        CREATE TABLE music_artists (
            id           TEXT PRIMARY KEY,
            name         TEXT NOT NULL,
            musical_rank INTEGER NOT NULL,
            overplays    INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    op.execute(
        """
        CREATE TABLE music_users (
            id   TEXT PRIMARY KEY,
            name TEXT NOT NULL
        )
        """
    )
    op.execute(
        """
        CREATE TABLE music_listens (
            id         TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL REFERENCES music_users (id) ON DELETE CASCADE,
            artist_id  TEXT NOT NULL REFERENCES music_artists (id) ON DELETE CASCADE,
            play_count INTEGER NOT NULL,
            UNIQUE (user_id, artist_id)
        )
        """
    )
    op.execute("CREATE INDEX idx_music_listens_user ON music_listens (user_id)")
