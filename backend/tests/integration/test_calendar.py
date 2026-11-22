from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core.time import today_for
from app.models.decks import Card, Deck
from app.models.events import Event
from app.models.problems import Problem
from app.models.roadmaps import Checkpoint, Roadmap
from app.models.users import User

URL = "/api/calendar"


def seed(db: Session, user_id: int, today: date) -> dict:
    """One of everything around `today`: shown, overdue, retired/done and out-of-window rows."""
    at = datetime.combine(today, time(9), UTC)
    one_off = Event(user_id=user_id, title="Exam", start_at=at + timedelta(days=2), end_at=at + timedelta(days=2, hours=2))
    daily = Event(user_id=user_id, title="Gym", start_at=at - timedelta(days=30), rrule="FREQ=DAILY", all_day=True)
    far = Event(user_id=user_id, title="Far", start_at=at + timedelta(days=60))
    deck = Deck(user_id=user_id, title="d")
    roadmap = Roadmap(user_id=user_id, title="r")
    db.add_all([one_off, daily, far, deck, roadmap])
    db.flush()

    def card(due: date | None, **kw) -> Card:
        return Card(deck_id=deck.id, front="f", back="b", stage=0, due_date=due, **kw)

    db.add_all(
        [
            card(today - timedelta(days=5)),  # overdue -> today
            card(today),
            card(today + timedelta(days=3)),
            card(today + timedelta(days=3)),
            card(today + timedelta(days=30)),  # outside the window
            card(today, retired_at=at),
            card(None, retired_at=at),
        ]
    )

    def problem(title: str, due: date, **kw) -> Problem:
        return Problem(user_id=user_id, title=title, difficulty="Easy", pattern="DP", stage=0, due_date=due, **kw)

    overdue = problem("Overdue", today - timedelta(days=2))
    soon = problem("Soon", today + timedelta(days=4))
    db.add_all([overdue, soon, problem("Retired", today, retired_at=at), problem("Later", today + timedelta(days=30))])

    def checkpoint(title: str, target: date | None, **kw) -> Checkpoint:
        return Checkpoint(roadmap_id=roadmap.id, position=0, title=title, target_date=target, **kw)

    open_cp = checkpoint("Open", today + timedelta(days=5))
    db.add_all(
        [
            open_cp,
            checkpoint("Done", today + timedelta(days=5), done_at=at),
            checkpoint("Undated", None),
            checkpoint("Past", today - timedelta(days=10)),
        ]
    )
    db.flush()
    return {"one_off": one_off, "daily": daily, "overdue": overdue, "soon": soon, "open_cp": open_cp, "roadmap": roadmap}


def get(client: TestClient, first: date, last: date) -> dict:
    r = client.get(URL, params={"from": first.isoformat(), "to": last.isoformat()})
    assert r.status_code == 200, r.text
    return r.json()


def test_all_sections(client: TestClient, db: Session):
    today = today_for(db.get(User, 1))
    s = seed(db, 1, today)
    body = get(client, today - timedelta(days=3), today + timedelta(days=10))
    d = lambda n: (today + timedelta(days=n)).isoformat()  # noqa: E731

    assert body["truncated"] is False and "invalid_event_ids" not in body
    gym = [e for e in body["events"] if e["event_id"] == s["daily"].id]
    # Recurring: one occurrence per day of the 14-day window, at the original time of day.
    assert [datetime.fromisoformat(e["start"]).date() for e in gym] == [
        today + timedelta(days=n) for n in range(-3, 11)
    ]
    assert all(e["all_day"] and e["end"] is None and e["title"] == "Gym" for e in gym)
    exam = [e for e in body["events"] if e["event_id"] == s["one_off"].id]
    assert len(exam) == 1 and len(body["events"]) == 15  # "Far" is outside the window
    assert datetime.fromisoformat(exam[0]["end"]) - datetime.fromisoformat(exam[0]["start"]) == timedelta(hours=2)
    starts = [e["start"] for e in body["events"]]
    assert starts == sorted(starts, key=datetime.fromisoformat)

    assert body["card_due"] == [{"date": d(0), "count": 2}, {"date": d(3), "count": 2}]
    assert body["problems_due"] == [
        {"id": s["overdue"].id, "title": "Overdue", "date": d(0)},
        {"id": s["soon"].id, "title": "Soon", "date": d(4)},
    ]
    assert body["checkpoints"] == [
        {"id": s["open_cp"].id, "roadmap_id": s["roadmap"].id, "title": "Open", "date": d(5)}
    ]


