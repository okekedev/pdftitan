"""
Drafts router — mirrors backend/api/drafts.js

All Google Drive operations run in a thread pool (sync googleapis client).
"""
import asyncio
import re
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from services.google_drive import GoogleDriveService, get_drive_service
from services.servicetitan import ServiceTitanClient, get_st_client

router = APIRouter()


def _in_thread(drive: GoogleDriveService, method_name: str, *args, **kwargs):
    """Run a sync GoogleDriveService method in a thread pool."""
    return asyncio.to_thread(getattr(drive, method_name), *args, **kwargs)


async def _upload_to_st(
    st: ServiceTitanClient, job_id: str, pdf_buffer: bytes, file_name: str
) -> dict:
    token = await st.get_access_token()
    headers = {"Authorization": f"Bearer {token}", "ST-App-Key": st.app_key}
    upload_url = (
        f"{st.api_base_url}/forms/v2/tenant/{st.tenant_id}/jobs/{job_id}/attachments"
    )

    async with httpx.AsyncClient() as client:
        response = await client.post(
            upload_url,
            headers=headers,
            files={"file": (file_name, pdf_buffer, "application/pdf")},
            data={
                "name": file_name,
                "description": "Completed PDF form uploaded from TitanPDF",
            },
            timeout=60.0,
        )

    if not response.is_success:
        return {
            "success": False,
            "error": f"ServiceTitan upload failed: {response.status_code}",
            "details": response.text,
        }

    result = response.json()
    return {
        "success": True,
        "details": {
            "serviceTitanId": result.get("id", "Unknown"),
            "uploadedAt": datetime.now(timezone.utc).isoformat(),
            "fileName": file_name,
            "fileSize": len(pdf_buffer),
        },
    }


# ── Routes ────────────────────────────────────────────────────────────────────


@router.post("/api/drafts/save")
async def save_draft(
    body: dict,
    st: ServiceTitanClient = Depends(get_st_client),
    drive: GoogleDriveService = Depends(get_drive_service),
):
    job_id = body.get("jobId")
    attachment_id = body.get("attachmentId")
    file_name = body.get("fileName") or "Draft.pdf"
    objects = body.get("objects")

    if not job_id or not attachment_id or objects is None:
        raise HTTPException(400, "Missing required fields: jobId, attachmentId, objects")

    # Download original PDF from ServiceTitan
    token = await st.get_access_token()
    download_url = (
        f"{st.api_base_url}/forms/v2/tenant/{st.tenant_id}"
        f"/jobs/attachment/{attachment_id}"
    )
    headers = {"Authorization": f"Bearer {token}", "ST-App-Key": st.app_key}

    async with httpx.AsyncClient(follow_redirects=True) as client:
        response = await client.get(download_url, headers=headers, timeout=60.0)

    if not response.is_success:
        raise HTTPException(500, f"Failed to download PDF: {response.status_code}")

    original_pdf = response.content
    if not original_pdf or original_pdf[:4] != b"%PDF":
        raise HTTPException(500, "Downloaded file is not a valid PDF")

    # Save to Google Drive as draft
    result = await _in_thread(
        drive, "save_pdf_as_draft", original_pdf, objects, str(job_id), file_name
    )

    if not result.get("success"):
        raise HTTPException(500, result.get("error", "Failed to save PDF as draft"))

    return {
        "success": True,
        "message": "PDF saved as draft",
        "fileId": result.get("fileId"),
        "fileName": result.get("fileName"),
        "driveUrl": result.get("driveUrl"),
    }


@router.put("/api/drafts/update/{file_id}")
async def update_draft(
    file_id: str,
    body: dict,
    drive: GoogleDriveService = Depends(get_drive_service),
):
    job_id = body.get("jobId")
    objects = body.get("objects")
    file_name = body.get("fileName") or "Draft.pdf"

    if not job_id or objects is None:
        raise HTTPException(400, "Missing required fields: jobId, objects")

    # Download existing PDF from Google Drive
    download_result = await _in_thread(drive, "download_file", file_id)
    if not download_result.get("success"):
        raise HTTPException(500, f"Failed to download existing draft: {download_result.get('error')}")

    original_pdf = download_result["data"]

    # Generate filled PDF
    filled_pdf = await asyncio.to_thread(
        drive.generate_filled_pdf, original_pdf, objects
    )

    # Replace file in Google Drive
    update_result = await _in_thread(drive, "update_file", file_id, filled_pdf, file_name)
    if not update_result.get("success"):
        raise HTTPException(500, f"Failed to update file: {update_result.get('error')}")

    return {
        "success": True,
        "message": "Draft updated successfully",
        "fileId": file_id,
        "fileName": update_result.get("fileName") or file_name,
    }


