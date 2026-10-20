"""Tests for the health endpoint."""

from fastapi.testclient import TestClient

from app.main import app

client: TestClient = TestClient(app)


def test_health_returns_ok() -> None:
    """GET /health returns 200 and the exact documented body."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "ocularcheck-ai"}
