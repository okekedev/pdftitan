"""
Google Drive service — mirrors backend/services/googleDriveService.js

IMPORTANT: ALL Drive API calls must include supportsAllDrives=True and
includeItemsFromAllDrives=True because the folders are on a shared drive.
"""
import base64
import io
import json
import os

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload

from services.pdf_service import generate_filled_pdf

SCOPES = ["https://www.googleapis.com/auth/drive"]


def _get_credentials() -> service_account.Credentials:
    # Method 1: Base64-encoded full service account JSON (preferred)
    creds_b64 = os.getenv("GOOGLE_CREDENTIALS_BASE64")
    if creds_b64:
        creds_json = json.loads(base64.b64decode(creds_b64).decode("utf-8"))
        return service_account.Credentials.from_service_account_info(
            creds_json, scopes=SCOPES
        )

    # Method 2: Individual environment variables (production fallback)
    private_key = os.getenv("GOOGLE_DRIVE_PRIVATE_KEY", "")
    if private_key:
        # Handle literal \n stored in secrets managers
        private_key = private_key.replace("\\n", "\n")
        creds_info = {
            "type": "service_account",
            "project_id": os.getenv("GOOGLE_DRIVE_PROJECT_ID"),
            "private_key_id": os.getenv("GOOGLE_DRIVE_PRIVATE_KEY_ID"),
            "private_key": private_key,
            "client_email": os.getenv("GOOGLE_DRIVE_CLIENT_EMAIL"),
            "client_id": os.getenv("GOOGLE_DRIVE_CLIENT_ID"),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
        return service_account.Credentials.from_service_account_info(
            creds_info, scopes=SCOPES
        )

    raise RuntimeError(
        "No Google credentials found. Set GOOGLE_CREDENTIALS_BASE64 or "
        "individual GOOGLE_DRIVE_* environment variables."
    )


class GoogleDriveService:
    def __init__(self):
        self._service = None
        self.draft_folder_id = os.getenv("GOOGLE_DRIVE_DRAFT_FOLDER_ID")
        self.completed_folder_id = os.getenv("GOOGLE_DRIVE_COMPLETED_FOLDER_ID")

    def _get_service(self):
        if self._service is None:
            creds = _get_credentials()
            self._service = build("drive", "v3", credentials=creds)
        return self._service

    # ── Folder helpers ────────────────────────────────────────────────────────

    def _create_or_get_job_folder(self, job_id: str, parent_folder_id: str) -> str:
        drive = self._get_service()
        query = (
            f"'{parent_folder_id}' in parents "
            f"and name = '{job_id}' "
            f"and mimeType = 'application/vnd.google-apps.folder' "
            f"and trashed = false"
        )
        result = (
            drive.files()
            .list(
                q=query,
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
                fields="files(id, name)",
            )
            .execute()
        )

        files = result.get("files", [])
        if files:
            return files[0]["id"]

        # Create new job subfolder
        folder_metadata = {
            "name": str(job_id),
            "mimeType": "application/vnd.google-apps.folder",
            "parents": [parent_folder_id],
        }
        folder = (
            drive.files()
            .create(
                body=folder_metadata,
                supportsAllDrives=True,
                fields="id, name",
            )
            .execute()
        )
        return folder["id"]

    # ── Public API ────────────────────────────────────────────────────────────

    def save_pdf_as_draft(
        self, pdf_buffer: bytes, objects: list, job_id: str, file_name: str
    ) -> dict:
        try:
            job_folder_id = self._create_or_get_job_folder(
                str(job_id), self.draft_folder_id
            )
            filled_pdf = generate_filled_pdf(pdf_buffer, objects)
            result = self._upload_to_folder(filled_pdf, file_name, job_folder_id)
            return {**result, "jobId": job_id, "folderType": "draft"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def update_file(self, file_id: str, pdf_buffer: bytes, file_name: str) -> dict:
        try:
            drive = self._get_service()
            media = MediaIoBaseUpload(
                io.BytesIO(pdf_buffer), mimetype="application/pdf", resumable=False
            )
            file = (
                drive.files()
                .update(
                    fileId=file_id,
                    media_body=media,
                    supportsAllDrives=True,
                    fields="id, name, size, modifiedTime",
                )
                .execute()
            )
            return {
                "success": True,
                "fileId": file["id"],
                "fileName": file.get("name"),
                "size": file.get("size"),
                "modifiedTime": file.get("modifiedTime"),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def promote_to_completed(self, file_id: str, job_id: str) -> dict:
        try:
            drive = self._get_service()
            completed_folder_id = self._create_or_get_job_folder(
                str(job_id), self.completed_folder_id
            )
            draft_folder_id = self._create_or_get_job_folder(
                str(job_id), self.draft_folder_id
            )
            drive.files().update(
                fileId=file_id,
                addParents=completed_folder_id,
                removeParents=draft_folder_id,
                supportsAllDrives=True,
                fields="id, parents",
            ).execute()
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def download_file(self, file_id: str) -> dict:
        try:
            drive = self._get_service()
            request = drive.files().get_media(
                fileId=file_id, supportsAllDrives=True
            )
            buf = io.BytesIO()
            downloader = MediaIoBaseDownload(buf, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()
            buf.seek(0)
            return {"success": True, "data": buf.read()}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_file_metadata(self, file_id: str) -> dict | None:
        try:
            drive = self._get_service()
            result = (
                drive.files()
                .get(
                    fileId=file_id,
                    fields="id, name, size, mimeType, createdTime, modifiedTime, parents",
                    supportsAllDrives=True,
                )
                .execute()
            )
            return result
        except Exception:
            return None

    def get_files_by_job_id(self, job_id: str) -> dict:
        try:
            drafts = self._get_files_in_job_folder(str(job_id), self.draft_folder_id)
            completed = self._get_files_in_job_folder(
                str(job_id), self.completed_folder_id
            )
            return {
                "success": True,
                "jobId": job_id,
                "drafts": drafts,
                "completed": completed,
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "drafts": [],
                "completed": [],
            }

    def generate_filled_pdf(self, pdf_buffer: bytes, objects: list) -> bytes:
        return generate_filled_pdf(pdf_buffer, objects)

    # ── Private helpers ───────────────────────────────────────────────────────

    def _upload_to_folder(
        self, pdf_buffer: bytes, file_name: str, folder_id: str
    ) -> dict:
        drive = self._get_service()
        file_metadata = {"name": file_name, "parents": [folder_id]}
        media = MediaIoBaseUpload(
            io.BytesIO(pdf_buffer), mimetype="application/pdf", resumable=False
        )
        file = (
            drive.files()
            .create(
                body=file_metadata,
                media_body=media,
                supportsAllDrives=True,
                fields="id, name, createdTime, size, parents",
            )
            .execute()
        )
        return {
            "success": True,
            "fileId": file["id"],
            "fileName": file["name"],
            "createdTime": file.get("createdTime"),
            "size": file.get("size"),
        }

    def _get_files_in_job_folder(
        self, job_id: str, parent_folder_id: str
    ) -> list:
        drive = self._get_service()
        q = (
            f"'{parent_folder_id}' in parents "
            f"and name = '{job_id}' "
            f"and mimeType = 'application/vnd.google-apps.folder' "
            f"and trashed = false"
        )
        folders = (
            drive.files()
            .list(
                q=q,
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
                fields="files(id, name)",
            )
            .execute()
        )
        folder_files = folders.get("files", [])
        if not folder_files:
            return []

        job_folder_id = folder_files[0]["id"]
        files_result = (
            drive.files()
            .list(
                q=f"'{job_folder_id}' in parents and mimeType = 'application/pdf' and trashed = false",
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
                fields="files(id, name, createdTime, modifiedTime, size)",
                orderBy="modifiedTime desc",
            )
            .execute()
        )
        return files_result.get("files", [])


# Module-level singleton
_drive_service: GoogleDriveService | None = None


def get_drive_service() -> GoogleDriveService:
    global _drive_service
    if _drive_service is None:
        _drive_service = GoogleDriveService()
    return _drive_service
