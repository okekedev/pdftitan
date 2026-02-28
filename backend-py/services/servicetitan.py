"""
ServiceTitan API client — mirrors ServiceTitanClient from backend/server.js
"""
import os
import re
import time
from datetime import datetime, timedelta, timezone

import httpx
from dotenv import load_dotenv

load_dotenv("../.env")


class ServiceTitanClient:
    def __init__(self):
        self.client_id = os.getenv("REACT_APP_SERVICETITAN_CLIENT_ID")
        self.client_secret = os.getenv("REACT_APP_SERVICETITAN_CLIENT_SECRET")
        self.tenant_id = os.getenv("REACT_APP_SERVICETITAN_TENANT_ID")
        self.app_key = os.getenv("REACT_APP_SERVICETITAN_APP_KEY")
        self.api_base_url = os.getenv("REACT_APP_SERVICETITAN_API_BASE_URL")
        self.auth_base_url = self._get_auth_base_url()

        # In-memory token cache — 300s buffer before expiry (same as Node)
        self._token_cache: str | None = None
        self._token_expiry: float = 0.0

    def _get_auth_base_url(self) -> str:
        if self.api_base_url and "integration" in self.api_base_url:
            return "https://auth-integration.servicetitan.io"
        return "https://auth.servicetitan.io"

    async def get_access_token(self) -> str:
        if self._token_cache and time.time() < self._token_expiry:
            return self._token_cache

        if not all([self.client_id, self.client_secret, self.auth_base_url]):
            raise RuntimeError("Missing ServiceTitan OAuth credentials")

        token_url = f"{self.auth_base_url}/connect/token"

        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_url,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                },
                timeout=30.0,
            )

        if not response.is_success:
            error_text = response.text
            try:
                error_json = response.json()
                if error_json.get("error") == "invalid_client":
                    raise RuntimeError(
                        f"Invalid Client ID or Secret for tenant {self.tenant_id}"
                    )
                if error_json.get("error") == "unauthorized_client":
                    raise RuntimeError(
                        f"Client not authorized for tenant {self.tenant_id}"
                    )
            except (ValueError, KeyError):
                pass
            raise RuntimeError(f"OAuth2 failed: {response.status_code} - {error_text}")

        token_data = response.json()
        self._token_cache = token_data["access_token"]
        self._token_expiry = time.time() + (token_data.get("expires_in", 900) - 300)
        return self._token_cache

    async def get_auth_headers(self) -> dict:
        token = await self.get_access_token()
        return {
            "Authorization": f"Bearer {token}",
            "ST-App-Key": self.app_key,
            "Content-Type": "application/json",
        }

    async def api_call(self, endpoint: str, method: str = "GET", **kwargs) -> dict:
        headers = await self.get_auth_headers()
        extra_headers = kwargs.pop("headers", {})
        headers.update(extra_headers)
        url = f"{self.api_base_url}{endpoint}"

        async with httpx.AsyncClient() as client:
            response = await client.request(
                method,
                url,
                headers=headers,
                timeout=60.0,
                **kwargs,
            )

        if not response.is_success:
            raise RuntimeError(
                f"API call failed: {response.status_code} - {response.text}"
            )

        return response.json()

    async def raw_fetch(self, endpoint: str) -> bytes:
        token = await self.get_access_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "ST-App-Key": self.app_key,
        }
        url = f"{self.api_base_url}{endpoint}"

        async with httpx.AsyncClient(follow_redirects=True) as client:
            response = await client.get(url, headers=headers, timeout=60.0)

        if not response.is_success:
            raise RuntimeError(f"Raw fetch failed: {response.status_code}")

        return response.content

    def build_tenant_url(self, service: str) -> str:
        return f"/{service}/v2/tenant/{self.tenant_id}"

    def normalize_phone(self, phone: str) -> str:
        if not phone:
            return ""
        return re.sub(r"\D", "", phone)

    def validate_phone_match(self, tech_phone: str, user_phone: str) -> bool:
        if not tech_phone or not user_phone:
            return False
        tech_norm = self.normalize_phone(tech_phone)[-10:]
        user_norm = self.normalize_phone(user_phone)[-10:]
        if len(tech_norm) < 10 or len(user_norm) < 10:
            return False
        return tech_norm == user_norm

    def get_date_range(self, days_back: int = 3) -> tuple[datetime, datetime]:
        now = datetime.now(timezone.utc)
        start = (now - timedelta(days=days_back)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        end = (now + timedelta(days=1)).replace(
            hour=23, minute=59, second=59, microsecond=999999
        )
        return start, end

    def clean_job_title(self, title: str | None) -> str:
        if not title:
            return "Service Call"
        cleaned = re.sub(r"<[^>]*>", " ", title)
        cleaned = re.sub(r"&[^;]+;", " ", cleaned)
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        if len(cleaned) > 200:
            cleaned = cleaned[:200] + "..."
        if not cleaned or len(cleaned) < 3:
            cleaned = "Service Call"
        return cleaned


# Module-level singleton
_st_client: ServiceTitanClient | None = None


def get_st_client() -> ServiceTitanClient:
    global _st_client
    if _st_client is None:
        _st_client = ServiceTitanClient()
    return _st_client
