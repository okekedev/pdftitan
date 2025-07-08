# Streamlined TitanPDF Dockerfile
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

# Install backend dependencies
COPY backend/package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy backend code and built frontend
COPY backend/ ./
COPY --from=builder /app/build ./build

# Expose port and start
EXPOSE 3004
CMD ["node", "server.js"]