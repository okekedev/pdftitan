# TitanPDF Dockerfile - Fixed to properly build React app
FROM node:16-alpine AS builder

# Build React frontend
WORKDIR /app

# Copy package files for frontend
COPY package*.json ./
RUN npm ci

# Copy frontend source code
COPY src/ ./src/
COPY public/ ./public/

# Build the React app (this creates the /build directory)
RUN npm run build

# Production stage
FROM node:16-alpine

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./

# Install backend dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy backend source code
COPY backend/ ./

# Copy built React app from builder stage to the expected location
COPY --from=builder /app/build ../build

# Expose port 3000 (matching your Azure config)
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]