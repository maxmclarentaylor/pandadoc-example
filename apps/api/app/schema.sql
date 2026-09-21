-- Optional reference schema. Runtime tables come from SQLAlchemy
-- (app/orm.py → Base.metadata.create_all on API startup).

CREATE TABLE IF NOT EXISTS events (
    message_id   TEXT PRIMARY KEY,
    anonymous_id TEXT,
    user_id      TEXT,
    event        TEXT NOT NULL,
    properties   JSONB NOT NULL DEFAULT '{}'::jsonb,
    event_timestamp TIMESTAMPTZ NOT NULL,
    received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_received_at ON events (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events (user_id);
CREATE INDEX IF NOT EXISTS idx_events_anonymous_id ON events (anonymous_id);

CREATE TABLE IF NOT EXISTS profiles (
    user_id      TEXT PRIMARY KEY,
    anonymous_id TEXT,
    traits       JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_anonymous_id ON profiles (anonymous_id);
