"""
test_google_drive.py — mirrors backend/tests/auth/google-drive.test.js
Live: makes real calls to Google Drive API. Requires .env with valid credentials.
"""
import pytest

from services.google_drive import GoogleDriveService


@pytest.fixture
def drive():
    return GoogleDriveService()


def test_service_account_obtains_access_token(drive):
    """Auth succeeds — can build Drive service without raising."""
    service = drive._get_service()
    assert service is not None


def test_draft_folder_exists_and_accessible(drive):
    service = drive._get_service()
    result = (
        service.files()
        .get(
            fileId=drive.draft_folder_id,
            supportsAllDrives=True,
            fields="id, name",
        )
        .execute()
    )
    assert result.get("id") == drive.draft_folder_id, (
        f"Draft folder ID mismatch: {result.get('id')} != {drive.draft_folder_id}"
    )


def test_completed_folder_exists_and_accessible(drive):
    service = drive._get_service()
    result = (
        service.files()
        .get(
            fileId=drive.completed_folder_id,
            supportsAllDrives=True,
            fields="id, name",
        )
        .execute()
    )
    assert result.get("id") == drive.completed_folder_id


def test_can_list_files_inside_draft_folder(drive):
    service = drive._get_service()
    result = (
        service.files()
        .list(
            q=f"'{drive.draft_folder_id}' in parents and trashed = false",
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
            fields="files(id, name)",
            pageSize=5,
        )
        .execute()
    )
    assert "files" in result, f"Expected 'files' key in result, got: {list(result.keys())}"
    assert isinstance(result["files"], list)
