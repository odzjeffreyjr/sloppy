#!/usr/bin/env bash
# ============================================================================
# Deploy a game to production (Cloud SQL + GCS)
#
# Usage:
#   ./scripts/deploy-game.sh scripts/games/neon-drift [--publish]
#
# Prerequisites:
#   - gcloud auth configured
#   - .env.production must have DB_PASSWORD set
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT}"

GAME_DIR="${1:?Usage: deploy-game.sh <game-directory> [--publish]}"
PUBLISH="${2:-}"
CREATOR_NAME="sloppy"

GCS_BUCKET="sloppy-game-bundles-prod"
CDN_BASE_URL="https://storage.googleapis.com/${GCS_BUCKET}"
DB_INSTANCE="sloppy-app:us-east1:sloppy-pg-prod"
PROXY_PORT=5433

# Load env
if [[ -f ".env.production" ]]; then
  set -a; source .env.production; set +a
fi

DB_PASSWORD="${DB_PASSWORD:?DB_PASSWORD not set in .env.production}"

# Validate game dir
if [[ ! -f "${GAME_DIR}/config.json" ]]; then
  echo "ERROR: Missing config.json in ${GAME_DIR}"
  exit 1
fi

if [[ ! -f "${GAME_DIR}/index.html" ]]; then
  echo "ERROR: Missing index.html in ${GAME_DIR}"
  exit 1
fi

TITLE=$(python3 -c "import json; print(json.load(open('${GAME_DIR}/config.json'))['title'])")
GENRE=$(python3 -c "import json; print(json.load(open('${GAME_DIR}/config.json')).get('genre',''))")
ENGINE=$(python3 -c "import json; print(json.load(open('${GAME_DIR}/config.json')).get('engine','canvas2d'))")
SUPPORTS_MP=$(python3 -c "import json; print(str(json.load(open('${GAME_DIR}/config.json')).get('supportsMultiplayer', False)).lower())")

