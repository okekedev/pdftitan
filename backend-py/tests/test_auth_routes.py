"""
test_auth_routes.py — unit tests for /api/technician/validate
Mocked: no live API calls.
"""
import time
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from main import app
from services.servicetitan import ServiceTitanClient, get_st_client

MOCK_TECHNICIAN = {
    "id": 123,
    "userId": 456,
    "name": "John Doe",
    "loginName": "johndoe",
    "phoneNumber": "555-123-4567",
    "email": "john@example.com",
    "active": True,
    "businessUnitId": 1,
    "mainZoneId": None,
    "zoneIds": [],
    "roleIds": [],
    "team": None,
    "isManagedTech": False,
    "dailyGoal": None,
    "burdenRate": None,
    "accountLocked": False,
    "customFields": {},
}


@pytest.fixture
def client_with_mocks(monkeypatch):
    """
    TestClient with:
    - get_st_client dependency overridden to return a MagicMock
    - _technicians_cache pre-populated so get_all_technicians returns mock data
      without hitting the API
    """
    import routers.auth as auth_module

    mock_client = MagicMock(spec=ServiceTitanClient)
    mock_client.validate_phone_match.return_value = True
    mock_client.tenant_id = "3495827745"
    mock_client.app_key = "test-app-key"
    mock_client.api_base_url = "https://api.servicetitan.io"

    # Pre-populate cache so get_all_technicians returns cached data immediately
    monkeypatch.setattr(
        auth_module,
        "_technicians_cache",
        {
            "data": [MOCK_TECHNICIAN],
            "last_fetch": time.time(),
            "expiry_minutes": 30,
        },
    )

    app.dependency_overrides[get_st_client] = lambda: mock_client
    yield TestClient(app), mock_client
    app.dependency_overrides.clear()


def test_valid_credentials_returns_200(client_with_mocks):
    client, _ = client_with_mocks
    response = client.post(
        "/api/technician/validate",
        json={"username": "johndoe", "phone": "5551234567"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["technician"]["name"] == "John Doe"
    assert data["technician"]["username"] == "johndoe"


def test_unknown_username_returns_404(client_with_mocks):
    client, _ = client_with_mocks
    response = client.post(
        "/api/technician/validate",
        json={"username": "nonexistent_user", "phone": "5551234567"},
    )
    assert response.status_code == 404


def test_wrong_phone_returns_401(client_with_mocks):
    client, mock_st = client_with_mocks
    mock_st.validate_phone_match.return_value = False
    response = client.post(
        "/api/technician/validate",
        json={"username": "johndoe", "phone": "0000000000"},
    )
    assert response.status_code == 401


def test_missing_phone_field_returns_422():
    """FastAPI validation — missing required field returns 422 Unprocessable Entity."""
    with TestClient(app) as client:
        response = client.post(
            "/api/technician/validate",
            json={"username": "johndoe"},
        )
    assert response.status_code == 422


def test_missing_username_field_returns_422():
    with TestClient(app) as client:
        response = client.post(
            "/api/technician/validate",
            json={"phone": "5551234567"},
        )
    assert response.status_code == 422


def test_response_includes_company_info(client_with_mocks):
    client, _ = client_with_mocks
    response = client.post(
        "/api/technician/validate",
        json={"username": "johndoe", "phone": "5551234567"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "company" in data
    assert "name" in data["company"]


def test_case_insensitive_username(client_with_mocks):
    client, _ = client_with_mocks
    response = client.post(
        "/api/technician/validate",
        json={"username": "JohnDoe", "phone": "5551234567"},  # uppercase
    )
    assert response.status_code == 200
