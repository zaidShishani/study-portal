import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.decks import Deck
from app.models.users import User


def make_deck(db: Session, title: str = "Mine", user_id: int = 1) -> Deck:
    deck = Deck(user_id=user_id, title=title)
    db.add(deck)
    db.flush()
    return deck


def test_create_deck_strips_title_and_returns_counts(client: TestClient, db: Session):
    r = client.post("/api/decks", json={"title": "  Graphs  "})
    assert r.status_code == 201
    body = r.json()
    assert body["title"] == "Graphs"
    assert body["card_count"] == 0 and body["due_count"] == 0
    assert db.get(Deck, body["id"]).user_id == 1


def test_list_decks_in_creation_order(client: TestClient):
    ids = [client.post("/api/decks", json={"title": t}).json()["id"] for t in ("A", "B", "C")]
    r = client.get("/api/decks")
    assert r.status_code == 200
    assert [d["id"] for d in r.json()] == ids


def test_get_patch_delete_deck(client: TestClient, db: Session):
    deck = make_deck(db)
    assert client.get(f"/api/decks/{deck.id}").json()["title"] == "Mine"

    r = client.patch(f"/api/decks/{deck.id}", json={"title": "Renamed"})
    assert r.status_code == 200
    assert r.json()["title"] == "Renamed"
    assert client.get(f"/api/decks/{deck.id}").json()["title"] == "Renamed"

    assert client.delete(f"/api/decks/{deck.id}").status_code == 204
    assert client.get(f"/api/decks/{deck.id}").status_code == 404


@pytest.mark.parametrize("title", ["", "   ", "x" * 201, None])
def test_invalid_title_is_422(client: TestClient, db: Session, title):
    assert client.post("/api/decks", json={"title": title}).status_code == 422
    deck = make_deck(db)
    assert client.patch(f"/api/decks/{deck.id}", json={"title": title}).status_code == 422
    db.expire_all()
    assert db.get(Deck, deck.id).title == "Mine"


def test_title_of_200_chars_is_accepted(client: TestClient):
    assert client.post("/api/decks", json={"title": "x" * 200}).status_code == 201


def test_missing_deck_is_404(client: TestClient):
    assert client.get("/api/decks/999999").status_code == 404
    assert client.patch("/api/decks/999999", json={"title": "x"}).status_code == 404
    assert client.delete("/api/decks/999999").status_code == 404


def test_other_users_decks_are_invisible(client: TestClient, db: Session, other_user: User):
    deck = make_deck(db, title="User 1 deck")
    own = client.post("/api/decks", json={"title": "Other's deck"}).json()

    assert [d["id"] for d in client.get("/api/decks").json()] == [own["id"]]
    assert client.get(f"/api/decks/{deck.id}").status_code == 404
    assert client.patch(f"/api/decks/{deck.id}", json={"title": "Hijacked"}).status_code == 404
    assert client.delete(f"/api/decks/{deck.id}").status_code == 404

    db.expire_all()
    unchanged = db.get(Deck, deck.id)
    assert unchanged is not None
    assert (unchanged.user_id, unchanged.title) == (1, "User 1 deck")
