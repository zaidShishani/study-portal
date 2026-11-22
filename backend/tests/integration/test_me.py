import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.users import User


def test_get_me_returns_user_1(client: TestClient):
    r = client.get("/api/me")
    assert r.status_code == 200
    assert r.json() == {"id": 1, "email": None, "timezone": "UTC"}


def test_patch_me_updates_and_persists_timezone(client: TestClient, db: Session):
    r = client.patch("/api/me", json={"timezone": "Asia/Amman"})
    assert r.status_code == 200
    assert r.json()["timezone"] == "Asia/Amman"
    db.expire_all()
    assert db.get(User, 1).timezone == "Asia/Amman"
    assert client.get("/api/me").json()["timezone"] == "Asia/Amman"


@pytest.mark.parametrize("tz", ["Mars/Olympus", "", "x" * 65, "UTC ", None])
def test_patch_me_rejects_invalid_timezone(client: TestClient, db: Session, tz):
    assert client.patch("/api/me", json={"timezone": tz}).status_code == 422
    db.expire_all()
    assert db.get(User, 1).timezone == "UTC"


def test_me_uses_current_user(client: TestClient, other_user: User):
    assert client.get("/api/me").json()["id"] == other_user.id
    assert client.patch("/api/me", json={"timezone": "Europe/Paris"}).json()["id"] == other_user.id
