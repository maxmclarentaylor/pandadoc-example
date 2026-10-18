"""Request and response bodies for page routes."""

from typing import Any

from pydantic import BaseModel, Field


class ChunkIn(BaseModel):
    id: str
    type: str
    model_config = {"extra": "allow"}


class PageWrite(BaseModel):
    title: str = ""
    chunks: list[ChunkIn] = Field(default_factory=list)


class PageSummary(BaseModel):
    id: str
    title: str
    locked: bool = False


class PageOut(BaseModel):
    id: str
    title: str
    chunks: list[dict[str, Any]]
    locked: bool = False
    content_hash: str | None = None


class PageIntegrityOut(BaseModel):
    """Re-hash the frozen snapshot and compare to the stored fingerprint."""

    id: str
    locked: bool
    content_hash: str | None
    computed_hash: str
    matches: bool