def test_overdue_not_shown_when_today_outside_window(client: TestClient, db: Session):
    today = today_for(db.get(User, 1))
    seed(db, 1, today)
    body = get(client, today + timedelta(days=1), today + timedelta(days=10))
    assert [c["date"] for c in body["card_due"]] == [(today + timedelta(days=3)).isoformat()]
    assert [p["title"] for p in body["problems_due"]] == ["Soon"]


def test_timezone_changes_today_folding(client: TestClient, db: Session):
    user = db.get(User, 1)
    seed(db, 1, date(2000, 1, 1))  # everything long overdue; only folding puts it in the window
    # UTC+14 and UTC-11 are 25h apart, so their dates always differ.
    days = {}
    for tz in ("Pacific/Kiritimati", "Pacific/Pago_Pago"):
        user.timezone = tz
        db.flush()
        today = today_for(user)
        body = get(client, today - timedelta(days=1), today + timedelta(days=1))
        assert body["card_due"] == [{"date": today.isoformat(), "count": 5}]
        assert {p["date"] for p in body["problems_due"]} == {today.isoformat()}
        days[tz] = today
    assert days["Pacific/Kiritimati"] != days["Pacific/Pago_Pago"]


def test_window_is_local_midnight(client: TestClient, db: Session):
    user = db.get(User, 1)
    user.timezone = "Asia/Amman"
    db.add(Event(user_id=1, title="Late", start_at=datetime(2026, 3, 1, 23, 30, tzinfo=UTC)))  # Mar 2 in Amman
    db.flush()
    assert get(client, date(2026, 3, 1), date(2026, 3, 1))["events"] == []
    assert len(get(client, date(2026, 3, 2), date(2026, 3, 2))["events"]) == 1


def test_truncated(client: TestClient, db: Session):
    for i in range(3):
        db.add(Event(user_id=1, title=f"e{i}", start_at=datetime(2026, 1, 1, tzinfo=UTC), rrule="FREQ=DAILY"))
    db.flush()
    body = get(client, date(2026, 1, 1), date(2026, 12, 31))  # 3 x 365 occurrences
    assert body["truncated"] is True and len(body["events"]) == 1000


def test_other_users_data_absent(client: TestClient, db: Session, other_user: User):
    today = today_for(db.get(User, 1))
    seed(db, 1, today)
    body = get(client, today - timedelta(days=3), today + timedelta(days=10))
    assert body == {"events": [], "card_due": [], "problems_due": [], "checkpoints": [], "truncated": False}


@pytest.mark.parametrize(
    "params",
    [
        {"from": "2026-02-01", "to": "2026-01-31"},  # to < from
        {"from": "2026-01-01", "to": "2027-01-02"},  # 367 days
        {"from": "2026-01-01"},
        {"to": "2026-01-01"},
        {"from": "2026-13-01", "to": "2026-12-31"},
        {"from": "yesterday", "to": "2026-01-01"},
        {"from": "0001-01-01", "to": "0001-01-02"},
        {"from": "9999-12-30", "to": "9999-12-31"},
        {"from": "2026-01-01T00:00", "to": "2026-01-02"},
        {"from": "2026-01-01", "to": "2026-01-02T00:00:00Z"},
        {"from": "1767225600", "to": "2026-01-02"},
        {"from": "20260101", "to": "20260102"},
    ],
)
def test_window_validation(client: TestClient, params: dict):
    assert client.get(URL, params=params).status_code == 422


