# TitanPDF — Backend API Reference

Base URL (dev): `http://localhost:3004`
Base URL (prod): same origin as frontend

All responses use JSON. Errors follow the [Error Response Format](#error-response-format) at the bottom.

---

## Health

### `GET /health`

Returns server status and configuration.

**Response:**
```json
{
  "status": "healthy",
  "message": "TitanPDF API",
  "mode": "development",
  "environment": "development",
  "timestamp": "2026-02-26T00:00:00.000Z",
  "version": "2.0.0",
  "runtime": "Python/FastAPI/uvicorn",
  "serviceIntegration": {
    "configured": true,
    "apiBaseUrl": "https://api.servicetitan.io",
    "authBaseUrl": "https://auth.servicetitan.io",
    "environment": "Production"
  }
}
```

---

## Authentication

### `POST /api/technician/validate`

Validates technician credentials against ServiceTitan. Fetches all technicians (paginated, 30-min cache), matches `loginName` case-insensitively, then compares last 10 digits of phone number.

**Request:**
```json
{
  "username": "john.smith",
  "phone": "5551234567"
}
```

**Response (200 — success):**
```json
{
  "success": true,
  "technician": {
    "id": 12345,
    "userId": 67890,
    "name": "John Smith",
    "username": "john.smith",
    "phoneNumber": "5551234567",
    "email": "john@example.com",
    "active": true,
    "businessUnitId": 111,
    "mainZoneId": 222,
    "zoneIds": [222, 333],
    "roleIds": [1],
    "team": "Team A",
    "isManagedTech": false,
    "dailyGoal": 0,
    "burdenRate": 0,
    "accountLocked": false,
    "bpatLicenseNumber": "TX-12345",
    "licenseExpirationDate": "2027-01-01",
    "gauges": []
  },
  "company": {
    "name": "Mr. Backflow TX",
    "address": "...",
    "phone": "...",
    "tenantId": "3495827745",
    "appKey": "ak1...."
  },
  "environment": "Production",
  "metadata": {
    "totalTechnicians": 12,
    "authenticatedAt": "2026-02-26T00:00:00.000Z",
    "cacheUsed": false
  }
}
```

**Response (404 — username not found):**
```json
{ "detail": "Technician 'john.smith' not found" }
```

**Response (401 — phone mismatch):**
```json
{ "detail": "Phone number does not match" }
```

**Response (422 — missing field):**
FastAPI validation error (missing `username` or `phone` field).

---

## Jobs

### `GET /api/technician/:technicianId/jobs`

Returns technician's jobs for the last 3 days + tomorrow, grouped by appointment date in Central Time. Each date group is sorted by priority (Arrived > Working > Dispatched > Scheduled > Completed).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 99001,
      "number": "123456",
      "title": "Annual Backflow Test",
      "status": "Dispatched",
      "priority": 1,
      "customer": {
        "id": 55001,
        "name": "Acme Corp",
        "address": {
          "street": "123 Main St",
          "unit": "",
          "city": "Austin",
          "state": "TX",
          "zip": "78701",
          "fullAddress": "123 Main St, Austin, TX 78701"
        }
      },
      "location": {
        "id": 44001,
        "name": "Main Office",
        "address": {}
      },
      "nextAppointment": {
        "id": 77001,
        "appointmentNumber": "1",
        "start": "2026-02-26T09:00:00Z",
        "end": "2026-02-26T11:00:00Z",
        "status": "Dispatched"
      },
      "businessUnitId": 111,
      "jobTypeId": 22,
      "createdOn": "2026-02-25T00:00:00Z",
      "modifiedOn": "2026-02-26T00:00:00Z"
    }
  ],
  "groupedByDate": {
    "Wed Feb 26 2026": {
      "date": "Wed Feb 26 2026",
      "displayDate": "Wednesday, February 26",
      "dayOfWeek": "Wednesday",
      "shortDate": "Feb 26",
      "isToday": true,
      "isYesterday": false,
      "isTomorrow": false,
      "appointments": []
    }
  },
  "count": 5,
  "technicianId": "12345",
  "dateRange": {
    "start": "2026-02-23T06:00:00Z",
    "end": "2026-02-27T05:59:59Z"
  }
}
```

---

### `GET /api/job/:jobId`

Returns full details for a single job including customer and location.

**Response:**
```json
{
  "success": true,
  "data": { "...full job object with appointments array..." }
}
```

---

### `GET /api/customer/:customerId`

Returns customer details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 55001,
    "name": "Acme Corp",
    "type": "Commercial",
    "address": { "street": "...", "city": "...", "state": "...", "zip": "..." },
    "phone": "5551234567",
    "email": "contact@acme.com",
    "createdOn": "2025-01-01T00:00:00Z"
  }
}
```

