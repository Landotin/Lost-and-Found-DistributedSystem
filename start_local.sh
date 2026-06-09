#!/usr/bin/env bash
# ==============================================================================
# RDLFT — Local Dev Server Runner (Non-Docker)
# ==============================================================================
# This script starts the Central Hub, Security Node, Engineering Node, and the
# Hub Admin Dashboard locally.
# It automatically builds the frontend assets and cleans up port conflicts.
#
# Usage:
#   chmod +x start_local.sh
#   ./start_local.sh
# ==============================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
ADMIN_SECRET="${ADMIN_SECRET:-e2e-test-secret}"
HUB_PORT=5000
SEC_PORT=3001
ENG_PORT=3002
DASHBOARD_PORT=5005
DATA_DIR="$(pwd)/data"

# Colored outputs
info()   { printf "\n\033[1;34m━━━ %s ━━━\033[0m\n" "$*"; }
success(){ printf "\033[1;32m✓ %s\033[0m\n" "$*"; }
error()  { printf "\033[1;31m✗ ERROR: %s\033[0m\n" "$*"; }

# ── Cleanup Handler ───────────────────────────────────────────────────────────
cleanup() {
  echo ""
  info "Cleaning up local servers..."
  
  # Kill all background processes spawned by this shell session
  jobs -p | xargs -r kill -9 2>/dev/null || true
  
  # Clean up ports just in case
  for port in "$HUB_PORT" "$SEC_PORT" "$ENG_PORT" "$DASHBOARD_PORT"; do
    lsof -ti":$port" 2>/dev/null | xargs -r kill -9 2>/dev/null || true
  done
  
  success "All servers stopped."
}
trap cleanup EXIT INT TERM

# ── Port conflict check ────────────────────────────────────────────────────────
info "Checking for port conflicts..."
for port in "$HUB_PORT" "$SEC_PORT" "$ENG_PORT" "$DASHBOARD_PORT"; do
  if lsof -i ":$port" -sTCP:LISTEN -t >/dev/null ; then
    echo "Port $port is currently in use. Cleaning it up..."
    lsof -ti":$port" | xargs -r kill -9 2>/dev/null || true
  fi
done
success "Ports are clear."

# ── Prepare Databases ──────────────────────────────────────────────────────────
info "Preparing data directory..."
mkdir -p "$DATA_DIR"
success "Data directory ready at $DATA_DIR"

# ── Dependency Checks ─────────────────────────────────────────────────────────
info "Installing dependencies (if missing)..."
for dir in server client client/server hub-dashboard; do
  if [ ! -d "$dir/node_modules" ]; then
    echo "Installing dependencies in $dir..."
    npm install --prefix "$dir"
  fi
done
success "Dependencies verified."

# ── Build Frontend Assets ──────────────────────────────────────────────────────
info "Building Department Node Frontend..."
npm run build --prefix client
success "Frontend built."

# ── Start Services ────────────────────────────────────────────────────────────
info "Starting Services..."

# 1. Central Hub
echo "Starting Central Hub on port $HUB_PORT..."
PORT="$HUB_PORT" \
ADMIN_SECRET="$ADMIN_SECRET" \
DB_PATH="$DATA_DIR/hub.db" \
  npx tsx server/src/index.ts > hub.log 2>&1 &
sleep 2

# 2. Security Node
echo "Starting Security Node on port $SEC_PORT..."
PORT="$SEC_PORT" \
DEPT_NAME="Security" \
DEPT_SECRET="$ADMIN_SECRET" \
SERVER_WS_URL="ws://localhost:$HUB_PORT" \
NODE_ENV=production \
DB_PATH="$DATA_DIR/security.db" \
  npx tsx client/server/src/index.ts > security.log 2>&1 &

# 3. Engineering Node
echo "Starting Engineering Node on port $ENG_PORT..."
PORT="$ENG_PORT" \
DEPT_NAME="Engineering" \
DEPT_SECRET="$ADMIN_SECRET" \
SERVER_WS_URL="ws://localhost:$HUB_PORT" \
NODE_ENV=production \
DB_PATH="$DATA_DIR/engineering.db" \
  npx tsx client/server/src/index.ts > engineering.log 2>&1 &

# 4. Hub Admin Dashboard
echo "Starting Hub Admin Dashboard on port $DASHBOARD_PORT..."
VITE_HUB_API_URL="http://localhost:$HUB_PORT" \
VITE_HUB_WS_URL="ws://localhost:$HUB_PORT" \
VITE_ADMIN_SECRET="$ADMIN_SECRET" \
  npm run dev --prefix hub-dashboard -- --port "$DASHBOARD_PORT" --host > dashboard.log 2>&1 &

sleep 3

# ── Console Dashboard ──────────────────────────────────────────────────────────
info "RDLFT Services are running!"
echo "--------------------------------------------------------"
echo "  Central Hub Server:       http://localhost:$HUB_PORT"
echo "  Security Node (Dept A):   http://localhost:$SEC_PORT"
echo "  Engineering Node (Dept B): http://localhost:$ENG_PORT"
echo "  Hub Admin Dashboard:      http://localhost:$DASHBOARD_PORT"
echo "--------------------------------------------------------"
echo "Logs are written to: hub.log, security.log, engineering.log, dashboard.log"
echo "Press [Ctrl+C] to stop all servers gracefully."
echo ""

# Keep script running to maintain background jobs
wait
