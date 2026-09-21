"""Database engine, sessions, and table bootstrap."""

from __future__ import annotations

import os
from collections.abc import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.orm import Base

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Copy .env.example to .env and load the "
        "postgres-connection-string secret from Key Vault."
    )

# SQLAlchemy + psycopg3 needs the +psycopg driver prefix.
_sa_url = DATABASE_URL
if _sa_url.startswith("postgresql://"):
    _sa_url = _sa_url.replace("postgresql://", "postgresql+psycopg://", 1)
elif _sa_url.startswith("postgres://"):
    _sa_url = _sa_url.replace("postgres://", "postgresql+psycopg://", 1)

engine = create_engine(_sa_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency — one session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create tables/indexes from ORM metadata if they do not already exist."""
    Base.metadata.create_all(bind=engine)
