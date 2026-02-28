"""
TitanPDF FastAPI application — replaces the Node/Express backend.

Dev:  uvicorn main:app --reload --port 3004
Prod: uvicorn main:app --host 0.0.0.0 --port 3000
"""
import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Load .env relative to this file (dev only; prod uses injected env vars)
load_dotenv(Path(__file__).parent.parent / ".env")

from routers import attachments, auth, backflow, drafts, jobs

app = FastAPI(
    title="TitanPDF API",
    version="2.0.0",
    description="PDF form editor backend for ServiceTitan field technicians",
)

# ── CORS (dev only) ───────────────────────────────────────────────────────────

is_dev = os.getenv("NODE_ENV", "development") != "production"

if is_dev:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3002",
            "http://localhost:3003",
            "http://localhost:3004",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(attachments.router)
app.include_router(drafts.router)
app.include_router(backflow.router)

# ── Health check ──────────────────────────────────────────────────────────────


@app.get("/health")
async def health():
    from services.servicetitan import get_st_client

    st = get_st_client()
    configured = all(
        [
            st.tenant_id,
            st.app_key,
            st.client_id,
            st.client_secret,
        ]
    )
    return {
        "status": "healthy",
        "message": "TitanPDF Backend API (Python/FastAPI)",
        "mode": "development" if is_dev else "production",
        "environment": os.getenv("NODE_ENV", "development"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "2.0.0",
        "runtime": "Python/FastAPI/uvicorn",
        "serviceIntegration": {
            "configured": configured,
            "apiBaseUrl": st.api_base_url,
            "authBaseUrl": st.auth_base_url,
            "environment": (
                "Integration"
                if "integration" in (st.api_base_url or "")
                else "Production"
            ),
        },
    }


# ── Static files (production SPA) ─────────────────────────────────────────────
# Mount AFTER all API routes so API routes take priority.

if not is_dev:
    static_dir = Path(__file__).parent.parent / "build"
    if static_dir.exists():
        app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
