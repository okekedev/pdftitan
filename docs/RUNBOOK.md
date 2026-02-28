# TitanPDF — Engineering Runbook

## Local Development Setup

### First Time

```bash
# 1. Clone the repo
git clone https://github.com/okekedev/pdftitan.git
cd pdftitan

# 2. Install frontend dependencies
npm install

# 3. Set up Python backend virtualenv and install dependencies
cd backend-py && python3 -m venv .venv && .venv/bin/pip install -r requirements.in && .venv/bin/pip freeze > requirements.txt && cd ..

# 4. Create .env file at project root (see Environment Variables section below)
touch .env

# 5. Start dev servers
npm run dev
```

Frontend: http://localhost:3003
Backend: http://localhost:3004
Health: http://localhost:3004/health

### Environment Variables (.env at project root)

```bash
# ServiceTitan — Production tenant
REACT_APP_SERVICETITAN_CLIENT_ID=cid.b3l9k62sglmlkfxl1zfdaox3p
REACT_APP_SERVICETITAN_CLIENT_SECRET=cs2.i4vj2d2zjpdkgnwujb5jo4rq6zhp3g8g9hd7zil7a27vewm49h
REACT_APP_SERVICETITAN_TENANT_ID=3495827745
REACT_APP_SERVICETITAN_APP_KEY=ak1.wyq4yv9rdudj7c4d9yx601jqa
REACT_APP_SERVICETITAN_API_BASE_URL=https://api.servicetitan.io
REACT_APP_SERVICETITAN_AUTH_URL=https://auth.servicetitan.io

# Google Drive — Service account: mr-backflow-worker@pdf-titan.iam.gserviceaccount.com
# Get the base64 value from: gcloud iam service-accounts keys create key.json ... && cat key.json | base64
GOOGLE_CREDENTIALS_BASE64=<base64-encoded-service-account-json>
GOOGLE_DRIVE_DRAFT_FOLDER_ID=1GNrVdoGnWNHC6_QmvNkZEIUroNwg-q29
GOOGLE_DRIVE_COMPLETED_FOLDER_ID=1tTsOoGiBJPvJucrpjIQvVvXJSIP8SVbJ

# Azure (optional for local — only needed for CLI deploys)
AZURE_CLIENT_ID=a419abdb-be9e-499c-80ca-2b08a6f51ba0
AZURE_TENANT_ID=79865dd8-488a-4a93-9f12-1f3e78c520e8
AZURE_SUBSCRIPTION_ID=cfcbaf7b-b9ac-4233-bc3d-37e94a074d92

# GitHub Container Registry token (optional for local)
GHCR_TOKEN=ghp_...
```

The Python backend loads `.env` from the project root via:
```python
load_dotenv(Path(__file__).parent.parent / ".env")
```

### Validate Environment

```bash
npm run test:auth    # pytest: env vars, ST auth, Google Drive access
```

All tests should pass before deploying.

---

## Branching & Deployment

### Branch Strategy

```
main  ──────────────────────────────────►  production (pdftitan-app)
  │
  └── dev  ───────────────────────────────►  staging (pdftitan-app-dev)
```

- **Never push directly to `main`** — merge from `dev` when staging is verified
- All development work goes on `dev` (or feature branches merged to `dev`)
- CI/CD triggers automatically on push to either branch

### Deploy to Staging

```bash
git checkout dev
git add .
git commit -m "your change"
git push origin dev
# → GitHub Actions builds and deploys to pdftitan-app-dev automatically
```

### Deploy to Production

```bash
git checkout main
git merge dev
git push origin main
# → GitHub Actions builds and deploys to pdftitan-app automatically
```

### Check Deployment Status

```bash
gh run list --repo okekedev/pdftitan --branch main --limit 5
gh run watch <run-id>                    # Watch a specific run
```

### Manual Deploy (emergency)

```bash
# Trigger workflow manually
gh workflow run azuredeploy.yml --ref main
```

---

## GitHub Secrets

These must be set in the GitHub repo under Settings → Secrets → Actions:

