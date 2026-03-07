# SLOPPY v2 — Sequenced Build Prompts

Each prompt below is designed to be used as a standalone conversation with an AI coding agent. They are ordered by dependency — each builds on what the previous ones produced. Every prompt contains the full system context needed so the agent understands the bigger picture, plus a tightly scoped build objective.

**What v2 adds on top of v1:**
1. **SDK v2 Contract** — Full game lifecycle (start, pause, resume, restart, game-over screens)
2. **Multi-Agent AI Pipeline** — Concept Architect → Technical Planner → Code Generator → Validator → Debug Loop → Polish Pass
3. **Dual-Engine Model** — Phaser 3 (2D) + Three.js (3D) with automatic engine selection
4. **Runtime Validation** — Puppeteer headless testing of every game state
5. **Thumbnail Generation** — AI-generated game store thumbnails via fal.ai FLUX
6. **Sound Effects** — ZzFX procedural audio + Howler.js playback + ElevenLabs for creator games
7. **UI Overhaul** — Dark premium gaming store (CrazyGames-inspired)
8. **TikTok Feed** — Full-viewport vertical feed with 3-iframe sliding window
9. **Monetisation** — Stripe subscriptions, ad revenue, creator payouts
10. **Game Population Pipeline** — Local CLI agent for mass game generation

---

## How to Use This File

1. Run each prompt in order (Prompt 1 → 2 → 3 → ...)
2. Copy the entire prompt block into a fresh conversation
3. Validate the output before moving to the next prompt
4. Each prompt references what should already exist from prior steps

---

---

# PROMPT 1: SDK v2 Contract & Shared Types

## Full System Context

Sloppy is an AI-powered browser game platform. Users generate games with natural language prompts. Games run in sandboxed iframes and are instantly playable in the browser. The platform has a scrollable feed, favourites, multiplayer, and game generation via an AI orchestrator.

**The entire v1 platform is already built and functional:**
- **Frontend** (`apps/web`): React (Vite) + Zustand + TailwindCSS + Framer Motion — pages: Home feed, Create, Favourites, MyGames, GameView
- **Backend services**: api-gateway (`:3001`), auth (`:3002`), game-builder (`:3003`), ai-orchestrator (`:3004`), multiplayer (`:3005`)
- **Shared packages**: `@sloppy/shared` (types, constants, utils), `@sloppy/runtime-sdk` (game contract, validator, loader), `@sloppy/multiplayer-sdk`, `@sloppy/db` (Drizzle ORM), `@sloppy/auth-middleware`, `@sloppy/logger`
- **Infrastructure**: GCP Cloud Run, Cloud SQL PostgreSQL, Memorystore Redis, GCS for game bundles, Terraform

**The current v1 SDK contract** (in `packages/runtime-sdk/src/types.ts`):
```ts
interface SloppyGame {
  init(container: HTMLElement): void | Promise<void>;
  update(deltaTime: number): void;
  destroy(): void;
  supportsMultiplayer: boolean;
  getInitialState?(): Record<string, unknown>;
  applyPlayerInput?(playerId: string, input: unknown): void;
  updateState?(state: Record<string, unknown>): void;
  serializeState?(): Record<string, unknown>;
}
```

**Problem:** v1 games have no lifecycle management — no start screen, no pause, no game-over screen, no restart. The React shell tries to overlay UI on top of game iframes, causing z-index conflicts and broken state. Games need to own their own screens.

## Build Objective

Replace the v1 SDK contract with a comprehensive v2 contract that enforces a full game state machine. Update all shared types to support the new dual-engine model (Phaser 3 + Three.js), game metadata, and expanded generation phases.

## Specific Deliverables

### 1. Replace the SDK v2 contract (`packages/runtime-sdk/src/types.ts`)

Replace the current `SloppyGame` interface with `SloppyGameV2`:

```ts
interface SloppyGameV2 {
  // Lifecycle
  init(container: HTMLElement, config: GameInitConfig): Promise<void>;
  destroy(): void;

  // State Machine
  start(): void;           // IDLE → INTRO → PLAYING
  pause(): void;           // PLAYING → PAUSED
  resume(): void;          // PAUSED → PLAYING
  restart(): void;         // ANY → PLAYING (reset all state)

  // Screen Rendering (AI must implement each)
  renderIntroScreen(): void;
  renderPauseScreen(): void;
  renderGameOverScreen(score: GameResult): void;
  renderHUD(): void;

  // State Introspection
  getState(): GameState;
  getScore(): GameResult;

  // Metadata
  readonly metadata: GameMetadata;

  // Multiplayer
  readonly supportsMultiplayer: boolean;
  multiplayerHooks?: MultiplayerHooks;
}
```

Add these supporting types in the same file:
- `GameState` — `'idle' | 'intro' | 'playing' | 'paused' | 'gameover'`
- `GameInitConfig` — `{ container: HTMLElement; width: number; height: number }`
- `GameMetadata` — `{ title, genre, engine ('phaser3' | 'threejs'), supportsMultiplayer, maxPlayers?, controls: ControlHint[], estimatedPlayTime }`
- `ControlHint` — `{ key: string; action: string }`
- `GameResult` — `{ score: number; level?: number; timeElapsed: number; customData?: Record<string, unknown> }`
- `MultiplayerHooks` — `{ getInitialState, applyPlayerInput, updateState, serializeState, onPlayerJoin, onPlayerLeave }`
- `GameGenre` — union of `'2d-platformer' | '2d-topdown' | '2d-puzzle' | '2d-arcade' | '3d-firstperson' | '3d-thirdperson' | '3d-racing' | '3d-puzzle'`
- `GameEngine` — `'phaser3' | 'threejs'`

Keep the old `SloppyGame` interface exported as `SloppyGameV1` for backward compatibility.

Update `GameConfig` to v2:
```ts
interface GameConfig {
  title: string;
  version: string;
  engine: GameEngine;
  genre: GameGenre;
  supportsMultiplayer: boolean;
  maxPlayers?: number;
  controls: ControlHint[];
  resolution: { width: number; height: number; scaleMode: 'fit' | 'fill' | 'stretch' };
  assets: string[];
  audio?: string[];
  estimatedPlayTime?: string;
}
```

### 2. Update the runtime validator (`packages/runtime-sdk/src/validator.ts`)

Update `validateGameModule()` to check for all v2 required methods: `init`, `destroy`, `start`, `pause`, `resume`, `restart`, `renderIntroScreen`, `renderPauseScreen`, `renderGameOverScreen`, `getState`, `getScore`.

Update `validateGameSource()` to check for these method names in source code via regex patterns (same approach as current, but expanded list).

### 3. Update the config schema (`packages/runtime-sdk/src/schema.ts`)

Update the JSON schema for `config.json` to include the new fields: `engine`, `genre`, `controls`, `resolution`, `estimatedPlayTime`.

### 4. Update shared types (`packages/shared/src/types/game.ts`)

Add `genre`, `engine`, `thumbnailUrl` fields to the `Game` type. Add `genre` and `engine` to `GameFeedItem`. Export `GameGenre` and `GameEngine` from shared.

### 5. Update generation types (`packages/shared/src/types/generation.ts`)

Expand `GenerationPhase` to include the new agent phases:
```ts
type GenerationPhase = 'concept' | 'planning' | 'coding' | 'validating' | 'fixing' | 'polishing' | 'multiplayer' | 'audio' | 'thumbnail' | 'building';
```

Add `GenerationEvent` type for the richer SSE events:
```ts
type GenerationEvent =
  | { type: 'phase'; phase: GenerationPhase }
  | { type: 'progress'; percent: number; message: string }
  | { type: 'iteration'; attempt: number; maxAttempts: number; error: string }
  | { type: 'screenshot'; state: GameState; imageBase64: string }
  | { type: 'complete'; gameId: string }
  | { type: 'failed'; reason: string; attempts: number };
```

### 6. Update barrel exports

Update `packages/runtime-sdk/src/index.ts` and `packages/shared/src/index.ts` to export all new types.

## Constraints

- Keep `SloppyGameV1` exported for backward compatibility — existing games should still load
- All new types must be fully documented with JSDoc
- The `GameConfig` schema must be backward-compatible: old configs without `engine`/`genre` should still validate (default `engine: 'canvas2d'` for v1 games)
- Export everything from barrel `index.ts` files
- Do NOT modify any service code yet — this prompt only touches packages

## Files Modified
- `packages/runtime-sdk/src/types.ts`
- `packages/runtime-sdk/src/validator.ts`
- `packages/runtime-sdk/src/schema.ts`
- `packages/runtime-sdk/src/index.ts`
- `packages/shared/src/types/game.ts`
- `packages/shared/src/types/generation.ts`
- `packages/shared/src/types/api.ts`
- `packages/shared/src/types/index.ts`
- `packages/shared/src/index.ts`

---

---

# PROMPT 2: Database Schema v2

## Full System Context

Sloppy is an AI-powered browser game platform. The v1 platform is fully built. We are upgrading to v2 which adds: a game store UI, TikTok feed, monetisation (Stripe subscriptions + ad revenue + creator payouts), game progress saving, and expanded game metadata.

**Already built (v1 complete + Prompt 1):**
- Full v1 platform (all services, frontend, infrastructure)
- `packages/runtime-sdk` — updated with SDK v2 contract (`SloppyGameV2`, `GameMetadata`, `GameResult`, `GameState`, `GameGenre`, `GameEngine`)
- `packages/shared` — updated types with new generation phases, `GameGenre`, `GameEngine`

**Current database schema** (in `packages/db/src/schema.ts`):
- `users` — id, firebase_uid, email, display_name, created_at
- `games` — id, creator_id, title, description, slug, supports_multiplayer, version, status, play_count, storage_path, created_at, updated_at, deleted_at
- `favourites` — user_id, game_id, created_at (composite PK)
- `generation_logs` — id, user_id, game_id, model, phase, prompt_tokens, completion_tokens, total_cost, duration_ms, status, error, created_at
- `game_crash_logs` — id, game_id, user_id, error_message, stack_trace, created_at
- `sessions` — id, game_id, host_id, status, player_count, max_players, created_at, closed_at

**Current migrations** in `packages/db/drizzle/`:
- `0000_initial.sql` — users, games, favourites, sessions
- `0001_observability.sql` — generation_logs, game_crash_logs

## Build Objective

Extend the database schema to support v2 features: expanded game metadata, game progress saving, creator earnings/payouts, feed analytics, and creator subscriptions.

## Specific Deliverables

### 1. Add columns to `games` table (`packages/db/src/schema.ts`)

Add these columns to the existing `games` table:
- `genre` — text, nullable (for backward compat with v1 games)
- `engine` — text, default `'canvas2d'` (v1 games used raw canvas)
- `thumbnail_url` — text, nullable
- `thumbnail_sm_url` — text, nullable (300x169 card thumbnail)
- `resolution_width` — integer, default 960
- `resolution_height` — integer, default 540
- `scale_mode` — text, default `'fit'`
- `favourite_count` — integer, default 0 (denormalized for feed performance)

Add index: `games_genre_idx` on `genre`, `games_engine_idx` on `engine`.

### 2. Add new tables

**`game_progress`** — per-user game progress saving:
```
user_id       TEXT NOT NULL (FK→users)
game_id       TEXT NOT NULL (FK→games)
progress_data JSONB
play_time_ms  INTEGER DEFAULT 0
last_played   TIMESTAMPTZ DEFAULT NOW()
play_count    INTEGER DEFAULT 0
PRIMARY KEY (user_id, game_id)
```

**`creator_earnings`** — monthly ad revenue tracking per creator per game:
```
id              TEXT PRIMARY KEY
creator_id      TEXT NOT NULL (FK→users)
game_id         TEXT (FK→games)
period_month    DATE NOT NULL
gross_revenue   DECIMAL(10,2)
creator_share   DECIMAL(10,2)
platform_share  DECIMAL(10,2)
status          TEXT DEFAULT 'pending' (pending/confirmed/paid)
created_at      TIMESTAMPTZ DEFAULT NOW()
```

**`creator_stripe_accounts`** — Stripe Connect account info:
```
creator_id          TEXT PRIMARY KEY (FK→users)
stripe_account_id   TEXT UNIQUE
onboarding_complete BOOLEAN DEFAULT FALSE
payout_balance      DECIMAL(10,2) DEFAULT 0
total_paid_out      DECIMAL(10,2) DEFAULT 0
created_at          TIMESTAMPTZ DEFAULT NOW()
```

**`creator_subscriptions`** — Stripe Billing subscription state:
```
creator_id          TEXT PRIMARY KEY (FK→users)
stripe_customer_id  TEXT
stripe_sub_id       TEXT
status              TEXT (active/past_due/canceled)
current_period_end  TIMESTAMPTZ
created_at          TIMESTAMPTZ DEFAULT NOW()
```

**`feed_events`** — feed analytics for the ranking algorithm:
```
id          TEXT PRIMARY KEY
user_id     TEXT (nullable, for anonymous tracking)
game_id     TEXT NOT NULL (FK→games)
event_type  TEXT NOT NULL (view/play_start/play_time/skip/favourite)
duration_ms INTEGER
created_at  TIMESTAMPTZ DEFAULT NOW()
```
Index: `feed_events_game_id_idx`, `feed_events_created_at_idx`, `feed_events_event_type_idx`.

**`ad_impressions`** — ad revenue tracking per impression:
```
id                TEXT PRIMARY KEY
ad_provider       TEXT NOT NULL (adinplay/adsense)
format            TEXT NOT NULL
game_id           TEXT (FK→games, nullable for platform inventory)
creator_id        TEXT (FK→users, nullable)
estimated_revenue DECIMAL(10,4)
created_at        TIMESTAMPTZ DEFAULT NOW()
```

### 3. Add full-text search to `games`

Add a generated `tsvector` column or implement full-text search in the `GameRepository` using PostgreSQL `to_tsvector` on `title || ' ' || description`.

### 4. Create migration file

Create `packages/db/drizzle/0002_v2.sql` with all schema changes.

### 5. Create new repositories (`packages/db/src/repositories/`)

