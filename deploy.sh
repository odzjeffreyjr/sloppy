#!/usr/bin/env bash
# ============================================================================
# Sloppy — One-Shot Production Deploy Script
# ============================================================================
# Deploys the entire Sloppy platform to GCP. Fully non-interactive — all
# configuration is read from the root .env file.
#
# Usage:
#   ./deploy.sh                  # Full deploy
#   ./deploy.sh --skip-infra     # Skip GCP project + Terraform (images + frontend only)
#   ./deploy.sh --images-only    # Rebuild and push Docker images only
#   ./deploy.sh --frontend-only  # Rebuild and deploy frontend only
#   ./deploy.sh --migrate-only   # Run database migrations only
#   ./deploy.sh --verify         # Health-check everything
#
# Prerequisites: node 22+, pnpm 9+, docker, gcloud, terraform, firebase, cloud-sql-proxy
# Configuration: Fill in all values in the root .env file before deploying.
# ============================================================================

set -euo pipefail

# ── Script location ──────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

# ── Load environment ─────────────────────────────────────────────────────────
# Prefer .env.production, fall back to .env

if [[ -f ".env.production" ]]; then
  ENV_FILE=".env.production"
elif [[ -f ".env" ]]; then
  ENV_FILE=".env"
else
  echo "ERROR: No environment file found."
  echo "Create .env.production (recommended) or .env and fill in all values before deploying."
  exit 1
fi

echo "Loading environment from ${ENV_FILE}"
set -a
source "${ENV_FILE}"
set +a

# ── Strip local-dev VITE_ vars from process env ─────────────────────────────
# The root .env has VITE_* values for local development (localhost URLs, etc.).
# We read them above so deploy.sh can reference Firebase config, but we must
# remove them from the environment before running `vite build` — otherwise
# Vite's loadEnv gives process.env highest priority and ignores our
# production .env.production file.  Save the Firebase values we need first.

FIREBASE_WEB_API_KEY="${VITE_FIREBASE_API_KEY:-}"
FIREBASE_WEB_SENDER_ID="${VITE_FIREBASE_MESSAGING_SENDER_ID:-}"
FIREBASE_WEB_APP_ID="${VITE_FIREBASE_APP_ID:-}"

while IFS='=' read -r key _; do
  unset "$key"
done < <(env | grep '^VITE_')

# ── Configuration (from .env with defaults) ──────────────────────────────────

GCP_PROJECT_ID="${GCP_PROJECT_ID:-sloppy-app}"
REGION="${REGION:-us-east1}"
ENV="${ENV:-prod}"
PROJECT_NAME="${PROJECT_NAME:-sloppy}"
CUSTOM_DOMAIN="${CUSTOM_DOMAIN:-sloppygames.io}"
REGISTRY="${REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${PROJECT_NAME}-${ENV}"
SERVICES=(auth api-gateway ai-orchestrator game-builder multiplayer payments)
TF_DIR="infra/terraform"
SECRETS_DIR="secrets"
IMAGE_TAG="$(git rev-parse --short HEAD 2>/dev/null || date +%s)"

# ── Colors ───────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

step()  { echo -e "\n${BLUE}${BOLD}▶ $1${NC}"; }
ok()    { echo -e "  ${GREEN}✔ $1${NC}"; }
warn()  { echo -e "  ${YELLOW}⚠ $1${NC}"; }
fail()  { echo -e "  ${RED}✖ $1${NC}"; }
info()  { echo -e "  ${CYAN}ℹ $1${NC}"; }

die() { fail "$1"; exit 1; }

# Require that a variable is set and non-empty; die with clear message if not.
require_var() {
  local name="$1"
  local value="${!name:-}"
  local hint="${2:-}"
  if [[ -z "$value" ]]; then
    fail "Required variable ${name} is not set in .env"
    [[ -n "$hint" ]] && info "$hint"
    exit 1
  fi
}

# ── Prerequisite Checks ─────────────────────────────────────────────────────

