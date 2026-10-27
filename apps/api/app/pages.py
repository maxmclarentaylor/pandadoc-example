"""Saved editor pages. Every route requires a valid Entra access token."""

from __future__ import annotations

import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, WebSocket, status
from fastapi.websockets import WebSocketDisconnect
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.auth import decode_entra_token, require_entra_user
from app.db import SessionLocal, get_db
from app.email_send import EmailConfigError, EmailSendError, send_signing_invite
from app.models import Page, PageAssignee
from app.page_integrity import content_hash
from app.page_pdf import CompletionRecord, CompletionSigner, pdf_sha256, render_page_pdf
from app.page_seal import SealError, inspect_seal, seal_pdf
from app.schemas import (
    AssigneeOut,
    AssigneesWrite,
    PageIntegrityOut,
    PageOut,
    SealCheckOut,
    PageSummary,
    PageWrite,
    SigningFieldsWrite,
)

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


def _get_page(db: Session, page_id: str, *, for_update: bool = False) -> Page:
    """Any signed-in user can open any page (temporary shared access)."""
    stmt = select(Page).where(Page.id == page_id)
    if for_update:
        stmt = stmt.with_for_update()
    page = db.scalar(stmt)
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
        emails_sent=page.emails_sent,
        signing_complete=page.signing_complete,
        sealed=page.sealed_at is not None,
        sealed_at=page.sealed_at,
        pdf_hash=page.pdf_hash,
        has_pdf=bool(page.pdf_bytes),
    )


def _store_pdf(page: Page) -> None:
    """Render the frozen snapshot to PDF and store bytes + hash on the row."""
    pdf = render_page_pdf(page.title, list(page.chunks))
    page.pdf_bytes = pdf
    page.pdf_hash = pdf_sha256(pdf)


def _to_summary(page: Page) -> PageSummary:
    return PageSummary(
        id=page.id,
        title=page.title,
        locked=page.locked,
        emails_sent=page.emails_sent,
        signing_complete=page.signing_complete,
    )


def _require_unlocked(page: Page) -> None:
    if page.locked:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Page is locked and cannot be edited",
        )


def _require_locked(page: Page) -> None:
    if not page.locked:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Page must be locked before managing assignees",
        )


SIGNABLE_CHUNK_TYPES = frozenset({"signature", "date"})


