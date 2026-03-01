# SLOPPY v1 — Sequenced Build Prompts

Each prompt below is designed to be used as a standalone conversation with an AI coding agent. They are ordered by dependency — each builds on what the previous ones produced. Every prompt contains the full system context needed so the agent understands the bigger picture, plus a tightly scoped build objective.

---

## How to Use This File

1. Run each prompt in order (Prompt 1 → 2 → 3 → ...)
2. Copy the entire prompt block into a fresh conversation
3. Validate the output before moving to the next prompt
4. Each prompt references what should already exist from prior steps

---

---

# PROMPT 1: Monorepo Foundation & Tooling

## Full System Context

Sloppy is an AI-powered browser game platform. Users generate games with natural language prompts. Games are instantly playable in the browser. The home page is a scrollable feed of playable games. Users can favourite games and create multiplayer sessions. The vibe is light, chaotic, playful — fun over polish.

**Tech stack overview:**
- Frontend: React (Vite), Zustand, TailwindCSS, Framer Motion, PixiJS/Phaser, Web Audio API, WebSockets
- Backend: Node.js services on Google Cloud Run
- Database: PostgreSQL
- Auth: Firebase Auth
- Multiplayer: WebSocket server + Redis
- AI: Orchestrator service calling LLM APIs
- Infrastructure: Google Cloud, Terraform
- Desktop: Electron wrapper loading the web build
- PWA enabled

**Monorepo structure:**
```
/sloppy
  /apps
    /web          — React (Vite) frontend
    /electron     — Electron wrapper
  /services
    /api-gateway       — Cloud Run API gateway
    /auth              — Auth service (Firebase)
    /ai-orchestrator   — AI prompt → game pipeline
    /game-builder      — Game validation, storage, sandboxing
    /multiplayer       — WebSocket server + room management
  /packages
    /runtime-sdk       — Game runtime contract/SDK
    /multiplayer-sdk   — Multiplayer client SDK
    /ui                — Shared UI components
    /shared            — Shared types, utils, constants
  /infra
    /terraform
  /docs
```

## Build Objective

Set up the monorepo skeleton with all workspace scaffolding. Do NOT implement any business logic — only structure, tooling, and configuration.

## Specific Deliverables

1. Initialize the monorepo using **pnpm workspaces** (or Turborepo if you prefer — justify the choice)
2. Create every directory in the structure above with placeholder `package.json` files
3. Configure TypeScript with a root `tsconfig.json` and per-package `tsconfig.json` files that extend it
4. Set up shared ESLint and Prettier configs at the root
5. For `/apps/web`: scaffold a Vite + React + TypeScript project with TailwindCSS and Framer Motion installed (no pages yet)
6. For each `/services/*`: scaffold a minimal Node.js + TypeScript project with Express (no routes yet, just `app.ts` with a health check endpoint)
7. For each `/packages/*`: scaffold a minimal TypeScript package with a barrel `index.ts` export
8. Add a root `Makefile` or `turbo.json` with commands: `dev`, `build`, `lint`, `test` (can be stubs)
9. Add a `.gitignore` covering node_modules, dist, .env, etc.
10. Add a root `README.md` with a brief project description and setup instructions

## Constraints

- Every package and service must be buildable from root with a single command
- TypeScript strict mode everywhere
- All inter-package imports must use workspace protocol (`workspace:*`)
- Do NOT install AI/LLM SDKs yet
- Do NOT set up any database connections yet
- Do NOT implement any UI components yet

---

---

# PROMPT 2: Shared Packages — Runtime SDK, Types & Constants

## Full System Context

Sloppy is an AI-powered browser game platform. Users generate games via natural language. Games run in sandboxed iframes. The platform has a scrollable feed of playable games, favourites, and optional multiplayer.

**The monorepo is already scaffolded** (from Prompt 1) with:
- `/apps/web` — Vite + React + TS + Tailwind
- `/services/*` — Express + TS skeletons (api-gateway, auth, ai-orchestrator, game-builder, multiplayer)
- `/packages/*` — TS package skeletons (runtime-sdk, multiplayer-sdk, ui, shared)
- pnpm workspaces, shared tsconfig, eslint, prettier

**Why this matters:** Every generated game must conform to a strict runtime contract. The backend validates against it. The frontend loads games through it. Multiplayer hooks into it. This is the foundational interface layer that everything depends on.

## Build Objective

Implement the shared packages that define the contracts, types, and utilities used across the entire system.

## Specific Deliverables

### `/packages/shared`
1. **Shared TypeScript types** used across frontend and backend:
   - `User` — `{ id: string; email: string; displayName?: string; createdAt: Date }`
   - `Game` — `{ id: string; creatorId: string; title: string; description: string; slug: string; supportsMultiplayer: boolean; version: number; status: 'draft' | 'published'; playCount: number; createdAt: Date; updatedAt: Date }`
   - `GameFeedItem` — `Game` extended with `{ isFavourited: boolean; creatorDisplayName: string }`
   - `Favourite` — `{ userId: string; gameId: string; createdAt: Date }`
   - `MultiplayerSession` — `{ id: string; gameId: string; hostId: string; status: 'waiting' | 'active' | 'closed'; playerCount: number; maxPlayers: number; createdAt: Date }`
   - `PlayerState` — `{ id: string; x: number; y: number; velocity: number; health: number; score: number; [key: string]: unknown }`
   - `GenerationRequest` — `{ prompt: string; userId: string; sessionId?: string }`
   - `GenerationPhase` — `'concept' | 'code' | 'assets' | 'multiplayer' | 'music'`
   - `GenerationStatus` — `{ phase: GenerationPhase; progress: number; message: string; error?: string }`
   - API request/response types for all endpoints (games CRUD, favourites, sessions, generation)
2. **Constants**: rate limit values, max game size, supported asset types, WebSocket event names, API route paths
3. **Utility functions**: slug generation, ID generation (nanoid), date formatting, validation helpers

### `/packages/runtime-sdk`
1. **The Sloppy Runtime SDK interface** — this is the contract every AI-generated game MUST implement:
```ts
interface SloppyGame {
  init(container: HTMLElement): void | Promise<void>;
  update(deltaTime: number): void;
  destroy(): void;
  supportsMultiplayer: boolean;
  // Multiplayer hooks (only required if supportsMultiplayer is true)
  getInitialState?(): Record<string, unknown>;
  applyPlayerInput?(playerId: string, input: unknown): void;
  updateState?(state: Record<string, unknown>): void;
  serializeState?(): Record<string, unknown>;
}
```
2. **Runtime validator** — a function that takes a game bundle (JS string or module) and checks:
   - All required methods exist
   - Method signatures are correct
   - If `supportsMultiplayer` is true, multiplayer hooks exist
   - No forbidden APIs used (eval, Function constructor, fetch to external domains)
3. **Runtime loader** — utility to load a game into a container element, start/stop the game loop, handle cleanup
4. **`config.json` schema** — TypeScript type + JSON schema for the per-game config:
```ts
interface GameConfig {
  title: string;
  version: string;
  supportsMultiplayer: boolean;
  maxPlayers?: number;
  assets: string[];
  audio?: string[];
}
```

### `/packages/multiplayer-sdk`
1. **Client-side multiplayer SDK** used by games to communicate with the multiplayer server:
   - `connect(sessionId: string, playerId: string): void`
   - `disconnect(): void`
   - `sendInput(input: unknown): void`
   - `onStateUpdate(callback: (state) => void): void`
   - `onPlayerJoin(callback: (playerId) => void): void`
   - `onPlayerLeave(callback: (playerId) => void): void`
