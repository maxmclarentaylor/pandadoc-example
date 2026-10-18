"""Database engine and sessions. Migrations are applied from CI (not on startup)."""

from __future__ import annotations

import os
from collections.abc import Generator
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Copy .env.example to .env and load the "
        "postgres-connection-string secret from Key Vault."
    )

# SQLAlchemy + psycopg3 needs the +psycopg driver prefix.
SQLALCHEMY_URL = DATABASE_URL
if SQLALCHEMY_URL.startswith("postgresql://"):
    SQLALCHEMY_URL = SQLALCHEMY_URL.replace("postgresql://", "postgresql+psycopg://", 1)
elif SQLALCHEMY_URL.startswith("postgres://"):
    SQLALCHEMY_URL = SQLALCHEMY_URL.replace("postgres://", "postgresql+psycopg://", 1)

engine = create_engine(SQLALCHEMY_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

# Repo root for this service (apps/api) — alembic.ini lives here.
_API_ROOT = Path(__file__).resolve().parents[1]


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency — one session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_migrations() -> None:
    """Apply pending Alembic migrations up to head (used by CI / local CLI)."""
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(_API_ROOT / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", SQLALCHEMY_URL)
    command.upgrade(cfg, "head")
