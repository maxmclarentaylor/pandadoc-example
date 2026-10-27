"""Core HTTP behaviour for health, identity, and the page routes.

Auth is overridden in conftest. Email is stubbed so send does not call Resend.
"""

from app.auth import require_entra_user
from app.email_send import EmailSendError
from app.main import app
from app.models import Page

EDITOR_1 = "editor1@maxmclarentayloroutlook.onmicrosoft.com"
EDITOR_2 = "editor2@maxmclarentayloroutlook.onmicrosoft.com"
CHUNKS = [{"id": "c1", "type": "text", "text": "Terms"}]
SIGNATURE = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def _create(client, auth_header, title: str = "Contract") -> str:
    created = client.post(
        "/v1/pages",
        headers=auth_header,
        json={"title": title, "chunks": CHUNKS},
    )
    assert created.status_code == 201
    return created.json()["id"]


def _lock(client, auth_header, page_id: str) -> None:
    locked = client.post(
        f"/v1/pages/{page_id}/lock",
        headers=auth_header,
        json={"title": "Contract", "chunks": CHUNKS},
    )
    assert locked.status_code == 200


def _assign(client, auth_header, page_id: str) -> None:
    saved = client.put(
        f"/v1/pages/{page_id}/assignees",
        headers=auth_header,
        json={
            "assignees": [
                {
                    "name": "Editor One",
                    "email": "one@example.com",
                    "demo_entra_upn": EDITOR_1,
                }
            ]
        },
    )
    assert saved.status_code == 200


def _cleanup(db, page_id: str) -> None:
    row = db.get(Page, page_id)
    if row is not None:
        db.delete(row)
        db.commit()


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_me_returns_the_signed_in_user(client, auth_header):
    response = client.get("/v1/me", headers=auth_header)
    assert response.status_code == 200
    assert response.json()["oid"] == "test-oid"
    assert response.json()["name"] == "Test User"
    assert response.json()["preferred_username"] == "test@example.com"


def test_delete_removes_the_page(client, auth_header, db):
    page_id = _create(client, auth_header, title="Draft")
    try:
        deleted = client.delete(f"/v1/pages/{page_id}", headers=auth_header)
        assert deleted.status_code == 204
        missing = client.get(f"/v1/pages/{page_id}", headers=auth_header)
        assert missing.status_code == 404
    finally:
        _cleanup(db, page_id)

    absent = client.delete("/v1/pages/does-not-exist", headers=auth_header)
    assert absent.status_code == 404


def test_pages_to_sign_lists_only_sent_pages(client, auth_header, db, monkeypatch):
    monkeypatch.setattr("app.pages.send_signing_invite", lambda **_kwargs: {"id": "email-1"})
    page_id = _create(client, auth_header)
    try:
        draft = client.get("/v1/pages/to-sign", headers=auth_header)
        assert draft.status_code == 200
        assert page_id not in {item["id"] for item in draft.json()}

        _lock(client, auth_header, page_id)
        locked = client.get("/v1/pages/to-sign", headers=auth_header)
        assert page_id not in {item["id"] for item in locked.json()}

        _assign(client, auth_header, page_id)
        sent = client.post(f"/v1/pages/{page_id}/send", headers=auth_header)
        assert sent.status_code == 200
        assert sent.json()["emails_sent"] is True

        listed = client.get("/v1/pages/to-sign", headers=auth_header)
        match = next(item for item in listed.json() if item["id"] == page_id)
        assert match["locked"] is True
        assert match["emails_sent"] is True
        assert match["signing_complete"] is False
    finally:
        _cleanup(db, page_id)


def test_send_requires_an_assignee_and_reports_email_failure(client, auth_header, db, monkeypatch):
    page_id = _create(client, auth_header)
    try:
        unlocked = client.post(f"/v1/pages/{page_id}/send", headers=auth_header)
        assert unlocked.status_code == 409

        _lock(client, auth_header, page_id)
        empty = client.post(f"/v1/pages/{page_id}/send", headers=auth_header)
        assert empty.status_code == 400

        _assign(client, auth_header, page_id)

        def fail(**_kwargs):
            raise EmailSendError("provider down")

        monkeypatch.setattr("app.pages.send_signing_invite", fail)
        failed = client.post(f"/v1/pages/{page_id}/send", headers=auth_header)
        assert failed.status_code == 502
        assert client.get(f"/v1/pages/{page_id}", headers=auth_header).json()["emails_sent"] is False
    finally:
        _cleanup(db, page_id)