| Secret | Value |
|--------|-------|
| `REACT_APP_SERVICETITAN_CLIENT_ID` | ServiceTitan OAuth client ID |
| `REACT_APP_SERVICETITAN_CLIENT_SECRET` | ServiceTitan OAuth secret |
| `REACT_APP_SERVICETITAN_TENANT_ID` | 3495827745 |
| `REACT_APP_SERVICETITAN_APP_KEY` | ServiceTitan app key |
| `REACT_APP_SERVICETITAN_API_BASE_URL` | https://api.servicetitan.io |
| `REACT_APP_SERVICETITAN_AUTH_URL` | https://auth.servicetitan.io |
| `GOOGLE_CREDENTIALS_BASE64` | Base64-encoded service account JSON |
| `GOOGLE_DRIVE_DRAFT_FOLDER_ID` | Google Drive draft folder ID |
| `GOOGLE_DRIVE_COMPLETED_FOLDER_ID` | Google Drive completed folder ID |
| `GHCR_TOKEN` | GitHub token with `packages:write` scope |
| `AZURE_CLIENT_ID` | Azure app registration client ID |
| `AZURE_TENANT_ID` | Azure tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |

Update a secret:
```bash
gh secret set SECRET_NAME --body "value" --repo okekedev/pdftitan
```

---

## Google Drive Service Account

### Service Account Details
- **Email:** `mr-backflow-worker@pdf-titan.iam.gserviceaccount.com`
- **Project:** `pdf-titan`
- **GCP console:** console.cloud.google.com → project pdf-titan → IAM → Service Accounts

### Drive Folder Permissions
The service account must have **Editor** access to both folders:
- Draft folder: `1GNrVdoGnWNHC6_QmvNkZEIUroNwg-q29`
- Completed folder: `1tTsOoGiBJPvJucrpjIQvVvXJSIP8SVbJ`

To verify: Open Google Drive → right-click folder → Share → confirm `mr-backflow-worker@pdf-titan.iam.gserviceaccount.com` has Editor access.

### Rotate the Service Account Key

If the key is compromised or needs rotation:

```bash
# 1. Authenticate with GCP
gcloud auth login christian@mrbackflowtx.com
gcloud config set project pdf-titan

# 2. List existing keys
gcloud iam service-accounts keys list \
  --iam-account=mr-backflow-worker@pdf-titan.iam.gserviceaccount.com

# 3. Create new key
gcloud iam service-accounts keys create new-key.json \
  --iam-account=mr-backflow-worker@pdf-titan.iam.gserviceaccount.com

# 4. Encode as base64
cat new-key.json | base64 | tr -d '\n'

# 5. Update GitHub secret
gh secret set GOOGLE_CREDENTIALS_BASE64 --body "$(cat new-key.json | base64 | tr -d '\n')" --repo okekedev/pdftitan

# 6. Update local .env
# Paste new base64 value into GOOGLE_CREDENTIALS_BASE64

# 7. Delete old key (get key ID from step 2)
gcloud iam service-accounts keys delete KEY_ID \
  --iam-account=mr-backflow-worker@pdf-titan.iam.gserviceaccount.com

# 8. Clean up
rm new-key.json

# 9. Verify
npm run test:auth
```

**CRITICAL:** Never commit the key JSON file to git. It triggers Google's secret scanner and auto-disables the key.

---

## Common Issues & Fixes

### Frontend won't start — `vite: command not found`

Vite not installed. Run from project root:

```bash
npm install
npm start    # starts Vite on :3003
```

### Frontend TypeScript errors on start

Vite dev server ignores type errors (builds anyway). To check types:

```bash
npx tsc --noEmit
```

Fix any errors before deploying (CI runs the full `tsc -b && vite build`).

### Frontend won't start — `EADDRINUSE: address already in use :::3003`

Something already on port 3003.

```bash
lsof -ti :3003 | xargs kill
```

---

### Backend won't start — `ModuleNotFoundError`

Python dependencies not installed. The venv lives at `backend-py/.venv`:

```bash
cd backend-py
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

All `npm run backend*` scripts use `.venv/bin/uvicorn` automatically.

### Backend won't start — `EADDRINUSE: address already in use :::3004`

Something already on port 3004.

```bash
lsof -ti :3004 | xargs kill
```

### Backend won't start — `.env` not found

The Python backend loads `.env` from the project root. Make sure the file exists at `/path/to/pdftitan/.env` (not inside `backend-py/`).

```bash
# Verify .env exists at project root
ls -la .env

