# Sloppy Production Deployment - Continuation Context

## Current State Summary

A production deployment to GCP is **partially complete**. The GCP project and infrastructure are provisioned, but Docker images need to be built and pushed, Cloud Run services need working images, and Firebase Hosting hasn't been deployed yet.

## What's DONE

### 1. GCP Project Created
- **Project ID:** `sloppy-app`
- **Project Number:** `716389716446`
- **Billing:** linked to `01A3B2-01F325-1180FE`
- **APIs enabled:** run, sqladmin, redis, storage, artifactregistry, cloudbuild, secretmanager, vpcaccess, servicenetworking, compute, firebase, firebasehosting, identitytoolkit

### 2. Firebase Setup
- Firebase added to project via REST API
- **Web App ID:** `1:716389716446:web:c96f63703b0f56c7bf8d4f`
- **Firebase Config:**
  - apiKey: `AIzaSyBjWo66qO_VUZLblJ4Fr_ZpSW0qu_kYzSQ`
  - authDomain: `sloppy-app.firebaseapp.com`
  - projectId: `sloppy-app`
  - storageBucket: `sloppy-app.firebasestorage.app`
  - messagingSenderId: `716389716446`
  - appId: `1:716389716446:web:c96f63703b0f56c7bf8d4f`
- **Firebase Auth:** NOT yet configured (needs email/password and anonymous providers enabled via Firebase Console at https://console.firebase.google.com/project/sloppy-app/authentication/providers)
- **Firebase CLI:** NOT logged in (needs `firebase login` in an interactive terminal)

### 3. Service Accounts Created
- `firebase-admin@sloppy-app.iam.gserviceaccount.com` — key at `secrets/firebase-sa.json`
- `terraform@sloppy-app.iam.gserviceaccount.com` — key at `secrets/terraform-sa.json` (roles: editor, iam.securityAdmin, secretmanager.admin, servicenetworking.networksAdmin, storage.objectAdmin on tf-state bucket)
- `sloppy-run-prod@sloppy-app.iam.gserviceaccount.com` — Cloud Run service account (created by Terraform)

### 4. Infrastructure Provisioned via Terraform
All infrastructure is created and in Terraform state (`gs://sloppy-app-tf-state`):
- **VPC:** `sloppy-vpc-prod` with subnet, VPC connector `sloppy-vpc-cx-prod`, private service networking
- **Cloud SQL:** PostgreSQL instance `sloppy-pg-prod` (db-f1-micro), database `sloppy`, user `sloppy` with password `SloppyProd2026!`
  - **Connection string:** `postgresql://sloppy:SloppyProd2026!@10.219.1.2:5432/sloppy`
  - **Instance connection name:** `sloppy-app:us-east1:sloppy-pg-prod`
- **Redis:** Memorystore `sloppy-redis-prod`, URL: `redis://10.219.0.3:6379`
- **GCS:** Bucket `sloppy-game-bundles-prod` with CDN at `http://34.160.254.64`
- **Artifact Registry:** `sloppy-prod` at `us-east1-docker.pkg.dev/sloppy-app/sloppy-prod`
- **Secret Manager:** 5 secrets created (db-connection-url, firebase-credentials, openai-api-key, anthropic-api-key, grok-api-key) with IAM for Cloud Run SA
- **Cloud Run:** 4 backend services created but ALL FAILING because Docker images don't exist yet:
  - `sloppy-auth-prod`
  - `sloppy-ai-orchestrator-prod`
  - `sloppy-game-builder-prod`
  - `sloppy-multiplayer-prod`
  - (API Gateway was NOT created by terraform yet — it depends on the 4 backend services being created first)

### 5. Files Created/Modified
- `firebase.json` — Firebase Hosting config (public: `apps/web/dist`, SPA rewrites, cache headers)
- `.firebaserc` — default project `sloppy-app`
- `.github/workflows/deploy-frontend.yml` — GitHub Actions workflow for frontend auto-deploy on push to main
- `Makefile` — updated with `GCP_PROJECT_ID=sloppy-app`, `REGION=us-east1`, `deploy-frontend` target
- `infra/terraform/modules/secrets/` — created (main.tf, variables.tf, outputs.tf)
- `infra/terraform/modules/services/main.tf` — removed Cloud Run web service, removed PORT env vars (reserved in Cloud Run v2), expanded env blocks to multi-line syntax
- `infra/terraform/backend.tf` — bucket changed to `sloppy-app-tf-state`
- `infra/terraform/variables.tf` — region default changed to `us-east1`
- `infra/terraform/outputs.tf` — replaced `web_url` with `firebase_hosting_url`
- `infra/terraform/main.tf` — added firebase/firebasehosting/identitytoolkit APIs
- `infra/terraform/terraform.tfvars` — created with all values (including sensitive ones; file is gitignored)
- `packages/shared/package.json` — build script changed to `tsc -b`
- `packages/db/package.json` — build script changed to `tsc -b`
- `packages/ui/package.json` — build script changed to `tsc -b`
- `packages/multiplayer-sdk/package.json` — build script changed to `tsc -b`
- `packages/runtime-sdk/package.json` — build script changed to `tsc -b`

### 6. Docker Images
- **Built locally:** Only `api-gateway:latest` (at `us-east1-docker.pkg.dev/sloppy-app/sloppy-prod/api-gateway:latest`)
- **NOT built:** auth, ai-orchestrator, game-builder, multiplayer
- **NOT pushed to Artifact Registry:** none pushed yet
- Docker auth configured for `us-east1-docker.pkg.dev`

---

## What STILL NEEDS TO BE DONE

### BLOCKER: Docker Build Failure for Backend Services

All backend services except `api-gateway` fail to build. The root cause:

**TypeScript `composite: true` packages produce no output files in Docker.**

When running `tsc` (or `tsc -b`) inside the Docker build for packages with `composite: true` in their tsconfig.json (`packages/shared`, `packages/db`, `packages/ui`, etc.), TypeScript exits with code 0 but emits ZERO files. The `--diagnostics` flag shows:
```
Emit time:       0.00s
I/O write:       0.00s
```

This happens only in the Docker context (node:22-alpine with TypeScript 5.9.3). The build works fine locally. The `tsc -b` change was attempted but same result.

**Possible fixes to try (not yet attempted):**
1. Remove `composite: true` from tsconfig.json of affected packages (shared, db, ui, multiplayer-sdk, runtime-sdk) since there are no project references
2. Pin TypeScript to an older version (e.g., 5.6.x) in the Docker build
3. Skip `turbo prune --docker` and use a simpler Dockerfile that copies the full workspace
4. Use `tsc --noEmit false` explicitly
5. Add `"noEmit": false` to the tsconfig compilerOptions explicitly
6. Use Cloud Build instead of local Docker builds

**The Dockerfiles follow this pattern (all 5 services are identical except the service name):**
```dockerfile
FROM node:22-alpine AS base
RUN corepack enable

FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@^2
COPY . .
RUN turbo prune @sloppy/<service-name> --docker

FROM base AS builder
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/tsconfig.json ./tsconfig.json
COPY --from=pruner /app/turbo.json ./turbo.json
RUN pnpm turbo build --filter=@sloppy/<service-name>...
RUN pnpm prune --prod

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 sloppy && \
    adduser --system --uid 1001 sloppy
COPY --from=builder --chown=sloppy:sloppy /app .
USER sloppy
EXPOSE <port>
CMD ["node", "services/<service-name>/dist/app.js"]
```

### Remaining Steps After Docker Fix

1. **Build & push all 5 Docker images** to `us-east1-docker.pkg.dev/sloppy-app/sloppy-prod/<service>:latest`
2. **Re-run `terraform apply`** to update Cloud Run services with the now-existing images (or use `gcloud run deploy` directly)
3. **Run database migrations** against production Cloud SQL (use Cloud SQL Auth Proxy or connect via VPC)
4. **Login to Firebase CLI** (`firebase login` in interactive terminal)
5. **Build frontend** with production env vars:
   ```
   VITE_API_URL=https://sloppy-api-gateway-prod-716389716446.us-east1.run.app
   VITE_FIREBASE_API_KEY=AIzaSyBjWo66qO_VUZLblJ4Fr_ZpSW0qu_kYzSQ
   VITE_FIREBASE_AUTH_DOMAIN=sloppy-app.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=sloppy-app
   VITE_FIREBASE_STORAGE_BUCKET=sloppy-app.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=716389716446
   VITE_FIREBASE_APP_ID=1:716389716446:web:c96f63703b0f56c7bf8d4f
   VITE_CDN_URL=http://34.160.254.64
   VITE_APP_URL=https://sloppy-app.web.app
   ```
6. **Deploy frontend** to Firebase Hosting (`firebase deploy --only hosting --project sloppy-app`)
7. **Set up GitHub secrets** for the deploy-frontend workflow
8. **Enable Firebase Auth providers** (email/password + anonymous) in Firebase Console
9. **Verify everything works end-to-end**

---

## Key File Paths

| File | Purpose |
|------|---------|
| `secrets/firebase-sa.json` | Firebase Admin SDK service account key |
| `secrets/terraform-sa.json` | Terraform service account key |
| `infra/terraform/terraform.tfvars` | Terraform variables with sensitive values |
| `infra/terraform/backend.tf` | Terraform GCS state backend config |
| `infra/terraform/main.tf` | Root Terraform config with all modules |
| `infra/terraform/modules/secrets/` | Secret Manager module |
| `infra/terraform/modules/services/main.tf` | Cloud Run services definition |
| `firebase.json` | Firebase Hosting configuration |
| `.firebaserc` | Firebase project alias |
| `.github/workflows/deploy-frontend.yml` | CI/CD for frontend |
| `Makefile` | Build/deploy commands |
| `.dockerignore` | Uses `/sloppy_logo*.png` to only exclude root logo |

## API Route Audit & Fixes (Completed)

A comprehensive audit revealed the frontend was using endpoint paths that did not match the API gateway and backend services. All mismatches have been corrected. The canonical route map is now:

### Gateway → Backend Route Map

| Gateway Path | Method | Downstream Service | Auth |
|---|---|---|---|
| `/health` | GET | api-gateway (direct) | — |
| `/auth/sync` | POST | auth | optionalAuth |
| `/auth/me` | GET | auth | optionalAuth |
| `/games/feed` | GET | game-builder | — |
| `/games/mine` | GET | game-builder | requireAuth (via requireUser) |
| `/games/:id` | GET | game-builder | — |
| `/games/:id/bundle` | GET | game-builder | — |
| `/games/:id/crash` | POST | game-builder | requireAuthForMutations |
| `/games` | POST | game-builder | requireAuthForMutations |
| `/games/:id` | PUT | game-builder | requireAuthForMutations |
| `/games/:id` | DELETE | game-builder | requireAuthForMutations |
| `/games/:id/publish` | POST | game-builder | requireAuthForMutations |
| `/games/:id/play` | POST | game-builder | — |
| `/favourites` | GET | game-builder | requireAuth |
| `/favourites/:gameId` | POST | game-builder | requireAuth |
| `/favourites/:gameId` | DELETE | game-builder | requireAuth |
| `/generate` | POST | ai-orchestrator | requireAuth + rate limit |
| `/generate/:sessionId/status` | GET (SSE) | ai-orchestrator | requireAuth |
| `/multiplayer/sessions` | POST | multiplayer | requireAuth |
| `/multiplayer/sessions/:id` | GET | multiplayer | requireAuth |
| `/multiplayer/sessions/:id/join` | POST | multiplayer | requireAuth |

### Fixes Applied

1. **Generation routes** (`apps/web/src/lib/api.ts`, `apps/web/src/stores/generation.ts`):
   - `POST /generation/start` → `POST /generate`
   - `GET /api/v1/generation/:id/stream` (SSE) → `GET /generate/:id/status`
   - Response field `generationId` → `sessionId`

2. **SSE authentication** (`packages/auth-middleware/src/middleware.ts`, `apps/web/src/stores/generation.ts`):
   - `EventSource` cannot send custom headers, so auth middleware now also accepts `?token=<firebase-id-token>` query parameter
   - Frontend passes Firebase ID token as query param when creating EventSource

3. **Crash reporter** (`apps/web/src/lib/crash-reporter.ts`):
   - `POST /api/v1/games/:id/crash` → `POST /games/:id/crash`

4. **Publish endpoint** (`apps/web/src/lib/api.ts`):
   - `PATCH /games/:id/status` → `POST /games/:id/publish`

5. **Save draft** (`apps/web/src/lib/api.ts`):
   - `PATCH /games/:id/status` → `GET /games/:id` (games are already created as drafts by the orchestrator; save is a confirmation)

6. **Favourites** (`apps/web/src/lib/api.ts`, `apps/web/src/stores/game.ts`):
   - Removed phantom `POST /favourites/toggle` (no backend endpoint)
   - `favouriteGame` now calls `POST /favourites/:gameId`
   - `unfavouriteGame` now calls `DELETE /favourites/:gameId`

7. **My games** (`apps/web/src/lib/api.ts`, `apps/web/src/stores/game.ts`):
   - `fetchMyGames` now calls `GET /games/mine` instead of `GET /games/feed`

8. **Multiplayer sessions** (`apps/web/src/lib/api.ts`):
   - `POST /sessions` → `POST /multiplayer/sessions`
   - `GET /sessions/:id` → `GET /multiplayer/sessions/:id`
   - `POST /sessions/:id/join` → `POST /multiplayer/sessions/:id/join`

9. **Play response type** (`apps/web/src/lib/api.ts`):
   - Response type corrected from `{ playCount: number }` to `{ counted: boolean }`

10. **Shared constants** (`packages/shared/src/constants/api-routes.ts`):
    - Removed phantom `/api/v1` prefix
    - All route constants now match the actual backend routes
    - Added missing routes: `GAME_FEED`, `GAME_MINE`, `GAME_PUBLISH`, `GAME_PLAY`, `GAME_BUNDLE`, `GAME_CRASH`, `FAVOURITE_BY_GAME`

### Gateway ↔ Downstream Communication Fixes (Second Pass)

A deep end-to-end trace of how the API gateway proxies to downstream services revealed 4 additional bugs:

11. **SSE proxy path doubling** (`services/api-gateway/src/proxy.ts`):
    - `app.get('/generate/:sessionId/status', ..., preservePath('/generate'), sseProxy)` was doubling the path
    - `app.get()` does NOT strip the mount prefix (unlike `app.use()`), so `req.url` is already the full path
    - `preservePath('/generate')` was prepending again → proxy sent `/generate/generate/:sessionId/status` to the orchestrator (404)
    - **Fix:** Removed `preservePath('/generate')` from the SSE route

12. **Play count & crash report blocked by auth** (`services/api-gateway/src/proxy.ts`):
    - `requireAuthForMutations` on the `/games` proxy blocked ALL non-GET requests
    - `POST /games/:id/play` should work without auth (backend uses `req.userId || req.ip`)
    - `POST /games/:id/crash` should be best-effort from any user
    - **Fix:** Added explicit `app.post('/games/:id/play')` and `app.post('/games/:id/crash')` routes BEFORE the auth-gated `/games` catch-all proxy

13. **Multiplayer session response format** (`services/multiplayer/src/routes/sessions.ts`):
    - Service returned raw objects (`res.json(session)`) but frontend expected `{ data: ... }` wrapper
    - Join endpoint returned `{ sessionId, gameId, maxPlayers, status }` with wrong field names — frontend expected full `MultiplayerSessionData` shape with `id`, `hostId`, `playerCount`, `createdAt`
    - **Fix:** All three endpoints now wrap responses in `{ data: ... }` and join returns the full session object

14. **WebSocket URL fallback** (`apps/web/src/stores/multiplayer.ts`):
    - Default WS URL derived from `VITE_API_URL` produced `ws://gateway:3001/multiplayer/ws`
    - The gateway does NOT proxy WebSocket upgrades (no `ws: true` in proxy config)
    - Even if it did, the WS server listens on `/ws`, not `/multiplayer/ws`
    - **Fix:** Fallback changed to `ws://localhost:3005/ws` (direct to multiplayer service)
    - **Production:** `VITE_MULTIPLAYER_WS_URL` MUST be set to the multiplayer Cloud Run URL + `/ws` path

### Updated Gateway Route Map

| Gateway Path | Method | Downstream Service Path | Auth | Notes |
|---|---|---|---|---|
| `/health` | GET | — (direct) | — | Aggregates downstream health |
| `/auth/*` | ALL | `/auth/*` | optionalAuth | Auth service verifies tokens itself |
| `/games/:id/play` | POST | `/games/:id/play` | — (public) | `app.post()` — no path rewrite |
| `/games/:id/crash` | POST | `/games/:id/crash` | — (public) | `app.post()` — no path rewrite |
| `/games/*` | ALL | `/games/*` | requireAuthForMutations | `app.use()` + `preservePath` |
| `/favourites/*` | ALL | `/favourites/*` | requireAuth | `app.use()` + `preservePath` |
| `/generate/:sessionId/status` | GET | `/generate/:sessionId/status` | requireAuth | SSE — `app.get()` no path rewrite |
| `/generate/*` | ALL | `/generate/*` | requireAuth + rate limit | `app.use()` + `preservePath` |
| `/multiplayer/*` | ALL | `/multiplayer/*` | requireAuth | `app.use()` + `preservePath` |

### Key Architecture Notes

- **`app.use(path, ...)`** strips the mount prefix from `req.url` — `preservePath` re-adds it for the proxy
- **`app.get(path, ...)`** / **`app.post(path, ...)`** do NOT strip the path — `preservePath` must NOT be used
- **WebSocket** connections go directly to the multiplayer service, not through the gateway
- **Auth forwarding**: Gateway runs `optionalAuth` globally, then forwards user context via `x-user-uid`, `x-user-email`, `x-user-display-name`, `x-user-anonymous` headers
- **Body limit**: Gateway parses JSON with 1MB limit; game-builder accepts 10MB. Game creation goes from orchestrator → game-builder internally (not through gateway), so this is not a blocker

## Important Notes

- The `secrets/` directory and `infra/terraform/terraform.tfvars` contain sensitive credentials. They should NOT be committed to git.
- The `PORT` environment variable is RESERVED in Cloud Run v2 — it's set automatically from `container_port`. All PORT env vars have been removed from Terraform.
- Terraform semicolons in single-line blocks (e.g., `env { name = "X"; value = "Y" }`) are NOT valid in Terraform 1.5 — all have been expanded to multi-line syntax.
- The `.dockerignore` excludes `infra` and `docs` directories from Docker context.
- The plan file is at `.cursor/plans/deploy_sloppy_to_production_520318db.plan.md` — do NOT edit it.
