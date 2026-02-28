"""
Jobs router — mirrors backend/api/jobs.js
"""
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException

from services.servicetitan import ServiceTitanClient, get_st_client

router = APIRouter()
CENTRAL = ZoneInfo("America/Chicago")
UTC = timezone.utc

# 60-minute customer cache  {customer_id: customer_dict}
_customers_cache: dict = {
    "data": {},
    "last_fetch": 0.0,
    "expiry_minutes": 60,
}


# ── Helpers ───────────────────────────────────────────────────────────────────


def _to_central(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(CENTRAL)


def _parse_iso(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def _format_address(address: dict | None) -> str | None:
    if not address:
        return None
    parts = []
    street = (address.get("street") or "").strip()
    unit = (address.get("unit") or "").strip()
    if street:
        parts.append(f"{street} {unit}".strip() if unit else street)
    city_state_zip = [
        p
        for p in [address.get("city"), address.get("state"), address.get("zip")]
        if p
    ]
    if city_state_zip:
        parts.append(", ".join(city_state_zip))
    return ", ".join(parts) if parts else None


def _build_address_obj(address: dict | None) -> dict | None:
    if not address:
        return None
    return {
        "street": address.get("street"),
        "unit": address.get("unit"),
        "city": address.get("city"),
        "state": address.get("state"),
        "zip": address.get("zip"),
        "fullAddress": _format_address(address),
    }


def _get_priority_score(job: dict) -> int:
    status = (job.get("status") or "").lower()
    apt_status = ((job.get("nextAppointment") or {}).get("status") or "").lower()

    if "arrived" in status or "arrived" in apt_status:
        return 1
    if "working" in status or "inprogress" in status or "in progress" in status:
        return 2
    if "dispatched" in status or "dispatched" in apt_status:
        return 3
    if "scheduled" in status or "scheduled" in apt_status:
        return 4
    if "completed" in status or "done" in status:
        return 6
    if "canceled" in status or "cancelled" in status:
        return 8
    if "hold" in status:
        return 7
    return 5


def _is_today_central(dt: datetime) -> bool:
    return _to_central(dt).date() == datetime.now(CENTRAL).date()


def _is_yesterday_central(dt: datetime) -> bool:
    return _to_central(dt).date() == (datetime.now(CENTRAL) - timedelta(days=1)).date()


def _is_tomorrow_central(dt: datetime) -> bool:
    return _to_central(dt).date() == (datetime.now(CENTRAL) + timedelta(days=1)).date()


def _group_jobs_by_date(jobs: list[dict]) -> dict:
    grouped: dict = {}

    for job in jobs:
        apt_start = (job.get("nextAppointment") or {}).get("start")
        grouping_dt = _parse_iso(apt_start) or _parse_iso(job.get("createdOn"))
        if grouping_dt is None:
            grouping_dt = datetime.now(UTC)

        central = _to_central(grouping_dt)
        date_key = central.strftime("%a %b %d %Y")  # matches JS toDateString()
        short_date = central.strftime("%b") + " " + str(central.day)

        if date_key not in grouped:
            grouped[date_key] = {
                "date": date_key,
                "displayDate": central.strftime("%A, %B %d, %Y"),
                "dayOfWeek": central.strftime("%A"),
                "shortDate": short_date,
                "isToday": _is_today_central(grouping_dt),
                "isYesterday": _is_yesterday_central(grouping_dt),
                "isTomorrow": _is_tomorrow_central(grouping_dt),
                "_sort_ts": central.timestamp(),  # removed before returning
                "appointments": [],
            }

        grouped[date_key]["appointments"].append(job)

    # Sort jobs within each group by priority then appointment start time
    for group in grouped.values():
        group["appointments"].sort(
            key=lambda j: (
                _get_priority_score(j),
                (j.get("nextAppointment") or {}).get("start") or "",
            )
        )

    # Sort date groups most-recent-first
    sorted_keys = sorted(
        grouped.keys(), key=lambda k: grouped[k]["_sort_ts"], reverse=True
    )

    result = {}
    for k in sorted_keys:
        group = dict(grouped[k])
        group.pop("_sort_ts", None)
        result[k] = group
    return result


# ── Customer / location data ──────────────────────────────────────────────────


async def _get_customers_data(st: ServiceTitanClient, customer_ids: list) -> dict:
    global _customers_cache
    now = time.time()
    cache_expiry = _customers_cache["last_fetch"] + (
        _customers_cache["expiry_minutes"] * 60
    )
    cache_valid = _customers_cache["last_fetch"] and now < cache_expiry

    customers_map = {}
    uncached_ids = []

    for cid in customer_ids:
        if cache_valid and cid in _customers_cache["data"]:
            customers_map[cid] = _customers_cache["data"][cid]
        else:
            uncached_ids.append(cid)

    if uncached_ids:
        try:
            endpoint = st.build_tenant_url("crm") + "/export/customers"
            data = await st.api_call(endpoint)
            customers = data.get("data", [])
            for customer in customers:
                _customers_cache["data"][customer["id"]] = customer
                if customer["id"] in uncached_ids:
                    customers_map[customer["id"]] = customer
            _customers_cache["last_fetch"] = now
        except Exception as e:
            print(f"[jobs] Could not fetch customer data: {e}")

    return customers_map


async def _get_locations_data(st: ServiceTitanClient, location_ids: list) -> dict:
    locations_map = {}
    for lid in location_ids:
        if not lid:
            continue
        try:
            endpoint = st.build_tenant_url("crm") + f"/locations/{lid}"
            location = await st.api_call(endpoint)
            locations_map[lid] = location
        except Exception as e:
            print(f"[jobs] Could not fetch location {lid}: {e}")
    return locations_map


def _build_job_obj(job: dict, customer, location, next_appointment) -> dict:
    original_title = (
        # st.clean_job_title handled by caller
        job.get("_cleanTitle")
        or f"Job #{job.get('jobNumber')}"
    )
    short_title = (
        original_title[:57] + "..."
        if len(original_title) > 60
        else original_title
    )

    customer_obj = {
        "id": job.get("customerId"),
        "name": (customer or {}).get("name") or f"Customer #{job.get('customerId')}",
        "address": _build_address_obj((customer or {}).get("address")),
    }

    location_obj = None
    if location:
        location_obj = {
            "id": location.get("id"),
            "name": location.get("name"),
            "address": _build_address_obj(location.get("address")),
        }

    next_apt_obj = None
    if next_appointment:
        next_apt_obj = {
            "id": next_appointment.get("id"),
            "appointmentNumber": next_appointment.get("appointmentNumber"),
            "start": next_appointment.get("start"),
            "end": next_appointment.get("end"),
            "status": next_appointment.get("status"),
        }

    return {
        "id": job.get("id"),
        "number": job.get("jobNumber"),
        "title": short_title,
        "status": job.get("jobStatus"),
        "priority": job.get("priority"),
        "customer": customer_obj,
        "location": location_obj,
        "nextAppointment": next_apt_obj,
        "businessUnitId": job.get("businessUnitId"),
        "jobTypeId": job.get("jobTypeId"),
        "createdOn": job.get("createdOn"),
        "modifiedOn": job.get("modifiedOn"),
        "completedOn": job.get("completedOn"),
        "noCharge": job.get("noCharge"),
        "invoiceId": job.get("invoiceId"),
    }


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("/api/technician/{technician_id}/jobs")
async def get_technician_jobs(
    technician_id: int, st: ServiceTitanClient = Depends(get_st_client)
):
    try:
        start_dt, end_dt = st.get_date_range(3)
        start_iso = start_dt.isoformat()
        end_iso = end_dt.isoformat()

        all_jobs: list = []
        page = 1
        page_size = 500
        has_more = True

        while has_more and page <= 20:
            endpoint = (
                st.build_tenant_url("jpm")
                + f"/jobs"
                f"?page={page}&pageSize={page_size}"
                f"&technicianId={technician_id}"
                f"&appointmentStartsOnOrAfter={start_iso}"
                f"&appointmentStartsBefore={end_iso}"
                f"&includeTotal=true"
            )
            data = await st.api_call(endpoint)
            jobs = data.get("data", [])
            all_jobs.extend(jobs)
            has_more = len(jobs) == page_size and data.get("hasMore") is not False
            page += 1

        # Bulk-fetch customer and location data
        unique_customer_ids = list({j.get("customerId") for j in all_jobs if j.get("customerId")})
        unique_location_ids = list({j.get("locationId") for j in all_jobs if j.get("locationId")})

        customers_map = await _get_customers_data(st, unique_customer_ids)
        locations_map = await _get_locations_data(st, unique_location_ids)

        transformed_jobs: list = []
        for job in all_jobs:
            # Fetch appointments for this job in date range
            next_appointment = None
            try:
                apt_endpoint = (
                    st.build_tenant_url("jpm")
                    + f"/appointments"
                    f"?jobId={job['id']}"
                    f"&startsOnOrAfter={start_iso}"
                    f"&startsOnOrBefore={end_iso}"
                    f"&pageSize=10"
                )
                apt_data = await st.api_call(apt_endpoint)
                apts = [a for a in apt_data.get("data", []) if a.get("start")]
                if apts:
                    apts.sort(key=lambda a: a["start"])
                    next_appointment = apts[0]
            except Exception as e:
                print(f"[jobs] Could not fetch appointments for job {job['id']}: {e}")

            job["_cleanTitle"] = st.clean_job_title(job.get("summary"))
            customer = customers_map.get(job.get("customerId"))
            location = locations_map.get(job.get("locationId"))
            transformed_jobs.append(
                _build_job_obj(job, customer, location, next_appointment)
            )

        grouped = _group_jobs_by_date(transformed_jobs)

        return {
            "success": True,
            "data": transformed_jobs,
            "groupedByDate": grouped,
            "count": len(transformed_jobs),
            "technicianId": technician_id,
            "dateRange": {
                "start": start_iso,
                "end": end_iso,
                "description": "3 days back to today",
            },
            "metadata": {
                "totalJobsFound": len(all_jobs),
                "jobsWithAppointments": sum(
                    1 for j in transformed_jobs if j.get("nextAppointment")
                ),
                "jobsWithCustomerData": sum(
                    1
                    for j in transformed_jobs
                    if j["customer"]["name"] != f"Customer #{j['customer']['id']}"
                ),
                "method": "Jobs API with customer data and appointment context",
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[jobs] Error fetching technician jobs: {e}")
        raise HTTPException(500, "Server error fetching technician jobs")


@router.get("/api/job/{job_id}")
async def get_job(job_id: int, st: ServiceTitanClient = Depends(get_st_client)):
    try:
        endpoint = st.build_tenant_url("jpm") + f"/jobs/{job_id}"
        job_data = await st.api_call(endpoint)
    except Exception as e:
        if "404" in str(e):
            raise HTTPException(404, f"Job not found: {job_id}")
        raise HTTPException(500, "Server error fetching job details")

    customers_map = await _get_customers_data(st, [job_data.get("customerId")])
    customer = customers_map.get(job_data.get("customerId"))

    appointments: list = []
    try:
        apt_endpoint = (
            st.build_tenant_url("jpm") + f"/appointments?jobId={job_id}"
        )
        apt_data = await st.api_call(apt_endpoint)
        appointments = apt_data.get("data", [])
    except Exception as e:
        print(f"[jobs] Could not fetch appointments for job {job_id}: {e}")

    title = st.clean_job_title(job_data.get("summary"))

    return {
        "success": True,
        "data": {
            "id": job_data.get("id"),
            "number": job_data.get("jobNumber"),
            "title": title,
            "status": job_data.get("jobStatus"),
            "priority": job_data.get("priority"),
            "customer": {
                "id": job_data.get("customerId"),
                "name": (customer or {}).get("name") or f"Customer #{job_data.get('customerId')}",
                "address": _build_address_obj((customer or {}).get("address")),
            },
            "location": {
                "id": job_data.get("locationId"),
                "name": f"Location #{job_data.get('locationId')}",
            },
            "appointments": [
                {
                    "id": a.get("id"),
                    "appointmentNumber": a.get("appointmentNumber"),
                    "start": a.get("start"),
                    "end": a.get("end"),
                    "status": a.get("status"),
                    "specialInstructions": a.get("specialInstructions"),
                }
                for a in appointments
            ],
            "businessUnit": (
                {"id": job_data.get("businessUnitId"), "name": f"Business Unit #{job_data.get('businessUnitId')}"}
                if job_data.get("businessUnitId")
                else None
            ),
            "type": job_data.get("jobType"),
            "category": job_data.get("category"),
            "duration": job_data.get("duration"),
            "total": job_data.get("total"),
            "noCharge": job_data.get("noCharge"),
            "invoiceId": job_data.get("invoiceId"),
            "scheduledDate": job_data.get("createdOn"),
            "createdOn": job_data.get("createdOn"),
            "modifiedOn": job_data.get("modifiedOn"),
            "completedOn": job_data.get("completedOn"),
            "serviceTitanData": {
                "id": job_data.get("id"),
                "jobNumber": job_data.get("jobNumber"),
                "summary": job_data.get("summary"),
                "jobStatus": job_data.get("jobStatus"),
                "customerId": job_data.get("customerId"),
                "locationId": job_data.get("locationId"),
                "businessUnitId": job_data.get("businessUnitId"),
                "createdOn": job_data.get("createdOn"),
                "modifiedOn": job_data.get("modifiedOn"),
            },
        },
        "jobId": job_data.get("id"),
    }


@router.get("/api/customer/{customer_id}")
async def get_customer(
    customer_id: int, st: ServiceTitanClient = Depends(get_st_client)
):
    try:
        endpoint = st.build_tenant_url("crm") + f"/customers/{customer_id}"
        data = await st.api_call(endpoint)
        return {"success": True, "data": data}
    except Exception as e:
        if "404" in str(e):
            raise HTTPException(404, f"Customer not found: {customer_id}")
        raise HTTPException(500, "Server error fetching customer details")


@router.get("/api/appointment/{appointment_id}")
async def get_appointment(
    appointment_id: int, st: ServiceTitanClient = Depends(get_st_client)
):
    try:
        endpoint = (
            st.build_tenant_url("jpm") + f"/appointments/{appointment_id}"
        )
        data = await st.api_call(endpoint)
        return {"success": True, "data": data}
    except Exception as e:
        if "404" in str(e):
            raise HTTPException(404, f"Appointment not found: {appointment_id}")
        raise HTTPException(500, "Server error fetching appointment details")
