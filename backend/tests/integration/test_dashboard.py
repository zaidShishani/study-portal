from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core.time import today_for
from app.models.decks import Card, Deck
from app.models.events import Event
from app.models.problems import Problem
from app.models.roadmaps import Checkpoint, Roadmap
from app.models.users import User

URL = "/api/dashboard/today"
EMPTY = {"decks": [], "due_card_total": 0, "problems_due": [], "events_today": [], "roadmaps": []}


def get(client: TestClient) -> dict:
    r = client.get(URL)
    assert r.status_code == 200, r.text
    return r.json()


def card(deck: Deck, due: date | None, **kw) -> Card:
    return Card(deck_id=deck.id, front="f", back="b", stage=0, due_date=due, **kw)


def problem(user_id: int, title: str, due: date | None, **kw) -> Problem:
    return Problem(user_id=user_id, title=title, difficulty="Hard", pattern="DP", stage=0, due_date=due, **kw)


def seed_due(db: Session, user_id: int, today: date) -> tuple[Deck, Deck]:
    a, b, empty = Deck(user_id=user_id, title="A"), Deck(user_id=user_id, title="B"), Deck(user_id=user_id, title="E")
    db.add_all([a, b, empty])
    db.flush()
    retired = datetime.now(UTC)
    db.add_all(
        [
            card(a, today - timedelta(days=5)),  # overdue counts
            card(a, today),
            card(a, today + timedelta(days=1)),
            card(a, today, retired_at=retired),
            card(a, None, retired_at=retired),
            card(b, today),
            card(empty, today + timedelta(days=3)),
            problem(user_id, "Overdue", today - timedelta(days=2)),
            problem(user_id, "Today", today),
            problem(user_id, "Tomorrow", today + timedelta(days=1)),
            problem(user_id, "Retired", today, retired_at=retired),
            problem(user_id, "Retired undated", None, retired_at=retired),
        ]
    )
    db.flush()
    return a, b


def test_due_cards_and_problems(client: TestClient, db: Session):
    today = today_for(db.get(User, 1))
    a, b = seed_due(db, 1, today)
    body = get(client)
    assert body["date"] == today.isoformat()
    assert body["decks"] == [{"id": a.id, "title": "A", "due_count": 2}, {"id": b.id, "title": "B", "due_count": 1}]
    assert body["due_card_total"] == 3
    assert [(p["title"], p["difficulty"], p["due_date"]) for p in body["problems_due"]] == [
        ("Overdue", "Hard", (today - timedelta(days=2)).isoformat()),
        ("Today", "Hard", today.isoformat()),
    ]


def test_roadmaps_progress(client: TestClient, db: Session):
    full, bare = Roadmap(user_id=1, title="Full"), Roadmap(user_id=1, title="Bare")
    db.add_all([full, bare])
    db.flush()
    db.add_all(
        [
            Checkpoint(roadmap_id=full.id, position=i, title=str(i), done_at=datetime.now(UTC) if i < 2 else None)
            for i in range(3)
        ]
    )
    db.flush()
    assert get(client)["roadmaps"] == [
        {"id": full.id, "title": "Full", "done": 2, "total": 3},
        {"id": bare.id, "title": "Bare", "done": 0, "total": 0},
    ]


def test_events_today(client: TestClient, db: Session):
    user = db.get(User, 1)
    user.timezone = "Asia/Amman"
    tz = ZoneInfo(user.timezone)
    today = today_for(user)
    at = lambda d, h: datetime.combine(d, time(h), tz)  # noqa: E731
    weekly = Event(user_id=1, title="Weekly", start_at=at(today - timedelta(days=14), 9), rrule="FREQ=WEEKLY")
    other_day = Event(user_id=1, title="Other day", start_at=at(today - timedelta(days=13), 8), rrule="FREQ=WEEKLY")
    one_off = Event(user_id=1, title="One-off", start_at=at(today, 7), end_at=at(today, 8))
    tomorrow = Event(user_id=1, title="Tomorrow", start_at=at(today + timedelta(days=1), 0))
    ended = Event(user_id=1, title="Ended", start_at=at(today - timedelta(days=1), 22), end_at=at(today, 0))
    overnight = Event(user_id=1, title="Overnight", start_at=at(today - timedelta(days=1), 22), end_at=at(today, 2))
    bad = Event(user_id=1, title="Bad", start_at=at(today, 10), rrule="FREQ=DAILY")
    db.add_all([weekly, other_day, one_off, tomorrow, ended, overnight, bad])
    db.flush()
    db.execute(update(Event).where(Event.id == bad.id).values(rrule="FREQ=HOURLY"))  # bypasses API validation

    events = get(client)["events_today"]
    assert [e["title"] for e in events] == ["Overnight", "One-off", "Weekly"]
    assert datetime.fromisoformat(events[0]["start"]) == at(today - timedelta(days=1), 22)
    assert events[1]["event_id"] == one_off.id and events[1]["all_day"] is False
    assert datetime.fromisoformat(events[1]["start"]) == at(today, 7)
    assert datetime.fromisoformat(events[1]["end"]) == at(today, 8)
    assert datetime.fromisoformat(events[2]["start"]) == at(today, 9) and events[2]["end"] is None


def test_timezone_changes_today(client: TestClient, db: Session):
    user = db.get(User, 1)
    # UTC+14 and UTC-11 are 25h apart, so their dates always differ.
    user.timezone = "Pacific/Kiritimati"
    ahead = today_for(user)
    deck = Deck(user_id=1, title="d")
    db.add(deck)
    db.flush()
    db.add_all([card(deck, ahead), problem(1, "p", ahead)])
    db.flush()
    body = get(client)
    assert body["date"] == ahead.isoformat() and body["due_card_total"] == 1 and len(body["problems_due"]) == 1

    user.timezone = "Pacific/Pago_Pago"
    db.flush()
    body = get(client)
    assert body["date"] == today_for(user).isoformat() != ahead.isoformat()
    assert body["decks"] == [] and body["due_card_total"] == 0 and body["problems_due"] == []


def seed_roadmap(db: Session, user_id: int, done: int, total: int) -> Roadmap:
    roadmap = Roadmap(user_id=user_id, title="r")
    db.add(roadmap)
    db.flush()
    db.add_all(
        Checkpoint(roadmap_id=roadmap.id, position=i, title="c", done_at=datetime.now(UTC) if i < done else None)
        for i in range(total)
    )
    db.flush()
    return roadmap


def test_other_users_data_absent(client: TestClient, db: Session, other_user: User):
    today = today_for(db.get(User, 1))
    seed_due(db, 1, today)
    seed_roadmap(db, 1, done=2, total=3)
    db.add(Event(user_id=1, title="e", start_at=datetime.now(UTC)))
    db.flush()
    assert get(client) == {"date": today_for(other_user).isoformat(), **EMPTY}

    # With both users seeded, the caller sees only their own counts.
    mine = Deck(user_id=other_user.id, title="mine")
    db.add(mine)
    db.flush()
    db.add(card(mine, today_for(other_user)))
    roadmap = seed_roadmap(db, other_user.id, done=1, total=1)
    body = get(client)
    assert body["decks"] == [{"id": mine.id, "title": "mine", "due_count": 1}] and body["due_card_total"] == 1
    assert body["roadmaps"] == [{"id": roadmap.id, "title": "r", "done": 1, "total": 1}]
    assert body["problems_due"] == [] and body["events_today"] == []


def test_empty_user(client: TestClient, db: Session):
    assert get(client) == {"date": today_for(db.get(User, 1)).isoformat(), **EMPTY}
