import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.decks import Deck

PROBLEM = {"difficulty": "Easy", "pattern": "Two Pointers"}
EVENT = {"start_at": "2026-01-05T09:00:00Z"}
# url, extra body fields, text field under test; "{deck}" is filled per test.
CASES = [
    ("/api/decks", {}, "title"),
    ("/api/decks/{deck}/cards", {"back": "b"}, "front"),
    ("/api/decks/{deck}/cards", {"front": "f"}, "back"),
    ("/api/notes/pages", {}, "title"),
    ("/api/notes/pages", {"title": "t"}, "content"),
    ("/api/problems", PROBLEM, "title"),
    ("/api/problems", {"title": "t", **PROBLEM}, "notes"),
    ("/api/events", EVENT, "title"),
    ("/api/events", {"title": "t", **EVENT}, "description"),
]


@pytest.fixture
def deck(db: Session) -> Deck:
    deck = Deck(user_id=1, title="d")
    db.add(deck)
    db.flush()
    return deck


def post(client: TestClient, url: str, body: dict):
    # ensure_ascii keeps a lone surrogate as a "\ud83d" escape, like a raw client would send.
    return client.post(url, content=json.dumps(body), headers={"Content-Type": "application/json"})


@pytest.mark.parametrize(("url", "extra", "field"), CASES)
def test_lone_surrogate_is_422(client: TestClient, deck: Deck, url: str, extra: dict, field: str):
    r = post(client, url.format(deck=deck.id), {**extra, field: "a\ud83db"})
    assert r.status_code == 422
    assert r.json()["detail"][0]["loc"] == ["body", field]


@pytest.mark.parametrize(("url", "extra", "field"), CASES)
def test_emoji_is_accepted(client: TestClient, deck: Deck, url: str, extra: dict, field: str):
    r = post(client, url.format(deck=deck.id), {**extra, field: "study \U0001f4da \U0001f9e0"})
    assert r.status_code == 201
    assert r.json()[field] == "study \U0001f4da \U0001f9e0"
