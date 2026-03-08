#!/usr/bin/env bash
# ============================================================================
# Upload game HTML files from scripts/games/ to the dev GCS bucket.
#
# Each game directory becomes: games/dev-{dirname}/v1/index.html
# This matches the storagePath set by the seed script.
#
# Usage:
#   ./scripts/upload-dev-games.sh               # Upload all games
#   ./scripts/upload-dev-games.sh neon-drift     # Upload a single game
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
GAMES_DIR="$SCRIPT_DIR/games"

# Load env for GCS_BUCKET
if [[ -f "$ROOT_DIR/.env.local" ]]; then
  set -a; source "$ROOT_DIR/.env.local"; set +a
elif [[ -f "$ROOT_DIR/.env" ]]; then
  set -a; source "$ROOT_DIR/.env"; set +a
fi

BUCKET="${GCS_BUCKET:-sloppy-game-bundles-dev}"

if ! command -v gcloud &>/dev/null; then
  echo "ERROR: gcloud CLI is required. Install it first."
  exit 1
fi

echo "Uploading dev games to gs://$BUCKET"
echo ""

uploaded=0
skipped=0

upload_game() {
  local dir_name="$1"
  local game_dir="$GAMES_DIR/$dir_name"
  local html_file="$game_dir/index.html"

  if [[ ! -f "$html_file" ]]; then
    echo "  SKIP  $dir_name (no index.html)"
    skipped=$((skipped + 1))
    return
  fi

  local gcs_path="games/dev-${dir_name}/v1/index.html"

  gcloud storage cp "$html_file" "gs://$BUCKET/$gcs_path" \
    --content-type="text/html" \
    --cache-control="no-cache" \
    --quiet 2>/dev/null

  # Also upload config.json if it exists
  if [[ -f "$game_dir/config.json" ]]; then
    gcloud storage cp "$game_dir/config.json" \
      "gs://$BUCKET/games/dev-${dir_name}/v1/config.json" \
      --content-type="application/json" \
      --cache-control="no-cache" \
      --quiet 2>/dev/null
  fi

  echo "  ✔  $dir_name → gs://$BUCKET/$gcs_path"
  uploaded=$((uploaded + 1))
}

if [[ -n "${1:-}" ]]; then
  upload_game "$1"
else
  for game_dir in "$GAMES_DIR"/*/; do
    dir_name="$(basename "$game_dir")"
    upload_game "$dir_name"
  done
fi

echo ""
echo "Done: $uploaded uploaded, $skipped skipped"