@router.get("/api/drafts/{job_id}")
async def get_drafts(
    job_id: str, drive: GoogleDriveService = Depends(get_drive_service)
):
    result = await _in_thread(drive, "get_files_by_job_id", job_id)
    if not result.get("success"):
        raise HTTPException(500, result.get("error", "Failed to get files"))

    return {
        "success": True,
        "jobId": result["jobId"],
        "drafts": result["drafts"],
        "completed": result["completed"],
    }


@router.get("/api/drafts/download/{file_id}")
async def download_draft(
    file_id: str, drive: GoogleDriveService = Depends(get_drive_service)
):
    result = await _in_thread(drive, "download_file", file_id)
    if not result.get("success"):
        raise HTTPException(500, result.get("error", "Failed to download file"))

    pdf_buffer = result.get("data")
    if not pdf_buffer:
        raise HTTPException(404, "File not found")

    if pdf_buffer[:4] != b"%PDF":
        raise HTTPException(400, "Downloaded file is not a valid PDF")

    return Response(
        content=pdf_buffer,
        media_type="application/pdf",
        headers={"Cache-Control": "private, no-cache"},
    )


@router.get("/api/drafts/info/{file_id}")
async def get_draft_info(
    file_id: str, drive: GoogleDriveService = Depends(get_drive_service)
):
    metadata = await _in_thread(drive, "get_file_metadata", file_id)
    if not metadata:
        raise HTTPException(404, "File not found")
    return {"success": True, "data": metadata}


@router.post("/api/drafts/{file_id}/complete")
async def complete_draft(
    file_id: str,
    body: dict,
    st: ServiceTitanClient = Depends(get_st_client),
    drive: GoogleDriveService = Depends(get_drive_service),
):
    job_id = body.get("jobId")
    if not job_id:
        raise HTTPException(400, "Missing required field: jobId")

    # Step 1: Move from draft to completed folder
    promote_result = await _in_thread(drive, "promote_to_completed", file_id, str(job_id))
    if not promote_result.get("success"):
        raise HTTPException(500, f"Failed to move to completed folder: {promote_result.get('error')}")

    # Step 2: Download completed PDF from Google Drive
    download_result = await _in_thread(drive, "download_file", file_id)
    if not download_result.get("success"):
        raise HTTPException(500, f"Failed to download completed PDF: {download_result.get('error')}")

    pdf_buffer = download_result["data"]

    # Step 3: Build final file name
    metadata = await _in_thread(drive, "get_file_metadata", file_id)
    raw_name = (metadata or {}).get("name") or "Completed Form.pdf"
    # Strip "Attaches/" prefix and "Completed - " duplicate prefix
    raw_name = re.sub(r"^Attaches/", "", raw_name)
    raw_name = re.sub(r"^Completed\s*-\s*", "", raw_name, flags=re.IGNORECASE)
    base_name = raw_name if raw_name.lower().endswith(".pdf") else f"{raw_name}.pdf"
    final_file_name = f"Completed - {base_name}"

    # Step 4: Upload to ServiceTitan
    st_upload = await _upload_to_st(st, str(job_id), pdf_buffer, final_file_name)
    if not st_upload.get("success"):
        raise HTTPException(500, f"ServiceTitan upload failed: {st_upload.get('error')}")

    return {
        "success": True,
        "message": "Form completed and uploaded successfully",
        "workflow": {
            "googleDriveMove": "Moved to completed folder",
            "googleDriveDownload": "Downloaded from Google Drive",
            "serviceTitanUpload": "Uploaded to ServiceTitan",
        },
        "fileId": file_id,
        "fileName": final_file_name,
        "uploadedAt": datetime.now(timezone.utc).isoformat(),
        "serviceTitanDetails": st_upload.get("details"),
    }