GAME_ID=$(python3 -c "import secrets, string; print(''.join(secrets.choice(string.ascii_letters + string.digits + '_-') for _ in range(21)))")
SLUG=$(echo "${TITLE}" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//;s/-$//')-$(python3 -c "import secrets; print(secrets.token_hex(3))")
STATUS="draft"
if [[ "${PUBLISH}" == "--publish" ]]; then
  STATUS="published"
fi

echo ""
echo "  ┌──────────────────────────────────────────┐"
echo "  │       Sloppy — Game Deployer              │"
echo "  └──────────────────────────────────────────┘"
echo ""
echo "  Title:      ${TITLE}"
echo "  Genre:      ${GENRE}"
echo "  Engine:     ${ENGINE}"
echo "  Game ID:    ${GAME_ID}"
echo "  Slug:       ${SLUG}"
echo "  Status:     ${STATUS}"
echo "  Creator:    ${CREATOR_NAME}"
echo "  GCS:        ${GCS_BUCKET}"
echo ""

# Step 1: Start Cloud SQL proxy (if not already running)
echo "▶ Starting Cloud SQL Auth Proxy..."

PROXY_PID=""
if lsof -i ":${PROXY_PORT}" &>/dev/null; then
  echo "  ✔ Proxy already running on port ${PROXY_PORT}"
else
  cloud-sql-proxy "${DB_INSTANCE}" --port "${PROXY_PORT}" &
  PROXY_PID=$!
  sleep 3

  if ! kill -0 "${PROXY_PID}" 2>/dev/null; then
    echo "  ✖ Proxy failed to start"
    exit 1
  fi
  echo "  ✔ Proxy started (PID: ${PROXY_PID})"
fi

cleanup() {
  if [[ -n "${PROXY_PID}" ]]; then
    kill "${PROXY_PID}" 2>/dev/null || true
    echo "  ✔ Proxy stopped"
  fi
}
trap cleanup EXIT

export PGPASSWORD="${DB_PASSWORD}"
PG_HOST="localhost"
PG_PORT="${PROXY_PORT}"
PG_DB="sloppy"
PG_USER="sloppy"

# Use node to run SQL since psql might not be installed
run_sql() {
  local query="$1"
  node -e "
    const pg = require('pg');
    const client = new pg.Client({
      host: '${PG_HOST}',
      port: ${PG_PORT},
      database: '${PG_DB}',
      user: '${PG_USER}',
      password: process.env.PGPASSWORD,
    });
    (async () => {
      await client.connect();
      const res = await client.query(\`${query}\`);
      if (res.rows) console.log(JSON.stringify(res.rows));
      await client.end();
    })().catch(e => { console.error(e.message); process.exit(1); });
  "
}

# Step 2: Ensure creator user exists
echo "▶ Ensuring user '${CREATOR_NAME}' exists..."

FIREBASE_UID="system_${CREATOR_NAME}"
EMAIL="${CREATOR_NAME}@sloppygames.io"

USER_ID=$(run_sql "SELECT id FROM users WHERE firebase_uid = '${FIREBASE_UID}' LIMIT 1" 2>/dev/null | python3 -c "import json,sys; data=json.load(sys.stdin); print(data[0]['id'] if data else '')" 2>/dev/null || echo "")

if [[ -z "${USER_ID}" ]]; then
  USER_ID="${GAME_ID}_user"
  run_sql "INSERT INTO users (id, firebase_uid, email, display_name) VALUES ('${USER_ID}', '${FIREBASE_UID}', '${EMAIL}', '${CREATOR_NAME}')"
  echo "  ✔ User created: ${USER_ID}"
else
  echo "  ✔ User exists: ${USER_ID}"
fi

# Step 3: Create game record
echo "▶ Creating game record..."

run_sql "INSERT INTO games (id, creator_id, title, description, slug, genre, engine, supports_multiplayer, version, status, play_count, favourite_count) VALUES ('${GAME_ID}', '${USER_ID}', '${TITLE}', 'Dodge neon obstacles in this fast-paced arcade game. Survive as long as you can!', '${SLUG}', '${GENRE}', '${ENGINE}', ${SUPPORTS_MP}, 1, '${STATUS}', 0, 0)"
echo "  ✔ Game record created"

# Step 4: Upload files to GCS
echo "▶ Uploading files to GCS..."

BASE_PATH="games/${GAME_ID}/v1"

# Extract inline JS for game.js
python3 -c "
import re, sys
html = open('${GAME_DIR}/index.html').read()
scripts = re.findall(r'<script(?:\s[^>]*)?>([\\s\\S]*?)</script>', html)
scripts = [s for s in scripts if s.strip()]
print('\\n'.join(scripts))
" > /tmp/sloppy_game_js_tmp.js

gsutil -q cp "${GAME_DIR}/index.html" "gs://${GCS_BUCKET}/${BASE_PATH}/index.html"
gsutil -q setmeta -h "Content-Type:text/html" -h "Cache-Control:public, max-age=31536000, immutable" "gs://${GCS_BUCKET}/${BASE_PATH}/index.html"
echo "  ✔ Uploaded: index.html"

gsutil -q cp "${GAME_DIR}/config.json" "gs://${GCS_BUCKET}/${BASE_PATH}/config.json"
gsutil -q setmeta -h "Content-Type:application/json" -h "Cache-Control:public, max-age=31536000, immutable" "gs://${GCS_BUCKET}/${BASE_PATH}/config.json"
echo "  ✔ Uploaded: config.json"

gsutil -q cp /tmp/sloppy_game_js_tmp.js "gs://${GCS_BUCKET}/${BASE_PATH}/game.js"
gsutil -q setmeta -h "Content-Type:application/javascript" -h "Cache-Control:public, max-age=31536000, immutable" "gs://${GCS_BUCKET}/${BASE_PATH}/game.js"
echo "  ✔ Uploaded: game.js"

rm -f /tmp/sloppy_game_js_tmp.js

# Step 5: Update game with storage path
echo "▶ Updating game with storage path..."

run_sql "UPDATE games SET storage_path = '${BASE_PATH}', updated_at = NOW() WHERE id = '${GAME_ID}'"
echo "  ✔ Storage path set: ${BASE_PATH}"

echo ""
echo "  ┌──────────────────────────────────────────┐"
echo "  │       Deployment Complete                 │"
echo "  └──────────────────────────────────────────┘"
echo ""
echo "  Game ID:      ${GAME_ID}"
echo "  Slug:         ${SLUG}"
echo "  Status:       ${STATUS}"
echo "  Bundle URL:   ${CDN_BASE_URL}/${BASE_PATH}/index.html"
echo "  Game page:    https://sloppygames.io/game/${SLUG}"
echo ""