2. Uses WebSocket under the hood
3. Handles reconnection logic with exponential backoff
4. Serialization/deserialization of state

## Constraints

- All packages must export from barrel `index.ts`
- All types must be fully documented with JSDoc
- No external API calls — these are pure TypeScript packages
- Runtime SDK must be framework-agnostic (no React, no DOM assumptions beyond receiving an HTMLElement container)
- Multiplayer SDK must work in both browser and iframe contexts

---

---

# PROMPT 3: Database Schema & Data Access Layer

## Full System Context

Sloppy is an AI-powered browser game platform with a scrollable feed of playable games, favourites, and multiplayer. The full tech stack is React + Vite frontend, Node.js backend services on Cloud Run, PostgreSQL database, Firebase Auth, Redis for multiplayer state, hosted on Google Cloud.

**Already built (Prompts 1-2):**
- Monorepo with pnpm workspaces, all packages and services scaffolded
- `/packages/shared` — all shared types (User, Game, Favourite, MultiplayerSession, PlayerState, etc.), constants, utilities
- `/packages/runtime-sdk` — game runtime contract, validator, loader
- `/packages/multiplayer-sdk` — client multiplayer SDK

**Database tables needed:**

| Table | Columns |
|-------|---------|
| users | id (PK), firebase_uid (unique), email, display_name, created_at |
| games | id (PK), creator_id (FK→users), title, description, slug (unique), supports_multiplayer, version, status (draft/published), play_count, storage_path, created_at, updated_at |
| favourites | user_id (FK→users), game_id (FK→games), created_at — composite PK |
| sessions | id (PK), game_id (FK→games), host_id (FK→users), status (waiting/active/closed), player_count, max_players, created_at, closed_at |

**Feed ranking needs:** The home feed sorts by a combination of recency, engagement score (play_count + favourite_count), and random injection for discovery.

## Build Objective

Create the database layer as a shared package that any backend service can import. This includes schema, migrations, and a typed data access layer.

## Specific Deliverables

1. Create `/packages/db` — a new shared package for database access
2. Use **Drizzle ORM** (or Prisma if you strongly prefer — justify the choice) with PostgreSQL
3. Define all table schemas matching the types in `/packages/shared`
4. Create migration files for initial schema
5. Implement a **repository pattern** with typed functions:
   - `UserRepository`: `create`, `findById`, `findByFirebaseUid`, `findByEmail`
   - `GameRepository`: `create`, `update`, `findById`, `findBySlug`, `findByCreator`, `getFeed(cursor, limit, sort)`, `incrementPlayCount`, `delete`
   - `FavouriteRepository`: `add`, `remove`, `findByUser(cursor, limit)`, `isFavourited(userId, gameId)`, `getFavouriteCount(gameId)`
   - `SessionRepository`: `create`, `findById`, `findActiveByGame`, `updateStatus`, `incrementPlayerCount`, `decrementPlayerCount`, `cleanupStale`
6. Feed query: implement `getFeed` with cursor-based pagination supporting sort modes: `recent`, `popular`, `random`
7. Add database connection pooling configuration
8. Add a `seed.ts` script that creates sample data (5 users, 20 games, some favourites)
9. Add a `migrate.ts` script for running migrations
10. Export everything from barrel `index.ts`

## Constraints

- Use cursor-based pagination (NOT offset-based) for all list queries
- All timestamps in UTC
- Connection pool size configurable via environment variable
- Must work with Cloud SQL Postgres on GCP
- Soft-delete pattern for games (add `deleted_at` column)
- Add database indexes for: `games.slug`, `games.creator_id`, `games.status + created_at`, `favourites.user_id`, `sessions.game_id + status`
- Repository functions must return types from `/packages/shared` (map DB rows to shared types)

---

---

# PROMPT 4: Auth Service

## Full System Context

Sloppy is an AI-powered browser game platform. Users generate games with natural language, play them in a scrollable feed, favourite games, and optionally play multiplayer.

**Already built (Prompts 1-3):**
- Monorepo scaffolded with all packages and services
- `/packages/shared` — shared types, constants, API types, utilities
- `/packages/runtime-sdk` — game runtime contract
- `/packages/multiplayer-sdk` — client multiplayer SDK
- `/packages/db` — Drizzle ORM schema, migrations, repositories (UserRepository, GameRepository, FavouriteRepository, SessionRepository)

**Auth requirements:**
- Firebase Auth for identity (Email, Google, Anonymous guest)
- Backend verifies Firebase ID tokens (JWTs)
- Every API request includes `Authorization: Bearer <firebase-id-token>`
- The auth service provides middleware that other services use
- Guest users can browse and play but cannot create, favourite, or use multiplayer

**Service location:** `/services/auth`

## Build Objective

Implement the auth service and auth middleware that all other backend services will use.

## Specific Deliverables

1. **Firebase Admin SDK setup** in `/services/auth`:
   - Initialize Firebase Admin with service account credentials (from env var `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_SERVICE_ACCOUNT` JSON env var)
   - Verify Firebase ID tokens
   - Extract user info from token claims

2. **Auth middleware** (exported as a package other services can import):
   - Create `/packages/auth-middleware` (new shared package)
   - Express middleware: `authenticateRequest` — verifies Bearer token, attaches `req.user` with `{ uid, email, displayName, isAnonymous }`
   - Express middleware: `requireAuth` — rejects anonymous/unauthenticated users (for protected routes like create, favourite)
   - Express middleware: `optionalAuth` — attaches user if token present, proceeds without if not (for feed browsing)

3. **User sync endpoint** in `/services/auth`:
   - `POST /auth/sync` — called after Firebase login on the client. Takes Firebase user info and upserts into the `users` table using `UserRepository`
   - Returns the Sloppy user profile (with internal user ID mapped to Firebase UID)

4. **User profile endpoint**:
   - `GET /auth/me` — returns current user profile from DB (requires auth)

5. **Health check**: `GET /auth/health`

## Constraints

- Firebase Admin SDK is the ONLY auth mechanism — do not build custom JWT signing
- The auth middleware package must be stateless (no DB calls) — it only verifies tokens and extracts claims
- User creation/sync happens ONLY through the `/auth/sync` endpoint
- All environment variables documented in a `.env.example` file
- Error responses must follow a consistent format: `{ error: string; code: string; status: number }`

---

---

# PROMPT 5: API Gateway

## Full System Context

Sloppy is an AI-powered browser game platform with: scrollable game feed, game generation via natural language, favourites, and multiplayer. Hosted on Google Cloud Run.

**Already built (Prompts 1-4):**
- Monorepo with pnpm workspaces
- `/packages/shared` — types, constants, API route paths, utilities
- `/packages/runtime-sdk` — game runtime contract
- `/packages/multiplayer-sdk` — client multiplayer SDK
- `/packages/db` — database schema, migrations, repositories
- `/packages/auth-middleware` — Express middleware for Firebase token verification (`authenticateRequest`, `requireAuth`, `optionalAuth`)
- `/services/auth` — user sync, profile endpoints

**API Gateway responsibilities:**
- Single entry point for all client requests
- Routes requests to downstream services
- Applies auth middleware globally
- Applies rate limiting
- Request logging and error handling
- CORS configuration

**Backend services and their routes:**
| Service | Base Path | Key Endpoints |
|---------|-----------|---------------|
| Auth | /auth | POST /sync, GET /me |
| Games (game-builder) | /games | GET / (feed), GET /:id, POST / (create), PUT /:id, DELETE /:id, POST /:id/publish |
| Favourites (game-builder) | /favourites | POST /:gameId, DELETE /:gameId, GET / (my favourites) |
| AI Orchestrator | /generate | POST / (start generation), GET /:sessionId/status (SSE stream) |
| Multiplayer | /multiplayer | POST /sessions (create), GET /sessions/:id, POST /sessions/:id/join |

