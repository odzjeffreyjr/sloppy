#!/usr/bin/env bash
# ============================================================================
# Sloppy — One-Shot Production Deploy Script
# ============================================================================
# Deploys the entire Sloppy platform to GCP from scratch or re-deploys
# individual components. All known deployment pitfalls are handled.
#
# Usage:
#   ./deploy.sh                  # Full deploy (interactive — prompts for secrets)
#   ./deploy.sh --skip-infra     # Skip GCP project + Terraform (images + frontend only)
#   ./deploy.sh --images-only    # Rebuild and push Docker images only
#   ./deploy.sh --frontend-only  # Rebuild and deploy frontend only
#   ./deploy.sh --migrate-only   # Run database migrations only
#   ./deploy.sh --verify         # Health-check everything
#
# Prerequisites: node 22+, pnpm 9+, docker, gcloud, terraform, firebase, cloud-sql-proxy
# ============================================================================

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────────

GCP_PROJECT_ID="${GCP_PROJECT_ID:-sloppy-app}"
REGION="${REGION:-us-east1}"
ENV="${ENV:-prod}"
PROJECT_NAME="${PROJECT_NAME:-sloppy}"
REGISTRY="${REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${PROJECT_NAME}-${ENV}"
SERVICES=(auth api-gateway ai-orchestrator game-builder multiplayer)
TF_DIR="infra/terraform"
SECRETS_DIR="secrets"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Colors ───────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

step()  { echo -e "\n${BLUE}${BOLD}▶ $1${NC}"; }
ok()    { echo -e "  ${GREEN}✔ $1${NC}"; }
warn()  { echo -e "  ${YELLOW}⚠ $1${NC}"; }
fail()  { echo -e "  ${RED}✖ $1${NC}"; }
info()  { echo -e "  ${CYAN}ℹ $1${NC}"; }

