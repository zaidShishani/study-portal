import logging
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.events import Event, Notification
from app.models.users import User
from app.services.notifications import sync

# shortcut: fixed dates must stay within 10 years of today (check_near_now); move them before 2035.
NOW = datetime(2026, 11, 20, 12, tzinfo=UTC)  # a Friday


@pytest.fixture
def user(db: Session) -> User:
    return db.get_one(User, 1)


def add(db: Session, start: datetime, remind: int | None = 0, **kw) -> Event:
    event = Event(user_id=1, title="E", start_at=start, remind_minutes_before=remind, **kw)
    db.add(event)
    db.flush()
    return event


def rows(db: Session) -> list[tuple[int, datetime, datetime]]:
    query = select(Notification.event_id, Notification.occurrence_start, Notification.fire_at)
    return [tuple(r) for r in db.execute(query.order_by(Notification.occurrence_start))]


def test_fires_exactly_at_boundary_not_before(db: Session, user: User):
    due = add(db, NOW + timedelta(minutes=15), remind=15)
    add(db, NOW + timedelta(minutes=15, seconds=1), remind=15)
    sync(db, user, NOW)
    assert rows(db) == [(due.id, NOW + timedelta(minutes=15), NOW)]


def test_recurring_creates_one_per_occurrence(db: Session, user: User):
    # Mon/Wed/Fri 09:00 UTC since October; firing in the last 7 days: Mon 16, Wed 18, Fri 20 (not Fri 13).
    event = add(db, datetime(2026, 10, 5, 9, tzinfo=UTC), remind=30, rrule="FREQ=WEEKLY;BYDAY=MO,WE,FR")
    sync(db, user, NOW)
    starts = [datetime(2026, 11, d, 9, tzinfo=UTC) for d in (16, 18, 20)]
    assert rows(db) == [(event.id, s, s - timedelta(minutes=30)) for s in starts]


def test_lookback_is_seven_days(db: Session, user: User):
    oldest = add(db, NOW - timedelta(days=7))
    # Started before the window but still running inside it: filtered on start, not overlap.
    add(db, NOW - timedelta(days=7, seconds=1), end_at=NOW)
    sync(db, user, NOW)
    assert rows(db) == [(oldest.id, NOW - timedelta(days=7), NOW - timedelta(days=7))]


def test_events_without_reminder_or_of_other_users_ignored(db: Session, user: User):
    add(db, NOW - timedelta(hours=1), remind=None)
    other = User(email="other@example.com")
    db.add(other)
    db.flush()
    db.add(Event(user_id=other.id, title="X", start_at=NOW - timedelta(hours=1), remind_minutes_before=0))
    db.flush()
    sync(db, user, NOW)
    assert rows(db) == []


def test_invalid_stored_rule_skipped(db: Session, user: User, caplog: pytest.LogCaptureFixture):
    bad = add(db, NOW - timedelta(hours=1), rrule="FREQ=HOURLY")  # bypasses API validation
    good = add(db, NOW - timedelta(hours=1))
    with caplog.at_level(logging.WARNING):
        sync(db, user, NOW)
    assert [r[0] for r in rows(db)] == [good.id]
    assert f"event {bad.id}" in caplog.text


def test_idempotent_and_keeps_read_state(db: Session, user: User):
    add(db, datetime(2026, 11, 1, 11, tzinfo=UTC), rrule="FREQ=DAILY")
    sync(db, user, NOW)
    first = rows(db)
    assert len(first) == 7  # 11:00 on Nov 14..20
    db.execute(Notification.__table__.update().values(read_at=NOW))
    sync(db, user, NOW + timedelta(minutes=1))
    assert rows(db) == first
    assert db.scalar(select(Notification).where(Notification.read_at.is_(None))) is None