- `game-progress.ts` — `createGameProgressRepository(db)`: `save(userId, gameId, data)`, `get(userId, gameId)`, `getByUser(userId)`
- `creator-earnings.ts` — `createCreatorEarningsRepository(db)`: `create(...)`, `getByCreator(creatorId)`, `getByPeriod(creatorId, month)`, `getTotalBalance(creatorId)`
- `creator-stripe.ts` — `createCreatorStripeRepository(db)`: `upsert(creatorId, stripeAccountId)`, `get(creatorId)`, `updateBalance(creatorId, amount)`
- `creator-subscription.ts` — `createCreatorSubscriptionRepository(db)`: `upsert(...)`, `get(creatorId)`, `isActive(creatorId)`
- `feed-event.ts` — `createFeedEventRepository(db)`: `create(...)`, `getTrendingGameIds(hours)`, `getPlayCounts(gameIds)`

### 6. Update existing `GameRepository` (`packages/db/src/repositories/game.ts`)

- Add `search(query, filters, cursor, limit)` method using full-text search
- Add `getByGenre(genre, cursor, limit)` method
- Add `getByEngine(engine, cursor, limit)` method
- Add `getTrending(hours, limit)` method using feed_events aggregate
- Update `getFeed` to support diversity penalty (avoid same genre consecutively)
- Add `updateThumbnail(gameId, thumbnailUrl, thumbnailSmUrl)` method
- Add `incrementFavouriteCount(gameId)` / `decrementFavouriteCount(gameId)` methods

### 7. Update mappers (`packages/db/src/mappers.ts`)

Update `mapGame` to include new fields: `genre`, `engine`, `thumbnailUrl`, `thumbnailSmUrl`, `favouriteCount`.

### 8. Update barrel exports (`packages/db/src/index.ts`, `packages/db/src/repositories/index.ts`)

Export all new repositories and types.

## Constraints

- All new columns on `games` must be nullable or have defaults for backward compatibility
- Use cursor-based pagination for all new list queries
- All timestamps in UTC
- Migration must be safe to run on a database with existing data
- Repository functions must return types from `@sloppy/shared`

## Files Modified
- `packages/db/src/schema.ts`
- `packages/db/src/mappers.ts`
- `packages/db/src/repositories/game.ts`
- `packages/db/src/repositories/index.ts`
- `packages/db/src/index.ts`

## Files Created
- `packages/db/drizzle/0002_v2.sql`
- `packages/db/src/repositories/game-progress.ts`
- `packages/db/src/repositories/creator-earnings.ts`
- `packages/db/src/repositories/creator-stripe.ts`
- `packages/db/src/repositories/creator-subscription.ts`
- `packages/db/src/repositories/feed-event.ts`

---

---

# PROMPT 3: Validation Pipeline v2

## Full System Context

Sloppy is an AI-powered browser game platform. We are upgrading to v2 with a full game lifecycle contract and runtime validation.

**Already built (v1 complete + Prompts 1-2):**
- Full v1 platform
- `packages/runtime-sdk` — SDK v2 contract with `SloppyGameV2` (11 required methods: init, destroy, start, pause, resume, restart, renderIntroScreen, renderPauseScreen, renderGameOverScreen, getState, getScore)
- `packages/db` — v2 schema with new tables and columns

**Current validation pipeline** (in `services/game-builder/src/validation/pipeline.ts`):
- Checks: required files exist (index.html, game.js, config.json)
- Checks: game.js has `init`, `update`, `destroy` methods via regex
- Checks: no forbidden patterns (eval, external fetch, document.cookie, localStorage, sessionStorage)
- Checks: bundle size < 5MB
- Checks: config.json validates against JSON schema
- Checks: JS syntax via `new Function()`