---

### `GET /api/appointment/:appointmentId`

Returns a single appointment record.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 77001,
    "appointmentNumber": "1",
    "start": "2026-02-26T09:00:00Z",
    "end": "2026-02-26T11:00:00Z",
    "status": "Dispatched",
    "jobId": 99001
  }
}
```

---

### `POST /api/job/:jobId/notes`

Adds a note to a job in ServiceTitan.

**Request:**
```json
{
  "note": "Backflow test completed. Device passed. See attached report."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Note added successfully"
}
```

---

## Attachments

### `GET /api/job/:jobId/attachments`

Returns PDF attachments for a job from the ServiceTitan Forms API. Filters to PDF files only.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "att-001",
      "name": "Annual Inspection Form",
      "fileName": "inspection_form.pdf",
      "type": "PDF Document",
      "size": 204800,
      "createdOn": "2026-02-01T00:00:00Z",
      "downloadUrl": "/api/job/99001/attachment/att-001/download",
      "serviceTitanId": "att-001",
      "jobId": 99001,
      "mimeType": "application/pdf"
    }
  ]
}
```

---

### `GET /api/job/:jobId/attachment/:attachmentId/download`

Downloads PDF as binary. Returns raw bytes with `Content-Type: application/pdf`.

**Response:** Binary PDF stream

---

### `POST /api/job/:jobId/attachment/:attachmentId/save`

Fills and saves a completed form directly to ServiceTitan (bypasses the Google Drive draft flow).

**Request:**
```json
{
  "editableElements": [
    {
      "type": "text",
      "x": 100, "y": 200,
      "width": 200, "height": 30,
      "page": 1,
      "content": "John Smith",
      "fontSize": 11,
      "color": "#1e3a8a"
    },
    {
      "type": "signature",
      "x": 100, "y": 400,
      "width": 200, "height": 80,
      "page": 1,
      "content": "data:image/png;base64,iVBORw0KGgo..."
    },
    {
      "type": "checkbox",
      "x": 50, "y": 300,
      "width": 20, "height": 20,
      "page": 1,
      "content": true
    }
  ],
  "originalFileName": "inspection_form.pdf",
  "jobInfo": { "id": 99001 }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Form saved to ServiceTitan",
  "fileId": "st-file-001"
}
```

---

## Drafts (Google Drive)

### `POST /api/drafts/save`

Downloads the original PDF from ServiceTitan, fills it with the provided elements using reportlab+pypdf, and saves the result as a draft to Google Drive (`DRAFT_FOLDER/{jobId}/filename.pdf`).

**Request:**
```json
{
  "jobId": "99001",
  "attachmentId": "att-001",
  "objects": [
    {
      "type": "text",
      "x": 100, "y": 200,
      "width": 200, "height": 30,
      "page": 1,
      "content": "John Smith",
      "fontSize": 11,
      "color": "#1e3a8a"
    }
  ],
  "fileName": "inspection_form.pdf"
}
```

**Response:**
```json
{
  "success": true,
  "fileId": "1aBcDeFgHiJkLmNoPqRsTuVwXyZ",
  "fileName": "inspection_form.pdf",
  "driveUrl": "https://drive.google.com/file/d/1aBc.../view",
  "message": "Draft saved successfully"
}
```

---

### `PUT /api/drafts/update/:fileId`

Re-fills the original PDF (re-downloaded from ServiceTitan) and replaces the existing Google Drive file content.

**Request:**
```json
{
  "jobId": "99001",
  "objects": [],
  "fileName": "inspection_form.pdf"
}
```

**Response:**
```json
{
  "success": true,
  "fileId": "1aBcDeFgHiJkLmNoPqRsTuVwXyZ",
  "message": "Draft updated successfully"
}
```