check_prerequisites() {
  step "Checking prerequisites"

  local missing=0
  for cmd in node pnpm docker gcloud terraform firebase cloud-sql-proxy; do
    if command -v "$cmd" &>/dev/null; then
      ok "$cmd: $(command -v "$cmd")"
    else
      fail "$cmd: not found"
      missing=1
    fi
  done

  if [[ $missing -eq 1 ]]; then
    echo ""
    info "Install missing tools:"
    info "  node/pnpm:         brew install node && corepack enable"
    info "  docker:            https://docker.com"
    info "  gcloud:            brew install google-cloud-sdk"
    info "  terraform:         brew install terraform"
    info "  firebase:          npm install -g firebase-tools"
    info "  cloud-sql-proxy:   brew install cloud-sql-proxy"
    die "Missing prerequisites"
  fi

  if ! docker info &>/dev/null; then
    die "Docker is not running. Start Docker Desktop first."
  fi
  ok "Docker daemon running"

  if ! gcloud auth print-access-token &>/dev/null 2>&1; then
    die "gcloud not authenticated. Run 'gcloud auth login' first."
  fi
  ok "gcloud authenticated"
}

# ── Validate required .env vars for the chosen deploy mode ───────────────────

validate_env() {
  local mode="${1:-full}"

  step "Validating .env configuration"

  # Always required
  require_var GCP_PROJECT_ID
  require_var FIREBASE_PROJECT_ID
  ok "GCP_PROJECT_ID=${GCP_PROJECT_ID}"

  # Full deploy needs LLM keys + DB password
  if [[ "$mode" == "full" ]]; then
    require_var OPENAI_API_KEY    "Set OPENAI_API_KEY in .env"
    require_var ANTHROPIC_API_KEY "Set ANTHROPIC_API_KEY in .env"
    require_var GROK_API_KEY      "Set GROK_API_KEY in .env"
    require_var DB_PASSWORD       "Set DB_PASSWORD in .env (production database password)"
    ok "LLM keys present"
    ok "DB_PASSWORD present"
  fi

  # Migrations need DB password
  if [[ "$mode" == "migrate-only" || "$mode" == "full" || "$mode" == "skip-infra" ]]; then
    require_var DB_PASSWORD "Set DB_PASSWORD in .env (production database password)"
    ok "DB_PASSWORD present"
  fi

  # Any mode that touches the frontend needs Firebase vars
  if [[ "$mode" == "full" || "$mode" == "skip-infra" || "$mode" == "frontend-only" ]]; then
    require_var FIREBASE_WEB_API_KEY               "Set VITE_FIREBASE_API_KEY in .env"
    require_var FIREBASE_WEB_SENDER_ID             "Set VITE_FIREBASE_MESSAGING_SENDER_ID in .env"
    require_var FIREBASE_WEB_APP_ID                "Set VITE_FIREBASE_APP_ID in .env"
    ok "Firebase frontend vars present"
  fi

  ok "Environment validated"
}

# ── Detect Architecture ─────────────────────────────────────────────────────

detect_platform() {
  local arch
  arch="$(uname -m)"
  if [[ "$arch" == "arm64" || "$arch" == "aarch64" ]]; then
    DOCKER_PLATFORM="--platform linux/amd64"
    info "Apple Silicon detected — will cross-compile with --platform linux/amd64"
  else
    DOCKER_PLATFORM=""
    info "x86_64 detected — native builds"
  fi
}

# ── GCP Project Setup ────────────────────────────────────────────────────────

setup_gcp_project() {
  step "Setting up GCP project: ${GCP_PROJECT_ID}"
  gcloud config set project "${GCP_PROJECT_ID}" 2>/dev/null

  info "Enabling required APIs..."
  gcloud services enable \
    run.googleapis.com \
    sqladmin.googleapis.com \
    redis.googleapis.com \
    storage.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com \
    vpcaccess.googleapis.com \
    servicenetworking.googleapis.com \
    compute.googleapis.com \
    firebase.googleapis.com \
    firebasehosting.googleapis.com \
    identitytoolkit.googleapis.com \
    --quiet
  ok "APIs enabled"
}

# ── Service Accounts ─────────────────────────────────────────────────────────

