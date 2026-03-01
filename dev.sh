#!/usr/bin/env bash
# ============================================================================
# Sloppy — Local Development Launcher
# ============================================================================
# Starts the entire platform locally:
#   1. Docker (if not running)
#   2. PostgreSQL + Redis containers
#   3. Database migrations + seed data (first run only)
#   4. All 5 backend services
#   5. Frontend dev server
#
# Usage:
#   ./dev.sh          Start everything
#   ./dev.sh stop     Stop all services and containers
#   ./dev.sh reset    Nuke DB data and re-seed
#   ./dev.sh logs     Tail all service logs
#   ./dev.sh status   Show what's running
# ============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
PINK='\033[38;2;255;110;180m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

log()  { echo -e "${PINK}[sloppy]${NC} $1"; }
ok()   { echo -e "${GREEN}  ✓${NC} $1"; }
warn() { echo -e "${YELLOW}  ⚠${NC} $1"; }
err()  { echo -e "${RED}  ✗${NC} $1"; }
info() { echo -e "${CYAN}  →${NC} $1"; }

PIDS_FILE="$ROOT_DIR/.dev-pids"

# ── Env vars for local services ─────────────────────────────────────────────
export DATABASE_URL="postgresql://sloppy:sloppy_dev@localhost:5432/sloppy"
export REDIS_URL="redis://localhost:6379"
export CORS_ORIGIN="http://localhost:5173"
export AUTH_SERVICE_URL="http://localhost:3002"
export GAME_BUILDER_URL="http://localhost:3003"
export AI_ORCHESTRATOR_URL="http://localhost:3004"
export MULTIPLAYER_URL="http://localhost:3005"
export LOG_LEVEL="debug"
export VITE_API_URL="http://localhost:3001"

# Load .env if it exists (for API keys, Firebase config, etc.)
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi

# ── Helpers ─────────────────────────────────────────────────────────────────

check_dependency() {
  if ! command -v "$1" &>/dev/null; then
    err "$1 is required but not installed."
    exit 1
  fi
}

wait_for_port() {
  local port=$1 name=$2 timeout=${3:-30}
  local elapsed=0
  while ! nc -z localhost "$port" 2>/dev/null; do
    sleep 1
    elapsed=$((elapsed + 1))
    if [ $elapsed -ge $timeout ]; then
      err "$name did not start on port $port within ${timeout}s"
      return 1
    fi
  done
  ok "$name ready on port $port"
}

start_service() {
  local name=$1 port=$2 filter=$3
  local log_file="$ROOT_DIR/.dev-logs/${name}.log"

  PORT=$port pnpm --filter "$filter" dev > "$log_file" 2>&1 &
  local pid=$!
  echo "$name:$pid:$port" >> "$PIDS_FILE"

  wait_for_port "$port" "$name" 15 || {
    err "Failed to start $name — check .dev-logs/${name}.log"
    return 1
  }
}

kill_tracked_pids() {
  if [ -f "$PIDS_FILE" ]; then
    while IFS=: read -r name pid port; do
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null && ok "Stopped $name (pid $pid, port $port)"
      fi
    done < "$PIDS_FILE"
    rm -f "$PIDS_FILE"
  fi
}

# ── Commands ────────────────────────────────────────────────────────────────

cmd_stop() {
  log "Stopping Sloppy..."
  kill_tracked_pids
  docker compose stop postgres redis 2>/dev/null && ok "Stopped Postgres + Redis containers"
  log "All stopped."
}

cmd_reset() {
  log "Resetting database..."
  DATABASE_URL="$DATABASE_URL" pnpm --filter @sloppy/db db:migrate
  DATABASE_URL="$DATABASE_URL" pnpm --filter @sloppy/db db:seed
  ok "Database reset and re-seeded."
}