---

### `GET /api/drafts/:jobId`

Returns all drafts and completed files for a job from Google Drive (queries both folders).

**Response:**
```json
{
  "success": true,
  "drafts": [
    {
      "id": "1aBcDeFg...",
      "name": "inspection_form.pdf",
      "mimeType": "application/pdf",
      "createdTime": "2026-02-26T10:00:00Z",
      "modifiedTime": "2026-02-26T11:00:00Z",
      "webViewLink": "https://drive.google.com/...",
      "status": "draft"
    }
  ],
  "completed": [
    {
      "id": "2BcDeFgH...",
      "name": "Completed - inspection_form.pdf",
      "status": "completed"
    }
  ],
  "jobId": "99001"
}
```

---

### `GET /api/drafts/download/:fileId`

Downloads a file from Google Drive as binary PDF.

**Response:** Binary PDF stream (`Content-Type: application/pdf`)

---

### `GET /api/drafts/info/:fileId`

Returns metadata for a Google Drive file without downloading it.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "1aBcDeFg...",
    "name": "inspection_form.pdf",
    "mimeType": "application/pdf",
    "size": "204800",
    "createdTime": "2026-02-26T10:00:00Z",
    "modifiedTime": "2026-02-26T11:00:00Z",
    "webViewLink": "https://drive.google.com/..."
  }
}
```

---

### `POST /api/drafts/:fileId/complete`

Promotes a draft to completed: moves it to the Completed folder in Google Drive, then uploads to ServiceTitan.

**Request:**
```json
{
  "jobId": "99001"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Form uploaded to ServiceTitan and moved to Completed folder",
  "serviceTitanFileId": "st-file-002",
  "driveFileId": "2BcDeFgH..."
}
```

---

## Backflow Testing

All backflow state is in-memory per server process. Devices are also persisted to ServiceTitan customer notes so they survive server restarts.

### `GET /api/job/:jobId/backflow-devices`

Returns all backflow devices associated with a job.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "jobId": "99001",
      "customerId": "55001",
      "manufacturer": "Watts",
      "model": "LF009",
      "serialNumber": "SN12345678",
      "size": "1\"",
      "type": "RPZ",
      "location": "Mechanical room",
      "latitude": null,
      "longitude": null
    }
  ]
}
```

---

### `POST /api/job/:jobId/backflow-devices`

Creates a new backflow device, persists it to the customer's ServiceTitan notes.

**Request:**
```json
{
  "customerId": "55001",
  "manufacturer": "Watts",
  "model": "LF009",
  "serialNumber": "SN12345678",
  "size": "1\"",
  "type": "RPZ",
  "location": "Mechanical room"
}
```

**Response:**
```json
{
  "success": true,
  "data": { "id": 1, "...device fields..." }
}
```

---

### `PUT /api/backflow-devices/:deviceId`

Updates an existing backflow device.

**Request:** Same fields as POST (partial updates accepted).

**Response:**
```json
{ "success": true, "data": { "...updated device..." } }
```

---

### `GET /api/job/:jobId/backflow-tests`

Returns all test records for a job.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "deviceId": 1,
      "jobId": "99001",
      "testDate": "2026-02-26",
      "testTime": "09:30",
      "tester": "John Smith",
      "reason": "Existing",
      "result": "Passed",
      "quoteNeeded": false,
      "initialTest": { "...readings..." },
      "repairsNeeded": false,
      "repairsMade": "",
      "afterRepairTest": null
    }
  ]
}
```

---

### `POST /api/backflow-tests/save`

Records a backflow test result.

**Request:**
```json
{
  "deviceId": 1,
  "jobId": "99001",
  "testDate": "2026-02-26",
  "testTime": "09:30",
  "tester": "John Smith",
  "reason": "Existing",
  "result": "Passed",
  "quoteNeeded": false,
  "initialTest": {
    "cv1Opened": true,
    "cv1": "2.5",
    "cv2Opened": true,
    "cv2": "1.8",
    "rvOpened": false,
    "rv": "5.2"
  },
  "repairsNeeded": false,
  "repairsMade": "",
  "afterRepairTest": null
}
```

**Response:**
```json
{ "success": true, "data": { "id": 1, "...test fields..." } }
```

---

### `GET /api/backflow-tests/:testId/photos`

Returns photos associated with a test.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "testId": 1,
      "fileName": "SN12345678_photo1.jpg",
      "uploadedToServiceTitan": true,
      "serviceTitanAttachmentId": "att-photo-001"
    }
  ]
}
```

