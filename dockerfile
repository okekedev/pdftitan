# ── Stage 1: Build Vite frontend ──────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json vite.config.ts tsconfig.json index.html ./
RUN npm ci

COPY src/ ./src/
# public/ is optional (may not exist)
COPY public* ./public/

RUN npm run build

# ── Stage 2: Python/FastAPI API server ────────────────────────────────────────
FROM python:3.12-slim
WORKDIR /app

# Install Python dependencies
COPY backend-py/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy Python backend source
COPY backend-py/ ./

# Copy built frontend from Stage 1 (served as static files in production)
COPY --from=builder /app/build ../build

EXPOSE 3000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3000"]
