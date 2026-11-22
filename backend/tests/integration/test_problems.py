from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.time import today_for
from app.models.problems import Problem
from app.models.users import User

VALID = {"title": "Two Sum", "difficulty": "Easy", "pattern": "Two Pointers"}


def add_problem(db: Session, user_id: int = 1, **fields) -> Problem:
    problem = Problem(
        user_id=user_id,
        title="p",
        difficulty="Easy",
        pattern="Stack",
        stage=0,
        due_date=today_for(db.get(User, user_id)),
    )
    for k, v in fields.items():
        setattr(problem, k, v)
    db.add(problem)
    db.flush()
    return problem


def ids(r) -> list[int]:
    assert r.status_code == 200
    return [p["id"] for p in r.json()]


def test_create_problem_is_new_and_due_today(client: TestClient, db: Session):
    body = {
        **VALID,
        "link": "https://leetcode.com/problems/two-sum/",
        "key_insight": "hash map of complements",
        "notes": "# notes",
        "minutes": 15,
    }
    r = client.post("/api/problems", json=body)
    assert r.status_code == 201
    out = r.json()
    assert {k: out[k] for k in body} == body
    assert (out["user_id"], out["stage"]) == (1, 0)
    assert out["due_date"] == today_for(db.get(User, 1)).isoformat()
    assert (out["review_count"], out["retired_at"], out["last_result"], out["solved_date"]) == (0, None, None, None)


def test_create_minimal_problem(client: TestClient):
    r = client.post("/api/problems", json=VALID)
    assert r.status_code == 201
    assert (r.json()["link"], r.json()["minutes"], r.json()["notes"]) == (None, None, None)


def test_get_patch_delete_problem(client: TestClient, db: Session):
    p = add_problem(db, link="https://a.com/", minutes=10)
    assert client.get(f"/api/problems/{p.id}").json()["title"] == "p"

    r = client.patch(f"/api/problems/{p.id}", json={"difficulty": "Hard", "notes": "n"})
    assert r.status_code == 200
    out = r.json()
    assert (out["title"], out["difficulty"], out["notes"], out["minutes"]) == ("p", "Hard", "n", 10)

    r = client.patch(f"/api/problems/{p.id}", json={"link": None, "minutes": None})
    assert (r.json()["link"], r.json()["minutes"]) == (None, None)

    assert client.delete(f"/api/problems/{p.id}").status_code == 204
    assert client.get(f"/api/problems/{p.id}").status_code == 404


@pytest.mark.parametrize("field", ["title", "difficulty", "pattern"])
def test_patch_required_field_to_null_is_422(client: TestClient, db: Session, field):
    p = add_problem(db)
    assert client.patch(f"/api/problems/{p.id}", json={field: None}).status_code == 422


def test_status_filter(client: TestClient, db: Session):
    today = today_for(db.get(User, 1))
    due = add_problem(db, due_date=today - timedelta(days=2))
    future = add_problem(db, stage=2, due_date=today + timedelta(days=3))
    retired = add_problem(db, stage=4, due_date=None, retired_at=datetime.now(UTC))

    assert ids(client.get("/api/problems")) == [due.id, future.id]
    assert ids(client.get("/api/problems?status=active")) == [due.id, future.id]
    assert ids(client.get("/api/problems?status=due")) == [due.id]
    assert ids(client.get("/api/problems?status=retired")) == [retired.id]
    assert ids(client.get("/api/problems?status=all")) == [due.id, future.id, retired.id]


def test_difficulty_and_pattern_filters_combine(client: TestClient, db: Session):
    today = today_for(db.get(User, 1))
    easy_stack = add_problem(db, difficulty="Easy", pattern="Stack")
    easy_dp = add_problem(db, difficulty="Easy", pattern="DP")
    hard_dp = add_problem(db, difficulty="Hard", pattern="DP", due_date=today + timedelta(days=1))
    hard_dp_retired = add_problem(db, difficulty="Hard", pattern="DP", due_date=None, retired_at=datetime.now(UTC))
    two_word = add_problem(db, difficulty="Medium", pattern="Union Find")

    assert ids(client.get("/api/problems?difficulty=Easy")) == [easy_stack.id, easy_dp.id]
    assert ids(client.get("/api/problems?pattern=DP")) == [easy_dp.id, hard_dp.id]
    assert ids(client.get("/api/problems", params={"pattern": "Union Find"})) == [two_word.id]
    assert ids(client.get("/api/problems?difficulty=Hard&pattern=DP")) == [hard_dp.id]
    assert ids(client.get("/api/problems?difficulty=Hard&pattern=DP&status=all")) == [hard_dp.id, hard_dp_retired.id]
    assert ids(client.get("/api/problems?difficulty=Hard&pattern=DP&status=retired")) == [hard_dp_retired.id]
    assert ids(client.get("/api/problems?difficulty=Hard&status=due")) == []
    assert ids(client.get("/api/problems?pattern=DP&status=due")) == [easy_dp.id]


