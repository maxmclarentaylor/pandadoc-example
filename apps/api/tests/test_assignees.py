"""Page assignees are stored against a locked page. No email is sent."""

from app.models import Page, PageAssignee


def test_replace_assignees_on_locked_page(client, auth_header, db):
    created = client.post(
        "/v1/pages",
        headers=auth_header,
        json={
            "title": "Contract",
            "chunks": [{"id": "c1", "type": "text", "text": "Terms"}],
        },
    )
    page_id = created.json()["id"]

    blocked = client.put(
        f"/v1/pages/{page_id}/assignees",
        headers=auth_header,
        json={
            "assignees": [
                {
                    "name": "Ada",
                    "email": "ada@example.com",
                    "demo_entra_upn": "editor1@maxmclarentayloroutlook.onmicrosoft.com",
                },
            ]
        },
    )
    assert blocked.status_code == 409

    locked = client.post(
        f"/v1/pages/{page_id}/lock",
        headers=auth_header,
        json={"title": "Contract", "chunks": [{"id": "c1", "type": "text", "text": "Terms"}]},
    )
    assert locked.status_code == 200

    saved = client.put(
        f"/v1/pages/{page_id}/assignees",
        headers=auth_header,
        json={
            "assignees": [
                {
                    "name": "Ada Lovelace",
                    "email": "Ada@Example.com",
                    "demo_entra_upn": "editor1@maxmclarentayloroutlook.onmicrosoft.com",
                },
                {
                    "name": "Grace Hopper",
                    "email": "grace@example.com",
                    "demo_entra_upn": "editor2@maxmclarentayloroutlook.onmicrosoft.com",
                },
            ]
        },
    )
    assert saved.status_code == 200
    body = saved.json()
    assert len(body) == 2
    assert body[0]["name"] == "Ada Lovelace"
    assert body[0]["email"] == "ada@example.com"
    assert body[0]["sort_order"] == 0
    assert body[1]["email"] == "grace@example.com"
    assert body[1]["sort_order"] == 1

    listed = client.get(f"/v1/pages/{page_id}/assignees", headers=auth_header)
    assert listed.status_code == 200
    assert listed.json() == body

    replaced = client.put(
        f"/v1/pages/{page_id}/assignees",
        headers=auth_header,
        json={
            "assignees": [
                {
                    "name": "Only One",
                    "email": "one@example.com",
                    "demo_entra_upn": "editor1@maxmclarentayloroutlook.onmicrosoft.com",
                }
            ]
        },
    )
    assert replaced.status_code == 200
    assert len(replaced.json()) == 1
    assert db.query(PageAssignee).filter(PageAssignee.page_id == page_id).count() == 1

    db.query(PageAssignee).filter(PageAssignee.page_id == page_id).delete()
    db.query(Page).filter(Page.id == page_id).delete()
    db.commit()
