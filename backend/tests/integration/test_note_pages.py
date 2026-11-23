from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.notes import NoteFolder, NotePage
from app.models.users import User

URL = "/api/notes/pages"
LIST_KEYS = {"id", "title", "folder_id", "updated_at"}


def make_folder(db: Session, name: str = "F", parent_id: int | None = None, user_id: int = 1) -> NoteFolder:
    folder = NoteFolder(user_id=user_id, parent_id=parent_id, name=name)
    db.add(folder)
    db.flush()
    return folder


def make_page(db: Session, title: str = "Mine", folder_id: int | None = None, user_id: int = 1) -> NotePage:
    page = NotePage(user_id=user_id, folder_id=folder_id, title=title, content="body")
    db.add(page)
    db.flush()
    return page


def test_crud(client: TestClient, db: Session):
    r = client.post(URL, json={"title": "  Graphs  ", "content": "# BFS\n"})
    assert r.status_code == 201
    page = r.json()
    assert (page["title"], page["content"], page["folder_id"]) == ("Graphs", "# BFS\n", None)
    assert db.get(NotePage, page["id"]).user_id == 1

    assert client.get(f"{URL}/{page['id']}").json() == page

    r = client.patch(f"{URL}/{page['id']}", json={"title": "Trees"})
    assert r.status_code == 200
    assert (r.json()["title"], r.json()["content"]) == ("Trees", "# BFS\n")
    r = client.patch(f"{URL}/{page['id']}", json={"content": ""})
    assert (r.json()["title"], r.json()["content"]) == ("Trees", "")

    assert client.delete(f"{URL}/{page['id']}").status_code == 204
    assert client.get(f"{URL}/{page['id']}").status_code == 404


def test_content_defaults_to_empty(client: TestClient):
    assert client.post(URL, json={"title": "x"}).json()["content"] == ""


def test_root_vs_folder_listing(client: TestClient, db: Session):
    folder = make_folder(db)
    root_page = make_page(db, "root")
    in_folder = make_page(db, "in folder", folder.id)

    r = client.get(URL)
    assert r.status_code == 200
    assert [p["id"] for p in r.json()] == [root_page.id]
    assert set(r.json()[0]) == LIST_KEYS  # no content in the list

    r = client.get(URL, params={"folder_id": folder.id})
    assert [p["id"] for p in r.json()] == [in_folder.id]
    assert r.json()[0]["folder_id"] == folder.id


def test_create_in_folder_and_move(client: TestClient, db: Session):
    a, b = make_folder(db, "a"), make_folder(db, "b")
    page = client.post(URL, json={"title": "p", "folder_id": a.id}).json()
    assert page["folder_id"] == a.id

    r = client.patch(f"{URL}/{page['id']}", json={"folder_id": b.id})
    assert r.status_code == 200 and r.json()["folder_id"] == b.id
    r = client.patch(f"{URL}/{page['id']}", json={"title": "kept in b"})
    assert r.status_code == 200 and r.json()["folder_id"] == b.id
    r = client.patch(f"{URL}/{page['id']}", json={"folder_id": None})
    assert r.status_code == 200 and r.json()["folder_id"] is None
    r = client.patch(f"{URL}/{page['id']}", json={"title": "kept at root"})
    assert r.json()["folder_id"] is None


def test_deleting_folder_deletes_its_pages(client: TestClient, db: Session):
    parent = make_folder(db, "parent")
    child = make_folder(db, "child", parent.id)
    page_ids = [make_page(db, "p1", parent.id).id, make_page(db, "p2", child.id).id]
    root_id = make_page(db, "root").id
    parent_id = parent.id
    db.commit()

    assert client.delete(f"/api/notes/folders/{parent_id}").status_code == 204
    for page_id in page_ids:
        assert client.get(f"{URL}/{page_id}").status_code == 404
    assert client.get(f"{URL}/{root_id}").status_code == 200


@pytest.mark.parametrize(
    "body",
    [
        {"title": ""},
        {"title": "   "},
        {"title": "x" * 201},
        {"title": "a\x00b"},
        {"title": None},
        {"title": "ok", "content": "x" * 200_001},
        {"title": "ok", "content": "a\x00b"},
        {"title": "ok", "content": None},
        {"title": "ok", "folder_id": True},
        {"title": "ok", "folder_id": 2_147_483_648},
        {"title": "ok", "user_id": 2},
    ],
)
def test_invalid_body_is_422(client: TestClient, db: Session, body):
    page = make_page(db)
    assert client.post(URL, json=body).status_code == 422
    assert client.patch(f"{URL}/{page.id}", json=body).status_code == 422
    db.expire_all()
    assert db.get(NotePage, page.id).title == "Mine"


