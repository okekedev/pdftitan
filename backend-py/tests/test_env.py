"""
test_env.py — mirrors backend/tests/auth/env.test.js
Offline: validates that all required environment variables are present and
correctly formatted. No network calls.
"""
import base64
import json
import os

import pytest

REQUIRED_VARS = [
    "REACT_APP_SERVICETITAN_CLIENT_ID",
    "REACT_APP_SERVICETITAN_CLIENT_SECRET",
    "REACT_APP_SERVICETITAN_TENANT_ID",
    "REACT_APP_SERVICETITAN_APP_KEY",
    "REACT_APP_SERVICETITAN_API_BASE_URL",
    "REACT_APP_SERVICETITAN_AUTH_URL",
    "GOOGLE_CREDENTIALS_BASE64",
    "GOOGLE_DRIVE_DRAFT_FOLDER_ID",
    "GOOGLE_DRIVE_COMPLETED_FOLDER_ID",
]


@pytest.mark.parametrize("var_name", REQUIRED_VARS)
def test_env_var_present_and_non_empty(var_name):
    value = os.getenv(var_name)
    assert value is not None, f"{var_name} is not set"
    assert value.strip() != "", f"{var_name} is empty"


def test_st_api_url_points_to_servicetitan():
    url = os.getenv("REACT_APP_SERVICETITAN_API_BASE_URL", "")
    assert "servicetitan.io" in url, f"API URL should contain servicetitan.io, got: {url}"


def test_st_auth_url_points_to_servicetitan():
    url = os.getenv("REACT_APP_SERVICETITAN_AUTH_URL", "")
    assert "servicetitan.io" in url, f"Auth URL should contain servicetitan.io, got: {url}"


def test_tenant_id_is_numeric():
    tenant_id = os.getenv("REACT_APP_SERVICETITAN_TENANT_ID", "")
    assert tenant_id.isdigit(), f"Tenant ID should be numeric, got: {tenant_id}"


def test_client_id_format():
    client_id = os.getenv("REACT_APP_SERVICETITAN_CLIENT_ID", "")
    assert client_id.startswith("cid."), f"Client ID should start with 'cid.', got: {client_id[:15]}"


def test_client_secret_format():
    secret = os.getenv("REACT_APP_SERVICETITAN_CLIENT_SECRET", "")
    assert secret.startswith("cs2."), f"Client secret should start with 'cs2.', got: {secret[:15]}"


def test_google_credentials_base64_decodes_to_valid_service_account():
    creds_b64 = os.getenv("GOOGLE_CREDENTIALS_BASE64", "")
    decoded = json.loads(base64.b64decode(creds_b64).decode("utf-8"))
    assert decoded.get("type") == "service_account", "Credentials type should be 'service_account'"
    assert "BEGIN PRIVATE KEY" in decoded.get("private_key", ""), "Private key missing"
    assert "iam.gserviceaccount.com" in decoded.get("client_email", ""), "Client email not a service account"