die() { fail "$1"; exit 1; }

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

  # Docker must be running
  if ! docker info &>/dev/null; then
    die "Docker is not running. Start Docker Desktop first."
  fi
  ok "Docker daemon running"

  # gcloud must be authenticated
  if ! gcloud auth print-access-token &>/dev/null 2>&1; then
    warn "gcloud not authenticated. Running 'gcloud auth login'..."
    gcloud auth login
  fi
  ok "gcloud authenticated"
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
    ok "terraform.tfvars already exists"
    return
  fi

  warn "terraform.tfvars not found — creating interactively"
  echo ""

  read -rsp "  Database password: " DB_PASSWORD; echo ""
  read -rp  "  OpenAI API key: " OPENAI_KEY
  read -rp  "  Anthropic API key: " ANTHROPIC_KEY
  read -rp  "  Grok (xAI) API key: " GROK_KEY
  echo ""

  local fb_creds
  fb_creds=$(python3 -c "
import json, sys
with open('${SECRETS_DIR}/firebase-sa.json') as f:
    print(json.dumps(json.dumps(json.load(f))))
" 2>/dev/null | sed 's/^"//;s/"$//')

  cat > "$tfvars" <<EOF
project_id   = "${GCP_PROJECT_ID}"
project_name = "${PROJECT_NAME}"
region       = "${REGION}"
environment  = "${ENV}"

db_tier         = "db-f1-micro"
redis_memory_gb = 1
db_password     = "${DB_PASSWORD}"

openai_api_key    = "${OPENAI_KEY}"
anthropic_api_key = "${ANTHROPIC_KEY}"
grok_api_key      = "${GROK_KEY}"

cors_origin  = "https://${GCP_PROJECT_ID}.web.app"
cors_origins = ["https://${GCP_PROJECT_ID}.web.app"]

image_tag     = "latest"
min_instances = 0
max_instances = 10

firebase_credentials_json = "${fb_creds}"
EOF

  ok "Created terraform.tfvars"
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

# ── Docker Auth ──────────────────────────────────────────────────────────────

configure_docker_auth() {
  step "Configuring Docker registry auth"
  gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
  ok "Docker auth configured for ${REGION}-docker.pkg.dev"
}

# ── Build Docker Images ─────────────────────────────────────────────────────

build_docker_images() {
  step "Building Docker images (${#SERVICES[@]} services)"
  detect_platform

  local failed=()
  for svc in "${SERVICES[@]}"; do
    info "Building ${svc}..."
    if docker build ${DOCKER_PLATFORM} \
      -t "${REGISTRY}/${svc}:latest" \
      -f "services/${svc}/Dockerfile" . 2>&1; then
      ok "${svc} built"
    else
      warn "${svc} failed — will retry"
      failed+=("$svc")
    fi
  done

  # Retry failures (QEMU EINTR transient errors on Apple Silicon)
  if [[ ${#failed[@]} -gt 0 ]]; then
    step "Retrying ${#failed[@]} failed build(s)"
    for svc in "${failed[@]}"; do
      info "Retrying ${svc}..."
      if docker build ${DOCKER_PLATFORM} \
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
  step "Pushing Docker images to Artifact Registry"

  for svc in "${SERVICES[@]}"; do
    info "Pushing ${svc}..."
    docker push "${REGISTRY}/${svc}:latest"
    ok "${svc} pushed"
  done
}

# ── Deploy Cloud Run ─────────────────────────────────────────────────────────

deploy_cloud_run() {
  step "Deploying Cloud Run services via Terraform"

  export GOOGLE_APPLICATION_CREDENTIALS="${SCRIPT_DIR}/${SECRETS_DIR}/terraform-sa.json"

  (cd "${TF_DIR}" && terraform apply -auto-approve)
  ok "Cloud Run services deployed"

  # Extract gateway URL
  GATEWAY_URL=$(cd "${TF_DIR}" && terraform output -raw api_gateway_url 2>/dev/null)
  ok "API Gateway: ${GATEWAY_URL}"

  unset GOOGLE_APPLICATION_CREDENTIALS
}

# ── Database Migrations ──────────────────────────────────────────────────────

run_migrations() {
  step "Running database migrations"

  local instance="${GCP_PROJECT_ID}:${REGION}:${PROJECT_NAME}-pg-${ENV}"
  local db_password

  # Read password from tfvars
  db_password=$(grep 'db_password' "${TF_DIR}/terraform.tfvars" | sed 's/.*= *"//;s/"$//')
  if [[ -z "$db_password" ]]; then
    read -rsp "  Database password: " db_password; echo ""
  fi

  # Temporarily enable public IP (instance is private-only)
  info "Enabling temporary public IP on Cloud SQL..."
  gcloud sql instances patch "${PROJECT_NAME}-pg-${ENV}" \
    --project="${GCP_PROJECT_ID}" --assign-ip --quiet 2>/dev/null
  ok "Public IP enabled"

  # Start proxy
  info "Starting Cloud SQL Auth Proxy..."
  GOOGLE_APPLICATION_CREDENTIALS="${SECRETS_DIR}/terraform-sa.json" \
    cloud-sql-proxy "${instance}" --port=5433 &
  local proxy_pid=$!
  sleep 5

  if ! kill -0 "$proxy_pid" 2>/dev/null; then
    die "Cloud SQL proxy failed to start"
  fi
  ok "Proxy running (PID ${proxy_pid})"

  # Run migrations
  info "Applying migrations..."
  (cd packages/db && \
    DATABASE_URL="postgresql://sloppy:${db_password}@127.0.0.1:5433/sloppy" \
    pnpm tsx src/migrate.ts)
  ok "Migrations complete"

  # Cleanup
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

  # Get values from Terraform if possible
  if [[ -z "${GATEWAY_URL:-}" ]]; then
    export GOOGLE_APPLICATION_CREDENTIALS="${SCRIPT_DIR}/${SECRETS_DIR}/terraform-sa.json"
    GATEWAY_URL=$(cd "${TF_DIR}" && terraform output -raw api_gateway_url 2>/dev/null || echo "")
    CDN_URL=$(cd "${TF_DIR}" && terraform output -raw cdn_url 2>/dev/null || echo "")
    unset GOOGLE_APPLICATION_CREDENTIALS
  fi

  # Read Firebase config from .firebaserc / terraform.tfvars
  local firebase_api_key="${VITE_FIREBASE_API_KEY:-}"
  local firebase_sender_id="${VITE_FIREBASE_MESSAGING_SENDER_ID:-}"
  local firebase_app_id="${VITE_FIREBASE_APP_ID:-}"

  if [[ -z "$firebase_api_key" ]]; then
    # Try to read from Identity Platform config
    local token
    token=$(GOOGLE_APPLICATION_CREDENTIALS="${SECRETS_DIR}/terraform-sa.json" \
      gcloud auth application-default print-access-token 2>/dev/null || \
      gcloud auth print-access-token 2>/dev/null)

    local config
    config=$(curl -s -H "Authorization: Bearer ${token}" \
      "https://identitytoolkit.googleapis.com/admin/v2/projects/${GCP_PROJECT_ID}/config" 2>/dev/null)

    firebase_api_key=$(echo "$config" | python3 -c "import json,sys; print(json.load(sys.stdin)['client']['apiKey'])" 2>/dev/null || echo "")

    if [[ -z "$firebase_api_key" ]]; then
      read -rp "  Firebase API key: " firebase_api_key
      read -rp "  Firebase Messaging Sender ID: " firebase_sender_id
      read -rp "  Firebase App ID: " firebase_app_id
    fi
  fi

  # Get project number for sender ID if not set
  if [[ -z "$firebase_sender_id" ]]; then
    firebase_sender_id=$(gcloud projects describe "${GCP_PROJECT_ID}" --format="value(projectNumber)" 2>/dev/null || echo "")
  fi

  # Get app ID if not set
  if [[ -z "$firebase_app_id" ]]; then
    warn "Firebase App ID not set — check Firebase Console for the value"
    read -rp "  Firebase App ID: " firebase_app_id
  fi

  info "Building frontend..."
  (cd apps/web && \
    VITE_API_URL="${GATEWAY_URL}" \
    VITE_FIREBASE_API_KEY="${firebase_api_key}" \
    VITE_FIREBASE_AUTH_DOMAIN="${GCP_PROJECT_ID}.firebaseapp.com" \
    VITE_FIREBASE_PROJECT_ID="${GCP_PROJECT_ID}" \
    VITE_FIREBASE_STORAGE_BUCKET="${GCP_PROJECT_ID}.firebasestorage.app" \
    VITE_FIREBASE_MESSAGING_SENDER_ID="${firebase_sender_id}" \
    VITE_FIREBASE_APP_ID="${firebase_app_id}" \
    VITE_CDN_URL="${CDN_URL:-}" \
    VITE_APP_URL="https://${GCP_PROJECT_ID}.web.app" \
    pnpm build)
  ok "Frontend built"

  info "Deploying to Firebase Hosting..."
  GOOGLE_APPLICATION_CREDENTIALS="${SECRETS_DIR}/firebase-sa.json" \
    firebase deploy --only hosting --project "${GCP_PROJECT_ID}"
  ok "Frontend deployed to https://${GCP_PROJECT_ID}.web.app"
}

# ── Verify ───────────────────────────────────────────────────────────────────

verify_deployment() {
  step "Verifying deployment"

  # Get gateway URL
  if [[ -z "${GATEWAY_URL:-}" ]]; then
    export GOOGLE_APPLICATION_CREDENTIALS="${SCRIPT_DIR}/${SECRETS_DIR}/terraform-sa.json"
    GATEWAY_URL=$(cd "${TF_DIR}" && terraform output -raw api_gateway_url 2>/dev/null || echo "")
    unset GOOGLE_APPLICATION_CREDENTIALS
  fi

  if [[ -z "$GATEWAY_URL" ]]; then
    warn "Could not determine API Gateway URL"
    return
  fi

  # API Gateway health
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

    # Show individual service health
    echo "$health" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for svc in data.get('services', []):
    status = '✔' if svc['status'] == 'healthy' else '✖'
    ms = svc.get('latencyMs', '?')
    print(f'  {status} {svc[\"name\"]}: {svc[\"status\"]} ({ms}ms)')
" 2>/dev/null || true
  fi

  # Frontend
  info "Checking frontend..."
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://${GCP_PROJECT_ID}.web.app" 2>/dev/null || echo "000")
  if [[ "$http_code" == "200" ]]; then
    ok "Frontend: HTTP 200"
  else
    warn "Frontend: HTTP ${http_code}"
  fi

  # Cloud Run services
  info "Cloud Run services:"
  gcloud run services list --project="${GCP_PROJECT_ID}" --region="${REGION}" \
    --format="table(name,status.url)" 2>/dev/null || warn "Could not list services"

  echo ""
  echo -e "${GREEN}${BOLD}Deployment complete!${NC}"
  echo -e "  Frontend: ${CYAN}https://${GCP_PROJECT_ID}.web.app${NC}"
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

  check_prerequisites
  setup_gcp_project
  setup_service_accounts
  setup_tf_state_bucket
  setup_terraform_vars
  run_terraform
  setup_firebase_auth
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
  cd "${SCRIPT_DIR}"

  case "${1:-}" in
    --skip-infra)
      check_prerequisites
      configure_docker_auth
      build_docker_images
      push_docker_images
      deploy_cloud_run
      run_migrations
      deploy_frontend
      verify_deployment
      ;;
    --images-only)
      check_prerequisites
      configure_docker_auth
      build_docker_images
      push_docker_images
      deploy_cloud_run
      verify_deployment
      ;;
    --frontend-only)
      check_prerequisites
      deploy_frontend
      verify_deployment
      ;;
    --migrate-only)
      check_prerequisites
      run_migrations
      ;;
    --verify)
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
      echo "Environment variables:"
      echo "  GCP_PROJECT_ID    GCP project (default: sloppy-app)"
      echo "  REGION            GCP region (default: us-east1)"
      echo "  ENV               Environment (default: prod)"
      echo "  PROJECT_NAME      Resource prefix (default: sloppy)"
      echo ""
      echo "Firebase env vars (optional — will prompt if not set):"
      echo "  VITE_FIREBASE_API_KEY"
      echo "  VITE_FIREBASE_MESSAGING_SENDER_ID"
      echo "  VITE_FIREBASE_APP_ID"
      ;;
    *)
      full_deploy
      ;;
  esac
}

main "$@"
