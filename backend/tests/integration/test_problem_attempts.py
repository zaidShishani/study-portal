from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.core.time import today_for
from app.models.problems import Problem
from app.models.users import User


@pytest.fixture
def today(db: Session) -> date:
    return today_for(db.get(User, 1))


def add_problem(db: Session, due_date: date | None, stage: int = 0, **fields) -> Problem:
    problem = Problem(
        user_id=1, title="p", difficulty="Easy", pattern="Stack", stage=stage, due_date=due_date, **fields
    )
    db.add(problem)
    db.flush()
    return problem


def retired_problem(db: Session) -> Problem:
    return add_problem(db, None, stage=4, retired_at=datetime.now(UTC))


def attempt(client: TestClient, problem: Problem, **body):
    return client.post(f"/api/problems/{problem.id}/attempt", json=body)


@pytest.mark.parametrize("result", ["solved", "solved_with_hint"])
def test_success_advances_ladder(client: TestClient, db: Session, today: date, result):
    p = add_problem(db, today, stage=1, review_count=1, minutes=30)
    r = attempt(client, p, result=result)
    assert r.status_code == 200
    out = r.json()
    assert (out["stage"], out["due_date"]) == (2, (today + timedelta(days=3)).isoformat())
    assert (out["last_result"], out["review_count"], out["minutes"]) == (result, 2, 30)
    assert out["solved_date"] == today.isoformat()
    db.expire_all()
    assert (p.stage, p.due_date, p.review_count, p.last_result) == (2, today + timedelta(days=3), 2, result)


def test_failed_resets_to_stage_1_due_tomorrow(client: TestClient, db: Session, today: date):
    p = add_problem(db, today - timedelta(days=4), stage=3)
    out = attempt(client, p, result="failed", minutes=45).json()
    assert (out["stage"], out["due_date"]) == (1, (today + timedelta(days=1)).isoformat())
    assert (out["last_result"], out["review_count"], out["minutes"], out["solved_date"]) == ("failed", 1, 45, None)


def test_solved_date_set_once(client: TestClient, db: Session, today: date, monkeypatch: pytest.MonkeyPatch):
    day = today
    monkeypatch.setattr("app.routers.problems.today_for", lambda user: day)
    p = add_problem(db, today)
    assert attempt(client, p, result="failed").json()["solved_date"] is None
    assert attempt(client, p, result="solved_with_hint").json()["solved_date"] == today.isoformat()
    day = today + timedelta(days=5)
    assert attempt(client, p, result="solved").json()["solved_date"] == today.isoformat()
    assert attempt(client, p, result="failed").json()["solved_date"] == today.isoformat()


def test_minutes_optional_and_bounded(client: TestClient, db: Session, today: date):
    p = add_problem(db, today, minutes=20)
    assert attempt(client, p, result="failed").json()["minutes"] == 20
    assert attempt(client, p, result="failed", minutes=None).json()["minutes"] == 20
    assert attempt(client, p, result="failed", minutes=0).json()["minutes"] == 0
    assert attempt(client, p, result="failed", minutes=1440).json()["minutes"] == 1440


def test_five_successes_retire(client: TestClient, db: Session, today: date, monkeypatch: pytest.MonkeyPatch):
    p = add_problem(db, today)
    day = today
    monkeypatch.setattr("app.routers.problems.today_for", lambda user: day)
    for expected_stage, gap in [(1, 1), (2, 3), (3, 7), (4, 21)]:
        out = attempt(client, p, result="solved").json()
        assert (out["stage"], out["due_date"]) == (expected_stage, (day + timedelta(days=gap)).isoformat())
        day += timedelta(days=gap)

    out = attempt(client, p, result="solved").json()
    assert (out["stage"], out["due_date"], out["review_count"]) == (4, None, 5)
    assert out["retired_at"] is not None
    assert p.id in [x["id"] for x in client.get("/api/problems?status=retired").json()]
    assert p.id not in [x["id"] for x in client.get("/api/problems?status=due").json()]


def test_attempt_on_retired_is_409(client: TestClient, db: Session):
    p = retired_problem(db)
    assert attempt(client, p, result="solved").status_code == 409
    db.expire_all()
    assert (p.stage, p.review_count, p.last_result, p.due_date) == (4, 0, None, None)


def test_unretire(client: TestClient, db: Session, today: date):
    p = retired_problem(db)
    out = client.post(f"/api/problems/{p.id}/unretire").json()
    assert (out["stage"], out["due_date"], out["retired_at"]) == (1, (today + timedelta(days=1)).isoformat(), None)
    assert client.post(f"/api/problems/{p.id}/unretire").status_code == 409
    assert attempt(client, p, result="solved").status_code == 200


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"result": "passed"},
        {"result": None},
        {"result": "solved", "minutes": -1},
        {"result": "solved", "minutes": 1441},
        {"result": "solved", "stage": 4},
        {"result": "solved", "today": "2099-01-01"},
        {"result": "solved", "correct": True},
    ],
)
def test_invalid_attempt_body_is_422(client: TestClient, db: Session, today: date, payload):
    p = add_problem(db, today)
    assert client.post(f"/api/problems/{p.id}/attempt", json=payload).status_code == 422
    db.expire_all()
    assert (p.stage, p.review_count) == (0, 0)


def test_missing_or_out_of_range_ids(client: TestClient):
    for path in ("attempt", "unretire"):
        assert client.post(f"/api/problems/999999/{path}", json={"result": "solved"}).status_code == 404
        assert client.post(f"/api/problems/2147483648/{path}", json={"result": "solved"}).status_code == 422


def test_other_user_gets_404_not_409(client: TestClient, db: Session, today: date, other_user: User):
    """Ownership is checked before state, so 409 never leaks a foreign problem's existence or state."""
    active = add_problem(db, today)
    retired = retired_problem(db)

    for p in (active, retired):
        assert attempt(client, p, result="solved").status_code == 404
        assert client.post(f"/api/problems/{p.id}/unretire").status_code == 404

    db.expire_all()
    assert (active.stage, active.review_count, active.last_result) == (0, 0, None)
    assert (retired.stage, retired.retired_at is not None) == (4, True)


@pytest.mark.parametrize("path", ["attempt", "unretire"])
def test_attempt_and_unretire_lock_the_problem_row(client: TestClient, db: Session, today: date, path):
    # shortcut: pins the SELECT ... FOR UPDATE instead of racing two real connections (fixtures share one).
    p = add_problem(db, today) if path == "attempt" else retired_problem(db)
    statements: list[str] = []

    def record(conn, cursor, statement, *args):
        statements.append(statement)

    conn = db.connection()
    event.listen(conn, "before_cursor_execute", record)
    try:
        assert client.post(f"/api/problems/{p.id}/{path}", json={"result": "solved"}).status_code == 200
    finally:
        event.remove(conn, "before_cursor_execute", record)
    assert any("FOR UPDATE OF problems" in s for s in statements)
