from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.events import Event, Notification
from app.models.users import User
from app.services.notifications import sync

URL = "/api/notifications"


def add(db: Session, minutes_ago: int, user_id: int = 1, title: str = "Class") -> Event:
    start = datetime.now(UTC).replace(microsecond=0) - timedelta(minutes=minutes_ago)
    event = Event(user_id=user_id, title=title, start_at=start, remind_minutes_before=0)
    db.add(event)
    db.commit()
    return event


def test_list_twice_never_duplicates(client: TestClient, db: Session):
    event = add(db, 5)
    first = client.get(URL)
    assert first.status_code == 200
    (n,) = first.json()
    assert set(n) == {"id", "event_id", "title", "occurrence_start", "fire_at"}
    assert (n["event_id"], n["title"]) == (event.id, "Class")
    assert datetime.fromisoformat(n["occurrence_start"]) == event.start_at
    assert client.get(URL).json() == first.json()
    assert db.scalar(select(func.count()).select_from(Notification)) == 1


def test_read_and_read_all(client: TestClient, db: Session):
    add(db, 1)
    add(db, 2)
    add(db, 3)
    ids = [n["id"] for n in client.get(URL).json()]
    assert len(ids) == 3

    assert client.post(f"{URL}/{ids[0]}/read").status_code == 204
    assert client.post(f"{URL}/{ids[0]}/read").status_code == 204  # idempotent
    assert [n["id"] for n in client.get(URL).json()] == ids[1:]

    assert client.post(f"{URL}/read-all").status_code == 204
    assert client.get(URL).json() == []
    assert client.post(f"{URL}/read-all").status_code == 204
    assert client.post(f"{URL}/999999/read").status_code == 404


def test_other_user_cannot_see_or_read(client: TestClient, db: Session, other_user: User):
    add(db, 1)
    sync(db, db.get_one(User, 1), datetime.now(UTC))  # user 1's rows; the client is now other_user
    mine = db.scalar(select(Notification.id))
    assert client.get(URL).json() == []
    assert client.post(f"{URL}/{mine}/read").status_code == 404
    client.post(f"{URL}/read-all")
    assert db.get_one(Notification, mine).read_at is None


def test_deleting_event_removes_notifications(client: TestClient, db: Session):
    event = add(db, 1)
    assert len(client.get(URL).json()) == 1
    assert client.delete(f"/api/events/{event.id}").status_code == 204
    db.expire_all()
    assert db.scalar(select(func.count()).select_from(Notification)) == 0


def test_list_is_newest_first_and_capped(client: TestClient, db: Session):
    events = [add(db, i + 1, title=f"E{i}") for i in range(55)]
    body = client.get(URL).json()
    assert [n["title"] for n in body] == [e.title for e in events[:50]]
    assert db.scalar(select(func.count()).select_from(Notification)) == 55