def test_limits_are_accepted(client: TestClient):
    assert client.post(URL, json={"title": "x" * 200, "content": "y" * 200_000}).status_code == 201


def test_missing_page_or_folder_is_404(client: TestClient):
    assert client.get(f"{URL}/999999").status_code == 404
    assert client.patch(f"{URL}/999999", json={"title": "x"}).status_code == 404
    assert client.delete(f"{URL}/999999").status_code == 404
    assert client.post(URL, json={"title": "x", "folder_id": 999999}).status_code == 404
    assert client.get(URL, params={"folder_id": 999999}).status_code == 404


def test_other_users_pages_are_invisible(client: TestClient, db: Session, other_user: User):
    folder = make_folder(db, "User 1 folder")
    root_page = make_page(db, "User 1 root")
    foreign = make_page(db, "User 1 page", folder.id)
    own = client.post(URL, json={"title": "Other's page"}).json()

    assert [p["id"] for p in client.get(URL).json()] == [own["id"]]
    assert client.get(URL, params={"folder_id": folder.id}).status_code == 404
    assert client.get(f"{URL}/{foreign.id}").status_code == 404
    assert client.patch(f"{URL}/{foreign.id}", json={"title": "Hijacked"}).status_code == 404
    assert client.delete(f"{URL}/{root_page.id}").status_code == 404
    # Cannot put a page into user 1's folder, by create or by move.
    assert client.post(URL, json={"title": "x", "folder_id": folder.id}).status_code == 404
    r = client.patch(f"{URL}/{own['id']}", json={"title": "Renamed", "folder_id": folder.id})
    assert r.status_code == 404

    db.expire_all()
    assert (db.get(NotePage, foreign.id).title, db.get(NotePage, root_page.id).user_id) == ("User 1 page", 1)
    assert (db.get(NotePage, own["id"]).title, db.get(NotePage, own["id"]).folder_id) == ("Other's page", None)


def test_out_of_range_id_is_422(client: TestClient):
    big = 2_147_483_648
    assert client.get(f"{URL}/{big}").status_code == 422
    assert client.patch(f"{URL}/{big}", json={"title": "x"}).status_code == 422
    assert client.delete(f"{URL}/{big}").status_code == 422
    assert client.get(URL, params={"folder_id": big}).status_code == 422


RECENT = f"{URL}/recent"


def test_recent_pages_order_after_edit(client: TestClient, db: Session):
    folder = make_folder(db, "Algo")
    old, mid, new = make_page(db, "old"), make_page(db, "mid", folder.id), make_page(db, "new")
    # now() is constant within the test transaction, so give each page a distinct past time.
    for i, page in enumerate((old, mid, new)):
        page.updated_at = datetime(2020, 1, 1 + i, tzinfo=UTC)
    db.flush()

    r = client.get(RECENT)
    assert r.status_code == 200
    assert [p["id"] for p in r.json()] == [new.id, mid.id, old.id]
    assert set(r.json()[0]) == LIST_KEYS | {"folder_name"}  # no content
    assert r.json()[0]["folder_name"] is None  # root page
    assert r.json()[1]["folder_name"] == "Algo"

    assert client.patch(f"{URL}/{old.id}", json={"title": "edited"}).status_code == 200
    assert [p["id"] for p in client.get(RECENT).json()] == [old.id, new.id, mid.id]


def test_recent_pages_ties_break_by_id_desc(client: TestClient, db: Session):
    a, b = make_page(db, "a"), make_page(db, "b")  # same now() -> same updated_at
    assert [p["id"] for p in client.get(RECENT).json()] == [b.id, a.id]


def test_recent_pages_limit(client: TestClient, db: Session):
    pages = [make_page(db, f"p{i}") for i in range(10)]
    assert len(client.get(RECENT).json()) == 8
    assert [p["id"] for p in client.get(RECENT, params={"limit": 3}).json()] == [p.id for p in pages[:-4:-1]]
    assert len(client.get(RECENT, params={"limit": 20}).json()) == 10


@pytest.mark.parametrize("limit", [0, 21, -1, "x"])
def test_recent_pages_limit_bounds(client: TestClient, limit):
    assert client.get(RECENT, params={"limit": limit}).status_code == 422


def test_recent_pages_other_user_isolation(client: TestClient, db: Session, other_user: User):
    make_page(db, "User 1 root")
    make_page(db, "User 1 in folder", make_folder(db).id)
    own = make_page(db, "Other's", user_id=other_user.id)
    assert [p["id"] for p in client.get(RECENT).json()] == [own.id]


def test_recent_route_does_not_shadow_page_by_id(client: TestClient, db: Session):
    page = make_page(db)
    assert client.get(f"{URL}/{page.id}").json()["content"] == "body"
    assert client.get(RECENT).status_code == 200
