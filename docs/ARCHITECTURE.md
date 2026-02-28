# TitanPDF — Technical Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Technician)                  │
│                                                         │
│   React 18 + TypeScript  port 3003 (dev)                │
│   (Vite)                 └── proxies /api/* to :3004    │
│   ├── Login page                                        │
│   ├── Jobs page                                         │
│   ├── Attachments page                                  │
│   ├── PDFEditor (pdfjs-dist rendering)                  │
│   └── BackflowTesting module                            │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP /api/*
┌──────────────────────▼──────────────────────────────────┐
│              FastAPI Backend              port 3004      │
│                                                         │
│   ServiceTitanClient (async httpx, OAuth2 + caching)    │
│   ├── /api/technician/validate    (routers/auth.py)     │
│   ├── /api/technician/:id/jobs    (routers/jobs.py)     │
│   ├── /api/job/:id/attachments    (routers/attachments) │
│   ├── /api/job/:id/attachment/*   (routers/attachments) │
│   ├── /api/drafts/*               (routers/drafts.py)   │
│   └── /api/backflow*              (routers/backflow.py) │
└──────────┬───────────────────────┬──────────────────────┘
           │                       │
┌──────────▼──────────┐  ┌─────────▼────────────────────┐
│  ServiceTitan API   │  │  Google Drive API v3          │
│  api.servicetitan.io│  │  Service account JWT auth     │
│  auth.servicetitan.io│ │  mr-backflow-worker@pdf-titan │
│                     │  │  ├── Draft folder (by job ID) │
│  - Technicians API  │  │  └── Completed folder         │
│  - Jobs API         │  └───────────────────────────────┘
│  - Attachments API  │
│  - Forms API        │
└─────────────────────┘
```

---

## Frontend

### Tech Stack
- **React 18 + TypeScript** — strict mode, pragmatic `any` for API shapes
- **Vite 6** — dev server (port 3003) and production bundler (replaces CRA)
- **PDF.js** (pdfjs-dist 5.x) — PDF rendering/display
- **react-router-dom** v7 — client-side routing (minimal use)
- **No Redux, no component library (mostly custom CSS)**

### State Management
All state lives in React `useState`/`useEffect`. No global store.

The only cross-component state:
- **Session** — `sessionStorage` via `sessionManager.ts`
- **Theme** — `localStorage` + `data-theme` attribute on `<html>`
- **App routing** — `currentPage` + `selectedJob` state in `App.tsx`

### Routing Architecture
Not URL-based routing — `App.tsx` uses a `currentPage` string to conditionally render pages:

```
currentPage === "jobs"              → <Jobs>
currentPage === "attachments"       → <Attachments> (requires selectedJob)
currentPage === "backflow-testing"  → <BackflowTesting> (requires selectedJob)
currentPage === "documentation"     → <Documentation>
```

**Why:** Simpler for a single-user tool. No need for shareable URLs or back-button navigation.

### Header Architecture
The `<Header>` component renders **once** at the app level in `App.tsx`. It is NOT included in individual page components. Pages receive navigation via callback props (`onBack`, `onSelectJob`, etc.).

Theme toggle lives in Header. Breadcrumbs computed in `App.tsx` based on `currentPage` + `selectedJob`.

### PDF Editor Architecture
`PDFEditor.tsx` renders the PDF via pdf.js canvas, then overlays an absolutely-positioned div layer where form elements are placed.

```
┌────────────────────────────────┐
│  PDF Canvas (pdf.js rendered)  │
├────────────────────────────────┤
│  Overlay div (position:abs)    │
│  ├── Text field (draggable)    │
│  ├── Signature field           │
│  ├── Date field                │
│  └── Checkbox field            │
└────────────────────────────────┘
```

**Coordinate system:** Editor uses top-left (0,0). PDF uses bottom-left (0,0).
Conversion on save: `pdf_y = page_height - element_y - element_height + 1`

---

## Backend

### Tech Stack
- **Python 3.12**
- **FastAPI** — async HTTP framework
- **uvicorn** — ASGI server (with `--reload` in dev)
- **httpx** — async HTTP client (ServiceTitan API calls)
- **pypdf** — PDF page reading and merging
- **reportlab** — overlay PDF generation (text, checkboxes, signatures)
- **Pillow** — signature image decoding and scaling
- **google-api-python-client** — Google Drive API (sync, wrapped in `asyncio.to_thread()`)
- **python-dotenv** — env var loading in dev
- **pytest + pytest-asyncio** — test runner

### ServiceTitanClient (`services/servicetitan.py`)

Central class instantiated as a module-level singleton via `get_st_client()`. All routers use it via FastAPI dependency injection (`Depends(get_st_client)`).

```python
# Key methods:
get_access_token()               # async — OAuth2 client credentials → cached Bearer token
get_auth_headers()               # returns { Authorization, ST-App-Key } dict
api_call(endpoint, method, ...)  # async — authenticated httpx request
raw_fetch(endpoint)              # async — returns raw bytes (PDF downloads)
normalize_phone(phone)           # strips non-digits
validate_phone_match(a, b)       # compares last 10 digits of each
build_tenant_url(service)        # "/{service}/v2/tenant/{tenant_id}"
get_date_range(days_back=3)      # returns (start, end) UTC datetime tuple
clean_job_title(title)           # strips HTML, collapses whitespace, caps at 200 chars
```

**Token caching:** Module-level `_token_cache` / `_token_expiry`. Buffer of **300 seconds** before expiry. Lost on server restart (acceptable — auto-refreshes).

**OAuth2 flow:**
```
POST https://auth.servicetitan.io/connect/token
Body: grant_type=client_credentials&client_id=...&client_secret=...
Response: { access_token, expires_in }
```

### Routers

Each file in `backend-py/routers/` is a FastAPI `APIRouter` included in `main.py`:

| File | Mount | Purpose |
|------|-------|---------|
| `auth.py` | `/api` | Technician login validation |
| `jobs.py` | `/api` | Jobs, job details, customer data |
| `attachments.py` | `/api` | PDF download, form save to ST |
| `drafts.py` | `/api` | Google Drive draft management |
| `backflow.py` | `/api` | TCEQ backflow testing (in-memory state) |

### Google Drive Service (`services/google_drive.py`)

Synchronous service class wrapping the Google Drive API v3. Instantiated as a module-level singleton via `get_drive_service()`. Because the client is sync, all FastAPI routes call it via `asyncio.to_thread()`.

**Authentication:** Service account JWT via `google-auth`. Reads credentials from `GOOGLE_CREDENTIALS_BASE64` (preferred) or individual env vars (CI/CD).

```python
# Credential loading order:
1. GOOGLE_CREDENTIALS_BASE64 → base64 decode → parse JSON → build Credentials
2. GOOGLE_DRIVE_PRIVATE_KEY + GOOGLE_DRIVE_CLIENT_EMAIL + ... (individual vars)
```

**Key methods:**
```python
save_pdf_as_draft(pdf_buffer, objects, job_id, file_name)
  → Creates job_id subfolder in Draft folder if needed
  → Fills PDF via pdf_service.generate_filled_pdf()
  → Uploads via MediaIoBaseUpload (no temp files)
  → Returns { file_id, file_name, drive_url }

promote_to_completed(file_id, job_id)
  → Moves file from Draft → Completed folder (addParents/removeParents)

download_file(file_id)
  → Returns raw PDF bytes via MediaIoBaseDownload

update_file(file_id, pdf_buffer, file_name)
  → Replaces existing file content

get_files_by_job_id(job_id)
  → Queries both Draft and Completed folders
  → Returns { drafts: [...], completed: [...] }

get_file_metadata(file_id)
  → Returns metadata dict (name, size, mimeType, etc.)
```

**Required Google Drive flags:** ALL Drive API calls must include `supportsAllDrives=True` and `includeItemsFromAllDrives=True` — the folders are shared drives, not personal Drive. Without these flags, the API returns 404.

### PDF Service (`services/pdf_service.py`)

Replaces the Node.js `pdf-lib` usage. Strategy: **reportlab overlay merged with pypdf**.

```python
def generate_filled_pdf(original_pdf_bytes: bytes, objects: list[dict]) -> bytes:
    reader = PdfReader(io.BytesIO(original_pdf_bytes))
    writer = PdfWriter()

    for page_num, page in enumerate(reader.pages, start=1):
        page_elements = [o for o in objects if o.get("page", 1) == page_num]
        if page_elements:
            overlay = _build_overlay(page_elements, page_height, page_width)
            page.merge_page(PdfReader(overlay).pages[0])
        writer.add_page(page)

    return output.getvalue()
```

**Coordinate conversion** (same formula as frontend → backend in Node):
`pdf_y = page_height - element_y - element_height + 1`

**Element types supported:**
- `text`, `date`, `timestamp` — `canvas.drawString()` with hex color
- `signature` — base64 PNG decoded via PIL → drawn via reportlab `ImageReader`
- `checkbox` — draws `X` if `content` is truthy

---

## Authentication Flow

```
Browser                    Backend                    ServiceTitan
   │                          │                            │
   │  POST /api/technician    │                            │
   │  /validate               │                            │
   │  { username, phone }     │                            │
   │─────────────────────────►│                            │
   │                          │  GET /access_token         │
   │                          │──────────────────────────►│
   │                          │◄──────────────────────────│
   │                          │  { access_token }          │
   │                          │                            │
   │                          │  GET /technicians          │
   │                          │  (paginated, up to 2000)   │
   │                          │──────────────────────────►│
   │                          │◄──────────────────────────│
   │                          │  { data: [technicians] }   │
   │                          │                            │
   │                          │  Match username (case-ins) │
   │                          │  Match phone (last 10 dig) │
   │                          │                            │
   │◄─────────────────────────│                            │
   │  { success, technician,  │                            │
   │    company, environment }│                            │
   │                          │                            │
   │  Save to sessionStorage  │                            │
   │  (8-hour timeout)        │                            │
```

---

## PDF Workflow

### Opening a Form
```
1. GET /api/job/:jobId/attachments
   → Fetches from ST Forms API: GET /forms/v2/tenant/:id/jobs/:jobId/files
   → Returns list of PDF attachments with metadata

2. GET /api/job/:jobId/attachment/:attachmentId/download
   → Fetches binary PDF from ServiceTitan via httpx
   → Streams ArrayBuffer to browser

3. Browser renders PDF via pdfjs-dist
   → Creates canvas element per page
   → Overlay div for editable elements
```

### Saving a Draft
```
1. User clicks "Save Draft"
2. Frontend collects form elements (position, content, type)
3. POST /api/drafts/save { jobId, attachmentId, objects, fileName }
4. Backend:
   a. Downloads original PDF from ServiceTitan (raw_fetch)
   b. pdf_service.generate_filled_pdf():
      - reportlab builds overlay PDF per page (text, signatures, checkboxes)
      - pypdf merges overlay onto original pages
   c. GoogleDriveService.save_pdf_as_draft():
      - Creates jobId subfolder if missing
      - Uploads via MediaIoBaseUpload (no temp files)
5. Returns { fileId, driveUrl }
6. Frontend refreshes draft list
```

### Uploading a Completed Form
```
1. User clicks "Upload" on a draft
2. POST /api/drafts/:fileId/complete { jobId }
3. Backend:
   a. Moves file to Completed folder in Google Drive (addParents/removeParents)
   b. Downloads draft PDF from Google Drive (MediaIoBaseDownload)
   c. Uploads PDF to ServiceTitan:
      → POST /forms/v2/tenant/:id/jobs/:jobId/files
      → httpx multipart (files= parameter)
4. Returns { success, serviceTitanFileId }
```

---

## Data Structures

### Session (sessionStorage)
```json
{
  "technician": {
    "id": 12345,
    "userId": 67890,
    "name": "John Smith",
    "username": "john.smith",
    "phoneNumber": "5551234567",
    "email": "john@example.com",
    "active": true,
    "businessUnitId": 111,
    "bpatLicenseNumber": "TX-12345",
    "licenseExpirationDate": "2027-01-01",
    "gauges": []
  },
  "company": { "name": "Mr. Backflow TX", "tenantId": "3495827745" },
  "environment": "Production",
  "loginTime": 1740528000000,
  "userType": "technician"
}
```

### Job (from backend)
```json
{
  "id": 99001,
  "number": "123456",
  "title": "Annual Backflow Test",
  "status": "Dispatched",
  "priority": 1,
  "customer": {
    "id": 55001,
    "name": "Acme Corp",
    "address": { "street": "123 Main St", "city": "Austin", "state": "TX", "zip": "78701", "fullAddress": "..." }
  },
  "location": { "id": 44001, "name": "Main Office", "address": {} },
  "nextAppointment": { "id": 77001, "start": "2026-02-26T09:00:00Z", "end": "2026-02-26T11:00:00Z", "status": "Dispatched" },
  "businessUnitId": 111,
  "jobTypeId": 22,
  "createdOn": "2026-02-25T00:00:00Z"
}
```

### PDF Form Element
```json
{
  "id": "elem-001",
  "type": "text",
  "x": 100,
  "y": 200,
  "width": 200,
  "height": 30,
  "page": 1,
  "content": "John Smith",
  "fontSize": 11,
  "color": "#1e3a8a"
}
```

Element types: `text`, `signature`, `date`, `timestamp`, `checkbox`

---

## Deployment

### Infrastructure
- **Docker** — multi-stage: Node 24 builder (Vite) → Python 3.12-slim runtime
- **Azure Container Apps** — serverless container hosting
- **GitHub Container Registry** — Docker image storage
- **GitHub Actions** — CI/CD pipeline

### Environments

| | Production | Staging |
|--|-----------|---------|
| Branch | `main` | `dev` |
| Container App | `pdftitan-app` | `pdftitan-app-dev` |
| Image tag | `latest` | `dev-latest` |
| Registry | `ghcr.io/okekedev/pdftitan:latest` | `ghcr.io/okekedev/pdftitan:dev-latest` |

### Build Process
```
1. Push to main/dev
2. GitHub Actions: docker build --platform linux/amd64 .
   - Stage 1: Node 24-alpine → npm ci → vite build → build/
   - Stage 2: Python 3.12-slim → pip install → copy backend-py/ + build/
3. Push image to ghcr.io
4. az containerapp update --image ...
5. Health check: curl /health
```

### Azure Resources
- Resource group: `pdftitan-rg`
- Azure subscription ID: `cfcbaf7b-b9ac-4233-bc3d-37e94a074d92`
- Azure tenant: `79865dd8-488a-4a93-9f12-1f3e78c520e8`
- Azure client (OIDC): `a419abdb-be9e-499c-80ca-2b08a6f51ba0`

### Health Check
```
GET /health
→ { status: "healthy", runtime: "Python/FastAPI/uvicorn", mode, environment, version, serviceIntegration }
```

---

## Caching

| Data | Location | TTL |
|------|----------|-----|
| ST OAuth token | Memory (server, `_token_cache`) | `expires_in - 300s` buffer |
| Technicians list | Memory (server, `_technicians_cache`) | 30 min |
| Customer data | Memory (server, `_customers_cache`) | 60 min |
| Technician session | sessionStorage | 8 hours |
| Theme preference | localStorage | Indefinite |

All in-memory caches are lost on server restart and auto-rebuild on the next request.

---

## Security

- No passwords stored anywhere
- ServiceTitan credentials only in env vars / GitHub Secrets
- Google service account key only in env vars / GitHub Secrets
- Sessions in sessionStorage (not localStorage — cleared on tab close)
- CORS restricted to React dev server in development only (`localhost:3000-3004`)
- Google Drive: all uploads use `MediaIoBaseUpload` (no temp files written to disk)
- Private key committed to repo was immediately rotated (lesson learned Feb 2026)
