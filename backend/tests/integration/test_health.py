from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

client = TestClient(app)


def test_health_returns_ok():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_cors_allows_only_frontend_origin():
    allowed = client.get("/api/health", headers={"Origin": settings.frontend_origin})
    assert allowed.headers["access-control-allow-origin"] == settings.frontend_origin
    denied = client.get("/api/health", headers={"Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in denied.headers
