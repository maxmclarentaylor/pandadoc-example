"""Shared page document.

The browser and this process edit the same Yjs document. Title is a text
value. Chunks are an array of maps. Text and table cells are text values so
two edits in different places both remain. Postgres stores the binary
document and a JSON snapshot of the title and chunks.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import anyio
from pycrdt import Array, Doc, Map, Text
from pycrdt.websocket import WebsocketServer, YRoom
from pycrdt.store import BaseYStore

log = logging.getLogger(__name__)

websocket_server = WebsocketServer(auto_clean_rooms=False)
_room_lock = anyio.Lock()


def encode_page(title: str, chunks: list[dict[str, Any]]) -> bytes:
    """Build a new document from a saved title and chunk list."""
    doc = Doc()
    write_page(doc, title, chunks)
    return doc.get_update()


def read_state(state: bytes) -> tuple[str, list[dict[str, Any]]]:
    doc = Doc()
    doc.apply_update(state)
    return read_page(doc)


def write_page(doc: Doc, title: str, chunks: list[dict[str, Any]]) -> None:
    doc["title"] = Text(title)
    doc["chunks"] = Array([_chunk_map(chunk) for chunk in chunks])


def read_page(doc: Doc) -> tuple[str, list[dict[str, Any]]]:
    title = doc.get("title", type=Text)
    chunks = doc.get("chunks", type=Array)
    return str(title), [item.to_py() for item in chunks]


def _chunk_map(chunk: dict[str, Any]) -> Map:
    kind = chunk.get("type") or "text"
    fields: dict[str, Any] = {"id": str(chunk.get("id") or ""), "type": kind}
    if kind == "text":
        fields["text"] = Text(str(chunk.get("text") or ""))
    elif kind == "image":
        fields["src"] = str(chunk.get("src") or "")
        fields["alt"] = str(chunk.get("alt") or "")
    elif kind == "video":
        fields["url"] = str(chunk.get("url") or "")
    elif kind == "signature":
        fields["dataUrl"] = str(chunk.get("dataUrl") or "")
    elif kind == "date":
        fields["value"] = str(chunk.get("value") or "")
    elif kind == "table":
        columns = chunk.get("columns") or []
        rows = chunk.get("rows") or []
        fields["columns"] = Array([Text(str(column)) for column in columns])
        fields["rows"] = Array(
            [Array([Text(str(cell)) for cell in row]) for row in rows]
        )
    return Map(fields)


class PageStore(BaseYStore):
    """Writes the merged document back to the pages row."""

    def __init__(self, page_id: str, doc: Doc) -> None:
        self.path = page_id
        self.page_id = page_id
        self.doc = doc
        self.metadata_callback = None
        self.log = log
        self._generation = 0

    async def read(self):
        if False:
            yield b"", b"", 0.0

    async def write(self, _update: bytes) -> None:
        self._generation += 1
        generation = self._generation
        try:
            await anyio.sleep(0.3)
            if generation != self._generation:
                return
            title, chunks = read_page(self.doc)
            state = self.doc.get_update()
            await anyio.to_thread.run_sync(save_snapshot, self.page_id, title, chunks, state)
        except Exception:
            log.exception("Could not save page %s", self.page_id)


def save_snapshot(page_id: str, title: str, chunks: list[dict[str, Any]], state: bytes) -> None:
    from app.db import SessionLocal
    from app.models import Page

    db = SessionLocal()
    try:
        page = db.get(Page, page_id)
        if page is None:
            return
        # Locked pages keep their frozen Postgres snapshot; ignore collab writes.
        if page.locked:
            return
        page.title = title.strip() or "Untitled"
        page.chunks = chunks
        page.y_state = state
        page.updated_at = datetime.now(timezone.utc)
        db.commit()
    finally:
        db.close()


def load_doc(title: str, chunks: list[dict[str, Any]], state: bytes | None) -> Doc:
    doc = Doc()
    if state:
        doc.apply_update(state)
        return doc
    write_page(doc, title, chunks)
    return doc


async def room_for(
    page_id: str,
    title: str,
    chunks: list[dict[str, Any]],
    state: bytes | None,
) -> YRoom:
    async with _room_lock:
        room = websocket_server.rooms.get(page_id)
        if room is None:
            doc = load_doc(title, chunks, state)
            if not state:
                save_snapshot(page_id, *read_page(doc), doc.get_update())
            room = YRoom(ydoc=doc, ystore=PageStore(page_id, doc), ready=True, log=log)
            websocket_server.rooms[page_id] = room
        await websocket_server.start_room(room)
        return room
