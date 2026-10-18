"""Saved editor pages. Every route requires a valid Entra access token."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, status
from fastapi.websockets import WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import decode_entra_token, require_entra_user
from app.db import SessionLocal, get_db
from app.models import Page
from app.schemas import PageOut, PageSummary, PageWrite

log = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/pages", tags=["pages"])

DEFAULT_TITLE = "Untitled"


def _owner_oid(claims: dict[str, Any]) -> str:
    oid = claims.get("oid") or claims.get("sub")
    if not isinstance(oid, str) or not oid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing a user id",
        )
    return oid


def _title(raw: str) -> str:
    cleaned = raw.strip()
    return cleaned or DEFAULT_TITLE


def _chunks(body: PageWrite) -> list[dict[str, Any]]:
    return [chunk.model_dump() for chunk in body.chunks]


def _y_state(title: str, chunks: list[dict[str, Any]]) -> bytes | None:
    try:
        from app.collab import encode_page
    except ImportError:
        log.warning("pycrdt is not installed; collaboration is off until the API runs on Python 3.10+")
        return None
    return encode_page(title, chunks)


def _get_owned_page(db: Session, page_id: str, owner_oid: str) -> Page:
    page = db.scalar(select(Page).where(Page.id == page_id, Page.owner_oid == owner_oid))
    if page is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
    return page


def _to_out(page: Page) -> PageOut:
    return PageOut(id=page.id, title=page.title, chunks=page.chunks)


@router.get("", response_model=list[PageSummary])
def list_pages(
    claims: dict[str, Any] = Depends(require_entra_user),
    db: Session = Depends(get_db),
) -> list[PageSummary]:
    owner_oid = _owner_oid(claims)
    rows = db.scalars(
        select(Page).where(Page.owner_oid == owner_oid).order_by(Page.updated_at.desc())
    )
    return [PageSummary(id=page.id, title=page.title) for page in rows]


@router.get("/{page_id}", response_model=PageOut)
def get_page(
    page_id: str,
    claims: dict[str, Any] = Depends(require_entra_user),
    db: Session = Depends(get_db),
) -> PageOut:
    page = _get_owned_page(db, page_id, _owner_oid(claims))
    return _to_out(page)


@router.post("", response_model=PageOut, status_code=status.HTTP_201_CREATED)
def create_page(
    body: PageWrite,
    claims: dict[str, Any] = Depends(require_entra_user),
    db: Session = Depends(get_db),
) -> PageOut:
    title = _title(body.title)
    chunks = _chunks(body)
    page = Page(
        id=str(uuid.uuid4()),
        owner_oid=_owner_oid(claims),
        title=title,
        chunks=chunks,
        y_state=_y_state(title, chunks),
    )
    db.add(page)
    db.commit()
    db.refresh(page)
    return _to_out(page)


@router.put("/{page_id}", response_model=PageOut)
def update_page(
    page_id: str,
    body: PageWrite,
    claims: dict[str, Any] = Depends(require_entra_user),
    db: Session = Depends(get_db),
) -> PageOut:
    page = _get_owned_page(db, page_id, _owner_oid(claims))
    page.title = _title(body.title)
    page.chunks = _chunks(body)
    page.y_state = _y_state(page.title, page.chunks)
    page.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(page)
    return _to_out(page)


class _Socket:
    """Starlette socket shaped the way a Yjs room expects a channel."""

    def __init__(self, websocket: WebSocket, path: str) -> None:
        self._websocket = websocket
        self.path = path

    def __aiter__(self) -> _Socket:
        return self

    async def __anext__(self) -> bytes:
        while True:
            try:
                message = await self._websocket.receive()
            except WebSocketDisconnect:
                raise StopAsyncIteration
            if message["type"] == "websocket.disconnect":
                raise StopAsyncIteration
            data = message.get("bytes")
            if isinstance(data, bytes) and data:
                return data

    async def send(self, message: bytes) -> None:
        await self._websocket.send_bytes(message)

    async def recv(self) -> bytes:
        return await self.__anext__()


@router.websocket("/{page_id}/ws")
async def page_collab(
    websocket: WebSocket,
    page_id: str,
    token: str = Query(default=""),
) -> None:
    """Sync one page. The token is the same Entra access token used on the REST routes."""
    try:
        claims = decode_entra_token(token)
        owner_oid = _owner_oid(claims)
    except HTTPException:
        await websocket.accept()
        await websocket.close(code=1008)
        return

    db = SessionLocal()
    try:
        page = db.scalar(select(Page).where(Page.id == page_id, Page.owner_oid == owner_oid))
        if page is None:
            await websocket.accept()
            await websocket.close(code=1008)
            return
        title = page.title
        chunks = list(page.chunks)
        state = page.y_state
    finally:
        db.close()

    try:
        from app.collab import room_for
    except ImportError:
        log.warning("pycrdt is not installed; collaboration is off until the API runs on Python 3.10+")
        await websocket.accept()
        await websocket.close(code=1011)
        return

    await websocket.accept()
    room = await room_for(page_id, title, chunks, state)
    await room.serve(_Socket(websocket, page_id))