setup_service_accounts() {
  step "Setting up service accounts"
  mkdir -p "${SECRETS_DIR}"

  local tf_sa="terraform@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
  local fb_sa="firebase-admin@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

  # Terraform SA
  if gcloud iam service-accounts describe "$tf_sa" --project="${GCP_PROJECT_ID}" &>/dev/null 2>&1; then
    ok "Terraform SA already exists"
  else
    gcloud iam service-accounts create terraform --display-name="Terraform SA" --project="${GCP_PROJECT_ID}"
    ok "Created Terraform SA"
  fi

  for role in roles/editor roles/iam.securityAdmin roles/secretmanager.admin roles/servicenetworking.networksAdmin; do
    gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
      --member="serviceAccount:${tf_sa}" \
      --role="$role" --quiet &>/dev/null
  done
  ok "Terraform SA roles assigned"

  if [[ ! -f "${SECRETS_DIR}/terraform-sa.json" ]]; then
    gcloud iam service-accounts keys create "${SECRETS_DIR}/terraform-sa.json" \
      --iam-account="$tf_sa"
    ok "Terraform SA key created"
  else
    ok "Terraform SA key already exists"
  fi

  # Firebase Admin SA
  if gcloud iam service-accounts describe "$fb_sa" --project="${GCP_PROJECT_ID}" &>/dev/null 2>&1; then
    ok "Firebase Admin SA already exists"
  else
    gcloud iam service-accounts create firebase-admin --display-name="Firebase Admin SA" --project="${GCP_PROJECT_ID}"
    ok "Created Firebase Admin SA"
  fi

  gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
    --member="serviceAccount:${fb_sa}" \
    --role="roles/firebase.admin" --quiet &>/dev/null
  ok "Firebase Admin SA role assigned"

  if [[ ! -f "${SECRETS_DIR}/firebase-sa.json" ]]; then
    gcloud iam service-accounts keys create "${SECRETS_DIR}/firebase-sa.json" \
      --iam-account="$fb_sa"
    ok "Firebase Admin SA key created"
  else
    ok "Firebase Admin SA key already exists"
  fi
}

# ── Terraform State Bucket ───────────────────────────────────────────────────

setup_tf_state_bucket() {
  step "Setting up Terraform state bucket"

  local bucket="gs://${GCP_PROJECT_ID}-tf-state"
  if gsutil ls "$bucket" &>/dev/null 2>&1; then
    ok "Bucket ${bucket} already exists"
  else
    gsutil mb -p "${GCP_PROJECT_ID}" -l "${REGION}" "$bucket"
    ok "Created bucket ${bucket}"
  fi

  gsutil iam ch \
    "serviceAccount:terraform@${GCP_PROJECT_ID}.iam.gserviceaccount.com:roles/storage.objectAdmin" \
    "$bucket" 2>/dev/null
  ok "Bucket IAM configured"
}

# ── Terraform Variables ──────────────────────────────────────────────────────

