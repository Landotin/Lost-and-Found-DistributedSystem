# ============================================================
# Stage 1: Build the Vite React frontend
# ============================================================
FROM node:22-alpine AS build-frontend
WORKDIR /app

# Install frontend dependencies
COPY package*.json ./
RUN npm ci

# Copy and build the frontend
COPY . .
RUN npm run build
# Output goes to /app/dist/

# ============================================================
# Stage 2: Set up the Express server with the built frontend
# ============================================================
FROM node:22-alpine
WORKDIR /app/server

# Install server dependencies
COPY server/package*.json ./
RUN npm ci

# Copy server source code
COPY server/ .

# Copy built frontend from Stage 1
# The server serves static files from /app/server/dist/
COPY --from=build-frontend /app/dist ./dist

EXPOSE 3000

CMD ["npx", "tsx", "src/index.ts"]
