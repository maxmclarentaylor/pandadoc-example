"""
Pytest fixtures: dedicated `segment_test` DB, Alembic schema, auth bypass.

Requires Postgres reachable at TEST_DATABASE_URL (default: Compose local).
  docker compose up -d db
  # if volume already existed before init script: create DB once manually
  #   docker compose exec db psql -U segment -d segment -c 'CREATE DATABASE segment_test;'
"""

from __future__ import annotations

import os
from collections.abc import Generator
from urllib.parse import urlparse, urlunparse

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

# ---------------------------------------------------------------------------
# Force test DB + dummy Entra config BEFORE importing the app package.
# ---------------------------------------------------------------------------
_DEFAULT_TEST_DB = "postgresql://segment:segment@127.0.0.1:5432/segment_test"
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", _DEFAULT_TEST_DB)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("AZURE_TENANT_ID", "00000000-0000-0000-0000-000000000001")
os.environ.setdefault("AZURE_API_CLIENT_ID", "00000000-0000-0000-0000-000000000002")

from app.auth import require_entra_user  # noqa: E402
from app.db import get_db  # noqa: E402
from app.main import app  # noqa: E402

_API_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def _to_sqlalchemy_url(url: str) -> str:
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    return url


def _admin_url(db_url: str) -> str:
    """Connect to maintenance DB `postgres` to CREATE DATABASE."""
    parsed = urlparse(db_url)
    return urlunparse(parsed._replace(path="/postgres"))


def _ensure_database_exists(db_url: str) -> None:
    parsed = urlparse(db_url)
    db_name = parsed.path.lstrip("/") or "segment_test"
    engine = create_engine(
        _to_sqlalchemy_url(_admin_url(db_url)),
        isolation_level="AUTOCOMMIT",
        pool_pre_ping=True,
    )
    with engine.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :name"),
            {"name": db_name},
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{db_name}"'))
    engine.dispose()


def _run_migrations(sqlalchemy_url: str) -> None:
    cfg = Config(os.path.join(_API_ROOT, "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", sqlalchemy_url)
    command.upgrade(cfg, "head")


@pytest.fixture(scope="session")
def engine() -> Generator[Engine, None, None]:
    _ensure_database_exists(TEST_DATABASE_URL)
    sa_url = _to_sqlalchemy_url(TEST_DATABASE_URL)
    _run_migrations(sa_url)
    eng = create_engine(sa_url, pool_pre_ping=True)
    yield eng
    eng.dispose()


@pytest.fixture
def db(engine: Engine) -> Generator[Session, None, None]:
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db: Session) -> Generator[TestClient, None, None]:
    def _override_db() -> Generator[Session, None, None]:
        yield db

    def _override_auth() -> dict:
        return {
            "oid": "test-oid",
            "name": "Test User",
            "preferred_username": "test@example.com",
        }

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[require_entra_user] = _override_auth
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def auth_header() -> dict[str, str]:
    """Present so tests look like real calls; auth is overridden anyway."""
    return {"Authorization": "Bearer test-token"}
