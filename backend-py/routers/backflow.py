"""
Backflow router — mirrors backend/api/backflow.js

In-memory state (resets on restart). Devices are persisted to ServiceTitan
customer notes for durability.
"""
import itertools
import json
import os
import re
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from services import excel_parser
from services.servicetitan import ServiceTitanClient, get_st_client

router = APIRouter()

# ── Manufacturer/model list (persisted to JSON file) ──────────────────────────

_MANUFACTURERS_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'manufacturers.json')


def _load_manufacturers() -> list:
    try:
        with open(_MANUFACTURERS_FILE, 'r') as f:
            return json.load(f).get('manufacturers', [])
    except Exception:
        return []


def _save_manufacturers(manufacturers: list) -> None:
    try:
        os.makedirs(os.path.dirname(_MANUFACTURERS_FILE), exist_ok=True)
        with open(_MANUFACTURERS_FILE, 'w') as f:
            json.dump({'manufacturers': manufacturers}, f, indent=2)
    except Exception as e:
        print(f'Warning: Could not save manufacturers: {e}')


_manufacturers: list = _load_manufacturers()

# ── In-memory state (mirrors Node) ────────────────────────────────────────────

_devices: list = []
_test_records: list = []
_photos: list = []
_generated_pdfs: list = []

_device_counter = itertools.count(1)
_test_counter = itertools.count(1)
_photo_counter = itertools.count(1)
_pdf_counter = itertools.count(1)


# ── Device note serialization (same format as Node) ──────────────────────────


def _format_device_note(device: dict) -> str:
    gps = "N/A"
    if device.get("geoLatitude") and device.get("geoLongitude"):
        gps = f"{device['geoLatitude']}, {device['geoLongitude']}"

    return (
        f"[BACKFLOW_DEVICE_{device['id']}]\n"
        f"Device Type: {device.get('typeMain') or 'N/A'}\n"
        f"Manufacturer: {device.get('manufacturerMain') or 'N/A'}\n"
        f"Model: {device.get('modelMain') or 'N/A'}\n"
        f"Serial: {device.get('serialMain') or 'N/A'}\n"
        f"Size: {device.get('sizeMain') or 'N/A'}\n"
        f"Location: {device.get('bpaLocation') or 'N/A'}\n"
        f"Serves: {device.get('bpaServes') or 'N/A'}\n"
        f"GPS: {gps}\n"
        f"LocationID: {device.get('locationId') or 'N/A'}\n"
        f"Created: {device.get('createdAt') or ''}\n"
        f"[/BACKFLOW_DEVICE]"
    )


def _parse_device_note(note_text: str) -> Optional[dict]:
    try:
        id_match = re.search(r"\[BACKFLOW_DEVICE_(.*?)\]", note_text)
        if not id_match:
            return None
        device_id = id_match.group(1)
        device: dict = {"id": device_id}

        for line in note_text.split("\n"):
            if ":" not in line:
                continue
            key, _, value = line.partition(":")
            key = key.strip()
            value = value.strip()
            if not value or value == "N/A":
                continue
            mapping = {
                "Device Type": "typeMain",
                "Manufacturer": "manufacturerMain",
                "Model": "modelMain",
                "Serial": "serialMain",
                "Size": "sizeMain",
                "Location": "bpaLocation",
                "Serves": "bpaServes",
                "LocationID": "locationId",
                "Created": "createdAt",
            }
            if key in mapping:
                device[mapping[key]] = value
            elif key == "GPS":
                parts = value.split(",")
                if len(parts) == 2:
                    try:
                        device["geoLatitude"] = float(parts[0].strip())
                        device["geoLongitude"] = float(parts[1].strip())
                    except ValueError:
                        pass

        return device
    except Exception as e:
        print(f"[backflow] Error parsing device note: {e}")
        return None


# ── Test note serialization (persisted to ST job notes) ───────────────────────


def _format_test_note(test: dict) -> str:
    test_id = test.get("id", "unknown")
    payload = json.dumps(test)
    return f"[BACKFLOW_TEST_{test_id}]\n{payload}\n[/BACKFLOW_TEST]"


def _parse_test_note(note_text: str) -> Optional[dict]:
    try:
        if "[BACKFLOW_TEST_" not in note_text:
            return None
        content_match = re.search(
            r"\[BACKFLOW_TEST_.*?\]\n(.*?)\n\[/BACKFLOW_TEST\]",
            note_text,
            re.DOTALL,
        )
        if not content_match:
            return None
        return json.loads(content_match.group(1))
    except Exception as e:
        print(f"[backflow] Error parsing test note: {e}")
        return None


# ── Device routes ─────────────────────────────────────────────────────────────


@router.get("/api/job/{job_id}/backflow-devices")
async def get_devices(job_id: str, st: ServiceTitanClient = Depends(get_st_client)):
    try:
        job_endpoint = st.build_tenant_url("jpm") + f"/jobs/{job_id}"
        job_data = await st.api_call(job_endpoint)
        customer_id = job_data.get("customerId")
        location_id = str(job_data.get("locationId") or "")

        if not customer_id:
            return {"success": True, "data": []}

        notes_endpoint = (
            st.build_tenant_url("crm")
            + f"/customers/{customer_id}/notes?pageSize=100"
        )
        notes_response = await st.api_call(notes_endpoint)
        notes = notes_response.get("data", [])

        loaded: list = []
        for note in notes:
            text = note.get("text") or ""
            if "[BACKFLOW_DEVICE_" not in text:
                continue
            device = _parse_device_note(text)
            if not device:
                continue
            device["jobId"] = job_id

            dev_location = str(device.get("locationId") or "")
            if dev_location and location_id and dev_location == location_id:
                loaded.append(device)
                if not any(d["id"] == device["id"] for d in _devices):
                    _devices.append(device)
            elif not dev_location:
                # Legacy device without locationId
                loaded.append(device)
                if not any(d["id"] == device["id"] for d in _devices):
                    _devices.append(device)

        return {"success": True, "data": loaded}

    except Exception as e:
        print(f"[backflow] Error loading devices from notes: {e}")
        job_devices = [d for d in _devices if d.get("jobId") == job_id]
        return {"success": True, "data": job_devices}


