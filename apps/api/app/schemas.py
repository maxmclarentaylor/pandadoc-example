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


class PageOut(BaseModel):
    id: str
    title: str
    chunks: list[dict[str, Any]]
