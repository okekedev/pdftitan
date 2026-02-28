"""
Backflow router — mirrors backend/api/backflow.js

In-memory state (resets on restart). Devices are persisted to ServiceTitan
customer notes for durability.
"""
import itertools
import json
import os
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
        id_match = __import__("re").search(r"\[BACKFLOW_DEVICE_(.*?)\]", note_text)
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
    try:
        job_endpoint = st.build_tenant_url("jpm") + f"/jobs/{job_id}"
        job_data = await st.api_call(job_endpoint)
        location_id = job_data.get("locationId")
        customer_id = job_data.get("customerId")
    except Exception as e:
        raise HTTPException(500, f"Failed to fetch job: {e}")

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
async def get_tests(job_id: str):
    return {"success": True, "data": [t for t in _test_records if t.get("jobId") == job_id]}


@router.post("/api/backflow-tests/save")
async def save_test(body: dict):
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
        **test,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

    existing_idx = next(
        (i for i, t in enumerate(_test_records) if t.get("deviceId") == saved_device["id"]),
        -1,
    )
    if existing_idx != -1:
        _test_records[existing_idx] = {**_test_records[existing_idx], **new_test}
        return {"success": True, "data": _test_records[existing_idx]}
    else:
        _test_records.append(new_test)
        return {"success": True, "data": new_test}


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
    text_values = {
        # PWS / header
        'Text Field':   city_info.get("pwsName", ""),
        'Text Field_1': city_info.get("pwsId", ""),
        'Text Field_2': city_info.get("pwsAddress", ""),
        'Text Field_3': city_info.get("pwsContact", ""),
        'Text Field_4': service_address,
        'Text Field_5': customer_name,
        # Main assembly
        'Text Field_6':         device.get("manufacturerMain", ""),
        'Text Field_6_1_2':     device.get("modelMain", ""),
        'Text Field_6_1_2_5':   device.get("sizeMain", ""),
        'Text Field_6_1_2_5_1': device.get("serialMain", ""),
        # Bypass assembly
        'Text Field_6_1':       device.get("manufacturerBypass", ""),
        'Text Field_6_1_2_1':   device.get("modelBypass", ""),
        'Text Field_6_1_2_3':   device.get("serialBypass", ""),
        'Text Field_6_1_1':     device.get("bpaLocation", ""),
        'Text Field_6_1_2_2':   device.get("bpaServes", ""),
        'Text Field_6_1_2_3_1': device.get("sizeBypass", ""),
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
        # Tester certification
        'Text Field_6_1_2_3_2_1_1_2_10':        company.get("name", ""),
        'Text Field_6_1_2_3_2_1_1_2_10_1':      company.get("phone", ""),
        'Text Field_6_1_2_3_2_1_1_2_10_1_1':    test.get("testDateInitial", ""),
        'Text Field_6_1_2_3_2_1_1_2_10_1_5_2':  company.get("address", ""),
        'Text Field_6_1_2_3_2_1_1_2_10_1_2':    technician.get("bpatLicenseNumber", ""),
        'Text Field_6_1_2_3_2_1_1_2_10_1_3':    technician.get("licenseExpirationDate", ""),
        'Text Field_6_1_2_3_2_1_1_2_10_1_4':    technician.get("name", ""),
    }

    # Remove empty strings — don't overwrite with blank
    text_values = {k: v for k, v in text_values.items() if v}

    writer.update_page_form_field_values(writer.pages[0], text_values)

    # Checkboxes
    device_type = device.get("typeMain", "")
    type_checkbox_map = {
        "DC": "Check Box_2",
        "RPZ": "Check Box_2_1",
        "DCDA": "Check Box_2_4",
        "RPDA": "Check Box_2_5",
        "PVB": "Check Box_2_7",
        "SVB": "Check Box_2_8",
        "DCDA Type II": "Check Box_2_3",
        "RPDA Type II": "Check Box_2_6",
    }
    check_values = {}
    if device_type in type_checkbox_map:
        check_values[type_checkbox_map[device_type]] = True

    # Reason for test
    reason = test.get("reasonForTest", "Existing")
    if reason == "New":
        check_values["Check Box"] = True
    elif reason == "Existing":
        check_values["Check Box_1"] = True

    # Installed per code
    if test.get("installedPerCode") == "Yes":
        check_values["Check Box_2_27"] = True

    # Non-potable auxiliary
    if test.get("installedOnNonPotableAuxiliary") == "Yes":
        check_values["Check Box_2_28"] = True

    # Initial status checkboxes
    if test.get("firstCheckClosedTightInitial") == "Closed Tight":
        check_values["Check Box_2_11"] = True
    else:
        check_values["Check Box_2_12"] = True

    if test.get("secondCheckClosedTightInitial") == "Closed Tight":
        check_values["Check Box_2_9"] = True
    else:
        check_values["Check Box_2_10"] = True

    if test.get("reliefValveDidNotOpenInitial") == "Did not open":
        check_values["Check Box_2_13"] = True

    if test.get("airInletDidNotOpenInitial") == "Yes":
        check_values["Check Box_2_14"] = True

    if test.get("checkValveLeakedInitial") == "No":
        check_values["Check Box_2_15"] = True

    # After-repair status checkboxes
    if test.get("firstCheckClosedTightAfterRepair") == "Closed Tight":
        check_values["Check Box_2_16"] = True
    elif test.get("firstCheckClosedTightAfterRepair") == "Leaked":
        check_values["Check Box_2_17"] = True

    if test.get("secondCheckClosedTightAfterRepair") == "Closed Tight":
        check_values["Check Box_2_18"] = True
    elif test.get("secondCheckClosedTightAfterRepair") == "Leaked":
        check_values["Check Box_2_19"] = True

    if test.get("typeIIBypassClosedTightAfterRepair") == "Closed Tight":
        check_values["Check Box_2_21"] = True

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
            st_attachment_id = response.json().get("id")
            print(f"[backflow] PDF uploaded to ST attachment: {st_attachment_id}")
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