**Current GCS storage** (in `services/game-builder/src/storage/gcs.ts`):
- Uploads to `games/{gameId}/v{version}/` path
- Files: index.html, game.js, config.json, assets/*

**v2 requirements:**
- Validate all 11 SDK v2 methods exist in source
- Runtime validation: spawn headless Puppeteer, load game, drive through state machine (init → start → pause → resume → game-over → restart), capture screenshots, check for console errors
- Store screenshots alongside game bundle in GCS
- Screenshots become preview images on game cards

## Build Objective

Replace the v1 static validation with v2 compliance checks and add a Puppeteer-based runtime validation service that tests games through their entire state machine and captures screenshots.

## Specific Deliverables

### 1. Update static validation (`services/game-builder/src/validation/pipeline.ts`)

Replace the v1 `requiredMethods = ['init', 'update', 'destroy']` with v2 required methods:
```ts
const REQUIRED_METHODS_V2 = [
  'init', 'destroy', 'start', 'pause', 'resume', 'restart',
  'renderIntroScreen', 'renderPauseScreen', 'renderGameOverScreen',
  'getState', 'getScore'
];
```

Update the regex-based method detection to check for all v2 methods. Keep backward compatibility: if `config.json` has no `engine` field (v1 game), use the old v1 method list.

Update the config schema validation to accept the new v2 `GameConfig` fields (engine, genre, controls, resolution).

### 2. Create runtime validator (`services/game-builder/src/validation/runtime-validator.ts`)

New module that:
- Spawns a headless Puppeteer (Chrome) instance
- Loads the game's `index.html` from a local temp directory or inline
- Drives the game through its state machine via `postMessage` or direct JS execution:
  1. Wait for `init()` to complete (listen for `sloppy:game:ready` postMessage)
  2. Call `start()` → verify `getState()` returns `'playing'`
  3. Wait 2 seconds for game to run
  4. Call `pause()` → verify `getState()` returns `'paused'` → screenshot
  5. Call `resume()` → verify `getState()` returns `'playing'`
  6. Simulate game over (call a test helper or wait for natural game over)
  7. Call `restart()` → verify `getState()` returns `'playing'`
- Capture screenshots at each state: intro, playing, paused, gameover
- Capture all console errors
- Return structured result:

```ts
interface RuntimeValidationResult {
  passed: boolean;
  states: {
    intro: { rendered: boolean; screenshot?: Buffer };
    playing: { rendered: boolean; screenshot?: Buffer };
    paused: { rendered: boolean; screenshot?: Buffer };
    gameover: { rendered: boolean; screenshot?: Buffer };
  };
  consoleErrors: string[];
  crashedDuring?: string;
  fps?: number;
}
```

- Timeout: 30 seconds total
- Clean up Puppeteer instance after each validation

### 3. Create screenshot capture utility (`services/game-builder/src/validation/screenshot-capture.ts`)

Helper that takes Puppeteer page screenshots and returns Buffer + dimensions. Used by the runtime validator. Handles:
- PNG screenshot at 1280x720 resolution
- Thumbnail generation (resize to 300x169 for card previews)

### 4. Update game creation flow (`services/game-builder/src/routes/games.ts`)

After static validation passes, run the runtime validator. If runtime validation fails:
- Return the validation errors + screenshots to the caller (ai-orchestrator will use these for the debug loop)
- Do NOT store the game

If runtime validation passes:
- Upload screenshots to GCS: `games/{gameId}/v{version}/screenshots/intro.png`, `playing.png`, `paused.png`, `gameover.png`
- Update the game record with `thumbnail_url` pointing to the `playing.png` screenshot as a fallback thumbnail

### 5. Update GCS storage (`services/game-builder/src/storage/gcs.ts`)

Add `uploadScreenshots(gameId, version, screenshots)` function that uploads the screenshot buffers to GCS.

### 6. Install Puppeteer

Add `puppeteer` to `services/game-builder/package.json` dependencies.

## Constraints

- Puppeteer validation must not block the response — if called from the AI orchestrator's debug loop, return results synchronously; if called from manual game creation, can be async
- Puppeteer instances must be properly cleaned up (close browser after each validation)
- Keep a warm Puppeteer browser instance to avoid cold start overhead (reuse browser, create new pages)
- Runtime validation is optional for v1 games (only enforced when `config.engine` is set)
- Screenshots saved as PNG, max 1280x720
- Total validation timeout: 30 seconds
- Add `.env.example` updates for `PUPPETEER_EXECUTABLE_PATH` (optional, for Docker)

## Files Modified
- `services/game-builder/src/validation/pipeline.ts`
- `services/game-builder/src/routes/games.ts`
- `services/game-builder/src/storage/gcs.ts`
- `services/game-builder/package.json`

## Files Created
- `services/game-builder/src/validation/runtime-validator.ts`
- `services/game-builder/src/validation/screenshot-capture.ts`

---

---

# PROMPT 4: Multi-Agent Pipeline — Concept Architect & Technical Planner

## Full System Context

Sloppy is an AI-powered browser game platform upgrading from v1 single-pass generation to a v2 multi-agent pipeline.

**Already built (v1 complete + Prompts 1-3):**
- Full v1 platform
- SDK v2 contract with full lifecycle
- Database v2 schema
- Validation pipeline v2 with Puppeteer runtime tests

**Current AI orchestrator pipeline** (in `services/ai-orchestrator/src/pipeline/orchestrator.ts`):
- Single-pass: concept → code → assets → multiplayer → music
- `runPipeline()` calls each phase sequentially, streams SSE progress
- Uses `withRetry()` for simple retry (max 2 retries per phase)
- Hands off to game-builder via POST `/games`

**Current concept phase** (in `services/ai-orchestrator/src/pipeline/concept.ts` + `services/ai-orchestrator/src/prompts/concept.ts`):
- Simple prompt: "Design a browser game concept"
- Output: `GameConcept` (title, description, mechanics, visualStyle, supportsMultiplayer, assets, controls, winCondition, difficulty)

**Current code phase** (in `services/ai-orchestrator/src/pipeline/code.ts` + `services/ai-orchestrator/src/prompts/code.ts`):
- Single prompt with the full `SloppyGame` interface
- Generates `game.js` using Canvas 2D API only
- One retry if validation fails

**v2 pipeline architecture:**
```
Prompt → [Concept Architect] → [Technical Planner] → [Code Generator] → [Validator] → [Debug Loop] → [Polish] → [Multiplayer Injector] → [Audio] → [Thumbnail] → [Deploy]
```

## Build Objective

Create the first two agents (Concept Architect and Technical Planner) and refactor the pipeline orchestrator to use the new multi-agent architecture.

## Specific Deliverables

### 1. Define new pipeline types (`services/ai-orchestrator/src/pipeline/types.ts`)

Replace the current `GameConcept` with a comprehensive GDD (Game Design Document):

```ts
interface GameDesignDocument {
  title: string;
  logline: string;
  engine: 'phaser3' | 'threejs';
  genre: GameGenre;
  template?: string;
  visualStyle: string;
  coreMechanic: string;
  controls: Array<{ key: string; action: string }>;  // e.g. [{ key: 'Arrow Keys', action: 'Move' }, { key: 'Space', action: 'Jump' }]
  progression: string;
  scoring: string;
  gameOverCondition: string;
  restartBehavior: string;
  screens: {
    intro: string;
    hud: string;
    pause: string;
    gameOver: string;
  };
  multiplayer: {
    suitable: boolean;
    mode?: 'competitive' | 'cooperative' | 'versus';
    description?: string;
    maxPlayers?: number;
    syncStrategy?: 'state-sync' | 'input-relay' | 'lockstep';
  };
  objects: Array<{ name: string; description: string }>;
  complexity: 'simple' | 'medium' | 'complex';
  estimatedGenerationTimeSeconds: number;
}
```

Add `TechnicalSpec`:

```ts
interface TechnicalSpec {
  fileStructure: string;
  engineVersion: string;
  modules: Array<{ name: string; responsibility: string }>;
  criticalApis: string[];
  performanceConstraints: string[];
  sdkV2Mapping: {
    init: string;
    start: string;
    pause: string;
    resume: string;
    restart: string;
    destroy: string;
  };
}
```

Update `PipelineContext` to include: `gdd?: GameDesignDocument`, `spec?: TechnicalSpec`, and expand `tokenUsage`.

Keep `GameConcept` as a type alias or adapter for backward compat.

### 2. Create Concept Architect agent (`services/ai-orchestrator/src/agents/concept-architect.ts`)

New module with:
- `runConceptArchitect(prompt, llm, onProgress)` function
- System prompt that:
  - Analyzes the user prompt
  - Determines 2D vs 3D, selects engine (Phaser 3 or Three.js)
  - Determines genre from the `GameGenre` union type
  - Selects appropriate controls/input scheme (keyboard, mouse, pointer, mixed, touch) based on genre and mechanic
  - Evaluates multiplayer suitability
  - Outputs a structured GDD as JSON
- Must include engine selection logic in the prompt: "Choose Phaser 3 for 2D games and Three.js for 3D games"
- Must include controls/input selection guide: keyboard (arrow keys/WASD) for movement games, mouse/click for puzzle/idle/tower-defense, WASD+mouse for FPS, etc.
- Must include the full GDD JSON schema in the system prompt (including `controls` array with `{ key, action }` entries)
- Must include fallback logic: if the LLM omits `controls`, infer defaults from the genre
- Uses `llm.generateJSON<GameDesignDocument>()` from the existing LLM client (`services/ai-orchestrator/src/llm/index.ts`)

### 3. Create Technical Planner agent (`services/ai-orchestrator/src/agents/technical-planner.ts`)

New module with:
- `runTechnicalPlanner(gdd, llm, onProgress)` function
- Receives the GDD from the Concept Architect
- System prompt that:
  - Reads the GDD
  - Plans exact code modules and their responsibilities
  - Writes pseudocode/plan for each system (rendering, physics, game loop, HUD, screens)
  - Identifies which engine APIs are needed
  - Maps SDK v2 lifecycle methods to engine-specific implementations
  - Outputs a `TechnicalSpec` as JSON
- Must include the SDK v2 contract in the system prompt
- Must include engine-specific API guidance (Phaser scenes vs Three.js scene graph)

### 4. Refactor pipeline orchestrator (`services/ai-orchestrator/src/pipeline/orchestrator.ts`)

Replace the current phase sequence with the new multi-agent pipeline:

```
1. Concept Architect → produces GDD
2. Technical Planner → produces TechnicalSpec
3. Code Generator (existing, will be refactored in Prompt 5)
4. Static + Runtime Validation
5. Debug & Fix Loop (Prompt 7)
6. Polish Pass (Prompt 7)
7. Multiplayer Injection (Prompt 9)
8. Audio Generation (Prompt 10)
9. Thumbnail Generation (Prompt 11)
10. Final Build → Deploy
```

For now, implement steps 1-2, keep existing code/assets/multiplayer/music phases, and add placeholders for future phases. Update the SSE progress events to emit the new phase names.

Update the `runPipeline()` function to:
- Run Concept Architect first, store GDD in context
- Run Technical Planner second, store spec in context
- Pass GDD and spec to subsequent phases
- Emit new `GenerationEvent` types via SSE

### 5. Update SSE session manager (`services/ai-orchestrator/src/session/manager.ts`)

Update `updateProgress()` to support the expanded `GenerationPhase` type from `@sloppy/shared`. Add `publishIteration(sessionId, attempt, maxAttempts, error)` and `publishScreenshot(sessionId, state, imageBase64)` methods for the debug loop (used in Prompt 7).

## Constraints

- The LLM client (`services/ai-orchestrator/src/llm/index.ts`) is shared — do NOT create a new LLM client, use the existing one
- Each agent must be in its own file under `services/ai-orchestrator/src/agents/`
- System prompts must be comprehensive but not exceed 4000 tokens
- GDD output must be valid JSON parseable by `llm.generateJSON()`
- Keep existing phases working — the code/assets/multiplayer phases should still function (they'll be refactored in later prompts)
- Each agent logs its execution via `@sloppy/logger`

## Files Modified
- `services/ai-orchestrator/src/pipeline/types.ts`
- `services/ai-orchestrator/src/pipeline/orchestrator.ts`
- `services/ai-orchestrator/src/session/manager.ts`

## Files Created
- `services/ai-orchestrator/src/agents/concept-architect.ts`
- `services/ai-orchestrator/src/agents/technical-planner.ts`

---

---

# PROMPT 5: Code Generator Refactor (Dual-Engine)

## Full System Context

Sloppy is an AI-powered browser game platform upgrading to v2 with dual-engine support (Phaser 3 + Three.js).

**Already built (v1 complete + Prompts 1-4):**
- SDK v2 contract with full lifecycle, `GameMetadata`, `GameGenre`, `GameEngine`
- Database v2 schema with engine/genre columns
- Validation pipeline v2 with Puppeteer runtime tests
- Concept Architect agent (outputs GDD with engine selection)
- Technical Planner agent (outputs TechnicalSpec with module plan)
- Refactored pipeline orchestrator

**Current code generation** (in `services/ai-orchestrator/src/pipeline/code.ts` + `services/ai-orchestrator/src/prompts/code.ts`):
- Single `CODE_SYSTEM_PROMPT` hardcoded for Canvas 2D API
- `buildCodeUserPrompt(concept)` builds from the old `GameConcept` format
- Validates with `@sloppy/runtime-sdk` validator, one retry on failure
- Output: raw JavaScript string

**v2 code generation requirements:**
- Takes the GDD + TechnicalSpec as input (not just the old `GameConcept`)
- Routes to engine-specific prompt libraries (Phaser 3 or Three.js)
- Generates code implementing the SDK v2 contract (all lifecycle methods, screens)
- Outputs a single self-contained HTML file with CDN imports for the engine
- Uses chain-of-thought reasoning in the prompt

## Build Objective

Refactor the code generation phase to be spec-driven with dual-engine support (Phaser 3 and Three.js), implementing the full SDK v2 lifecycle contract.

## Specific Deliverables

### 1. Create Phaser 3 prompt library (`services/ai-orchestrator/src/prompts/engines/phaser3.ts`)

Engine-specific system prompt content for Phaser 3 games:
- Phaser 3 scene structure (Boot, Intro, Game, Pause, GameOver scenes)
- How to map SDK v2 lifecycle to Phaser scene transitions
- Phaser-specific quality rules (particle effects, tweens, camera effects)
- CDN import: `https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js`
- Standard resolution: 960x540
- Required: `window.SloppyGame = { init, destroy, start, pause, resume, restart, renderIntroScreen, renderPauseScreen, renderGameOverScreen, getState, getScore, metadata, supportsMultiplayer }`

Export `PHASER3_SYSTEM_PROMPT`, `PHASER3_QUALITY_RULES`, `PHASER3_FORBIDDEN_PATTERNS`.

### 2. Create Three.js prompt library (`services/ai-orchestrator/src/prompts/engines/threejs.ts`)

Engine-specific system prompt content for Three.js games:
- Three.js scene setup (renderer, camera, lighting, shadows)
- Post-processing defaults (bloom, tone mapping)
- How to map SDK v2 lifecycle to Three.js render loop management
- Three.js-specific quality rules from the v2 spec:
  - Always enable shadows + ACES filmic tone mapping
  - Always use MeshStandardMaterial (never MeshBasicMaterial)
  - Always add fog for depth
  - Never create new THREE objects inside game loop
  - Camera smoothing via lerp
- CDN imports for Three.js + post-processing
- Standard resolution: 1280x720
- Performance constraints: max 10,000 triangles, dispose on destroy

Export `THREEJS_SYSTEM_PROMPT`, `THREEJS_QUALITY_RULES`, `THREEJS_FORBIDDEN_PATTERNS`.

### 3. Create prompt index (`services/ai-orchestrator/src/prompts/engines/index.ts`)

Router that selects the correct engine prompt based on `gdd.engine`:
```ts
function getEnginePrompt(engine: GameEngine): { systemPrompt: string; qualityRules: string; forbiddenPatterns: string }
```

### 4. Refactor code generation phase (`services/ai-orchestrator/src/pipeline/code.ts`)

Rewrite `runCodePhase()` to:
- Accept `gdd: GameDesignDocument` and `spec: TechnicalSpec` instead of old `GameConcept`
- Select engine prompt via `getEnginePrompt(gdd.engine)`
- Build a composite system prompt: SDK v2 contract + engine-specific prompt + quality rules
- Build user prompt from GDD + spec (not the old concept format)
- Include chain-of-thought instruction: "Before writing ANY code, reason through: 1. What is the game loop structure? 2. What scenes/modules do I need? 3. How does the state machine map to engine scene transitions?"
- Generate a single self-contained HTML file (not just game.js) with engine CDN import in `<head>`
- Validate using the updated v2 validator
- On validation failure, use `buildCodeRetryPrompt()` with the specific errors

### 5. Update code prompts (`services/ai-orchestrator/src/prompts/code.ts`)

Replace `CODE_SYSTEM_PROMPT` with a new `buildCodeSystemPrompt(engine, gdd, spec)` function that composes:
1. SDK v2 contract definition
2. Engine-specific system prompt
3. Quality rules
4. Chain-of-thought instruction
5. Output format requirements

Update `buildCodeUserPrompt()` to accept GDD + spec instead of old GameConcept.

Update `buildCodeRetryPrompt()` to include GDD context and specific validation errors.

### 6. Update the HTML builder in the orchestrator

The current `buildHtml()` function in `services/ai-orchestrator/src/pipeline/orchestrator.ts` generates a wrapper HTML. For v2, the code generator should output the full HTML file directly (with CDN imports). Update the pipeline to use the code generator's HTML output instead of wrapping `game.js` in a template.

## Constraints

- The generated HTML must be a single self-contained file with engine loaded via CDN `<script>` tag
- All game code inline in `<script>` tags (no module imports, no build step)
- CDN URLs must be version-pinned (e.g., `phaser@3.80.1`, `three@0.160.0`)
- Generated code MUST implement all 11 SDK v2 required methods and assign to `window.SloppyGame`
- Forbidden patterns: `eval()`, `new Function()`, `fetch()` to external URLs, `importScripts()`
- Max output tokens: configurable, default 12000 for code phase (up from 8000 in v1)
- The code generator must NOT use external asset files — all visuals via engine APIs (shapes, colors, procedural)

## Files Modified
- `services/ai-orchestrator/src/pipeline/code.ts`
- `services/ai-orchestrator/src/prompts/code.ts`
- `services/ai-orchestrator/src/pipeline/orchestrator.ts`

## Files Created
- `services/ai-orchestrator/src/prompts/engines/phaser3.ts`
- `services/ai-orchestrator/src/prompts/engines/threejs.ts`
- `services/ai-orchestrator/src/prompts/engines/index.ts`

---

---

# PROMPT 6: Genre Prompt Libraries & Screen Templates

## Full System Context

Sloppy is an AI-powered browser game platform upgrading to v2 with genre-specific AI prompts.

**Already built (v1 complete + Prompts 1-5):**
- SDK v2 contract, database v2, validation v2
- Concept Architect (outputs GDD with genre), Technical Planner
- Dual-engine code generator (Phaser 3 + Three.js prompt libraries)
- Pipeline orchestrator refactored for multi-agent flow

**Current prompt structure** (`services/ai-orchestrator/src/prompts/`):
- `concept.ts` — concept system prompt
- `code.ts` — code system prompt (now v2 with engine routing)
- `assets.ts` — asset generation prompt
- `multiplayer.ts` — multiplayer injection prompt
- `engines/phaser3.ts` — Phaser 3 engine prompt
- `engines/threejs.ts` — Three.js engine prompt

**v2 addition:** Genre-specific prompt templates that give the AI detailed patterns for each game genre (platformer physics, top-down movement, racing camera, etc.) and screen rendering templates for intro/pause/gameover screens.

## Build Objective

Create genre-specific prompt libraries and screen rendering templates that the code generator injects based on the GDD's genre and engine selection.

## Specific Deliverables

### 1. Create genre prompt templates (`services/ai-orchestrator/src/prompts/genres/`)

Each file exports a genre-specific prompt fragment that gets injected into the code generator's system prompt. Each contains:
- Core mechanic patterns (physics, movement, collision)
- Common object archetypes for the genre
- Scoring patterns
- Difficulty progression patterns

Files (2D — Phaser 3):
- `platformer-2d.ts` — jump physics, gravity, platform collision, parallax scrolling, collectibles
- `topdown-2d.ts` — 8-directional movement, tile-based or free movement, enemy AI patterns, projectiles
- `puzzle-2d.ts` — grid systems, match mechanics, drag-and-drop, clear conditions
- `arcade-2d.ts` — simple controls, score chasing, increasing speed/difficulty, lives system
- `shooter-2d.ts` — auto-scrolling, bullet patterns (single/spread/circle/aimed), wave spawning, weapon tiers
- `tower-defense-2d.ts` — waypoint paths, grid tower placement, tower types (basic/splash/slow/sniper), economy
- `endless-runner-2d.ts` — auto-run, jump/duck, procedural obstacles, ground tileSprite scrolling, parallax
- `rhythm-2d.ts` — beat maps, hit zone timing windows (Perfect/Good/Miss), lane system, combo multiplier
- `cards-2d.ts` — card hand management, turn-based phases, card effects, opponent AI, mana/energy
- `idle-2d.ts` — click generation, passive income generators, exponential cost scaling, prestige, number formatting
- `custom-2d.ts` — generic 2D guide for novel/hybrid concepts that don't fit specific genres

Files (3D — Three.js):
- `racing-3d.ts` — track generation, vehicle physics, lap counting, camera follow
- `fps-3d.ts` — pointer lock, raycasting, projectile physics, enemy spawning
- `puzzle-3d.ts` — object interaction, camera orbit, spatial puzzles
- `endless-runner-3d.ts` — procedural track segments, obstacle spawning, lane switching
- `flight-3d.ts` — pitch/yaw/roll controls, throttle, projectile pools, starfield, enemy ships
- `platformer-3d.ts` — third-person orbit camera, camera-relative movement, manual gravity, platform AABB collision
- `custom-3d.ts` — generic 3D guide for novel/hybrid concepts that don't fit specific genres

Router:
- `index.ts` — `getGenrePrompt(genre: GameGenre): string` router with `Record<GameGenre, string>` (compile-time completeness check)

### 2. Create screen rendering templates (`services/ai-orchestrator/src/prompts/screens/`)

Each file exports prompt fragments describing how to render specific game screens on the canvas.

Files:
- `intro.ts` — patterns for rendering title screen (centered title text, "Press Start" prompt, controls hint, high score display, animated background)
- `pause.ts` — patterns for rendering pause overlay (semi-transparent backdrop, "PAUSED" text, resume/restart/quit buttons, game state preserved behind)
- `gameover.ts` — patterns for rendering game-over screen (final score display, high score comparison, "Play Again" button, back-to-menu option)
- `hud.ts` — patterns for rendering in-game HUD (score counter, health/lives, timer, level indicator, positioned with engine-appropriate methods)
- `index.ts` — `getScreenPrompts(): { intro: string; pause: string; gameover: string; hud: string }` that returns all screen templates

### 3. Update the code generator prompt builder (`services/ai-orchestrator/src/prompts/code.ts`)

Update `buildCodeSystemPrompt()` to inject:
1. Genre-specific prompt fragment based on `gdd.genre`
2. Screen rendering templates for all four screens
3. The GDD's screen descriptions (from `gdd.screens.intro`, `gdd.screens.pause`, etc.)

The genre prompt should come after the engine prompt and before the quality rules.

### 4. Create a prompt index (`services/ai-orchestrator/src/prompts/index.ts`)

Update the existing prompt index to export the new genre and screen modules. Provide a unified `buildFullCodePrompt(gdd, spec)` function that composes everything:
```
SDK v2 Contract → Engine Prompt → Genre Prompt → Screen Templates → Quality Rules → GDD Context → Spec Context
```

## Constraints

- Each genre file should be under 1500 tokens of prompt text (concise patterns, not full implementations)
- Screen templates must be engine-agnostic where possible (describe the visual result, let the engine prompt handle the API specifics)
- Genre prompts for 3D genres should reference Three.js-specific APIs
- Genre prompts for 2D genres should reference Phaser 3-specific APIs
- All prompt fragments must be pure string exports (no LLM calls)

## Files Created
- `services/ai-orchestrator/src/prompts/genres/platformer-2d.ts`
- `services/ai-orchestrator/src/prompts/genres/topdown-2d.ts`
- `services/ai-orchestrator/src/prompts/genres/puzzle-2d.ts`
- `services/ai-orchestrator/src/prompts/genres/arcade-2d.ts`
- `services/ai-orchestrator/src/prompts/genres/shooter-2d.ts`
- `services/ai-orchestrator/src/prompts/genres/tower-defense-2d.ts`
- `services/ai-orchestrator/src/prompts/genres/endless-runner-2d.ts`
- `services/ai-orchestrator/src/prompts/genres/rhythm-2d.ts`
- `services/ai-orchestrator/src/prompts/genres/cards-2d.ts`
- `services/ai-orchestrator/src/prompts/genres/idle-2d.ts`
- `services/ai-orchestrator/src/prompts/genres/custom-2d.ts`
- `services/ai-orchestrator/src/prompts/genres/racing-3d.ts`
- `services/ai-orchestrator/src/prompts/genres/fps-3d.ts`
- `services/ai-orchestrator/src/prompts/genres/puzzle-3d.ts`
- `services/ai-orchestrator/src/prompts/genres/endless-runner-3d.ts`
- `services/ai-orchestrator/src/prompts/genres/flight-3d.ts`
- `services/ai-orchestrator/src/prompts/genres/platformer-3d.ts`
- `services/ai-orchestrator/src/prompts/genres/custom-3d.ts`
- `services/ai-orchestrator/src/prompts/genres/index.ts`
- `services/ai-orchestrator/src/prompts/screens/intro.ts`
- `services/ai-orchestrator/src/prompts/screens/pause.ts`
- `services/ai-orchestrator/src/prompts/screens/gameover.ts`
- `services/ai-orchestrator/src/prompts/screens/hud.ts`
- `services/ai-orchestrator/src/prompts/screens/index.ts`

## Files Modified
- `services/ai-orchestrator/src/prompts/code.ts`
- `services/ai-orchestrator/src/prompts/index.ts`
- `packages/runtime-sdk/src/types.ts` — `GameGenre` union expanded (8 → 18 genres)
- `packages/runtime-sdk/src/schema.ts` — JSON schema genre enum expanded (8 → 18 genres)
- `services/ai-orchestrator/src/agents/concept-architect.ts` — `GAME_GENRES` array + system prompt with genre selection guide

---

---

# PROMPT 7: Debug & Fix Agent + Polish Agent

## Full System Context

Sloppy is an AI-powered browser game platform upgrading to v2 with an iterative debug loop.

**Already built (v1 complete + Prompts 1-6):**
- SDK v2 contract, database v2, validation v2 with Puppeteer
- Multi-agent pipeline: Concept Architect → Technical Planner → Code Generator (dual-engine)
- Genre prompt libraries and screen templates
- Runtime validator that tests games through their state machine and captures screenshots

**Current retry logic** (in `services/ai-orchestrator/src/pipeline/orchestrator.ts`):
- Simple `withRetry()` function: tries the phase function, retries up to `config.generation.maxRetries` (default 2) times
- On retry, just re-runs the same function with no error context
- No screenshots passed back, no targeted fix instructions

**v2 debug loop:**
```
Code Generator → Validate → [if fail] → Debug Agent (receives errors + screenshots) → targeted fix → Validate → [repeat up to 5x] → [if pass] → Polish Agent → Deploy
```

## Build Objective

Create the Debug & Fix agent that receives validation errors and screenshots, applies targeted fixes, and iterates until the game passes all quality gates. Also create the Polish agent that improves visual quality on the final passing build.

## Specific Deliverables

### 1. Create Debug & Fix agent (`services/ai-orchestrator/src/agents/debug-fixer.ts`)

New module with:
- `runDebugFixer(context: DebugContext, llm, onProgress)` function

```ts
interface DebugContext {
  gdd: GameDesignDocument;
  spec: TechnicalSpec;
  currentCode: string;
  validationErrors: ValidationError[];   // From static validation
  runtimeErrors: RuntimeError[];         // From Puppeteer (console errors, state failures)
  screenshots: Record<string, string>;   // base64 screenshots per state
  iterationCount: number;
}
```

- System prompt strategy:
  - Receives the exact error message and the line of code that failed
  - Receives screenshots showing what rendered vs what was expected
  - Receives the original spec requirement that wasn't met
  - Instructed to FIX ONLY the failing part, not rewrite the entire game
  - Returns the corrected full code (not a diff)
- Must handle both static validation errors and runtime errors
- Must handle common failure modes:
  - Missing method implementations
  - State machine not transitioning correctly
  - Screen not rendering (blank during pause/gameover)
  - Console errors (undefined references, null access)
  - Performance issues (FPS too low for 3D games)

### 2. Create Polish agent (`services/ai-orchestrator/src/agents/polish-agent.ts`)

New module with:
- `runPolishAgent(code: string, gdd: GameDesignDocument, llm, onProgress)` function
- System prompt:
  - Reads the final working game code
  - Improves: color palette, animation smoothness, particle effects, screen transitions, juice effects (screen shake, flash)
  - Does NOT change game logic, scoring, or state machine
  - Returns the polished full code
- Only runs after the game passes all validation gates
- Optional: can be skipped for batch population games (cost saving)

### 3. Create iteration tracker (`services/ai-orchestrator/src/pipeline/iteration-tracker.ts`)

Utility class that tracks:
- Current iteration count
- History of errors per iteration
- Whether the game has passed
- Max iterations (default 5)
- Methods: `recordIteration(errors)`, `hasMoreAttempts()`, `getHistory()`, `markPassed()`

### 4. Refactor pipeline orchestrator (`services/ai-orchestrator/src/pipeline/orchestrator.ts`)

Update `runPipeline()` to implement the full debug loop:

```
1. Concept Architect → GDD
2. Technical Planner → Spec
3. Code Generator → initial code
4. Loop (max 5 iterations):
   a. Static Validation
   b. Runtime Validation (Puppeteer)
   c. If all pass → break
   d. Debug Agent → fixed code
   e. Back to 4a
5. If passed: Polish Agent → polished code
6. If failed after 5 iterations: mark as needs_review, fail gracefully
7. Continue to multiplayer/audio/thumbnail/deploy
```

Update SSE events to emit:
- `{ type: 'iteration', attempt: N, maxAttempts: 5, error: 'description' }` during debug loop
- `{ type: 'screenshot', state: 'playing', imageBase64: '...' }` when screenshots are captured
- `{ type: 'phase', phase: 'fixing' }` and `{ type: 'phase', phase: 'polishing' }`

### 5. Update the game-builder validation endpoint

The pipeline needs to call the game-builder's validation endpoint and get back structured results including runtime test results. Update the orchestrator's handoff to game-builder to support a two-step flow:
1. First call: validate only (don't store) — `POST /games/validate`
2. Second call: store (after all iterations pass) — `POST /games`

Add a new `POST /games/validate` endpoint in `services/game-builder/src/routes/games.ts` that runs validation and returns results without storing.

## Constraints

- Max 5 debug iterations per game generation
- Debug agent must receive screenshots as base64 in the prompt (not URLs)
- Debug agent prompt must be under 6000 tokens (excluding code and screenshots)
- Polish agent must not change game logic — only aesthetics
- If iteration 5 fails: mark generation as failed, emit `{ type: 'failed', reason, attempts: 5 }`
- Log all iterations for debugging prompt quality
- Track token usage per iteration in `generation_logs`

## Files Modified
- `services/ai-orchestrator/src/pipeline/orchestrator.ts`
- `services/game-builder/src/routes/games.ts`

## Files Created
- `services/ai-orchestrator/src/agents/debug-fixer.ts`
- `services/ai-orchestrator/src/agents/polish-agent.ts`
- `services/ai-orchestrator/src/pipeline/iteration-tracker.ts`

---

---

# PROMPT 8: 3D Game Templates & SDK v2 Utilities

## Full System Context

Sloppy is an AI-powered browser game platform upgrading to v2 with Three.js 3D game support.

**Already built (v1 complete + Prompts 1-7):**
- SDK v2 contract, dual-engine code generator (Phaser 3 + Three.js)
- Multi-agent pipeline with debug loop and polish pass
- Genre-specific prompt libraries for 2D and 3D genres

**v2 addition:** Instead of generating Three.js boilerplate from scratch every time, the AI works from genre templates that have the rendering/physics/camera boilerplate pre-solved. The AI fills in game-specific logic. Also, shared SDK v2 utility classes help games manage state, render screens, and apply effects consistently.

## Build Objective

Create a library of Three.js genre templates and SDK v2 utility classes (GameStateManager, ScreenRenderer, EffectsLibrary) that generated games can use.

## Specific Deliverables

### 1. Create 3D genre templates (`packages/runtime-sdk/src/templates/3d/`)

Each template is a standalone JavaScript file that provides the boilerplate for a specific 3D game genre. The AI receives the template and fills in game-specific logic.

Templates to create:
- `fps.js` — First-person camera, pointer lock, collision detection, projectile system, enemy spawning
- `racing.js` — Track system, vehicle physics (simplified), lap counter, chase camera
- `endless-runner.js` — Procedural track segments, obstacle spawning, lane switching, speed ramp
- `puzzle-3d.js` — Object interaction (click/drag), camera orbit controls, spatial puzzles
- `tower-defense-3d.js` — Grid system, pathfinding (A*), camera overview, tower placement

Each template must include:
- Correct Three.js scene setup (renderer with shadows, camera, lighting)
- Post-processing pipeline (bloom, ACES tone mapping)
- The game loop integrated with SDK v2 contract methods
- Touch and keyboard controls
- Mobile-responsive canvas sizing
- `window.SloppyGame` assignment with all required methods

### 2. Create SDK v2 utilities (`packages/runtime-sdk/src/v2/`)

- `state-manager.ts` — `GameStateManager` class that manages state transitions, prevents invalid states (e.g., can't pause from idle), emits state change events. Used by generated games.
- `screen-renderer.ts` — `ScreenRenderer` base class with helpers for drawing UI screens on canvas (centered text, buttons, overlays). Works with both Canvas 2D and CSS overlay for Three.js.
- `effects-library.ts` — `EffectsLibrary` with juice helpers: screen shake, flash, particle burst, number pop animation. Engine-agnostic API with engine-specific implementations.

### 3. Create 2D templates (`packages/runtime-sdk/src/templates/2d/`)

Simpler templates for Phaser 3:
- `platformer.js` — Phaser platform physics, multi-scene setup, sprite handling
- `topdown.js` — Phaser arcade physics, 8-direction movement, camera follow
- `puzzle.js` — Grid-based interaction, match/clear mechanics

### 4. Update barrel exports (`packages/runtime-sdk/src/index.ts`)

Export the template file paths and utility classes so the AI orchestrator can reference them.

### 5. Update the Technical Planner prompt

In `services/ai-orchestrator/src/agents/technical-planner.ts`, update the system prompt to reference available templates. When the GDD specifies a genre that matches a template, the planner should recommend using it and describe which parts the code generator needs to fill in.

## Constraints

- Templates must be pure JavaScript (no TypeScript, no module syntax — they're inlined into generated games)
- Templates must load engines via CDN `<script>` tags (version-pinned)
- Each template should be under 500 lines of code
- Templates must implement ALL SDK v2 required methods
- Three.js templates must include the quality defaults: shadows, ACES tone mapping, fog, bloom
- Templates are reference implementations — the AI may modify them significantly

## Files Created
- `packages/runtime-sdk/src/templates/3d/fps.js`
- `packages/runtime-sdk/src/templates/3d/racing.js`
- `packages/runtime-sdk/src/templates/3d/endless-runner.js`
- `packages/runtime-sdk/src/templates/3d/puzzle-3d.js`
- `packages/runtime-sdk/src/templates/3d/tower-defense-3d.js`
- `packages/runtime-sdk/src/templates/2d/platformer.js`
- `packages/runtime-sdk/src/templates/2d/topdown.js`
- `packages/runtime-sdk/src/templates/2d/puzzle.js`
- `packages/runtime-sdk/src/v2/state-manager.ts`
- `packages/runtime-sdk/src/v2/screen-renderer.ts`
- `packages/runtime-sdk/src/v2/effects-library.ts`

## Files Modified
- `packages/runtime-sdk/src/index.ts`
- `services/ai-orchestrator/src/agents/technical-planner.ts`

---

---

# PROMPT 9: Multiplayer Intelligence & Injector Agent

## Full System Context

Sloppy is an AI-powered browser game platform. The v2 multi-agent pipeline is fully built. Now we add intelligent multiplayer: the AI automatically determines if a game concept suits multiplayer and, if so, generates the multiplayer layer.

**Already built (v1 complete + Prompts 1-8):**
- Full multi-agent pipeline: Concept Architect → Technical Planner → Code Generator → Debug Loop → Polish
- SDK v2 contract with `MultiplayerHooks` interface
- Existing multiplayer service (`services/multiplayer/`) with WebSocket server, room management, Redis state
- Existing `@sloppy/multiplayer-sdk` client SDK
- Current multiplayer injection phase (`services/ai-orchestrator/src/pipeline/multiplayer.ts`) — simple prompt that adds multiplayer hooks to game code

**v2 addition:** The Concept Architect intelligently evaluates multiplayer suitability. A dedicated Multiplayer Injector agent handles injection into working single-player code, with proper sync strategy selection.

## Build Objective

Add multiplayer analysis to the Concept Architect's GDD output and create a dedicated Multiplayer Injector agent that handles multiplayer code injection with the correct sync strategy.

## Specific Deliverables

### 1. Update Concept Architect (`services/ai-orchestrator/src/agents/concept-architect.ts`)

The GDD already has a `multiplayer` field. Update the Concept Architect's system prompt to include detailed guidance on multiplayer evaluation:

- Provide examples of multiplayer-suitable vs unsuitable games
- Include sync strategy selection criteria:
  - State Sync: turn-based, slower games (50-100ms latency acceptable)
  - Input Relay: fast action games (platformers, shooters, <16ms feel)
  - Lockstep: pure competitive strategy/puzzle
- The prompt must output the `multiplayer.syncStrategy` field based on analysis

### 2. Create Multiplayer Injector agent (`services/ai-orchestrator/src/agents/multiplayer-injector.ts`)

New module with:
- `runMultiplayerInjector(code, gdd, llm, onProgress)` function
- Only runs when `gdd.multiplayer.suitable === true`
- System prompt:
  - Reads the working single-player game code
  - Injects multiplayer SDK connection code
  - Implements all `MultiplayerHooks` methods: `getInitialState`, `applyPlayerInput`, `updateState`, `serializeState`, `onPlayerJoin`, `onPlayerLeave`
  - Adds visual indicators for other players (ghost runners, split indicators, etc.)
  - Sets `supportsMultiplayer: true` on `window.SloppyGame`
  - Uses the sync strategy from the GDD
- Must include the `@sloppy/multiplayer-sdk` API in the prompt
- Must NOT break existing single-player functionality

### 3. Update pipeline orchestrator

Replace the old `runMultiplayerPhase()` call with the new Multiplayer Injector agent. The injector runs after the polish pass, only when `gdd.multiplayer.suitable === true`.

After injection, re-run validation to ensure multiplayer hooks exist and don't break the game.

### 4. Update validation for multiplayer

In `services/game-builder/src/validation/pipeline.ts`, add multiplayer hook validation: if `config.supportsMultiplayer === true`, check that all `MultiplayerHooks` methods exist in the source code.

## Constraints

- Multiplayer injection must not break single-player gameplay
- The injector must not rewrite the game — it adds multiplayer on top
- After injection, the game must still pass all static + runtime validation
- Sync strategy must match what the multiplayer server (`services/multiplayer/`) supports (currently state-sync via Redis)
- Token budget for injector: max 8000 tokens

## Files Modified
- `services/ai-orchestrator/src/agents/concept-architect.ts`
- `services/ai-orchestrator/src/pipeline/orchestrator.ts`
- `services/game-builder/src/validation/pipeline.ts`

## Files Created
- `services/ai-orchestrator/src/agents/multiplayer-injector.ts`

---

---

# PROMPT 10: Sound Effects System

## Full System Context

Sloppy is an AI-powered browser game platform upgrading to v2 with in-game audio.

**Already built (v1 complete + Prompts 1-9):**
- Full multi-agent pipeline with dual-engine support
- SDK v2 contract (but no audio management yet)
- All pipeline agents functional

**v2 audio architecture:**
- **Playback:** Howler.js inside every game (7KB, handles iOS audio restrictions, audio sprites)
- **Generation (automated games):** ZzFX procedural audio — ~1KB library, sounds as parameter arrays, zero HTTP requests
- **Generation (creator games):** ElevenLabs SFX API for real audio files stored in GCS
- **Feed integration:** Global mute/unmute via postMessage, games must respect `setAudioMuted(muted)`

## Build Objective

Implement the two-layer audio system: ZzFX presets + Howler.js playback for the runtime SDK, an Audio Generator agent for the pipeline, and the audio rules in the code generator's prompts.

## Specific Deliverables

### 1. Create ZzFX preset library (`packages/runtime-sdk/src/v2/audio/zzfx-presets.ts`)

Export a `SFX` object mapping common game events to ZzFX parameter arrays:
- Movement: jump, land, walk, dash
- Combat: shoot, hit, explosion
- Collectibles: coin, powerUp
- UI: select, confirm, back
- Game states: levelUp, gameOver
- 3D-specific: engineRev, impact

Use the presets from the v2 spec document.

### 2. Create ZzFX micro engine (`packages/runtime-sdk/src/v2/audio/zzfx-micro.ts`)

Inline the ZzFX micro library (~900 bytes) as an exported function. This gets inlined into every game that uses procedural audio.

### 3. Create Audio Manager (`packages/runtime-sdk/src/v2/audio/audio-manager.ts`)

Implement the `AudioManager` interface:
```ts
interface AudioManager {
  play(sfxKey: string): void;
  playAmbient(src: string, loop: boolean): void;
  stopAmbient(): void;
  setMasterVolume(v: number): void;
  setMusicVolume(v: number): void;
  setSFXVolume(v: number): void;
  onPause(): void;
  onResume(): void;
  onDestroy(): void;
  mute(): void;
  unmute(): void;
}
```

The implementation wraps Howler.js for file-based audio and ZzFX for procedural audio. It auto-detects which to use based on whether audio files are available.

The `mute()`/`unmute()` methods are wired to the postMessage bridge:
```js
window.addEventListener('message', (e) => {
  if (e.data?.type === 'sloppy:mute') audioManager.mute();
  if (e.data?.type === 'sloppy:unmute') audioManager.unmute();
});
```

### 4. Create Audio Generator agent (`services/ai-orchestrator/src/agents/audio-generator.ts`)

New module with:
- `runAudioGenerator(code, gdd, mode: 'zzfx' | 'elevenlabs', llm, onProgress)` function
- For ZzFX mode (automated/batch games):
  - Analyzes GDD to determine needed sound events
  - Injects ZzFX micro snippet + SFX preset calls into the game code
  - Maps game actions to preset sounds (e.g., jump → SFX.jump)
- For ElevenLabs mode (creator games):
  - Determines SFX list from GDD (e.g., "sword clash", "coin jingle")
  - Calls ElevenLabs SFX API to generate audio files
  - Packs into Howler audio sprite
  - Returns audio files for GCS upload
  - Also generates ambient music loop via ElevenLabs Music API

### 5. Update code generator prompts

Add audio rules to the code generator system prompt (`services/ai-orchestrator/src/prompts/code.ts`):
```
AUDIO RULES:
- ALWAYS initialize ZzFX OR load Howler sprite at game init
- NEVER use new Audio() or raw AudioContext directly
- Every player action MUST have a sound response
- Required sounds: jump/move, collect/score, hurt/die, game-over, level-up
- For 3D games: use THREE.AudioListener + THREE.PositionalAudio
- All audio paused on game.pause(), resumed on game.resume()
```

### 6. Update pipeline orchestrator

Add the audio generation phase after the polish pass:
```
... → Polish → Audio Generator → Multiplayer Injector → Thumbnail → Deploy
```

### 7. Update GCS bundle structure (`services/game-builder/src/storage/gcs.ts`)

Support uploading audio files alongside the game bundle:
```
games/{id}/v{version}/
  index.html
  game.js
  config.json
  audio/
    sounds.webm
    sounds.mp3
    ambient.webm
```

## Constraints

- ZzFX is the default for all games (zero cost, zero latency)
- ElevenLabs is only used when explicitly requested (creator games)
- ElevenLabs API key via `ELEVENLABS_API_KEY` env var
- Audio must not auto-play (browser policy) — init audio on first user interaction
- Audio must be pauseable and muteable
- Howler.js loaded via CDN: `https://cdnjs.cloudflare.com/ajax/libs/howler/2.2.4/howler.min.js`

## Files Created
- `packages/runtime-sdk/src/v2/audio/zzfx-presets.ts`
- `packages/runtime-sdk/src/v2/audio/zzfx-micro.ts`
- `packages/runtime-sdk/src/v2/audio/audio-manager.ts`
- `services/ai-orchestrator/src/agents/audio-generator.ts`

## Files Modified
- `services/ai-orchestrator/src/prompts/code.ts`
- `services/ai-orchestrator/src/pipeline/orchestrator.ts`
- `services/game-builder/src/storage/gcs.ts`
- `packages/runtime-sdk/src/index.ts`

---

---

# PROMPT 11: Thumbnail Generation Pipeline

## Full System Context

Sloppy is an AI-powered browser game platform. Games need marketing-quality thumbnails for the game store, not raw screenshots.

**Already built (v1 complete + Prompts 1-10):**
- Full multi-agent pipeline with audio
- Runtime validation captures Puppeteer screenshots at each game state
- GCS stores game bundles with screenshots

**v2 thumbnail pipeline:**
```
GDD (title, genre, visual_style) + Puppeteer screenshot → Thumbnail Prompt Agent → fal.ai FLUX API → Sharp.js post-processing (title overlay, genre badge, vignette) → Upload to GCS
```

## Build Objective

Implement AI-generated game store thumbnails using fal.ai FLUX image generation with Sharp.js post-processing.

## Specific Deliverables

### 1. Create Thumbnail Prompt agent (`services/ai-orchestrator/src/agents/thumbnail-prompter.ts`)

New module with:
- `runThumbnailPrompter(gdd, llm)` function
- Takes the GDD and generates an optimized image prompt for FLUX
- System prompt includes genre-specific visual archetypes:
  - Platformers: side-view, action pose, colorful backgrounds
  - Racing: dramatic camera angle, speed lines, track
  - Puzzle: clean arrangement, satisfying patterns
  - 3D games: cinematic depth of field, dramatic lighting
- Output: a single FLUX-optimized prompt string (100-200 words)

### 2. Create fal.ai client (`services/game-builder/src/thumbnails/fal-client.ts`)

API wrapper for fal.ai FLUX:
- `generateThumbnail(prompt, referenceImageBuffer?)` function
- Calls `fal-ai/flux-2` model (or `fal-ai/flux/schnell` for batch)
- Image size: landscape 16:9 (1280x720)
- Optionally passes the Puppeteer screenshot as image reference
- Returns image buffer
- Handles API errors with retry (max 2 retries)

### 3. Create Sharp.js compositor (`services/game-builder/src/thumbnails/compositor.ts`)

Post-processing pipeline using Sharp:
- `composeThumbnail(baseImage, title, genre)` function
- Steps:
  1. Resize to 1280x720
  2. Add gradient overlay at bottom for text legibility
  3. Add title text overlay (bottom-left, bold) via SVG text rendering
  4. Add genre badge (top-right pill) via SVG
  5. Add subtle vignette
  6. Output as WebP (quality 85)
- Also generate small thumbnail: 300x169 for game cards

### 4. Integrate into pipeline (`services/ai-orchestrator/src/pipeline/orchestrator.ts`)

Add thumbnail generation as a pipeline phase that runs after validation passes:
1. Thumbnail Prompt Agent generates the FLUX prompt
2. Pass prompt + playing-state screenshot to fal.ai
3. Sharp.js composites the final thumbnail
4. Upload both sizes to GCS
5. Update game record with `thumbnail_url` and `thumbnail_sm_url`

Thumbnail generation runs in parallel with audio generation (they're independent).

### 5. Update game creation in game-builder

In `services/game-builder/src/routes/games.ts`, accept optional `thumbnailBuffer` and `thumbnailSmBuffer` in the game creation payload. Upload to GCS path: `games/{id}/v{version}/thumbnail.webp` and `thumbnail_sm.webp`.

### 6. Install dependencies

Add `sharp` and `@fal-ai/serverless-client` to `services/game-builder/package.json`.

## Constraints

- fal.ai API key via `FAL_KEY` env var
- FLUX.1 schnell for batch (population pipeline) — faster, cheaper ($0.003/image)
- FLUX.2 dev for creator games — higher quality ($0.006/image)
- Thumbnail generation is non-blocking — game should be playable before thumbnail is ready
- If FLUX fails, fall back to the Puppeteer screenshot as thumbnail
- Sharp.js has no native dependencies on most platforms but needs `libvips` in Docker — add to game-builder Dockerfile

## Files Created
- `services/ai-orchestrator/src/agents/thumbnail-prompter.ts`
- `services/game-builder/src/thumbnails/fal-client.ts`
- `services/game-builder/src/thumbnails/compositor.ts`

## Files Modified
- `services/ai-orchestrator/src/pipeline/orchestrator.ts`
- `services/game-builder/src/routes/games.ts`
- `services/game-builder/src/storage/gcs.ts`
- `services/game-builder/package.json`
- `services/game-builder/Dockerfile`

---

---

# PROMPT 12: UI Design System Overhaul

## Full System Context

Sloppy is an AI-powered browser game platform. The v1 UI uses a light, playful "sloppy" aesthetic (cream background, neon pastels, handwritten fonts, wiggly animations). For v2, we're transitioning to a dark premium gaming aesthetic inspired by CrazyGames.com.

**Already built (v1 complete + Prompts 1-11):**
- All backend v2 features (multi-agent pipeline, thumbnails, audio)
- Current frontend: `apps/web/` with React + Vite + Zustand + TailwindCSS (v4) + Framer Motion

**Current design system** (in `apps/web/src/index.css`):
- Colors: sloppy-pink (#ff6eb4), sloppy-lime (#b4ff39), sloppy-cyan (#00e5ff), sloppy-yellow (#ffe135), sloppy-cream (#fdf6ec), sloppy-dark (#2d2d2d)
- Fonts: Patrick Hand (headings), Inter (body)
- Animations: wiggle, bounce-in, spin-chaotic, slide-in, shimmer

**Current layout** (`apps/web/src/components/layout/`):
- `Layout.tsx` — NavBar + content + BottomNav + GameOverlay + Toast
- `NavBar.tsx` — top bar with logo, links (Home, Create, Favourites, My Games), music toggle, auth
- `BottomNav.tsx` — mobile bottom tabs (Home, Create, Favourites, My Games)

**v2 target aesthetic:**
- Deep dark background (#0d0d0f)
- Neon accent system (primary purple #7c3aed, secondary cyan #06b6d4, danger red #ef4444)
- Glassmorphism panels (backdrop-filter: blur)
- 3D tilt-on-hover for game cards
- Persistent left sidebar on desktop, bottom tab bar on mobile
- Skeleton loading states

## Build Objective

Overhaul the design system from light sloppy to dark premium gaming. Redesign the layout with a sidebar navigation. Update all UI components.

## Specific Deliverables

### 1. Update Tailwind theme (`apps/web/src/index.css`)

Replace the current color palette:
- `sloppy-bg`: #0d0d0f (deep dark)
- `sloppy-surface`: #1a1a1f (card/panel background)
- `sloppy-surface-hover`: #252530
- `sloppy-border`: rgba(255,255,255,0.08)
- `sloppy-primary`: #7c3aed (purple)
- `sloppy-secondary`: #06b6d4 (cyan)
- `sloppy-accent`: #f97316 (orange for highlights)
- `sloppy-danger`: #ef4444
- `sloppy-success`: #22c55e
- `sloppy-text`: #f4f4f5
- `sloppy-text-muted`: #a1a1aa
- Keep `sloppy-pink`, `sloppy-lime`, `sloppy-cyan`, `sloppy-yellow` as accent colors

Add glassmorphism utility: `glass` class with `backdrop-filter: blur(20px); background: rgba(26,26,31,0.8)`.

Update skeleton shimmer animation for dark backgrounds.

### 2. Redesign Layout (`apps/web/src/components/layout/Layout.tsx`)

Implement the new navigation structure:
- **Desktop:** persistent left sidebar (240px) + content area
- **Mobile:** content area + bottom tab bar
- Sidebar contains: logo, main nav (Home, Feed, Explore, Favourites, Create, Profile), divider, category nav (Action, Puzzle, Racing, Arcade, 3D, Multiplayer)
- Content area is scrollable

### 3. Redesign NavBar (`apps/web/src/components/layout/NavBar.tsx`)

- Desktop: top bar with search input (centered), Create button (right), user avatar (right)
- Mobile: minimal top bar with logo (left), search icon (right), avatar (right)

### 4. Redesign BottomNav (`apps/web/src/components/layout/BottomNav.tsx`)

Update icons and labels: Home, Feed, Explore, Favourites, Create.

### 5. Create Sidebar component (`apps/web/src/components/layout/Sidebar.tsx`)

New desktop sidebar component with:
- Logo at top
- Main navigation links with icons and active state
- Category section with genre links
- Collapsible on smaller desktop screens (icons only)

### 6. Update all UI components (`apps/web/src/components/ui/`)

Update each component for the dark theme:
- `SloppyButton.tsx` — dark backgrounds, neon glow on hover, variants: primary (purple), secondary (cyan), ghost (transparent)
- `SloppyCard.tsx` — dark surface, subtle border, glassmorphism hover, 3D tilt via CSS perspective
- `SloppyInput.tsx` — dark input background, focus ring in primary color
- `SloppyModal.tsx` — dark backdrop, glassmorphism panel
- `SloppySpinner.tsx` — neon-colored dots
- `SloppyToast.tsx` — dark surface with accent border
- `GameCard.tsx` — complete redesign: screenshot thumbnail, title, genre + engine badges, play count, favourite count, play button on hover

### 7. Create new components

- `GameCardSkeleton.tsx` — loading placeholder matching GameCard dimensions
- `CategoryChip.tsx` — genre pill with icon (for horizontal scroll)
- `HeroBanner.tsx` — rotating featured game spotlight with large card
- `SectionRow.tsx` — titled horizontal scroll row of game cards
- `SearchBar.tsx` — debounced search with recent history dropdown
- `FilterBar.tsx` — multi-filter panel (genre, engine, multiplayer, sort)

Place in `apps/web/src/components/ui/`.

### 8. Update index.css global styles

Dark body background, scrollbar styling for dark theme, selection color.

## Constraints

- All animations must still use Framer Motion
- Mobile-first responsive design
- Sidebar hidden on mobile (bottom tabs instead)
- Dark theme only (no light mode toggle for now)
- Maintain all existing functionality — just restyle
- Use CSS `perspective` + `rotateX/Y` for 3D card tilt (not a library)
- Glassmorphism must degrade gracefully on browsers without `backdrop-filter` support

## Files Modified
- `apps/web/src/index.css`
- `apps/web/src/components/layout/Layout.tsx`
- `apps/web/src/components/layout/NavBar.tsx`
- `apps/web/src/components/layout/BottomNav.tsx`
- `apps/web/src/components/ui/SloppyButton.tsx`
- `apps/web/src/components/ui/SloppyCard.tsx`
- `apps/web/src/components/ui/SloppyInput.tsx`
- `apps/web/src/components/ui/SloppyModal.tsx`
- `apps/web/src/components/ui/SloppySpinner.tsx`
- `apps/web/src/components/ui/SloppyToast.tsx`
- `apps/web/src/components/ui/GameCard.tsx`

## Files Created
- `apps/web/src/components/layout/Sidebar.tsx`
- `apps/web/src/components/ui/GameCardSkeleton.tsx`
- `apps/web/src/components/ui/CategoryChip.tsx`
- `apps/web/src/components/ui/HeroBanner.tsx`
- `apps/web/src/components/ui/SectionRow.tsx`
- `apps/web/src/components/ui/SearchBar.tsx`
- `apps/web/src/components/ui/FilterBar.tsx`

---

---

# PROMPT 13: Store Pages — Home, Explore, Categories, Game Page

## Full System Context

Sloppy is an AI-powered browser game platform. The v2 design system is now dark premium gaming. We need to build the discovery store experience.

**Already built (v1 complete + Prompts 1-12):**
- All backend v2 features
- Dark premium design system with sidebar, new components (HeroBanner, SectionRow, CategoryChip, SearchBar, FilterBar, GameCard with thumbnails)
- Database with game search (full-text), genre/engine filtering, trending queries

**Current Home page** (`apps/web/src/pages/Home.tsx`):
- Simple feed: sort tabs (Recent/Popular/Random), virtualized grid of GameCards, infinite scroll, pull-to-refresh

**v2 Home page (Discovery Store):**
- Hero banner with featured games
- Category quick access chips
- Sectioned rows: Trending, Just Created, 3D Games, Multiplayer, By Category
- Each section is a horizontal scroll row of game cards

## Build Objective

Rebuild the Home page as a discovery store and create the Explore, Category, and individual Game pages.

## Specific Deliverables

### 1. Rebuild Home page (`apps/web/src/pages/Home.tsx`)

Replace the current flat feed with a sectioned store layout:
1. **Hero Banner** — `HeroBanner` component showing 3-5 featured games (auto-rotate)
2. **Category Quick Access** — horizontal scroll of `CategoryChip` components
3. **Trending Now** — `SectionRow` with 6 cards, data from `GET /games/feed?sort=popular&limit=6`
4. **Just Created** — `SectionRow` with newest games, auto-refreshes every 30s
5. **3D Games** — `SectionRow` filtered by `engine=threejs`
6. **Play With Friends** — `SectionRow` filtered by `supportsMultiplayer=true`
7. **By Category** — one `SectionRow` per genre

Each section has a "See All" link that navigates to the Explore page with the relevant filter pre-applied.

### 2. Create Explore page (`apps/web/src/pages/Explore.tsx`)

Full search and filter page:
- `SearchBar` at top with debounced full-text search (calls `GET /games/search?q=...`)
- `FilterBar` below: genre dropdown, engine (2D/3D) toggle, multiplayer toggle, sort (Popular/New/Trending)
- Masonry grid of `GameCard` results
- Infinite scroll pagination
- "No results" state with CTA to generate the missing game
- URL params sync: `/explore?q=space&genre=action&engine=threejs`

### 3. Create Category page (`apps/web/src/pages/Category.tsx`)

Per-genre page at `/category/:genre`:
- Title header with genre icon
- Same card grid as Explore but filtered to one genre
- Sort options: Popular, New, Trending
- Infinite scroll

### 4. Create Game page (`apps/web/src/pages/Game.tsx`)

Individual game page at `/game/:id` (replaces the current `GameView.tsx`):
- Full-page layout: back button, game title, favourite button, multiplayer button
- Game iframe filling the viewport (auto-starts in fullscreen mode)
- Below iframe: description, controls list, stats (play count, favourites, created date)
- Related games section (same genre)
- Pressing Escape exits to previous page

### 5. Update routing (`apps/web/src/App.tsx`)

Add new routes:
- `/explore` → Explore page
- `/category/:genre` → Category page
- Update `/game/:id` to use the new Game page

### 6. Update API client (`apps/web/src/lib/api.ts`)

Add new API methods:
- `gamesApi.search({ query, genre, engine, multiplayer, sort, cursor, limit })`
- `gamesApi.getByGenre(genre, { sort, cursor, limit })`
- `gamesApi.getTrending({ hours, limit })`
- `gamesApi.getFeatured()` (returns featured games for hero banner)

### 7. Add backend endpoints

In `services/game-builder/src/routes/` add:
- `GET /games/search` — full-text search with filters
- `GET /games/trending` — trending games by play count in last 24h
- `GET /games/featured` — curated/top games for hero banner

In `services/api-gateway/src/proxy.ts` add proxy routes for the new endpoints.

### 8. Update game store (`apps/web/src/stores/game.ts`)

Add state and actions for:
- `searchResults`, `searchQuery`, `searchFilters`, `search(query, filters)`, `clearSearch()`
- `trendingGames`, `fetchTrending()`
- `featuredGames`, `fetchFeatured()`
- `categoryGames`, `fetchByGenre(genre)`

## Constraints

- Home page must load fast — lazy load each section independently
- Search must be debounced (300ms)
- Each section fetches data independently (parallel requests)
- Game cards must show thumbnail images (from `thumbnailSmUrl` or screenshot fallback)
- SEO-friendly slugs for category pages: `/category/action`, `/category/puzzle`
- Mobile responsive: sections stack vertically, horizontal scroll works with touch

## Files Modified
- `apps/web/src/pages/Home.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/lib/api.ts`
- `apps/web/src/stores/game.ts`
- `services/api-gateway/src/proxy.ts`

## Files Created
- `apps/web/src/pages/Explore.tsx`
- `apps/web/src/pages/Category.tsx`
- `apps/web/src/pages/Game.tsx`
- `services/game-builder/src/routes/search.ts`

## Files Removed
- `apps/web/src/pages/GameView.tsx` (replaced by Game.tsx)

---

---

# PROMPT 14: TikTok-Style Infinite Scroll Feed

## Full System Context

Sloppy is an AI-powered browser game platform. In addition to the discovery store, we're adding a TikTok-style vertical feed where each game fills the viewport.

**Already built (v1 complete + Prompts 1-13):**
- Discovery store with Home, Explore, Category, Game pages
- Full backend v2 with game search, trending, thumbnails
- Dark premium UI with sidebar navigation

**v2 TikTok Feed architecture:**
- `/feed` route — separate from the Store
- Full-viewport, one game at a time
- 3-iframe sliding window for lag-free scrolling
- Preload game N+1 while game N is active
- Per-game progress saving
- Global mute/unmute
- Info overlay (title, genre, play count) + action buttons (favourite, multiplayer)

## Build Objective

Build the TikTok-style full-viewport vertical feed with a 3-iframe sliding window for instant game transitions.

## Specific Deliverables

### 1. Create Feed page (`apps/web/src/pages/Feed.tsx`)

Full-viewport vertical feed:
- Each "slide" is a game filling 100dvh
- Swipe/scroll vertically to navigate between games
- Current game auto-plays in a sandboxed iframe
- Info overlay (bottom-left): game title, genre badge, engine badge, play count
- Action buttons (right side, TikTok-style): favourite, multiplayer, share, more
- Control bar (fades in on hover/tap): Start, Pause, Restart
- Global mute toggle (top-right)
- Minimal header: "SLOPPY FEED" + search icon + avatar

### 2. Create feed window hook (`apps/web/src/hooks/useFeedWindow.ts`)

Implement the 3-iframe sliding window:
```ts
const { currentGame, goNext, goPrev, preloadStatus } = useFeedWindow(games);
```

Logic:
- Maintain 3 iframes: previous, current, next
- Current iframe is visible and active (sound on if not muted)
- Previous and next iframes are hidden but loaded (src already set)
- On scroll/swipe to next:
  - Previous iframe src cleared (memory freed)
  - Current becomes previous
  - Next becomes current (reveal instantly — already loaded)
  - New next iframe created and preloaded
- Use CSS `transform: translate3d` for GPU-composited scroll animation
- Use `visibility: hidden` (not `display: none`) to keep DOM alive

### 3. Create feed game overlay component

Wrapper around each iframe in the feed:
- Handles postMessage communication (game state, score, mute)
- Shows control bar with Start/Pause/Restart buttons
- Communicates with game via postMessage:
  - `sloppy:command` → `start`, `pause`, `resume`, `restart`
  - `sloppy:mute` / `sloppy:unmute`
  - `sloppy:state` (from game) → updates UI indicators
  - `sloppy:score` (from game) → shows score
  - `sloppy:progress` (from game) → saves progress

### 4. Implement progress saving

Every game reports progress via postMessage:
```js
window.parent.postMessage({ type: 'sloppy:progress', data: { score, level, customState } }, '*');
```

Feed saves progress:
- Anonymous users: `localStorage` keyed by gameId
- Logged-in users: debounced save to `POST /games/:id/progress` every 10s

On revisit, feed sends saved state back:
```js
iframe.contentWindow.postMessage({ type: 'sloppy:restore', data: savedProgress }, '*');
```

### 5. Create feed API endpoints

In `services/game-builder/src/routes/feed.ts`, add:
- `GET /games/feed/algorithm` — returns paginated games ordered by feed algorithm:
  ```
  score = recencyScore * engagementScore * qualityScore - diversityPenalty + randomNoise
  ```
- `POST /games/:id/progress` — save game progress (requires auth)
- `GET /games/:id/progress` — get saved progress

### 6. Add feed route to app routing (`apps/web/src/App.tsx`)

Add `/feed` route pointing to the Feed page.

### 7. Sound design for feed

Audio always muted by default in feed (like TikTok). Persistent mute/unmute toggle. Games must respect the mute state via postMessage.

## Constraints

- Feed must feel instant — no loading spinners between games
- Memory management: only 3 iframes alive at any time
- GPU-composited animations only (transform, opacity)
- iOS Safari: no native Fullscreen API, use CSS `position: fixed; inset: 0`
- Feed pagination: fetch 10 games at a time, request next page when user reaches game N-2
- Progress saving debounced (not on every postMessage)
- Mobile: swipe gesture for navigation (touch events)
- Desktop: scroll wheel or arrow keys for navigation

## Files Created
- `apps/web/src/pages/Feed.tsx`
- `apps/web/src/hooks/useFeedWindow.ts`

## Files Modified
- `apps/web/src/App.tsx`
- `apps/web/src/lib/api.ts`
- `apps/web/src/stores/game.ts`
- `services/game-builder/src/routes/feed.ts`
- `services/api-gateway/src/proxy.ts`

---

---

# PROMPT 15: Fullscreen & Responsive Game Playing

## Full System Context

Sloppy is an AI-powered browser game platform. Games need to play fullscreen on any device with proper scaling and touch controls.

**Already built (v1 complete + Prompts 1-14):**
- All v2 features including TikTok feed with 3-iframe window
- Current `GameOverlay` (`apps/web/src/components/layout/GameOverlay.tsx`) uses `position: fixed; inset: 0` with `100dvh` height

**v2 fullscreen requirements:**
- Browser Fullscreen API on desktop (no browser chrome)
- CSS viewport overlay fallback (iOS Safari where Fullscreen API is restricted)
- Responsive game scaling via CSS `transform: scale()`
- Touch controls for mobile (joystick, d-pad, tap-zones)

## Build Objective

Implement fullscreen mode, responsive game scaling, and mobile touch controls.

## Specific Deliverables

### 1. Create fullscreen hook (`apps/web/src/hooks/useFullscreen.ts`)

```ts
const { isFullscreen, enterFullscreen, exitFullscreen, toggleFullscreen } = useFullscreen(elementRef);
```

- Uses Fullscreen API where available (`requestFullscreen` + `webkitRequestFullscreen`)
- Falls back to CSS viewport overlay (`.sloppy-fullscreen-fallback`)
- Handles fullscreen change events
- Works on iOS Safari (CSS fallback only)

### 2. Create GamePlayerShell component (`apps/web/src/components/GamePlayerShell.tsx`)

Unified game player component used by both the game page and the feed:
- Wraps the iframe
- Handles responsive scaling:
  ```ts
  const scale = mode === 'fit'
    ? Math.min(viewportWidth / gameWidth, viewportHeight / gameHeight)
    : Math.max(viewportWidth / gameWidth, viewportHeight / gameHeight);
  ```
- Reads game resolution from `config.json` (width, height, scaleMode)
- Standard resolutions: 960x540 (2D), 1280x720 (3D), 414x896 (mobile portrait)
- Applies `transform: scale()` to the iframe

### 3. Create touch controls (`packages/runtime-sdk/src/v2/touch-controls.ts`)

Touch control system injected into games that declare mobile support:
```ts
interface TouchControlConfig {
  type: 'joystick' | 'd-pad' | 'tap-zones' | 'gesture' | 'custom';
  layout: TouchLayout;
}
```

- Renders semi-transparent touch controls on a CSS overlay above the iframe
- Sends normalized input to the game via postMessage (same format as keyboard input)
- The Technical Planner agent determines appropriate touch control type per genre

### 4. Create game bridge hook (`apps/web/src/hooks/useGameBridge.ts`)

PostMessage bridge between the shell and the game iframe:
```ts
const { gameState, score, sendCommand, isReady } = useGameBridge(iframeRef);
```

Commands: `start`, `pause`, `resume`, `restart`, `mute`, `unmute`, `restore`

Game reports: `sloppy:state`, `sloppy:score`, `sloppy:progress`, `sloppy:game:ready`, `sloppy:game:error`

### 5. Update GameOverlay (`apps/web/src/components/layout/GameOverlay.tsx`)

Refactor to use `GamePlayerShell` and `useGameBridge` instead of raw iframe management. Add fullscreen toggle button.

### 6. Add game player modes

```ts
type GamePlayerMode = 'inline' | 'overlay' | 'fullscreen';
```

- Desktop game click: enter `fullscreen` mode
- Mobile game click: enter `overlay` mode
- Feed: games play in `overlay` by default, tap for `fullscreen`

## Constraints

- Fullscreen must be triggered by user gesture (browser requirement)
- CSS fallback must work identically to native fullscreen visually
- Touch controls must not capture events meant for the game
- Game scaling must maintain aspect ratio (letterbox/pillarbox as needed)
- Performance: scaling uses CSS transform (GPU composited, no layout reflow)

## Files Created
- `apps/web/src/hooks/useFullscreen.ts`
- `apps/web/src/hooks/useGameBridge.ts`
- `apps/web/src/components/GamePlayerShell.tsx`
- `packages/runtime-sdk/src/v2/touch-controls.ts`

## Files Modified
- `apps/web/src/components/layout/GameOverlay.tsx`
- `packages/runtime-sdk/src/index.ts`

---

---

# PROMPT 16: Payments Service — Stripe Billing

## Full System Context

Sloppy is an AI-powered browser game platform adding monetisation. Creators pay $5/month to create and publish games.

**Already built (v1 complete + Prompts 1-15):**
- Full v2 platform with store UI, feed, fullscreen
- Database v2 schema with `creator_subscriptions` table
- User auth via Firebase (Google, email, anonymous)

**Payments architecture:**
- Stripe Billing for $5/month creator subscriptions
- Stripe Connect Express for creator payouts (Prompt 18)
- Ad revenue integration (Prompt 17)

## Build Objective

Create a new payments service with Stripe Billing integration for creator subscriptions.

## Specific Deliverables

### 1. Create payments service (`services/payments/`)

New Express + TypeScript service (same scaffold as other services):
- `src/app.ts` — Express app with health check, CORS, JSON parsing
- `src/config.ts` — environment variable configuration

### 2. Stripe Billing integration (`services/payments/src/stripe/`)

- `billing.ts`:
  - `createCustomer(userId, email)` — creates Stripe customer
  - `createSubscription(customerId, priceId)` — creates $5/month subscription
  - `cancelSubscription(subscriptionId)` — cancels subscription
  - `getSubscription(subscriptionId)` — gets subscription status
  - `createCheckoutSession(customerId, priceId, successUrl, cancelUrl)` — Stripe Checkout

- `webhooks.ts`:
  - Stripe webhook handler for events: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
  - Updates `creator_subscriptions` table via repository
  - On `invoice.paid`: set status to `active`, update `current_period_end`
  - On `customer.subscription.deleted`: set status to `canceled`

### 3. Route handlers (`services/payments/src/routes/`)

- `subscription.ts`:
  - `POST /payments/subscribe` — creates Stripe checkout session, returns checkout URL
  - `GET /payments/subscription` — returns current subscription status
  - `POST /payments/cancel` — cancels subscription
  - `POST /payments/webhooks/stripe` — Stripe webhook endpoint (raw body, signature verification)

### 4. Add proxy routes in API gateway

In `services/api-gateway/src/proxy.ts`, add proxy routes for `/payments/*` to the payments service. `POST /payments/subscribe` and `GET /payments/subscription` require auth. Webhook endpoint must pass raw body (no JSON parsing).

### 5. Frontend subscription UI

In `apps/web/src/pages/Dashboard/Settings.tsx` (new file):
- Subscription status card: shows current plan, renewal date, or "Not subscribed"
- Subscribe button → redirects to Stripe Checkout
- Cancel button → confirmation modal → calls cancel API
- Stripe returns to success/cancel URLs after checkout

Add to routing: `/dashboard/settings`.

### 6. Auth gate for game creation

Update the Create page (`apps/web/src/pages/Create.tsx`) to check subscription status before allowing game generation. Free users can browse and play but not create.

Update `apps/web/src/stores/auth.ts` to include `isSubscribed` state synced from the backend.

### 7. Dockerfile for payments service

Create `services/payments/Dockerfile` (same pattern as other services).

## Constraints

- Stripe API keys via `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` env vars
- Stripe webhook signing secret via `STRIPE_WEBHOOK_SECRET`
- Webhook endpoint must verify Stripe signatures (reject invalid webhooks)
- Price ID configurable via `STRIPE_PRICE_ID` env var
- Service listens on port configurable via `PORT` (default 3006)
- Add `services/payments/.env.example`
- Add payments service to `docker-compose.yml`

## Files Created
- `services/payments/package.json`
- `services/payments/tsconfig.json`
- `services/payments/Dockerfile`
- `services/payments/.env.example`
- `services/payments/src/app.ts`
- `services/payments/src/config.ts`
- `services/payments/src/stripe/billing.ts`
- `services/payments/src/stripe/webhooks.ts`
- `services/payments/src/routes/subscription.ts`
- `apps/web/src/pages/Dashboard/Settings.tsx`

## Files Modified
- `services/api-gateway/src/proxy.ts`
- `services/api-gateway/src/config.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/pages/Create.tsx`
- `apps/web/src/stores/auth.ts`
- `apps/web/src/lib/api.ts`
- `docker-compose.yml`
- `pnpm-workspace.yaml`

---

---

# PROMPT 17: Ad Integration & Revenue Attribution

## Full System Context

Sloppy is an AI-powered browser game platform with monetisation. Creator subscriptions are implemented. Now we add ad revenue.

**Already built (v1 complete + Prompts 1-16):**
- Full v2 platform with payments service and Stripe subscriptions
- Database v2 with `ad_impressions` and `creator_earnings` tables

**Ad stack:**
- Primary: AdinPlay/Venatus (HTML5 game-focused, apply immediately)
- Secondary/fallback: Google AdSense (near-100% fill rate)
- Video: Playwire or AdinPlay video player for pre-game ads in feed

**Ad placements:**
- Store pages: leaderboard (728x90), medium rectangle (300x250), mobile banner (320x50)
- Feed: pre-game video ad every 3rd game, post-game overlay
- In-game: rewarded video (opt-in by player)
- Creator dashboard: leaderboard above earnings

## Build Objective

Implement ad slot components, ad placement across pages, and revenue attribution tracking.

## Specific Deliverables

### 1. Create AdSlot component (`apps/web/src/components/ui/AdSlot.tsx`)

Unified ad slot component that renders ads from configured provider:
```ts
interface AdSlotProps {
  format: 'leaderboard' | 'rectangle' | 'mobile-banner' | 'interstitial' | 'rewarded-video';
  provider: 'adinplay' | 'adsense' | 'placeholder';
  gameId?: string;
  className?: string;
}
```

Initially renders placeholder ads (colored divs with "Ad" text) that can be swapped to real ad SDKs when approved. This lets you build the layout without waiting for ad network approval.

### 2. Add ad placements to pages

- **Home page** (`apps/web/src/pages/Home.tsx`): medium rectangle in sidebar area, leaderboard between sections
- **Explore page** (`apps/web/src/pages/Explore.tsx`): medium rectangle in results grid every 8 cards
- **Feed page** (`apps/web/src/pages/Feed.tsx`): pre-game ad overlay every 3rd game transition
- **Game page** (`apps/web/src/pages/Game.tsx`): medium rectangle below game info

### 3. Create revenue attribution service (`services/payments/src/revenue/`)

- `tracker.ts`:
  - `trackImpression(adProvider, format, gameId?, creatorId?)` — records ad impression
  - Attribution rules:
    - Platform inventory (store pages, feed transitions): 100% to platform
    - Game inventory (in-game, game page): 50% creator / 50% platform
  - Writes to `ad_impressions` table

- `attribution.ts`:
  - `getCreatorRevenue(creatorId, month)` — calculates creator's share for a period
  - `reconcileMonthlyRevenue(month)` — reconciles estimates with actual ad network reports, updates `creator_earnings`

### 4. Revenue tracking endpoint

In `services/payments/src/routes/`:
- `POST /payments/ad-impression` — records an impression (called by ad SDKs or frontend)
- `GET /payments/earnings?creatorId=X` — returns creator's earnings summary

### 5. Frontend ad configuration

Add `VITE_AD_PROVIDER` env var (default: `'placeholder'`). When AdinPlay is approved, switch to `'adinplay'`.

## Constraints

- Ad slots must not block page render (lazy load)
- Placeholder ads must look realistic (proper dimensions, "Advertisement" label)
- Revenue tracking is estimate-based (actual reconciliation happens monthly)
- In-game rewarded video must be opt-in only
- Mobile: no interstitial more than once per session
- Add ad network SDK script tags only when provider is not `'placeholder'`

## Files Created
- `apps/web/src/components/ui/AdSlot.tsx`
- `services/payments/src/revenue/tracker.ts`
- `services/payments/src/revenue/attribution.ts`
- `services/payments/src/routes/earnings.ts`

## Files Modified
- `apps/web/src/pages/Home.tsx`
- `apps/web/src/pages/Explore.tsx`
- `apps/web/src/pages/Feed.tsx`
- `apps/web/src/pages/Game.tsx`
- `services/payments/src/app.ts`
- `services/api-gateway/src/proxy.ts`

---

---

# PROMPT 18: Stripe Connect Creator Payouts

## Full System Context

Sloppy is an AI-powered browser game platform. Creator subscriptions and ad revenue tracking are implemented. Now we add the payout mechanism.

**Already built (v1 complete + Prompts 1-17):**
- Payments service with Stripe Billing
- Ad impression tracking and revenue attribution
- Database with `creator_stripe_accounts`, `creator_earnings`

**Payout flow:**
1. Ad networks report monthly earnings (~21st of following month)
2. Platform reconciles estimates vs actual
3. Creator balances updated
4. Creators with balance >= $60 can request payout
5. Payout via Stripe Connect Express transfer

## Build Objective

Implement Stripe Connect Express for creator payouts with a $60 minimum threshold.

## Specific Deliverables

### 1. Stripe Connect integration (`services/payments/src/stripe/connect.ts`)

- `createConnectAccount(creatorId, email)` — creates Stripe Connect Express account
- `createAccountLink(accountId, refreshUrl, returnUrl)` — generates onboarding link
- `getAccountStatus(accountId)` — checks if onboarding is complete
- `createTransfer(amount, currency, destinationAccountId, metadata)` — transfers funds
- `getAccountBalance(accountId)` — gets available balance

### 2. Payout logic (`services/payments/src/revenue/`)

- `calculator.ts`:
  - `calculateCreatorBalance(creatorId)` — sums confirmed but unpaid earnings
  - `canRequestPayout(creatorId)` — checks balance >= $60 and Stripe account complete

- `payout-trigger.ts`:
  - `requestPayout(creatorId)` — validates balance, initiates Stripe transfer, records payout
  - `notifyEligibleCreators()` — finds creators with balance >= $60, could send notifications

### 3. Route handlers (`services/payments/src/routes/`)

- `payout.ts`:
  - `POST /payments/connect-stripe` — initiates Stripe Connect onboarding, returns onboarding URL
  - `GET /payments/connect-status` — returns whether creator's Stripe account is connected and complete
  - `POST /payments/request-payout` — initiates payout transfer (requires balance >= $60, Stripe account connected)
  - `GET /payments/balance` — returns current payout balance

### 4. Stripe Connect webhook handling

Update `services/payments/src/stripe/webhooks.ts` to handle:
- `account.updated` — update onboarding status
- `transfer.created` — record successful transfer
- `transfer.failed` — handle failed transfer

### 5. Update API gateway

Add proxy routes for the new payout endpoints.

## Constraints

- Stripe Connect account type: Express (Stripe handles KYC/identity)
- Minimum payout threshold: $60 (configurable via env)
- Payouts in USD only for v2
- Transfer fees borne by platform (not deducted from creator balance)
- Add `STRIPE_CONNECT_SECRET` env var if needed

## Files Created
- `services/payments/src/stripe/connect.ts`
- `services/payments/src/revenue/calculator.ts`
- `services/payments/src/revenue/payout-trigger.ts`
- `services/payments/src/routes/payout.ts`

## Files Modified
- `services/payments/src/stripe/webhooks.ts`
- `services/payments/src/app.ts`
- `services/api-gateway/src/proxy.ts`

---

---

# PROMPT 19: Creator Dashboard & Profile Pages

## Full System Context

Sloppy is an AI-powered browser game platform with monetisation. Stripe subscriptions, ad revenue, and creator payouts are all implemented in the backend.

**Already built (v1 complete + Prompts 1-18):**
- Full payments service: subscriptions, ad tracking, Stripe Connect payouts
- Settings page for subscription management
- Database with all creator earnings/payout tables

**Current user-facing pages:**
- Home (store), Feed, Explore, Category, Game, Create, Favourites, MyGames, Dashboard/Settings

**Need:** Creator profile page (public) and earnings dashboard (private).

## Build Objective

Build the creator profile page and earnings dashboard with withdrawal functionality.

## Specific Deliverables

### 1. Create Creator Profile page (`apps/web/src/pages/Creator.tsx`)

Public profile at `/creator/:userId`:
- Avatar + display name + join date
- "Games created: N" stat
- Total play count across all games
- Grid of their published games (using `GameCard`)
- If viewer is the creator: edit profile button

### 2. Create Earnings Dashboard (`apps/web/src/pages/Dashboard/Earnings.tsx`)

Private page at `/dashboard/earnings` (requires auth + subscription):
- Current balance card with large number display
- "Withdraw" button (enabled when balance >= $60)
  - If no Stripe account: redirect to Stripe Connect onboarding
  - If Stripe account: confirm and initiate payout
- Monthly earnings chart (simple bar chart or list):
  - Each month: gross revenue, your share (50%), status (pending/confirmed/paid)
- Per-game earnings breakdown table:
  - Game title, plays this month, estimated revenue, your share
- Payout history list:
  - Date, amount, status (processing/completed/failed)

### 3. Create Dashboard layout (`apps/web/src/pages/Dashboard/DashboardLayout.tsx`)

Shared layout for dashboard pages with sub-navigation:
- My Games
- Earnings
- Settings (subscription)

### 4. Update MyGames page (`apps/web/src/pages/MyGames.tsx`)

Move to `/dashboard/games` and add:
- Per-game stats: play count, favourite count, last played
- Thumbnail regeneration button (calls the thumbnail pipeline)
- Quick-publish action for drafts

### 5. Update routing (`apps/web/src/App.tsx`)

Add routes:
- `/creator/:userId` → Creator profile
- `/dashboard` → redirect to `/dashboard/games`
- `/dashboard/games` → MyGames (within DashboardLayout)
- `/dashboard/earnings` → Earnings
- `/dashboard/settings` → Settings (already created in Prompt 16)

### 6. Update API client (`apps/web/src/lib/api.ts`)

Add methods:
- `paymentsApi.getBalance()` → GET /payments/balance
- `paymentsApi.requestPayout()` → POST /payments/request-payout
- `paymentsApi.connectStripe()` → POST /payments/connect-stripe
- `paymentsApi.getConnectStatus()` → GET /payments/connect-status
- `paymentsApi.getEarnings(period?)` → GET /payments/earnings
- `usersApi.getProfile(userId)` → GET /auth/profile/:userId

### 7. Add profile endpoint to auth service

In `services/auth/src/routes/`, add:
- `GET /auth/profile/:userId` — public profile (display name, join date, game count)

## Constraints

- Earnings page requires active subscription
- Creator profile is public (anyone can view)
- Earnings amounts are estimates until reconciled
- Withdrawal requires Stripe Connect onboarding (first time)
- Dashboard layout uses sidebar sub-nav on desktop, tabs on mobile

## Files Created
- `apps/web/src/pages/Creator.tsx`
- `apps/web/src/pages/Dashboard/Earnings.tsx`
- `apps/web/src/pages/Dashboard/DashboardLayout.tsx`

## Files Modified
- `apps/web/src/pages/MyGames.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/lib/api.ts`
- `services/auth/src/app.ts`

---

---

# PROMPT 20: Game Population Pipeline

## Full System Context

Sloppy is an AI-powered browser game platform. The full v2 pipeline is built. Now we need to populate the platform with games using a local CLI tool.

**Already built (v1 complete + Prompts 1-19):**
- Full multi-agent AI pipeline: Concept Architect → Technical Planner → Code Generator → Validator → Debug Loop → Polish → Audio → Thumbnail → Deploy
- Dual-engine support (Phaser 3 + Three.js)
- All frontend pages and monetisation

**Population pipeline architecture:**
- Local Node.js CLI script (not a cloud service)
- Runs on your machine to brainstorm diverse game concepts
- Sends each concept through the full generation pipeline via API
- Quality filters before publishing
- Rate limiting and cost control

## Build Objective

Create a local CLI tool that brainstorms game concepts and mass-generates games through the existing pipeline.

## Specific Deliverables

### 1. Create population service (`services/game-population/`)

New pnpm workspace package (not a Cloud Run service — local only):

- `package.json` with dependencies: commander (CLI), chalk (colors), ora (spinners)
- `tsconfig.json`

### 2. Brainstorm agent (`services/game-population/src/brainstorm-agent.ts`)

Uses the LLM to generate diverse game concepts:
- System prompt strategy: generates 10 concepts at a time
- Each concept: title, tagline, genre, engine, coreMechanic, uniqueTwist, visualStyle, estimatedComplexity
- Diversity enforcement: after each batch, the agent sees the last 20 concepts to avoid repeats
- Only generates `simple` and `medium` complexity (skip `complex` for batch)

### 3. Batch runner (`services/game-population/src/batch-runner.ts`)

Queues and executes game generations:
- Sends each concept to `POST /generate` via the API
- Monitors generation status via SSE
- Tracks success/failure per game
- Rate limiting: configurable delay between submissions (default 20s)
- Max concurrent in-flight: 2 (semaphore)
- Daily token budget: configurable (`MAX_DAILY_TOKENS`)
- Auto-pause on rate limit errors (exponential backoff)
- Resume capability: stores completed game IDs, skips on restart

### 4. Quality filter (`services/game-population/src/quality-filter.ts`)

Post-generation quality check:
- Must have passed all 4 state screenshots
- Title must be unique (checked against existing games)
- Game bundle must be > 5KB
- Auto-publishes passing games, marks others as `needs_review`

### 5. CLI entry point (`services/game-population/src/cli.ts`)

Commander-based CLI:
```bash
# Populate 100 games across all genres
pnpm --filter=game-population populate --count=100

# Populate only 3D games
pnpm --filter=game-population populate --count=20 --genres=3d --delay-ms=30000

# Dry run — just generate concepts, don't send to pipeline
pnpm --filter=game-population populate --count=50 --dry-run

# Resume from a failed run
pnpm --filter=game-population populate --count=100 --resume
```

Options:
- `--count` — number of games to generate
- `--genres` — filter genres (comma-separated, or `2d`, `3d`, `all`)
- `--delay-ms` — delay between submissions (default 20000)
- `--api-url` — API base URL (default `http://localhost:3001`)
- `--dry-run` — generate concepts only, print to stdout
- `--resume` — skip already-generated games
- `--max-concurrent` — max parallel generations (default 2)

### 6. Config files

- `services/game-population/config/seed-concepts.json` — 20 hand-curated starting concepts
- `services/game-population/config/genre-weights.json` — relative frequency per genre (e.g., `{ "2d-arcade": 0.2, "2d-platformer": 0.15, "3d-racing": 0.1, ... }`)

### 7. Logging

- `services/game-population/logs/` directory
- Each run creates a timestamped log file: `population-YYYY-MM-DD-HHmmss.log`
- Logs: concept generated, generation started, generation completed/failed, quality filter result

## Constraints

- This is a LOCAL tool, not deployed to Cloud Run
- Must work with the existing API (authenticates as a special population user)
- Population user needs auth — create a Firebase service account or use anonymous auth with elevated rate limits
- Estimated cost: ~$0.10-0.20 per game (LLM tokens + thumbnail + audio)
- 200 games = ~$20-40 in API costs
- Must handle network interruptions gracefully (resume capability)
- Add `services/game-population` to `pnpm-workspace.yaml`

## Files Created
- `services/game-population/package.json`
- `services/game-population/tsconfig.json`
- `services/game-population/src/brainstorm-agent.ts`
- `services/game-population/src/batch-runner.ts`
- `services/game-population/src/quality-filter.ts`
- `services/game-population/src/cli.ts`
- `services/game-population/config/seed-concepts.json`
- `services/game-population/config/genre-weights.json`

## Files Modified
- `pnpm-workspace.yaml`

---

---

# PROMPT 21: Enhanced Generation UX & Game Player Chrome

## Full System Context

Sloppy is an AI-powered browser game platform. The v2 backend is complete with a multi-agent pipeline. Now we upgrade the frontend Create page to show the richer generation experience and add game player controls.

**Already built (v1 complete + Prompts 1-20):**
- Full v2 platform
- Current Create page (`apps/web/src/pages/Create.tsx`): prompt input → 5-phase progress (concept/code/assets/multiplayer/music) → game preview → refine → save/publish
- Current generation store (`apps/web/src/stores/generation.ts`): sessionId, phase, progress, message, startGeneration, connectToSSE
- Backend now emits richer SSE events: `GenerationEvent` with `type: 'phase' | 'progress' | 'iteration' | 'screenshot' | 'complete' | 'failed'`

**v2 Create page upgrades:**
- Show all v2 agent phases: Concept → Planning → Coding → Validating → Fixing → Polishing → Audio → Thumbnail → Building
- Show iteration counter during debug loop: "Fixing attempt 2/5..."
- Show live screenshots as they're captured during validation
- Game player chrome: control bar with Start/Pause/Restart buttons that communicate with the game via postMessage

## Build Objective

Upgrade the Create page generation UX and add game player controls.

## Specific Deliverables

### 1. Update generation store (`apps/web/src/stores/generation.ts`)

Update to handle the new `GenerationEvent` types:
- Track current iteration (attempt number, max attempts, error message)
- Store captured screenshots per state (intro, playing, paused, gameover)
- Track all v2 phases: concept, planning, coding, validating, fixing, polishing, multiplayer, audio, thumbnail, building

Update SSE parsing to handle the richer event types.

### 2. Update Create page phases (`apps/web/src/pages/Create.tsx`)

Replace the current 5-phase display with the full v2 pipeline:

```ts
const PHASES_V2 = [
  { key: 'concept', label: 'Designing', icon: '💡' },
  { key: 'planning', label: 'Planning', icon: '📋' },
  { key: 'coding', label: 'Building', icon: '⚡' },
  { key: 'validating', label: 'Testing', icon: '🧪' },
  { key: 'fixing', label: 'Fixing', icon: '🔧', conditional: true },
  { key: 'polishing', label: 'Polishing', icon: '✨' },
  { key: 'audio', label: 'Sound', icon: '🔊' },
  { key: 'thumbnail', label: 'Thumbnail', icon: '🖼️' },
  { key: 'building', label: 'Deploying', icon: '🚀' },
];
```

### 3. Add iteration counter UI

During the `fixing` phase, show:
- "Fixing attempt 2/5..." with animated progress
- The current error being fixed
- A small list of previous attempts with their errors

### 4. Add live screenshot display

When screenshots are received via SSE:
- Show a 2x2 grid of screenshot thumbnails (intro, playing, paused, gameover)
- Each slot fills in as the screenshot is captured
- Fade-in animation on each new screenshot

### 5. Create game control bar (`apps/web/src/components/GamePlayer/GameControlBar.tsx`)

Control bar displayed below the game preview iframe:
```
[▶ Start] [⏸ Pause] [🔄 Restart] [🔊 Mute] [🔲 Fullscreen]
```

- Buttons send commands via postMessage to the game iframe
- Buttons update based on game state (e.g., Pause disabled when not playing)
- Uses `useGameBridge` hook from Prompt 15

### 6. Create game state indicator (`apps/web/src/components/GamePlayer/GameStateIndicator.tsx`)

Shows current game state as a badge: IDLE, PLAYING, PAUSED, GAME OVER.

### 7. Add control bar to game preview on Create page

When a game is generated and previewing, show the `GameControlBar` below the iframe. Also show `GameStateIndicator` in the preview header.

### 8. Update game preview section

Replace the raw iframe in the Create page preview with the `GamePlayerShell` component (from Prompt 15) wrapped with the control bar. This gives consistent game playing experience across Create, Game page, and Feed.

## Constraints

- SSE events may arrive out of order — handle gracefully
- Screenshots are base64 encoded — don't store in Zustand long-term (memory), display and discard
- Control bar buttons must be disabled when game is loading or in error state
- Iteration counter should be encouraging, not alarming ("Perfecting your game..." not "Failed, retrying...")
- All animations via Framer Motion
- Mobile responsive: control bar as compact icons, screenshots in 2x1 grid

## Files Modified
- `apps/web/src/stores/generation.ts`
- `apps/web/src/pages/Create.tsx`

## Files Created
- `apps/web/src/components/GamePlayer/GameControlBar.tsx`
- `apps/web/src/components/GamePlayer/GameStateIndicator.tsx`

---

---

# Build Order Summary

| # | Prompt | Phase | Scope |
|---|--------|-------|-------|
| 1 | SDK v2 Contract & Shared Types | Foundation | `packages/runtime-sdk`, `packages/shared` |
| 2 | Database Schema v2 | Foundation | `packages/db` |
| 3 | Validation Pipeline v2 | Foundation | `services/game-builder` |
| 4 | Concept Architect & Technical Planner | AI Pipeline | `services/ai-orchestrator` |
| 5 | Code Generator Refactor (Dual-Engine) | AI Pipeline | `services/ai-orchestrator` |
| 6 | Genre Prompt Libraries | AI Pipeline | `services/ai-orchestrator` |
| 7 | Debug & Fix Agent + Polish Agent | AI Pipeline | `services/ai-orchestrator` |
| 8 | 3D Game Templates & SDK Utilities | AI Pipeline | `packages/runtime-sdk` |
| 9 | Multiplayer Intelligence & Injector | Multiplayer | `services/ai-orchestrator` |
| 10 | Sound Effects System | Audio | `packages/runtime-sdk`, `services/ai-orchestrator` |
| 11 | Thumbnail Generation Pipeline | Thumbnails | `services/ai-orchestrator`, `services/game-builder` |
| 12 | UI Design System Overhaul | UI | `apps/web` |
| 13 | Store Pages (Home, Explore, Category, Game) | UI | `apps/web`, `services/game-builder` |
| 14 | TikTok Feed | UI | `apps/web`, `services/game-builder` |
| 15 | Fullscreen & Responsive Game Playing | UI | `apps/web`, `packages/runtime-sdk` |
| 16 | Payments — Stripe Billing | Monetisation | `services/payments`, `apps/web` |
| 17 | Ad Integration & Revenue Attribution | Monetisation | `services/payments`, `apps/web` |
| 18 | Stripe Connect Creator Payouts | Monetisation | `services/payments` |
| 19 | Creator Dashboard & Profile | UI | `apps/web`, `services/auth` |
| 20 | Game Population Pipeline | Population | `services/game-population` |
| 21 | Enhanced Generation UX & Game Player Chrome | UI | `apps/web` |
