# Sloppy — Services & Configuration Setup Guide

Everything you need to sign up for, configure, and wire together before running
Sloppy locally or deploying to production.

---

## Table of Contents

1. [Required External Services](#1-required-external-services)
2. [Optional External Services](#2-optional-external-services)
3. [Local Development Prerequisites](#3-local-development-prerequisites)
4. [Production Prerequisites](#4-production-prerequisites)
5. [Step-by-Step Service Setup](#5-step-by-step-service-setup)
6. [Environment Variable Reference](#6-environment-variable-reference)
7. [Secrets & Files Checklist](#7-secrets--files-checklist)
8. [Quick Start](#8-quick-start)

---

## 1. Required External Services

| Service | Purpose | Sign-up URL | What You Need |
|---------|---------|-------------|---------------|
| **Google Cloud Platform** | Hosting, database, storage, auth | https://console.cloud.google.com | Project with billing enabled |
| **Firebase** (part of GCP) | Authentication (email + anonymous), frontend hosting | https://console.firebase.google.com | Web app config, service account key |
| **OpenAI** | Primary LLM for game code generation | https://platform.openai.com/api-keys | API key (`sk-...`) |
| **Anthropic** | Secondary LLM (Claude) | https://console.anthropic.com | API key (`sk-ant-...`) |
| **xAI (Grok)** | Tertiary LLM | https://console.x.ai | API key (`xai-...`) |

## 2. Optional External Services

| Service | Purpose | Effort to Activate | Sign-up URL |
|---------|---------|-------------------|-------------|
| **fal.ai** | AI thumbnail generation (FLUX) | Add key, done | https://fal.ai/dashboard/keys |
| **Sentry** | Error tracking (official SDK) | Add DSN, done | https://sentry.io/signup |
| **Stripe** | Subscriptions + creator payouts | ~15 min dashboard setup | https://dashboard.stripe.com/register |
| **Google AdSense** | Ad monetization | Days (approval required) | https://adsense.google.com |

---

## 3. Local Development Prerequisites

Install these tools before running `./dev.sh`:

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 22+ | `brew install node` |
| pnpm | 9.x | `corepack enable` |
| Docker Desktop | 29+ | https://docker.com |
| gcloud CLI | latest | `brew install google-cloud-sdk` |

Docker Compose provides PostgreSQL and Redis locally — no manual setup needed.

### Optional local tools

| Tool | Purpose | Install |
|------|---------|---------|
| Stripe CLI | Forward webhooks to localhost | `brew install stripe/stripe-cli/stripe` |

## 4. Production Prerequisites

Everything from local, plus:

| Tool | Version | Install |
|------|---------|---------|
| Terraform | >= 1.5 | `brew install terraform` |
| Firebase CLI | 14+ | `npm install -g firebase-tools` |
| cloud-sql-proxy | latest | `brew install cloud-sql-proxy` |

---

## 5. Step-by-Step Service Setup

### 5a. Google Cloud Platform

1. Go to https://console.cloud.google.com
2. Create a new project (or use existing). Note the **Project ID**.
3. Enable billing on the project.
4. Authenticate locally:
   ```bash
   gcloud auth login
   gcloud config set project <YOUR_PROJECT_ID>
   ```

### 5b. Firebase

1. Go to https://console.firebase.google.com
2. Add Firebase to your GCP project (or create new)
3. Create a **Web App** — note the config values:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`
4. Enable **Authentication** providers:
   - Go to Authentication → Sign-in method
   - Enable **Email/Password**
   - Enable **Anonymous**
5. If using a custom domain, add it to **Authentication → Settings → Authorized domains**
6. Generate a **service account key**:
   ```bash
   gcloud iam service-accounts create firebase-admin \
     --display-name="Firebase Admin SA"

   gcloud projects add-iam-policy-binding <YOUR_PROJECT_ID> \
     --member="serviceAccount:firebase-admin@<YOUR_PROJECT_ID>.iam.gserviceaccount.com" \
     --role="roles/firebase.admin"

   mkdir -p secrets
   gcloud iam service-accounts keys create secrets/firebase-sa.json \
     --iam-account="firebase-admin@<YOUR_PROJECT_ID>.iam.gserviceaccount.com"
   ```

### 5c. Google Cloud Storage

Create a bucket for game bundles:

```bash
gcloud storage buckets create gs://sloppy-game-bundles-dev \
  --location=us-central1 \
  --uniform-bucket-level-access

gcloud storage buckets add-iam-policy-binding gs://sloppy-game-bundles-dev \
  --member=allUsers \
  --role=roles/storage.objectViewer
```

### 5d. OpenAI

1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Recommended model: `gpt-4o`
4. Set a usage limit to avoid surprise bills

### 5e. Anthropic

1. Go to https://console.anthropic.com
2. Create an API key
3. Recommended model: `claude-sonnet-4-20250514`

### 5f. xAI (Grok)

1. Go to https://console.x.ai
2. Create an API key
3. Recommended model: `grok-3`

### 5g. fal.ai (Thumbnail Generation)

**Effort: add key, done.**

1. Go to https://fal.ai/dashboard/keys
2. Create an API key
3. Set `FAL_KEY=<your-key>` in `.env`

Thumbnails are auto-generated during game creation (FLUX schnell model) and
can be regenerated per-game from the My Games page (FLUX dev model for higher
quality). If `FAL_KEY` is unset, the system falls back to screenshot-based
thumbnails.

### 5h. Sentry (Error Tracking)

**Effort: add DSN, done.**

The official Sentry SDK is fully integrated (`@sentry/node` for backends,
`@sentry/react` for frontend).

1. Go to https://sentry.io/signup
2. Create **two projects**:
   - **Node.js** project (for all backend services)
   - **React** project (for the frontend)
3. Copy the DSN strings and set:
   - `SENTRY_DSN=<node-dsn>` — used by all backend services
   - `VITE_SENTRY_DSN=<react-dsn>` — used by the frontend

What gets reported automatically:
- Backend: 5xx responses, uncaught exceptions, unhandled promise rejections
- Frontend: React component errors (ErrorBoundary), `window.onerror`, `unhandledrejection`
- Game crashes: runtime errors from generated games are forwarded to Sentry with game context
- All events include release version, environment, request context, and user ID

### 5i. Stripe (Payments, Subscriptions, Creator Payouts)

**Effort: ~15 min of Stripe dashboard setup + Stripe CLI for local webhooks.**

#### Step 1: Create account & get API keys

1. Go to https://dashboard.stripe.com/register
2. Use **test mode** while developing (toggle in top-right)
3. Go to **Developers → API keys**:
   - Copy **Secret key** → `STRIPE_SECRET_KEY=sk_test_...`
   - Copy **Publishable key** → `STRIPE_PUBLISHABLE_KEY=pk_test_...`

#### Step 2: Create a subscription product

1. Go to **Products → Add Product**
2. Name: "Creator Plan" (or whatever you want)
3. Pricing: **Recurring**, $5/month
4. Save and copy the **Price ID** → `STRIPE_PRICE_ID=price_...`

#### Step 3: Set up webhooks

**For production:**

1. Go to **Developers → Webhooks → Add endpoint**
2. URL: `https://your-domain.com/payments/webhooks/stripe`
3. Events to listen for:
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `account.updated` (for Stripe Connect)
4. Copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET=whsec_...`

**For local development:**

Stripe can't reach `localhost`. Install the Stripe CLI and forward webhooks:

```bash
brew install stripe/stripe-cli/stripe
stripe login
stripe listen --forward-to localhost:3001/payments/webhooks/stripe
```

The CLI prints a temporary webhook secret — use that as `STRIPE_WEBHOOK_SECRET`
in your `.env` while developing locally.

#### Step 4: Enable Stripe Connect (creator payouts)

1. Go to **Settings → Connect**
2. Enable Express accounts
3. No separate secret needed — uses the main `STRIPE_SECRET_KEY`

#### Step 5: Revenue reconciliation

Ad revenue accumulates in the `ad_impressions` table. To move it into
`creator_earnings` (so creators can withdraw), you need to run reconciliation
periodically:

```bash
# Call the reconciliation endpoint (defaults to previous month)
curl -X POST https://your-api/payments/reconcile \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json"

# Or specify a month
curl -X POST https://your-api/payments/reconcile \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"month": "2026-02"}'
```

For production, set up a monthly cron job (e.g., Cloud Scheduler) to call
`POST /payments/reconcile` on the 1st of each month.

### 5j. Google AdSense (Ad Monetization)

**Effort: days (Google must approve your site).**

The `AdSlot` component dynamically loads the AdSense script and calls
`adsbygoogle.push()` when configured. Until then, styled placeholder ads
are shown in the layout.

#### Step 1: Apply for AdSense

1. Go to https://adsense.google.com
2. Submit your site for review
3. Google reviews for content quality and traffic — **this takes days to weeks**

#### Step 2: Add `ads.txt` to your web root

Google requires an `ads.txt` file for verification. After approval, AdSense
will give you the line to add.

Create `apps/web/public/ads.txt`:
```
google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
```

Replace `pub-XXXXXXXXXXXXXXXX` with your publisher ID from AdSense.

#### Step 3: Create ad units

In the AdSense dashboard, create ad units for each format:

| Format | Recommended Size | Env Var |
|--------|-----------------|---------|
| Leaderboard | 728x90 | `VITE_ADSENSE_SLOT_LEADERBOARD` |
| Rectangle | 300x250 | `VITE_ADSENSE_SLOT_RECTANGLE` |
| Mobile Banner | 320x50 | `VITE_ADSENSE_SLOT_MOBILE` |
| Interstitial | 320x480 | `VITE_ADSENSE_SLOT_INTERSTITIAL` |
| Rewarded Video | 320x480 | `VITE_ADSENSE_SLOT_REWARDED` |

Each ad unit gives you a slot ID. If you only create one ad unit, set
`VITE_ADSENSE_SLOT_ID` as a fallback for all formats.

#### Step 4: Configure env vars

```bash
VITE_AD_PROVIDER=adsense
VITE_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXXXXXXXX
VITE_ADSENSE_SLOT_LEADERBOARD=1234567890
VITE_ADSENSE_SLOT_RECTANGLE=2345678901
VITE_ADSENSE_SLOT_MOBILE=3456789012
# etc.
```

The AdSense script is loaded dynamically only when `VITE_AD_PROVIDER=adsense`
and `VITE_ADSENSE_CLIENT_ID` is set. No script is injected otherwise.

#### Ad placement

Ads are already placed on these pages:

| Page | Format(s) |
|------|-----------|
| Home | Leaderboard (desktop), Mobile Banner (mobile), Rectangle (bottom) |
| Explore | Rectangle (sidebar) |
| Feed | Interstitial (between games) |
| Game | Rectangle (sidebar, with gameId + creatorId for revenue attribution) |

---

## 6. Environment Variable Reference

### Root `.env` — Complete Reference

Copy `.env.example` to `.env` and fill in values. The root `.env` is used by
both `./dev.sh` (local development) and `./deploy.sh` (production deployment).

```bash
# ============================================================================
# GCP / Firebase
# ============================================================================
GCP_PROJECT_ID=<your-gcp-project-id>
FIREBASE_PROJECT_ID=<your-firebase-project-id>
CUSTOM_DOMAIN=<your-domain.com>                    # e.g. sloppygames.io
GOOGLE_APPLICATION_CREDENTIALS=./secrets/firebase-sa.json

# ============================================================================
# Database
# ============================================================================
DATABASE_URL=postgresql://sloppy:sloppy_dev@localhost:5432/sloppy
DB_PASSWORD=<strong-production-password>           # Production only

# ============================================================================
# Redis
# ============================================================================
REDIS_URL=redis://localhost:6379

# ============================================================================
# API Gateway — Downstream Service URLs
# ============================================================================
CORS_ORIGIN=http://localhost:5173
AUTH_SERVICE_URL=http://localhost:3002
GAME_BUILDER_URL=http://localhost:3003
AI_ORCHESTRATOR_URL=http://localhost:3004
MULTIPLAYER_URL=http://localhost:3005

# ============================================================================
# LLM / AI  (at least one provider required)
# ============================================================================
LLM_PROVIDER=openai                               # openai | anthropic | grok
OPENAI_API_KEY=<sk-your-openai-key>
OPENAI_MODEL=gpt-4o
ANTHROPIC_API_KEY=<sk-ant-your-anthropic-key>
ANTHROPIC_MODEL=claude-sonnet-4-20250514
GROK_API_KEY=<xai-your-grok-key>
GROK_MODEL=grok-3

# ============================================================================
# Google Cloud Storage
# ============================================================================
GCS_BUCKET=sloppy-game-bundles-dev
CDN_BASE_URL=https://storage.googleapis.com/sloppy-game-bundles-dev

# ============================================================================
# Stripe (payments service)
# ============================================================================
STRIPE_SECRET_KEY=<sk_test_...>                    # Stripe secret key
STRIPE_PUBLISHABLE_KEY=<pk_test_...>               # Stripe publishable key
STRIPE_WEBHOOK_SECRET=<whsec_...>                  # Webhook signing secret
STRIPE_PRICE_ID=<price_...>                        # Subscription price ID
PAYOUT_MINIMUM_THRESHOLD=60                        # Min balance for payout ($)

# ============================================================================
# Thumbnail Generation (fal.ai)
# ============================================================================
FAL_KEY=<your-fal-ai-key>

# ============================================================================
# Observability (Sentry)
# ============================================================================
LOG_LEVEL=debug
SENTRY_DSN=<your-sentry-node-dsn>                 # Backend error tracking
VITE_SENTRY_DSN=<your-sentry-react-dsn>           # Frontend error tracking

# ============================================================================
# Frontend (Vite)
# ============================================================================
VITE_API_URL=http://localhost:3001
VITE_FIREBASE_API_KEY=<firebase-api-key>
VITE_FIREBASE_AUTH_DOMAIN=<project-id>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<project-id>
VITE_FIREBASE_STORAGE_BUCKET=<project-id>.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=<sender-id>
VITE_FIREBASE_APP_ID=<app-id>
VITE_CDN_URL=https://storage.googleapis.com/sloppy-game-bundles-dev

# ============================================================================
# Ads (AdSense)
# ============================================================================
VITE_AD_PROVIDER=placeholder                       # placeholder | adinplay | adsense
VITE_ADSENSE_CLIENT_ID=<ca-pub-XXXXX>             # AdSense publisher ID
VITE_ADSENSE_SLOT_ID=                              # Fallback slot for all formats
VITE_ADSENSE_SLOT_LEADERBOARD=                     # 728x90 slot ID
VITE_ADSENSE_SLOT_RECTANGLE=                       # 300x250 slot ID
VITE_ADSENSE_SLOT_MOBILE=                          # 320x50 slot ID
VITE_ADSENSE_SLOT_INTERSTITIAL=                    # 320x480 slot ID
VITE_ADSENSE_SLOT_REWARDED=                        # Rewarded video slot ID

# ============================================================================
# Rate Limits (api-gateway)
# ============================================================================
RATE_LIMIT_GENERAL_AUTH_RPM=100
RATE_LIMIT_GENERAL_UNAUTH_RPM=30
RATE_LIMIT_GENERATION_PER_HOUR=5

# ============================================================================
# AI Generation Limits
# ============================================================================
GENERATION_TIMEOUT_MS=120000
MAX_TOKENS_CONCEPT=2000
MAX_TOKENS_CODE=8000
MAX_TOKENS_ASSETS=2000
MAX_TOKENS_MULTIPLAYER=4000
DAILY_COST_THRESHOLD=50

# ============================================================================
# Game Builder
# ============================================================================
MAX_BUNDLE_SIZE_BYTES=5242880                      # 5MB
PLAY_DEBOUNCE_WINDOW_SECONDS=300

# ============================================================================
# Multiplayer
# ============================================================================
MAX_CONCURRENT_SESSIONS=100
MAX_PLAYERS_PER_SESSION=4
TICK_RATE=20
WS_HEARTBEAT_INTERVAL=30000
WS_HEARTBEAT_TIMEOUT=10000
CLEANUP_INTERVAL=300000
EMPTY_ROOM_TIMEOUT=60000
REDIS_KEY_TTL=3600
```

### Where Each Variable Is Used

| Variable | Services |
|----------|----------|
| `DATABASE_URL` | auth, game-builder, ai-orchestrator, multiplayer, payments |
| `REDIS_URL` | api-gateway, game-builder, ai-orchestrator, multiplayer |
| `GOOGLE_APPLICATION_CREDENTIALS` | api-gateway, auth, game-builder, multiplayer |
| `OPENAI_API_KEY` | ai-orchestrator |
| `ANTHROPIC_API_KEY` | ai-orchestrator |
| `GROK_API_KEY` | ai-orchestrator |
| `GCS_BUCKET` / `CDN_BASE_URL` | game-builder |
| `STRIPE_*` | payments |
| `FAL_KEY` | game-builder (thumbnails) |
| `SENTRY_DSN` | all backend services |
| `VITE_SENTRY_DSN` | web frontend |
| `VITE_ADSENSE_*` | web frontend (ad slots) |
| `VITE_FIREBASE_*` | web frontend (build-time) |
| `FIREBASE_PROJECT_ID` | api-gateway, auth |

---

## 7. Secrets & Files Checklist

### Files You Must Create

| File | How to Create | Gitignored? |
|------|---------------|-------------|
| `.env` | Copy `.env.example`, fill in values | Yes |
| `secrets/firebase-sa.json` | Download from GCP Console or `gcloud` (see 5b) | Yes |
| `secrets/terraform-sa.json` | Only for production deploy (see DEPLOY.md) | Yes |
| `infra/terraform/terraform.tfvars` | Auto-generated by `deploy.sh` from `.env` | Yes |
| `apps/web/public/ads.txt` | From AdSense dashboard after approval (see 5j) | No |

### Security Rules

- **Never commit** `.env`, `secrets/`, or `terraform.tfvars`
- In production, all secrets are stored in **GCP Secret Manager** (provisioned by Terraform)
- API keys in `.env` are loaded by `docker-compose` and `dev.sh` for local development only
- The `deploy.sh` script reads `.env` and writes secrets into Terraform variables and GCP Secret Manager

---

## 8. Quick Start

### Local Development

```bash
# 1. Clone the repo
git clone <repo-url> && cd sloppy

# 2. Copy env template and fill in your keys
cp .env.example .env
# Edit .env — at minimum set:
#   - OPENAI_API_KEY (or another LLM provider)
#   - VITE_FIREBASE_* values (all 6)
#   - GCP_PROJECT_ID / FIREBASE_PROJECT_ID
#   - GOOGLE_APPLICATION_CREDENTIALS (path to Firebase SA key)

# 3. Place your Firebase service account key
mkdir -p secrets
# Copy your downloaded firebase-sa.json into secrets/

# 4. Start everything
chmod +x dev.sh
./dev.sh

# Frontend:  http://localhost:5173
# API:       http://localhost:3001
# Postgres:  localhost:5432
# Redis:     localhost:6379
```

#### Optional: Local Stripe webhook forwarding

```bash
# In a separate terminal (requires Stripe CLI)
stripe listen --forward-to localhost:3001/payments/webhooks/stripe
# Use the printed webhook secret as STRIPE_WEBHOOK_SECRET in .env
```

### Production Deployment

```bash
# 1. Ensure .env has ALL required values filled in
#    (especially DB_PASSWORD, all LLM keys, Firebase config, Stripe keys)

# 2. Run the deploy script
chmod +x deploy.sh
./deploy.sh

# Or deploy specific parts:
./deploy.sh --skip-infra       # Skip GCP project setup
./deploy.sh --images-only      # Rebuild Docker images only
./deploy.sh --frontend-only    # Frontend only
./deploy.sh --migrate-only     # Database migrations only
./deploy.sh --verify           # Health check
```

### Post-deploy: set up recurring reconciliation

For creator earnings to be withdrawable, monthly ad revenue reconciliation
must run. Set up a Cloud Scheduler job:

```bash
gcloud scheduler jobs create http sloppy-monthly-reconcile \
  --schedule="0 2 1 * *" \
  --uri="https://your-api-gateway/payments/reconcile" \
  --http-method=POST \
  --headers="Authorization=Bearer <service-account-token>" \
  --time-zone="UTC" \
  --description="Reconcile monthly ad revenue for creator payouts"
```

---

## Service Architecture & Ports

```
Port  Service           Requires
----  ----------------  ------------------------------------------
5432  PostgreSQL        Docker (local) / Cloud SQL (prod)
6379  Redis             Docker (local) / Memorystore (prod)
3001  API Gateway       Redis, Firebase SA
3002  Auth              PostgreSQL, Firebase SA
3003  Game Builder      PostgreSQL, Redis, GCS, Firebase SA, [fal.ai]
3004  AI Orchestrator   PostgreSQL, Redis, LLM keys
3005  Multiplayer       PostgreSQL, Redis, Firebase SA
3006  Payments          PostgreSQL, [Stripe keys]
5173  Frontend (Vite)   Firebase config (build-time)
```

---

## Minimum Viable Setup

If you want to get running with the absolute minimum configuration:

1. **Firebase project** — needed for auth (can't skip)
2. **One LLM key** — OpenAI is the default; set `LLM_PROVIDER=openai` and `OPENAI_API_KEY`
3. **GCS bucket** — needed for game bundle storage
4. **Firebase SA key** — needed for token verification

Everything else is optional and the platform will run without them:

| Service | If Missing | Impact |
|---------|-----------|--------|
| Stripe | Payments service starts but Stripe calls fail | No subscriptions or payouts |
| fal.ai | Falls back to screenshot-based thumbnails | Lower quality thumbnails |
| Sentry | No error reporting | Errors only in console logs |
| AdSense | Placeholder ads shown | No ad revenue |
| Anthropic/Grok | Only the configured LLM provider is used | No fallback if primary is down |