setup_terraform_vars() {
  step "Setting up Terraform variables"

  local tfvars="${TF_DIR}/terraform.tfvars"

  if [[ -f "$tfvars" ]]; then
    ok "terraform.tfvars already exists — regenerating from .env"
  fi

  local fb_creds=""
  if [[ -f "${SECRETS_DIR}/firebase-sa.json" ]]; then
    fb_creds=$(python3 -c "
import json
with open('${SECRETS_DIR}/firebase-sa.json') as f:
    print(json.dumps(json.dumps(json.load(f))))
" 2>/dev/null | sed 's/^"//;s/"$//')
  fi

  cat > "$tfvars" <<EOF
project_id   = "${GCP_PROJECT_ID}"
project_name = "${PROJECT_NAME}"
region       = "${REGION}"
environment  = "${ENV}"

db_tier         = "db-f1-micro"
redis_memory_gb = 1
db_password     = "${DB_PASSWORD}"

openai_api_key    = "${OPENAI_API_KEY}"
anthropic_api_key = "${ANTHROPIC_API_KEY}"
grok_api_key      = "${GROK_API_KEY}"

cors_origin  = "https://${CUSTOM_DOMAIN},https://www.${CUSTOM_DOMAIN},https://${GCP_PROJECT_ID}.web.app,https://${GCP_PROJECT_ID}.firebaseapp.com"
cors_origins = ["https://${CUSTOM_DOMAIN}", "https://www.${CUSTOM_DOMAIN}", "https://${GCP_PROJECT_ID}.web.app", "https://${GCP_PROJECT_ID}.firebaseapp.com"]

image_tag     = "latest"
min_instances = 0
max_instances = 10

firebase_credentials_json = "${fb_creds}"

stripe_secret_key    = "${STRIPE_SECRET_KEY:-}"
stripe_webhook_secret = "${STRIPE_WEBHOOK_SECRET:-}"
stripe_connect_secret = "${STRIPE_CONNECT_SECRET:-}"
stripe_price_id       = "${STRIPE_PRICE_ID:-}"
EOF

  ok "Created terraform.tfvars from .env"
}

# ── Terraform Apply ──────────────────────────────────────────────────────────

run_terraform() {
  step "Provisioning infrastructure with Terraform"

  export GOOGLE_APPLICATION_CREDENTIALS="${SCRIPT_DIR}/${SECRETS_DIR}/terraform-sa.json"

  (cd "${TF_DIR}" && terraform init -input=false)
  ok "Terraform initialized"

  (cd "${TF_DIR}" && terraform apply -auto-approve)
  ok "Infrastructure provisioned"

  unset GOOGLE_APPLICATION_CREDENTIALS
}

# ── Firebase Auth Providers ──────────────────────────────────────────────────

setup_firebase_auth() {
  step "Enabling Firebase Auth providers"

  local token
  token=$(GOOGLE_APPLICATION_CREDENTIALS="${SECRETS_DIR}/terraform-sa.json" \
    gcloud auth application-default print-access-token 2>/dev/null || \
    gcloud auth print-access-token 2>/dev/null)

  local result
  result=$(curl -s -X PATCH \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    -d '{"signIn":{"email":{"enabled":true},"anonymous":{"enabled":true}}}' \
    "https://identitytoolkit.googleapis.com/admin/v2/projects/${GCP_PROJECT_ID}/config?updateMask=signIn.email.enabled,signIn.anonymous.enabled")

  if echo "$result" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['signIn']['anonymous']['enabled']" 2>/dev/null; then
    ok "Email/password and anonymous auth enabled"
  else
    warn "Could not verify auth config — enable manually in Firebase Console"
    info "https://console.firebase.google.com/project/${GCP_PROJECT_ID}/authentication/providers"
  fi
}

# ── Firebase Authorized Domains ──────────────────────────────────────────────

setup_firebase_authorized_domains() {
  step "Adding authorized domains to Firebase Auth"

  local token
  token=$(GOOGLE_APPLICATION_CREDENTIALS="${SECRETS_DIR}/terraform-sa.json" \
    gcloud auth application-default print-access-token 2>/dev/null || \
    gcloud auth print-access-token 2>/dev/null)

  local current
  current=$(curl -s \
    -H "Authorization: Bearer ${token}" \
    "https://identitytoolkit.googleapis.com/admin/v2/projects/${GCP_PROJECT_ID}/config" 2>/dev/null)

  local updated_domains

  updated_domains=$(echo "$current" | python3 -c "
import json, sys
config = json.load(sys.stdin)
domains = config.get('authorizedDomains', [])
for d in ['${CUSTOM_DOMAIN}', 'www.${CUSTOM_DOMAIN}']:
    if d not in domains:
        domains.append(d)
print(json.dumps(domains))
" 2>/dev/null || echo "")

  if [[ -z "$updated_domains" || "$updated_domains" == "null" ]]; then
    warn "Could not read current authorized domains — add manually in Firebase Console"
    info "Go to: https://console.firebase.google.com/project/${GCP_PROJECT_ID}/authentication/settings"
    info "Add: ${CUSTOM_DOMAIN} and www.${CUSTOM_DOMAIN}"
    return
  fi

  local result
  result=$(curl -s -X PATCH \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    -d "{\"authorizedDomains\":${updated_domains}}" \
    "https://identitytoolkit.googleapis.com/admin/v2/projects/${GCP_PROJECT_ID}/config?updateMask=authorizedDomains")

  if echo "$result" | python3 -c "
import json, sys
config = json.load(sys.stdin)
domains = config.get('authorizedDomains', [])
assert '${CUSTOM_DOMAIN}' in domains
" 2>/dev/null; then
    ok "Authorized domains updated: ${CUSTOM_DOMAIN}, www.${CUSTOM_DOMAIN}"
  else
    warn "Could not verify authorized domains — add manually in Firebase Console"
    info "Go to: https://console.firebase.google.com/project/${GCP_PROJECT_ID}/authentication/settings"
    info "Add: ${CUSTOM_DOMAIN} and www.${CUSTOM_DOMAIN}"
  fi
}

# ── Docker Auth ──────────────────────────────────────────────────────────────

configure_docker_auth() {
  step "Configuring Docker registry auth"
  gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
  ok "Docker auth configured for ${REGION}-docker.pkg.dev"
}

# ── Build Docker Images ─────────────────────────────────────────────────────

build_docker_images() {
  step "Building Docker images (${#SERVICES[@]} services) — tag ${IMAGE_TAG}"
  detect_platform

  local failed=()
  for svc in "${SERVICES[@]}"; do
    info "Building ${svc}..."
    if docker build ${DOCKER_PLATFORM} \
      -t "${REGISTRY}/${svc}:${IMAGE_TAG}" \
      -t "${REGISTRY}/${svc}:latest" \
      -f "services/${svc}/Dockerfile" . 2>&1; then
      ok "${svc} built"
    else
      warn "${svc} failed — will retry"
      failed+=("$svc")
    fi
  done

  if [[ ${#failed[@]} -gt 0 ]]; then
    step "Retrying ${#failed[@]} failed build(s)"
    for svc in "${failed[@]}"; do
      info "Retrying ${svc}..."
      if docker build ${DOCKER_PLATFORM} \
        -t "${REGISTRY}/${svc}:${IMAGE_TAG}" \
        -t "${REGISTRY}/${svc}:latest" \
        -f "services/${svc}/Dockerfile" . 2>&1; then
        ok "${svc} built on retry"
      else
        die "${svc} failed to build after retry"
      fi
    done
  fi
}

# ── Push Docker Images ───────────────────────────────────────────────────────

push_docker_images() {
  step "Pushing Docker images to Artifact Registry — tag ${IMAGE_TAG}"

  for svc in "${SERVICES[@]}"; do
    info "Pushing ${svc}..."
    docker push "${REGISTRY}/${svc}:${IMAGE_TAG}"
    docker push "${REGISTRY}/${svc}:latest"
    ok "${svc} pushed"
  done
}

# ── Deploy Cloud Run ─────────────────────────────────────────────────────────

deploy_cloud_run() {
  step "Deploying Cloud Run services via Terraform — image tag ${IMAGE_TAG}"

  export GOOGLE_APPLICATION_CREDENTIALS="${SCRIPT_DIR}/${SECRETS_DIR}/terraform-sa.json"

  # Update image_tag to the git SHA so Terraform detects the image change
  # and forces Cloud Run to pull the freshly pushed images.
  local tfvars="${TF_DIR}/terraform.tfvars"
  sed -i '' "s/^image_tag .*/image_tag     = \"${IMAGE_TAG}\"/" "$tfvars"
  ok "Set image_tag = ${IMAGE_TAG}"

  (cd "${TF_DIR}" && terraform apply -auto-approve)
  ok "Cloud Run services deployed"

  GATEWAY_URL=$(cd "${TF_DIR}" && terraform output -raw api_gateway_url 2>/dev/null)
  ok "API Gateway: ${GATEWAY_URL}"

  unset GOOGLE_APPLICATION_CREDENTIALS
}

# ── Database Migrations ──────────────────────────────────────────────────────

run_migrations() {
  step "Running database migrations"

  local instance="${GCP_PROJECT_ID}:${REGION}:${PROJECT_NAME}-pg-${ENV}"

  # Read password: tfvars first, then .env
  local db_password=""
  if [[ -f "${TF_DIR}/terraform.tfvars" ]]; then
    db_password=$(grep 'db_password' "${TF_DIR}/terraform.tfvars" | sed 's/.*= *"//;s/"$//' || echo "")
  fi
  if [[ -z "$db_password" ]]; then
    db_password="${DB_PASSWORD:-}"
  fi
  if [[ -z "$db_password" ]]; then
    die "DB_PASSWORD not set. Add it to .env or ensure terraform.tfvars has db_password."
  fi

  info "Enabling temporary public IP on Cloud SQL..."
  gcloud sql instances patch "${PROJECT_NAME}-pg-${ENV}" \
    --project="${GCP_PROJECT_ID}" --assign-ip --quiet 2>/dev/null
  ok "Public IP enabled"

  info "Starting Cloud SQL Auth Proxy..."
  GOOGLE_APPLICATION_CREDENTIALS="${SECRETS_DIR}/terraform-sa.json" \
    cloud-sql-proxy "${instance}" --port=5433 &
  local proxy_pid=$!
  sleep 5

  if ! kill -0 "$proxy_pid" 2>/dev/null; then
    die "Cloud SQL proxy failed to start"
  fi
  ok "Proxy running (PID ${proxy_pid})"

  info "Applying migrations..."
  (cd packages/db && \
    DATABASE_URL="postgresql://sloppy:${db_password}@127.0.0.1:5433/sloppy" \
    pnpm tsx src/migrate.ts)
  ok "Migrations complete"

  kill "$proxy_pid" 2>/dev/null || true
  wait "$proxy_pid" 2>/dev/null || true
  ok "Proxy stopped"

  info "Disabling public IP on Cloud SQL..."
  gcloud sql instances patch "${PROJECT_NAME}-pg-${ENV}" \
    --project="${GCP_PROJECT_ID}" --no-assign-ip --quiet 2>/dev/null
  ok "Public IP disabled"
}

# ── Build & Deploy Frontend ─────────────────────────────────────────────────

deploy_frontend() {
  step "Building and deploying frontend"

  # ── Resolve production URLs from Terraform ──
  if [[ -z "${GATEWAY_URL:-}" ]]; then
    export GOOGLE_APPLICATION_CREDENTIALS="${SCRIPT_DIR}/${SECRETS_DIR}/terraform-sa.json"
    GATEWAY_URL=$(cd "${TF_DIR}" && terraform output -raw api_gateway_url 2>/dev/null || echo "")
    CDN_URL=$(cd "${TF_DIR}" && terraform output -raw cdn_url 2>/dev/null || echo "")
    MULTIPLAYER_URL=$(cd "${TF_DIR}" && terraform output -json backend_service_urls 2>/dev/null \
      | python3 -c "import json,sys; print(json.load(sys.stdin).get('multiplayer',''))" 2>/dev/null || echo "")
    local bucket_name
    bucket_name=$(cd "${TF_DIR}" && terraform output -raw gcs_bucket_name 2>/dev/null || echo "")
    unset GOOGLE_APPLICATION_CREDENTIALS
  fi

  # HTTP CDN URLs cause mixed-content blocking on HTTPS frontends.
  # Fall back to the HTTPS GCS direct URL when the CDN URL is HTTP.
  if [[ "${CDN_URL:-}" == http://* ]]; then
    if [[ -n "${bucket_name:-}" ]]; then
      CDN_URL="https://storage.googleapis.com/${bucket_name}"
      warn "CDN URL was HTTP — using HTTPS GCS URL instead: ${CDN_URL}"
    else
      warn "CDN URL is HTTP (${CDN_URL}) — game bundles may be blocked by mixed-content policy"
    fi
  fi

  if [[ -z "${GATEWAY_URL:-}" ]]; then
    die "Could not determine API Gateway URL from Terraform. Run a full deploy first."
  fi

  local ws_url=""
  if [[ -n "${MULTIPLAYER_URL:-}" ]]; then
    ws_url="${MULTIPLAYER_URL/https:/wss:}/ws"
  fi

  info "VITE_API_URL=${GATEWAY_URL}"
  info "VITE_APP_URL=https://${CUSTOM_DOMAIN}"
  info "VITE_MULTIPLAYER_WS_URL=${ws_url}"
  info "VITE_FIREBASE_API_KEY=${FIREBASE_WEB_API_KEY:0:10}..."

  # ── Write apps/web/.env.production (gitignored) ──
  # Vite's loadEnv('production', ...) gives .env.production higher priority
  # than .env. VITE_* vars were already stripped from process.env at script
  # startup, so the file values are authoritative.
  cat > "apps/web/.env.production" <<ENVEOF
VITE_API_URL=${GATEWAY_URL}
VITE_FIREBASE_API_KEY=${FIREBASE_WEB_API_KEY}
VITE_FIREBASE_AUTH_DOMAIN=${GCP_PROJECT_ID}.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=${GCP_PROJECT_ID}
VITE_FIREBASE_STORAGE_BUCKET=${GCP_PROJECT_ID}.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=${FIREBASE_WEB_SENDER_ID}
VITE_FIREBASE_APP_ID=${FIREBASE_WEB_APP_ID}
VITE_CDN_URL=${CDN_URL:-}
VITE_APP_URL=https://${CUSTOM_DOMAIN}
VITE_MULTIPLAYER_WS_URL=${ws_url}
ENVEOF
  ok "Wrote apps/web/.env.production"

  # ── Build ──
  info "Building frontend..."
  (cd apps/web && pnpm build)
  ok "Frontend built"

  # ── Deploy to Firebase Hosting ──
  info "Deploying to Firebase Hosting..."
  GOOGLE_APPLICATION_CREDENTIALS="${SECRETS_DIR}/firebase-sa.json" \
    firebase deploy --only hosting --project "${GCP_PROJECT_ID}"
  ok "Frontend deployed to https://${CUSTOM_DOMAIN}"
}

# ── Verify ───────────────────────────────────────────────────────────────────

verify_deployment() {
  step "Verifying deployment"

  if [[ -z "${GATEWAY_URL:-}" ]]; then
    export GOOGLE_APPLICATION_CREDENTIALS="${SCRIPT_DIR}/${SECRETS_DIR}/terraform-sa.json"
    GATEWAY_URL=$(cd "${TF_DIR}" && terraform output -raw api_gateway_url 2>/dev/null || echo "")
    unset GOOGLE_APPLICATION_CREDENTIALS
  fi

  if [[ -z "$GATEWAY_URL" ]]; then
    warn "Could not determine API Gateway URL"
    return
  fi

  info "Checking API Gateway health..."
  local health
  health=$(curl -s --max-time 15 "${GATEWAY_URL}/health" 2>/dev/null || echo "")

  if [[ -z "$health" ]]; then
    warn "API Gateway not responding (may still be starting — Cloud Run scales to zero)"
    info "Try again in 30s: curl -s ${GATEWAY_URL}/health | python3 -m json.tool"
  else
    local status
    status=$(echo "$health" | python3 -c "import json,sys; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "unknown")
    if [[ "$status" == "ok" ]]; then
      ok "API Gateway: all backends healthy"
    else
      warn "API Gateway status: ${status}"
    fi

    echo "$health" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for svc in data.get('services', []):
    status = '✔' if svc['status'] == 'healthy' else '✖'
    ms = svc.get('latencyMs', '?')
    print(f'  {status} {svc[\"name\"]}: {svc[\"status\"]} ({ms}ms)')
" 2>/dev/null || true
  fi

  info "Checking frontend..."
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://${GCP_PROJECT_ID}.web.app" 2>/dev/null || echo "000")
  if [[ "$http_code" == "200" ]]; then
    ok "Frontend: HTTP 200"
  else
    warn "Frontend: HTTP ${http_code}"
  fi

  info "Cloud Run services:"
  gcloud run services list --project="${GCP_PROJECT_ID}" --region="${REGION}" \
    --format="table(name,status.url)" 2>/dev/null || warn "Could not list services"

  echo ""
  echo -e "${GREEN}${BOLD}Deployment complete!${NC}"
  echo -e "  Frontend: ${CYAN}https://${CUSTOM_DOMAIN}${NC}"
  echo -e "  Firebase: ${CYAN}https://${GCP_PROJECT_ID}.web.app${NC}"
  echo -e "  API:      ${CYAN}${GATEWAY_URL}${NC}"
}

# ── Full Deploy ──────────────────────────────────────────────────────────────

full_deploy() {
  echo -e "${BOLD}"
  echo "  ┌─────────────────────────────────────────────┐"
  echo "  │       Sloppy — Production Deploy Script      │"
  echo "  └─────────────────────────────────────────────┘"
  echo -e "${NC}"
  echo "  Project:  ${GCP_PROJECT_ID}"
  echo "  Region:   ${REGION}"
  echo "  Registry: ${REGISTRY}"
  echo ""

  validate_env "full"
  check_prerequisites
  setup_gcp_project
  setup_service_accounts
  setup_tf_state_bucket
  setup_terraform_vars
  run_terraform
  setup_firebase_auth
  setup_firebase_authorized_domains
  configure_docker_auth
  build_docker_images
  push_docker_images
  deploy_cloud_run
  run_migrations
  deploy_frontend
  verify_deployment
}

# ── Entrypoint ───────────────────────────────────────────────────────────────

main() {
  case "${1:-}" in
    --skip-infra)
      validate_env "skip-infra"
      check_prerequisites
      setup_terraform_vars
      configure_docker_auth
      build_docker_images
      push_docker_images
      deploy_cloud_run
      run_migrations
      deploy_frontend
      verify_deployment
      ;;
    --images-only)
      validate_env "images-only"
      check_prerequisites
      configure_docker_auth
      build_docker_images
      push_docker_images
      deploy_cloud_run
      verify_deployment
      ;;
    --frontend-only)
      validate_env "frontend-only"
      check_prerequisites
      deploy_frontend
      verify_deployment
      ;;
    --migrate-only)
      validate_env "migrate-only"
      check_prerequisites
      run_migrations
      ;;
    --verify)
      validate_env "verify"
      verify_deployment
      ;;
    --help|-h)
      echo "Usage: ./deploy.sh [OPTION]"
      echo ""
      echo "Options:"
      echo "  (none)            Full deploy from scratch"
      echo "  --skip-infra      Skip GCP project setup + Terraform infra provisioning"
      echo "  --images-only     Rebuild, push Docker images, and update Cloud Run"
      echo "  --frontend-only   Rebuild and deploy frontend to Firebase Hosting"
      echo "  --migrate-only    Run database migrations only"
      echo "  --verify          Health-check all services"
      echo "  --help            Show this message"
      echo ""
      echo "All configuration is read from the root .env file."
      echo ""
      echo "Required .env variables:"
      echo "  GCP_PROJECT_ID                      GCP project (default: sloppy-app)"
      echo "  FIREBASE_PROJECT_ID                 Firebase project ID"
      echo "  DB_PASSWORD                         Production database password"
      echo "  OPENAI_API_KEY                      OpenAI API key"
      echo "  ANTHROPIC_API_KEY                   Anthropic API key"
      echo "  GROK_API_KEY                        Grok (xAI) API key"
      echo "  VITE_FIREBASE_API_KEY               Firebase web API key"
      echo "  VITE_FIREBASE_MESSAGING_SENDER_ID   Firebase messaging sender ID"
      echo "  VITE_FIREBASE_APP_ID                Firebase web app ID"
      echo ""
      echo "Optional .env variables:"
      echo "  REGION              GCP region (default: us-east1)"
      echo "  ENV                 Environment (default: prod)"
      echo "  PROJECT_NAME        Resource prefix (default: sloppy)"
      ;;
    *)
      full_deploy
      ;;
  esac
}

main "$@"