## Build Objective

Implement the API gateway service that proxies requests to downstream services with auth, rate limiting, and logging.

## Specific Deliverables

1. **Express app** in `/services/api-gateway` with:
   - CORS configured for web app origin (configurable via env)
   - JSON body parsing with size limits
   - Request ID generation (attach to every request/response)
   - Request logging (method, path, status, duration)

2. **Auth integration**:
   - Use `optionalAuth` middleware globally (every request gets user info if token present)
   - Individual route groups apply `requireAuth` where needed (create, favourite, multiplayer, generate)

3. **Rate limiting** using `express-rate-limit` + Redis store:
   - Per-user limits (by Firebase UID):
     - Game generation: 5 per hour
     - General API: 100 per minute
   - Per-IP limits (for unauthenticated):
     - General API: 30 per minute
   - Configurable via environment variables
   - Return `429` with `Retry-After` header and friendly error message

4. **Reverse proxy routing**:
   - Use `http-proxy-middleware` to proxy to downstream services
   - Service URLs configurable via env vars (`AUTH_SERVICE_URL`, `GAME_BUILDER_URL`, `AI_ORCHESTRATOR_URL`, `MULTIPLAYER_URL`)
   - Proxy passes through the auth context (user info headers or forwarded token)
   - Support SSE passthrough for `/generate/:sessionId/status`

5. **Error handling**:
   - Global error handler with consistent error response format
   - 404 handler for unknown routes
   - Graceful shutdown handling

6. **Health check**: `GET /health` — aggregates health of downstream services

## Constraints

- The gateway does NOT contain business logic — it only routes, authenticates, rate-limits, and logs
- All service URLs must be configurable via environment variables with sensible local defaults
- Rate limit state stored in Redis (configurable Redis URL via env)
- SSE connections must NOT be buffered by the proxy
- Add `.env.example` documenting all required environment variables
- Request timeout: 30s for normal requests, 120s for generation requests

---

---

# PROMPT 6: AI Orchestrator Service

## Full System Context

Sloppy is an AI-powered browser game platform. The core magic: a user types a natural language prompt, and a fully playable browser game is generated and rendered instantly.

**Already built (Prompts 1-5):**
- Monorepo with all packages and services scaffolded
- `/packages/shared` — types including `GenerationRequest`, `GenerationPhase`, `GenerationStatus`, constants
- `/packages/runtime-sdk` — the `SloppyGame` interface contract that every generated game MUST implement, plus a runtime validator
- `/packages/db` — database access (GameRepository)
- `/packages/auth-middleware` — auth middleware
- `/services/auth` — auth endpoints
- `/services/api-gateway` — gateway with routing, rate limiting, auth

**The runtime contract every generated game must follow:**
```ts
window.SloppyGame = {
  init(container: HTMLElement): void | Promise<void>,
  update(deltaTime: number): void,
  destroy(): void,
  supportsMultiplayer: boolean,
  getInitialState?(): Record<string, unknown>,
  applyPlayerInput?(playerId: string, input: unknown): void,
  updateState?(state: Record<string, unknown>): void,
  serializeState?(): Record<string, unknown>
}
```

**Standard game bundle structure:**
```
/game
  index.html
  game.js
  config.json
  /assets
  /audio
```

**Generation phases:**
1. **Concept** — AI designs the game concept (mechanics, rules, visual style)
2. **Code** — AI writes the game.js implementing the SloppyGame interface
3. **Assets** — AI generates or selects visual assets
4. **Multiplayer** — If requested, AI adds multiplayer hooks
5. **Music** — Optional background audio generation

## Build Objective

Implement the AI orchestrator service that takes a user prompt and orchestrates the full game generation pipeline, streaming progress to the client.

## Specific Deliverables

1. **Generation endpoint**: `POST /generate`
   - Accepts `{ prompt: string }` + authenticated user context
   - Creates a generation session with a unique ID
   - Kicks off async generation pipeline
   - Returns `{ sessionId: string }` immediately

2. **Status streaming endpoint**: `GET /generate/:sessionId/status`
   - Server-Sent Events (SSE) stream
   - Emits `GenerationStatus` events as each phase progresses
   - Final event includes the completed game ID or error

3. **Generation pipeline** (async, phase-by-phase):

   **Phase 1 — Concept Design:**
   - Send prompt to LLM (OpenAI GPT-4 or Anthropic Claude — make configurable)
   - System prompt instructs: "Design a simple browser game concept. Output: title, description, mechanics, visual style, whether it supports multiplayer, list of needed assets"
   - Parse structured output (JSON)

   **Phase 2 — Code Generation:**
   - Send concept + runtime SDK interface to LLM
   - System prompt: "Write a complete game.js file implementing the SloppyGame interface. Use Canvas 2D API. The game must be self-contained — no external dependencies. All rendering via the container element passed to init()."
   - Include the full `SloppyGame` interface definition in the prompt
   - Validate generated code using the runtime validator from `/packages/runtime-sdk`
   - If validation fails, retry once with error feedback

   **Phase 3 — Asset Generation:**
   - For V1: generate simple SVG/Canvas-based assets or use emoji/unicode art
   - Future: integrate image generation API
   - Output asset file contents

   **Phase 4 — Multiplayer Injection (conditional):**
   - Only if concept.supportsMultiplayer is true
   - Send game code + multiplayer SDK interface to LLM
   - Ask it to add multiplayer hooks to the existing game code

   **Phase 5 — Music (optional, skip in V1):**
   - Placeholder for future audio generation
   - For now, skip or use a default ambient track

4. **Prompt engineering module**:
   - Centralized system prompts for each phase
   - Template rendering with game context injection
   - Token counting and enforcement (max tokens per phase configurable)

5. **LLM client abstraction**:
   - Abstract LLM calls behind an interface so provider is swappable
   - Support OpenAI and Anthropic
   - Streaming responses from LLM for real-time progress
   - Token usage tracking per request
   - Error handling with retries (max 2 retries per phase)

6. **Generation session storage**:
   - Store generation state in Redis (for resumability and status queries)
   - TTL on sessions (1 hour)
   - Clean up completed sessions after game is saved

7. **Output**: When generation completes, emit the full game bundle (HTML + JS + config + assets) to the Game Builder Service for validation and storage

## Constraints