cmd_logs() {
  if [ ! -d "$ROOT_DIR/.dev-logs" ]; then
    err "No logs found — is the platform running?"
    exit 1
  fi
  tail -f "$ROOT_DIR/.dev-logs"/*.log
}

cmd_status() {
  log "Service status:"
  echo ""
  local services=("api-gateway:3001" "auth:3002" "game-builder:3003" "ai-orchestrator:3004" "multiplayer:3005" "frontend:5173")
  for entry in "${services[@]}"; do
    IFS=: read -r name port <<< "$entry"
    if nc -z localhost "$port" 2>/dev/null; then
      ok "$name — ${GREEN}running${NC} on port $port"
    else
      err "$name — ${RED}not running${NC} (port $port)"
    fi
  done

  echo ""
  for container in postgres redis; do
    if docker compose ps "$container" 2>/dev/null | grep -q "running"; then
      ok "$container — ${GREEN}running${NC} (Docker)"
    else
      err "$container — ${RED}not running${NC} (Docker)"
    fi
  done
}

cmd_start() {
  echo ""
  echo -e "${PINK}${BOLD}"
  echo "  ┌─────────────────────────────────┐"
  echo "  │         🎮  S L O P P Y         │"
  echo "  │    Local Development Launcher    │"
  echo "  └─────────────────────────────────┘"
  echo -e "${NC}"

  # ── Prerequisites ───────────────────────────────────────────────────────
  check_dependency docker
  check_dependency pnpm
  check_dependency node

  # ── Docker ──────────────────────────────────────────────────────────────
  log "Checking Docker..."
  if ! docker info &>/dev/null; then
    warn "Docker daemon is not running — starting Docker Desktop..."
    open -a Docker 2>/dev/null || true
    local docker_wait=0
    while ! docker info &>/dev/null; do
      sleep 2
      docker_wait=$((docker_wait + 2))
      if [ $docker_wait -ge 60 ]; then
        err "Docker did not start within 60 seconds. Please start it manually."
        exit 1
      fi
    done
  fi
  ok "Docker is running"

  # ── Clean up any previous run ───────────────────────────────────────────
  kill_tracked_pids
  mkdir -p "$ROOT_DIR/.dev-logs"

  # ── Postgres + Redis ────────────────────────────────────────────────────
  log "Starting Postgres + Redis..."
  docker compose up -d postgres redis 2>&1 | grep -v "^$" | while read -r line; do
    info "$line"
  done

  wait_for_port 5432 "PostgreSQL" 30
  wait_for_port 6379 "Redis" 15

  # ── Install dependencies if needed ──────────────────────────────────────
  if [ ! -d "$ROOT_DIR/node_modules" ]; then
    log "Installing dependencies..."
    pnpm install
    ok "Dependencies installed"
  fi

  # ── Build shared packages ───────────────────────────────────────────────
  log "Building shared packages..."
  pnpm --filter @sloppy/shared --filter @sloppy/runtime-sdk --filter @sloppy/multiplayer-sdk \
       --filter @sloppy/auth-middleware --filter @sloppy/logger --filter @sloppy/db \
       --filter @sloppy/ui build > "$ROOT_DIR/.dev-logs/build.log" 2>&1
  ok "Packages built"

  # ── Database migrations ─────────────────────────────────────────────────
  log "Running database migrations..."
  DATABASE_URL="$DATABASE_URL" pnpm --filter @sloppy/db db:migrate > "$ROOT_DIR/.dev-logs/migrate.log" 2>&1
  ok "Migrations complete"

  # Seed if the games table is empty
  local game_count
  game_count=$(docker compose exec -T postgres psql -U sloppy -d sloppy -tAc "SELECT count(*) FROM games" 2>/dev/null || echo "0")
  if [ "$game_count" = "0" ] || [ -z "$game_count" ]; then
    log "Seeding database with sample data..."
    DATABASE_URL="$DATABASE_URL" pnpm --filter @sloppy/db db:seed > "$ROOT_DIR/.dev-logs/seed.log" 2>&1
    ok "Database seeded"
  else
    ok "Database already has data ($game_count games)"
  fi

  # ── Start backend services ──────────────────────────────────────────────
  log "Starting backend services..."
  touch "$PIDS_FILE"

  start_service "api-gateway"     3001 "@sloppy/api-gateway"
  start_service "auth"            3002 "@sloppy/auth"
  start_service "game-builder"    3003 "@sloppy/game-builder"
  start_service "ai-orchestrator" 3004 "@sloppy/ai-orchestrator"
  start_service "multiplayer"     3005 "@sloppy/multiplayer"

  # ── Start frontend ──────────────────────────────────────────────────────
  log "Starting frontend..."
  VITE_API_URL="$VITE_API_URL" pnpm --filter @sloppy/web dev > "$ROOT_DIR/.dev-logs/frontend.log" 2>&1 &
  echo "frontend:$!:5173" >> "$PIDS_FILE"
  wait_for_port 5173 "Frontend (Vite)" 15

  # ── Done! ───────────────────────────────────────────────────────────────
  echo ""
  echo -e "${GREEN}${BOLD}  ┌─────────────────────────────────────────────┐${NC}"
  echo -e "${GREEN}${BOLD}  │         🎮  Sloppy is running!              │${NC}"
  echo -e "${GREEN}${BOLD}  └─────────────────────────────────────────────┘${NC}"
  echo ""
  echo -e "  ${BOLD}Frontend${NC}        ${CYAN}http://localhost:5173${NC}"
  echo -e "  ${BOLD}API Gateway${NC}     ${DIM}http://localhost:3001${NC}"
  echo -e "  ${BOLD}Auth${NC}            ${DIM}http://localhost:3002${NC}"
  echo -e "  ${BOLD}Game Builder${NC}    ${DIM}http://localhost:3003${NC}"
  echo -e "  ${BOLD}AI Orchestrator${NC} ${DIM}http://localhost:3004${NC}"
  echo -e "  ${BOLD}Multiplayer${NC}     ${DIM}http://localhost:3005${NC}"
  echo -e "  ${BOLD}PostgreSQL${NC}      ${DIM}localhost:5432${NC}"
  echo -e "  ${BOLD}Redis${NC}           ${DIM}localhost:6379${NC}"
  echo ""
  echo -e "  ${DIM}Logs:${NC}   ./dev.sh logs"
  echo -e "  ${DIM}Stop:${NC}   ./dev.sh stop"
  echo -e "  ${DIM}Status:${NC} ./dev.sh status"
  echo -e "  ${DIM}Reset DB:${NC} ./dev.sh reset"
  echo ""

  # Keep script alive so Ctrl+C can cleanly shut down everything
  trap 'echo ""; log "Shutting down..."; kill_tracked_pids; log "Bye! 👋"; exit 0' INT TERM

  # Wait for all child processes
  wait
}

# ── Entrypoint ──────────────────────────────────────────────────────────────

case "${1:-start}" in
  start)  cmd_start ;;
  stop)   cmd_stop ;;
  reset)  cmd_reset ;;
  logs)   cmd_logs ;;
  status) cmd_status ;;
  *)
    echo "Usage: ./dev.sh [start|stop|reset|logs|status]"
    exit 1
    ;;
esac
