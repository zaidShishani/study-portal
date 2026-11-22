from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.events import Event
from app.models.users import User

URL = "/api/events"
START = "2026-01-05T09:00:00Z"
OUT_KEYS = {
    "id", "title", "description", "start_at", "end_at", "all_day", "rrule",
    "remind_minutes_before", "created_at", "updated_at",
}  # fmt: skip


def make_event(db: Session, user_id: int = 1, **kw) -> Event:
    event = Event(user_id=user_id, title="Mine", start_at=datetime(2026, 1, 5, 9, tzinfo=UTC), **kw)
    db.add(event)
    db.flush()
    return event


def test_crud(client: TestClient, db: Session):
    body = {
        "title": "  Algo class  ",
        "description": "# room 4",
        "start_at": "2026-01-05T12:00:00+03:00",
        "end_at": "2026-01-05T11:00:00Z",
        "rrule": "FREQ=WEEKLY;BYDAY=MO",
        "remind_minutes_before": 15,
    }
    r = client.post(URL, json=body)
    assert r.status_code == 201
    ev = r.json()
    assert set(ev) == OUT_KEYS
    assert ev["title"] == "Algo class" and ev["all_day"] is False
    assert datetime.fromisoformat(ev["start_at"]) == datetime(2026, 1, 5, 9, tzinfo=UTC)
    assert db.get(Event, ev["id"]).user_id == 1

    assert client.get(f"{URL}/{ev['id']}").json() == ev

    r = client.patch(f"{URL}/{ev['id']}", json={"title": "Moved", "all_day": True})
    assert r.status_code == 200
    assert (r.json()["title"], r.json()["all_day"], r.json()["rrule"]) == ("Moved", True, body["rrule"])

    # Explicit null clears optional fields; omitted fields are kept.
    nulls = {"description": None, "end_at": None, "rrule": None, "remind_minutes_before": None}
    r = client.patch(f"{URL}/{ev['id']}", json=nulls)
    assert r.status_code == 200
    assert {k: r.json()[k] for k in nulls} == nulls and r.json()["title"] == "Moved"

    assert client.delete(f"{URL}/{ev['id']}").status_code == 204
    assert client.get(f"{URL}/{ev['id']}").status_code == 404


def test_minimal_create_defaults(client: TestClient):
    ev = client.post(URL, json={"title": "x", "start_at": START}).json()
    assert {k: ev[k] for k in ("description", "end_at", "all_day", "rrule", "remind_minutes_before")} == {
        "description": None, "end_at": None, "all_day": False, "rrule": None, "remind_minutes_before": None,
    }  # fmt: skip


def test_end_before_start_rejected(client: TestClient, db: Session):
    assert client.post(URL, json={"title": "x", "start_at": START, "end_at": "2026-01-05T08:59:59Z"}).status_code == 422
    assert client.post(URL, json={"title": "x", "start_at": START, "end_at": START}).status_code == 201
    event = make_event(db, end_at=datetime(2026, 1, 5, 10, tzinfo=UTC))
    # The merged result is checked: moving start past the stored end fails and changes nothing.
    assert client.patch(f"{URL}/{event.id}", json={"start_at": "2026-01-05T11:00:00Z"}).status_code == 422
    assert client.patch(f"{URL}/{event.id}", json={"end_at": "2026-01-05T08:00:00Z"}).status_code == 422
    db.refresh(event)
    assert event.start_at == datetime(2026, 1, 5, 9, tzinfo=UTC)
    r = client.patch(f"{URL}/{event.id}", json={"start_at": "2026-01-05T11:00:00Z", "end_at": None})
    assert r.status_code == 200