- LLM API keys via environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`)
- Default to one provider, configurable via `LLM_PROVIDER` env var
- Max generation time: 2 minutes (timeout and error if exceeded)
- Max output token budget per game: 8000 tokens for code, 2000 for concept
- Rate limit already handled by API gateway — this service trusts the gateway
- All generation must be stateless per-request (state only in Redis)
- The generated code MUST NOT use `eval`, `Function()`, `fetch()` to external URLs, or `document.cookie`
- Add `.env.example` with all required variables

---

---

# PROMPT 7: Game Builder Service — Validation, Storage & CRUD

## Full System Context

Sloppy is an AI-powered browser game platform. Games are generated by AI, validated, stored, and served to users via a scrollable feed.

**Already built (Prompts 1-6):**
- Monorepo with all packages
- `/packages/shared` — types, constants
- `/packages/runtime-sdk` — SloppyGame interface, runtime validator, runtime loader
- `/packages/db` — GameRepository, FavouriteRepository with all CRUD operations and feed queries
- `/packages/auth-middleware` — auth middleware
- `/services/auth` — auth + user sync
- `/services/api-gateway` — routing, rate limiting
- `/services/ai-orchestrator` — generates game bundles (HTML + JS + config + assets) from prompts

**Game bundle structure produced by AI orchestrator:**
```
index.html — entry point loading game.js
game.js — implements SloppyGame interface
config.json — { title, version, supportsMultiplayer, maxPlayers, assets, audio }
/assets — generated visual assets
/audio — optional audio files
```

**Validation requirements before a game can be saved:**
1. Required files exist (index.html, game.js, config.json)
2. game.js implements all required SloppyGame interface methods
3. No forbidden code patterns (eval, Function constructor, external fetch, document.cookie, localStorage, sessionStorage)
4. Total bundle size < 5MB
5. config.json is valid per schema
6. JS linting passes (basic — no syntax errors)

## Build Objective

Implement the game builder service that validates game bundles, stores them, and serves game CRUD + feed + favourites API endpoints.

## Specific Deliverables

1. **Game validation pipeline** (`POST /games` — called by AI orchestrator after generation):
   - Accept game bundle (as JSON with file contents or as a multipart upload)
   - Run validation checks (all 6 listed above) using runtime validator from `/packages/runtime-sdk`
   - If validation fails, return detailed errors
   - If validation passes, proceed to storage

2. **Game storage**:
   - Store game bundles in **Google Cloud Storage** (GCS bucket)
   - Each game gets a unique path: `games/{gameId}/v{version}/`
   - Upload all files (index.html, game.js, config.json, assets/*)
   - Store the GCS path in the database via `GameRepository`
   - Return signed URLs or CDN URLs for serving

3. **Game CRUD endpoints**:
   - `POST /games` — create (validate + store + save to DB)
   - `GET /games/:id` — get game metadata + serve URL
   - `PUT /games/:id` — update game (re-validate, store new version, increment version)
   - `DELETE /games/:id` — soft-delete (requires ownership)
   - `POST /games/:id/publish` — change status from draft to published (only published games appear in feed)
   - `GET /games/feed` — paginated feed with sort modes (recent, popular, random), returns `GameFeedItem[]`
   - `GET /games/mine` — user's own games (drafts + published)

4. **Game serving endpoint**:
   - `GET /games/:id/bundle` — returns the game's index.html (or redirect to CDN URL)
   - Sets appropriate CSP headers for iframe sandboxing
   - Cache headers for CDN

5. **Favourites endpoints**:
   - `POST /favourites/:gameId` — add favourite (requires auth)
   - `DELETE /favourites/:gameId` — remove favourite (requires auth)
   - `GET /favourites` — list user's favourited games (paginated, returns `GameFeedItem[]`)

6. **Play count tracking**:
   - `POST /games/:id/play` — increment play count (debounced — max 1 per user per game per 5 minutes)

## Constraints

- GCS credentials via `GOOGLE_APPLICATION_CREDENTIALS` env var
- GCS bucket name via `GCS_BUCKET` env var
- Serve game bundles via CDN URL pattern (configurable `CDN_BASE_URL` env var)
- All endpoints return consistent error format
- Feed endpoint must be fast — use database indexes, consider caching hot feed in Redis
- Bundle size limit: 5MB total (configurable via env)
- Add `.env.example`

---

---

# PROMPT 8: Multiplayer Engine

## Full System Context

Sloppy is an AI-powered browser game platform. Some generated games support multiplayer. The multiplayer system uses an authoritative server model — clients send inputs, the server manages state, clients receive state updates.

**Already built (Prompts 1-7):**
- Monorepo with all packages and services
- `/packages/shared` — types including `MultiplayerSession`, `PlayerState`, WebSocket event names
- `/packages/multiplayer-sdk` — client-side SDK (connect, disconnect, sendInput, onStateUpdate, onPlayerJoin, onPlayerLeave)
- `/packages/runtime-sdk` — game runtime with multiplayer hooks (getInitialState, applyPlayerInput, updateState, serializeState)
- `/packages/db` — SessionRepository (create, findById, updateStatus, player count management, cleanup)
- All other services functional

**Multiplayer architecture:**
```
Client A ──┐
Client B ──┼──→ WebSocket Server ──→ Room Manager ──→ Authoritative State (Redis)
Client C ──┘
```

**How it works:**
1. Host creates a session via REST API → gets session ID
2. Players connect via WebSocket with session ID
3. Each player sends inputs (key presses, mouse, etc.)
4. Server applies inputs to authoritative game state
5. Server broadcasts updated state to all players at a fixed tick rate
6. Clients render the received state

**Player state schema:**
```ts
{ id: string, x: number, y: number, velocity: number, health: number, score: number, [key: string]: unknown }
```

## Build Objective

Implement the multiplayer WebSocket server with room management, authoritative state, and player synchronization.

## Specific Deliverables

1. **WebSocket server** in `/services/multiplayer`:
   - Use `ws` library (or `socket.io` if you prefer — justify)
   - Accept WebSocket connections at `ws://host/ws`
   - Authenticate on connection (Firebase token in query param or first message)
   - Route connections to rooms based on session ID

2. **REST endpoints** (for session management, proxied through API gateway):
   - `POST /multiplayer/sessions` — create session `{ gameId, maxPlayers? }` (requires auth, user becomes host)
   - `GET /multiplayer/sessions/:id` — get session info
   - `POST /multiplayer/sessions/:id/join` — join session (validates: session exists, not full, game supports multiplayer)

3. **Room Manager**:
   - Create/destroy rooms mapped to session IDs
   - Track connected players per room
   - Max players per room (from game config, default 4)
   - Handle player join/leave events
   - Broadcast to all players in a room
   - Auto-close room when empty for > 60 seconds

4. **Authoritative game state** (Redis):
   - Each room stores state in Redis: `multiplayer:{sessionId}:state`
   - State is a JSON blob matching the game's `serializeState()` output
   - Player states stored individually: `multiplayer:{sessionId}:player:{playerId}`
   - TTL on all keys: 1 hour (configurable)
   - State initialized from game's `getInitialState()` when first player connects

