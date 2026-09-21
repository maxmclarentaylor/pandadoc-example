"""Database operations used by route handlers."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.orm import Event, Profile


def insert_event(
    db: Session,
    *,
    message_id: str,
    event: str,
    anonymous_id: Optional[str],
    user_id: Optional[str],
    properties: dict[str, Any],
    event_timestamp: datetime,
) -> Optional[str]:
    """Insert an event. Returns message_id if written, None if duplicate."""
    stmt = (
        insert(Event)
        .values(
            message_id=message_id,
            anonymous_id=anonymous_id,
            user_id=user_id,
            event=event,
            properties=properties,
            event_timestamp=event_timestamp,
        )
        .on_conflict_do_nothing(index_elements=[Event.message_id])
        .returning(Event.message_id)
    )
    result = db.execute(stmt)
    db.commit()
    row = result.first()
    return row[0] if row else None


def list_events(db: Session, *, limit: int) -> list[Event]:
    stmt = select(Event).order_by(Event.received_at.desc()).limit(limit)
    return list(db.scalars(stmt).all())


def upsert_profile(
    db: Session,
    *,
    user_id: str,
    anonymous_id: Optional[str],
    traits: dict[str, Any],
) -> Profile:
    """Upsert profile; new traits merge over existing keys (JSONB ||)."""
    stmt = insert(Profile).values(
        user_id=user_id,
        anonymous_id=anonymous_id,
        traits=traits,
        updated_at=func.now(),
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[Profile.user_id],
        set_={
            "anonymous_id": func.coalesce(stmt.excluded.anonymous_id, Profile.anonymous_id),
            "traits": Profile.traits.op("||")(stmt.excluded.traits),
            "updated_at": func.now(),
        },
    ).returning(Profile)
    profile = db.execute(stmt).scalars().one()
    db.commit()
    return profile


def list_profiles(db: Session, *, limit: int) -> list[Profile]:
    stmt = select(Profile).order_by(Profile.updated_at.desc()).limit(limit)
    return list(db.scalars(stmt).all())
