# TitanPDF Dockerfile - Fixed npm commands
FROM node:18-alpine AS builder

# Build React frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src/ ./src/
COPY public/ ./public/
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy backend package files first
COPY backend/package*.json ./

# Install all dependencies first (including dev for potential build steps)
RUN npm ci

# Copy backend source code
COPY backend/ ./

# Copy built frontend from builder stage
COPY --from=builder /app/build ./build

# Now remove dev dependencies to reduce image size
RUN npm ci --only=production && npm cache clean --force

# Expose port and start
EXPOSE 3000
CMD ["node", "server.js"]