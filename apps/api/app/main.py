# Telemetry must run before FastAPI is imported (Azure Monitor FastAPI instrumentor).
from app.telemetry import setup_telemetry

setup_telemetry()

from contextlib import asynccontextmanager
from typing import Any
import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import require_entra_user
from app.pages import router as pages_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        from app.collab import websocket_server
    except ImportError:
        yield
        return
    async with websocket_server:
        yield


app = FastAPI(
    title="segment-practice API",
    version="0.1.0",
    lifespan=lifespan,
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

app.include_router(pages_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[*_default_origins, *_extra_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
