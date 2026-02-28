"""
test_servicetitan.py — mirrors backend/tests/auth/servicetitan.test.js
Live: makes real calls to ServiceTitan API. Requires .env with valid credentials.
"""
import pytest

from services.servicetitan import ServiceTitanClient


@pytest.fixture
def st():
    return ServiceTitanClient()


async def test_oauth2_returns_bearer_token(st):
    token = await st.get_access_token()
    assert token is not None
    assert isinstance(token, str)
    assert len(token) > 20, "Token looks too short"


async def test_token_is_cached(st):
    token1 = await st.get_access_token()
    token2 = await st.get_access_token()
    assert token1 == token2, "Token should be served from cache on second call"


async def test_technicians_endpoint_returns_data(st):
    endpoint = (
        f"/settings/v2/tenant/{st.tenant_id}"
        "/technicians?active=True&pageSize=1&includeTotal=true"
    )
    response = await st.api_call(endpoint)
    assert "data" in response, f"Expected 'data' key in response, got: {list(response.keys())}"
    assert isinstance(response["data"], list)


async def test_jobs_endpoint_returns_200(st):
    start, end = st.get_date_range(3)
    endpoint = (
        st.build_tenant_url("jpm")
        + f"/jobs?pageSize=1&includeTotal=true"
        f"&appointmentStartsOnOrAfter={start.isoformat()}"
    )
    response = await st.api_call(endpoint)
    assert "data" in response, f"Expected 'data' key, got: {list(response.keys())}"
