# TitanPDF — Claude Code Guide

## What This Is

A PDF form editor for ServiceTitan field technicians (Mr. Backflow TX). Technicians log in with their ServiceTitan username + phone number, see their assigned jobs, pull up PDF forms attached to those jobs, fill them out in-browser, capture signatures, save drafts to Google Drive, and upload completed forms back to ServiceTitan. There is also a TCEQ backflow testing module for backflow prevention assembly tests.

**Customer:** Mr. Backflow TX (ServiceTitan tenant 3495827745)
**Users:** Field technicians in the field on tablets/desktops

---

## Quick Commands

```bash
# Start everything
npm run dev                  # Frontend (:3003) + Backend (:3004) via concurrently

# Start separately
npm start                    # Frontend only (:3003) — Vite dev server
npm run backend:start        # Backend only (:3004) — uvicorn (no reload)
npm run backend              # Backend only (:3004) — uvicorn --reload (dev)

# Type check
npx tsc --noEmit             # TypeScript check (Vite ignores type errors at runtime)

# Tests
npm run test:auth            # Auth + env validation pytest tests
npm run test:backend         # All pytest tests in backend-py/

# Build
npm run build                # tsc -b && vite build (TypeScript check + production bundle)

# Python deps (first time or to update to latest)
cd backend-py && python3 -m venv .venv && .venv/bin/pip install -r requirements.in && .venv/bin/pip freeze > requirements.txt
# Python deps (reproducible install from frozen lockfile)
cd backend-py && .venv/bin/pip install -r requirements.txt
```

---

## Architecture at a Glance

```
src/                         # React + TypeScript frontend (Vite, port 3003)
├── main.tsx                 # Vite entry point
├── App.tsx                  # Root — theme, header, routing, session
├── types/index.ts           # Shared TypeScript interfaces
├── components/Header/       # Single app-level header (theme toggle, nav, user)
├── pages/
│   ├── Login/               # Username + phone validation
│   ├── Jobs/                # Date-grouped job list
│   ├── Attachments/         # PDF list + drafts + completed forms
│   ├── PDFEditor/           # Interactive canvas-based form editor
│   ├── BackflowTesting/     # TCEQ backflow test module
│   └── Documentation/       # Help docs
└── services/
    ├── apiClient.ts         # HTTP client — all backend calls
    └── sessionManager.ts    # sessionStorage wrapper, 8-hour timeout

backend-py/                  # FastAPI server (port 3004) — production backend
├── main.py                  # FastAPI app setup + CORS + static files
├── requirements.txt         # Python dependencies
├── pytest.ini               # asyncio_mode = auto
├── routers/
│   ├── auth.py              # POST /api/technician/validate
│   ├── jobs.py              # GET /api/technician/:id/jobs, /api/job/:id
│   ├── attachments.py       # GET/POST /api/job/:id/attachment/*
│   ├── drafts.py            # GET/POST/PUT /api/drafts/*
│   └── backflow.py          # TCEQ backflow testing endpoints
├── services/
│   ├── servicetitan.py      # ServiceTitanClient + OAuth2 token cache
│   ├── google_drive.py      # GoogleDriveService (sync, wrapped in asyncio.to_thread)
│   ├── pdf_service.py       # reportlab overlay + pypdf merge
│   └── excel_parser.py      # TCEQ city/PWS data from Excel templates
└── tests/
    ├── test_env.py          # Offline env var validation
    ├── test_servicetitan.py # Live ST API tests
    ├── test_google_drive.py # Live Drive API tests
    ├── test_auth_routes.py  # Unit tests with mocked ST client
    └── test_pdf.py          # PDF generation unit tests

```

---

## Key Files

| What | Where |
|------|-------|
| App root + theme + routing | `src/App.tsx` |
| Shared TypeScript types | `src/types/index.ts` |
| Header (single, app-level) | `src/components/Header/Header.tsx` |
| API client (all HTTP calls) | `src/services/apiClient.ts` |
| Session management (localStorage, 12h rolling) | `src/services/sessionManager.ts` |
| Vite config + dev proxy | `vite.config.ts` |
| TypeScript config | `tsconfig.json` |
| FastAPI app setup | `backend-py/main.py` |
| ServiceTitan client | `backend-py/services/servicetitan.py` |
| ServiceTitan auth route | `backend-py/routers/auth.py` |
| Jobs API | `backend-py/routers/jobs.py` |
| PDF download/upload | `backend-py/routers/attachments.py` |
| Google Drive drafts | `backend-py/routers/drafts.py` |
| Google Drive service | `backend-py/services/google_drive.py` |
| PDF generation (overlay) | `backend-py/services/pdf_service.py` |
| Python dependencies | `backend-py/requirements.txt` |
| CI/CD pipeline | `.github/workflows/azuredeploy.yml` |
| Backend tests | `backend-py/tests/` |