@router.post("/api/job/{job_id}/backflow-devices")
async def create_device(
    job_id: str,
    body: dict,
    st: ServiceTitanClient = Depends(get_st_client),
):
    location_id = None
    customer_id = None
    try:
        job_endpoint = st.build_tenant_url("jpm") + f"/jobs/{job_id}"
        job_data = await st.api_call(job_endpoint)
        location_id = job_data.get("locationId")
        customer_id = job_data.get("customerId")
    except Exception as e:
        print(f"[backflow] Warning: could not fetch job {job_id} from ST: {e}")

    new_device = {
        "id": f"device-{next(_device_counter)}",
        "jobId": job_id,
        "locationId": location_id,
        **body,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    _devices.append(new_device)

    # Persist to ServiceTitan customer notes
    if customer_id:
        try:
            note_text = _format_device_note(new_device)
            notes_endpoint = (
                st.build_tenant_url("crm") + f"/customers/{customer_id}/notes"
            )
            await st.api_call(
                notes_endpoint,
                method="POST",
                json={"text": note_text, "pinToTop": False},
            )
        except Exception as e:
            print(f"[backflow] Error saving device to customer notes: {e}")

    return {"success": True, "data": new_device}


@router.put("/api/backflow-devices/{device_id}")
async def update_device(device_id: str, body: dict):
    idx = next((i for i, d in enumerate(_devices) if d["id"] == device_id), -1)
    if idx == -1:
        raise HTTPException(404, "Device not found")
    _devices[idx] = {
        **_devices[idx],
        **body,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    return {"success": True, "data": _devices[idx]}


# ── Test record routes ─────────────────────────────────────────────────────────


@router.get("/api/job/{job_id}/backflow-tests")
async def get_tests(job_id: str, st: ServiceTitanClient = Depends(get_st_client)):
    try:
        notes_endpoint = st.build_tenant_url("jpm") + f"/jobs/{job_id}/notes?pageSize=200"
        notes_response = await st.api_call(notes_endpoint)
        notes = notes_response.get("data", [])

        # Collect most-recent test per deviceId
        by_device: dict = {}
        for note in notes:
            text = note.get("text") or ""
            if "[BACKFLOW_TEST_" not in text:
                continue
            test = _parse_test_note(text)
            if not test:
                continue
            dev_id = test.get("deviceId")
            if not dev_id:
                continue
            existing = by_device.get(dev_id)
            if not existing or test.get("createdAt", "") >= existing.get("createdAt", ""):
                by_device[dev_id] = test

        result = list(by_device.values())

        # Hydrate in-memory cache
        for test in result:
            t_id = test.get("id")
            if t_id and not any(t.get("id") == t_id for t in _test_records):
                _test_records.append(test)

        return {"success": True, "data": result}

    except Exception as e:
        print(f"[backflow] Error loading tests from job notes: {e}")
        return {"success": True, "data": [t for t in _test_records if t.get("jobId") == job_id]}


@router.post("/api/backflow-tests/save")
async def save_test(body: dict, st: ServiceTitanClient = Depends(get_st_client)):
    device = body.get("device") or {}
    test = body.get("test") or {}

    # Save or update device
    dev_id = device.get("id") or ""
    if dev_id.startswith("device-"):
        idx = next((i for i, d in enumerate(_devices) if d["id"] == dev_id), -1)
        if idx != -1:
            _devices[idx] = {**_devices[idx], **device}
            saved_device = _devices[idx]
        else:
            saved_device = {
                "id": f"device-{next(_device_counter)}",
                **device,
                "createdAt": datetime.now(timezone.utc).isoformat(),
            }
            _devices.append(saved_device)
    else:
        saved_device = {
            "id": f"device-{next(_device_counter)}",
            **device,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        _devices.append(saved_device)

    new_test = {
        "id": f"test-{next(_test_counter)}",
        "deviceId": saved_device["id"],
        "jobId": test.get("jobId") or body.get("jobId"),
        **test,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

    existing_idx = next(
        (i for i, t in enumerate(_test_records) if t.get("deviceId") == saved_device["id"]),
        -1,
    )
    if existing_idx != -1:
        _test_records[existing_idx] = {**_test_records[existing_idx], **new_test}
        saved_test = _test_records[existing_idx]
    else:
        _test_records.append(new_test)
        saved_test = new_test

    # Persist to ServiceTitan job notes
    job_id = saved_test.get("jobId")
    if job_id:
        try:
            note_text = _format_test_note(saved_test)
            notes_endpoint = st.build_tenant_url("jpm") + f"/jobs/{job_id}/notes"
            await st.api_call(
                notes_endpoint,
                method="POST",
                json={"text": note_text, "pinToTop": False},
            )
        except Exception as e:
            print(f"[backflow] Warning: could not persist test to job notes: {e}")

    return {"success": True, "data": saved_test}


@router.delete("/api/backflow-tests/{test_id}")
async def delete_test(test_id: str, st: ServiceTitanClient = Depends(get_st_client)):
    idx = next((i for i, t in enumerate(_test_records) if t.get("id") == test_id), -1)
    if idx == -1:
        raise HTTPException(404, "Test not found")

    deleted = _test_records.pop(idx)

    # Post a reset marker to ST job notes so future loads treat device as untested
    job_id = deleted.get("jobId")
    dev_id = deleted.get("deviceId")
    if job_id and dev_id:
        try:
            reset_note = _format_test_note({
                "id": f"reset-{test_id}",
                "deviceId": dev_id,
                "jobId": job_id,
                "testResult": "",
                "createdAt": datetime.now(timezone.utc).isoformat(),
            })
            notes_endpoint = st.build_tenant_url("jpm") + f"/jobs/{job_id}/notes"
            await st.api_call(notes_endpoint, method="POST", json={"text": reset_note, "pinToTop": False})
        except Exception as e:
            print(f"[backflow] Warning: could not post reset marker: {e}")

    return {"success": True}


# ── Photo routes ───────────────────────────────────────────────────────────────


@router.get("/api/backflow-tests/{test_id}/photos")
async def get_photos(test_id: str):
    return {"success": True, "data": [p for p in _photos if p.get("testRecordId") == test_id]}


@router.post("/api/backflow-photos/upload")
async def upload_photo(
    photo: UploadFile = File(...),
    generatedFileName: str = Form(...),
    jobId: str = Form(...),
    testRecordId: str = Form(""),
    deviceId: str = Form(""),
    isFailedPhoto: str = Form("false"),
    photoLabel: str = Form(default=""),
    st: ServiceTitanClient = Depends(get_st_client),
):
    file_bytes = await photo.read()

    photo_data = {
        "id": f"photo-{next(_photo_counter)}",
        "testRecordId": testRecordId,
        "deviceId": deviceId,
        "jobId": jobId,
        "originalFileName": photo.filename,
        "generatedFileName": generatedFileName,
        "isFailedPhoto": isFailedPhoto.lower() == "true",
        "photoLabel": photoLabel,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "uploadedToServiceTitan": False,
    }

    # Upload to ServiceTitan
    token = await st.get_access_token()
    upload_url = (
        f"{st.api_base_url}/forms/v2/tenant/{st.tenant_id}"
        f"/jobs/{jobId}/attachments"
    )

    async with httpx.AsyncClient() as client:
        response = await client.post(
            upload_url,
            headers={"Authorization": f"Bearer {token}", "ST-App-Key": st.app_key},
            files={"file": (generatedFileName, file_bytes, photo.content_type or "image/jpeg")},
            timeout=60.0,
        )

    if not response.is_success:
        raise HTTPException(
            500,
            f"Failed to upload photo to ServiceTitan: {response.status_code} {response.text}",
        )

    result = response.json()
    photo_data["uploadedToServiceTitan"] = True
    photo_data["serviceTitanAttachmentId"] = result.get("id")
    _photos.append(photo_data)

    return {"success": True, "data": photo_data}


@router.get("/api/backflow-photos/{photo_id}")
async def get_photo(photo_id: str):
    photo = next((p for p in _photos if p["id"] == photo_id), None)
    if not photo:
        raise HTTPException(404, "Photo not found")
    return {"success": True, "data": photo}


@router.delete("/api/backflow-photos/{photo_id}")
async def delete_photo(photo_id: str, st: ServiceTitanClient = Depends(get_st_client)):
    idx = next((i for i, p in enumerate(_photos) if p["id"] == photo_id), -1)
    if idx == -1:
        raise HTTPException(404, "Photo not found")

    photo = _photos[idx]

    if photo.get("serviceTitanAttachmentId"):
        try:
            token = await st.get_access_token()
            delete_url = (
                f"{st.api_base_url}/forms/v2/tenant/{st.tenant_id}"
                f"/jobs/{photo['jobId']}/attachments/{photo['serviceTitanAttachmentId']}"
            )
            async with httpx.AsyncClient() as client:
                await client.delete(
                    delete_url,
                    headers={"Authorization": f"Bearer {token}", "ST-App-Key": st.app_key},
                    timeout=30.0,
                )
        except Exception as e:
            print(f"[backflow] Error deleting from ServiceTitan: {e}")

    _photos.pop(idx)
    return {"success": True}


# ── PDF generation ─────────────────────────────────────────────────────────────


def _fill_tceq_pdf(device: dict, test: dict, technician: dict, company: dict, city_info: dict, customer_name: str, service_address: str) -> bytes:
    import io
    from pathlib import Path
    from pypdf import PdfReader, PdfWriter

    template_path = Path(__file__).parent.parent / "forms" / "TCEQ.pdf"
    reader = PdfReader(str(template_path))
    writer = PdfWriter()
    writer.clone_reader_document_root(reader)

    gauge_type = test.get("differentialPressureGaugeType", "Potable")
    gauge = next((g for g in (technician.get("gauges") or []) if g.get("type") == gauge_type), {})

    # Build text field values
    gauge_make_model = f"{gauge.get('make', '')} {gauge.get('model', '')}".strip()
    text_values = {
        # PWS / header
        # Text Field_1 and _2 are duplicate widgets for the same PWS ID# cell
        'Text Field':   city_info.get("pwsName", ""),
        'Text Field_1': city_info.get("pwsId", ""),
        'Text Field_2': city_info.get("pwsId", ""),
        'Text Field_3': city_info.get("pwsAddress", ""),
        'Text Field_4': city_info.get("pwsContact", ""),
        'Text Field_5': service_address,
        # Main assembly (left column: x≈143–144)
        'Text Field_6':     device.get("manufacturerMain", ""),  # row 1
        'Text Field_6_1':   device.get("modelMain", ""),         # row 2
        'Text Field_6_1_1': device.get("serialMain", ""),        # row 3
        'Text Field_6_1_2_5': device.get("sizeMain", ""),        # row 1 size col
        # Bypass assembly (middle column: x≈249, size bypass: x≈535)
        'Text Field_6_1_2':     device.get("manufacturerBypass", ""),  # row 1
        'Text Field_6_1_2_1':   device.get("modelBypass", ""),         # row 2
        'Text Field_6_1_2_2':   device.get("serialBypass", ""),        # row 3
        'Text Field_6_1_2_5_1': device.get("sizeBypass", ""),          # row 1 size col
        # BPA details (right column: x≈430)
        'Text Field_6_1_2_3':   device.get("bpaLocation", ""),  # row 2
        'Text Field_6_1_2_3_1': device.get("bpaServes", ""),    # row 3
        # Old serial (replacement)
        'Text Field_6_1_2_3_2': test.get("oldSerial", ""),
        # Initial test date/time
        'Text Field_6_1_2_4_1': test.get("testDateInitial", ""),
        'Text Field_6_1_2_4':   test.get("testTimeInitial", ""),
        # Initial readings
        'Text Field_6_1_2_3_2_1':       str(test.get("firstCheckReadingInitial", "") or ""),
        'Text Field_6_1_2_3_2_1_1':     str(test.get("secondCheckReadingInitial", "") or ""),
        'Text Field_6_1_2_3_2_1_1_1':   str(test.get("reliefValveReadingInitial", "") or ""),
        'Text Field_6_1_2_3_2_1_1_2':   str(test.get("typeIIBypassCheckReadingInitial", "") or ""),
        'Text Field_6_1_2_3_2_1_1_2_1': str(test.get("airInletReadingInitial", "") or ""),
        'Text Field_6_1_2_3_2_1_1_2_3': str(test.get("checkValveReadingInitial", "") or ""),
        # Repairs
        'Text Field_6_1_2_3_2_1_1_2_10_1_5':   test.get("repairsMain", ""),
        'Text Field_6_1_2_3_2_1_1_2_10_1_5_1':  test.get("repairsBypass", ""),
        # After-repair readings
        'Text Field_6_1_2_3_2_1_1_2_4': str(test.get("firstCheckReadingAfterRepair", "") or ""),
        'Text Field_6_1_2_3_2_1_1_2_5': str(test.get("secondCheckReadingAfterRepair", "") or ""),
        'Text Field_6_1_2_3_2_1_1_2_6': str(test.get("reliefValveReadingAfterRepair", "") or ""),
        'Text Field_6_1_2_3_2_1_1_2_7': str(test.get("typeIIBypassCheckReadingAfterRepair", "") or ""),
        'Text Field_6_1_2_3_2_1_1_2_8': str(test.get("airInletReadingAfterRepair", "") or ""),
        'Text Field_6_1_2_3_2_1_1_2_9': str(test.get("checkValveReadingAfterRepair", "") or ""),
        'Text Field_6_1_2_4_1_1':        test.get("testDateAfterRepair", ""),
        'Text Field_6_1_2_4_1_1_1':      test.get("testTimeAfterRepair", ""),
        # Differential pressure gauge (Make/Model at x=117, SN at x=282, date at x=509)
        'Text Field_6_1_2_3_2_1_1_2_10':     gauge_make_model,
        'Text Field_6_1_2_3_2_1_1_2_10_1':   gauge.get("serialNumber", ""),
        'Text Field_6_1_2_3_2_1_1_2_10_1_1': test.get("testDateInitial", ""),
        # Remarks
        'Text Field_6_1_2_3_2_1_1_2_10_1_5_2': test.get("remarks", ""),
        # Tester certification (Company Name/Address/Phone are static in PDF template)
        'Text Field_6_1_2_3_2_1_1_2_10_1_2': technician.get("name", ""),
        'Text Field_6_1_2_3_2_1_1_2_10_1_3': technician.get("bpatLicenseNumber", ""),
        'Text Field_6_1_2_3_2_1_1_2_10_1_4': technician.get("licenseExpirationDate", ""),
    }

    # Remove empty strings — don't overwrite with blank
    text_values = {k: v for k, v in text_values.items() if v}

    writer.update_page_form_field_values(writer.pages[0], text_values)

    # Checkboxes — BPA TYPE
    # Row 1 (y≈638): RPZ=RPBA (x=31), RPDA=RPBA-D (x=239), Type II (x=538)
    # Row 2 (y≈622): DC=DCVA (x=32), DCDA=DCVA-D (x=239), Type II (x=538)
    # Row 3 (y≈606): PVB (x=31), SVB (x=239)
    device_type = device.get("typeMain", "")
    type_checkbox_map = {
        "RPZ":          "Check Box",        # RPBA: row 1, left
        "DC":           "Check Box_2_1",    # DCVA: row 2, left
        "RPDA":         "Check Box_2_4",    # RPBA-D: row 1, middle
        "DCDA":         "Check Box_2_5",    # DCVA-D: row 2, middle
        "PVB":          "Check Box_2_3",    # PVB: row 3, left
        "SVB":          "Check Box_2_6",    # SVB: row 3, middle
        "RPDA Type II": "Check Box_2_4",    # RPBA-D + Type II box
        "DCDA Type II": "Check Box_2_5",    # DCVA-D + Type II box
    }
    check_values = {}
    if device_type in type_checkbox_map:
        check_values[type_checkbox_map[device_type]] = True
        if device_type == "RPDA Type II":
            check_values["Check Box_2_7"] = True   # Type II col, row 1
        elif device_type == "DCDA Type II":
            check_values["Check Box_2_8"] = True   # Type II col, row 2

    # Reason for test (y≈526): New (x=139), Existing (x=216), Replacement (x=327)
    reason = test.get("reasonForTest", "Existing")
    if reason == "New":
        check_values["Check Box_2_13"] = True
    elif reason == "Existing":
        check_values["Check Box_2_12"] = True
    elif reason == "Replacement":
        check_values["Check Box_2_11"] = True

    # Compliance questions (y≈510/494): Yes (x=490), No (x=534)
    if test.get("installedPerCode") == "Yes":
        check_values["Check Box_2_9"] = True
    elif test.get("installedPerCode") == "No":
        check_values["Check Box_2_10"] = True

    if test.get("installedOnNonPotableAuxiliary") == "Yes":
        check_values["Check Box_2_14"] = True
    elif test.get("installedOnNonPotableAuxiliary") == "No":
        check_values["Check Box_2_15"] = True

    # Test result PASS / FAIL (x≈72-73)
    if test.get("testResult") == "Passed":
        check_values["Check Box_2_27"] = True
    elif test.get("testResult") == "Failed":
        check_values["Check Box_2_28"] = True

    # Initial Test checkboxes (y≈362-390, just below PASS/FAIL row)
    if test.get("firstCheckClosedTightInitial") == "Closed Tight":
        check_values["Check Box_2_16"] = True
    elif test.get("firstCheckClosedTightInitial") == "Leaked":
        check_values["Check Box_2_17"] = True

    if test.get("secondCheckClosedTightInitial") == "Closed Tight":
        check_values["Check Box_2_18"] = True
    elif test.get("secondCheckClosedTightInitial") == "Leaked":
        check_values["Check Box_2_19"] = True

    if test.get("reliefValveDidNotOpenInitial") == "Did not open":
        check_values["Check Box_2_20"] = True

    if test.get("typeIIBypassClosedTightInitial") == "Closed Tight":
        check_values["Check Box_2_21"] = True
    elif test.get("typeIIBypassClosedTightInitial") == "Leaked":
        check_values["Check Box_2_22"] = True

    if test.get("airInletDidNotOpenInitial") == "Yes":
        check_values["Check Box_2_23"] = True
    if test.get("airInletFullyOpenInitial") == "Yes":
        check_values["Check Box_2_24"] = True
    elif test.get("airInletFullyOpenInitial") == "No":
        check_values["Check Box_2_25"] = True

    if test.get("checkValveLeakedInitial") == "Yes":
        check_values["Check Box_2_26"] = True

    # After Repair checkboxes (y≈272-285, below Repairs section)
    if test.get("firstCheckClosedTightAfterRepair") == "Closed Tight":
        check_values["Check Box_2_29"] = True

    if test.get("secondCheckClosedTightAfterRepair") == "Closed Tight":
        check_values["Check Box_2_30"] = True

    if test.get("typeIIBypassClosedTightAfterRepair") == "Closed Tight":
        check_values["Check Box_2_31"] = True

    # Gauge type
    if gauge_type == "Potable":
        check_values["Check Box_2_32"] = True
    else:
        check_values["Check Box_2_33"] = True

    # Apply checkboxes — pypdf checkbox fill
    for field_name, checked in check_values.items():
        if checked:
            writer.update_page_form_field_values(writer.pages[0], {field_name: "/Yes"})

    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


@router.post("/api/backflow-pdfs/generate")
async def generate_pdf(body: dict, st: ServiceTitanClient = Depends(get_st_client)):
    device_id = body.get("deviceId")
    test_record_id = body.get("testRecordId")
    job_id = body.get("jobId")
    city_code = body.get("cityCode", "")
    technician = body.get("technician") or {}
    company = body.get("company") or {}
    customer_name = body.get("customerName", "")
    service_address = body.get("serviceAddress", "")

    device = next((d for d in _devices if d["id"] == device_id), None)
    test = next((t for t in _test_records if t["id"] == test_record_id), None)

    if not device or not test:
        raise HTTPException(404, "Device or test not found")

    city_info = excel_parser.get_city_info(city_code) or {}

    try:
        pdf_bytes = _fill_tceq_pdf(device, test, technician, company, city_info, customer_name, service_address)
    except Exception as e:
        print(f"[backflow] TCEQ fill error, falling back to reference PDF: {e}")
        pdf_bytes = _generate_reference_pdf(device, test, city_info, city_code)

    serial = device.get('serialMain', 'unknown')
    date = test.get('testDateInitial', 'unknown')
    file_name = f"TCEQ_{serial}_{date}.pdf"

    # Upload to ServiceTitan as job attachment
    st_attachment_id = None
    try:
        token = await st.get_access_token()
        upload_url = f"{st.api_base_url}/forms/v2/tenant/{st.tenant_id}/jobs/{job_id}/attachments"
        async with httpx.AsyncClient() as client:
            response = await client.post(
                upload_url,
                headers={"Authorization": f"Bearer {token}", "ST-App-Key": st.app_key},
                files={"file": (file_name, pdf_bytes, "application/pdf")},
                timeout=60.0,
            )
        if response.is_success:
            resp_json = response.json() if response.text else {}
            print(f"[backflow] ST upload response: {resp_json}")
            st_attachment_id = (
                resp_json.get("id")
                or resp_json.get("attachmentId")
                or resp_json.get("data", {}).get("id")
                or "uploaded"  # fallback: upload succeeded even if ID not returned
            )
        else:
            print(f"[backflow] ST upload failed: {response.status_code} {response.text}")
    except Exception as e:
        print(f"[backflow] ST upload error: {e}")

    pdf_record = {
        "id": f"pdf-{next(_pdf_counter)}",
        "deviceId": device_id,
        "testRecordId": test_record_id,
        "jobId": job_id,
        "fileName": file_name,
        "cityCode": city_code,
        "serviceTitanAttachmentId": st_attachment_id,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    _generated_pdfs.append(pdf_record)
    return {"success": True, "data": pdf_record}


@router.post("/api/backflow-pdfs/generate-online-reference")
async def generate_online_reference(body: dict):
    device_id = body.get("deviceId")
    test_record_id = body.get("testRecordId")
    job_id = body.get("jobId")
    city_code = body.get("cityCode", "")

    device = next((d for d in _devices if d["id"] == device_id), None)
    test = next((t for t in _test_records if t["id"] == test_record_id), None)

    if not device or not test:
        raise HTTPException(404, "Device or test not found")

    city_info = excel_parser.get_city_info(city_code) or {}
    pdf_bytes = _generate_reference_pdf(device, test, city_info, city_code)
    file_name = f"Online_Reference_{device.get('serialMain', 'unknown')}_{test.get('testDateInitial', 'unknown')}.pdf"

    pdf_record = {
        "id": f"pdf-{next(_pdf_counter)}",
        "deviceId": device_id,
        "testRecordId": test_record_id,
        "jobId": job_id,
        "fileName": file_name,
        "pdfBytes": list(pdf_bytes),
        "cityCode": city_code,
        "isOnlineReference": True,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    _generated_pdfs.append(pdf_record)
    return {"success": True, "data": pdf_record}


@router.get("/api/backflow-pdfs/{pdf_id}")
async def get_pdf(pdf_id: str):
    from fastapi.responses import Response as FastAPIResponse

    pdf = next((p for p in _generated_pdfs if p["id"] == pdf_id), None)
    if not pdf:
        raise HTTPException(404, "PDF not found")

    if "pdfBytes" not in pdf:
        raise HTTPException(
            410,
            "PDF was uploaded to ServiceTitan and is no longer stored locally. "
            "Download it from the job attachments in ServiceTitan.",
        )

    pdf_buffer = bytes(pdf["pdfBytes"])
    return FastAPIResponse(
        content=pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{pdf["fileName"]}"'},
    )


# ── Misc routes ────────────────────────────────────────────────────────────────


@router.post("/api/job/{job_id}/notes")
async def add_job_note(job_id: str, body: dict, st: ServiceTitanClient = Depends(get_st_client)):
    note_text = body.get("note", "")
    if not note_text:
        raise HTTPException(400, "Note text required")
    try:
        endpoint = st.build_tenant_url("jpm") + f"/jobs/{job_id}/notes"
        result = await st.api_call(endpoint, method="POST", json={"text": note_text, "pinToTop": False})
        return {"success": True, "data": result}
    except Exception as e:
        print(f"[backflow] Error adding job note: {e}")
        raise HTTPException(500, f"Failed to add job note: {e}")


@router.get("/api/cities")
async def get_cities():
    return {"success": True, "data": excel_parser.get_all_cities()}


@router.get("/api/cities/{city_name}")
async def get_city(city_name: str):
    city_info = excel_parser.get_city_info(city_name)
    if not city_info:
        raise HTTPException(404, "City not found")
    return {"success": True, "data": city_info}


@router.get("/api/form-fields")
async def get_form_fields():
    return {"success": True, "data": excel_parser.parse_form_fields()}


@router.get("/api/backflow/manufacturers")
async def get_manufacturers():
    return {"success": True, "data": _manufacturers}


@router.post("/api/backflow/manufacturers/track")
async def track_manufacturer(body: dict):
    global _manufacturers
    manufacturer = (body.get("manufacturer") or "").strip()
    model = (body.get("model") or "").strip()
    if not manufacturer:
        return {"success": True}

    entry = next((m for m in _manufacturers if m["name"].lower() == manufacturer.lower()), None)
    changed = False

    if not entry:
        entry = {"name": manufacturer, "models": []}
        _manufacturers.append(entry)
        changed = True

    if model and model not in entry["models"]:
        entry["models"].append(model)
        changed = True

    if changed:
        _save_manufacturers(_manufacturers)

    return {"success": True}


# ── Helper: generate reference PDF with reportlab ─────────────────────────────


def _generate_reference_pdf(
    device: dict, test: dict, city_info: dict, city_code: str
) -> bytes:
    import io

    from reportlab.lib.colors import HexColor
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas as rl_canvas

    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=letter)
    w, h = letter
    y = h - 50

    def draw_field(label: str, value: str) -> None:
        nonlocal y
        c.setFont("Helvetica-Bold", 10)
        c.drawString(50, y, label)
        c.setFont("Helvetica", 10)
        c.drawString(250, y, value or "N/A")
        y -= 20
        if y < 50:
            c.showPage()
            y = h - 50

    # Title
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(HexColor("#1e3a8a"))
    c.drawString(50, y, "Online Form Reference Sheet")
    y -= 25

    c.setFont("Helvetica", 11)
    c.setFillColorRGB(0, 0, 0)
    c.drawString(50, y, f"City: {city_code} | Device: {device.get('serialMain', '')}")
    y -= 30

    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(HexColor("#1e3a8a"))
    c.drawString(50, y, "PUBLIC WATER SUPPLIER INFORMATION")
    y -= 20
    c.setFillColorRGB(0, 0, 0)

    draw_field("Public Water Supplier:", city_info.get("pwsName") or city_code)
    draw_field("PWS ID#:", city_info.get("pwsId") or "")
    draw_field("PWS Address:", city_info.get("pwsAddress") or "")
    draw_field("PWS Contact:", city_info.get("pwsContact") or "")
    y -= 10

    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(HexColor("#1e3a8a"))
    c.drawString(50, y, "DEVICE INFORMATION")
    y -= 20
    c.setFillColorRGB(0, 0, 0)

    draw_field("Type:", device.get("typeMain") or "")
    draw_field("Manufacturer:", device.get("manufacturerMain") or "")
    draw_field("Model:", device.get("modelMain") or "")
    draw_field("Serial Number:", device.get("serialMain") or "")
    draw_field("Size:", device.get("sizeMain") or "")
    y -= 10

    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(HexColor("#1e3a8a"))
    c.drawString(50, y, "TEST INFORMATION")
    y -= 20
    c.setFillColorRGB(0, 0, 0)

    draw_field("Test Date:", test.get("testDateInitial") or "")
    draw_field("Test Time:", test.get("testTimeInitial") or "")
    draw_field("Result:", test.get("testResult") or "Not Tested")
    if test.get("firstCheckReadingInitial"):
        draw_field("1st Check Reading:", f"{test['firstCheckReadingInitial']} PSI")
    if test.get("secondCheckReadingInitial"):
        draw_field("2nd Check Reading:", f"{test['secondCheckReadingInitial']} PSI")
    if test.get("reliefValveReadingInitial"):
        draw_field("Relief Valve Reading:", f"{test['reliefValveReadingInitial']} PSI")

    c.save()
    buf.seek(0)
    return buf.getvalue()


# ── Job summary PDF ───────────────────────────────────────────────────────────


def _generate_job_summary_pdf(
    job_id: str,
    job_devices: list,
    test_by_device: dict,
    info: dict,
) -> bytes:
    import io

    from reportlab.lib import colors
    from reportlab.lib.colors import Color, HexColor
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        Paragraph, Spacer, Table, TableStyle, SimpleDocTemplate, PageBreak, HRFlowable
    )

    BLUE = HexColor("#1565c0")
    BLUE_LIGHT = HexColor("#e3f0ff")
    GRAY = HexColor("#555555")
    GRAY_LIGHT = HexColor("#f5f5f5")
    GREEN = HexColor("#2e7d32")
    RED = HexColor("#c62828")
    WHITE = colors.white
    BLACK = colors.black

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], textColor=BLUE, fontSize=18, spaceAfter=4)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], textColor=BLUE, fontSize=13, spaceAfter=4)
    h3 = ParagraphStyle("h3", parent=styles["Heading3"], textColor=GRAY, fontSize=11, spaceAfter=2)
    body = ParagraphStyle("body", parent=styles["Normal"], fontSize=10, leading=14)
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=9, textColor=GRAY)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    technician_name = info.get("technicianName", "")
    customer_name = info.get("customerName", "")
    generated_date = datetime.now().strftime("%B %d, %Y")
    generated_time = datetime.now().strftime("%I:%M %p")

    tested_devices = [d for d in job_devices if test_by_device.get(d["id"])]
    passed = [d for d in tested_devices if test_by_device[d["id"]].get("testResult") == "Passed"]
    failed = [d for d in tested_devices if test_by_device[d["id"]].get("testResult") == "Failed"]
    quote_needed = [d for d in tested_devices if test_by_device[d["id"]].get("quoteNeeded")]

    story = []

    # ── Cover / Summary ──────────────────────────────────────────────────────

    story.append(Paragraph("Mr. Backflow TX", h1))
    story.append(Paragraph("Backflow Testing Field Report", h2))
    story.append(HRFlowable(width="100%", thickness=1, color=BLUE, spaceAfter=10))

    job_info_data = [
        ["Job #", job_id],
        ["Date Generated", f"{generated_date} at {generated_time}"],
        ["Customer", customer_name or "—"],
        ["Technician", technician_name or "—"],
    ]
    job_table = Table(job_info_data, colWidths=[1.6 * inch, 5.4 * inch])
    job_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (0, -1), BLUE),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, GRAY_LIGHT]),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#cccccc")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(job_table)
    story.append(Spacer(1, 16))

    # Stats summary table
    stats_data = [
        ["Total Devices", "Tested", "Passed", "Failed", "Quote Needed"],
        [
            str(len(job_devices)),
            str(len(tested_devices)),
            str(len(passed)),
            str(len(failed)),
            str(len(quote_needed)),
        ],
    ]
    stats_table = Table(stats_data, colWidths=[1.4 * inch] * 5)
    stats_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#aaaaaa")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [BLUE_LIGHT]),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica-Bold"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(stats_table)
    story.append(Spacer(1, 16))

    # Device roster table
    story.append(Paragraph("Device Roster", h3))
    roster_header = ["Device Type", "Serial #", "Result", "Test Date", "Quote Needed"]
    roster_rows = [roster_header]
    for d in job_devices:
        t = test_by_device.get(d["id"], {})
        result = t.get("testResult") or "Not Tested"
        date_val = t.get("testDateInitial") or "—"
        quote = "Yes" if t.get("quoteNeeded") else ("—" if t else "—")
        roster_rows.append([
            d.get("typeMain") or "Unknown",
            d.get("serialMain") or "—",
            result,
            date_val,
            quote,
        ])
    col_widths = [2.0 * inch, 1.4 * inch, 1.0 * inch, 1.2 * inch, 1.1 * inch]
    roster_table = Table(roster_rows, colWidths=col_widths)
    roster_style = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#cccccc")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ])
    # Colour result cells
    for row_idx, d in enumerate(job_devices, start=1):
        t = test_by_device.get(d["id"], {})
        result = t.get("testResult") or ""
        if result == "Passed":
            roster_style.add("TEXTCOLOR", (2, row_idx), (2, row_idx), GREEN)
            roster_style.add("FONTNAME", (2, row_idx), (2, row_idx), "Helvetica-Bold")
        elif result == "Failed":
            roster_style.add("TEXTCOLOR", (2, row_idx), (2, row_idx), RED)
            roster_style.add("FONTNAME", (2, row_idx), (2, row_idx), "Helvetica-Bold")
    roster_table.setStyle(roster_style)
    story.append(roster_table)

    # ── Per-device sections ──────────────────────────────────────────────────

    for d in tested_devices:
        story.append(PageBreak())
        t = test_by_device[d["id"]]
        result = t.get("testResult") or "Unknown"
        serial = d.get("serialMain") or "N/A"
        dev_type = d.get("typeMain") or "Unknown"

        # Section header
        story.append(Paragraph(f"{dev_type} — SN: {serial}", h2))

        # PASS / FAIL stamp
        stamp_color = GREEN if result == "Passed" else RED
        stamp_data = [[result]]
        stamp = Table(stamp_data, colWidths=[1.6 * inch])
        stamp.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, 0), stamp_color),
            ("TEXTCOLOR", (0, 0), (0, 0), WHITE),
            ("FONTNAME", (0, 0), (0, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (0, 0), 14),
            ("ALIGN", (0, 0), (0, 0), "CENTER"),
            ("TOPPADDING", (0, 0), (0, 0), 8),
            ("BOTTOMPADDING", (0, 0), (0, 0), 8),
            ("ROUNDEDCORNERS", [4, 4, 4, 4]),
        ]))
        story.append(stamp)
        story.append(Spacer(1, 10))
        story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#cccccc"), spaceAfter=8))

        def _row(label, value):
            return [label, str(value) if value else "—"]

        # Device info
        story.append(Paragraph("Device Information", h3))
        dev_info_rows = [
            _row("Manufacturer", d.get("manufacturerMain")),
            _row("Model", d.get("modelMain")),
            _row("Size", d.get("sizeMain")),
            _row("Location", d.get("bpaLocation")),
            _row("Serves", d.get("bpaServes")),
        ]
        if d.get("domesticMainline"):
            dev_info_rows.append(["Domestic Mainline", "Yes"])
        dev_table = Table(dev_info_rows, colWidths=[1.8 * inch, 5.2 * inch])
        dev_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, GRAY_LIGHT]),
            ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#dddddd")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(dev_table)
        story.append(Spacer(1, 10))

        # Test info
        story.append(Paragraph("Test Information", h3))
        test_info_rows = [
            _row("Test Date", t.get("testDateInitial")),
            _row("Test Time", t.get("testTimeInitial")),
            _row("Reason for Test", t.get("reasonForTest")),
            _row("Installed Per Code", "Yes" if t.get("installedPerCode") else "No"),
            _row("Gauge Type", t.get("gaugeType")),
        ]
        test_info_table = Table(test_info_rows, colWidths=[1.8 * inch, 5.2 * inch])
        test_info_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, GRAY_LIGHT]),
            ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#dddddd")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(test_info_table)
        story.append(Spacer(1, 10))

        # Initial readings
        reading_rows = []
        if t.get("firstCheckReadingInitial") is not None and t.get("firstCheckReadingInitial") != "":
            reading_rows.append(_row("1st Check Reading", f"{t['firstCheckReadingInitial']} PSI"))
        if t.get("secondCheckReadingInitial") is not None and t.get("secondCheckReadingInitial") != "":
            reading_rows.append(_row("2nd Check Reading", f"{t['secondCheckReadingInitial']} PSI"))
        if t.get("reliefValveReadingInitial") is not None and t.get("reliefValveReadingInitial") != "":
            reading_rows.append(_row("Relief Valve Reading", f"{t['reliefValveReadingInitial']} PSI"))
        if t.get("airInletReadingInitial") is not None and t.get("airInletReadingInitial") != "":
            reading_rows.append(_row("Air Inlet Reading", f"{t['airInletReadingInitial']} PSI"))
        if t.get("checkValveReadingInitial") is not None and t.get("checkValveReadingInitial") != "":
            reading_rows.append(_row("Check Valve Reading", f"{t['checkValveReadingInitial']} PSI"))
        if reading_rows:
            story.append(Paragraph("Initial Readings", h3))
            readings_table = Table(reading_rows, colWidths=[1.8 * inch, 5.2 * inch])
            readings_table.setStyle(TableStyle([
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, GRAY_LIGHT]),
                ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#dddddd")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ]))
            story.append(readings_table)
            story.append(Spacer(1, 10))

        # Repairs
        if t.get("repairsDescription"):
            story.append(Paragraph("Repairs", h3))
            repair_rows = [_row("Repair Description", t.get("repairsDescription"))]
            if t.get("isolationValveUpstream") is not None:
                repair_rows.append(_row("Isolation Valve Upstream", "Yes" if t.get("isolationValveUpstream") else "No"))
            if t.get("isolationValveDownstream") is not None:
                repair_rows.append(_row("Isolation Valve Downstream", "Yes" if t.get("isolationValveDownstream") else "No"))
            # After-repair readings
            if t.get("firstCheckReadingAfterRepair") is not None and t.get("firstCheckReadingAfterRepair") != "":
                repair_rows.append(_row("1st Check After Repair", f"{t['firstCheckReadingAfterRepair']} PSI"))
            if t.get("secondCheckReadingAfterRepair") is not None and t.get("secondCheckReadingAfterRepair") != "":
                repair_rows.append(_row("2nd Check After Repair", f"{t['secondCheckReadingAfterRepair']} PSI"))
            if t.get("reliefValveReadingAfterRepair") is not None and t.get("reliefValveReadingAfterRepair") != "":
                repair_rows.append(_row("Relief Valve After Repair", f"{t['reliefValveReadingAfterRepair']} PSI"))
            if t.get("airInletReadingAfterRepair") is not None and t.get("airInletReadingAfterRepair") != "":
                repair_rows.append(_row("Air Inlet After Repair", f"{t['airInletReadingAfterRepair']} PSI"))
            if t.get("checkValveReadingAfterRepair") is not None and t.get("checkValveReadingAfterRepair") != "":
                repair_rows.append(_row("Check Valve After Repair", f"{t['checkValveReadingAfterRepair']} PSI"))
            repair_table = Table(repair_rows, colWidths=[2.0 * inch, 5.0 * inch])
            repair_table.setStyle(TableStyle([
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, GRAY_LIGHT]),
                ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#dddddd")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ]))
            story.append(repair_table)
            story.append(Spacer(1, 10))

        # Remarks
        if t.get("remarks"):
            story.append(Paragraph("Remarks", h3))
            story.append(Paragraph(str(t["remarks"]), body))
            story.append(Spacer(1, 10))

        # Quote needed
        if t.get("quoteNeeded"):
            quote_data = [["Quote Needed"]]
            qt = Table(quote_data, colWidths=[1.8 * inch])
            qt.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (0, 0), HexColor("#fff3e0")),
                ("TEXTCOLOR", (0, 0), (0, 0), HexColor("#e65100")),
                ("FONTNAME", (0, 0), (0, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (0, 0), 10),
                ("ALIGN", (0, 0), (0, 0), "CENTER"),
                ("TOPPADDING", (0, 0), (0, 0), 5),
                ("BOTTOMPADDING", (0, 0), (0, 0), 5),
            ]))
            story.append(qt)

    doc.build(story)
    buf.seek(0)
    return buf.getvalue()


