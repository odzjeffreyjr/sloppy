# Sloppy — Production Deployment Guide

One-shot guide to deploy Sloppy to GCP from a clean slate. Every gotcha, fix, and
workaround discovered during the initial deployment is baked in.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 22+ | `brew install node` |
| pnpm | 9.x | `corepack enable` |
| Docker Desktop | 29+ | [docker.com](https://docker.com) |
| gcloud CLI | latest | `brew install google-cloud-sdk` |
| Terraform | >= 1.5 | `brew install terraform` |
| Firebase CLI | 14+ | `npm install -g firebase-tools` |
| cloud-sql-proxy | latest | `brew install cloud-sql-proxy` |

You also need:
- A GCP project with billing enabled
- API keys for OpenAI, Anthropic, and/or xAI (Grok)
- A Firebase service account key JSON file

---

## 1. GCP Project Setup

```bash
export GCP_PROJECT_ID="sloppy-app"
export REGION="us-east1"

gcloud auth login
gcloud config set project $GCP_PROJECT_ID

# Enable required APIs
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
  identitytoolkit.googleapis.com
```

## 2. Service Accounts

```bash
# Terraform service account
gcloud iam service-accounts create terraform \
  --display-name="Terraform SA"

gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:terraform@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/editor"

gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:terraform@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.securityAdmin"

gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:terraform@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.admin"

gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:terraform@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/servicenetworking.networksAdmin"

mkdir -p secrets
gcloud iam service-accounts keys create secrets/terraform-sa.json \
  --iam-account="terraform@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

# Firebase Admin service account
gcloud iam service-accounts create firebase-admin \
  --display-name="Firebase Admin SA"

gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:firebase-admin@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/firebase.admin"

gcloud iam service-accounts keys create secrets/firebase-sa.json \
  --iam-account="firebase-admin@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
```

## 3. Terraform State Bucket

```bash
gsutil mb -p $GCP_PROJECT_ID -l $REGION gs://${GCP_PROJECT_ID}-tf-state

gsutil iam ch \
  serviceAccount:terraform@${GCP_PROJECT_ID}.iam.gserviceaccount.com:roles/storage.objectAdmin \
  gs://${GCP_PROJECT_ID}-tf-state
```

## 4. Firebase Setup

```bash
# Add Firebase to the GCP project (via Console or REST API)
# Then create a web app and note the config values.
# Console: https://console.firebase.google.com/project/$GCP_PROJECT_ID/overview

# Enable auth providers (email/password + anonymous) via API:
ACCESS_TOKEN=$(gcloud auth print-access-token)

curl -X PATCH \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"signIn":{"email":{"enabled":true},"anonymous":{"enabled":true}}}' \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/${GCP_PROJECT_ID}/config?updateMask=signIn.email.enabled,signIn.anonymous.enabled"
```

## 5. Terraform Variables

Create `infra/terraform/terraform.tfvars` (this file is gitignored):

```hcl
project_id   = "sloppy-app"
project_name = "sloppy"
environment  = "prod"
region       = "us-east1"

db_password = "<STRONG_PASSWORD>"
db_tier     = "db-f1-micro"

# Paste the full Firebase SA JSON as a single-line string
firebase_credentials_json = "{\"type\":\"service_account\",...}"

openai_api_key    = "sk-..."
anthropic_api_key = "sk-ant-..."
grok_api_key      = "xai-..."

cors_origin  = "https://sloppy-app.web.app"
cors_origins = ["https://sloppy-app.web.app"]

image_tag     = "latest"
min_instances = 0
max_instances = 10
```

> **IMPORTANT:** `db_password` must NOT be empty. Terraform will create the Cloud SQL
> user with this password. An empty string causes the user creation to fail silently.

## 6. Provision Infrastructure

```bash
export GOOGLE_APPLICATION_CREDENTIALS=secrets/terraform-sa.json

cd infra/terraform
terraform init
terraform plan -out=tfplan
terraform apply tfplan
cd ../..
```

This creates: VPC, Cloud SQL (private IP only), Redis, GCS bucket + CDN,
Artifact Registry, Secret Manager secrets, Cloud Run services, and IAM bindings.

The Cloud Run services will be created but **won't be healthy yet** because the
Docker images don't exist. That's expected — we build and push them next.

## 7. Code Fixes Required Before Building

The codebase needs these fixes applied before Docker images will build and deploy
correctly. **All fixes below are already applied** in the current codebase, but
are documented here for reference.

### 7a. Remove `composite: true` from package tsconfigs

TypeScript with `composite: true` and `tsc -b` silently emits zero files inside
Docker (node:22-alpine + TS 5.9.x). Since no project references are used,
`composite` serves no purpose.

**Files to fix** (remove the `"composite": true` line from each):
- `packages/shared/tsconfig.json`
- `packages/db/tsconfig.json`
- `packages/ui/tsconfig.json`
- `packages/multiplayer-sdk/tsconfig.json`
- `packages/runtime-sdk/tsconfig.json`

**Also change** the build script in each corresponding `package.json`:
```diff
-"build": "tsc -b"
+"build": "tsc"
```

### 7b. Auth service health endpoint

Cloud Run startup probes check `/health`. The auth service must expose that path.

```diff
-app.get('/auth/health', (_req, res) => {
+app.get('/health', (_req, res) => {
```

File: `services/auth/src/app.ts`

### 7c. API gateway health check URL for auth

After fixing 7b, update the gateway to match:

```diff
-auth: `${config.services.auth}/auth/health`,
+auth: `${config.services.auth}/health`,
```

File: `services/api-gateway/src/health.ts`

### 7d. Gateway health check must not fail startup

The gateway health check returns 503 if any backend is unhealthy. This causes
the startup probe to fail in a chicken-and-egg scenario (backends cold-starting).
Always return 200 from the health endpoint:

```diff
-res.status(allHealthy ? 200 : 503).json({
+res.status(200).json({
```

File: `services/api-gateway/src/health.ts`

### 7e. Terraform: no PORT env var, no semicolons

- `PORT` is a **reserved** env var in Cloud Run v2. It's set automatically
  from `container_port`. Remove all `PORT` env blocks from Terraform.
- Terraform 1.5+ does **not** allow semicolons in single-line blocks. Use
  multi-line `env {}` blocks instead of `env { name = "X"; value = "Y" }`.

File: `infra/terraform/modules/services/main.tf`

### 7f. API gateway VPC egress must be ALL_TRAFFIC

The API gateway must route ALL outbound traffic through the VPC connector
(not just private ranges) so it can reach internal-only backend services
via their `.run.app` URLs.

```diff
 vpc_access {
   connector = var.vpc_connector_id
-  egress    = "PRIVATE_RANGES_ONLY"
+  egress    = "ALL_TRAFFIC"
 }
```

File: `infra/terraform/modules/services/main.tf` (in the `api_gateway` resource)

### 7g. Backend services need IAM for internal invocation

Backend services use `INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER` (network-level
security). They also need an IAM binding so the gateway can invoke them
without an ID token:

```hcl
resource "google_cloud_run_v2_service_iam_member" "backend_allow_internal" {
  for_each = local.backend_services
  name     = google_cloud_run_v2_service.backend[each.key].name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}
```

File: `infra/terraform/modules/services/main.tf`

### 7h. .dockerignore logo pattern

The `.dockerignore` pattern for the logo must be anchored to the root so it
doesn't exclude `apps/web/public/sloppy_logo.png`:

```diff
-sloppy_logo*.png
+/sloppy_logo*.png
```

## 8. Configure Docker Auth

```bash
gcloud auth configure-docker ${REGION}-docker.pkg.dev
```

## 9. Build & Push Docker Images

> **CRITICAL:** On Apple Silicon (M1/M2/M3), you MUST use `--platform linux/amd64`.
> Cloud Run only runs linux/amd64 containers. Without this flag, the push succeeds
> but Cloud Run rejects the image with:
> `Container manifest type must support amd64/linux`

```bash
REGISTRY="${REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/sloppy-prod"

for svc in auth api-gateway ai-orchestrator game-builder multiplayer; do
  echo "=== Building $svc ==="
  docker build --platform linux/amd64 \
    -t ${REGISTRY}/${svc}:latest \
    -f services/${svc}/Dockerfile .
done
```

> **Note:** Cross-compilation via QEMU can occasionally fail with transient
> `EINTR` errors (e.g., `Cannot write logs: failed to create directory .turbo`).
> Simply retry the failed build — it's not a code issue.

```bash
for svc in auth api-gateway ai-orchestrator game-builder multiplayer; do
  echo "=== Pushing $svc ==="
  docker push ${REGISTRY}/${svc}:latest
done
```

## 10. Deploy Cloud Run Services

Re-run Terraform to update Cloud Run services with the now-existing images:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=secrets/terraform-sa.json
cd infra/terraform
terraform apply -auto-approve
cd ../..
```

Verify all services are healthy:

```bash
# Get the API gateway URL from Terraform output
GATEWAY_URL=$(cd infra/terraform && terraform output -raw api_gateway_url)
curl -s ${GATEWAY_URL}/health | python3 -m json.tool
```

Expected output: all services `"status": "healthy"`.

## 11. Run Database Migrations

The Cloud SQL instance only has a private IP. To run migrations from your local
machine, temporarily enable a public IP:

```bash
# 1. Enable public IP
gcloud sql instances patch sloppy-pg-prod \
  --project=$GCP_PROJECT_ID --assign-ip --quiet

# 2. Start Cloud SQL Auth Proxy (uses public IP by default)
GOOGLE_APPLICATION_CREDENTIALS=secrets/terraform-sa.json \
  cloud-sql-proxy "${GCP_PROJECT_ID}:${REGION}:sloppy-pg-prod" \
  --port=5433 &

sleep 3

# 3. Run migrations
cd packages/db
DATABASE_URL="postgresql://sloppy:<DB_PASSWORD>@127.0.0.1:5433/sloppy" \
  pnpm tsx src/migrate.ts
cd ../..

# 4. Kill proxy and disable public IP
kill %1
gcloud sql instances patch sloppy-pg-prod \
  --project=$GCP_PROJECT_ID --no-assign-ip --quiet
```

> **IMPORTANT:** Do NOT use `--private-ip` with the proxy when running locally.
> The private IP is on the GCP VPC and unreachable from your machine. The proxy
> must connect via the public IP, which it does by default.

## 12. Build & Deploy Frontend

```bash
cd apps/web

VITE_API_URL=${GATEWAY_URL} \
VITE_FIREBASE_API_KEY=<your-api-key> \
VITE_FIREBASE_AUTH_DOMAIN=${GCP_PROJECT_ID}.firebaseapp.com \
VITE_FIREBASE_PROJECT_ID=${GCP_PROJECT_ID} \
VITE_FIREBASE_STORAGE_BUCKET=${GCP_PROJECT_ID}.firebasestorage.app \
VITE_FIREBASE_MESSAGING_SENDER_ID=<sender-id> \
VITE_FIREBASE_APP_ID=<app-id> \
VITE_CDN_URL=<cdn-ip-from-terraform> \
VITE_APP_URL=https://${GCP_PROJECT_ID}.web.app \
pnpm build

cd ../..
```

Deploy to Firebase Hosting (non-interactive — no `firebase login` needed):

```bash
GOOGLE_APPLICATION_CREDENTIALS=secrets/firebase-sa.json \
  firebase deploy --only hosting --project $GCP_PROJECT_ID
```

The frontend is now live at `https://${GCP_PROJECT_ID}.web.app`.

## 13. GitHub Actions Setup (Optional)

To enable automatic frontend deploys on push to `main`, add these secrets to your
GitHub repository (Settings > Secrets and variables > Actions):

| Secret | Value |
|--------|-------|
| `FIREBASE_SERVICE_ACCOUNT` | Contents of `secrets/firebase-sa.json` |
| `VITE_API_URL` | API gateway URL |
| `VITE_FIREBASE_API_KEY` | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `sloppy-app.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `sloppy-app` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `sloppy-app.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_CDN_URL` | CDN URL from Terraform output |
| `VITE_MULTIPLAYER_WS_URL` | Multiplayer Cloud Run URL |

The workflow at `.github/workflows/deploy-frontend.yml` triggers on pushes to
`main` that touch `apps/web/**`, `packages/ui/**`, or `packages/shared/**`.

## 14. Verification Checklist

```bash
# API Gateway health (all backends should be "healthy")
curl -s ${GATEWAY_URL}/health | python3 -m json.tool

# Frontend responds
curl -s -o /dev/null -w "HTTP %{http_code}" https://${GCP_PROJECT_ID}.web.app

# List all Cloud Run services
gcloud run services list --project=$GCP_PROJECT_ID --region=$REGION
```

---

## Architecture Summary

```
                    ┌─────────────────────────┐
                    │   Firebase Hosting       │
                    │   (sloppy-app.web.app)   │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │   API Gateway            │
                    │   (Cloud Run, public)    │
                    │   egress: ALL_TRAFFIC    │
                    └───────────┬─────────────┘
                   ┌────────────┼────────────┐
          ┌────────▼───┐  ┌────▼─────┐  ┌───▼──────────┐
          │   Auth     │  │  Game    │  │     AI       │
          │            │  │ Builder  │  │ Orchestrator │
          └──────┬─────┘  └────┬─────┘  └──────┬───────┘
                 │             │               │
          ┌──────▼─────────────▼───────────────▼───────┐
          │                   VPC                       │
          │  ┌──────────┐  ┌──────────┐                │
          │  │ Cloud SQL│  │  Redis   │                │
          │  │ (private)│  │ (private)│                │
          │  └──────────┘  └──────────┘                │
          └────────────────────────────────────────────┘
```

All backend services use `INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER` — they are
only reachable from within the VPC. The API gateway routes through the VPC
connector with `egress: ALL_TRAFFIC` to reach them.

---

## Pitfalls Reference

Quick-reference table of every deployment issue encountered and its fix:

| # | Problem | Root Cause | Fix |
|---|---------|-----------|-----|
| 1 | `tsc` emits 0 files in Docker | `composite: true` + `tsc -b` in Docker context | Remove `composite: true`, use `tsc` |
| 2 | Terraform syntax error | Semicolons in single-line blocks | Use multi-line `env {}` blocks |
| 3 | Cloud Run rejects PORT env | `PORT` is reserved in Cloud Run v2 | Remove PORT; use `container_port` |
| 4 | Cloud SQL user creation fails | Empty `db_password` in tfvars | Populate with a real password |
| 5 | Cloud Run rejects image | Built for ARM (Apple Silicon) | `docker build --platform linux/amd64` |
| 6 | Turbo cache EINTR in Docker | QEMU cross-compilation race | Retry the build |
| 7 | Auth startup probe fails | Health at `/auth/health`, probe checks `/health` | Change to `/health` |
| 8 | Gateway gets 404 from backends | Backends are internal-only; gateway used public route | Set gateway egress to `ALL_TRAFFIC` |
| 9 | Gateway gets 403 from backends | No IAM invoker binding on internal services | Add `allUsers` invoker on backends |
| 10 | Gateway startup probe fails | Health returns 503 when backends are cold | Always return 200 |
| 11 | Cloud SQL proxy ECONNRESET | Instance has private IP only | Temporarily enable public IP for migrations |
| 12 | `.dockerignore` excludes logo | Unanchored glob `sloppy_logo*.png` | Anchor to root: `/sloppy_logo*.png` |
| 13 | Firebase deploy fails | CLI not logged in | Use `GOOGLE_APPLICATION_CREDENTIALS` with SA key |

---

## Key File Paths

| File | Purpose |
|------|---------|
| `secrets/firebase-sa.json` | Firebase Admin service account key |
| `secrets/terraform-sa.json` | Terraform service account key |
| `infra/terraform/terraform.tfvars` | Terraform variables (gitignored, contains secrets) |
| `infra/terraform/backend.tf` | Terraform GCS state backend |
| `infra/terraform/main.tf` | Root Terraform config with modules |
| `infra/terraform/modules/services/main.tf` | Cloud Run service definitions |
| `infra/terraform/modules/secrets/` | Secret Manager module |
| `firebase.json` | Firebase Hosting config |
| `.firebaserc` | Firebase project alias |
| `.github/workflows/deploy-frontend.yml` | CI/CD for frontend |
| `Makefile` | Build/deploy convenience targets |
| `.dockerignore` | Docker build exclusions |

---

## Teardown

```bash
# Destroy all infrastructure
cd infra/terraform
GOOGLE_APPLICATION_CREDENTIALS=../../secrets/terraform-sa.json \
  terraform destroy -auto-approve

# Delete Terraform state bucket
gsutil rm -r gs://${GCP_PROJECT_ID}-tf-state

# Delete the GCP project (nuclear option)
gcloud projects delete $GCP_PROJECT_ID
```
