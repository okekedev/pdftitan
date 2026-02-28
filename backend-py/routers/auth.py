"""
Auth router — mirrors backend/api/auth.js
POST /api/technician/validate
"""
import os
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from services.servicetitan import ServiceTitanClient, get_st_client

router = APIRouter()

# 30-minute in-memory cache for technicians list
_technicians_cache: dict = {
    "data": None,
    "last_fetch": 0.0,
    "expiry_minutes": 30,
}


class ValidateRequest(BaseModel):
    username: str
    phone: str


async def get_all_technicians(st: ServiceTitanClient) -> list:
    global _technicians_cache
    now = time.time()
    cache_expiry = _technicians_cache["last_fetch"] + (
        _technicians_cache["expiry_minutes"] * 60
    )

    if _technicians_cache["data"] is not None and now < cache_expiry:
        return _technicians_cache["data"]

    all_techs: list = []
    page = 1
    page_size = 100
    has_more = True

    while has_more and page <= 20:
        endpoint = (
            f"/settings/v2/tenant/{st.tenant_id}/technicians"
            f"?active=True&page={page}&pageSize={page_size}&includeTotal=true"
        )
        response = await st.api_call(endpoint)
        techs = response.get("data", [])
        all_techs.extend(techs)
        has_more = bool(response.get("hasMore")) and len(techs) == page_size
        page += 1

    _technicians_cache = {
        "data": all_techs,
        "last_fetch": now,
        "expiry_minutes": 30,
    }
    return all_techs


@router.post("/api/technician/validate")
async def validate_technician(
    body: ValidateRequest, st: ServiceTitanClient = Depends(get_st_client)
):
    try:
        technicians = await get_all_technicians(st)
    except Exception as e:
        msg = str(e)
        if "OAuth2" in msg or "auth" in msg.lower():
            raise HTTPException(503, "Failed to authenticate with ServiceTitan API")
        raise HTTPException(500, f"Server error fetching technicians: {msg}")

    technician = next(
        (
            t
            for t in technicians
            if (t.get("loginName") or "").lower() == body.username.lower()
        ),
        None,
    )

    if not technician:
        raise HTTPException(
            404, f'No technician found with username "{body.username}"'
        )

    if not st.validate_phone_match(
        technician.get("phoneNumber", ""), body.phone
    ):
        raise HTTPException(
            401, "Phone number does not match our records for this technician"
        )

    # Fetch full technician profile to get custom fields (BPAT license, gauge info, etc.)
    try:
        tech_endpoint = f"/settings/v2/tenant/{st.tenant_id}/technicians/{technician['id']}"
        full_tech = await st.api_call(tech_endpoint)
        technician = {**technician, **full_tech}
    except Exception as e:
        print(f"[auth] Could not fetch full technician profile: {e}")

    # customFields is a list of {typeId, name, value} — build a lookup by name
    cf_list = technician.get("customFields") or []
    cf = {item["name"]: item.get("value") for item in cf_list if item.get("name")}

    def cf_get(name: str) -> str:
        return cf.get(name) or ""

    return {
        "success": True,
        "technician": {
            "id": technician["id"],
            "userId": technician.get("userId"),
            "name": technician.get("name"),
            "username": technician.get("loginName"),
            "phoneNumber": technician.get("phoneNumber"),
            "email": technician.get("email"),
            "active": technician.get("active"),
            "businessUnitId": technician.get("businessUnitId"),
            "mainZoneId": technician.get("mainZoneId"),
            "zoneIds": technician.get("zoneIds"),
            "roleIds": technician.get("roleIds"),
            "team": technician.get("team"),
            "isManagedTech": technician.get("isManagedTech"),
            "dailyGoal": technician.get("dailyGoal"),
            "burdenRate": technician.get("burdenRate"),
            "accountLocked": technician.get("accountLocked"),
            "bpatLicenseNumber": cf_get("Backflow License Number"),
            "licenseIssueDate": cf_get("Backflow License Issue Date"),
            "licenseExpirationDate": cf_get("Backflow License Expiration"),
            "gauges": [
                {
                    "type": "Potable",
                    "makeModel": cf_get("Potable Gauge Make/Model"),
                    "serialNumber": cf_get("Potable Gauge Serial Number"),
                    "dateTestedForAccuracy": cf_get("Potable Gauge Tested for Accuracy"),
                    "accuracyExpiration": cf_get("Potable Gauge Expiration"),
                },
                {
                    "type": "Non-potable",
                    "makeModel": cf_get("Non-Potable Gauge Make/Model"),
                    "serialNumber": cf_get("Non-Potable Gauge SN:"),
                    "dateTestedForAccuracy": cf_get("Non-Potable Gauge Date Tested for Accuracy"),
                    "accuracyExpiration": cf_get("Non-Potable Gauge Accuracy Expiration"),
                },
            ],
        },
        "company": {
            "name": cf_get("Tester Company Name") or os.getenv("COMPANY_NAME", "1-A Services"),
            "address": cf_get("Tester Company Address") or os.getenv("COMPANY_ADDRESS", "126 County Road 4577, Boyd, TX 76023"),
            "phone": cf_get("Tester Company Phone Number") or os.getenv("COMPANY_PHONE", "817-232-5577"),
            "tenantId": st.tenant_id,
            "appKey": st.app_key,
        },
        "environment": (
            "Integration"
            if "integration" in (st.api_base_url or "")
            else "Production"
        ),
        "metadata": {
            "totalTechnicians": len(technicians),
            "authenticatedAt": datetime.now(timezone.utc).isoformat(),
            "cacheUsed": _technicians_cache["data"] is not None,
        },
    }
