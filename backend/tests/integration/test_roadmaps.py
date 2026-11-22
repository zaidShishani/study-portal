from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.roadmaps import Checkpoint, Roadmap
from app.models.users import User
from app.schemas.roadmaps import MAX_CHECKPOINTS

URL = "/api/roadmaps"
BIG = 2_147_483_648


def make_roadmap(db: Session, title: str = "R", user_id: int = 1) -> Roadmap:
    roadmap = Roadmap(user_id=user_id, title=title)
    db.add(roadmap)
    db.flush()
    return roadmap


def make_checkpoint(db: Session, roadmap: Roadmap, position: int, title: str = "C") -> Checkpoint:
    checkpoint = Checkpoint(roadmap_id=roadmap.id, position=position, title=title)
    db.add(checkpoint)
    db.flush()
    return checkpoint


def test_roadmap_crud(client: TestClient, db: Session):
    r = client.post(URL, json={"title": "  Backend  ", "description": "  # plan\n"})
    assert r.status_code == 201
    roadmap = r.json()
    assert (roadmap["title"], roadmap["description"]) == ("Backend", "  # plan\n")
    assert (roadmap["done_count"], roadmap["total_count"], roadmap["checkpoints"]) == (0, 0, [])
    assert db.get(Roadmap, roadmap["id"]).user_id == 1

    assert client.get(f"{URL}/{roadmap['id']}").json() == roadmap

    r = client.patch(f"{URL}/{roadmap['id']}", json={"title": "Infra"})
    assert r.status_code == 200
    assert (r.json()["title"], r.json()["description"]) == ("Infra", "  # plan\n")
    r = client.patch(f"{URL}/{roadmap['id']}", json={"description": None})
    assert (r.json()["title"], r.json()["description"]) == ("Infra", None)

    assert client.delete(f"{URL}/{roadmap['id']}").status_code == 204
    assert client.get(f"{URL}/{roadmap['id']}").status_code == 404


def test_list_counts(client: TestClient, db: Session):
    a, b = make_roadmap(db, "a"), make_roadmap(db, "b")
    for i in range(3):
        make_checkpoint(db, a, i)
    make_checkpoint(db, b, 0)
    first = db.scalars(select(Checkpoint).where(Checkpoint.roadmap_id == a.id)).first()
    assert client.patch(f"/api/checkpoints/{first.id}", json={"done": True}).status_code == 200

    r = client.get(URL)
    assert r.status_code == 200
    counts = {x["title"]: (x["done_count"], x["total_count"]) for x in r.json()}
    assert counts == {"a": (1, 3), "b": (0, 1)}
    assert "checkpoints" not in r.json()[0]


def test_checkpoint_crud_and_append_order(client: TestClient, db: Session):
    roadmap = make_roadmap(db)
    ids = []
    for title in ("one", "two", "three"):
        r = client.post(f"{URL}/{roadmap.id}/checkpoints", json={"title": title})
        assert r.status_code == 201
        ids.append(r.json()["id"])
    detail = client.get(f"{URL}/{roadmap.id}").json()
    assert [c["id"] for c in detail["checkpoints"]] == ids
    assert [c["position"] for c in detail["checkpoints"]] == [0, 1, 2]

    r = client.patch(
        f"/api/checkpoints/{ids[0]}",
        json={"title": "uno", "description": "d", "target_date": "2026-12-31"},
    )
    assert r.status_code == 200
    assert (r.json()["title"], r.json()["description"], r.json()["target_date"]) == ("uno", "d", "2026-12-31")
    r = client.patch(f"/api/checkpoints/{ids[0]}", json={"target_date": None, "description": None})
    assert (r.json()["title"], r.json()["description"], r.json()["target_date"]) == ("uno", None, None)

    assert client.delete(f"/api/checkpoints/{ids[1]}").status_code == 204
    r = client.post(f"{URL}/{roadmap.id}/checkpoints", json={"title": "four", "target_date": "2027-01-01"})
    assert r.json()["position"] == 3  # appended after the current last
    assert db.get(Checkpoint, r.json()["id"]).target_date == date(2027, 1, 1)
    detail = client.get(f"{URL}/{roadmap.id}").json()
    assert [c["title"] for c in detail["checkpoints"]] == ["uno", "three", "four"]