def test_full_year_allowed(client: TestClient):
    assert client.get(URL, params={"from": "2028-01-01", "to": "2028-12-31"}).status_code == 200  # 366 days


def test_recurring_keeps_local_time_across_dst(client: TestClient, db: Session):
    db.get(User, 1).timezone = "America/New_York"
    # 09:00 EDT; DST ends 2026-11-01, after which 09:00 EST is 14:00 UTC.
    db.add(Event(user_id=1, title="Class", start_at=datetime(2026, 10, 26, 13, tzinfo=UTC), rrule="FREQ=WEEKLY"))
    db.flush()
    body = get(client, date(2026, 10, 26), date(2026, 11, 9))
    ny = ZoneInfo("America/New_York")
    local = [datetime.fromisoformat(e["start"]).astimezone(ny) for e in body["events"]]
    assert [(s.date(), s.hour) for s in local] == [
        (date(2026, 10, 26), 9), (date(2026, 11, 2), 9), (date(2026, 11, 9), 9)
    ]  # fmt: skip


def test_overdue_not_shown_in_past_window(client: TestClient, db: Session):
    today = today_for(db.get(User, 1))
    seed(db, 1, today)
    body = get(client, today - timedelta(days=10), today - timedelta(days=1))
    assert body["card_due"] == [] and body["problems_due"] == []


def test_window_within_ten_years_of_today(client: TestClient, db: Session):
    today = today_for(db.get(User, 1))
    # The exact bound is 10 years from now (not today), so test a day inside and outside it.
    for first, ok in ((today - timedelta(days=3651), True), (today - timedelta(days=3654), False)):
        assert client.get(URL, params={"from": first.isoformat(), "to": first.isoformat()}).status_code == (
            200 if ok else 422
        )
    for last, ok in ((today + timedelta(days=3651), True), (today + timedelta(days=3654), False)):
        assert client.get(URL, params={"from": last.isoformat(), "to": last.isoformat()}).status_code == (
            200 if ok else 422
        )


def test_invalid_stored_rrule_is_skipped(client: TestClient, db: Session):
    at = datetime(2026, 3, 1, 9, tzinfo=UTC)
    good = Event(user_id=1, title="ok", start_at=at)
    bad = Event(user_id=1, title="bad", start_at=at, rrule="FREQ=DAILY")
    db.add_all([good, bad])
    db.flush()
    db.execute(update(Event).where(Event.id == bad.id).values(rrule="FREQ=HOURLY"))  # bypasses API validation
    db.expire_all()
    body = get(client, date(2026, 3, 1), date(2026, 3, 2))
    assert [e["event_id"] for e in body["events"]] == [good.id]
    assert body["invalid_event_ids"] == [bad.id]


def test_event_ending_at_window_start_excluded(client: TestClient, db: Session):
    # 22:00-24:00 UTC (user tz is UTC): touches Mar 2 only at its start instant.
    at = datetime(2026, 3, 1, 22, tzinfo=UTC)
    one_off = Event(user_id=1, title="one", start_at=at, end_at=at + timedelta(hours=2))
    daily = Event(user_id=1, title="daily", start_at=at, end_at=at + timedelta(hours=2), rrule="FREQ=DAILY;COUNT=1")
    db.add_all([one_off, daily])
    db.flush()
    assert get(client, date(2026, 3, 2), date(2026, 3, 2))["events"] == []
    assert len(get(client, date(2026, 3, 1), date(2026, 3, 1))["events"]) == 2


def test_derived_lists_capped(client: TestClient, db: Session):
    today = today_for(db.get(User, 1))
    db.add_all(
        Problem(user_id=1, title=f"p{i}", difficulty="Easy", pattern="DP", stage=0, due_date=today)
        for i in range(1001)
    )
    db.flush()
    body = get(client, today, today)
    assert len(body["problems_due"]) == 1000 and body["truncated"] is True
