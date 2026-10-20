"""Page create, list, and fetch. Auth is overridden in conftest."""

from app.models import Page
from app.page_integrity import content_hash


def test_create_list_and_get_pages(client, auth_header, db):
    created = client.post(
        "/v1/pages",
        headers=auth_header,
        json={
            "title": "  Notes  ",
            "chunks": [{"id": "c1", "type": "text", "text": "Hello"}],
        },
    )
    assert created.status_code == 201
    body = created.json()
    page_id = body["id"]
    assert body["title"] == "Notes"
    assert body["chunks"][0]["text"] == "Hello"
    assert body["locked"] is False
    assert body["content_hash"] is None
    assert page_id != "Notes"

    listed = client.get("/v1/pages", headers=auth_header)
    assert listed.status_code == 200
    match = next(item for item in listed.json() if item["id"] == page_id)
    assert match == {"id": page_id, "title": "Notes", "locked": False, "emails_sent": False}

    fetched = client.get(f"/v1/pages/{page_id}", headers=auth_header)
    assert fetched.status_code == 200
    assert fetched.json()["chunks"] == [{"id": "c1", "type": "text", "text": "Hello"}]

    updated = client.put(
        f"/v1/pages/{page_id}",
        headers=auth_header,
        json={"title": "Revised", "chunks": [{"id": "c1", "type": "text", "text": "Updated"}]},
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Revised"

    missing = client.get("/v1/pages/does-not-exist", headers=auth_header)
    assert missing.status_code == 404

    db.query(Page).filter(Page.id == page_id).delete()
    db.commit()


def test_lock_stores_hash_and_blocks_edits(client, auth_header, db):
    created = client.post(
        "/v1/pages",
        headers=auth_header,
        json={
            "title": "Contract",
            "chunks": [{"id": "c1", "type": "text", "text": "Terms"}],
        },
    )
    page_id = created.json()["id"]
    chunks = [{"id": "c1", "type": "text", "text": "Final terms"}]

    locked = client.post(
        f"/v1/pages/{page_id}/lock",
        headers=auth_header,
        json={"title": "Contract", "chunks": chunks},
    )
    assert locked.status_code == 200
    body = locked.json()
    assert body["locked"] is True
    assert body["content_hash"] == content_hash("Contract", chunks)
    assert body["chunks"] == chunks

    blocked = client.put(
        f"/v1/pages/{page_id}",
        headers=auth_header,
        json={"title": "Changed", "chunks": chunks},
    )
    assert blocked.status_code == 409

    integrity = client.get(f"/v1/pages/{page_id}/integrity", headers=auth_header)
    assert integrity.status_code == 200
    check = integrity.json()
    assert check["matches"] is True
    assert check["content_hash"] == body["content_hash"]
    assert check["computed_hash"] == body["content_hash"]

    unlocked = client.post(f"/v1/pages/{page_id}/unlock", headers=auth_header, json={})
    assert unlocked.status_code == 200
    assert unlocked.json()["locked"] is False
    assert unlocked.json()["content_hash"] is None

    db.query(Page).filter(Page.id == page_id).delete()
    db.commit()