def test_create_checkpoint_rejects_full_roadmap(client: TestClient, db: Session):
    roadmap = make_roadmap(db)
    db.add_all(Checkpoint(roadmap_id=roadmap.id, position=i, title="C") for i in range(MAX_CHECKPOINTS))
    db.flush()
    r = client.post(f"{URL}/{roadmap.id}/checkpoints", json={"title": "one too many"})
    assert (r.status_code, r.json()["detail"]) == (409, "Roadmap is full")


def test_toggle_done(client: TestClient, db: Session):
    checkpoint = make_checkpoint(db, make_roadmap(db), 0)
    url = f"/api/checkpoints/{checkpoint.id}"
    r = client.patch(url, json={"done": True})
    assert r.status_code == 200
    done_at = r.json()["done_at"]
    assert done_at is not None
    assert client.patch(url, json={"done": True}).json()["done_at"] == done_at  # kept, not reset
    assert client.patch(url, json={"title": "x"}).json()["done_at"] == done_at
    assert client.patch(url, json={"done": False}).json()["done_at"] is None


def test_reorder(client: TestClient, db: Session):
    roadmap = make_roadmap(db)
    a, b, c = (make_checkpoint(db, roadmap, i).id for i in range(3))
    r = client.put(f"{URL}/{roadmap.id}/checkpoints/order", json={"ids": [c, a, b]})
    assert r.status_code == 200
    assert [(x["id"], x["position"]) for x in r.json()] == [(c, 0), (a, 1), (b, 2)]
    assert [x["id"] for x in client.get(f"{URL}/{roadmap.id}").json()["checkpoints"]] == [c, a, b]


def test_reorder_empty_roadmap(client: TestClient, db: Session):
    roadmap = make_roadmap(db)
    r = client.put(f"{URL}/{roadmap.id}/checkpoints/order", json={"ids": []})
    assert (r.status_code, r.json()) == (200, [])


@pytest.mark.parametrize(
    "case", ["missing", "empty", "extra", "duplicate", "duplicate_same_length", "foreign", "other_roadmap"]
)
def test_reorder_rejects_bad_ids(client: TestClient, db: Session, case: str):
    roadmap = make_roadmap(db)
    a, b = (make_checkpoint(db, roadmap, i).id for i in range(2))
    sibling = make_checkpoint(db, make_roadmap(db), 0).id
    db.add(stranger := User(email="stranger@example.com"))
    db.flush()
    foreign = make_checkpoint(db, make_roadmap(db, user_id=stranger.id), 0).id
    ids = {
        "missing": [a],
        "empty": [],
        "extra": [a, b, BIG - 1],
        "duplicate": [a, b, a],
        "duplicate_same_length": [a, a],
        "foreign": [a, b, foreign],
        "other_roadmap": [a, sibling],
    }[case]
    r = client.put(f"{URL}/{roadmap.id}/checkpoints/order", json={"ids": ids})
    assert r.status_code == 400
    assert [db.get(Checkpoint, i).position for i in (a, b)] == [0, 1]  # unchanged


def test_delete_roadmap_cascades_checkpoints(client: TestClient, db: Session):
    roadmap = make_roadmap(db)
    ids = [make_checkpoint(db, roadmap, i).id for i in range(2)]
    assert client.delete(f"{URL}/{roadmap.id}").status_code == 204
    db.expire_all()
    assert db.scalars(select(Checkpoint).where(Checkpoint.id.in_(ids))).all() == []


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"title": ""},
        {"title": "   "},
        {"title": "x" * 201},
        {"title": "a\x00b"},
        {"title": "ok", "description": "x" * 10_001},
        {"title": "ok", "description": "a\x00b"},
        {"title": "ok", "user_id": 2},
    ],
)
def test_roadmap_validation(client: TestClient, db: Session, body: dict):
    assert client.post(URL, json=body).status_code == 422
    roadmap = make_roadmap(db)
    if body:
        assert client.patch(f"{URL}/{roadmap.id}", json=body).status_code == 422


def test_roadmap_patch_null_title(client: TestClient, db: Session):
    roadmap = make_roadmap(db)
    assert client.patch(f"{URL}/{roadmap.id}", json={"title": None}).status_code == 422