@pytest.mark.parametrize(
    "query", ["difficulty=easy", "pattern=Two%20pointer", "status=overdue", "difficulty="]
)
def test_bad_filter_is_422(client: TestClient, query):
    assert client.get(f"/api/problems?{query}").status_code == 422


@pytest.mark.parametrize(
    "override",
    [
        {"link": "javascript:alert(1)"},
        {"link": "ftp://example.com/x"},
        {"link": "not a url"},
        {"link": "https://example.com/" + "a" * 2048},
        {"difficulty": "Impossible"},
        {"difficulty": None},
        {"pattern": "Sorting"},
        {"title": ""},
        {"title": "   "},
        {"title": "a" * 256},
        {"title": "a\x00b"},
        {"notes": "a\x00b"},
        {"key_insight": "a" * 10_001},
        {"notes": "a" * 10_001},
        {"minutes": -1},
        {"minutes": 1441},
    ],
)
def test_invalid_input_is_422(client: TestClient, db: Session, override):
    assert client.post("/api/problems", json={**VALID, **override}).status_code == 422
    p = add_problem(db)
    assert client.patch(f"/api/problems/{p.id}", json=override).status_code == 422
    assert db.scalar(select(func.count()).select_from(Problem).where(Problem.user_id == 1)) == 1


@pytest.mark.parametrize("field", ["title", "difficulty", "pattern"])
def test_missing_required_field_is_422(client: TestClient, field):
    body = {k: v for k, v in VALID.items() if k != field}
    assert client.post("/api/problems", json=body).status_code == 422


def test_limits_accepted(client: TestClient):
    body = {**VALID, "title": "a" * 255, "notes": "a" * 10_000, "key_insight": "a" * 10_000, "minutes": 1440}
    assert client.post("/api/problems", json=body).status_code == 201
    assert client.post("/api/problems", json={**VALID, "minutes": 0}).status_code == 201


@pytest.mark.parametrize(
    "field",
    [
        {"stage": 4},
        {"due_date": "2099-01-01"},
        {"review_count": 9},
        {"retired_at": "2020-01-01T00:00:00Z"},
        {"last_result": "solved"},
        {"solved_date": "2020-01-01"},
        {"user_id": 2},
        {"id": 5},
    ],
)
def test_client_cannot_set_server_owned_fields(client: TestClient, db: Session, field):
    assert client.post("/api/problems", json={**VALID, **field}).status_code == 422
    p = add_problem(db)
    assert client.patch(f"/api/problems/{p.id}", json={"title": "x", **field}).status_code == 422
    db.expire_all()
    assert (p.title, p.stage, p.review_count, p.retired_at, p.last_result, p.user_id) == ("p", 0, 0, None, None, 1)


def test_stage_check_constraint(db: Session):
    with pytest.raises(IntegrityError), db.begin_nested():
        add_problem(db, stage=5)


def test_out_of_range_and_missing_ids(client: TestClient):
    for pid, code in [(2_147_483_648, 422), (0, 422), (999_999, 404)]:
        assert client.get(f"/api/problems/{pid}").status_code == code
        assert client.patch(f"/api/problems/{pid}", json={"title": "x"}).status_code == code
        assert client.delete(f"/api/problems/{pid}").status_code == code


def test_other_user_gets_404_and_is_excluded_from_list(client: TestClient, db: Session, other_user: User):
    p = add_problem(db, user_id=1)
    mine = add_problem(db, user_id=other_user.id, title="mine")

    assert client.get(f"/api/problems/{p.id}").status_code == 404
    assert client.patch(f"/api/problems/{p.id}", json={"title": "Hijacked"}).status_code == 404
    assert client.delete(f"/api/problems/{p.id}").status_code == 404
    for status in ["active", "due", "retired", "all"]:
        assert p.id not in ids(client.get(f"/api/problems?status={status}"))
    assert ids(client.get("/api/problems?status=all")) == [mine.id]

    created = client.post("/api/problems", json=VALID).json()
    assert created["user_id"] == other_user.id

    db.expire_all()
    assert db.get(Problem, p.id).title == "p"