@router.post("/api/job/{job_id}/backflow-summary-pdf")
async def generate_job_summary_pdf(
    job_id: str,
    body: dict,
    st: ServiceTitanClient = Depends(get_st_client),
):
    # Load devices from ST customer notes (authoritative source)
    job_devices: list = []
    try:
        job_endpoint = st.build_tenant_url("jpm") + f"/jobs/{job_id}"
        job_data = await st.api_call(job_endpoint)
        customer_id = job_data.get("customerId")
        location_id = str(job_data.get("locationId") or "")
        if customer_id:
            notes_resp = await st.api_call(
                st.build_tenant_url("crm") + f"/customers/{customer_id}/notes?pageSize=100"
            )
            for note in notes_resp.get("data", []):
                text = note.get("text") or ""
                if "[BACKFLOW_DEVICE_" not in text:
                    continue
                dev = _parse_device_note(text)
                if not dev:
                    continue
                dev["jobId"] = job_id
                dev_loc = str(dev.get("locationId") or "")
                if not dev_loc or dev_loc == location_id:
                    job_devices.append(dev)
    except Exception as e:
        print(f"[backflow] Summary PDF: could not load devices from ST: {e}")
        job_devices = [d for d in _devices if str(d.get("jobId")) == str(job_id)]

    # Load tests from ST job notes (authoritative source)
    job_tests: list = []
    try:
        notes_resp = await st.api_call(
            st.build_tenant_url("jpm") + f"/jobs/{job_id}/notes?pageSize=200"
        )
        by_device: dict = {}
        for note in notes_resp.get("data", []):
            text = note.get("text") or ""
            if "[BACKFLOW_TEST_" not in text:
                continue
            t = _parse_test_note(text)
            if not t:
                continue
            dev_id = t.get("deviceId")
            if not dev_id:
                continue
            existing = by_device.get(dev_id)
            if not existing or t.get("createdAt", "") >= existing.get("createdAt", ""):
                by_device[dev_id] = t
        job_tests = list(by_device.values())
    except Exception as e:
        print(f"[backflow] Summary PDF: could not load tests from ST: {e}")
        job_tests = [t for t in _test_records if str(t.get("jobId")) == str(job_id)]

    test_by_device = {t["deviceId"]: t for t in job_tests}

    pdf_bytes = _generate_job_summary_pdf(job_id, job_devices, test_by_device, body)

    date_str = datetime.now().strftime("%Y%m%d")
    file_name = f"{date_str}_TEST_Summary.pdf"

    # Upload to ServiceTitan as job attachment
    st_attachment_id = None
    try:
        token = await st.get_access_token()
        upload_url = f"{st.api_base_url}/forms/v2/tenant/{st.tenant_id}/jobs/{job_id}/attachments"
        async with httpx.AsyncClient() as client:
            response = await client.post(
                upload_url,
                headers={"Authorization": f"Bearer {token}", "ST-App-Key": st.app_key},
                files={"file": (file_name, pdf_bytes, "application/pdf")},
                timeout=60.0,
            )
        if response.is_success:
            resp_json = response.json() if response.text else {}
            print(f"[backflow] Summary PDF ST upload: {resp_json}")
            st_attachment_id = (
                resp_json.get("id")
                or resp_json.get("attachmentId")
                or resp_json.get("data", {}).get("id")
                or "uploaded"
            )
        else:
            print(f"[backflow] Summary PDF ST upload failed: {response.status_code} {response.text}")
    except Exception as e:
        print(f"[backflow] Summary PDF ST upload error: {e}")

    pdf_record = {
        "id": f"pdf-{next(_pdf_counter)}",
        "jobId": job_id,
        "fileName": file_name,
        "serviceTitanAttachmentId": st_attachment_id,
        "isSummary": True,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    _generated_pdfs.append(pdf_record)
    return {"success": True, "data": pdf_record}