---

### `POST /api/backflow-photos/upload`

Uploads a photo for a backflow test. Forwards to ServiceTitan as a job attachment.

**Request:** `multipart/form-data`
- `photo` — image file (JPEG, PNG, etc.)
- `testId` — test record ID
- `jobId` — job ID
- `fileName` — desired file name (e.g., `SN12345678_front.jpg`)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "fileName": "SN12345678_front.jpg",
    "uploadedToServiceTitan": true,
    "serviceTitanAttachmentId": "att-photo-001"
  }
}
```

---

### `DELETE /api/backflow-photos/:photoId`

Deletes a photo record.

**Response:**
```json
{ "success": true, "message": "Photo deleted" }
```

---

### `POST /api/backflow-pdfs/generate`

Generates a TCEQ-compliant backflow test report PDF for a set of devices, optionally formatted for a specific city/jurisdiction.

**Request:**
```json
{
  "jobId": "99001",
  "devices": [ "...device + test data..." ],
  "city": "Fort Worth",
  "technicianName": "John Smith",
  "technicianLicense": "TX-12345"
}
```

**Response:**
```json
{
  "success": true,
  "fileId": "1xYzAbCd...",
  "fileName": "backflow_report_99001.pdf",
  "driveUrl": "https://drive.google.com/...",
  "message": "PDF generated and saved to Google Drive"
}
```

---

### `POST /api/backflow-pdfs/generate-online-reference`

Generates a human-readable reference report (plain layout, easy to read) for manual entry into city portals.

**Request:** Same as `/generate`

**Response:** Same shape as `/generate`

---

## Utilities

### `GET /api/cities`

Returns the list of supported TCEQ jurisdictions.

**Response:**
```json
{
  "success": true,
  "data": [
    "TCEQ",
    "Fort Worth",
    "Weatherford",
    "Hudson Oaks",
    "Parker County SUD",
    "Willow Park",
    "Aledo",
    "Springtown",
    "Poolville"
  ]
}
```

---

### `GET /api/cities/:cityName`

Returns extended information for a specific jurisdiction (PWS number, submission contacts, etc.) if available in the TCEQ Excel templates.

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "Fort Worth",
    "pws": "TX0610032",
    "contacts": []
  }
}
```

---

### `GET /api/form-fields`

Returns form field configuration (reserved for future use — pre-fill templates).

**Response:**
```json
{ "success": true, "data": [] }
```

---

## Error Response Format

All errors follow this shape:

```json
{
  "detail": "Human-readable error message"
}
```

FastAPI uses `detail` (not `error`) as the key for HTTP exceptions. Common HTTP status codes:

| Code | Meaning |
|------|---------|
| `400` | Bad request (missing required fields, invalid data) |
| `401` | Unauthorized (phone number does not match) |
| `404` | Not found (technician, job, attachment, or Drive file) |
| `422` | Unprocessable entity (FastAPI request body validation failure) |
| `500` | Server error (ST API down, Drive API error, PDF generation error) |

---

## PDF Element Object

Used in `objects` arrays for draft save/update and direct save endpoints:

```json
{
  "type": "text",
  "page": 1,
  "x": 100,
  "y": 200,
  "width": 200,
  "height": 30,
  "content": "John Smith",
  "fontSize": 11,
  "color": "#1e3a8a"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `type` | string | `text`, `date`, `timestamp`, `signature`, `checkbox` |
| `page` | int | 1-indexed page number |
| `x`, `y` | float | Position in editor space (top-left origin, pixels) |
| `width`, `height` | float | Dimensions in pixels |
| `content` | string \| bool | Text value, base64 PNG (signature), or bool (checkbox) |
| `fontSize` | int | Font size (text/date/timestamp only). Default: 11 |
| `color` | string | Hex color (text/date/timestamp only). Default: `#1e3a8a` |

**Coordinate conversion (backend):**
`pdf_y = page_height - element_y - element_height + 1`