def _chunk_fingerprint(chunk: dict[str, Any]) -> str:
    return json.dumps(chunk, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _merge_signing_chunks(
    stored: list[dict[str, Any]],
    incoming: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Allow signature/date field edits only; everything else must stay identical."""
    if len(stored) != len(incoming):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Signing cannot add, remove, or reorder blocks",
        )
    merged: list[dict[str, Any]] = []
    for old, new in zip(stored, incoming, strict=True):
        if old.get("id") != new.get("id") or old.get("type") != new.get("type"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Signing cannot change block structure",
            )
        kind = str(old.get("type") or "")
        if kind in SIGNABLE_CHUNK_TYPES:
            merged.append(new)
            continue
        if _chunk_fingerprint(old) != _chunk_fingerprint(new):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only signature and date fields can change on a locked page",
            )
        merged.append(old)
    return merged


def _assignee_out(row: PageAssignee) -> AssigneeOut:
    return AssigneeOut(
        id=row.id,
        name=row.name,
        email=row.email,
        demo_entra_upn=row.demo_entra_upn,
        signed_at=row.signed_at,
        sort_order=row.sort_order,
    )


def _claims_upn(claims: dict[str, Any]) -> str:
    raw = claims.get("preferred_username") or claims.get("upn") or ""
    if not isinstance(raw, str) or not raw.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token is missing preferred_username",
        )
    return raw.strip().lower()


def _signature_chunks_complete(chunks: list[dict[str, Any]]) -> bool:
    signatures = [c for c in chunks if str(c.get("type") or "") == "signature"]
    if not signatures:
        return False
    return all(str(c.get("dataUrl") or "").startswith("data:image") for c in signatures)


def _assignees_all_signed(assignees: list[PageAssignee]) -> bool:
    if not assignees:
        return False
    return all(row.signed_at is not None for row in assignees)


@router.get("", response_model=list[PageSummary])
def list_pages(
    _claims: dict[str, Any] = Depends(require_entra_user),
    db: Session = Depends(get_db),
) -> list[PageSummary]:
    # Temporary: any signed-in user sees every page (owner filter restored later).
    rows = db.scalars(select(Page).order_by(Page.updated_at.desc()))
    return [_to_summary(page) for page in rows]


@router.get("/to-sign", response_model=list[PageSummary])
def list_pages_to_sign(
    _claims: dict[str, Any] = Depends(require_entra_user),
    db: Session = Depends(get_db),
) -> list[PageSummary]:
    """Locked pages marked as sent for signature. Email delivery comes later."""
    rows = db.scalars(
        select(Page)
        .where(Page.locked.is_(True), Page.emails_sent.is_(True))
        .order_by(Page.updated_at.desc())
    )
    return [_to_summary(page) for page in rows]


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
        emails_sent=False,
        signing_complete=False,
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


@router.post("/{page_id}/signing-fields", response_model=PageOut)
def update_signing_fields(
    page_id: str,
    body: SigningFieldsWrite,
    claims: dict[str, Any] = Depends(require_entra_user),
    db: Session = Depends(get_db),
) -> PageOut:
    """Persist signature/date edits, mark the matching assignee signed, maybe seal.

    The request that completes signing renders the final PDF, seals it, and
    commits signing_complete together with sealed_at.
    """
    page = _get_page(db, page_id, for_update=True)
    _require_locked(page)
    if not page.emails_sent:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Page must be sent for signature before signing fields can change",
        )
    if page.signing_complete:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Signing is already complete for this page",
        )

    upn = _claims_upn(claims)
    assignees = list(
        db.scalars(
            select(PageAssignee)
            .where(PageAssignee.page_id == page.id)
            .order_by(PageAssignee.sort_order, PageAssignee.created_at)
        )
    )
    allowed = [row.demo_entra_upn for row in assignees]
    logging.getLogger("uvicorn.error").info("allowed %s", allowed)

    matched = next((row for row in assignees if row.demo_entra_upn == upn), None)
    if matched is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Signed-in user is not an assignee for this page",
        )

    incoming = [chunk.model_dump() for chunk in body.chunks]
    page.chunks = _merge_signing_chunks(list(page.chunks), incoming)
    page.y_state = _y_state(page.title, list(page.chunks))
    page.content_hash = content_hash(page.title, list(page.chunks))
    if matched.signed_at is None:
        matched.signed_at = datetime.now(timezone.utc)

    complete = _assignees_all_signed(assignees) and _signature_chunks_complete(list(page.chunks))
    sealed_at = datetime.now(timezone.utc) if complete else None
    try:
        if complete and sealed_at is not None:
            pdf = render_page_pdf(
                page.title,
                list(page.chunks),
                completion=CompletionRecord(
                    content_hash=page.content_hash or "",
                    sealed_at=sealed_at,
                    signers=[
                        CompletionSigner(name=row.name, email=row.email, signed_at=row.signed_at)
                        for row in assignees
                    ],
                ),
            )
            pdf = seal_pdf(pdf)
        else:
            pdf = render_page_pdf(page.title, list(page.chunks))
    except SealError as exc:
        log.exception("PDF seal failed for page %s", page_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not seal PDF: {exc}",
        ) from exc
    except Exception as exc:  # noqa: BLE001
        log.exception("PDF render failed for page %s after signing update", page_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not render PDF: {exc}",
        ) from exc
    page.pdf_bytes = pdf
    page.pdf_hash = pdf_sha256(pdf)
    page.signing_complete = complete
    page.sealed_at = sealed_at
    page.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(page)
    return _to_out(page)


@router.delete("/{page_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_page(
    page_id: str,
    _claims: dict[str, Any] = Depends(require_entra_user),
    db: Session = Depends(get_db),
) -> Response:
    """Any signed-in user can delete any page for now."""
    page = _get_page(db, page_id)
    db.delete(page)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)



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
    try:
        _store_pdf(page)
    except Exception as exc:  # noqa: BLE001
        log.exception("PDF render failed for page %s", page_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not render PDF: {exc}",
        ) from exc
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
    page.emails_sent = False
    page.signing_complete = False
    page.sealed_at = None
    page.pdf_bytes = None
    page.pdf_hash = None
    for row in db.scalars(select(PageAssignee).where(PageAssignee.page_id == page.id)):
        row.signed_at = None
    page.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(page)
    return _to_out(page)


@router.get("/{page_id}/seal", response_model=SealCheckOut)
def verify_page_seal(
    page_id: str,
    _claims: dict[str, Any] = Depends(require_entra_user),
    db: Session = Depends(get_db),
) -> SealCheckOut:
    """Check the signature embedded in the sealed PDF."""
    page = _get_page(db, page_id)
    if page.sealed_at is None or not page.pdf_bytes:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Page has not been sealed",
        )
    try:
        inspection = inspect_seal(page.pdf_bytes)
    except SealError as exc:
        log.exception("PDF seal check failed for page %s", page_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not check the seal: {exc}",
        ) from exc
    return SealCheckOut(
        id=page.id,
        intact=inspection.intact,
        field_name=inspection.field_name,
        certificate_name=inspection.certificate_name,
        self_signed=inspection.self_signed,
        sealed_at=page.sealed_at,
    )


@router.get("/{page_id}/pdf")
def download_page_pdf(
    page_id: str,
    _claims: dict[str, Any] = Depends(require_entra_user),
    db: Session = Depends(get_db),
) -> Response:
    """Download the frozen PDF for a locked page (renders on demand if missing)."""
    page = _get_page(db, page_id)
    if not page.locked:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Lock the page before downloading a PDF",
        )
    if not page.pdf_bytes:
        try:
            _store_pdf(page)
        except Exception as exc:  # noqa: BLE001
            log.exception("PDF render failed for page %s", page_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Could not render PDF: {exc}",
            ) from exc
        page.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(page)

    safe = re.sub(r"[^\w.\-]+", "_", _title(page.title)).strip("._") or "page"
    filename = f"{safe[:80]}.pdf"
    return Response(
        content=page.pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{page_id}/send", response_model=PageOut)
def mark_page_sent(
    page_id: str,
    _claims: dict[str, Any] = Depends(require_entra_user),
    db: Session = Depends(get_db),
) -> PageOut:
    """Email each assignee a signing link, then mark the page as sent."""
    page = _get_page(db, page_id)
    _require_locked(page)
    assignees = list(
        db.scalars(
            select(PageAssignee)
            .where(PageAssignee.page_id == page.id)
            .order_by(PageAssignee.sort_order, PageAssignee.created_at)
        )
    )
    if not assignees:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Add at least one assignee before sending",
        )

    failures: list[str] = []
    for assignee in assignees:
        try:
            send_signing_invite(
                to=assignee.email,
                name=assignee.name,
                page_title=page.title,
                page_id=page.id,
            )
        except (EmailConfigError, EmailSendError) as exc:
            failures.append(f"{assignee.email}: {exc}")

    if failures:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not send one or more signing emails: " + "; ".join(failures),
        )

    page.emails_sent = True
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


@router.get("/{page_id}/assignees", response_model=list[AssigneeOut])
def list_assignees(
    page_id: str,
    _claims: dict[str, Any] = Depends(require_entra_user),
    db: Session = Depends(get_db),
) -> list[AssigneeOut]:
    _get_page(db, page_id)
    rows = db.scalars(
        select(PageAssignee)
        .where(PageAssignee.page_id == page_id)
        .order_by(PageAssignee.sort_order, PageAssignee.created_at)
    )
    return [_assignee_out(row) for row in rows]


@router.put("/{page_id}/assignees", response_model=list[AssigneeOut])
def replace_assignees(
    page_id: str,
    body: AssigneesWrite,
    _claims: dict[str, Any] = Depends(require_entra_user),
    db: Session = Depends(get_db),
) -> list[AssigneeOut]:
    """Replace the full assignee list for a locked page. Does not send email."""
    page = _get_page(db, page_id)
    _require_locked(page)

    db.execute(delete(PageAssignee).where(PageAssignee.page_id == page.id))
    saved: list[PageAssignee] = []
    for index, item in enumerate(body.assignees):
        row = PageAssignee(
            id=str(uuid.uuid4()),
            page_id=page.id,
            name=item.name,
            email=item.email,
            demo_entra_upn=item.demo_entra_upn,
            sort_order=index,
        )
        db.add(row)
        saved.append(row)

    page.signing_complete = False
    page.sealed_at = None
    page.updated_at = datetime.now(timezone.utc)
    db.commit()
    for row in saved:
        db.refresh(row)
    return [_assignee_out(row) for row in saved]


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
