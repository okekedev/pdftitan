"""
Attachments router — mirrors backend/api/attachments.js

Handles PDF listing, download proxy, fill + upload to ServiceTitan.
"""
import re
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from services.pdf_service import generate_filled_pdf
from services.servicetitan import ServiceTitanClient, get_st_client

router = APIRouter()


def _forms_url(st: ServiceTitanClient, path: str) -> str:
    return f"{st.api_base_url}/forms/v2/tenant/{st.tenant_id}/{path}"


async def _st_headers_no_ct(st: ServiceTitanClient) -> dict:
    """Auth headers without Content-Type (for file downloads)."""
    token = await st.get_access_token()
    return {
        "Authorization": f"Bearer {token}",
        "ST-App-Key": st.app_key,
    }


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("/api/job/{job_id}/attachments")
async def get_job_attachments(
    job_id: int, st: ServiceTitanClient = Depends(get_st_client)
):
    headers = await _st_headers_no_ct(st)
    url = _forms_url(st, f"jobs/{job_id}/attachments")

    async with httpx.AsyncClient(follow_redirects=True) as client:
        response = await client.get(url, headers=headers, timeout=30.0)

    if response.status_code == 404:
        return {"success": True, "data": [], "count": 0, "message": "No attachments found"}

    if not response.is_success:
        raise HTTPException(500, f"Forms API error: {response.status_code}")

    data = response.json()
    attachments = data.get("data", [])

    pdf_attachments = [
        a for a in attachments
        if (a.get("fileName") or a.get("name") or "").lower().endswith(".pdf")
        or "pdf" in (a.get("mimeType") or a.get("contentType") or "").lower()
    ]

    transformed = []
    for idx, att in enumerate(pdf_attachments):
        file_name = att.get("fileName") or att.get("name") or f"Document {idx + 1}"
        transformed.append({
            "id": att.get("id") or f"attachment_{idx}",
            "name": re.sub(r"\.pdf$", "", file_name, flags=re.IGNORECASE),
            "fileName": file_name,
            "type": "PDF Document",
            "status": "Available",
            "active": True,
            "size": att.get("size") or att.get("fileSize") or 0,
            "createdOn": (
                att.get("createdOn")
                or att.get("dateCreated")
                or att.get("modifiedOn")
                or datetime.now(timezone.utc).isoformat()
            ),
            "downloadUrl": att.get("downloadUrl") or att.get("url"),
            "serviceTitanId": att.get("id"),
            "jobId": job_id,
            "mimeType": att.get("mimeType") or att.get("contentType") or "application/pdf",
            "category": "PDF Form",
        })

    return {
        "success": True,
        "data": transformed,
        "count": len(transformed),
        "jobId": job_id,
    }


@router.get("/api/job/{job_id}/attachment/{attachment_id}/download")
async def download_attachment(
    job_id: int,
    attachment_id: int,
    st: ServiceTitanClient = Depends(get_st_client),
):
    headers = await _st_headers_no_ct(st)
    url = _forms_url(st, f"jobs/attachment/{attachment_id}")

    async with httpx.AsyncClient(follow_redirects=True) as client:
        response = await client.get(url, headers=headers, timeout=60.0)

    if not response.is_success:
        raise HTTPException(response.status_code, f"Download failed: {response.status_code}")

    pdf_bytes = response.content

    if not pdf_bytes or pdf_bytes[:4] != b"%PDF":
        raise HTTPException(500, "Downloaded file is not a valid PDF")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="attachment_{attachment_id}.pdf"',
            "Cache-Control": "private, max-age=3600",
            "Accept-Ranges": "bytes",
        },
    )


@router.post("/api/job/{job_id}/attachment/{attachment_id}/save")
async def save_attachment(
    job_id: int,
    attachment_id: int,
    body: dict,
    st: ServiceTitanClient = Depends(get_st_client),
):
    editable_elements = body.get("editableElements") or []
    original_file_name = body.get("originalFileName") or "Form"

    if not editable_elements:
        raise HTTPException(400, "No form elements provided")

    # Step 1: Download original PDF from ServiceTitan
    headers = await _st_headers_no_ct(st)
    download_url = _forms_url(st, f"jobs/attachment/{attachment_id}")

    async with httpx.AsyncClient(follow_redirects=True) as client:
        pdf_response = await client.get(download_url, headers=headers, timeout=60.0)

    if not pdf_response.is_success:
        raise HTTPException(500, f"Failed to download original PDF: {pdf_response.status_code}")

    original_pdf_bytes = pdf_response.content
    if not original_pdf_bytes or original_pdf_bytes[:4] != b"%PDF":
        raise HTTPException(500, "Downloaded file is not a valid PDF")

    # Step 2: Generate filled PDF
    try:
        filled_pdf_bytes = generate_filled_pdf(original_pdf_bytes, editable_elements)
    except Exception as e:
        raise HTTPException(500, f"PDF generation failed: {e}")

    # Step 3: Build clean file name
    clean_name = re.sub(r"\.pdf$", "", original_file_name, flags=re.IGNORECASE)
    clean_name = clean_name.split("/")[-1]
    clean_name = re.sub(r"@@\d+.*$", "", clean_name)
    completed_file_name = f"Completed - {clean_name}.pdf"

    # Step 4: Upload to ServiceTitan
    upload_url = _forms_url(st, f"jobs/{job_id}/attachments")
    upload_headers = await _st_headers_no_ct(st)

    async with httpx.AsyncClient() as client:
        upload_response = await client.post(
            upload_url,
            headers=upload_headers,
            files={"file": (completed_file_name, filled_pdf_bytes, "application/pdf")},
            data={
                "name": completed_file_name,
                "description": f"Completed form with {len(editable_elements)} filled fields",
            },
            timeout=60.0,
        )

    if not upload_response.is_success:
        raise HTTPException(
            500,
            f"ServiceTitan upload failed: {upload_response.status_code} - {upload_response.text}",
        )

    upload_result = upload_response.json()

    def _count(el_type: str) -> int:
        return sum(1 for e in editable_elements if e.get("type") == el_type)

    return {
        "success": True,
        "message": "PDF form completed and uploaded to ServiceTitan successfully",
        "fileName": completed_file_name,
        "fileSize": len(filled_pdf_bytes),
        "elementsProcessed": len(editable_elements),
        "uploadDetails": {
            "serviceTitanId": upload_result.get("id", "Unknown"),
            "uploadedAt": datetime.now(timezone.utc).isoformat(),
            "originalFileName": original_file_name,
            "fieldsProcessed": {
                "text": _count("text"),
                "checkboxes": _count("checkbox"),
                "checkedBoxes": sum(
                    1
                    for e in editable_elements
                    if e.get("type") == "checkbox"
                    and (e.get("content") is True or e.get("content") == "true")
                ),
                "dates": _count("date"),
                "signatures": _count("signature"),
            },
        },
    }