def test_pdf_and_seal_are_rejected_until_the_page_is_ready(client, auth_header, db):
    page_id = _create(client, auth_header)
    try:
        pdf = client.get(f"/v1/pages/{page_id}/pdf", headers=auth_header)
        assert pdf.status_code == 409

        seal = client.get(f"/v1/pages/{page_id}/seal", headers=auth_header)
        assert seal.status_code == 409

        _lock(client, auth_header, page_id)
        downloaded = client.get(f"/v1/pages/{page_id}/pdf", headers=auth_header)
        assert downloaded.status_code == 200
        assert downloaded.headers["content-type"].startswith("application/pdf")
        assert downloaded.content.startswith(b"%PDF")

        still_unsealed = client.get(f"/v1/pages/{page_id}/seal", headers=auth_header)
        assert still_unsealed.status_code == 409
    finally:
        _cleanup(db, page_id)


def test_signing_is_rejected_before_send_and_for_a_stranger(client, auth_header, db):
    page_id = _create(client, auth_header)
    try:
        _lock(client, auth_header, page_id)
        _assign(client, auth_header, page_id)

        app.dependency_overrides[require_entra_user] = lambda: {
            "oid": "editor-1",
            "name": "Editor One",
            "preferred_username": EDITOR_1,
        }
        before_send = client.post(
            f"/v1/pages/{page_id}/signing-fields",
            headers=auth_header,
            json={"chunks": CHUNKS},
        )
        assert before_send.status_code == 409

        page = db.get(Page, page_id)
        assert page is not None
        page.emails_sent = True
        db.commit()

        app.dependency_overrides[require_entra_user] = lambda: {
            "oid": "stranger",
            "name": "Stranger",
            "preferred_username": "stranger@example.com",
        }
        forbidden = client.post(
            f"/v1/pages/{page_id}/signing-fields",
            headers=auth_header,
            json={"chunks": CHUNKS},
        )
        assert forbidden.status_code == 403

        app.dependency_overrides[require_entra_user] = lambda: {
            "oid": "editor-2",
            "name": "Editor Two",
            "preferred_username": EDITOR_2,
        }
        not_assigned = client.post(
            f"/v1/pages/{page_id}/signing-fields",
            headers=auth_header,
            json={"chunks": CHUNKS},
        )
        assert not_assigned.status_code == 403
    finally:
        app.dependency_overrides[require_entra_user] = lambda: {
            "oid": "test-oid",
            "name": "Test User",
            "preferred_username": "test@example.com",
        }
        _cleanup(db, page_id)


def test_signing_is_rejected_when_already_complete(client, auth_header, db, monkeypatch):
    sealed_calls = {"count": 0}

    def fake_seal(pdf: bytes) -> bytes:
        sealed_calls["count"] += 1
        return pdf + b" sealed"

    monkeypatch.setattr("app.pages.render_page_pdf", lambda *_args, **_kwargs: b"%PDF-unsigned")
    monkeypatch.setattr("app.pages.seal_pdf", fake_seal)

    draft = [
        {"id": "c1", "type": "text", "text": "Terms"},
        {"id": "s1", "type": "signature", "dataUrl": ""},
    ]
    signed = [
        {"id": "c1", "type": "text", "text": "Terms"},
        {"id": "s1", "type": "signature", "dataUrl": SIGNATURE},
    ]
    created = client.post(
        "/v1/pages",
        headers=auth_header,
        json={"title": "Contract", "chunks": draft},
    )
    assert created.status_code == 201
    page_id = created.json()["id"]
    try:
        locked = client.post(
            f"/v1/pages/{page_id}/lock",
            headers=auth_header,
            json={"title": "Contract", "chunks": draft},
        )
        assert locked.status_code == 200
        _assign(client, auth_header, page_id)

        page = db.get(Page, page_id)
        assert page is not None
        page.emails_sent = True
        db.commit()

        app.dependency_overrides[require_entra_user] = lambda: {
            "oid": "editor-1",
            "name": "Editor One",
            "preferred_username": EDITOR_1,
        }
        finished = client.post(
            f"/v1/pages/{page_id}/signing-fields",
            headers=auth_header,
            json={"chunks": signed},
        )
        assert finished.status_code == 200
        assert finished.json()["signing_complete"] is True
        assert sealed_calls["count"] == 1

        again = client.post(
            f"/v1/pages/{page_id}/signing-fields",
            headers=auth_header,
            json={"chunks": signed},
        )
        assert again.status_code == 409
        assert again.json()["detail"] == "Signing is already complete for this page"
        assert sealed_calls["count"] == 1
    finally:
        app.dependency_overrides[require_entra_user] = lambda: {
            "oid": "test-oid",
            "name": "Test User",
            "preferred_username": "test@example.com",
        }
        _cleanup(db, page_id)
