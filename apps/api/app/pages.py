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
from app.page_integrity import content_hash
from app.schemas import PageIntegrityOut, PageOut, PageSummary, PageWrite

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


def _get_page(db: Session, page_id: str) -> Page:
    """Any signed-in user can open any page (temporary shared access)."""
    page = db.scalar(select(Page).where(Page.id == page_id))
    if page is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
    return page


def _to_out(page: Page) -> PageOut:
    return PageOut(
        id=page.id,
        title=page.title,
        chunks=page.chunks,
        locked=page.locked,
        content_hash=page.content_hash,
    )


def _require_unlocked(page: Page) -> None:
    if page.locked:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Page is locked and cannot be edited",
        )


@router.get("", response_model=list[PageSummary])
def list_pages(
    _claims: dict[str, Any] = Depends(require_entra_user),
    db: Session = Depends(get_db),
) -> list[PageSummary]:
    # Temporary: any signed-in user sees every page (owner filter restored later).
    rows = db.scalars(select(Page).order_by(Page.updated_at.desc()))
    return [
        PageSummary(id=page.id, title=page.title, locked=page.locked) for page in rows
    ]


@router.get("/{page_id}", response_model=PageOut)
def get_page(
    page_id: str,
    _claims: dict[str, Any] = Depends(require_entra_user),
    db: Session = Depends(get_db),
) -> PageOut:
    return _to_out(_get_page(db, page_id))


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
        locked=False,
        content_hash=None,
    )
    db.add(page)
    db.commit()
    db.refresh(page)
    return _to_out(page)


@router.put("/{page_id}", response_model=PageOut)
def update_page(
    page_id: str,
    body: PageWrite,
    _claims: dict[str, Any] = Depends(require_entra_user),
    db: Session = Depends(get_db),
) -> PageOut:
    page = _get_page(db, page_id)
    _require_unlocked(page)
    page.title = _title(body.title)
    page.chunks = _chunks(body)
    page.y_state = _y_state(page.title, page.chunks)
    page.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(page)
    return _to_out(page)


@router.post("/{page_id}/lock", response_model=PageOut)
def lock_page(
    page_id: str,
    body: PageWrite | None = None,
    _claims: dict[str, Any] = Depends(require_entra_user),
    db: Session = Depends(get_db),
) -> PageOut:
    """Freeze the current snapshot and store its SHA-256 fingerprint."""
    page = _get_page(db, page_id)
    if page.locked:
        return _to_out(page)
    # Prefer the editor's latest title/chunks so the hash matches what the user sees.
    if body is not None:
        page.title = _title(body.title)
        page.chunks = _chunks(body)
        page.y_state = _y_state(page.title, page.chunks)
    page.locked = True
    page.content_hash = content_hash(page.title, list(page.chunks))
    page.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(page)
    return _to_out(page)


@router.post("/{page_id}/unlock", response_model=PageOut)
def unlock_page(
    page_id: str,
    _claims: dict[str, Any] = Depends(require_entra_user),
    db: Session = Depends(get_db),
) -> PageOut:
    page = _get_page(db, page_id)
    if not page.locked:
        return _to_out(page)
    page.locked = False
    page.content_hash = None
    page.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(page)
    return _to_out(page)


@router.get("/{page_id}/integrity", response_model=PageIntegrityOut)
def verify_page_integrity(
    page_id: str,
    _claims: dict[str, Any] = Depends(require_entra_user),
    db: Session = Depends(get_db),
) -> PageIntegrityOut:
    """Recompute SHA-256 of the stored snapshot and compare to content_hash."""
    page = _get_page(db, page_id)
    computed = content_hash(page.title, list(page.chunks))
    stored = page.content_hash
    return PageIntegrityOut(
        id=page.id,
        locked=page.locked,
        content_hash=stored,
        computed_hash=computed,
        matches=bool(stored) and stored == computed,
    )


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
        _owner_oid(claims)
    except HTTPException:
        await websocket.accept()
        await websocket.close(code=1008)
        return

    db = SessionLocal()
    try:
        # Temporary: any signed-in user can join any page's collab room.
        page = db.scalar(select(Page).where(Page.id == page_id))
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
