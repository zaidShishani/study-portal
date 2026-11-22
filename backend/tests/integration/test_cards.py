from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.time import today_for
from app.models.decks import Card, Deck
from app.models.users import User


@pytest.fixture
def deck(db: Session) -> Deck:
    deck = Deck(user_id=1, title="User 1 deck")
    db.add(deck)
    db.flush()
    return deck


def add_card(db: Session, deck: Deck, **fields) -> Card:
    card = Card(deck_id=deck.id, front="f", back="b", stage=0, due_date=today_for(db.get(User, 1)))
    for k, v in fields.items():
        setattr(card, k, v)
    db.add(card)
    db.flush()
    return card


def test_create_card_is_new_and_due_today(client: TestClient, db: Session, deck: Deck):
    r = client.post(f"/api/decks/{deck.id}/cards", json={"front": "Q", "back": "A"})
    assert r.status_code == 201
    body = r.json()
    assert (body["front"], body["back"], body["deck_id"]) == ("Q", "A", deck.id)
    assert body["stage"] == 0
    assert body["due_date"] == today_for(db.get(User, 1)).isoformat()
    assert (body["review_count"], body["retired_at"], body["last_reviewed_at"]) == (0, None, None)


def test_client_cannot_set_scheduling_fields(client: TestClient, deck: Deck):
    sneaky = {"stage": 4, "due_date": "2099-01-01", "review_count": 9, "retired_at": "2020-01-01T00:00:00Z"}
    body = client.post(f"/api/decks/{deck.id}/cards", json={"front": "Q", "back": "A", **sneaky}).json()
    assert (body["stage"], body["review_count"], body["retired_at"]) == (0, 0, None)
    assert body["due_date"] != "2099-01-01"

    patched = client.patch(f"/api/cards/{body['id']}", json={"front": "Q2", **sneaky}).json()
    assert patched["front"] == "Q2"
    assert {k: patched[k] for k in sneaky} == {k: body[k] for k in sneaky}


def test_get_patch_delete_card(client: TestClient, db: Session, deck: Deck):
    card = add_card(db, deck)
    assert client.get(f"/api/cards/{card.id}").json()["front"] == "f"

    r = client.patch(f"/api/cards/{card.id}", json={"back": "new back"})
    assert r.status_code == 200
    assert (r.json()["front"], r.json()["back"]) == ("f", "new back")

    assert client.delete(f"/api/cards/{card.id}").status_code == 204
    assert client.get(f"/api/cards/{card.id}").status_code == 404


@pytest.mark.parametrize("value", ["", "x" * 10_001, None])
def test_invalid_front_back_is_422(client: TestClient, db: Session, deck: Deck, value):
    assert client.post(f"/api/decks/{deck.id}/cards", json={"front": value, "back": "b"}).status_code == 422
    assert client.post(f"/api/decks/{deck.id}/cards", json={"front": "f", "back": value}).status_code == 422
    card = add_card(db, deck)
    if value is not None:  # null on PATCH means "leave unchanged"
        assert client.patch(f"/api/cards/{card.id}", json={"front": value}).status_code == 422
    assert db.scalar(select(func.count()).select_from(Card).where(Card.deck_id == deck.id)) == 1


def test_10k_chars_accepted(client: TestClient, deck: Deck):
    body = {"front": "x" * 10_000, "back": "y" * 10_000}
    assert client.post(f"/api/decks/{deck.id}/cards", json=body).status_code == 201


def test_status_filter(client: TestClient, db: Session, deck: Deck):
    active = add_card(db, deck)
    retired = add_card(db, deck, stage=4, due_date=None, retired_at=datetime.now(UTC))

    def ids(query: str = "") -> list[int]:
        r = client.get(f"/api/decks/{deck.id}/cards{query}")
        assert r.status_code == 200
        return [c["id"] for c in r.json()]

    assert ids() == [active.id]
    assert ids("?status=active") == [active.id]
    assert ids("?status=retired") == [retired.id]
    assert ids("?status=all") == [active.id, retired.id]
    assert client.get(f"/api/decks/{deck.id}/cards?status=bogus").status_code == 422


def test_deck_counts(client: TestClient, db: Session, deck: Deck):
    today = today_for(db.get(User, 1))
    add_card(db, deck)  # due today
    add_card(db, deck, stage=1, due_date=today - timedelta(days=2))  # overdue
    add_card(db, deck, stage=2, due_date=today + timedelta(days=3))  # not yet due
    add_card(db, deck, stage=4, due_date=None, retired_at=datetime.now(UTC))  # retired
    empty = client.post("/api/decks", json={"title": "Empty"}).json()
    assert (empty["card_count"], empty["due_count"]) == (0, 0)

    counts = {d["id"]: (d["card_count"], d["due_count"]) for d in client.get("/api/decks").json()}
    assert counts == {deck.id: (4, 2), empty["id"]: (0, 0)}
    got = client.get(f"/api/decks/{deck.id}").json()
    assert (got["card_count"], got["due_count"]) == (4, 2)
    patched = client.patch(f"/api/decks/{deck.id}", json={"title": "Renamed"}).json()
    assert (patched["card_count"], patched["due_count"]) == (4, 2)


def test_deleting_deck_deletes_its_cards(client: TestClient, db: Session, deck: Deck):
    card_ids = [add_card(db, deck).id for _ in range(2)]
    assert client.delete(f"/api/decks/{deck.id}").status_code == 204
    db.expire_all()
    assert db.scalar(select(func.count()).select_from(Card).where(Card.id.in_(card_ids))) == 0


def test_stage_check_constraint(db: Session, deck: Deck):
    with pytest.raises(IntegrityError), db.begin_nested():
        add_card(db, deck, stage=5)


def test_missing_ids_are_404(client: TestClient):
    assert client.get("/api/decks/999999/cards").status_code == 404
    assert client.post("/api/decks/999999/cards", json={"front": "f", "back": "b"}).status_code == 404
    assert client.get("/api/cards/999999").status_code == 404
    assert client.patch("/api/cards/999999", json={"front": "x"}).status_code == 404
    assert client.delete("/api/cards/999999").status_code == 404


def test_other_user_gets_404_on_every_card_route(
    client: TestClient, db: Session, deck: Deck, other_user: User
):
    card = add_card(db, deck)

    assert client.get(f"/api/decks/{deck.id}/cards").status_code == 404
    assert client.post(f"/api/decks/{deck.id}/cards", json={"front": "f", "back": "b"}).status_code == 404
    assert client.get(f"/api/cards/{card.id}").status_code == 404
    assert client.patch(f"/api/cards/{card.id}", json={"front": "Hijacked"}).status_code == 404
    assert client.delete(f"/api/cards/{card.id}").status_code == 404

    db.expire_all()
    assert db.scalars(select(Card).where(Card.deck_id == deck.id)).all() == [card]
    assert card.front == "f"
