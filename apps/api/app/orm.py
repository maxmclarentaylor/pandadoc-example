"""SQLAlchemy ORM table classes (the database shape)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, Index, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        Index("idx_events_received_at", "received_at"),
        Index("idx_events_user_id", "user_id"),
        Index("idx_events_anonymous_id", "anonymous_id"),
    )

    message_id: Mapped[str] = mapped_column(Text, primary_key=True)
    anonymous_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    user_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    event: Mapped[str] = mapped_column(Text, nullable=False)
    properties: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    event_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class Profile(Base):
    __tablename__ = "profiles"
    __table_args__ = (
        Index("idx_profiles_updated_at", "updated_at"),
        Index("idx_profiles_anonymous_id", "anonymous_id"),
    )

    user_id: Mapped[str] = mapped_column(Text, primary_key=True)
    anonymous_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    traits: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
