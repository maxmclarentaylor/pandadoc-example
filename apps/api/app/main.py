# Telemetry must run before FastAPI is imported (Azure Monitor FastAPI instrumentor).
from app.telemetry import setup_telemetry

setup_telemetry()

from datetime import datetime, timezone
from typing import Any
import os

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app import crud
from app.auth import require_entra_user
from app.db import get_db, init_db
from app.schemas import EventRecord, IdentifyUser, ProfileRecord, TrackEvent

app = FastAPI(
    title="segment-practice API",
    version="0.1.0",
    description="v0 Segment-like track/identify + Mixpanel-like recent events",
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


@app.get("/v1/me")
def me(claims: dict[str, Any] = Depends(require_entra_user)) -> dict[str, Any]:
    """Prove login: API decodes the Entra access token and returns who you are."""
    return {
        "oid": claims.get("oid"),
        "name": claims.get("name"),
        "preferred_username": claims.get("preferred_username") or claims.get("upn"),
        "scp": claims.get("scp"),
        "aud": claims.get("aud"),
        "iss": claims.get("iss"),
    }


@app.post("/v1/track", status_code=201)
def track(
    event: TrackEvent,
    _claims: dict[str, Any] = Depends(require_entra_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    if not event.anonymous_id and not event.user_id:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one of anonymous_id or user_id",
        )

    event_timestamp = event.timestamp or datetime.now(timezone.utc)
    written_id = crud.insert_event(
        db,
        message_id=event.message_id,
        anonymous_id=event.anonymous_id,
        user_id=event.user_id,
        event=event.event,
        properties=event.properties,
        event_timestamp=event_timestamp,
    )

    if written_id is None:
        return {"status": "duplicate", "message_id": event.message_id}

    return {"status": "ok", "message_id": event.message_id}


@app.get("/v1/events", response_model=list[EventRecord])
def list_events(
    limit: int = Query(default=20, ge=1, le=100),
    _claims: dict[str, Any] = Depends(require_entra_user),
    db: Session = Depends(get_db),
) -> list[EventRecord]:
    rows = crud.list_events(db, limit=limit)
    return [EventRecord.model_validate(row) for row in rows]


@app.post("/v1/identify", status_code=201)
def identify(
    body: IdentifyUser,
    _claims: dict[str, Any] = Depends(require_entra_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Upsert a user profile. New traits merge over existing keys (Segment-style)."""
    profile = crud.upsert_profile(
        db,
        user_id=body.user_id,
        anonymous_id=body.anonymous_id,
        traits=body.traits,
    )
    return {
        "status": "ok",
        "user_id": profile.user_id,
        "traits": profile.traits,
    }


@app.get("/v1/profiles", response_model=list[ProfileRecord])
def list_profiles(
    limit: int = Query(default=20, ge=1, le=100),
    _claims: dict[str, Any] = Depends(require_entra_user),
    db: Session = Depends(get_db),
) -> list[ProfileRecord]:
    rows = crud.list_profiles(db, limit=limit)
    return [ProfileRecord.model_validate(row) for row in rows]