---

## Environment Variables

```bash
# ServiceTitan (production tenant) — backend only, not exposed to frontend
REACT_APP_SERVICETITAN_CLIENT_ID=cid.b3l9k62sglmlkfxl1zfdaox3p
REACT_APP_SERVICETITAN_CLIENT_SECRET=cs2.i4vj2d2zjpdkgnwujb5jo4rq6zhp3g8g9hd7zil7a27vewm49h
REACT_APP_SERVICETITAN_TENANT_ID=3495827745
REACT_APP_SERVICETITAN_APP_KEY=ak1.wyq4yv9rdudj7c4d9yx601jqa
REACT_APP_SERVICETITAN_API_BASE_URL=https://api.servicetitan.io
REACT_APP_SERVICETITAN_AUTH_URL=https://auth.servicetitan.io

# Google Drive (service account: mr-backflow-worker@pdf-titan.iam.gserviceaccount.com)
GOOGLE_CREDENTIALS_BASE64=<base64-encoded full service account JSON>
GOOGLE_DRIVE_DRAFT_FOLDER_ID=1GNrVdoGnWNHC6_QmvNkZEIUroNwg-q29
GOOGLE_DRIVE_COMPLETED_FOLDER_ID=1tTsOoGiBJPvJucrpjIQvVvXJSIP8SVbJ
```

---

## Deployments

| Branch | Container App | Image Tag | Environment |
|--------|--------------|-----------|-------------|
| `main` | `pdftitan-app` | `latest` | Production |
| `dev` | `pdftitan-app-dev` | `dev-latest` | Staging |

- Registry: `ghcr.io/okekedev/pdftitan`
- Resource group: `pdftitan-rg`
- Push to branch → GitHub Actions builds Docker image → deploys to Azure Container App

---

## Data Flow (Happy Path)

```
1. Login        → POST /api/technician/validate → ServiceTitan API → session saved
2. Jobs list    → GET /api/technician/:id/jobs  → ServiceTitan API → grouped by date
3. Select job   → GET /api/job/:id/attachments  → ServiceTitan Forms API → PDF list
4. Open PDF     → GET /api/job/:id/attachment/:id/download → ST → PDF bytes → pdfjs renders
5. Edit + save  → POST /api/drafts/save → reportlab/pypdf generates → Google Drive draft folder
6. Upload       → POST /api/drafts/:id/complete → GD → download → upload to ServiceTitan
```

---

## Known Gotchas

| Gotcha | Detail |
|--------|--------|
| Google Drive is sync | `google-api-python-client` is synchronous. Routes call Drive methods via `asyncio.to_thread()`. |
| `supportsAllDrives=True` | Required on ALL Google Drive API calls — folders are shared drives |
| Coordinate mismatch | Frontend: top-left origin. PDF: bottom-left. Formula: `pdf_y = page_height - element_y - element_height + 1` |
| Header is app-level | Header lives in `App.tsx`, not in page components. Don't add it to pages. |
| Theme via `[data-theme]` | Dark mode driven by `data-theme="dark"` on `<html>`. Not a media query. Toggled via Header button, persisted to localStorage. |
| Service account key | Active key ID: `b5242f38...` (generated Feb 2026). Old key `d522b15b...` was disabled after being committed to repo. |
| Google Drive folder structure | `DRAFT_FOLDER/{jobId}/file.pdf` — job ID subfolders created automatically |
| ST token cached in memory | 300-second buffer before expiry in `ServiceTitanClient`. Token lost on server restart. |
| No database | Google Drive is the only persistent storage. No SQL, no Redis. |
| Session in localStorage | Survives browser close. 12-hour rolling timeout (resets on each page load). Key: `titanpdf_technician_session` |
| TypeScript in frontend | Strict mode. Use `any` pragmatically for complex API shapes. `PDFEditor.tsx` uses `// @ts-nocheck`. |
| Vite env vars | Frontend does NOT read `REACT_APP_*` vars — those are backend-only. Frontend uses `import.meta.env.DEV` only. |
| PDF generation stack | reportlab overlay merged into source PDF via pypdf. No pdf-lib. |
| Both credential methods | Dev: `GOOGLE_CREDENTIALS_BASE64`. CI/CD: individual `GOOGLE_DRIVE_*` secrets. Both supported in `google_drive.py`. |

---

## Deeper Docs

- `docs/VISION.md` — Product purpose, features, roadmap
- `docs/ARCHITECTURE.md` — Full technical deep-dive
- `docs/RUNBOOK.md` — Deployment, debugging, operations
- `docs/API.md` — All backend endpoints with request/response shapes
