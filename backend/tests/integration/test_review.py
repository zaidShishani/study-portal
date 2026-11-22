from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.time import today_for
from app.models.decks import Card, Deck
from app.models.users import User


@pytest.fixture
def today(db: Session) -> date:
    return today_for(db.get(User, 1))


@pytest.fixture
def deck(db: Session) -> Deck:
    deck = Deck(user_id=1, title="User 1 deck")
    db.add(deck)
    db.flush()
    return deck


def add_card(db: Session, deck: Deck, due_date: date | None, stage: int = 0, **fields) -> Card:
    card = Card(deck_id=deck.id, front="f", back="b", stage=stage, due_date=due_date, **fields)
    db.add(card)
    db.flush()
    return card


def queue_ids(client: TestClient, query: str = "") -> list[int]:
    r = client.get(f"/api/review/cards{query}")
    assert r.status_code == 200
    return [c["id"] for c in r.json()]


def test_queue_contents_and_order(client: TestClient, db: Session, deck: Deck, today: date):
    due_today = add_card(db, deck, today)
    overdue = add_card(db, deck, today - timedelta(days=3), stage=2)
    add_card(db, deck, today + timedelta(days=1), stage=1)  # future
    add_card(db, deck, None, stage=4, retired_at=datetime.now(UTC))  # retired
    also_today = add_card(db, deck, today)

    assert queue_ids(client) == [overdue.id, due_today.id, also_today.id]


def test_queue_deck_filter(client: TestClient, db: Session, deck: Deck, today: date):
    other_deck = Deck(user_id=1, title="Second")
    db.add(other_deck)
    db.flush()
    mine = add_card(db, deck, today)
    theirs = add_card(db, other_deck, today)

    assert queue_ids(client) == [mine.id, theirs.id]
    assert queue_ids(client, f"?deck_id={deck.id}") == [mine.id]
    assert queue_ids(client, f"?deck_id={other_deck.id}") == [theirs.id]
    assert client.get("/api/review/cards?deck_id=999999").status_code == 404
    assert client.get("/api/review/cards?deck_id=2147483648").status_code == 422


def test_right_advances_and_persists(client: TestClient, db: Session, deck: Deck, today: date):
    card = add_card(db, deck, today)
    r = client.post(f"/api/cards/{card.id}/review", json={"correct": True})
    assert r.status_code == 200
    body = r.json()
    assert (body["stage"], body["due_date"], body["review_count"]) == (1, (today + timedelta(days=1)).isoformat(), 1)
    assert body["last_reviewed_at"] is not None and body["retired_at"] is None
    db.expire_all()
    assert (card.stage, card.due_date, card.review_count) == (1, today + timedelta(days=1), 1)
    assert card.id not in queue_ids(client)


def test_wrong_resets_to_stage_1_due_tomorrow(client: TestClient, db: Session, deck: Deck, today: date):
    card = add_card(db, deck, today - timedelta(days=5), stage=3, review_count=3)
    body = client.post(f"/api/cards/{card.id}/review", json={"correct": False}).json()
    assert (body["stage"], body["due_date"], body["review_count"]) == (1, (today + timedelta(days=1)).isoformat(), 4)
    db.expire_all()
    assert (card.stage, card.due_date) == (1, today + timedelta(days=1))


def test_five_rights_on_successive_due_dates_retire(
    client: TestClient, db: Session, deck: Deck, today: date, monkeypatch: pytest.MonkeyPatch
):
    card = add_card(db, deck, today)
    day = today
    monkeypatch.setattr("app.routers.review.today_for", lambda user: day)
    for expected_stage, gap in [(1, 1), (2, 3), (3, 7), (4, 21)]:
        body = client.post(f"/api/cards/{card.id}/review", json={"correct": True}).json()
        assert (body["stage"], body["due_date"]) == (expected_stage, (day + timedelta(days=gap)).isoformat())
        day += timedelta(days=gap)  # come back exactly on the due date

    body = client.post(f"/api/cards/{card.id}/review", json={"correct": True}).json()
    assert (body["stage"], body["due_date"], body["review_count"]) == (4, None, 5)
    assert body["retired_at"] is not None
    db.expire_all()
    assert card.retired_at is not None and card.due_date is None
    assert card.id not in queue_ids(client)
    assert card.id in [c["id"] for c in client.get(f"/api/decks/{deck.id}/cards?status=retired").json()]


def test_review_retired_or_not_due_is_409(client: TestClient, db: Session, deck: Deck, today: date):
    retired = add_card(db, deck, None, stage=4, retired_at=datetime.now(UTC))
    future = add_card(db, deck, today + timedelta(days=2), stage=1)
    for card in (retired, future):
        assert client.post(f"/api/cards/{card.id}/review", json={"correct": True}).status_code == 409
    db.expire_all()
    assert (future.stage, future.review_count, retired.stage, retired.review_count) == (1, 0, 4, 0)


def test_unretire(client: TestClient, db: Session, deck: Deck, today: date):
    card = add_card(db, deck, None, stage=4, retired_at=datetime.now(UTC))
    body = client.post(f"/api/cards/{card.id}/unretire").json()
    assert (body["stage"], body["due_date"], body["retired_at"]) == (1, (today + timedelta(days=1)).isoformat(), None)
    db.expire_all()
    assert (card.stage, card.retired_at) == (1, None)
    assert client.post(f"/api/cards/{card.id}/unretire").status_code == 409


@pytest.mark.parametrize(
    "payload",
    [{"correct": "yes"}, {"correct": 1}, {}, {"correct": True, "stage": 4}, {"correct": True, "today": "2099-01-01"}],
)
def test_invalid_review_body_is_422(client: TestClient, db: Session, deck: Deck, today: date, payload):
    card = add_card(db, deck, today)
    assert client.post(f"/api/cards/{card.id}/review", json=payload).status_code == 422
    db.expire_all()
    assert (card.stage, card.review_count) == (0, 0)


def test_missing_or_out_of_range_card_ids(client: TestClient):
    for path in ("review", "unretire"):
        assert client.post(f"/api/cards/999999/{path}", json={"correct": True}).status_code == 404
        assert client.post(f"/api/cards/2147483648/{path}", json={"correct": True}).status_code == 422


def test_other_user_gets_404(client: TestClient, db: Session, deck: Deck, today: date, other_user: User):
    due = add_card(db, deck, today)
    retired = add_card(db, deck, None, stage=4, retired_at=datetime.now(UTC))

    assert queue_ids(client) == []
    assert client.get(f"/api/review/cards?deck_id={deck.id}").status_code == 404
    assert client.post(f"/api/cards/{due.id}/review", json={"correct": True}).status_code == 404
    assert client.post(f"/api/cards/{retired.id}/unretire").status_code == 404

    db.expire_all()
    assert (due.stage, due.review_count, retired.retired_at is not None) == (0, 0, True)