@pytest.mark.parametrize(
    "body",
    [
        {"title": ""},
        {"title": "x" * 201},
        {"title": "a\x00b"},
        {"title": "ok", "description": "x" * 10_001},
        {"title": "ok", "target_date": "not a date"},
        {"title": "ok", "position": 5},
        {"title": "ok", "done_at": "2026-01-01T00:00:00Z"},
    ],
)
def test_checkpoint_create_validation(client: TestClient, db: Session, body: dict):
    roadmap = make_roadmap(db)
    assert client.post(f"{URL}/{roadmap.id}/checkpoints", json=body).status_code == 422


@pytest.mark.parametrize(
    "body",
    [
        {"title": None},
        {"title": "  "},
        {"done": None},
        {"done": "yes"},
        {"done": 1},
        {"done_at": "2026-01-01T00:00:00Z"},
        {"position": 0},
    ],
)
def test_checkpoint_patch_validation(client: TestClient, db: Session, body: dict):
    checkpoint = make_checkpoint(db, make_roadmap(db), 0)
    assert client.patch(f"/api/checkpoints/{checkpoint.id}", json=body).status_code == 422


@pytest.mark.parametrize("ids", [[True], ["1"], [0], [BIG], list(range(1, 1002)), "x", None])
def test_reorder_validation(client: TestClient, db: Session, ids: object):
    roadmap = make_roadmap(db)
    assert client.put(f"{URL}/{roadmap.id}/checkpoints/order", json={"ids": ids}).status_code == 422


def test_huge_path_ids(client: TestClient):
    assert client.get(f"{URL}/{BIG}").status_code == 422
    assert client.patch(f"{URL}/{BIG}", json={"title": "x"}).status_code == 422
    assert client.delete(f"{URL}/{BIG}").status_code == 422
    assert client.post(f"{URL}/{BIG}/checkpoints", json={"title": "x"}).status_code == 422
    assert client.put(f"{URL}/{BIG}/checkpoints/order", json={"ids": []}).status_code == 422
    assert client.patch(f"/api/checkpoints/{BIG}", json={"title": "x"}).status_code == 422
    assert client.delete(f"/api/checkpoints/{BIG}").status_code == 422


def test_other_user_gets_404(client: TestClient, db: Session, other_user: User):
    roadmap = make_roadmap(db, user_id=1)
    checkpoint = make_checkpoint(db, roadmap, 0)

    assert client.get(URL).json() == []
    assert client.get(f"{URL}/{roadmap.id}").status_code == 404
    assert client.patch(f"{URL}/{roadmap.id}", json={"title": "x"}).status_code == 404
    assert client.delete(f"{URL}/{roadmap.id}").status_code == 404
    assert client.post(f"{URL}/{roadmap.id}/checkpoints", json={"title": "x"}).status_code == 404
    # 404 even with otherwise-valid ids, and before the 400 that bad ids would give.
    order = f"{URL}/{roadmap.id}/checkpoints/order"
    assert client.put(order, json={"ids": [checkpoint.id]}).status_code == 404
    assert client.put(order, json={"ids": []}).status_code == 404
    assert client.patch(f"/api/checkpoints/{checkpoint.id}", json={"done": True}).status_code == 404
    assert client.delete(f"/api/checkpoints/{checkpoint.id}").status_code == 404

    db.expire_all()
    assert db.get(Roadmap, roadmap.id).title == "R"
    assert (db.get(Checkpoint, checkpoint.id).done_at, db.get(Checkpoint, checkpoint.id).position) == (None, 0)


def test_reorder_own_roadmap_with_other_users_ids(client: TestClient, db: Session, other_user: User):
    theirs = make_checkpoint(db, make_roadmap(db, user_id=1), 0)
    mine = make_roadmap(db, user_id=other_user.id)
    own = make_checkpoint(db, mine, 0)
    r = client.put(f"{URL}/{mine.id}/checkpoints/order", json={"ids": [own.id, theirs.id]})
    assert r.status_code == 400
    r = client.put(f"{URL}/{mine.id}/checkpoints/order", json={"ids": [theirs.id]})
    assert r.status_code == 400
    db.expire_all()
    assert db.get(Checkpoint, theirs.id).position == 0
