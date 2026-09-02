from datetime import datetime, timezone
from typing import Any
import os

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from psycopg.types.json import Jsonb

from app.db import get_connection, init_db
from app.models import EventRecord, TrackEvent

app = FastAPI(
    title="segment-practice API",
    version="0.1.0",
    description="v0 Segment-like track + Mixpanel-like recent events",
)

_default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
_extra_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[*_default_origins, *_extra_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/track", status_code=201)
def track(event: TrackEvent) -> dict[str, Any]:
    if not event.anonymous_id and not event.user_id:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one of anonymous_id or user_id",
        )

    event_timestamp = event.timestamp or datetime.now(timezone.utc)

    insert_sql = """
        INSERT INTO events (
            message_id, anonymous_id, user_id, event, properties, event_timestamp
        ) VALUES (
            %(message_id)s, %(anonymous_id)s, %(user_id)s, %(event)s, %(properties)s, %(event_timestamp)s
        )
        ON CONFLICT (message_id) DO NOTHING
        RETURNING message_id
    """

    params = {
        "message_id": event.message_id,
        "anonymous_id": event.anonymous_id,
        "user_id": event.user_id,
        "event": event.event,
        "properties": Jsonb(event.properties),
        "event_timestamp": event_timestamp,
    }

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(insert_sql, params)
            row = cur.fetchone()
        conn.commit()

    if row is None:
        return {"status": "duplicate", "message_id": event.message_id}

    return {"status": "ok", "message_id": event.message_id}


@app.get("/v1/events", response_model=list[EventRecord])
def list_events(limit: int = Query(default=20, ge=1, le=100)) -> list[EventRecord]:
    select_sql = """
        SELECT
            message_id,
            anonymous_id,
            user_id,
            event,
            properties,
            event_timestamp,
            received_at
        FROM events
        ORDER BY received_at DESC
        LIMIT %(limit)s
    """

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(select_sql, {"limit": limit})
            rows = cur.fetchall()

    return [EventRecord(**row) for row in rows]