5. **Game loop on the server** (tick-based):
   - Server runs a game tick at configurable rate (default: 20 ticks/second)
   - Each tick:
     1. Collect all player inputs since last tick
     2. Apply inputs to state (using game's `applyPlayerInput` logic — serialized)
     3. Update state
     4. Serialize state
     5. Broadcast state to all connected clients
   - Note: The server doesn't run the actual game code. It stores and relays state. The game logic for multiplayer is simplified: inputs in → state transforms → state out

6. **WebSocket protocol** (message types):
   - Client → Server: `{ type: 'input', data: unknown }`
   - Client → Server: `{ type: 'ping' }`
   - Server → Client: `{ type: 'state_update', data: { gameState, players } }`
   - Server → Client: `{ type: 'player_joined', data: { playerId, playerCount } }`
   - Server → Client: `{ type: 'player_left', data: { playerId, playerCount } }`
   - Server → Client: `{ type: 'session_closed', data: { reason } }`
   - Server → Client: `{ type: 'error', data: { message, code } }`
   - Server → Client: `{ type: 'pong' }`

7. **Cleanup**:
   - Periodic job (every 5 minutes) to clean up stale sessions using `SessionRepository.cleanupStale`
   - Remove Redis keys for closed sessions
   - Disconnect lingering WebSocket connections

## Constraints

- Redis URL configurable via `REDIS_URL` env var
- Max concurrent sessions configurable (default: 100)
- Max players per session configurable (default: 4, max: 8)
- Tick rate configurable (default: 20/second)
- WebSocket heartbeat: ping every 30 seconds, disconnect if no pong within 10 seconds
- Handle WebSocket errors gracefully (don't crash the server)
- Log all session lifecycle events (create, join, leave, close)
- Add `.env.example`

---

---

# PROMPT 9: Frontend — App Shell, Routing & Design System

## Full System Context

Sloppy is an AI-powered browser game platform. The frontend is a React (Vite) app with a chaotic, playful, sloppy aesthetic. Users browse a scrollable feed of playable games, generate new games with natural language, favourite games, and play multiplayer.

**Already built (Prompts 1-8):**
- Full backend: API gateway, auth, AI orchestrator, game builder, multiplayer engine
- All shared packages: types, runtime SDK, multiplayer SDK, DB layer, auth middleware
- The frontend app is scaffolded (`/apps/web` — Vite + React + TS + Tailwind + Framer Motion) but has no pages or components yet

**Frontend stack:**
- React (Vite) with TypeScript
- Zustand for state management
- TailwindCSS for styling
- Framer Motion for animations
- Web Audio API for sound
- PixiJS or Phaser for game rendering (loaded in sandboxed iframes)

**Pages:**
1. **Home** — scrollable feed of playable games (default route `/`)
2. **Create** — prompt input, generation progress, game preview, chat refinement (`/create`)
3. **Favourites** — list of favourited games (`/favourites`)
4. **Game View** — full-screen game player (overlay or `/game/:id`)

**Design system — "Sloppy" aesthetic:**
- Light background (off-white / cream)
- Neon pastel accent colors (electric pink, lime green, bright cyan, warm yellow)
- Slight intentional misalignment effects on UI elements
- Wiggly hover animations (elements wobble on hover)
- Handwritten/sketch-style headings (use a playful font like "Comic Neue", "Gaegu", or "Patrick Hand")
- Rounded, slightly irregular borders
- Continuous subtle background music (toggle-able)
- Playful micro-interactions everywhere
- Fun > Clean, Playful > Professional, Chaotic > Polished

## Build Objective

Build the frontend app shell: routing, layout, navigation, design system, global state stores, and reusable UI components. No page content yet — just the skeleton that pages will plug into.

## Specific Deliverables

### 1. Routing & Layout
- React Router v6 with routes: `/`, `/create`, `/favourites`, `/game/:id`
- Main layout component with:
  - Top navigation bar (logo, nav links, user avatar/login button)
  - Bottom navigation bar for mobile (Home, Create, Favourites icons)
  - Content area
- Full-screen overlay system for game viewing (game opens over the feed, closeable)

### 2. Design System & Theme
- TailwindCSS configuration:
  - Custom colors: `sloppy-pink`, `sloppy-lime`, `sloppy-cyan`, `sloppy-yellow`, `sloppy-cream` (background), `sloppy-dark` (text)
  - Custom fonts: import a handwritten Google Font for headings, clean sans-serif for body
  - Custom border-radius values for the "wobbly" card look
  - Custom animation utilities
- CSS for the "sloppy misalignment" effect (slight random rotations on cards, `-1deg` to `1deg`)

### 3. Shared UI Components (`/packages/ui` AND/OR `/apps/web/src/components/ui`)
Build these reusable components with the sloppy aesthetic:
- **`SloppyButton`** — primary, secondary, ghost variants. Wiggly hover animation (slight rotation + scale). Neon pastel colors.
- **`SloppyCard`** — content card with slight random rotation, playful shadow, hover lift effect
- **`SloppyInput`** — text input with handwritten-style border, focus glow in accent color
- **`SloppyModal`** — modal/overlay with bounce-in animation, blurred backdrop
- **`SloppySpinner`** — loading spinner with chaotic spinning animation (not a boring circle)
- **`SloppyToast`** — notification toast with slide-in animation and playful icon
- **`GameCard`** — card for the feed: game title, play count, play button, favourite heart button, slight tilt
- **`NavBar`** — top navigation with sloppy logo, wobbly nav links
- **`BottomNav`** — mobile bottom navigation with bouncy icons
- **`Avatar`** — user avatar with playful border

### 4. Zustand Stores
- **`useAuthStore`** — `{ user, isLoading, isAuthenticated, login, logout, syncUser }`
  - Firebase Auth integration on the client side
  - On login: call `POST /auth/sync` to sync user with backend
  - Persist auth state
- **`useGameStore`** — `{ feedGames, myGames, currentGame, fetchFeed, fetchMyGames, favouriteGame, unfavouriteGame }`
- **`useGenerationStore`** — `{ sessionId, status, phase, progress, startGeneration, connectToSSE }`
- **`useMultiplayerStore`** — `{ session, isConnected, players, createSession, joinSession, connect, disconnect }`
- **`useUIStore`** — `{ isMusicPlaying, toggleMusic, isGameOverlayOpen, openGameOverlay, closeGameOverlay }`

### 5. API Client
- Create `/apps/web/src/lib/api.ts` — typed API client using `fetch`
- Base URL configurable via `VITE_API_URL` env var
- Automatically attaches Firebase auth token to requests
- Methods matching all backend endpoints (games, favourites, generate, multiplayer, auth)
- Error handling with typed error responses

### 6. Firebase Auth Client Setup
- Initialize Firebase client SDK
- Configure auth providers (Google, Email, Anonymous)
- Auth state listener that updates Zustand store
- Login/logout functions

### 7. Sloppy Intro Animation
- On first load, show a brief chaotic intro animation (1-2 seconds)
- Sloppy logo bounces/wiggles in
- Fades into the home feed
- Background music fades in (muted by default, user can enable)

### 8. Music System
- Background ambient music player (Web Audio API or simple `<audio>` element)
- Global mute/unmute toggle in nav bar
- Music persists across page navigation
- Start muted (browser autoplay policy)

## Constraints

- Mobile-first responsive design
- All animations must use Framer Motion (not CSS animations) for consistency
- Firebase config via environment variables (`VITE_FIREBASE_*`)
- API URL via `VITE_API_URL`
- No actual page content yet — pages are placeholder components that will be built in subsequent prompts
- Components must be well-typed with TypeScript
- Use React.lazy for route-level code splitting
- Add `.env.example` for frontend env vars

---

---

# PROMPT 10: Frontend — Home Feed (Scrollable Game Feed)

## Full System Context

Sloppy is an AI-powered browser game platform. The home page is a vertically scrollable infinite feed of playable game cards. Tapping a card opens the game in a full-screen overlay where it's instantly playable.

**Already built (Prompts 1-9):**
- Full backend with all services operational
- Frontend app shell with: routing (`/`, `/create`, `/favourites`, `/game/:id`), layout, navigation, design system, all Zustand stores, API client, Firebase Auth, sloppy UI components (SloppyButton, SloppyCard, GameCard, etc.), intro animation, music system
- Backend serves: `GET /games/feed?cursor=X&limit=20&sort=recent|popular|random` returning `GameFeedItem[]` with cursor-based pagination

**Feed behavior:**
- Vertical infinite scroll
- Each card shows: title, play count, "Play" button, favourite heart
- Clicking a card opens the game in a full-screen overlay (the feed stays underneath)
- Preload the next 2 games for smooth transitions
- Sort tabs at top: Recent, Popular, Random
- Pull-to-refresh on mobile

**Game loading:**
- Games are loaded in sandboxed iframes
- iframe `src` points to the game's CDN URL (served from GCS via game builder service)
- iframe sandbox: `allow-scripts` only
- CSP headers set by backend

## Build Objective

Implement the Home Feed page with infinite scrolling game cards and the full-screen game overlay player.

## Specific Deliverables

### 1. Home Feed Page (`/`)
- Infinite scrolling feed using Intersection Observer
- Fetches games from `GET /games/feed` with cursor-based pagination
- Sort mode tabs at top: Recent | Popular | Random (each resets the feed)
- Pull-to-refresh on mobile (Framer Motion gesture)
- Loading skeleton cards while fetching
- Empty state with playful message ("No games yet! Go create something sloppy")
- Error state with retry button

### 2. Game Card (enhanced)
- Enhance the `GameCard` component from Prompt 9:
  - Title with playful font
  - Play count badge
  - Favourite heart button (toggles favourite state via API, optimistic update)
  - "Play" button that opens the game overlay
  - Creator name
  - Slight random tilt with hover animation
  - Tap/click opens full-screen game overlay

### 3. Full-Screen Game Overlay
- Overlay that slides up over the feed (feed stays mounted underneath)
- Contains:
  - Back/close button (top left)
  - Game title (top center)
  - Favourite button (top right)
  - Multiplayer button if game supports it (top right, next to favourite)
  - Sandboxed iframe filling the viewport
  - Play count increment (call `POST /games/:id/play` when game loads)
- Framer Motion slide-up animation
- Pressing Escape or back button closes the overlay
- URL updates to `/game/:id` when overlay opens (browser back works)

### 4. Game Iframe Sandbox
- Load game via sandboxed iframe:
  ```html
  <iframe
    src="{CDN_URL}/games/{gameId}/v{version}/index.html"
    sandbox="allow-scripts"
    style="width:100%;height:100%;border:none"
  />
  ```
- Communication between parent and iframe via `postMessage` (for pause, destroy, resize events)
- Handle iframe load errors gracefully
- Loading spinner while game loads in iframe

### 5. Game Preloading
- When a game card is near the viewport (2 cards away), start preloading:
  - Fetch game metadata
  - Warm up the iframe URL (preconnect/prefetch)
- Keep at most 2 preloaded games in memory, evict oldest

### 6. Optimistic Favouriting
- When user taps favourite heart:
  - Immediately toggle UI state
  - Call API in background
  - Revert if API fails, show toast error

## Constraints

- Feed must feel smooth at 60fps even with many cards
- Virtualize the list if card count > 50 (use `react-window` or `react-virtuoso`)
- Iframes must be properly cleaned up when overlay closes (call `destroy()` on game)
- Mobile: full-screen overlay should use 100dvh (dynamic viewport height)
- All animations via Framer Motion
- Keyboard accessible: arrow keys to scroll, Enter to open game, Escape to close

---

---

# PROMPT 11: Frontend — Create Page & Game Generation UX

## Full System Context

Sloppy is an AI-powered browser game platform. Users type a natural language prompt, and a playable browser game is generated in real-time. The Create page shows the generation progress and lets users preview and refine the result.

**Already built (Prompts 1-10):**
- Full backend with AI orchestrator that: accepts a prompt via `POST /generate`, streams generation status via SSE at `GET /generate/:sessionId/status`, and outputs a validated game bundle stored in GCS
- Frontend app shell with all components, stores, routing
- Home feed with game cards and full-screen game overlay
- Zustand stores: `useGenerationStore` with `{ sessionId, status, phase, progress, startGeneration, connectToSSE }`
- API client with all endpoint methods

**Generation flow (backend):**
1. User sends prompt → `POST /generate` → returns `{ sessionId }`
2. Client connects to SSE: `GET /generate/:sessionId/status`
3. Backend streams events: `{ phase, progress, message, error? }`
4. Phases in order: concept → code → assets → multiplayer (optional) → music (optional)
5. Final event includes the created game ID
6. Game is then playable immediately

**Create page features:**
- Prompt input (large textarea)
- "Generate Game" button
- Live generation progress (animated phase indicators)
- Game preview in sandbox iframe once complete
- Chat refinement panel: click objects in the game or type instructions to iterate
- Save and Publish buttons

## Build Objective

Implement the Create page with the full generation experience — from prompt input through real-time progress to game preview and refinement.

## Specific Deliverables

### 1. Create Page Layout (`/create`)
- Large, inviting prompt textarea with placeholder text like "Describe your game... (e.g., 'A platformer where you're a cat jumping on clouds')"
- "Generate Game" button (big, sloppy, prominent)
- Character count / token estimate display
- Example prompts section (clickable chips): "Space shooter", "Snake but weird", "Two-player pong", "Endless runner with a twist"

### 2. Generation Progress UI
- When generation starts:
  - Prompt input slides up/collapses
  - Progress panel appears with animated phase indicators
  - Each phase shown as a step: Concept → Code → Assets → Multiplayer → Music
  - Current phase has a playful animated spinner
  - Completed phases show checkmark with bounce animation
  - Real-time status message from SSE stream displayed below current phase
  - Estimated time remaining (rough guess based on phase)
- If error occurs:
  - Show error message with sloppy sad face
  - "Try Again" button
  - Error details expandable

### 3. SSE Connection
- Connect to `GET /generate/:sessionId/status` as EventSource
- Parse events and update `useGenerationStore`
- Handle connection errors with retry
- Clean up EventSource on unmount or navigation

### 4. Game Preview
- Once generation completes:
  - Progress panel slides away
  - Game preview appears in a sandboxed iframe (same setup as home feed overlay)
  - Game is immediately playable
  - Title and description shown above preview (from generation concept phase)

### 5. Chat Refinement Panel
- Slide-out panel (right side on desktop, bottom sheet on mobile)
- Text input for refinement instructions ("Make the character bigger", "Add a score counter", "Change the background to space")
- Send refinement prompt → triggers a new generation that modifies the existing game
- Shows refinement history as a chat thread
- Each refinement creates a new version of the game

### 6. Save & Publish
- "Save as Draft" button — saves game to user's games (status: draft)
- "Publish to Feed" button — publishes game to the public feed (status: published)
- After publishing: show success celebration animation (confetti? sloppy particles?) and option to view in feed
- Disable publish if game hasn't been generated yet

### 7. Auth Gate
- If user is not authenticated or is anonymous guest:
  - Show prompt input and let them generate (if within rate limits)
  - When they try to save/publish: show login prompt
  - After login, resume where they left off

## Constraints

- Generation must be non-blocking — user can navigate away and come back (store sessionId in URL or local state)
- SSE connection must be resilient to network interruptions
- Game preview iframe same security setup as home feed (sandbox, CSP)
- Refinement is a V1 stretch goal — implement the UI but it can call the same generation endpoint with modified prompt
- Mobile responsive: chat panel as bottom sheet, not side panel
- All animations via Framer Motion

---

---

# PROMPT 12: Frontend — Favourites Page

## Full System Context

Sloppy is an AI-powered browser game platform. Users can favourite games from the feed or game overlay. The Favourites page shows all favourited games in a sorted, replayable list.

**Already built (Prompts 1-11):**
- Full backend with all services
- Frontend with: app shell, home feed, create page, game overlay, all stores and API client
- `useFavourites` API: `POST /favourites/:gameId`, `DELETE /favourites/:gameId`, `GET /favourites?cursor=X&limit=20`
- Backend returns `GameFeedItem[]` for favourites (same shape as feed items)
- `useGameStore` has `favouriteGame` and `unfavouriteGame` methods with optimistic updates

## Build Objective

Implement the Favourites page.

## Specific Deliverables

### 1. Favourites Page (`/favourites`)
- Grid/list of favourited games using the same `GameCard` component from the feed
- Sort options: "Recently Favourited" (default), "Most Played"
- Cursor-based pagination with infinite scroll (same pattern as home feed)
- Pull-to-refresh on mobile

### 2. Empty State
- Playful empty state when no favourites: illustration/animation + message like "No favourites yet! Go find some sloppy games" + button to go to Home feed

### 3. Unfavourite
- Tapping the heart on a favourited game unfavourites it
- Optimistic removal from the list with undo toast ("Removed from favourites" with "Undo" action)
- If undo tapped: re-add to list and call API to re-favourite

### 4. Auth Requirement
- Favourites page requires authentication
- If not logged in: show login prompt with message "Sign in to save your favourite games"

## Constraints

- Reuse `GameCard` and game overlay from home feed — don't duplicate
- Same virtual scrolling approach if list is long
- Mobile responsive
- All animations via Framer Motion

---

---

# PROMPT 13: Frontend — Multiplayer UI

## Full System Context

Sloppy is an AI-powered browser game platform with optional multiplayer for supported games. Multiplayer uses WebSocket connections through an authoritative server model.

**Already built (Prompts 1-12):**
- Full backend including multiplayer engine (WebSocket server, room management, Redis state)
- `/packages/multiplayer-sdk` — client SDK: `connect(sessionId, playerId)`, `disconnect()`, `sendInput(input)`, `onStateUpdate(cb)`, `onPlayerJoin(cb)`, `onPlayerLeave(cb)`
- Frontend with all pages, game overlay, stores
- `useMultiplayerStore` — `{ session, isConnected, players, createSession, joinSession, connect, disconnect }`
- Backend REST: `POST /multiplayer/sessions`, `GET /multiplayer/sessions/:id`, `POST /multiplayer/sessions/:id/join`
- WebSocket at `ws://{MULTIPLAYER_URL}/ws`

**Multiplayer flow:**
1. User opens a game that supports multiplayer → sees "Multiplayer" button in game overlay
2. Clicks "Multiplayer" → options: "Create Session" or "Join Session"
3. Create: creates session, gets session ID, shows shareable link/code, waits for players
4. Join: enter session ID/code, joins existing session
5. Once connected: game switches to multiplayer mode, real-time synced gameplay
6. Players see each other's state in real-time
7. Session auto-closes when all players leave

## Build Objective

Implement the multiplayer UI: session creation, joining, lobby, and real-time game state synchronization in the game overlay.

## Specific Deliverables

### 1. Multiplayer Button
- In game overlay: show "Multiplayer" button only if `game.supportsMultiplayer === true`
- Clicking opens multiplayer modal

### 2. Multiplayer Modal
- Two tabs: "Create" and "Join"
- **Create tab:**
  - "Create Session" button
  - On create: call API, show session code (short, copyable, e.g., "SLOP-A3X9")
  - "Copy Link" button (copies URL: `{APP_URL}/game/{gameId}?session={sessionId}`)
  - "Waiting for players..." with animated dots
  - Show player count: "1/4 players"
  - "Start Game" button (enabled when 2+ players)
- **Join tab:**
  - Input field for session code
  - "Join" button
  - Shows error if session not found or full

### 3. Lobby UI
- Once in a session (created or joined):
  - Show list of connected players (with playful avatars/colors)
  - Host has a crown icon
  - Host can start the game
  - Non-host sees "Waiting for host to start..."
  - Player join/leave animations

### 4. Multiplayer Game Integration
- When multiplayer game starts:
  - Modal closes
  - Game iframe loads with multiplayer mode enabled
  - Connect to WebSocket using multiplayer SDK
  - Bridge between iframe and multiplayer SDK via `postMessage`:
    - iframe sends player inputs → parent forwards to WebSocket via SDK
    - Parent receives state updates from WebSocket → forwards to iframe via postMessage
  - Show connected player count badge on game overlay

### 5. Multiplayer HUD
- Overlay HUD on top of game iframe during multiplayer:
  - Player count indicator
  - Connection status (green dot = connected, yellow = reconnecting, red = disconnected)
  - "Leave Session" button
  - Ping/latency indicator

### 6. Disconnect Handling
- If player disconnects: show reconnection overlay with spinner
- If reconnection fails after 3 attempts: show "Connection Lost" with options to rejoin or go back
- If host disconnects: session closes, all players see "Host left the game" message

### 7. URL-Based Session Joining
- If URL contains `?session={sessionId}`: auto-open the game and join the session
- Handle: session not found, session full, game not found

## Constraints

- WebSocket URL configurable via `VITE_MULTIPLAYER_WS_URL`
- postMessage communication must use a specific message format and origin validation
- Multiplayer SDK handles reconnection (exponential backoff) — UI just reflects SDK state
- Mobile responsive: modal as bottom sheet
- All animations via Framer Motion
- Clean up WebSocket connections on unmount / navigation

---

---

# PROMPT 14: Observability & Error Handling

## Full System Context

Sloppy is an AI-powered browser game platform with: React frontend, 5 Node.js backend services (api-gateway, auth, ai-orchestrator, game-builder, multiplayer), PostgreSQL, Redis, Firebase Auth, LLM API calls, WebSocket connections, game bundles stored in GCS. Hosted on Google Cloud.

**Already built (Prompts 1-13):**
- Everything. Full frontend and backend functional.

**What needs instrumentation:**
- API request/response logging across all services
- Error tracking and reporting
- AI/LLM cost tracking (tokens used per generation)
- WebSocket monitoring (connections, messages, errors)
- Game crash detection (iframe errors)
- Generation failure metrics (which phase fails, retry rates)
- Database query performance
- Frontend error boundaries and error reporting

## Build Objective

Add comprehensive observability across the entire stack: structured logging, error tracking, metrics, and monitoring dashboards.

## Specific Deliverables

### 1. Structured Logging (all backend services)
- Use **pino** (or winston — justify) for structured JSON logging
- Create a shared logging package: `/packages/logger`
- Every log entry includes: `timestamp`, `service`, `requestId`, `level`, `message`, `metadata`
- Log levels: debug, info, warn, error
- Request/response logging middleware (already partially in gateway — extend to all services)
- Sensitive data redaction (tokens, passwords, emails)

### 2. Error Tracking
- Integrate **Sentry** (free tier) for both frontend and backend
- Create error boundary components in React (wrap pages, wrap game iframe)
- Backend: Sentry middleware for Express in all services
- Capture: unhandled exceptions, unhandled promise rejections, API errors
- Context: user ID, request ID, service name, route

### 3. AI Cost Tracking
- Track per-generation: tokens used (prompt + completion), model used, cost estimate, duration
- Store in database: add a `generation_logs` table:
  - id, user_id, game_id, model, prompt_tokens, completion_tokens, total_cost, duration_ms, status, error, created_at
- Aggregate dashboard data: total cost per day, per user, per model
- Alert threshold: if daily cost exceeds configurable limit, log critical warning

### 4. Multiplayer Metrics
- Track: concurrent sessions, concurrent connections, messages per second, average latency
- Log: session lifecycle events, player join/leave, errors
- Track: stale session cleanups

### 5. Game Crash Detection
- Frontend: listen for iframe `error` events and `postMessage` error reports
- Log: game ID, error message, stack trace (if available), user ID
- If a game crashes frequently (>5 times in 1 hour): flag it in database for review

### 6. Health Check Dashboard
- `GET /health` on each service returns: `{ status, uptime, version, dependencies: { db, redis, ... } }`
- API gateway `/health` aggregates all service health
- Simple health status page in frontend (admin only or public — your call)

### 7. Frontend Error Handling
- Global error boundary wrapping the app
- Per-page error boundaries with sloppy-styled error UI ("Oops! Something went sloppy wrong")
- Toast notifications for API errors
- Offline detection with banner ("You're offline — some features won't work")

## Constraints

- Use environment variables for Sentry DSN, log levels
- Logging must not impact performance (async writes)
- Sentry free tier limits: be selective about what gets reported (not every 404)
- Add `.env.example` updates for new env vars
- Don't over-log in production — default to `info` level

---

---

# PROMPT 15: Electron Wrapper & PWA

## Full System Context

Sloppy is an AI-powered browser game platform. The primary target is the web app. Additionally, it should be available as a desktop app (Mac, Windows, Linux) via Electron, and as an installable PWA on mobile.

**Already built (Prompts 1-14):**
- Complete web app (React + Vite) at `/apps/web`
- Complete backend services
- The Electron app should simply load the web build — no native features needed for V1

**Electron approach:**
- Electron app loads the web app URL (production) or localhost (development)
- No custom native menus (use the web app's UI)
- Window configuration: frameless or minimal frame, resizable, min size 800x600
- App icon and metadata

**PWA approach:**
- Web app should be installable as a PWA
- Works offline for browsing cached feed (not for generation)
- Service worker for caching static assets

## Build Objective

Add Electron packaging and PWA support to the existing web app.

## Specific Deliverables

### 1. Electron App (`/apps/electron`)
- Set up Electron with `electron-builder` for packaging
- Main process: create BrowserWindow loading the web app
- Configuration:
  - Dev mode: load `http://localhost:5173` (Vite dev server)
  - Production: load from packaged web build or production URL
  - Window: 1200x800 default, 800x600 minimum, resizable
  - Title: "Sloppy"
- Build scripts for: Mac (DMG), Windows (NSIS installer), Linux (AppImage)
- App icons (placeholder — just a text-based icon for now)
- Auto-updater setup (placeholder, can be wired later)

### 2. PWA Configuration (`/apps/web`)
- Add `manifest.json` (web app manifest):
  - name: "Sloppy"
  - short_name: "Sloppy"
  - theme_color: match the sloppy design system
  - background_color: cream/off-white
  - display: "standalone"
  - icons: placeholder icons at required sizes
- Service worker using `vite-plugin-pwa`:
  - Cache static assets (JS, CSS, fonts, images)
  - Network-first strategy for API calls
  - Cache-first for game bundles (they're immutable per version)
  - Offline fallback page: "You're offline — come back when you have internet to generate more sloppy games"
- Add install prompt UI (a subtle "Install Sloppy" banner)

### 3. Cross-Platform Testing Notes
- Add a `TESTING.md` in `/apps/electron` documenting how to test on each platform
- Add npm scripts: `dev:electron`, `build:electron:mac`, `build:electron:win`, `build:electron:linux`

## Constraints

- Electron is a thin wrapper — do NOT duplicate any web app logic
- PWA service worker must not cache API responses aggressively (stale data issues)
- Electron auto-update is a placeholder — don't implement a full update server
- Keep Electron dependencies minimal

---

---

# PROMPT 16: Infrastructure & Deployment (Terraform + Docker)

## Full System Context

Sloppy is an AI-powered browser game platform hosted entirely on Google Cloud. It has 5 backend services (api-gateway, auth, ai-orchestrator, game-builder, multiplayer), a React frontend, PostgreSQL, Redis, and GCS for game bundle storage.

**Already built (Prompts 1-15):**
- Everything. Full application stack.

**GCP services needed:**
- Cloud Run: all 5 backend services
- Cloud SQL: PostgreSQL instance
- Memorystore: Redis instance
- Cloud Storage: game bundle bucket
- Cloud CDN: serve game bundles
- Artifact Registry: Docker images
- Cloud Build: CI/CD
- Secret Manager: API keys and secrets

## Build Objective

Create Docker configurations for all services and Terraform infrastructure-as-code for GCP deployment.

## Specific Deliverables

### 1. Dockerfiles
- Create a `Dockerfile` for each backend service in `/services/*`
- Multi-stage builds: build stage (TypeScript compilation) + production stage (minimal Node.js image)
- Shared base image configuration
- `.dockerignore` files
- `docker-compose.yml` at root for local development:
  - All 5 services
  - PostgreSQL container
  - Redis container
  - Web app dev server
  - Configured networking so services can communicate

### 2. Terraform (`/infra/terraform`)
- **Provider**: Google Cloud
- **Modules** (one per concern):
  - `networking` — VPC, subnets, firewall rules
  - `database` — Cloud SQL PostgreSQL instance, database, user
  - `redis` — Memorystore Redis instance
  - `storage` — GCS bucket for game bundles, CDN configuration
  - `services` — Cloud Run services for each backend service, with environment variables and secrets
  - `registry` — Artifact Registry repository
  - `secrets` — Secret Manager secrets (Firebase credentials, LLM API keys, DB password)
- **Variables**: project ID, region, environment (dev/staging/prod), service scaling parameters
- **Outputs**: service URLs, database connection string, Redis URL, GCS bucket name, CDN URL

### 3. CI/CD Pipeline
- `cloudbuild.yaml` for Google Cloud Build:
  - Build Docker images for all services
  - Push to Artifact Registry
  - Deploy to Cloud Run
  - Run database migrations
- Triggered on push to `main` branch
- Build web app and deploy to Cloud Run (or Firebase Hosting)

### 4. Environment Configuration
- Create a comprehensive `.env.example` at the root with ALL environment variables across all services
- Document which vars are needed for local dev vs production
- Create a `Makefile` with targets: `up` (docker-compose), `down`, `migrate`, `seed`, `deploy`, `terraform-plan`, `terraform-apply`

## Constraints

- Terraform state stored in GCS backend (configure remote state)
- All secrets via Secret Manager (never in Terraform state or env files)
- Cloud Run services: min 0 instances (scale to zero), max 10 instances
- Cloud SQL: smallest instance for V1 (db-f1-micro)
- Redis: basic tier, 1GB
- GCS: standard storage class, lifecycle policy to delete old versions after 90 days
- CDN: cache game bundles aggressively (immutable per version)
- Networking: services communicate via internal URLs (not public internet)
- Cost optimization: use Cloud Run min-instances=0, preemptible where possible

---

---

# Build Order Summary

| # | Prompt | Depends On | Scope |
|---|--------|------------|-------|
| 1 | Monorepo Foundation & Tooling | — | Project skeleton, configs |
| 2 | Shared Packages (SDK, Types) | 1 | Runtime SDK, multiplayer SDK, shared types |
| 3 | Database Schema & Data Layer | 1, 2 | Drizzle ORM, repositories, migrations |
| 4 | Auth Service | 1, 2, 3 | Firebase Auth, middleware, user sync |
| 5 | API Gateway | 1-4 | Routing, rate limiting, proxy |
| 6 | AI Orchestrator | 1-5 | Prompt → game generation pipeline |
| 7 | Game Builder Service | 1-6 | Validation, GCS storage, CRUD, feed |
| 8 | Multiplayer Engine | 1-7 | WebSocket server, rooms, Redis state |
| 9 | Frontend Shell & Design System | 1-2 | App shell, routing, components, stores |
| 10 | Frontend: Home Feed | 9 | Infinite scroll, game cards, overlay |
| 11 | Frontend: Create Page | 9, 10 | Generation UX, progress, preview |
| 12 | Frontend: Favourites | 9, 10 | Favourites page |
| 13 | Frontend: Multiplayer UI | 9, 10 | Session creation, lobby, sync |
| 14 | Observability | 1-13 | Logging, Sentry, metrics |
| 15 | Electron & PWA | 9-13 | Desktop wrapper, PWA config |
| 16 | Infrastructure | 1-15 | Docker, Terraform, CI/CD |
