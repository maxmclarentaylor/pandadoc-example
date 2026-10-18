"""Page create, list, and fetch. Auth is overridden in conftest."""

from app.models import Page


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
    assert page_id != "Notes"

    listed = client.get("/v1/pages", headers=auth_header)
    assert listed.status_code == 200
    match = next(item for item in listed.json() if item["id"] == page_id)
    assert match == {"id": page_id, "title": "Notes"}

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