# Start backend from project root
npm run backend
# or directly:
cd backend-py && uvicorn main:app --reload --port 3004
```

### Google Drive returns `File not found` (404)

Missing `supportsAllDrives=True` on the Drive API call. Every Drive API call must include `supportsAllDrives=True` and `includeItemsFromAllDrives=True`. The folders are shared drives.

### Google Drive returns `invalid_grant`

The service account key is invalid or expired. Rotate the key (see above).

### ServiceTitan auth fails — technician not found

- Username is case-insensitive but must match `loginName` field exactly (no spaces)
- Check backend logs: it logs available usernames when no match found
- Phone match uses last 10 digits only — leading 1s, country codes, and formatting stripped

### ServiceTitan returns 401

OAuth token expired and failed to refresh. Restart the backend — it will fetch a new token on the next request.

### ServiceTitan returns 403

App key missing or wrong. Verify `REACT_APP_SERVICETITAN_APP_KEY` is set and correct.

### PDF won't open / blank page

1. Check the attachment is actually a PDF (not an image or other file type)
2. Check the ServiceTitan attachment download endpoint returns `Content-Type: application/pdf`
3. Verify pdfjs worker is served correctly

### Signatures not appearing in saved PDF

Signature must be a base64-encoded PNG data URL (`data:image/png;base64,...`). The PDF editor captures this from the canvas. If blank, check the canvas capture code in `PDFEditor.tsx`.

### Jobs not showing up

- Jobs query looks back 3 days and forward 1 day
- Technician must have active appointments in that window in ServiceTitan
- Check job statuses — only certain statuses are returned (not Completed by default)

---

## Monitoring & Logs

### Check Production Logs

```bash
# View recent logs from production container
az containerapp logs show \
  --name pdftitan-app \
  --resource-group pdftitan-rg \
  --follow

# View staging logs
az containerapp logs show \
  --name pdftitan-app-dev \
  --resource-group pdftitan-rg \
  --follow
```

### Health Check

```bash
curl https://your-container-app-url/health
# Returns: { status: "healthy", runtime: "Python/FastAPI/uvicorn", ... }
```

### Check if Backend Started Successfully

On startup, uvicorn logs:
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:3000 (Press CTRL+C to quit)
```

If the app crashes on startup, check for:
- Missing env vars (FastAPI/Pydantic will raise on import if required vars missing)
- Python import errors (missing package — run `pip install -r requirements.txt`)

---

## Running Tests

```bash
# From project root:
npm run test:auth      # pytest: env + live ST + live Drive tests
npm run test:backend   # pytest: all tests in backend-py/tests/

# Directly:
cd backend-py && pytest -v
cd backend-py && pytest tests/test_env.py -v            # env vars only (offline)
cd backend-py && pytest tests/test_auth_routes.py -v   # unit tests (mocked)
```

### What the Tests Check

| File | Type | What it tests |
|------|------|---------------|
| `test_env.py` | Offline | All 9 required env vars present + format checks |
| `test_servicetitan.py` | Live | OAuth token retrieval + technicians/jobs API access |
| `test_google_drive.py` | Live | Service account auth + folder access (Draft + Completed) |
| `test_auth_routes.py` | Unit | Route behaviors with mocked ST client (200/401/404/422) |
| `test_pdf.py` | Unit | PDF generation via reportlab/pypdf (no file system or API calls) |

All tests should pass before deploying.

---

## Docker

### Build Locally

```bash
docker build -t pdftitan:local .
docker run -p 3000:3000 --env-file .env pdftitan:local
```

### Dockerfile Notes

- **Stage 1:** Node 24-alpine — installs deps, runs `vite build`, outputs to `build/`
- **Stage 2:** Python 3.12-slim — installs pip deps, copies backend-py + built frontend
- Container serves: FastAPI API routes + React static files from `../build/`
- Port: 3000 in production (Azure maps external port → internal 3000)
- Startup: `uvicorn main:app --host 0.0.0.0 --port 3000`
- Static files: mounted at `/` after all API routes (production mode only)

---

## Adding a New API Endpoint

1. Add the route to the appropriate file in `backend-py/routers/`
2. Add the corresponding method to `src/services/apiClient.ts` in the frontend
3. Test locally: `curl http://localhost:3004/api/your-endpoint`
4. Add a test case in `backend-py/tests/` if it's an auth/integration endpoint
5. Update `docs/API.md` with the new endpoint

---

## Adding a New Page

1. Create `src/pages/YourPage/YourPage.tsx` and `YourPage.css`
2. Import in `App.tsx`
3. Add to the `currentPage` conditional rendering block
4. Add to `getBreadcrumbs()` in `App.tsx`
5. Add navigation trigger (e.g., button click that calls `setCurrentPage('your-page')`)
6. Do NOT add a `<Header>` inside the page — it renders at app level

---

## Updating the Google Drive Folder IDs

If folders are moved or recreated:

1. Get the new folder ID from the Drive URL: `drive.google.com/drive/folders/{FOLDER_ID}`
2. Update `.env`
3. Update GitHub Secrets
4. Update `CLAUDE.md` and `docs/RUNBOOK.md`
5. Run `npm run test:auth` to verify access
