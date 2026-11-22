import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.notes import NoteFolder
from app.models.users import User

URL = "/api/notes/folders"


def make_folder(db: Session, name: str = "Mine", parent_id: int | None = None, user_id: int = 1) -> NoteFolder:
    folder = NoteFolder(user_id=user_id, parent_id=parent_id, name=name)
    db.add(folder)
    db.flush()
    return folder


def make_chain(db: Session) -> list[NoteFolder]:
    """root > child > grandchild > great-grandchild."""
    chain = [make_folder(db, "root")]
    for name in ("child", "grandchild", "great"):
        chain.append(make_folder(db, name, chain[-1].id))
    return chain


def test_create_nested_and_list(client: TestClient, db: Session):
    parent_id = None
    created = []
    for name in ("  A  ", "B", "C", "D"):
        r = client.post(URL, json={"name": name, "parent_id": parent_id})
        assert r.status_code == 201
        created.append(r.json())
        parent_id = r.json()["id"]

    assert created[0]["name"] == "A" and created[0]["parent_id"] is None
    assert [f["parent_id"] for f in created[1:]] == [f["id"] for f in created[:-1]]
    assert db.get(NoteFolder, created[0]["id"]).user_id == 1

    r = client.get(URL)
    assert r.status_code == 200
    assert r.json() == created


def test_rename_keeps_parent(client: TestClient, db: Session):
    root = make_folder(db, "root")
    child = make_folder(db, "child", root.id)
    r = client.patch(f"{URL}/{child.id}", json={"name": "Renamed"})
    assert r.status_code == 200
    assert r.json() == {"id": child.id, "parent_id": root.id, "name": "Renamed"}


def test_move_to_other_parent_and_to_root(client: TestClient, db: Session):
    a, b = make_folder(db, "a"), make_folder(db, "b")
    child = make_folder(db, "child", a.id)

    r = client.patch(f"{URL}/{child.id}", json={"parent_id": b.id})
    assert r.status_code == 200 and r.json()["parent_id"] == b.id

    r = client.patch(f"{URL}/{child.id}", json={"parent_id": None})
    assert r.status_code == 200 and r.json() == {"id": child.id, "parent_id": None, "name": "child"}


@pytest.mark.parametrize("target", [0, 1, 2], ids=["self", "child", "grandchild"])
def test_cycle_is_rejected(client: TestClient, db: Session, target: int):
    chain = make_chain(db)
    r = client.patch(f"{URL}/{chain[0].id}", json={"parent_id": chain[target].id})
    assert r.status_code == 400
    db.expire_all()
    assert db.get(NoteFolder, chain[0].id).parent_id is None


def test_delete_removes_subtree(client: TestClient, db: Session):
    chain = make_chain(db)
    sibling = make_folder(db, "sibling")
    db.commit()

    assert client.delete(f"{URL}/{chain[1].id}").status_code == 204
    assert [f["id"] for f in client.get(URL).json()] == [chain[0].id, sibling.id]


@pytest.mark.parametrize(
    "body",
    [
        {"name": ""},
        {"name": "   "},
        {"name": "x" * 201},
        {"name": "a\x00b"},
        {"name": None},
        {"name": "ok", "user_id": 2},
    ],
)
def test_invalid_body_is_422(client: TestClient, db: Session, body):
    folder = make_folder(db)
    assert client.patch(f"{URL}/{folder.id}", json=body).status_code == 422
    assert client.post(URL, json=body).status_code == 422
    db.expire_all()
    assert db.get(NoteFolder, folder.id).name == "Mine"


def test_name_of_200_chars_is_accepted(client: TestClient):
    assert client.post(URL, json={"name": "x" * 200}).status_code == 201


def test_missing_folder_is_404(client: TestClient):
    assert client.patch(f"{URL}/999999", json={"name": "x"}).status_code == 404
    assert client.delete(f"{URL}/999999").status_code == 404
    assert client.post(URL, json={"name": "x", "parent_id": 999999}).status_code == 404


def test_other_users_folders_are_invisible(client: TestClient, db: Session, other_user: User):
    foreign = make_folder(db, "User 1 folder")
    own = client.post(URL, json={"name": "Other's folder"}).json()

    assert [f["id"] for f in client.get(URL).json()] == [own["id"]]
    assert client.patch(f"{URL}/{foreign.id}", json={"name": "Hijacked"}).status_code == 404
    assert client.delete(f"{URL}/{foreign.id}").status_code == 404
    # Cannot attach to user 1's folder, by create or by move.
    assert client.post(URL, json={"name": "x", "parent_id": foreign.id}).status_code == 404
    assert client.patch(f"{URL}/{own['id']}", json={"parent_id": foreign.id}).status_code == 404

    db.expire_all()
    unchanged = db.get(NoteFolder, foreign.id)
    assert (unchanged.user_id, unchanged.name) == (1, "User 1 folder")
    assert db.get(NoteFolder, own["id"]).parent_id is None


def test_out_of_range_id_is_422(client: TestClient):
    big = 2_147_483_648
    assert client.patch(f"{URL}/{big}", json={"name": "x"}).status_code == 422
    assert client.delete(f"{URL}/{big}").status_code == 422
    assert client.post(URL, json={"name": "x", "parent_id": big}).status_code == 422
    assert client.post(URL, json={"name": "x", "parent_id": 0}).status_code == 422
    assert client.patch(f"{URL}/1", json={"parent_id": big}).status_code == 422