@pytest.mark.parametrize(
    "rule",
    ["nope", "FREQ=HOURLY", "FREQ=MINUTELY", "FREQ=DAILY;BYHOUR=1,2", "FREQ=DAILY;INTERVAL=0",
     "EXRULE:FREQ=DAILY", "RRULE:FREQ=DAILY\nEXRULE:FREQ=WEEKLY", "FREQ=DAILY;UNTIL=20260105",
     "FREQ=DAILY;" + "COUNT=1;" * 70, "FREQ=DAILY\x00"],
)  # fmt: skip
def test_invalid_rrule_rejected(client: TestClient, db: Session, rule: str):
    assert client.post(URL, json={"title": "x", "start_at": START, "rrule": rule}).status_code == 422
    event = make_event(db)
    assert client.patch(f"{URL}/{event.id}", json={"rrule": rule}).status_code == 422
    db.refresh(event)
    assert event.rrule is None


def test_rrule_revalidated_against_new_start(client: TestClient, db: Session):
    event = make_event(db, rrule="FREQ=DAILY")
    # Naive datetimes are rejected by the schema.
    assert client.patch(f"{URL}/{event.id}", json={"start_at": "2026-01-05T09:00:00"}).status_code == 422
    r = client.patch(f"{URL}/{event.id}", json={"start_at": "2026-02-01T09:00:00Z"})
    assert r.status_code == 200


@pytest.mark.parametrize("value,status", [(0, 201), (10080, 201), (-1, 422), (10081, 422)])
def test_remind_bounds(client: TestClient, value: int, status: int):
    r = client.post(URL, json={"title": "x", "start_at": START, "remind_minutes_before": value})
    assert r.status_code == status


@pytest.mark.parametrize(
    "field,value",
    [
        ("remind_minutes_before", True),
        ("remind_minutes_before", "5"),
        ("remind_minutes_before", 5.0),
        ("all_day", 1),
        ("all_day", "true"),
        ("start_at", 1767603600),
        ("start_at", "2026-01-05T09:00:00"),  # naive
        ("start_at", "2201-01-01T00:00:00Z"),  # outside the year range
        ("rrule", 1),
        ("title", ""),
        ("title", "   "),
        ("title", "x" * 201),
        ("title", "a\x00b"),
        ("description", "x" * 10_001),
        ("description", "a\x00b"),
        ("user_id", 2),
        ("id", 5),
        ("created_at", START),
    ],
)
def test_strict_types_and_extra_fields(client: TestClient, db: Session, field: str, value: object):
    assert client.post(URL, json={"title": "x", "start_at": START, field: value}).status_code == 422
    event = make_event(db)
    assert client.patch(f"{URL}/{event.id}", json={field: value}).status_code == 422


@pytest.mark.parametrize("field", ["title", "start_at", "all_day"])
def test_patch_null_on_required_field_rejected(client: TestClient, db: Session, field: str):
    event = make_event(db)
    assert client.patch(f"{URL}/{event.id}", json={field: None}).status_code == 422


def test_missing_required_fields(client: TestClient):
    assert client.post(URL, json={"title": "x"}).status_code == 422
    assert client.post(URL, json={"start_at": START}).status_code == 422


def test_other_users_event_is_404_on_every_route(client: TestClient, db: Session, other_user: User):
    event = make_event(db, user_id=1)
    assert client.get(f"{URL}/{event.id}").status_code == 404
    assert client.patch(f"{URL}/{event.id}", json={"title": "hijack"}).status_code == 404
    assert client.delete(f"{URL}/{event.id}").status_code == 404
    db.refresh(event)
    assert event.title == "Mine"
    # Created events belong to the caller.
    ev = client.post(URL, json={"title": "theirs", "start_at": START}).json()
    assert db.get(Event, ev["id"]).user_id == other_user.id


@pytest.mark.parametrize("event_id", ["0", "-1", "2147483648", "99999999999999999999", "abc"])
def test_bad_ids(client: TestClient, event_id: str):
    for method in ("get", "delete"):
        assert getattr(client, method)(f"{URL}/{event_id}").status_code == 422
    assert client.patch(f"{URL}/{event_id}", json={"title": "x"}).status_code == 422


def test_missing_id_is_404(client: TestClient):
    assert client.get(f"{URL}/2147483647").status_code == 404
