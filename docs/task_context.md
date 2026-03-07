# Task Context (Cumulative)

## Completed: Prompt 1 — SDK v2 Contract & Shared Types

### What Changed

**`packages/runtime-sdk/src/types.ts`** — Full rewrite
- Defined `SloppyGameV2` interface with complete lifecycle: `init`, `destroy`, `start`, `pause`, `resume`, `restart`
- Added screen-rendering methods: `renderIntroScreen`, `renderPauseScreen`, `renderGameOverScreen`, `renderHUD`
- Added state introspection: `getState()` → `GameState`, `getScore()` → `GameResult`
- Added `metadata: GameMetadata` (readonly) and `multiplayerHooks?: MultiplayerHooks`
- New supporting types: `GameState`, `GameInitConfig`, `ControlHint`, `GameResult`, `GameMetadata`, `MultiplayerHooks`, `GameGenre`, `GameEngine`
- Updated `GameConfig` for v2: added `engine`, `genre`, `controls`, `resolution`, `estimatedPlayTime`
- Kept old interface as `SloppyGameV1`, with `SloppyGame` as a deprecated alias pointing to `SloppyGameV1`

**`packages/runtime-sdk/src/validator.ts`** — Updated for v2
- `validateGameModule()` now checks all 12 v2 required methods plus `metadata` object and `supportsMultiplayer` boolean
- Multiplayer validation now checks for `multiplayerHooks` object with 6 methods (added `onPlayerJoin`, `onPlayerLeave`)
- Added `validateGameModuleV1()` for backward-compatible v1 module validation
- `validateGameSource()` now also checks that all v2 required method names appear in the source via regex

**`packages/runtime-sdk/src/schema.ts`** — Expanded config schema
- Added `engine` (enum: `phaser3`, `threejs`, `canvas2d`; default `canvas2d` for v1 backward compat)
- Added `genre` (enum of 8 genre strings)
- Added `controls` (array of `{ key, action }` objects)
- Added `resolution` (object: `width`, `height`, `scaleMode`)
- Added `estimatedPlayTime` (string)
- All new fields are optional for backward compatibility with v1 configs

**`packages/runtime-sdk/src/index.ts`** — Updated barrel exports
- Exports all new v2 types: `SloppyGameV2`, `GameEngine`, `GameGenre`, `GameState`, `GameInitConfig`, `GameMetadata`, `GameResult`, `ControlHint`, `MultiplayerHooks`
- Exports v1 compat types: `SloppyGameV1`, `SloppyGame`
- Exports `validateGameModuleV1` alongside `validateGameModule`

**`packages/shared/src/types/game.ts`** — Extended Game model
- Added `GameEngine` and `GameGenre` type aliases (mirrored from runtime-sdk for convenience)
- Added fields to `Game` interface: `genre: GameGenre`, `engine: GameEngine`, `thumbnailUrl: string | null`
- `GameFeedItem` extends `Game` so inherits these new fields automatically

**`packages/shared/src/types/generation.ts`** — Expanded generation pipeline
- `GenerationPhase` expanded to: `concept`, `planning`, `coding`, `validating`, `fixing`, `polishing`, `multiplayer`, `audio`, `thumbnail`, `building`
- Added `GenerationEvent` discriminated union type for rich SSE events (phase, progress, iteration, screenshot, complete, failed)
- Added `GenerationGameState` type for screenshot events
- Kept `GenerationStatus` as deprecated for v1 compat

**`packages/shared/src/types/api.ts`** — Re-exports `GenerationEvent`

### Backward Compatibility Notes (Prompt 1)
- `SloppyGame` type alias still resolves to `SloppyGameV1` — no import breakage
- `GameConfig` v2 schema defaults `engine` to `canvas2d` for v1 configs missing it
- `validateGameSource()` now does v2 source checks — v1 source will fail these checks; services should use the appropriate validator version for the game's SDK version

---

## Completed: Prompt 2 — Database Schema v2

### What Changed

**`packages/db/src/schema.ts`** — Extended games table + 6 new tables
- New game columns: `genre`, `engine`, `thumbnail_url`, `thumbnail_sm_url`, `resolution_width`, `resolution_height`, `scale_mode`, `favourite_count`
- New tables: `game_progress`, `creator_earnings`, `creator_stripe_accounts`, `creator_subscriptions`, `feed_events`, `ad_impressions`

**`packages/db/src/repositories/game.ts`** — Added `search()`, `getByGenre()`, `getByEngine()`, `getTrending()`, `updateThumbnail()`, `incrementFavouriteCount()`, `decrementFavouriteCount()`, genre diversity for `getFeed()`

**New repositories**: `game-progress.ts`, `creator-earnings.ts`, `creator-stripe.ts`, `creator-subscription.ts`, `feed-event.ts`

### Backward Compatibility Notes (Prompt 2)
- All new columns nullable or have defaults — safe for v1 data
- `Game.genre` is `GameGenre | null`
- `engine` defaults to `'canvas2d'`

---

## Completed: Prompt 3 — Validation Pipeline v2

### What Changed

**`services/game-builder/src/validation/pipeline.ts`** — v1/v2 detection, `ValidationOutput.isV2`
**`services/game-builder/src/validation/runtime-validator.ts`** — NEW: Puppeteer runtime validation driving full v2 state machine
**`services/game-builder/src/validation/screenshot-capture.ts`** — NEW: Screenshot + thumbnail utility
**`services/game-builder/src/storage/gcs.ts`** — `uploadScreenshots()` added
**`services/game-builder/src/routes/games.ts`** — Integrated runtime validation on POST/PUT

### Key Conventions (Prompt 3)
- Game must be accessible as `window.game` in browser context
- Games must `postMessage({ type: 'sloppy:game:ready' })` after `init()`
- Game-over testing: validator tries `triggerGameOver()` hook first, falls back to `renderGameOverScreen()`
- Runtime validation returns 422 with structured `{ consoleErrors, crashedDuring, rendered }` on failure
- v1 vs v2 detection: presence of `engine` field in `config.json`

---

## Completed: Prompt 4 — Multi-Agent Pipeline: Concept Architect & Technical Planner

### What Changed

**`services/ai-orchestrator/src/pipeline/types.ts`** — Expanded with v2 types
- Added `GameDesignDocument` interface: comprehensive GDD with `engine` (`phaser3` | `threejs`), `genre` (from `GameGenre`), `logline`, `coreMechanic`, `progression`, `scoring`, `gameOverCondition`, `restartBehavior`, `screens` (intro/hud/pause/gameOver), `multiplayer` (suitable/mode/maxPlayers/syncStrategy), `objects`, `complexity`, `estimatedGenerationTimeSeconds`
- Added `TechnicalSpec` interface: `fileStructure`, `engineVersion`, `modules` (name + responsibility), `criticalApis`, `performanceConstraints`, `sdkV2Mapping` (init/start/pause/resume/restart/destroy with engine-specific implementation descriptions)
- `GameConcept` kept as deprecated backward-compat type
- Added `gddToGameConcept()` adapter function for backward compat with existing phases
- Updated `PipelineContext` to include: `gdd?: GameDesignDocument`, `spec?: TechnicalSpec`, `concept?` (deprecated, populated via adapter), `tokenUsage.byPhase` record for per-phase token tracking

**`services/ai-orchestrator/src/agents/concept-architect.ts`** — NEW
- `runConceptArchitect(prompt, llm, onProgress, maxTokens)` function
- Comprehensive system prompt with:
  - Engine selection logic: Phaser 3 for 2D, Three.js for 3D (never canvas2d for new games)
  - Genre classification from the 8-genre `GameGenre` union type
  - Multiplayer suitability assessment (competitive/cooperative/versus)
  - Complexity estimation (simple/medium/complex → 15/30/60s)
  - Full GDD JSON schema in the prompt
- Post-generation validation: checks required fields, corrects engine/genre mismatches
- Uses `llm.generateJSON<GameDesignDocument>()`
- Returns `{ gdd, usage }`

**`services/ai-orchestrator/src/agents/technical-planner.ts`** — NEW
- `runTechnicalPlanner(gdd, llm, onProgress, maxTokens)` function
- System prompt dynamically includes:
  - Full SDK v2 contract (all lifecycle methods, screen rendering, state introspection, metadata)
  - Engine-specific API guide (Phaser 3 OR Three.js based on GDD engine selection)
  - Phaser 3 guide: Arcade Physics, Scene lifecycle, input keyboard, graphics/text APIs, lifecycle mapping
  - Three.js guide: Scene/Camera/Renderer setup, Mesh/Geometry/Material, lighting, requestAnimationFrame loop, Box3 collision, lifecycle mapping
  - The GDD itself embedded as JSON in the prompt
  - `sloppy:game:ready` postMessage requirement
  - `window.game` accessor requirement
- Post-generation validation: checks fileStructure, modules, sdkV2Mapping
- Uses `llm.generateJSON<TechnicalSpec>()`
- Returns `{ spec, usage }`

**`services/ai-orchestrator/src/pipeline/orchestrator.ts`** — Refactored for multi-agent pipeline
- Replaced `runConceptPhase` with `runConceptArchitect` (Phase 1: concept → GDD)
- Added `runTechnicalPlanner` as Phase 2 (planning → TechnicalSpec)
- Pipeline sequence: concept → planning → coding → assets → multiplayer → audio → (placeholders for validating, fixing, polishing, thumbnail, building)
- GDD stored in `ctx.gdd`, also converted to legacy `ctx.concept` via `gddToGameConcept()` for backward compat with existing code/assets/multiplayer phases
- `trackTokens()` helper populates `ctx.tokenUsage.byPhase`
- Multiplayer phase always runs (internal check handles skip for single-player games)
- Bundle config now uses GDD fields: `gdd.title`, `gdd.logline`, `gdd.multiplayer.suitable`, `gdd.multiplayer.maxPlayers`
- Removed import of `runConceptPhase` (concept.ts still exists but is no longer called)

**`services/ai-orchestrator/src/session/manager.ts`** — Extended for v2 events
- `updateProgress()` now publishes both legacy `GenerationStatus` and v2 `GenerationEvent` (phase + progress) via Redis pub/sub
- Added `publishIteration(sessionId, attempt, maxAttempts, error)` — streams debug-loop iteration events (for Prompt 7)
- Added `publishScreenshot(sessionId, state, imageBase64)` — streams runtime screenshot events (for Prompt 7)
- `complete()` now emits v2 `GenerationEvent` type `'complete'` alongside legacy event; uses `'building'` as final phase in state, `'done'` in legacy event for frontend compat
- `fail()` now emits v2 `GenerationEvent` type `'failed'` alongside legacy event

**`services/ai-orchestrator/src/config.ts`** — Added `planning` max tokens
- `maxTokens.planning` = `MAX_TOKENS_PLANNING` env var, default 3000

**Existing phase files updated (phase name fixes):**
- `services/ai-orchestrator/src/pipeline/code.ts` — `'code'` → `'coding'` in all `onProgress` calls
- `services/ai-orchestrator/src/pipeline/assets.ts` — `'assets'` → `'coding'` in all `onProgress` calls (assets folded into coding phase)
- `services/ai-orchestrator/src/pipeline/music.ts` — `'music'` → `'audio'` in `onProgress` call

### Files Modified
- `services/ai-orchestrator/src/pipeline/types.ts`
- `services/ai-orchestrator/src/pipeline/orchestrator.ts`
- `services/ai-orchestrator/src/session/manager.ts`
- `services/ai-orchestrator/src/config.ts`
- `services/ai-orchestrator/src/pipeline/code.ts`
- `services/ai-orchestrator/src/pipeline/assets.ts`
- `services/ai-orchestrator/src/pipeline/music.ts`

### Files Created
- `services/ai-orchestrator/src/agents/concept-architect.ts`
- `services/ai-orchestrator/src/agents/technical-planner.ts`

### Key Architecture Decisions (Prompt 4)
- Each agent is a standalone module under `services/ai-orchestrator/src/agents/` with a single exported `run*()` function
- Agents return `{ data, usage }` instead of mutating context directly — the orchestrator handles context updates
- GDD replaces GameConcept as the primary design artifact; GameConcept still populated for backward compat
- TechnicalSpec provides engine-specific implementation guidance that the Code Generator (Prompt 5) will consume
- Engine selection is enforced: `phaser3` for 2D genres, `threejs` for 3D genres, `canvas2d` is never used for new v2 games
- System prompts include the full SDK v2 contract and engine API guides so agents have complete context

### Downstream Impact for Next Prompts (Prompt 4 era — some addressed by Prompt 5)
- ~~**Prompt 5 (Code Generator)** should consume both `ctx.gdd` and `ctx.spec`~~ → Done in Prompt 5
- ~~**Prompt 5** should update `buildHtml()` in the orchestrator~~ → Done in Prompt 5 (buildHtml removed; code gen outputs full HTML)
- **Prompt 6 (Validation)** should use the GDD's engine field to set up appropriate validation — Phaser games need the Phaser script loaded in the Puppeteer context
- **Prompt 7 (Debug Loop)** should use `sessionManager.publishIteration()` and `sessionManager.publishScreenshot()` to stream debug progress to the client
- **Prompt 9 (Multiplayer)** should check `ctx.gdd.multiplayer.suitable` and use `gdd.multiplayer.syncStrategy` to select the right approach
- The `concept.ts` file and `prompts/concept.ts` are now unused by the pipeline but still exist — can be cleaned up or kept for reference
- The `LLMClient` interface (`generateText`, `generateJSON`) is used by both agents and should NOT be modified

---

## Completed: Prompt 5 — Code Generator Refactor (Dual-Engine)

### What Changed

**`services/ai-orchestrator/src/prompts/engines/phaser3.ts`** — NEW
- Exports `PHASER3_SYSTEM_PROMPT`: comprehensive Phaser 3 code generation guide covering scene architecture (Boot, Intro, Game, Pause, GameOver scenes), SDK v2 lifecycle mapping to Phaser scene transitions, and full API essentials (Arcade Physics, Graphics + generateTexture, Text, Input, Camera/Effects, Tweens, Particles, Timers)
- Exports `PHASER3_QUALITY_RULES`: particle effects on impacts, tween transitions, camera shake/flash, HUD with setScrollFactor(0), object pooling via physics groups, generateTexture in create() not update()
- Exports `PHASER3_FORBIDDEN_PATTERNS`: no this.load.image/audio/spritesheet, no multiple Phaser.Game instances, no Graphics in update(), no document.createElement('canvas')
- Exports `PHASER3_CDN_URL`: `https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js`
- Exports `PHASER3_RESOLUTION`: `{ width: 960, height: 540 }`

**`services/ai-orchestrator/src/prompts/engines/threejs.ts`** — NEW
- Exports `THREEJS_SYSTEM_PROMPT`: Three.js code generation guide covering scene architecture (Renderer, Camera, Scene Graph, State Machine, HUD overlay, Input, Game Loop), SDK v2 lifecycle mapping to Three.js renderer/animation loop, and API essentials (Geometries, Materials, Lighting, Shadows, Camera smoothing, Animation loop with Clock, Collision via Box3/Sphere, Object Management, HUD overlays via HTML)
- Exports `THREEJS_QUALITY_RULES`: mandatory shadows + PCFSoftShadowMap, ACES Filmic tone mapping, MeshStandardMaterial (never Basic), fog for depth, camera lerp smoothing, max 10k triangles, pre-create meshes, THREE.Clock for delta, dispose in destroy(), pixel ratio cap, directional+ambient lights, emissive for glowing effects
- Exports `THREEJS_FORBIDDEN_PATTERNS`: no new THREE.* in game loop, no MeshBasicMaterial, no external model/texture loaders, no missing dispose, no new Vector3/Box3 in loop, no missing cancelAnimationFrame, no camera snap without lerp
- Exports `THREEJS_CDN_URL`: `https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js`
- Exports `THREEJS_RESOLUTION`: `{ width: 1280, height: 720 }`

**`services/ai-orchestrator/src/prompts/engines/index.ts`** — NEW
- `EnginePrompt` interface: `{ systemPrompt, qualityRules, forbiddenPatterns, cdnUrl, resolution }`
- `getEnginePrompt(engine: GameEngine): EnginePrompt` — routes to phaser3 or threejs prompt set; throws for `canvas2d` (legacy v1)
- Engine prompt registry keyed by `Exclude<GameEngine, 'canvas2d'>`

**`services/ai-orchestrator/src/prompts/code.ts`** — Full rewrite
- Replaced v1 `CODE_SYSTEM_PROMPT` (hardcoded Canvas 2D) with composable v2 system:
  - `buildCodeSystemPrompt(gdd, spec)` — composes: intro → SDK v2 contract → engine-specific system prompt → quality rules → forbidden patterns → chain-of-thought instruction → output format
  - `buildCodeUserPrompt(gdd, spec)` — formats GDD fields (title, logline, engine, genre, visual style, core mechanic, progression, scoring, game-over condition, restart behavior, screens, objects, multiplayer) + TechnicalSpec fields (file structure, engine version, modules, critical APIs, performance constraints, SDK v2 lifecycle mapping)
  - `buildCodeRetryPrompt(gdd, spec, previousCode, errors)` — includes validation errors, game context, SDK mapping reference, and the previous code for correction
- SDK v2 contract prompt section: all 12 required methods + metadata + supportsMultiplayer + `window.game` assignment + `sloppy:game:ready` postMessage
- Chain-of-thought instruction: requires the LLM to reason through game loop structure, scenes/modules, state machine mapping, object management, and screen rendering before writing code
- Output format: requires complete self-contained HTML starting with `<!DOCTYPE html>`, inline `<script>` tags, engine CDN in `<head>`, error handling with postMessage
- `CODE_SYSTEM_PROMPT` kept as empty string for backward compat (deprecated)

**`services/ai-orchestrator/src/pipeline/code.ts`** — Refactored
- `runCodePhase()` now reads `ctx.gdd!` and `ctx.spec!` instead of `ctx.concept!`
- Uses `buildCodeSystemPrompt(gdd, spec)` and `buildCodeUserPrompt(gdd, spec)` for the initial generation
- Uses `buildCodeRetryPrompt(gdd, spec, html, errors)` for retry
- Added `extractInlineScript(html)` — extracts inline JS from `<script>` tags (skipping CDN src tags) for source-level validation
- Added `validateGeneratedHtml(html)` — validates: DOCTYPE present, `window.SloppyGame` assignment, inline scripts exist, source-level validation via `validateGameSource()`
- `stripMarkdownFences()` updated to also strip `html` language fence
- Output is now the full HTML string (not just JS code)

**`services/ai-orchestrator/src/pipeline/orchestrator.ts`** — Updated
- Removed `buildHtml()` function entirely — the code generator now outputs the complete self-contained HTML with engine CDN `<script>` tag inline
- Bundle construction: `bundle.html = ctx.gameCode!` (the full HTML from code gen), `bundle.js = ''` (deprecated, all code inline)
- Bundle config now includes `engine` and `genre` fields from the GDD
- Game-builder handoff: no longer sends `game.js` file — only `index.html`, `config.json`, and SVG assets
- Updated pipeline comment to mark Prompt 5 as complete

**`services/ai-orchestrator/src/pipeline/types.ts`** — Updated
- `GameBundle.js` marked as `@deprecated` (v2 code is inline in HTML)
- `GameBundle.config` now includes optional `engine?: GameEngine` and `genre?: GameGenre` fields

**`services/ai-orchestrator/src/config.ts`** — Updated
- `maxTokens.code` default increased from 8000 to 12000 (full HTML output is larger than JS-only)

**`services/ai-orchestrator/src/prompts/index.ts`** — Updated
- Now exports `buildCodeSystemPrompt` alongside deprecated `CODE_SYSTEM_PROMPT`
- Now exports `getEnginePrompt` and `EnginePrompt` type from engines

### Key Architecture Decisions (Prompt 5)
- Code generator outputs a **single self-contained HTML file** (not separate game.js) — engine loaded via CDN `<script>` tag in `<head>`, all game code inline in `<script>` in `<body>`
- `buildHtml()` removed from orchestrator — the code generator is now responsible for the complete HTML structure including error handling, container setup, and game initialization
- Engine prompt library is modular: each engine is a separate file under `prompts/engines/`, with a router (`getEnginePrompt()`) that selects the right one based on `gdd.engine`
- System prompt is composable: SDK contract + engine guide + quality rules + forbidden patterns + chain-of-thought + output format — each section is a separate string constant composed by `buildCodeSystemPrompt()`
- Chain-of-thought instruction forces the LLM to reason about game structure before coding, improving output quality
- Both `window.SloppyGame` and `window.game` must be assigned — the former is the production interface, the latter is used by the runtime validator (Puppeteer)
- CDN URLs are version-pinned: Phaser 3.80.1, Three.js 0.165.0
- Phaser resolution: 960×540, Three.js resolution: 1280×720
- All visuals must be procedural (no external assets) — enforced in both engine quality rules and forbidden patterns

### Downstream Impact for Next Prompts
- ~~**Prompt 6 (Genre Prompts & Screens)**: Genre-specific prompt templates and screen rendering templates need to be created and injected into the code generator~~ → Done in Prompt 6
- **Prompt 7 (Debug & Fix Loop)**: The retry/fix loop should use `buildCodeRetryPrompt(gdd, spec, html, errors)` — it already accepts the full HTML and validation errors. The fix loop should re-validate after each fix using `validateGeneratedHtml()`.
- **Prompt 9 (Multiplayer)**: `ctx.gameCode` is now HTML, so multiplayer injection must parse the HTML, find the inline `<script>` tags, and inject multiplayer hooks into the game code within the HTML.
- **Prompt 10 (Audio)**: Audio assets cannot be loaded externally. Sound effects must be procedurally generated using Web Audio API inline in the HTML.
- The `concept.ts` prompt file and the old `GameConcept`-based `buildCodeUserPrompt` are fully deprecated — no pipeline phase uses them anymore.
- `config.generation.maxTokens` now has: `concept` (2000), `planning` (3000), `code` (12000), `assets` (2000), `multiplayer` (4000)

---

## Completed: Prompt 6 — Genre Prompt Libraries & Screen Templates

### What Changed

**`services/ai-orchestrator/src/prompts/genres/platformer-2d.ts`** — NEW
- Exports `PLATFORMER_2D_PROMPT`: Phaser 3-specific prompt for 2D platformers covering gravity/jump physics (Arcade Physics, setVelocityY, body.blocked.down), platform collision (static/dynamic groups, moving platforms via tweens), horizontal movement with acceleration, parallax scrolling via scrollFactor, and object archetypes (player, platforms, collectibles, hazards, enemies with patrol AI)

**`services/ai-orchestrator/src/prompts/genres/topdown-2d.ts`** — NEW
- Exports `TOPDOWN_2D_PROMPT`: Phaser 3-specific prompt for 2D top-down games covering 8-directional movement with diagonal normalization, projectile pooling (physics group with maxSize), enemy AI patterns (chase via moveToObject, patrol, wander, ranged), camera follow with dead zone

**`services/ai-orchestrator/src/prompts/genres/puzzle-2d.ts`** — NEW
- Exports `PUZZLE_2D_PROMPT`: Phaser 3-specific prompt for 2D puzzles covering grid systems (2D array, cell-to-screen mapping), match mechanics (horizontal/vertical run detection, gravity, chain detection), drag-and-drop (setDraggable, snap-to-grid), clear/win conditions, undo system

**`services/ai-orchestrator/src/prompts/genres/arcade-2d.ts`** — NEW
- Exports `ARCADE_2D_PROMPT`: Phaser 3-specific prompt for 2D arcade games covering simple controls, score chasing with localStorage high scores, difficulty scalar that grows with time/score, lives system with invincibility frames, spawn patterns with time.addEvent

**`services/ai-orchestrator/src/prompts/genres/racing-3d.ts`** — NEW
- Exports `RACING_3D_PROMPT`: Three.js-specific prompt for 3D racing covering track generation from segments (BoxGeometry), simplified vehicle physics (acceleration, steering, friction), lap counting with checkpoint Box3 zones, camera follow with lerp, barrier collision

**`services/ai-orchestrator/src/prompts/genres/fps-3d.ts`** — NEW
- Exports `FPS_3D_PROMPT`: Three.js-specific prompt for 3D first-person games covering pointer lock controls (euler yaw/pitch with clamping), WASD movement relative to camera quaternion (pre-allocated vectors), raycasting for shooting, enemy pool with toggle visible, health system with screen flash

**`services/ai-orchestrator/src/prompts/genres/puzzle-3d.ts`** — NEW
- Exports `PUZZLE_3D_PROMPT`: Three.js-specific prompt for 3D puzzles covering camera orbit (spherical coordinates), object interaction via raycasting, spatial puzzle patterns (alignment, stacking, path finding, color mixing), snap-to-position with valid placement positions, completion detection against goal state

**`services/ai-orchestrator/src/prompts/genres/endless-runner-3d.ts`** — NEW
- Exports `ENDLESS_RUNNER_3D_PROMPT`: Three.js-specific prompt for 3D endless runners / third-person games covering procedural track segments (ring buffer pool of 6-8 segments), auto-forward motion with increasing speed, 3-lane switching with lerp, jump/slide mechanics, obstacle spawning per segment with Box3 collision

**`services/ai-orchestrator/src/prompts/genres/index.ts`** — NEW
- `getGenrePrompt(genre: GameGenre): string` — routes to the correct genre prompt based on genre value
- Genre-to-file mapping: `2d-platformer` → platformer-2d, `2d-topdown` → topdown-2d, `2d-puzzle` → puzzle-2d, `2d-arcade` → arcade-2d, `3d-racing` → racing-3d, `3d-firstperson` → fps-3d, `3d-puzzle` → puzzle-3d, `3d-thirdperson` → endless-runner-3d
- Complete `Record<GameGenre, string>` mapping ensures all 8 genres are covered

**`services/ai-orchestrator/src/prompts/screens/intro.ts`** — NEW
- Exports `INTRO_SCREEN_PROMPT`: engine-agnostic template requiring title text with tween, pulsing "Press Start" prompt, controls hint, high score from localStorage, animated background. Specifies canvas-based rendering for Phaser, HTML overlay acceptable for Three.js.

**`services/ai-orchestrator/src/prompts/screens/pause.ts`** — NEW
- Exports `PAUSE_SCREEN_PROMPT`: engine-agnostic template requiring semi-transparent backdrop (rgba 0.5–0.7), "PAUSED" text, resume prompt, optional restart/quit buttons. Specifies separate Scene for Phaser, HTML overlay for Three.js.

**`services/ai-orchestrator/src/prompts/screens/gameover.ts`** — NEW
- Exports `GAMEOVER_SCREEN_PROMPT`: engine-agnostic template requiring "GAME OVER" header with entrance tween, final score display, high score comparison with localStorage and "NEW HIGH SCORE!" celebration, "Play Again" prompt, back-to-menu option. Receives score object `{ score, level?, timeElapsed, customData? }`.

**`services/ai-orchestrator/src/prompts/screens/hud.ts`** — NEW
- Exports `HUD_SCREEN_PROMPT`: engine-agnostic template covering score counter, health/lives display, timer, level indicator. Specifies Phaser approach (text with setScrollFactor(0)) vs Three.js approach (HTML overlay div). Design guidelines for minimal, readable HUD.

**`services/ai-orchestrator/src/prompts/screens/index.ts`** — NEW
- `ScreenPrompts` interface: `{ intro, pause, gameover, hud }` — all strings
- `getScreenPrompts(): ScreenPrompts` — returns all four screen template prompts

**`services/ai-orchestrator/src/prompts/code.ts`** — Updated
- `buildCodeSystemPrompt()` now imports and injects `getGenrePrompt(gdd.genre)` and `getScreenPrompts()` into the system prompt
- Composition order: SDK v2 Contract → Engine Prompt → **Genre Prompt** → **Screen Templates** → Quality Rules → Forbidden Patterns → Chain of Thought → Output Format
- Genre prompt appears after engine prompt and before quality rules (as specified)
- All four screen templates (intro, pause, gameover, hud) are composed into a single "Screen Rendering Templates" section

**`services/ai-orchestrator/src/prompts/index.ts`** — Updated
- Now exports `getGenrePrompt` from `./genres/index.js`
- Now exports `getScreenPrompts` and `ScreenPrompts` type from `./screens/index.js`
- Added `buildFullCodePrompt(gdd, spec): { system, user }` — unified convenience function that composes the complete system + user prompt pair for code generation

### Files Created
- `services/ai-orchestrator/src/prompts/genres/platformer-2d.ts`
- `services/ai-orchestrator/src/prompts/genres/topdown-2d.ts`
- `services/ai-orchestrator/src/prompts/genres/puzzle-2d.ts`
- `services/ai-orchestrator/src/prompts/genres/arcade-2d.ts`
- `services/ai-orchestrator/src/prompts/genres/racing-3d.ts`
- `services/ai-orchestrator/src/prompts/genres/fps-3d.ts`
- `services/ai-orchestrator/src/prompts/genres/puzzle-3d.ts`
- `services/ai-orchestrator/src/prompts/genres/endless-runner-3d.ts`
- `services/ai-orchestrator/src/prompts/genres/index.ts`
- `services/ai-orchestrator/src/prompts/screens/intro.ts`
- `services/ai-orchestrator/src/prompts/screens/pause.ts`
- `services/ai-orchestrator/src/prompts/screens/gameover.ts`
- `services/ai-orchestrator/src/prompts/screens/hud.ts`
- `services/ai-orchestrator/src/prompts/screens/index.ts`

### Files Modified
- `services/ai-orchestrator/src/prompts/code.ts`
- `services/ai-orchestrator/src/prompts/index.ts`

### Key Architecture Decisions (Prompt 6)
- Genre prompts follow the same modular pattern as engine prompts: one file per genre under `prompts/genres/`, with a router function `getGenrePrompt()` keyed by `GameGenre`
- 2D genre prompts reference Phaser 3-specific APIs (Arcade Physics, scene architecture, graphics/text APIs)
- 3D genre prompts reference Three.js-specific APIs (geometries, materials, Box3 collision, camera lerp, pre-allocated vectors)
- Screen templates are engine-agnostic — they describe visual requirements and behavior, then note engine-specific implementation (Phaser Scene vs HTML overlay)
- Each genre prompt is concise (~800–1200 tokens) covering: core mechanics, object archetypes, scoring patterns, difficulty progression
- `buildFullCodePrompt(gdd, spec)` provides a single entry point for consumers that need both system and user prompts without importing individual builders
- The system prompt composition order is: SDK v2 Contract → Engine Prompt → Genre Prompt → Screen Templates → Quality Rules → Forbidden Patterns → Chain of Thought → Output Format

### Downstream Impact for Next Prompts
- **Prompt 7 (Debug & Fix Loop)**: The code generator now has genre-specific and screen-specific guidance, so validation errors related to missing screens or genre mechanics should be less frequent. `buildCodeRetryPrompt()` does not inject genre/screen prompts on retry (only the system prompt has them), which is intentional — the retry focuses on fixing specific errors rather than regenerating from scratch.
- **Prompt 9 (Multiplayer)**: Genre prompts include multiplayer-relevant patterns (e.g., enemy AI in top-down, projectile systems in FPS). The multiplayer injection should be aware that these patterns exist in the generated code.
- The `buildFullCodePrompt()` convenience function can be used by any future consumer that needs the full prompt pair (e.g., a standalone code generation endpoint or CLI tool).
- `config.generation.maxTokens` remains: `concept` (2000), `planning` (3000), `code` (12000), `assets` (2000), `multiplayer` (4000). The genre/screen prompts add ~3000–4000 tokens to the system prompt, but this is within the model's context window and does not affect `maxTokens.code` (which controls output length).

---

## Completed: Prompt 6 Expansion — Extended Genre Library + Novel Genre Handling

### What Changed

Expanded the genre system from 8 genres to 18 genres (10 new specific genres + 2 custom fallbacks for novel concepts).

**`packages/runtime-sdk/src/types.ts`** — Updated `GameGenre` union
- Added 10 new genre values: `2d-shooter`, `2d-tower-defense`, `2d-endless-runner`, `2d-rhythm`, `2d-cards`, `2d-idle`, `2d-custom`, `3d-flight`, `3d-platformer`, `3d-custom`
- Total: 18 genres (11 2D + 7 3D)

**`packages/runtime-sdk/src/schema.ts`** — Updated JSON schema enum
- Genre enum now lists all 18 genre values

**`services/ai-orchestrator/src/agents/concept-architect.ts`** — Updated
- `GAME_GENRES` array expanded to 18 entries
- System prompt now includes a **Genre Selection Guide** with one-line descriptions and example games for each genre (helps the LLM pick the right genre)
- Engine selection text updated to mention all new 2D and 3D genre categories
- Explicit instruction: "Use `2d-custom` or `3d-custom` only when the concept genuinely does not fit any specific genre"

**New genre prompt files created:**
- `services/ai-orchestrator/src/prompts/genres/shooter-2d.ts` — `SHOOTER_2D_PROMPT`: auto-scrolling, projectile pools, bullet patterns (single/spread/circle/aimed), wave spawning with formations, power-up weapon tiers (Phaser 3)
- `services/ai-orchestrator/src/prompts/genres/tower-defense-2d.ts` — `TOWER_DEFENSE_2D_PROMPT`: waypoint path system, grid-based tower placement, 4 tower types (basic/splash/slow/sniper), tower targeting + range visualization, economy system, wave management, base health (Phaser 3)
- `services/ai-orchestrator/src/prompts/genres/endless-runner-2d.ts` — `ENDLESS_RUNNER_2D_PROMPT`: auto-run with player at fixed X, jump/duck mechanics, procedural obstacle spawning with pooling, ground tileSprite scrolling, parallax backgrounds, speed increase over time (Phaser 3)
- `services/ai-orchestrator/src/prompts/genres/rhythm-2d.ts` — `RHYTHM_2D_PROMPT`: note spawning from beat map arrays, hit zone with ±50ms/±100ms timing windows (Perfect/Good/Miss), 2-4 lane system with key mapping, combo multiplier, procedural BPM-based beat generation, accuracy rating (Phaser 3)
- `services/ai-orchestrator/src/prompts/genres/cards-2d.ts` — `CARDS_2D_PROMPT`: card data model with graphics-generated textures, hand management with fan layout, turn-based phase system (Draw/Play/Resolve/Opponent), card effects (attack/defense/heal/buff), opponent AI with priority-based card selection, mana/energy system (Phaser 3)
- `services/ai-orchestrator/src/prompts/genres/idle-2d.ts` — `IDLE_2D_PROMPT`: click generation with floating "+N" text, passive income generators with per-second rate, exponential cost scaling (baseCost * 1.15^level), large number formatting (K/M/B/T), prestige system, localStorage persistence for idle progress (Phaser 3)
- `services/ai-orchestrator/src/prompts/genres/flight-3d.ts` — `FLIGHT_3D_PROMPT`: pitch/yaw/roll controls with quaternion-based forward vector, throttle speed control, projectile pools in ship forward direction, enemy ship AI, third-person follow camera with lag, starfield environment, asteroid obstacles (Three.js)
- `services/ai-orchestrator/src/prompts/genres/platformer-3d.ts` — `PLATFORMER_3D_PROMPT`: third-person orbit camera with spherical coordinates, camera-relative WASD movement, manual gravity + jump (no physics lib), platform collision with AABB checks, moving/disappearing platforms, collectibles with rotation + bob, checkpoints, squash-and-stretch landing (Three.js)
- `services/ai-orchestrator/src/prompts/genres/custom-2d.ts` — `CUSTOM_2D_PROMPT`: generic 2D game development guide for novel/hybrid concepts (Phaser 3). Covers architecture (game loop, input, physics, state), general patterns (pooling, procedural visuals, camera, tweens, timers), and adaptability guidelines for physics-based, turn-based, drawing, or simulation concepts.
- `services/ai-orchestrator/src/prompts/genres/custom-3d.ts` — `CUSTOM_3D_PROMPT`: generic 3D game development guide for novel/hybrid concepts (Three.js). Covers architecture (renderer, scene, camera options, game loop, state), general patterns (pooling, collision, materials, geometries, HUD, cleanup), and adaptability guidelines for physics, exploration, building, simulation, or turn-based concepts.

**`services/ai-orchestrator/src/prompts/genres/index.ts`** — Updated
- `GENRE_PROMPTS` record expanded from 8 to 18 entries
- All new imports added
- `Record<GameGenre, string>` type ensures compile-time completeness check (TypeScript will error if any genre is missing)

### Novel Genre Handling Strategy
- Games with novel or hybrid concepts that don't fit any specific genre use `2d-custom` or `3d-custom`
- The Concept Architect's system prompt instructs the LLM to prefer specific genres whenever possible — custom is a last resort
- Custom genre prompts provide comprehensive engine-specific development guidance (all the patterns and best practices) without genre-specific mechanics
- Custom prompts include "Adaptability Guidelines" sections that cover common novel concept types: physics-based, turn-based, simulation, drawing/creation, exploration, building
- The engine/genre mismatch correction in concept-architect.ts works for all genres via the `startsWith('2d-')` / `startsWith('3d-')` prefix check, which automatically covers all current and future genres

### Files Created
- `services/ai-orchestrator/src/prompts/genres/shooter-2d.ts`
- `services/ai-orchestrator/src/prompts/genres/tower-defense-2d.ts`
- `services/ai-orchestrator/src/prompts/genres/endless-runner-2d.ts`
- `services/ai-orchestrator/src/prompts/genres/rhythm-2d.ts`
- `services/ai-orchestrator/src/prompts/genres/cards-2d.ts`
- `services/ai-orchestrator/src/prompts/genres/idle-2d.ts`
- `services/ai-orchestrator/src/prompts/genres/flight-3d.ts`
- `services/ai-orchestrator/src/prompts/genres/platformer-3d.ts`
- `services/ai-orchestrator/src/prompts/genres/custom-2d.ts`
- `services/ai-orchestrator/src/prompts/genres/custom-3d.ts`

### Files Modified
- `packages/runtime-sdk/src/types.ts` — `GameGenre` union expanded to 18 values
- `packages/runtime-sdk/src/schema.ts` — JSON schema genre enum expanded to 18 values
- `services/ai-orchestrator/src/agents/concept-architect.ts` — `GAME_GENRES` array + system prompt updated with genre guide
- `services/ai-orchestrator/src/prompts/genres/index.ts` — `GENRE_PROMPTS` record expanded to 18 entries

### Backward Compatibility
- All new genres are purely additive — existing genre values unchanged
- DB `genre` column is `text`, not a DB enum — no migration needed for new values
- Existing games with the original 8 genres are unaffected
- The JSON schema's `genre` field remains optional — v1 configs without genre still validate

---

## Completed: Prompt 7 — Debug & Fix Agent + Polish Agent

### What Changed

**`services/ai-orchestrator/src/agents/debug-fixer.ts`** — NEW
- `runDebugFixer(ctx: DebugContext, llm, onProgress, maxTokens)` function
- `DebugContext` interface: `gdd`, `spec`, `currentCode`, `validationErrors` (static), `runtimeErrors` (Puppeteer), `screenshots` (base64 per state), `iterationCount`
- System prompt strategy:
  - Receives exact error messages with check type (static vs runtime with phase)
  - Receives screenshots as base64 images embedded in the user prompt
  - Receives the original spec's SDK v2 lifecycle mapping for reference
  - Instructed to FIX ONLY the failing parts, not rewrite the entire game
  - Common fix patterns enumerated: missing methods, state not transitioning, blank screens, console errors, `sloppy:game:ready` not firing, `window.game` not set
  - Engine-specific guidance (Phaser 3 vs Three.js) based on GDD
- Returns `{ code, usage }` — the corrected full HTML string
- Auto-strips markdown fences from LLM output
- `ValidationError` and `RuntimeError` types exported for use by iteration tracker and orchestrator

**`services/ai-orchestrator/src/agents/polish-agent.ts`** — NEW
- `runPolishAgent(code, gdd, llm, onProgress, maxTokens)` function
- System prompt focuses on visual quality improvements:
  - Color palette, animation smoothness, particle effects, screen transitions, juice effects
  - Engine-specific polish techniques (Phaser: tweens, particles, camera shake; Three.js: emissive pulse, smooth camera, tone mapping)
  - Explicit rules: DO NOT change game logic, scoring, state machine, or SDK contract
- Safety check: if polished output is missing `window.SloppyGame` or `<!DOCTYPE html>`, falls back to original code
- Only runs when `config.generation.enablePolish` is true (default: true, can be disabled via `ENABLE_POLISH=false` env var)

**`services/ai-orchestrator/src/pipeline/iteration-tracker.ts`** — NEW
- `IterationTracker` class tracks debug loop state:
  - `maxIterations` (default 5, configurable via `MAX_DEBUG_ITERATIONS` env var)
  - `currentIteration` — number of iterations completed
  - `passed` — whether the game has passed validation
  - `recordIteration(validationErrors, runtimeErrors)` — records an iteration with its errors
  - `hasMoreAttempts()` — returns true if not passed and under max iterations
  - `markPassed()` — marks the game as having passed validation
  - `getHistory()` — returns all iteration records with timestamps
  - `getLastErrors()` — returns the errors from the most recent iteration
  - `getErrorSummary()` — returns a truncated string summary of the last iteration's errors

**`services/ai-orchestrator/src/pipeline/orchestrator.ts`** — Refactored for debug loop + polish
- Full debug loop implemented after code generation:
  1. Code Generator → initial HTML
  2. Loop (max `config.generation.maxDebugIterations` iterations):
     a. Call `POST /games/validate` endpoint with current code
     b. Publish screenshots via `sessionManager.publishScreenshot()`
     c. If all pass → `tracker.markPassed()`, break
     d. Record iteration errors in `IterationTracker`
     e. Publish iteration event via `sessionManager.publishIteration()`
     f. Run `runDebugFixer()` with errors + screenshots → fixed code
     g. Track tokens per fix iteration
     h. Back to step a
  3. If passed: optionally run `runPolishAgent()` → polished code
  4. If failed after max iterations: call `sessionManager.fail()` with error summary and return early
- Pipeline now emits SSE events:
  - `{ type: 'iteration', attempt, maxAttempts, error }` during debug loop
  - `{ type: 'screenshot', state, imageBase64 }` when screenshots are captured
  - `{ type: 'phase', phase: 'fixing' }` and `{ type: 'phase', phase: 'polishing' }` during those phases
- `callValidationEndpoint()` helper calls `POST /games/validate` with files dict, returns structured `ValidateResponse`
- Bundle config for validation is constructed once before the loop and reused
- Token tracking includes per-iteration `fixing_N` phase keys and a `polishing` phase key
- Generation logs created for each fix iteration and the polish pass
- Timeout increased from 120s to 180s to accommodate the debug loop
- If validation endpoint is unreachable, debug loop is skipped gracefully (game proceeds without validation)

**`services/game-builder/src/routes/games.ts`** — Added `POST /games/validate` endpoint
- New endpoint: `POST /games/validate`
  - Accepts `{ files }` body (same format as `POST /games`)
  - Runs static validation via `validateBundle(files)`
  - Runs runtime validation via `validateRuntime(files)` for v2 games
  - Returns structured response: `{ passed, staticErrors, runtimeErrors, screenshots, isV2 }`
  - `staticErrors` are `ValidationError[]` from the pipeline validator
  - `runtimeErrors` include: crashed-during phase, console errors, unrendered screens
  - `screenshots` are base64-encoded PNGs keyed by state name (intro, playing, paused, gameover)
  - No auth required (called by ai-orchestrator, not end users)
  - Does NOT store anything — pure validation

**`services/ai-orchestrator/src/config.ts`** — Updated
- `generation.maxDebugIterations` = `MAX_DEBUG_ITERATIONS` env var, default 5
- `generation.enablePolish` = `ENABLE_POLISH` env var, default true (set to `'false'` to disable)
- `generation.maxTokens.fix` = `MAX_TOKENS_FIX` env var, default 12000 (same as code gen — fix returns full HTML)
- `generation.maxTokens.polish` = `MAX_TOKENS_POLISH` env var, default 12000 (same as code gen — polish returns full HTML)
- `generation.timeoutMs` default increased from 120000 to 180000 (3 minutes) to accommodate the debug loop

### Files Created
- `services/ai-orchestrator/src/agents/debug-fixer.ts`
- `services/ai-orchestrator/src/agents/polish-agent.ts`
- `services/ai-orchestrator/src/pipeline/iteration-tracker.ts`

### Files Modified
- `services/ai-orchestrator/src/pipeline/orchestrator.ts`
- `services/ai-orchestrator/src/pipeline/code.ts` — `extractInlineScript()` exported (was internal) so the orchestrator can extract inline JS from HTML for static validation
- `services/ai-orchestrator/src/config.ts`
- `services/game-builder/src/routes/games.ts`

### Key Architecture Decisions (Prompt 7)
- The debug loop uses a **two-step flow**: validate via `POST /games/validate` (no storage), then store via `POST /games` (only after all iterations pass). This avoids creating garbage game records during iteration.
- Debug agent receives **screenshots as base64 in the prompt** — the LLM can see what the game actually rendered vs what was expected. Screenshots are passed in markdown image syntax for multimodal models.
- The `IterationTracker` is a pure utility class with no side effects — the orchestrator is responsible for calling session manager events and generation log writes.
- Polish agent has a **safety net**: if its output is missing the SDK contract assignment or DOCTYPE, the original working code is used instead. This prevents a passing game from being broken by the polish pass.
- `enablePolish` config flag allows disabling the polish pass for batch population or cost-sensitive scenarios.
- Token usage for fix iterations is tracked as `fixing_1`, `fixing_2`, etc. in `byPhase` for granular cost analysis.
- The validation endpoint is unauthenticated since it's called service-to-service by the ai-orchestrator.
- The orchestrator extracts inline JS from the HTML via `extractInlineScript()` and sends it as `game.js` to the validate endpoint. This is necessary because `validateBundle()` in game-builder checks `game.js` for required methods, but v2 games have all code inline in the HTML (no separate `game.js` file).

### Downstream Impact for Next Prompts
- **Prompt 9 (Multiplayer)**: The multiplayer phase now runs AFTER the debug loop and polish pass. `ctx.gameCode` is the validated, polished HTML. Multiplayer injection needs to parse this HTML and inject hooks into inline `<script>` tags.
- **Prompt 10 (Audio)**: Audio phase runs after multiplayer. Sound effects must be inline Web Audio API code inserted into the HTML.
- **Prompt 11 (Thumbnail)**: The validation endpoint already captures screenshots. The pipeline could reuse the last successful validation's screenshots for thumbnail generation instead of running a separate capture.
- The `POST /games` endpoint in game-builder still runs its own validation on store. This is intentional — it serves as a final safety gate. Since the game already passed validation in the debug loop, this should always pass.
- `config.generation.maxTokens` now has: `concept` (2000), `planning` (3000), `code` (12000), `fix` (12000), `polish` (12000), `assets` (2000), `multiplayer` (4000)
- `config.generation.timeoutMs` is now 180s (3 minutes) — may need further increase if games consistently need 5 debug iterations

---

## Post-Prompt 7 Fix: Explicit Controls/Input in GDD

### Problem
The `GameDesignDocument` had no `controls` field. Input type selection (keyboard vs mouse vs touch) was implicit — the Code Generator inferred it from genre prompts. The `gddToGameConcept()` adapter hardcoded `controls: 'keyboard'` regardless of game type. For mouse-driven genres (puzzle, idle, tower defense, cards) or mixed-input genres (FPS: WASD + mouse), the control scheme was never explicitly specified.

### What Changed

**`services/ai-orchestrator/src/pipeline/types.ts`** — Updated `GameDesignDocument`
- Added `controls: Array<{ key: string; action: string }>` field — explicitly specifies each input and what it does (e.g. `{ key: 'WASD', action: 'Move' }`, `{ key: 'Click', action: 'Shoot' }`)
- Matches the existing `ControlHint` type from `@sloppy/runtime-sdk` that `metadata.controls` already expects

**`services/ai-orchestrator/src/pipeline/types.ts`** — Updated `gddToGameConcept()`
- `controls` now uses `gdd.controls.map(c => '${c.key}: ${c.action}').join(', ')` instead of hardcoded `'keyboard'`

**`services/ai-orchestrator/src/agents/concept-architect.ts`** — Updated
- Added **Controls / Input Selection** section to system prompt with guidance for each input scheme (keyboard, mouse, pointer, mixed, touch-friendly) and which genres suit each
- Added `controls` array to the GDD JSON schema in the prompt with `{ key, action }` entries
- Added `inferDefaultControls(genre)` fallback function — if the LLM omits the `controls` field, sensible defaults are inferred from the genre:
  - `2d-idle` → Click
  - `2d-puzzle`, `2d-tower-defense` → Mouse + Click
  - `2d-cards` → Mouse + Click
  - `2d-rhythm` → D/F/J/K lane keys
  - `3d-firstperson` → WASD + Mouse + Click
  - `3d-flight` → W/S pitch + A/D roll + Space shoot
  - `3d-racing` → Arrow keys
  - Other 3D → WASD + Space + Mouse
  - Default 2D → Arrow Keys + Space
- Post-generation validation: if `controls` is missing or empty, `inferDefaultControls()` populates it with a warning log

**`services/ai-orchestrator/src/prompts/code.ts`** — Updated
- `buildCodeUserPrompt()` now includes `**Controls:** ${gdd.controls.map(...)}` in the GDD section passed to the Code Generator
- `buildCodeRetryPrompt()` now includes controls in the Game Context section so the fix prompt retains control scheme awareness

**`services/ai-orchestrator/src/agents/debug-fixer.ts`** — Updated
- `buildDebugUserPrompt()` now includes `**Controls:** ...` in the Game Context section so the Debug Fixer knows which input scheme to preserve/fix

### Files Modified
- `services/ai-orchestrator/src/pipeline/types.ts` — `GameDesignDocument.controls` added, `gddToGameConcept()` updated
- `services/ai-orchestrator/src/agents/concept-architect.ts` — system prompt + schema + fallback logic
- `services/ai-orchestrator/src/prompts/code.ts` — user prompt + retry prompt
- `services/ai-orchestrator/src/agents/debug-fixer.ts` — user prompt

### How Controls Flow Through the Pipeline
1. **Concept Architect** produces `gdd.controls` — explicit `[{ key, action }]` array
2. **Code Generator** receives controls in `buildCodeUserPrompt()` — knows exactly which inputs to implement
3. **Code Generator** also receives them via the SDK contract in the system prompt — the `metadata.controls` array must match
4. **Debug Fixer** receives controls in the game context — preserves the intended input scheme when fixing
5. **Runtime** — the generated game's `metadata.controls` array is displayed on the intro screen and used by the platform UI

---

## Completed: Prompt 8 — 3D Game Templates & SDK v2 Utilities

### What Changed

**`packages/runtime-sdk/src/v2/state-manager.ts`** — NEW
- `GameStateManager` class managing the `GameState` finite state machine
- Valid transition map: idle→intro, intro→playing, playing→paused/gameover, paused→playing/gameover, gameover→playing/intro
- `transition(to)` — attempts a valid transition, returns boolean success
- `forceState(to)` — force-sets state without validation (used for `restart()` which transitions from ANY state)
- `canTransition(to)` — checks if a transition is valid
- `onChange(handler)` — registers a state-change listener, returns unsubscribe function
- `reset()` — resets to idle and clears all listeners

**`packages/runtime-sdk/src/v2/screen-renderer.ts`** — NEW
- `CanvasScreenRenderer` — draws UI screens (overlays, titles, prompts, buttons) directly onto a 2D canvas context. Suitable for Phaser 3 overlay canvases.
- `HtmlScreenRenderer` — creates absolutely-positioned HTML overlay elements on top of the WebGL canvas. Methods: `show(html)`, `showTitle(title, subtitle, prompt)`, `showButton(label, onClick)`, `hide()`, `destroy()`.
- Both renderers accept a `ScreenStyle` config (fontFamily, titleSize, bodySize, color, accentColor, overlayColor) with sensible defaults.

**`packages/runtime-sdk/src/v2/effects-library.ts`** — NEW
- `Canvas2DEffects` — screen shake (returns offset for camera translation), screen flash (draws filled rect), particle burst (physics-based particles with gravity and fade), number pop animation (floating text).
- `ThreeJSEffects` — screen shake (returns camera offset vector), screen flash (creates temporary HTML overlay div with auto-remove).
- Both have `update(dt)` method to call per frame and `reset()` to clear all active effects.

**`packages/runtime-sdk/src/templates/3d/fps.js`** — NEW
- Complete FPS template: pointer lock camera (yaw/pitch with Euler clamping), WASD movement relative to camera quaternion, raycasting projectile system, enemy pool (MAX_ENEMIES with chase AI), health system with HP bar HUD, wave-based spawning, level progression.
- Pre-allocated vectors (`_forward`, `_right`, `_moveDir`) to avoid GC in game loop.
- Quality defaults: PCFSoftShadowMap, ACESFilmicToneMapping, FogExp2, directional light with shadows.

**`packages/runtime-sdk/src/templates/3d/racing.js`** — NEW
- Complete racing template: simplified vehicle physics (acceleration, braking, friction, steering), circular track with RingGeometry, 4-checkpoint lap system, 3-lap race, chase camera with lerp, soft track boundaries.
- Car model built from BoxGeometry groups (body + roof).
- Speed-based steering (no steering at zero speed).

**`packages/runtime-sdk/src/templates/3d/endless-runner.js`** — NEW
- Complete endless runner template: ring buffer of 8 track segments, 3-lane switching with lerp, auto-forward motion with speed ramp, jump mechanics (velocity + gravity), obstacle spawning per segment with lane avoidance, Box3 collision detection.
- Touch controls: swipe left/right for lane change, tap for jump.
- World moves toward player (player stays at z=0) — classic runner pattern.

**`packages/runtime-sdk/src/templates/3d/puzzle-3d.js`** — NEW
- Complete 3D puzzle template: orbit camera (spherical coordinates with phi/theta), object selection via raycasting, keyboard-based piece movement, snap-to-grid positions, completion detection against goal state.
- 4-piece color puzzle with scrambled initial positions.
- Mouse drag for camera orbit, scroll for zoom.

**`packages/runtime-sdk/src/templates/3d/tower-defense-3d.js`** — NEW
- Complete tower defense template: 10×10 grid, A* pathfinding, tower placement via raycasting (with path-still-exists validation), enemy wave spawning, tower firing with projectile tracking, gold economy.
- Top-down overview camera.
- Path invalidation prevention: towers can only be placed if the path from start to end still exists.

**`packages/runtime-sdk/src/templates/2d/platformer.js`** — NEW
- Complete Phaser 3 platformer template: 5-scene architecture (Boot, Intro, Game, Pause, GameOver), Arcade Physics with gravity, procedural texture generation (player, platform, coin, hazard), static platform group, collectible coins with tween bob, hazard overlap with lives system, camera shake/flash on events.

**`packages/runtime-sdk/src/templates/2d/topdown.js`** — NEW
- Complete Phaser 3 top-down template: 8-directional movement with diagonal normalization, projectile pooling (physics group with maxSize), enemy AI (chase within range, patrol otherwise), camera follow with dead zone, extended world bounds (2x), procedural textures.

**`packages/runtime-sdk/src/templates/2d/puzzle.js`** — NEW
- Complete Phaser 3 puzzle template: match-3 grid system (6×6), click-to-select then click-adjacent-to-swap mechanic, horizontal/vertical match detection, gravity drop with cell refill, chain match detection, procedural colored tile textures.

**`packages/runtime-sdk/src/templates/3d/flight.js`** — NEW
- Complete 3D flight/space shooter template: pitch/yaw/roll controls with quaternion-based forward vector, throttle speed (Shift to boost), projectile pool with distance-based deactivation, enemy ship pool with chase AI, third-person follow camera with lerp lag, starfield environment (300 scattered spheres).
- Ship built from cylinder + box wing + sphere engine glow primitives.

**`packages/runtime-sdk/src/templates/3d/platformer-3d.js`** — NEW
- Complete 3D platformer template: third-person orbit camera (spherical coordinates, mouse drag to orbit), camera-relative WASD movement, manual gravity + jump (velocity + gravity, no physics lib), AABB platform collision (Box3 intersection with snap-to-top), collectible torus rings with rotation + bob, fall death with lives system.
- Platform layout with ground + 5 floating platforms + collectibles on each.

**`packages/runtime-sdk/src/templates/2d/arcade.js`** — NEW
- Complete Phaser 3 arcade template: simple dodge/collect gameplay, player moves left/right avoiding falling obstacles while collecting items, score-chasing with increasing difficulty, 3 lives with invincibility frames, difficulty scalar growing with score, spawn patterns with `this.time.addEvent()`.

**`packages/runtime-sdk/src/templates/2d/shooter.js`** — NEW
- Complete Phaser 3 2D shooter template: vertical scrolling with tileSprite background, player auto-fire with cooldown, player + enemy projectile pools, enemy wave spawning, enemy bullets aimed at player, power-up drops (shield), combo multiplier for quick kills, wave counter.

**`packages/runtime-sdk/src/templates/2d/tower-defense.js`** — NEW
- Complete Phaser 3 tower defense template: grid-based tower placement (click to place), waypoint enemy path (enemies follow waypoints via `physics.moveTo`), tower targeting with range circles, gold economy (earn per kill, spend to place), wave spawning system, base lives.

**`packages/runtime-sdk/src/templates/2d/endless-runner.js`** — NEW
- Complete Phaser 3 endless runner template: auto-run with player at fixed X, world scrolls left via tileSprite ground, jump with Arcade Physics gravity, duck/slide mechanic, procedural obstacle spawning from right edge, speed increase over time, distance-based score.

**`packages/runtime-sdk/src/templates/2d/rhythm.js`** — NEW
- Complete Phaser 3 rhythm game template: 4-lane note system (D/F/J/K keys), notes fall toward hit zone, BPM-based beat generation (procedural, no audio file), timing windows (Perfect ±50ms = 300pts, Good ±100ms = 100pts, Miss = 0), combo multiplier that resets on miss, 60-second session.

**`packages/runtime-sdk/src/templates/2d/cards.js`** — NEW
- Complete Phaser 3 card game template: turn-based flow (Draw → Play → Resolve → Opponent), cards generated as graphics textures, hand of 5-7 cards, card types (Attack/Defense/Heal), simple opponent AI, mana/energy system (N per turn), HP bars for player and opponent.

**`packages/runtime-sdk/src/templates/2d/idle.js`** — NEW
- Complete Phaser 3 idle/clicker template: click target generating resources, floating "+N" text on click, passive generators purchased from side panel, exponential cost scaling (baseCost * 1.15^level), large number formatting (K/M/B/T), progress saved to localStorage.

**`packages/runtime-sdk/src/index.ts`** — Updated
- Exports SDK v2 utilities: `GameStateManager`, `CanvasScreenRenderer`, `HtmlScreenRenderer`, `ScreenStyle`, `Canvas2DEffects`, `ThreeJSEffects`, `Canvas2DEffectsTarget`
- Exports `TEMPLATE_PATHS` — object mapping `'2d'`/`'3d'` → template name → file path (using `import.meta.url`) — covers all 17 templates (10 2D + 7 3D)
- Exports `GENRE_TO_TEMPLATE` — `Record<string, string | undefined>` mapping 16 genre values to template names (all genres except `2d-custom` and `3d-custom` which are intentionally template-free)

**`services/ai-orchestrator/src/pipeline/types.ts`** — Updated
- `TechnicalSpec` now includes:
  - `useTemplate?: string | null` — template name to use as base, or null if building from scratch
  - `templateCustomizations?: string | null` — describes what the Code Generator must change/add to the template

**`services/ai-orchestrator/src/agents/technical-planner.ts`** — Updated
- `GENRE_TEMPLATE_MAP` — maps genre values to `{ engine, template }` objects for all 16 genres that have templates
- `getTemplateGuidance(gdd)` — generates a system prompt section that describes the available template, what boilerplate it provides, and what the Code Generator needs to customize
- System prompt now includes:
  - SDK v2 utility classes section (GameStateManager, HtmlScreenRenderer, Canvas2DEffects/ThreeJSEffects) with method summaries
  - Template guidance section (if a matching template exists): describes the template, its boilerplate, and a recommendation for the Code Generator
  - Output format updated: `useTemplate` and `templateCustomizations` fields in the TechnicalSpec JSON schema
  - Rules updated: "If a matching template exists, set `useTemplate` and describe what needs customization"

### Files Created
- `packages/runtime-sdk/src/v2/state-manager.ts`
- `packages/runtime-sdk/src/v2/screen-renderer.ts`
- `packages/runtime-sdk/src/v2/effects-library.ts`
- `packages/runtime-sdk/src/templates/3d/fps.js`
- `packages/runtime-sdk/src/templates/3d/racing.js`
- `packages/runtime-sdk/src/templates/3d/endless-runner.js`
- `packages/runtime-sdk/src/templates/3d/puzzle-3d.js`
- `packages/runtime-sdk/src/templates/3d/tower-defense-3d.js`
- `packages/runtime-sdk/src/templates/3d/flight.js`
- `packages/runtime-sdk/src/templates/3d/platformer-3d.js`
- `packages/runtime-sdk/src/templates/2d/platformer.js`
- `packages/runtime-sdk/src/templates/2d/topdown.js`
- `packages/runtime-sdk/src/templates/2d/puzzle.js`
- `packages/runtime-sdk/src/templates/2d/arcade.js`
- `packages/runtime-sdk/src/templates/2d/shooter.js`
- `packages/runtime-sdk/src/templates/2d/tower-defense.js`
- `packages/runtime-sdk/src/templates/2d/endless-runner.js`
- `packages/runtime-sdk/src/templates/2d/rhythm.js`
- `packages/runtime-sdk/src/templates/2d/cards.js`
- `packages/runtime-sdk/src/templates/2d/idle.js`

### Files Modified
- `packages/runtime-sdk/src/index.ts`
- `services/ai-orchestrator/src/pipeline/types.ts`
- `services/ai-orchestrator/src/agents/technical-planner.ts`

### Key Architecture Decisions (Prompt 8)
- Templates are pure JavaScript IIFE files (no TypeScript, no ES modules) that can be inlined into generated game HTML. Each assigns to both `window.SloppyGame` and `window.game`.
- Templates implement ALL 12 SDK v2 required methods plus `metadata`, `supportsMultiplayer`, and the ready signal (`sloppy:game:ready` postMessage).
- Three.js templates include all quality defaults: PCFSoftShadowMap, ACESFilmicToneMapping, FogExp2 fog, directional light with shadows, MeshStandardMaterial, pre-allocated vectors, `THREE.Clock` for delta time, full `dispose()` in `destroy()`, pixel ratio cap at 2.
- Phaser 3 templates use the 5-scene architecture (Boot, Intro, Game, Pause, GameOver) with procedural texture generation via `generateTexture()`.
- Templates are reference implementations — the AI will modify them substantially. They solve the boilerplate (scene setup, SDK lifecycle, screen rendering, input handling) so the AI can focus on game-specific logic.
- SDK v2 utilities (GameStateManager, ScreenRenderer, EffectsLibrary) are TypeScript classes exported from the runtime-sdk package. They are optional — templates don't import them (since templates are pure JS), but the AI can use similar patterns or reference them.
- The Technical Planner now recommends templates when the GDD genre matches (16 of 18 genres have templates). The `TechnicalSpec.useTemplate` field tells the Code Generator which template to start from.
- Only `2d-custom` and `3d-custom` lack templates — these are intentionally template-free fallbacks for novel concepts.
- All templates are under 500 lines of code.

### Template Coverage (17 templates total)
| Template | Genre(s) | Engine | Key Boilerplate |
|----------|----------|--------|-----------------|
| fps.js | 3d-firstperson | Three.js | Pointer lock, WASD, raycasting, enemy pool |
| racing.js | 3d-racing | Three.js | Vehicle physics, lap counting, chase camera |
| endless-runner.js (3d) | 3d-thirdperson | Three.js | Ring buffer segments, lane switching, speed ramp |
| puzzle-3d.js | 3d-puzzle | Three.js | Orbit camera, raycasting selection, snap-to-grid |
| tower-defense-3d.js | (3d tower defense) | Three.js | A* pathfinding, grid placement, projectile tracking |
| flight.js | 3d-flight | Three.js | Pitch/yaw/roll quaternion controls, projectiles, chase camera |
| platformer-3d.js | 3d-platformer | Three.js | Orbit camera, AABB platforms, manual gravity, collectibles |
| platformer.js | 2d-platformer | Phaser 3 | Gravity/jump, platform collision, collectibles |
| topdown.js | 2d-topdown | Phaser 3 | 8-dir movement, projectile pooling, enemy AI |
| puzzle.js | 2d-puzzle | Phaser 3 | Grid system, match-3, gravity drop, chain matches |
| arcade.js | 2d-arcade | Phaser 3 | Dodge/collect, lives, difficulty scalar, spawn patterns |
| shooter.js | 2d-shooter | Phaser 3 | Vertical scroll, auto-fire, bullet pools, waves, combos |
| tower-defense.js | 2d-tower-defense | Phaser 3 | Grid placement, waypoint paths, tower targeting, gold economy |
| endless-runner.js (2d) | 2d-endless-runner | Phaser 3 | Auto-run, tileSprite scroll, jump/duck, speed ramp |
| rhythm.js | 2d-rhythm | Phaser 3 | 4-lane notes, BPM generation, timing windows, combos |
| cards.js | 2d-cards | Phaser 3 | Turn-based, hand management, card effects, opponent AI |
| idle.js | 2d-idle | Phaser 3 | Click generation, passive generators, exponential costs |

### Downstream Impact for Next Prompts
- **Prompt 9 (Multiplayer)**: Templates have `supportsMultiplayer: false` by default. The multiplayer injection phase needs to add multiplayer hooks to the template-based code. Since templates assign to `window.SloppyGame`, the injection point is clear.
- **Prompt 10 (Audio)**: Templates have no audio. Sound effects should be added via Web Audio API inline in the HTML. Templates provide good insertion points (e.g. collision callbacks, score events).
- **Prompt 11 (Thumbnail)**: Templates include complete intro screens — the screenshot capture during validation can use the intro screen for thumbnail generation.
- The Code Generator (Prompt 5) should be updated in a future prompt to read the template file when `spec.useTemplate` is set and inject it as context (or as a starting point) for code generation. Currently, the Technical Planner tells the AI about the template in the system prompt, and the Code Generator's system prompt includes the engine guide and genre prompt, but the actual template source is not yet injected into the code generation prompt.
- `config.generation.maxTokens` remains: `concept` (2000), `planning` (3000), `code` (12000), `fix` (12000), `polish` (12000), `assets` (2000), `multiplayer` (4000)

---

## Completed: Prompt 9 — Multiplayer Intelligence & Injector Agent

### What Changed

**`services/ai-orchestrator/src/agents/concept-architect.ts`** — Updated multiplayer evaluation
- Replaced the brief multiplayer assessment section with comprehensive guidance:
  - **Suitability examples**: lists games that work well in multiplayer (competitive score-chasers, turn-based, arena combat, racing, cooperative survival) vs games that do NOT suit multiplayer (narrative, idle/clicker, rhythm, unique-solution puzzles, no-interaction-point games)
  - **Sync strategy selection criteria** with detailed descriptions:
    - `state-sync`: full authoritative state snapshots, 50–100ms tolerance, best for turn-based/slower games. **Preferred** since the multiplayer server currently supports state-sync via Redis.
    - `input-relay`: server relays player inputs, clients simulate locally, <16ms feel for fast action games (platformers, shooters, racing). Requires deterministic game logic.
    - `lockstep`: synchronized steps waiting for all inputs, guarantees identical state, best for pure competitive strategy/puzzle.
  - Explicit instruction: default to `suitable: false` unless user explicitly requests multiplayer or the concept clearly benefits from it
  - `syncStrategy` field is now documented as REQUIRED when `suitable` is true

**`services/ai-orchestrator/src/agents/multiplayer-injector.ts`** — NEW
- `runMultiplayerInjector(code, gdd, llm, onProgress, maxTokens)` function
- Only called when `gdd.multiplayer.suitable === true` (orchestrator handles the gate)
- System prompt includes:
  - Critical rules: DO NOT rewrite the game, DO NOT break single-player, DO NOT modify SDK contract, preserve ALL existing code
  - Full `@sloppy/multiplayer-sdk` API reference (MultiplayerClient constructor, connect, sendInput, onStateUpdate, onPlayerJoin, onPlayerLeave, onConnectionChange, disconnect)
  - Full `MultiplayerHooks` contract (all 6 methods: getInitialState, applyPlayerInput, updateState, serializeState, onPlayerJoin, onPlayerLeave) + `supportsMultiplayer = true`
  - Sync strategy-specific guidance (different instructions for state-sync vs input-relay vs lockstep)
  - Engine-specific visual guidance:
    - Phaser 3: remote player sprites with tint/labels, `remotePlayers` Map, tween interpolation
    - Three.js: remote player mesh groups with different color materials, lerp interpolation, pre-allocated Vector3
  - Connection initialization pattern: URL param detection (`sessionId`, `playerId`), MultiplayerClient setup, hook wiring
  - Input forwarding pattern: wherever local player produces input, also call `mp.sendInput()`
- Safety checks on output:
  - Falls back to original code if `multiplayerHooks` is missing from output
  - Falls back to original code if `window.SloppyGame` or `window.game` is missing (SDK contract broken)
  - Warns if `supportsMultiplayer` flag is missing
  - Strips markdown fences from LLM output
- Returns `{ code, usage }` — the complete modified HTML string

**`services/ai-orchestrator/src/pipeline/orchestrator.ts`** — Refactored multiplayer phase
- Replaced `import { runMultiplayerPhase } from './multiplayer.js'` with `import { runMultiplayerInjector } from '../agents/multiplayer-injector.js'`
- Multiplayer phase now:
  1. Only runs when `gdd.multiplayer.suitable === true` (previously relied on internal check via deprecated `ctx.concept?.supportsMultiplayer`)
  2. Calls `runMultiplayerInjector()` with the validated/polished game code, GDD, LLM client, and max tokens
  3. Tracks token usage and logs generation metrics
  4. **Re-validates after injection** by calling `callValidationEndpoint()` on the injected code
  5. If post-injection validation fails: reverts to the pre-injection code (`preMultiplayerCode` — the polished, validated single-player code) with a warning
  6. If validation endpoint is unreachable: keeps the injected code with a warning
- Single-player games get `onProgress('multiplayer', 100, 'Skipped — single-player game')` immediately

**`services/game-builder/src/validation/pipeline.ts`** — Added multiplayer hook validation
- New validation step (step 8) after JS syntax check:
  - Only runs for v2 games where `parsedConfig.supportsMultiplayer === true`
  - Checks that `multiplayerHooks` object exists in the game source
  - Checks that all 6 required hook methods are present: `getInitialState`, `applyPlayerInput`, `updateState`, `serializeState`, `onPlayerJoin`, `onPlayerLeave`
  - Checks that `supportsMultiplayer` property is present in the source
  - All errors use `check: 'multiplayer_hooks'` for easy filtering

### Files Created
- `services/ai-orchestrator/src/agents/multiplayer-injector.ts`

### Files Modified
- `services/ai-orchestrator/src/agents/concept-architect.ts` — multiplayer evaluation guidance expanded
- `services/ai-orchestrator/src/pipeline/orchestrator.ts` — replaced old multiplayer phase with new injector agent
- `services/game-builder/src/validation/pipeline.ts` — added multiplayer hook validation

### Key Architecture Decisions (Prompt 9)
- The multiplayer injector is a **dedicated agent** under `services/ai-orchestrator/src/agents/` (same pattern as concept-architect, technical-planner, debug-fixer, polish-agent)
- It follows the "additive injection" philosophy: the game code is never rewritten, only extended with multiplayer hooks and remote player visuals
- The injector receives the **complete validated/polished HTML** (not raw JS) and returns complete HTML — consistent with the v2 pipeline where all code is inline in HTML
- Post-injection re-validation ensures multiplayer hooks don't break the game. If validation fails, the pipeline gracefully falls back to single-player. This is a non-blocking failure — the game is still deployed, just without multiplayer.
- The old `multiplayer.ts` phase file (`services/ai-orchestrator/src/pipeline/multiplayer.ts`) is no longer imported by the orchestrator. It still exists but is effectively dead code. The old `MULTIPLAYER_SYSTEM_PROMPT` and `buildMultiplayerUserPrompt` in `services/ai-orchestrator/src/prompts/multiplayer.ts` are also no longer used by the pipeline.
- The multiplayer SDK is referenced in the injector's system prompt but NOT loaded as a dependency — it's loaded at runtime via CDN when the game detects multiplayer session params in the URL.
- Sync strategy flows through the full pipeline: Concept Architect evaluates and sets `gdd.multiplayer.syncStrategy` → Multiplayer Injector uses it to tailor the injection prompt → the generated hooks implement the appropriate sync pattern.
- Token budget for the injector: `config.generation.maxTokens.multiplayer` = 4000 (env: `MAX_TOKENS_MULTIPLAYER`). Since the injector receives the full game HTML + comprehensive system prompt, this is tight but sufficient because the injector only adds code, it doesn't regenerate the entire game.

### Downstream Impact for Next Prompts
- ~~**Prompt 10 (Audio)**: Audio phase runs after multiplayer injection.~~ → Done in Prompt 10 (audio now runs BEFORE multiplayer)
- **Prompt 11 (Thumbnail)**: Thumbnails should be generated from the single-player intro screen. If the game supports multiplayer, the thumbnail should NOT show multiplayer elements (no remote players visible on the intro screen).
- The old `services/ai-orchestrator/src/pipeline/multiplayer.ts` and `services/ai-orchestrator/src/prompts/multiplayer.ts` are now dead code. They can be removed in a cleanup pass, but are harmless as-is since nothing imports them from the pipeline.
- The old `services/ai-orchestrator/src/pipeline/music.ts` is now dead code — replaced by the Audio Generator agent. It still exists but is no longer imported by the orchestrator.
- `config.generation.maxTokens` now has: `concept` (2000), `planning` (3000), `code` (12000), `fix` (12000), `polish` (12000), `assets` (2000), `audio` (12000), `multiplayer` (4000)
- The multiplayer validation in `pipeline.ts` now catches games that claim `supportsMultiplayer: true` but are missing hooks. This affects both the debug loop validation and the final `POST /games` store validation.

---

## Completed: Prompt 10 — Sound Effects System

### What Changed

**`packages/runtime-sdk/src/v2/audio/zzfx-presets.ts`** — NEW
- Exports `SFX` object mapping 16 common game events to ZzFX parameter arrays:
  - Movement: `jump`, `land`, `walk`, `dash`
  - Combat: `shoot`, `hit`, `explosion`
  - Collectibles: `coin`, `powerUp`
  - UI: `select`, `confirm`, `back`
  - Game states: `levelUp`, `gameOver`
  - 3D-specific: `engineRev`, `impact`
- Exports `ZzFXParams` type (readonly number array)
- Exports `SFXKey` type (union of all preset key names)
- Exports `getSFXInlineSource()` — returns the SFX map as a JavaScript string for inline injection into game HTML

**`packages/runtime-sdk/src/v2/audio/zzfx-micro.ts`** — NEW
- Implements the ZzFX Micro sound engine — a complete procedural audio synthesizer using the Web Audio API
- Exports `zzfx()` function with 20 parameters (volume, randomness, frequency, attack, sustain, release, shape, shapeCurve, slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay, sustainVolume, decay, tremolo)
- Lazy AudioContext creation (created on first call — complies with browser autoplay policy)
- Exports `getZzfxInlineSource()` — returns the zzfx function as a minified ~900 byte JavaScript string for inline injection

**`packages/runtime-sdk/src/v2/audio/audio-manager.ts`** — NEW
- Exports `AudioManager` interface: `play`, `playAmbient`, `stopAmbient`, `setMasterVolume`, `setMusicVolume`, `setSFXVolume`, `onPause`, `onResume`, `onDestroy`, `mute`, `unmute`
- Exports `AudioManagerOptions` interface: `spriteSrc`, `spriteMap`, `ambientSrc`, `customPresets`
- Exports `createAudioManager(options?)` factory function:
  - Auto-detects Howler.js (CDN loaded) vs ZzFX (inline) for playback
  - If Howler.js is available AND sprite sources are provided → Howler mode (audio sprite playback)
  - Otherwise → ZzFX mode (procedural audio via `zzfx(...SFX.key)`)
  - Volume management: master, music, and SFX volume channels (0–1 range)
  - Pause/resume: `onPause()` pauses all audio, `onResume()` resumes ambient
  - Mute/unmute: `mute()` calls `Howler.mute(true)` if available, `unmute()` calls `Howler.mute(false)`
  - PostMessage bridge: automatically listens for `sloppy:mute` and `sloppy:unmute` messages from the feed
  - Cleanup: `onDestroy()` unloads all Howl instances, stops ambient, removes message listener
- Exports `getAudioManagerInlineSource()` — returns the AudioManager factory as an inline JavaScript string for injection

**`services/ai-orchestrator/src/agents/audio-generator.ts`** — NEW
- `runAudioGenerator(code, gdd, mode, llm, onProgress, maxTokens)` function
- Two modes:
  - **zzfx** (default for all automated games): Uses LLM to inject ZzFX micro engine + SFX presets + AudioManager + sound effect calls into the game HTML
  - **elevenlabs** (placeholder for creator games): Will use ElevenLabs SFX API to generate real audio files — currently returns code unchanged with a skip message
- ZzFX mode system prompt:
  - Receives the complete game HTML, GDD context (title, genre, core mechanic, objects)
  - Includes the full ZzFX micro snippet, SFX presets source, and AudioManager factory source in the user prompt
  - Sound mapping rules: maps game events to closest preset (jump → SFX.jump, enemy destroyed → SFX.explosion, etc.)
  - Critical rules: DO NOT rewrite the game, DO NOT break SDK contract, DO NOT use raw AudioContext, place snippets inside existing `<script>` tag
  - AudioManager lifecycle wiring: `onPause()` in `pause()`, `onResume()` in `resume()`, `onDestroy()` in `destroy()`
- Safety checks on output:
  - Falls back to original code if `window.SloppyGame` or `window.game` is missing
  - Falls back to original code if `<!DOCTYPE html>` is missing
  - Falls back to original code if no ZzFX code was injected
  - Strips markdown fences from LLM output
- Returns `{ code, audioFiles?, usage }`

**`services/ai-orchestrator/src/prompts/code.ts`** — Updated
- Added `AUDIO_RULES` constant to the system prompt composition:
  - Rules: always initialize ZzFX + AudioManager, never use `new Audio()` or raw AudioContext, every player action must have a sound
  - Required sounds for all games: jump/move, collect/score, hurt/die, game-over, level-up
  - 3D spatial audio guidance: THREE.AudioListener + THREE.PositionalAudio
  - Lifecycle wiring: `audioManager.onPause()`, `audioManager.onResume()`, `audioManager.onDestroy()`
  - ZzFX usage pattern with code examples
  - Feed mute integration documentation
- Composition order updated: SDK v2 Contract → Engine Prompt → Genre Prompt → Screen Templates → **Audio Rules** → Quality Rules → Forbidden Patterns → Chain of Thought → Output Format

**`services/ai-orchestrator/src/pipeline/orchestrator.ts`** — Refactored
- Replaced `import { runMusicPhase } from './music.js'` with `import { runAudioGenerator } from '../agents/audio-generator.js'`
- Pipeline phase order updated:
  1. Concept Architect → GDD
  2. Technical Planner → TechnicalSpec
  3. Code Generator → full HTML
  4. Validation + Debug Loop
  5. Polish Pass
  6. **Audio Generation** (NEW — ZzFX injection via Audio Generator agent)
  7. Multiplayer Injection (moved after audio)
  8. Thumbnail (placeholder)
  9. Final Build → Deploy
- Audio phase calls `runAudioGenerator()` with mode `'zzfx'`, tracks tokens, logs generation metrics
- Stores `audioResult.audioFiles` in `ctx.audioFiles` if present (for future ElevenLabs mode)
- Bundle config `audio` array now populated from `ctx.audioFiles` (empty for ZzFX mode, populated for ElevenLabs mode)
- Old `runMusicPhase()` call removed — the music.ts file still exists but is no longer imported

**`services/ai-orchestrator/src/pipeline/types.ts`** — Updated
- `PipelineContext` now includes `audioFiles?: Array<{ name: string; data: Buffer; mimeType: string }>` for ElevenLabs-generated audio files

**`services/ai-orchestrator/src/config.ts`** — Updated
- `generation.maxTokens.audio` = `MAX_TOKENS_AUDIO` env var, default 12000 (audio injection returns full HTML)

**`services/game-builder/src/storage/gcs.ts`** — Updated
- Added `AudioFile` interface: `{ name, data: Buffer, mimeType }`
- Added `uploadAudioFiles(gameId, version, audioFiles)` function:
  - Uploads audio files to `games/{gameId}/v{version}/audio/` in GCS
  - Returns map of audio name → public CDN URL
  - Sets `contentType` per file, immutable cache-control headers

**`packages/runtime-sdk/src/index.ts`** — Updated
- New exports: `SFX`, `getSFXInlineSource`, `ZzFXParams`, `SFXKey`, `zzfx`, `getZzfxInlineSource`, `createAudioManager`, `getAudioManagerInlineSource`, `AudioManager`, `AudioManagerOptions`

### Files Created
- `packages/runtime-sdk/src/v2/audio/zzfx-presets.ts`
- `packages/runtime-sdk/src/v2/audio/zzfx-micro.ts`
- `packages/runtime-sdk/src/v2/audio/audio-manager.ts`
- `services/ai-orchestrator/src/agents/audio-generator.ts`

### Files Modified
- `services/ai-orchestrator/src/prompts/code.ts`
- `services/ai-orchestrator/src/pipeline/orchestrator.ts`
- `services/ai-orchestrator/src/pipeline/types.ts`
- `services/ai-orchestrator/src/config.ts`
- `services/game-builder/src/storage/gcs.ts`
- `packages/runtime-sdk/src/index.ts`

### Key Architecture Decisions (Prompt 10)
- **Two-layer audio system**: ZzFX for procedural sounds (zero cost, zero latency, inline), Howler.js for file-based audio (future ElevenLabs mode). The AudioManager wraps both and auto-detects which to use.
- **Audio Generator is a dedicated agent** under `services/ai-orchestrator/src/agents/` (same pattern as all other agents). It uses the LLM to inject ZzFX code at the right game event locations.
- **Audio runs BEFORE multiplayer** (Phase 6 vs Phase 7). This is different from the initial orchestrator comment (which had audio after multiplayer). Rationale: audio is a base feature of the game; multiplayer injection should see the audio-injected code so it doesn't accidentally remove audio hooks.
- **ZzFX presets are embedded in the agent's prompt** as inline JavaScript source strings. The LLM receives the actual code to inject (ZzFX engine, SFX map, AudioManager factory) and places them inside the game's existing `<script>` tag.
- **AudioManager provides the feed mute bridge**: `window.addEventListener('message', ...)` listens for `sloppy:mute` and `sloppy:unmute` postMessage events. This is wired automatically — no game-specific code needed.
- **Safety-first fallback**: If the audio injection breaks the SDK contract (missing `window.SloppyGame` or DOCTYPE), the agent falls back to the original un-injected code. The game ships without sound rather than shipping broken.
- **ElevenLabs mode is a placeholder**: The `runElevenLabsMode()` function exists but returns code unchanged. It will be implemented when the creator subscription tier launches. The `ELEVENLABS_API_KEY` env var is documented but not yet used.
- **GCS audio structure**: `games/{id}/v{version}/audio/` — files stored here are only populated for ElevenLabs mode (future). ZzFX mode has no audio files (everything is inline procedural code).
- The `music.ts` file (`services/ai-orchestrator/src/pipeline/music.ts`) is now dead code — no longer imported by the orchestrator. Can be cleaned up or kept for reference.

### Audio Flow Through the Pipeline
1. **Code Generator** receives `AUDIO_RULES` in its system prompt — may include basic ZzFX calls in initial code generation
2. **Debug Loop** validates the game — audio code is present but not critical for validation pass
3. **Polish Agent** may enhance audio-related visual feedback (e.g., particle effects synced with sounds)
4. **Audio Generator** (Phase 6) injects the complete ZzFX micro engine, SFX presets, AudioManager, and `zzfx(...SFX.xxx)` calls at all appropriate game events
5. **Multiplayer Injector** (Phase 7) receives audio-injected code — preserves all audio code
6. **Final Build** — audio is fully inline in the HTML, zero external dependencies

### GCS Bundle Structure (Updated)
```
games/{id}/v{version}/
  index.html          ← Game HTML with inline ZzFX audio
  config.json         ← Includes audio[] array (empty for ZzFX, populated for ElevenLabs)
  assets/             ← SVG game assets
  audio/              ← NEW (ElevenLabs mode only, future)
    sounds.webm       ← Howler audio sprite
    sounds.mp3        ← Fallback format
    ambient.webm      ← Background music loop
  screenshots/        ← Validation screenshots
```

### Downstream Impact for Next Prompts
- ~~**Prompt 11 (Thumbnail)**: No audio impact on thumbnail generation. Thumbnails are visual-only.~~ → Done in Prompt 11
- `config.generation.maxTokens` now has: `concept` (2000), `planning` (3000), `code` (12000), `fix` (12000), `polish` (12000), `assets` (2000), `audio` (12000), `multiplayer` (4000)
- The old `services/ai-orchestrator/src/pipeline/music.ts` is dead code — can be removed in a cleanup pass.
- For the ElevenLabs integration (future), the Audio Generator agent needs: ElevenLabs SDK, audiosprite CLI for packing, and the GCS `uploadAudioFiles()` function is already in place.
- The `Howler.js CDN URL` for games that use file-based audio: `https://cdnjs.cloudflare.com/ajax/libs/howler/2.2.4/howler.min.js` — this would need to be added as a `<script>` tag in the game HTML when ElevenLabs mode is active.

---

## Completed: Prompt 11 — Thumbnail Generation Pipeline

### What Changed

**`services/ai-orchestrator/src/agents/thumbnail-prompter.ts`** — NEW
- `runThumbnailPrompter(gdd, llm, onProgress, maxTokens)` function
- Takes the GDD and generates an optimized FLUX image prompt (100–200 words)
- System prompt includes genre-specific visual archetypes for all 18 genres:
  - Platformers: side-view action pose, colorful backgrounds
  - Racing: dramatic low-angle camera, speed lines
  - Puzzle: clean geometric arrangement, satisfying patterns
  - 3D games: cinematic depth of field, dramatic lighting
  - FPS: first-person corridor perspective with weapon
  - Flight: dramatic banking angle against starfield/clouds
  - Cards: fanned hand on felt table with magic burst
  - Idle: whimsical resource scene with floating numbers
  - etc.
- Prompt writing guidelines: subject first, action, composition (bottom 20% clear for text overlay), lighting, color palette, background, style descriptors
- Strips markdown fences and surrounding quotes from LLM output
- Returns `{ prompt, usage }`

**`services/game-builder/src/thumbnails/fal-client.ts`** — NEW
- `generateThumbnail(prompt, options?)` function
- Calls fal.ai FLUX API via REST (no SDK dependency — uses raw `fetch`)
- Two models:
  - `fal-ai/flux/schnell` for batch (faster, ~$0.003/image)
  - `fal-ai/flux-dev` for creator games (higher quality, ~$0.006/image)
- Image size: 1280×720 (16:9 landscape)
- Optionally passes a Puppeteer screenshot as reference image (data URI)
- Handles queue-based API: submit → poll for completion → download result
- Retry logic: max 2 retries with exponential backoff
- Returns `Buffer | null` (null on failure — non-blocking)
- `FAL_KEY` env var required

**`services/game-builder/src/thumbnails/compositor.ts`** — NEW
- `composeThumbnail(baseImage, title, genre)` function
- Post-processing pipeline using Sharp.js:
  1. Resize to 1280×720 (cover, center)
  2. Vignette overlay (radial gradient, 40% opacity at edges)
  3. Bottom gradient overlay (75% opacity at bottom for text legibility)
  4. Title text overlay (bottom-left, bold, dynamic font size based on title length, drop shadow)
  5. Genre badge (top-right pill with genre-specific color, rounded corners)
  6. Output as WebP (quality 85)
- Also generates small thumbnail: 300×169 for game cards (quality 80)
- Genre badge colors: 18 distinct colors mapped to each `GameGenre` value
- `composeFallbackThumbnail()` — same pipeline for screenshot-based fallback
- Returns `{ thumbnail: Buffer, thumbnailSm: Buffer }`

**`services/game-builder/src/routes/thumbnails.ts`** — NEW
- `thumbnailsRouter()` — Express router for thumbnail generation
- `POST /thumbnails/generate` endpoint:
  - Accepts: `{ prompt, title, genre, screenshotBase64?, model? }`
  - Calls `generateThumbnail()` with FLUX prompt + optional reference screenshot
  - Falls back to screenshot as base image if FLUX fails
  - Runs `composeThumbnail()` for post-processing
  - Returns: `{ thumbnailBase64, thumbnailSmBase64 }`
  - No auth required (called by ai-orchestrator, not end users)

**`services/game-builder/src/app.ts`** — Updated
- Registered `thumbnailsRouter()` at `/thumbnails`

**`services/game-builder/src/storage/gcs.ts`** — Updated
- Added `ThumbnailFiles` interface: `{ thumbnail: Buffer, thumbnailSm: Buffer }`
- Added `uploadThumbnails(gameId, version, thumbnails)` function:
  - Uploads to `games/{gameId}/v{version}/thumbnail.webp` and `thumbnail_sm.webp`
  - Returns `{ thumbnailUrl, thumbnailSmUrl }`
  - Immutable cache-control headers, WebP content type

**`services/game-builder/src/routes/games.ts`** — Updated
- `POST /games` now accepts optional `thumbnailBase64` and `thumbnailSmBase64` in the request body
- If AI-generated thumbnails are provided: uploads via `uploadThumbnails()` and updates game record
- Screenshot-based thumbnail is only set as fallback when no AI thumbnail was provided
- Import updated to include `uploadThumbnails`

**`services/ai-orchestrator/src/pipeline/orchestrator.ts`** — Updated
- Added `runThumbnailPrompter` import
- Thumbnail generation runs **in parallel** with audio generation (Phase 7)
- Thumbnail pipeline sequence:
  1. `runThumbnailPrompter()` → FLUX prompt via LLM
  2. `POST /thumbnails/generate` to game-builder → FLUX image + Sharp.js compositing
  3. Store buffers in `ctx.thumbnailBuffer` / `ctx.thumbnailSmBuffer`
- `lastValidationScreenshots` stored from the debug loop's last validation run — `playing` state screenshot passed to FLUX as reference image
- Thumbnail data sent to game-builder in the `POST /games` payload (`thumbnailBase64`, `thumbnailSmBase64`)
- Thumbnail generation is fully non-blocking — if FLUX or compositing fails, the game still deploys with a screenshot-based fallback
- Token usage tracked as `thumbnail_prompt` phase
- Pipeline comment updated to reflect parallel audio + thumbnail (Phase 7)

**`services/ai-orchestrator/src/pipeline/types.ts`** — Updated
- `PipelineContext` now includes:
  - `thumbnailBuffer?: Buffer` — full-size AI-generated thumbnail (WebP)
  - `thumbnailSmBuffer?: Buffer` — small card thumbnail (WebP)
  - `lastValidationScreenshots?: Record<string, string>` — screenshots from the last validation run (base64)

**`services/game-builder/Dockerfile`** — Updated
- Added `RUN apk add --no-cache vips-dev` in runner stage for Sharp.js native libvips dependency

**`services/game-builder/.env.example`** — Updated
- Added `FAL_KEY` env var for fal.ai FLUX image generation

### Files Created
- `services/ai-orchestrator/src/agents/thumbnail-prompter.ts`
- `services/game-builder/src/thumbnails/fal-client.ts`
- `services/game-builder/src/thumbnails/compositor.ts`
- `services/game-builder/src/routes/thumbnails.ts`

### Files Modified
- `services/ai-orchestrator/src/pipeline/orchestrator.ts`
- `services/ai-orchestrator/src/pipeline/types.ts`
- `services/game-builder/src/routes/games.ts`
- `services/game-builder/src/storage/gcs.ts`
- `services/game-builder/src/app.ts`
- `services/game-builder/Dockerfile`
- `services/game-builder/.env.example`

### Key Architecture Decisions (Prompt 11)
- **Thumbnail generation is non-blocking**: If FLUX fails, the game still deploys. Screenshot-based fallback is always available.
- **FLUX called via raw `fetch`** (no SDK dependency): The fal.ai REST API is used directly with queue-based polling. This avoids adding `@fal-ai/serverless-client` as a dependency and gives full control over retry/timeout logic.
- **Thumbnail and audio run in parallel**: Both are independent post-processing steps that don't depend on each other. Running them concurrently saves ~5-15 seconds of pipeline time.
- **Two-service architecture**: The orchestrator generates the FLUX prompt (LLM), then the game-builder handles image generation + compositing (FLUX + Sharp). This keeps image processing in the game-builder service (which already has Sharp as a dependency) and LLM work in the orchestrator.
- **Sharp.js post-processing** adds marketing polish that raw FLUX images lack: gradient overlay for text legibility, title text (SVG-rendered), genre badge pill (colored per-genre), vignette effect. All compositing uses SVG overlays for consistent rendering.
- **Two thumbnail sizes**: 1280×720 (full) for game detail pages, 300×169 (small) for game cards / feed items. Both are WebP (quality 85/80).
- **Genre badge colors**: Each of the 18 genres has a distinct badge color for visual differentiation in the game store.
- **`POST /thumbnails/generate`** is an internal endpoint (no auth) — called by the ai-orchestrator, not end users.
- **Model selection**: `schnell` (fast, cheap) for batch/population pipeline, `dev` (higher quality) for creator games. The orchestrator currently always uses `schnell`.
- **Validation screenshots reused**: The `playing` state screenshot from the debug loop is passed to FLUX as a reference image, helping FLUX generate something visually relevant to the actual game. These screenshots are already captured and stored in `ctx.lastValidationScreenshots`.
- **AI-generated thumbnails take priority**: If both AI thumbnail and screenshot-based thumbnail are available, the AI one is used. The screenshot fallback only applies when no AI thumbnail was generated.

### GCS Bundle Structure (Updated)
```
games/{id}/v{version}/
  index.html          ← Game HTML with inline ZzFX audio
  config.json         ← Includes engine, genre, audio[], assets[]
  thumbnail.webp      ← NEW: AI-generated full thumbnail (1280×720)
  thumbnail_sm.webp   ← NEW: AI-generated card thumbnail (300×169)
  assets/             ← SVG game assets
  audio/              ← ElevenLabs mode only (future)
  screenshots/        ← Validation screenshots (PNG, raw)
```

### Pipeline Phase Order (Updated)
```
1. Concept Architect → GDD
2. Technical Planner → TechnicalSpec
3. Code Generator → full HTML
4. Asset Generation (SVG)
5. Validation + Debug Loop (max 5 iterations)
6. Polish Pass
7. Audio Generation + Thumbnail Generation (PARALLEL)
8. Multiplayer Injection (conditional)
9. Final Build → Deploy
```

### Downstream Impact for Next Prompts
- `config.generation.maxTokens` now has: `concept` (2000), `planning` (3000), `code` (12000), `fix` (12000), `polish` (12000), `assets` (2000), `audio` (12000), `multiplayer` (4000). Thumbnail prompt uses `maxTokens: 500` (hardcoded, not configurable — prompts are short).
- The thumbnail pipeline adds ~$0.003-$0.006 per game (FLUX cost) + negligible LLM cost for the prompt generation (~100-200 tokens output).
- `services/game-builder/package.json` already had `sharp: ^0.33.0` — no new npm packages were added.
- The fal.ai client uses the queue-based REST API. If fal.ai changes their API, only `services/game-builder/src/thumbnails/fal-client.ts` needs updating.
- For future creator-facing thumbnail regeneration, the `POST /thumbnails/generate` endpoint can be called directly with a custom prompt + the `dev` model for higher quality.
- Dead code from earlier prompts: `services/ai-orchestrator/src/pipeline/music.ts`, `services/ai-orchestrator/src/pipeline/multiplayer.ts`, `services/ai-orchestrator/src/prompts/multiplayer.ts`, `services/ai-orchestrator/src/prompts/concept.ts` — all still exist but are no longer imported by the pipeline.

---

## Completed: Prompt 12 — UI Design System Overhaul

### What Changed

**`apps/web/src/index.css`** — Full rewrite: dark premium gaming theme
- Replaced light sloppy-cream palette with dark gaming aesthetic:
  - `sloppy-bg`: #0d0d0f (deep dark background)
  - `sloppy-surface`: #1a1a1f (card/panel background)
  - `sloppy-surface-hover`: #252530
  - `sloppy-border`: rgba(255,255,255,0.08)
  - `sloppy-primary`: #7c3aed (purple)
  - `sloppy-secondary`: #06b6d4 (cyan)
  - `sloppy-accent`: #f97316 (orange)
  - `sloppy-danger`: #ef4444
  - `sloppy-success`: #22c55e
  - `sloppy-text`: #f4f4f5
  - `sloppy-text-muted`: #a1a1aa
- Kept legacy accent colors: `sloppy-pink`, `sloppy-lime`, `sloppy-cyan`, `sloppy-yellow`, `sloppy-cream`, `sloppy-dark`
- Reduced border-radius: `radius-wobbly` 1.2rem → 0.75rem, `radius-wobbly-lg` 1.8rem → 1rem (tighter, more modern)
- Added `glow-pulse` keyframe animation for neon glow effects
- Body: dark background, light text, `::selection` uses primary purple
- Custom scrollbar: dark track, white/10 thumb, white/20 hover
- `skeleton-shimmer`: updated gradient for dark surfaces (#1a1a1f → #252530 → #1a1a1f)
- `.glass` utility class: `backdrop-filter: blur(20px)` with `rgba(26,26,31,0.8)` background, `@supports` fallback for browsers without `backdrop-filter`

**`apps/web/src/components/layout/Sidebar.tsx`** — NEW
- Desktop-only persistent left sidebar (240px, collapsible to 72px icons-only)
- Main navigation: Home, Feed, Explore, Favourites, Create, Profile — each with custom SVG icon
- Category section with genre links (Action, Puzzle, Racing, Arcade, 3D, Multiplayer) — colored dots
- Active state: `sloppy-primary` background tint + text color
- Collapse toggle button at bottom with chevron icons
- Uses `AnimatePresence` for smooth label show/hide on collapse
- `sticky top-0 h-screen` with `overflow-y-auto` for scrollable nav

**`apps/web/src/components/layout/Layout.tsx`** — Redesigned
- Changed from single-column to `flex` layout: `Sidebar` + `div.flex-1` (content column)
- Content column contains `NavBar` + `main` area
- `bg-sloppy-cream` → `bg-sloppy-bg`
- Max width changed from `max-w-6xl` to `max-w-7xl`
- Sidebar hidden on mobile via Tailwind `hidden md:flex`

**`apps/web/src/components/layout/NavBar.tsx`** — Redesigned
- Desktop: centered search input, Create button (right), user avatar (right)
- Mobile: logo (left), search icon link (right), avatar (right)
- Uses `glass` class + `border-sloppy-border` instead of white background
- Removed navigation links (moved to Sidebar)
- Removed music toggle button (moved to future settings)
- Search input uses dark surface styling with `sloppy-primary` focus ring
- Create button: purple with shadow glow
- Sign in / Logout buttons use dark theme colors
- Removed `useUIStore` (music toggle) dependency
- Added `SearchIcon` inline SVG component

**`apps/web/src/components/layout/BottomNav.tsx`** — Redesigned
- Updated tabs: Home, Feed, Explore, Favourites, Create (was: Home, Create, Favs, My Games)
- Replaced emoji icons with custom SVG icon components matching Sidebar icons
- Uses `glass` class + `border-sloppy-border` instead of white background
- Active state: `text-sloppy-primary` instead of `text-sloppy-pink`

**`apps/web/src/components/ui/SloppyButton.tsx`** — Updated for dark theme
- Primary: `bg-sloppy-primary text-white` with purple glow shadow
- Secondary: `bg-sloppy-secondary text-white` with cyan glow shadow
- Ghost: transparent with `border-sloppy-border`, hover shows `sloppy-surface-hover` + primary border tint
- Reduced hover animation: `scale: 1.03` (was `1.05` with rotation array)
- Font changed from `font-heading` to `font-body`, size from `text-lg` to `text-sm`

**`apps/web/src/components/ui/SloppyCard.tsx`** — Updated for dark theme + 3D tilt
- Background: `bg-sloppy-surface` instead of `bg-white`
- Border: `border-sloppy-border` instead of thick sloppy-dark border
- Hover: primary border tint + primary shadow glow
- 3D tilt via CSS `perspective(600px) rotateX/rotateY` on mouse move (not Framer Motion rotate)
- `transformStyle: 'preserve-3d'` for proper 3D rendering
- Removed random rotation on mount (was `-1deg to 1deg`)

**`apps/web/src/components/ui/SloppyInput.tsx`** — Updated for dark theme
- Background: `bg-sloppy-surface` instead of `bg-white`
- Text: `sloppy-text`, placeholder: `sloppy-text-muted/50`
- Border: solid `sloppy-border` instead of dashed
- Default accent: `primary` (purple) instead of `pink`
- Added `primary` and `secondary` accent options alongside `pink`/`cyan`
- Removed `lime` and `yellow` accent options

**`apps/web/src/components/ui/SloppyModal.tsx`** — Updated for dark theme
- Backdrop: `bg-black/60` instead of `bg-sloppy-dark/40`
- Panel: `glass` class + `border-sloppy-border` instead of white
- Title: `text-sloppy-text` instead of `text-sloppy-dark`
- Animation: subtle scale/slide (0.9 → 1) instead of dramatic rotate (-5deg to 0deg)

**`apps/web/src/components/ui/SloppySpinner.tsx`** — Updated for dark theme
- Dot colors: `sloppy-primary`, `sloppy-secondary`, `sloppy-pink`, `sloppy-accent` (was: pink, cyan, lime, yellow)
- Added `boxShadow: '0 0 8px currentColor'` for neon glow effect on dots

**`apps/web/src/components/ui/SloppyToast.tsx`** — Updated for dark theme
- Background: `bg-sloppy-surface` instead of colored backgrounds (lime/pink/cyan)
- Replaced emoji icons with SVG icons (checkmark, X-circle, info-circle)
- Added colored left border: `border-l-4` with type-specific colors (success=green, error=red, info=cyan)
- Icon colors match border: `text-sloppy-success`, `text-sloppy-danger`, `text-sloppy-secondary`
- Action button: dark surface hover with primary tint

**`apps/web/src/components/ui/GameCard.tsx`** — Complete redesign
- New layout: screenshot thumbnail (aspect-video) + info section below
- Thumbnail displays `thumbnailSmUrl` or `thumbnailUrl` from game data, with gamepad icon placeholder
- Play button overlay appears on hover (centered circle with play triangle)
- Genre + engine badges overlaid on thumbnail (top-left, pill-shaped, colored by type)
- 3D tilt on hover via CSS `perspective(800px)` + `rotateX/rotateY` on mouse move
- Stats row: play count with icon, favourite count with icon, creator name
- Heart icon: SVG (filled red when favourited, outline muted when not)
- Removed random rotation, removed description display
- Added `genreLabels` and `engineLabels` lookup maps for all 16 specific genres

**`apps/web/src/components/ui/GameCardSkeleton.tsx`** — NEW
- `GameCardSkeleton`: loading placeholder matching GameCard dimensions (thumbnail + 2 text lines)
- `GameCardSkeletonGrid`: renders a grid of N skeletons (default 8), responsive columns
- Uses `skeleton-shimmer` class from index.css

**`apps/web/src/components/ui/CategoryChip.tsx`** — NEW
- `CategoryChip`: pill button with optional icon or color dot, active state (primary filled)
- `CategoryChipRow`: flex container with horizontal scroll overflow
- Active: `bg-sloppy-primary text-white border-sloppy-primary`
- Inactive: `bg-sloppy-surface text-sloppy-text-muted border-sloppy-border`
- Hover: surface-hover + text-sloppy-text + primary border tint

**`apps/web/src/components/ui/HeroBanner.tsx`** — NEW
- Rotating featured game spotlight with large card
- Auto-rotates through `games` array on timer (default 6s)
- Full-width aspect-ratio container (21:9 mobile, 3:1 desktop)
- Thumbnail background with gradient overlay (bottom gradient for text)
- Staggered content animation: badge → title → description → play button
- Dot indicators (bottom-right) with clickable navigation
- "Featured" pill badge, play button with icon
- `AnimatePresence mode="wait"` for smooth cross-fade

**`apps/web/src/components/ui/SectionRow.tsx`** — NEW
- Titled horizontal scroll row of child elements (game cards)
- "View all →" link on right side (optional)
- Left/right scroll arrows appear on hover (gradient fade edges)
- `scrollbar-none` for hidden horizontal scrollbar
- Tracks scroll position to show/hide arrows (`canScrollLeft`/`canScrollRight`)

**`apps/web/src/components/ui/SearchBar.tsx`** — NEW
- Debounced search input with configurable delay (default 300ms)
- Recent search history stored in `localStorage` (max 5 entries)
- Dropdown shows recent searches when input is focused and empty
- Clear button appears when query is non-empty
- Search icon (left), focus ring (primary), dark surface styling
- Form submit adds to recent history
- `onSearch` callback fires on debounce and on submit

**`apps/web/src/components/ui/FilterBar.tsx`** — NEW
- Multi-filter panel: genre, engine, multiplayer toggle, sort dropdown
- Expandable filter panel with glass backdrop
- Filter button shows active count badge
- Genre filter: 16 genre pills, click to toggle (single select)
- Engine filter: 3 engine pills (Phaser 3, Three.js, Canvas 2D)
- Multiplayer toggle switch
- Sort dropdown: Trending, Newest, Most Played, Most Liked
- Active filter pills shown inline with remove buttons
- `AnimatePresence` for smooth panel expand/collapse

### Files Modified
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

### Files Created
- `apps/web/src/components/layout/Sidebar.tsx`
- `apps/web/src/components/ui/GameCardSkeleton.tsx`
- `apps/web/src/components/ui/CategoryChip.tsx`
- `apps/web/src/components/ui/HeroBanner.tsx`
- `apps/web/src/components/ui/SectionRow.tsx`
- `apps/web/src/components/ui/SearchBar.tsx`
- `apps/web/src/components/ui/FilterBar.tsx`

### Key Architecture Decisions (Prompt 12)
- **Dark-only theme**: No light mode toggle. The entire color system is designed for dark backgrounds. The legacy accent colors (pink, lime, cyan, yellow, cream, dark) are retained for backward compatibility but the primary design system uses the new palette.
- **Sidebar navigation pattern**: Desktop uses a persistent left sidebar (240px) with collapsible mode (72px icons-only). Mobile hides the sidebar entirely and uses a bottom tab bar. This is the standard pattern for gaming platforms (CrazyGames, itch.io, etc.).
- **3D tilt via CSS `perspective`**: Both `SloppyCard` and `GameCard` use `perspective()` + `rotateX/rotateY` driven by mouse position events (not a third-party library). The `transformStyle: 'preserve-3d'` property enables the 3D rendering context.
- **Glassmorphism with fallback**: The `.glass` utility uses `backdrop-filter: blur(20px)` with an `@supports` fallback that increases background opacity when `backdrop-filter` is not supported.
- **SVG icons everywhere**: All icons are inline SVGs (no icon library dependency). This keeps the bundle small and allows per-component customization (strokeWidth varies by active state).
- **NavBar simplified**: The NavBar no longer contains navigation links (those moved to Sidebar). It's now focused on search (desktop) and user actions (Create, Auth). The music toggle was removed from the NavBar — the `useUIStore` dependency was dropped.
- **GameCard redesigned as thumbnail-first**: The card now features a prominent thumbnail image (aspect-video) with genre/engine badges overlaid. The play button appears as a centered overlay on hover. This matches modern game store UIs.
- **SearchBar with localStorage history**: Recent searches are persisted to localStorage and shown as a dropdown when the input is focused with no query. This provides a lightweight "search history" feature without backend support.
- **FilterBar is UI-only**: The FilterBar manages visual state (expanded/collapsed, active filters) but relies on parent callbacks for actual filtering logic. It does not fetch data or manage query state.
- **All animations still use Framer Motion** as required. CSS transforms are used for 3D tilt (which Framer Motion's spring animations would overcomplicate), but all entrance/exit animations, hover effects, and interactive transitions use `motion` components.

### Design Token Summary
| Token | Value | Usage |
|-------|-------|-------|
| `sloppy-bg` | #0d0d0f | Page background |
| `sloppy-surface` | #1a1a1f | Cards, panels, inputs |
| `sloppy-surface-hover` | #252530 | Hover states |
| `sloppy-border` | rgba(255,255,255,0.08) | All borders |
| `sloppy-primary` | #7c3aed | CTAs, active states, focus rings |
| `sloppy-secondary` | #06b6d4 | Secondary actions, engine badges |
| `sloppy-accent` | #f97316 | Highlights |
| `sloppy-danger` | #ef4444 | Errors, hearts |
| `sloppy-success` | #22c55e | Success states |
| `sloppy-text` | #f4f4f5 | Primary text |
| `sloppy-text-muted` | #a1a1aa | Secondary text |

### Component Inventory (Post-Prompt 12)
**Layout components** (`apps/web/src/components/layout/`):
- `Layout.tsx` — Sidebar + NavBar + content + BottomNav + GameOverlay + Toast
- `Sidebar.tsx` — NEW: Desktop persistent sidebar with nav + categories
- `NavBar.tsx` — Top bar: search (desktop), create button, auth
- `BottomNav.tsx` — Mobile bottom tabs: Home, Feed, Explore, Favourites, Create
- `GameOverlay.tsx` — Unchanged (game play overlay)

**UI components** (`apps/web/src/components/ui/`):
- `SloppyButton.tsx` — Primary (purple), Secondary (cyan), Ghost variants
- `SloppyCard.tsx` — Dark surface card with 3D tilt
- `SloppyInput.tsx` — Dark input with primary/secondary/pink/cyan focus colors
- `SloppyModal.tsx` — Dark glassmorphism modal
- `SloppySpinner.tsx` — Neon-glowing animated dots
- `SloppyToast.tsx` — Dark surface toasts with colored left border + SVG icons
- `GameCard.tsx` — Thumbnail-first card with badges, 3D tilt, play overlay
- `GameCardSkeleton.tsx` — NEW: Loading placeholder grid
- `CategoryChip.tsx` — NEW: Genre pill button with active state
- `HeroBanner.tsx` — NEW: Featured game rotating spotlight
- `SectionRow.tsx` — NEW: Titled horizontal scroll row
- `SearchBar.tsx` — NEW: Debounced search with history dropdown
- `FilterBar.tsx` — NEW: Multi-filter panel (genre, engine, multiplayer, sort)
- `Avatar.tsx` — Unchanged

### Downstream Impact for Next Prompts
- **Prompt 13+ (Page implementations)**: The new components (HeroBanner, SectionRow, CategoryChip, SearchBar, FilterBar, GameCardSkeleton) are ready to be used in page-level components. The Home page should use `HeroBanner` + `SectionRow` rows. The Explore page should use `SearchBar` + `FilterBar` + `GameCardSkeletonGrid`. The Feed page should use a vertical TikTok-style layout.
- **Routing**: The Sidebar and BottomNav reference routes that may not exist yet: `/feed`, `/explore`, `/profile`, `/genre/*`. These routes need to be added to the React Router config.
- **NavBar search**: The desktop NavBar has a basic search input but it's not wired to any search logic. It should either navigate to `/explore?q=...` on submit, or be replaced with the `SearchBar` component.
- **`useUIStore` music toggle**: The NavBar no longer imports `useUIStore` for the music toggle. If the music toggle needs to be accessible globally, it should be added to the Sidebar or a settings panel.
- **GameCard type assertions**: `GameCard` accesses `genre`, `engine`, `thumbnailSmUrl`, `thumbnailUrl`, `favouriteCount` via `(game as any)` because `GameFeedItem` from the API client may not have these fields typed yet. When the API types are updated (Prompt 13+), these should be replaced with proper typed access.
- **No new npm packages were added**. All components use React, Framer Motion, React Router, and Tailwind CSS (already in the project).
- Dead code from earlier prompts remains: `services/ai-orchestrator/src/pipeline/music.ts`, `services/ai-orchestrator/src/pipeline/multiplayer.ts`, `services/ai-orchestrator/src/prompts/multiplayer.ts`, `services/ai-orchestrator/src/prompts/concept.ts`.

---

## Completed: Prompt 13 — Store Pages (Home, Explore, Categories, Game Page)

### What Changed

**`services/game-builder/src/routes/search.ts`** — NEW: Backend search endpoints
- `GET /games/search` — Full-text search with filters (`q`, `genre`, `engine`, `multiplayer`, `sort`). When `q` is provided, uses `gameRepo.search()` (full-text via `ts_rank`). When empty, falls back to `gameRepo.getFeed()` with client-side genre/engine/multiplayer filtering.
- `GET /games/trending` — Returns trending games by feed_events in last N hours (default 24h, max 168h). Uses `gameRepo.getTrending()`.
- `GET /games/featured` — Returns top N games (default 5) by popularity for hero banner. Uses `gameRepo.getFeed()` with `sort: 'popular'`.

**`services/game-builder/src/app.ts`** — Updated
- Registered `searchRouter(gameRepo)` on `/games` prefix, placed before `feedRouter` so `/games/search`, `/games/trending`, `/games/featured` match before the catch-all game routes.

**`services/api-gateway/src/proxy.ts`** — No changes needed
- The existing `app.use('/games', ...)` proxy catches all `/games/*` paths including the new endpoints.

**`apps/web/src/lib/api.ts`** — Updated API client
- Updated `GameFeedItem` interface to include v2 fields: `genre`, `engine`, `thumbnailUrl`, `thumbnailSmUrl`, `favouriteCount`. Removed `(game as any)` need.
- Added `gamesApi.search({ query, genre, engine, multiplayer, sort, cursor, limit })` — calls `GET /games/search`.
- Added `gamesApi.getByGenre(genre, { sort, cursor, limit })` — calls `GET /games/search?genre=...`.
- Added `gamesApi.getTrending({ hours, limit })` — calls `GET /games/trending`.
- Added `gamesApi.getFeatured(limit)` — calls `GET /games/featured`.

**`apps/web/src/stores/game.ts`** — Updated game store
- Exported `SearchFilters` type: `{ genre?, engine?, multiplayer?, sort? }`.
- Added search state: `searchResults`, `searchCursor`, `searchQuery`, `searchFilters`, `hasMoreSearch`, `isLoadingSearch`, `searchError`.
- Added discovery state: `trendingGames`, `isLoadingTrending`, `featuredGames`, `isLoadingFeatured`.
- Added category state: `categoryGames`, `categoryCursor`, `hasMoreCategory`, `isLoadingCategory`.
- Added actions: `search(query, filters?, reset?)`, `clearSearch()`, `setSearchFilters(filters)`, `fetchTrending()`, `fetchFeatured()`, `fetchByGenre(genre, reset?)`.

**`apps/web/src/pages/Home.tsx`** — Full rewrite as discovery store
- Replaced flat Virtuoso feed with sectioned store layout.
- **Hero Banner**: `HeroBanner` showing featured games (auto-rotating). Fetched via `fetchFeatured()`.
- **Category Quick Access**: Horizontal scroll of `CategoryChip` components linking to `/category/:genre`.
- **Trending Now**: `SectionRow` using `trendingGames` from `fetchTrending()`. "View all" navigates to `/explore?sort=trending`.
- **Just Created**: `SectionRow` filtered from `feedGames` (published, newest 8). Auto-refreshes every 30s. "View all" navigates to `/explore?sort=newest`.
- **3D Games**: `SectionRow` filtered by `engine === 'threejs'` from feed. "View all" navigates to `/explore?engine=threejs`.
- **Play With Friends**: `SectionRow` filtered by `supportsMultiplayer === true`. "View all" navigates to `/explore?multiplayer=true`.
- Empty state with "Create a Game" CTA when no games exist.
- Removed: Virtuoso dependency, pull-to-refresh, sort tabs, old SkeletonCard.

**`apps/web/src/pages/Explore.tsx`** — NEW: Full search & filter page
- URL: `/explore`, syncs state to URL params (`?q=space&genre=action&engine=threejs`).
- `SearchBar` at top with 300ms debounced search.
- `FilterBar` below with genre dropdown, engine toggle, multiplayer toggle, sort (Trending/Newest/Most Played/Most Liked).
- Grid of `GameCard` results (2/3/4 columns responsive).
- Infinite scroll via IntersectionObserver sentinel element.
- "No results" empty state with CTA to generate the missing game (navigates to `/create?prompt=...`).

**`apps/web/src/pages/Category.tsx`** — NEW: Per-genre category page
- URL: `/category/:genre` (e.g., `/category/2d-platformer`).
- Header with genre icon, label, and back button.
- Sort tabs: Popular, New, Trending.
- Grid of `GameCard` results with infinite scroll.
- Empty state with "Create a Game" CTA.
- Uses `fetchByGenre(genre)` from game store.

**`apps/web/src/pages/Game.tsx`** — NEW: Individual game page (replaces `GameView.tsx`)
- URL: `/game/:id`.
- Fetches game data from API if not available in store/overlay data.
- Header: back button, title, favourite button, multiplayer button, "Play" button.
- Full thumbnail preview (clickable to launch game overlay).
- Game info panel: description, stats (plays, favourites, created date, creator), genre/engine/multiplayer tags.
- "More Like This" section showing related games (same genre) via `SectionRow`.
- Escape key exits to previous page. Overlay close navigates back.
- Auto-joins multiplayer session when `?session=` URL param is present.

**`apps/web/src/App.tsx`** — Updated routing
- Replaced `GameView` lazy import with `Game`.
- Added routes: `/explore` → `Explore`, `/category/:genre` → `Category`.
- `/game/:id` now loads `Game` instead of `GameView`.

**`apps/web/src/components/layout/Sidebar.tsx`** — Updated
- Changed category links from `/genre/*` prefix to `/category/*` to match the new routing.
- Updated category labels to match actual genre names (e.g., "Action" → "Arcade", "3D" → "FPS").

### Files Modified
- `services/game-builder/src/app.ts`
- `apps/web/src/lib/api.ts`
- `apps/web/src/stores/game.ts`
- `apps/web/src/pages/Home.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/components/layout/Sidebar.tsx`

### Files Created
- `services/game-builder/src/routes/search.ts`
- `apps/web/src/pages/Explore.tsx`
- `apps/web/src/pages/Category.tsx`
- `apps/web/src/pages/Game.tsx`

### Files Superseded
- `apps/web/src/pages/GameView.tsx` — Replaced by `Game.tsx`. The old file still exists but is no longer imported or routed to. Can be safely deleted.

### Key Architecture Decisions (Prompt 13)
- **Search endpoint design**: The `/games/search` endpoint handles both full-text search (when `q` is provided) and filtered browsing (when `q` is empty). This avoids needing separate endpoints for search-with-filters vs browse-with-filters.
- **Featured = popular**: The `/games/featured` endpoint simply returns the top N games by popularity (`sort: 'popular'`). There is no manual curation system. A future version could add a `featured` boolean column to `games` for editorial picks.
- **Proxy coverage**: No proxy changes were needed because the existing `app.use('/games', ...)` wildcard proxy forwards all `/games/*` paths to game-builder, covering `/games/search`, `/games/trending`, and `/games/featured` automatically.
- **URL param sync on Explore**: The Explore page syncs search state bidirectionally with URL search params. This means bookmarkable/shareable search URLs like `/explore?q=space&genre=action&engine=threejs`.
- **IntersectionObserver for infinite scroll**: Both Explore and Category pages use IntersectionObserver-based infinite scroll rather than Virtuoso. This is simpler and more appropriate for grid layouts.
- **Home page section isolation**: Each section on the Home page fetches data independently (featured, trending, feed). Sections that derive from feed data (3D, Multiplayer) filter client-side from the already-fetched feed. This avoids separate API calls for every section.
- **GameView → Game migration**: The old `GameView.tsx` was a thin wrapper that just opened the game overlay. The new `Game.tsx` provides a full game detail page with info, stats, and related games, while still supporting the overlay-based play flow.
- **GameCard type cleanup**: `GameFeedItem` in the API client now has proper typed fields for `genre`, `engine`, `thumbnailUrl`, `thumbnailSmUrl`, `favouriteCount`. The `(game as any)` casts in `GameCard.tsx` can now be removed (they still work due to backward compat but are no longer necessary).

### Downstream Impact for Next Prompts
- **`/feed` route**: The Sidebar and BottomNav reference `/feed` but this route doesn't exist yet. This is for the TikTok-style vertical feed (likely Prompt 14+).
- **`/profile` route**: Referenced in the Sidebar but not implemented. Needs a user profile page.
- **NavBar search wiring**: The desktop NavBar has a search input that's not wired. It should navigate to `/explore?q=...` on submit, or use the `SearchBar` component.
- **`GameView.tsx` cleanup**: The old file can be deleted. It's no longer imported anywhere.
- **GameCard `(game as any)` removal**: Now that `GameFeedItem` has proper types, the `(game as any)` casts in `GameCard.tsx` (lines 64-68) can be removed and replaced with direct typed access.
- **Multiplayer store**: `Game.tsx` imports `useMultiplayerStore` for session auto-join. Ensure this store exists and is working.
- **No new npm packages added**. All features use React, React Router, Framer Motion, Zustand, and Tailwind CSS.

### Post-Review Fixes (Prompt 13)
1. **Search endpoint filter-before-paginate fix**: The `/games/search` endpoint now uses `gameRepo.getByGenre()` and `gameRepo.getByEngine()` directly when genre/engine filters are set without a search query, avoiding the client-side post-pagination filtering issue.
2. **Trending response type fix**: The `/games/trending` endpoint now augments `Game[]` results with `isFavourited` and `creatorDisplayName` fields so they match the frontend `GameFeedItem` type. Falls back to popular feed if no feed_events data exists.
3. **Category sort tabs functional**: Sort tabs in `Category.tsx` now pass the selected sort to `fetchByGenre()`, which forwards it to `gamesApi.getByGenre()`. Changing sort re-fetches data.
4. **Game page overlay race condition fix**: `Game.tsx` now uses `overlayWasOpen = useRef(isGameOverlayOpen)` to track whether the overlay was open when the component mounted. Navigate-back on close only fires if the overlay was originally open (user came from a play action). Direct URL navigation shows the game detail page without overlay auto-open.
5. **Removed unused destructures**: `feedSort` from Home.tsx, `clearSearch` from Explore.tsx, `VALID_SORTS` from search.ts.

---

## Completed: Prompt 14 — TikTok-Style Infinite Scroll Feed

### What Changed

**`services/game-builder/src/routes/feed.ts`** — Major update
- Added `GET /games/feed/algorithm` — TikTok-style algorithmic feed endpoint. Uses `feedEventRepo.getTrendingGameIds()` to weight popular games, falls back to chronological if no event data. Applies genre diversity penalty (avoids consecutive same-genre games via `diversifyFeed()` helper).
- Added `POST /games/:id/progress` — Save game progress (requires auth). Delegates to `GameProgressRepository.save()`.
- Added `GET /games/:id/progress` — Get saved game progress (requires auth). Delegates to `GameProgressRepository.get()`.
- Added `POST /games/:id/feed-event` — Track feed analytics events (view, play_start, play_time, skip, favourite). Validates event type. Fire-and-forget from client side.
- Updated router factory to accept optional `GameProgressRepository` and `FeedEventRepository` params (backward compatible).
- Added `diversifyFeed()` helper that reorders games to avoid consecutive entries with the same genre.
- Replaced `console.error` calls with structured `createLogger` logging.

**`services/game-builder/src/app.ts`** — Updated
- Added imports for `createGameProgressRepository` and `createFeedEventRepository`.
- Instantiates `progressRepo` and `feedEventRepo` from the database connection.
- Passes both repos to `feedRouter(gameRepo, progressRepo, feedEventRepo)`.

**`apps/web/src/lib/api.ts`** — Updated
- Added `GameProgressData` interface for progress save/get responses.
- Added `tikTokFeedApi` namespace with four methods:
  - `algorithm(opts)` — Fetch algorithmic feed with cursor pagination.
  - `saveProgress(gameId, data)` — POST progress data to backend.
  - `getProgress(gameId)` — GET saved progress for a game.
  - `trackEvent(gameId, eventType, durationMs?)` — Fire-and-forget analytics event tracking (swallows errors).

**`apps/web/src/stores/game.ts`** — Updated
- Added TikTok feed state: `tikTokGames`, `tikTokCursor`, `hasMoreTikTok`, `isLoadingTikTok`, `tikTokError`.
- Added `fetchTikTokFeed(reset?)` action that calls `tikTokFeedApi.algorithm()` with cursor-based pagination and appends/replaces results.

**`apps/web/src/hooks/useFeedWindow.ts`** — Created
- `useFeedWindow(games, opts?)` hook implementing the 3-iframe sliding window pattern.
- Maintains `currentIndex` and derives `currentGame`, `prevGame`, `nextGame` from the games array.
- Provides `goNext()`/`goPrev()` with transition-lock (prevents double-navigation during 350ms animation).
- Triggers `onNearEnd` callback when user approaches the end of the loaded list (default threshold: 2 games from end).
- Exports `buildGameSrc(game)` utility to construct CDN iframe URLs from game metadata.
- Returns `direction` (1/-1/0) and `isTransitioning` for animation coordination.

**`apps/web/src/pages/Feed.tsx`** — Created
- Full-viewport TikTok-style feed page (`position: fixed; inset: 0; height: 100dvh`).
- Uses `useFeedWindow` hook for the 3-iframe sliding window architecture.
- **FeedSlide component**: Wraps each game iframe. Handles:
  - postMessage communication (`sloppy:command start/pause`, `sloppy:mute/unmute`, `sloppy:restore`).
  - Auto-play on becoming active, auto-pause on becoming inactive.
  - Progress saving: listens for `sloppy:progress` messages, saves to localStorage immediately, debounced save to backend every 10s.
  - Progress restoration: sends saved data back to iframe via `sloppy:restore` on load.
  - Analytics tracking: fires `play_start` and `play_time` events.
- **FeedHeader**: Minimal header with "SLOPPY FEED" branding, search icon, mute/unmute toggle. Fades in/out based on user interaction.
- **FeedGameInfo**: Bottom-left info overlay (title, genre badge, engine badge, play count, creator name). Right-side TikTok-style action buttons (favourite, full screen, share, multiplayer). Buttons use frosted-glass circular style.
- **FeedNavHints**: Desktop-only navigation arrows (up/down) with position indicator (e.g., "3/10"). Hidden on mobile.
- **Navigation**: Scroll wheel (desktop), swipe (mobile touch events), arrow keys / j/k (keyboard), 'm' to toggle mute, Escape to close.
- **Preloading**: Previous and next game iframes rendered with `visibility: hidden` to keep DOM alive and pre-loaded.
- **AnimatePresence**: Framer Motion slide transitions (100% viewport translate) with custom direction variants.
- **Sound**: Always muted by default. Persistent mute toggle in header. Active game receives unmute command if user explicitly unmutes.
- **States**: Loading spinner, error with retry, empty state with "Create a Game" CTA.

**`apps/web/src/App.tsx`** — Updated
- Added lazy import for `Feed` page component.
- Added `/feed` route **outside** the `<Layout>` wrapper (no sidebar, navbar, or bottom nav in feed mode). Uses `ErrorBoundary` wrapper.

### Files Modified
- `services/game-builder/src/routes/feed.ts`
- `services/game-builder/src/app.ts`
- `apps/web/src/lib/api.ts`
- `apps/web/src/stores/game.ts`
- `apps/web/src/App.tsx`

### Files Created
- `apps/web/src/hooks/useFeedWindow.ts`
- `apps/web/src/pages/Feed.tsx`

### Key Architecture Decisions (Prompt 14)
- **Feed route outside Layout**: The `/feed` route is mounted outside the `<Layout>` wrapper in `App.tsx`. This is intentional — the feed is a full-viewport immersive experience that doesn't show the sidebar, navbar, or bottom nav. The feed has its own minimal header.
- **3-iframe sliding window**: Only 3 iframes exist at any time (prev, current, next). The current iframe is visible; prev and next use `visibility: hidden` (not `display: none`) to keep them in the DOM and pre-loaded. On navigation, the roles shift and a new iframe is created for preloading.
- **GPU-composited animations**: All transitions use CSS `transform` via Framer Motion's `y` property (maps to `translate3d`). No layout-triggering properties are animated.
- **Progress saving strategy**: Dual-layer — localStorage for immediate persistence (works for anonymous users), debounced POST to backend every 10s for logged-in users. Progress is restored via `sloppy:restore` postMessage when a game's iframe loads.
- **Feed algorithm endpoint**: `GET /games/feed/algorithm` uses the existing `gameRepo.getFeed()` with `sort: 'popular'` when trending data exists, falling back to `sort: 'recent'`. The `diversifyFeed()` helper reorders results to avoid consecutive same-genre games. This is a simple V1 algorithm — future versions could use weighted scoring (recencyScore × engagementScore × qualityScore − diversityPenalty + randomNoise).
- **Analytics fire-and-forget**: `tikTokFeedApi.trackEvent()` swallows errors (`.catch(() => {})`). Feed events are non-critical and should never block the UI. The endpoint returns 204 No Content.
- **Sound muted by default**: Matches TikTok behavior. Audio is always muted when entering the feed. The user must explicitly unmute. Games receive `sloppy:mute`/`sloppy:unmute` postMessages.
- **No new dependencies**: All features use existing React, Framer Motion, Zustand, React Router, and Tailwind CSS.
- **Backward-compatible feed router**: The `feedRouter()` now accepts optional `progressRepo` and `feedEventRepo` params. If not provided, progress and event endpoints return 501/204 respectively. This means the router can be used without the v2 database tables if needed.

### Downstream Impact for Next Prompts
- **API gateway proxy**: The new endpoints (`/games/feed/algorithm`, `/games/:id/progress`, `/games/:id/feed-event`) should be covered by the existing `app.use('/games', ...)` wildcard proxy in the API gateway (`services/api-gateway/src/proxy.ts`). Verify this works or add explicit routes.
- **Progress saving for logged-in users**: Currently saves to localStorage + backend. The backend `POST /games/:id/progress` endpoint requires auth (`requireUser`). Anonymous users only get localStorage. A future prompt could add anonymous→authenticated progress migration.
- **Feed algorithm sophistication**: The current algorithm is simple (popular sort + genre diversity). Future work: weighted scoring formula, user preference learning, time-decay, A/B testing framework.
- **Feed controls (start/pause/restart)**: The spec mentions a control bar with Start/Pause/Restart buttons. Currently, games auto-start when active. The control bar could be added as an enhancement (show on tap/hover in the center of the screen).
- **`/profile` route**: Still referenced in the Sidebar but not implemented.
- **NavBar search wiring**: Still not wired to `/explore?q=...`.

---

## Completed: Prompt 15 — Fullscreen & Responsive Game Playing

### What Changed

**`apps/web/src/hooks/useFullscreen.ts`** — NEW
- `useFullscreen(elementRef)` hook with `isFullscreen`, `enterFullscreen`, `exitFullscreen`, `toggleFullscreen`, `isFallback`
- Uses native Fullscreen API where available (`requestFullscreen` + `webkitRequestFullscreen`)
- Falls back to CSS viewport overlay (`.sloppy-fullscreen-fallback` class) on iOS Safari and browsers where Fullscreen API is restricted or rejected
- Listens to `fullscreenchange` + `webkitfullscreenchange` events to sync state
- Cleans up CSS fallback class on unmount
- `isFallback` boolean indicates when using CSS fallback instead of native fullscreen

**`apps/web/src/hooks/useGameBridge.ts`** — NEW
- `useGameBridge(iframeRef, options?)` hook providing PostMessage bridge between React shell and game iframe
- Returns: `gameState`, `score`, `isReady`, `hasError`, `errorMessage`, `sendCommand`, `sendRestore`
- `GameBridgeState`: `idle | intro | playing | paused | gameover`
- `GameBridgeCommand`: `start | pause | resume | restart | mute | unmute | restore`
- Listens for game reports: `sloppy:game:ready`, `sloppy:state`, `sloppy:score`, `sloppy:progress`, `sloppy:game:error`
- Sends commands via `sloppy:command`, `sloppy:mute`, `sloppy:unmute`, `sloppy:restore` postMessages
- Optional callbacks: `onProgress`, `onError`, `onReady`
- Resets internal state when iframe src changes
- Exports `GameScore`, `GameProgressData` types

**`apps/web/src/components/GamePlayerShell.tsx`** — NEW
- Unified game player component used by both the game page and feed
- Wraps the game iframe with responsive scaling
- Props: `src`, `title`, `gameWidth` (default 960), `gameHeight` (default 540), `scaleMode` (fit/fill/stretch), `mode` (inline/overlay/fullscreen), `showFullscreenToggle`, callbacks, optional `iframeRef`
- Responsive scaling via CSS `transform: scale()` (GPU composited, no layout reflow):
  - `fit` mode: `Math.min(viewportW / gameW, viewportH / gameH)` — letterbox/pillarbox
  - `fill` mode: `Math.max(viewportW / gameW, viewportH / gameH)` — fills viewport, may crop
  - `stretch` mode: `width: 100%; height: 100%` — no transform
- Uses `ResizeObserver` to measure container size
- Integrates `useFullscreen` for fullscreen toggle button (top-right corner)
- Integrates `useGameBridge` for game state communication
- Loading spinner, error states, runtime error overlay
- Accepts external `iframeRef` (for multiplayer postMessage integration)
- Renders child overlays (touch controls, multiplayer HUD, etc.) via `children` prop
- Exports `GamePlayerMode` type

**`packages/runtime-sdk/src/v2/touch-controls.ts`** — NEW
- `TouchControlType`: `joystick | d-pad | tap-zones | gesture | custom`
- `TouchControlConfig`: `type`, `layout` (left/right control areas), `opacity`, `scale`
- `TouchLayout`: `left` (joystick/d-pad/tap-zones), `right` (buttons/none), `actionButtonCount`, `actionLabels`
- `TouchInput`: normalized input events sent via postMessage (`touch:move`, `touch:action`, `touch:release`)
- `getTouchConfigForGenre(genre)` — returns recommended touch control config for all 16 specific genres + fallback for custom
  - Platformers/arcade: d-pad + action buttons
  - Shooters/topdown/racing/flight/FPS: joystick + action buttons
  - Puzzles/cards/idle/rhythm/tower-defense: tap-zones only
- `TouchControls` class:
  - `mount(container)` — renders touch controls as a CSS overlay with `pointerEvents: auto` on interactive elements
  - `destroy()` — removes all DOM elements and event listeners
  - Joystick: circular base with draggable knob, dead zone (0.15), clamped to radius
  - D-pad: 4 directional buttons (arrows) arranged in cross pattern
  - Action buttons: circular buttons on right side, labeled, up to 4
  - Touch event handling: `touchstart/touchmove/touchend/touchcancel`
  - Sends `TouchInput` via callback with normalized x/y direction and mapped key code
  - Maps directional input to arrow keys, action buttons to Space/X/Z/C keys
  - Visual feedback: flash on press
- `getTouchControlsInlineSource()` — returns inline JS bridge code that converts `sloppy:touch` postMessages into synthetic `KeyboardEvent` dispatches inside the game iframe

**`apps/web/src/components/layout/GameOverlay.tsx`** — Refactored
- Replaced raw iframe management with `GamePlayerShell` component
- Game area now uses `<GamePlayerShell>` with `src`, `title`, `mode`, `iframeRef`, and callback props
- `GamePlayerShell` handles: loading spinner, error states, responsive scaling, fullscreen toggle
- Multiplayer HUD and Reconnect overlays rendered as children of `GamePlayerShell`
- `iframeRef` passed to `GamePlayerShell` as external ref for multiplayer store integration
- Removed direct iframe rendering, loading/error UI (now handled by shell)
- Retained: header bar, close/back button, title, multiplayer/favourite actions
- Retained: escape key handler, browser back button, postMessage multiplayer input bridge
- `GamePlayerMode` determined by screen width: mobile (<768px) → `overlay`, desktop → `fullscreen`
- `handleGameReady` callback replaces the old inline `sloppy:game:ready` handler
- `handleGameError` callback replaces the old inline error handler, calls `reportGameCrash`

**`apps/web/src/index.css`** — Updated
- Added `.sloppy-fullscreen-fallback` class: `position: fixed; inset: 0; z-index: 9999; width: 100vw; height: 100dvh; background: #000` — used by `useFullscreen` CSS fallback on iOS Safari

**`packages/runtime-sdk/src/index.ts`** — Updated
- New exports: `TouchControls`, `getTouchConfigForGenre`, `getTouchControlsInlineSource`
- New type exports: `TouchControlConfig`, `TouchControlType`, `TouchLayout`, `TouchInput`

### Files Created
- `apps/web/src/hooks/useFullscreen.ts`
- `apps/web/src/hooks/useGameBridge.ts`
- `apps/web/src/components/GamePlayerShell.tsx`
- `packages/runtime-sdk/src/v2/touch-controls.ts`

### Files Modified
- `apps/web/src/components/layout/GameOverlay.tsx`
- `apps/web/src/index.css`
- `packages/runtime-sdk/src/index.ts`

### Key Architecture Decisions (Prompt 15)
- **GamePlayerShell is the single unified game player**: Used by both GameOverlay (game page) and potentially the Feed. It handles all iframe management, scaling, fullscreen, and game communication.
- **Responsive scaling via CSS `transform: scale()`**: All scaling is GPU-composited — no layout reflow. The game renders at its native resolution (e.g. 960×540) and the shell scales the iframe to fit/fill the viewport. This maintains pixel-perfect rendering and avoids re-layout costs.
- **Standard resolutions**: 960×540 (2D Phaser games), 1280×720 (3D Three.js games), 414×896 (mobile portrait). The shell reads `gameWidth/gameHeight` from the game's `config.json`.
- **Fullscreen: native + CSS fallback**: The `useFullscreen` hook tries the native Fullscreen API first. If it's unavailable or rejected (iOS Safari restricts it), it falls back to a CSS class that positions the container as `fixed; inset: 0; z-index: 9999`. The visual result is identical to native fullscreen.
- **Touch controls are a CSS overlay**: Touch controls render as absolutely-positioned `<div>` elements above the game iframe. They capture touch events and convert them to normalized input → synthetic keyboard events. This means games don't need to implement touch handling — they receive standard keyboard events.
- **Genre-based touch control selection**: `getTouchConfigForGenre()` maps each genre to the most appropriate touch control type. The Technical Planner agent can use this to determine controls per game.
- **Game bridge consolidates postMessage handling**: `useGameBridge` is a single hook that handles all postMessage communication between the shell and the game. It replaces the scattered inline message handlers that existed in the old GameOverlay and Feed components.
- **External iframe ref pattern**: `GamePlayerShell` accepts an optional `iframeRef` prop that exposes the internal iframe element to the parent. This is used by GameOverlay to give the multiplayer store access to the iframe's `contentWindow` for outbound postMessages.
- **GamePlayerMode**: `inline` (embedded in page), `overlay` (full viewport overlay), `fullscreen` (native fullscreen or CSS fallback). Desktop game click → fullscreen, mobile → overlay, feed games → overlay by default with tap-to-fullscreen option.

### Component Inventory (Post-Prompt 15)
**Hooks** (`apps/web/src/hooks/`):
- `useFullscreen.ts` — NEW: Native + CSS fallback fullscreen management
- `useGameBridge.ts` — NEW: PostMessage bridge for game iframe communication
- `useFeedWindow.ts` — 3-iframe sliding window for TikTok feed
- `useLobbyMusic.ts` — Lobby music player

**Game Player** (`apps/web/src/components/`):
- `GamePlayerShell.tsx` — NEW: Unified game player with scaling + fullscreen + bridge

**Touch Controls** (`packages/runtime-sdk/src/v2/`):
- `touch-controls.ts` — NEW: Touch overlay system with joystick/d-pad/tap-zones + genre mapping

### Downstream Impact for Next Prompts
- **Feed page integration**: The Feed page (`apps/web/src/pages/Feed.tsx`) currently manages its own iframe rendering in `FeedSlide`. It could be refactored to use `GamePlayerShell` for consistency, but this is not blocking — the feed has unique requirements (3-iframe window, mute management, transition animations) that make a full `GamePlayerShell` integration non-trivial.
- **Touch controls mounting**: The `TouchControls` class is available but not yet automatically mounted. A future enhancement could detect mobile devices and auto-mount touch controls in `GamePlayerShell` based on the game's genre from `config.json`.
- **Touch controls inline source injection**: `getTouchControlsInlineSource()` provides a JS bridge for injection into game HTML. The AI orchestrator could inject this in the audio/polish pipeline phase so games automatically support touch input via synthetic keyboard events.
- **`/profile` route**: Still referenced in the Sidebar but not implemented.
- **NavBar search wiring**: Still not wired to `/explore?q=...`.
- **GameView.tsx cleanup**: The old file can still be safely deleted — it was superseded by `Game.tsx` in Prompt 13.
- Dead code from earlier prompts remains: `services/ai-orchestrator/src/pipeline/music.ts`, `services/ai-orchestrator/src/pipeline/multiplayer.ts`, `services/ai-orchestrator/src/prompts/multiplayer.ts`, `services/ai-orchestrator/src/prompts/concept.ts`.

### Pipeline Phase Order (Unchanged from Prompt 14)
```
1. Concept Architect → GDD
2. Technical Planner → TechnicalSpec
3. Code Generator → full HTML
4. Asset Generation (SVG)
5. Validation + Debug Loop (max 5 iterations)
6. Polish Pass
7. Audio Generation + Thumbnail Generation (PARALLEL)
8. Multiplayer Injection (conditional)
9. Final Build → Deploy
```

### Config & Token Budget (Unchanged)
```
maxTokens: concept (2000), planning (3000), code (12000), fix (12000), polish (12000), assets (2000), audio (12000), multiplayer (4000)
maxDebugIterations: 5
enablePolish: true
timeoutMs: 180000
```

---

## Prompt 16: Payments Service — Stripe Billing

### What Was Built
A new `services/payments` microservice implementing Stripe Billing for $5/month creator subscriptions, with full frontend integration including a subscription management page, auth store subscription state, and a subscription gate on the Create page.

### Architecture
- **Payments service** (`services/payments/`) — standalone Express + TypeScript service on port 3006
  - `src/stripe/billing.ts` — Stripe SDK wrapper: `createCustomer`, `createSubscription`, `cancelSubscription`, `getSubscription`, `createCheckoutSession`, `createBillingPortalSession`
  - `src/stripe/webhooks.ts` — Webhook handler with signature verification for: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
  - `src/routes/subscription.ts` — REST endpoints: `POST /payments/subscribe`, `GET /payments/subscription`, `POST /payments/cancel`, `POST /payments/portal`
  - `src/middleware/user.ts` — resolveUser + requireUser middleware (same pattern as game-builder)
  - `src/app.ts` — Express app with raw body parsing for webhooks BEFORE json middleware, health check, graceful shutdown
  - `src/config.ts` — env var config for port, Stripe keys, webhook secret, price ID
- **API Gateway** — new proxy routes for `/payments/*` with auth requirement on all endpoints except webhooks
  - Webhook proxy does NOT use `fixRequestBody` to preserve raw body for Stripe signature verification
  - Added `payments: process.env.PAYMENTS_URL` to gateway config

### Database
Uses existing `creator_subscriptions` table and `CreatorSubscriptionRepository` from `@sloppy/db` (built in Prompt 2). Webhook events upsert subscription records via the repository.

### Frontend Changes
- **New page**: `apps/web/src/pages/Dashboard/Settings.tsx` — Subscription status card showing current plan state (active/canceled/none), renewal date, subscribe button → Stripe Checkout redirect, cancel button → confirmation modal, manage billing → Stripe Customer Portal
- **New route**: `/dashboard/settings` added to `App.tsx`
- **API client**: Added `subscriptionApi` to `apps/web/src/lib/api.ts` with methods: `getStatus()`, `createCheckout()`, `cancel()`, `portal()`
- **Auth store**: Added `isSubscribed: boolean` and `refreshSubscription()` to `useAuthStore`. Subscription status is synced on login via `syncUser()` and persisted to localStorage.
- **Create page subscription gate**: `handleGenerate()` now checks `isAuthenticated` and `isSubscribed` before starting generation. Non-subscribers see a modal directing them to `/dashboard/settings`.

### Files Created
- `services/payments/package.json`
- `services/payments/tsconfig.json`
- `services/payments/Dockerfile`
- `services/payments/.env.example`
- `services/payments/src/app.ts`
- `services/payments/src/config.ts`
- `services/payments/src/stripe/billing.ts`
- `services/payments/src/stripe/webhooks.ts`
- `services/payments/src/routes/subscription.ts`
- `services/payments/src/middleware/user.ts`
- `apps/web/src/pages/Dashboard/Settings.tsx`

### Files Modified
- `services/api-gateway/src/proxy.ts` — added payments proxy routes
- `services/api-gateway/src/config.ts` — added `payments` service URL
- `apps/web/src/App.tsx` — added `/dashboard/settings` route + lazy import
- `apps/web/src/pages/Create.tsx` — added subscription gate + subscribe modal
- `apps/web/src/stores/auth.ts` — added `isSubscribed`, `refreshSubscription()`
- `apps/web/src/lib/api.ts` — added `subscriptionApi`
- `docker-compose.yml` — added payments service + PAYMENTS_URL env var to api-gateway

### Key Architecture Decisions (Prompt 16)
- **Webhook raw body handling**: The webhook endpoint is mounted BEFORE `express.json()` middleware in the payments service, using `express.raw({ type: 'application/json' })`. In the API gateway, the webhook proxy doesn't use `fixRequestBody` to preserve the raw body for Stripe signature verification.
- **Stripe Checkout flow (not embedded)**: Uses Stripe-hosted Checkout pages rather than Stripe Elements. The frontend redirects to Stripe, and Stripe redirects back with `?success=true` or `?canceled=true` query params.
- **Stripe Customer Portal for billing management**: Instead of building custom billing UI, uses Stripe's hosted Customer Portal for invoice history, payment method updates, etc.
- **Subscription metadata userId**: The Stripe customer and subscription both store `userId` in metadata. Webhook handlers look up `sub.metadata.userId` to map Stripe events back to platform users.
- **Subscription state in auth store**: `isSubscribed` is synced on every `syncUser()` call and persisted to localStorage. This provides immediate subscription-gated UI without additional API calls on navigation.
- **Create page subscription gate**: Checks both auth AND subscription before generation. Auth gate shows login modal; subscription gate shows a separate modal with a link to the settings page.

### Service Port Assignments
| Service | Port |
|---------|------|
| api-gateway | 3001 |
| auth | 3002 |
| game-builder | 3003 |
| ai-orchestrator | 3004 |
| multiplayer | 3005 |
| payments | 3006 |

### Env Vars Required for Payments
```
STRIPE_SECRET_KEY — Stripe secret API key
STRIPE_PUBLISHABLE_KEY — Stripe publishable API key (for frontend if needed)
STRIPE_WEBHOOK_SECRET — Webhook signing secret
STRIPE_PRICE_ID — Price ID for $5/month plan
PAYMENTS_URL — URL for payments service (api-gateway config)
```

### Downstream Impact for Next Prompts (updated after Prompt 17)
- **Prompt 18 (Stripe Connect / Creator Payouts)**: Will likely extend the payments service with Connect Express onboarding routes. The `creator_stripe_accounts` table and `CreatorStripeRepository` already exist from Prompt 2.
- **NavBar/Sidebar settings link**: No link to `/dashboard/settings` has been added to the navigation yet. A gear icon or "Settings" item should be added to the sidebar/bottom nav.
- **`/profile` route**: Still referenced in the Sidebar but not implemented.
- **Dead code from earlier prompts remains**: `services/ai-orchestrator/src/pipeline/music.ts`, `services/ai-orchestrator/src/pipeline/multiplayer.ts`, `services/ai-orchestrator/src/prompts/multiplayer.ts`, `services/ai-orchestrator/src/prompts/concept.ts`.

### Pipeline Phase Order (Unchanged from Prompt 14)
```
1. Concept Architect → GDD
2. Technical Planner → TechnicalSpec
3. Code Generator → full HTML
4. Asset Generation (SVG)
5. Validation + Debug Loop (max 5 iterations)
6. Polish Pass
7. Audio Generation + Thumbnail Generation (PARALLEL)
8. Multiplayer Injection (conditional)
9. Final Build → Deploy
```

---

## Completed: Prompt 17 — Ad Integration & Revenue Attribution

### What Changed

#### Files Created
- `apps/web/src/components/ui/AdSlot.tsx` — unified ad slot component supporting `placeholder`, `adinplay`, and `adsense` providers
- `services/payments/src/revenue/tracker.ts` — ad impression tracker with estimated CPM and attribution split logic
- `services/payments/src/revenue/attribution.ts` — monthly revenue attribution and reconciliation service
- `services/payments/src/routes/earnings.ts` — endpoints for `POST /payments/ad-impression` and `GET /payments/earnings`

#### Files Modified
- `apps/web/src/pages/Home.tsx` — added leaderboard ad between "Trending" and "Just Created" sections, medium rectangle at bottom
- `apps/web/src/pages/Explore.tsx` — added inline rectangle ad every 8 game cards in the search results grid
- `apps/web/src/pages/Feed.tsx` — added pre-game interstitial ad overlay every 3rd game transition (auto-dismisses after 3s with skip button)
- `apps/web/src/pages/Game.tsx` — added medium rectangle ad below game info panel
- `services/payments/src/app.ts` — wired up earningsRouter, adTracker, and revenueAttribution
- `services/api-gateway/src/proxy.ts` — added proxy routes for `POST /payments/ad-impression` (no auth, for anonymous tracking) and `GET /payments/earnings` (requires auth)
- `apps/web/.env.example` — added `VITE_AD_PROVIDER`, `VITE_ADSENSE_CLIENT_ID`, `VITE_ADSENSE_SLOT_ID`

### Key Architecture Decisions (Prompt 17)
- **Placeholder-first ads**: All ad slots render colored placeholder divs by default (`VITE_AD_PROVIDER=placeholder`). This lets the full layout be built and tested before ad network approval. Swapping to real ads requires only changing the env var to `adinplay` or `adsense`.
- **IntersectionObserver for impression tracking**: The `AdSlot` component uses an `IntersectionObserver` (threshold: 0.5) to fire `onImpression` callbacks only when the ad is actually visible. Each slot tracks at most one impression per mount.
- **Revenue attribution split**: Platform inventory (ads on store pages, feed transitions, no `gameId`) → 100% platform. Game inventory (ads on game page, in-game, with `gameId`) → 50/50 creator/platform. This is hardcoded in the tracker and attribution services.
- **Estimated CPM model**: Each ad format has a preset estimated CPM (e.g. leaderboard=$2.50, rewarded-video=$15.00). Revenue is estimated at impression time and reconciled monthly via `reconcileMonthlyRevenue()`.
- **Feed ad frequency**: The feed shows an interstitial ad every 3rd navigation (configurable via `AD_EVERY_N` constant). The ad auto-dismisses after 3s but has a "Skip" button. Only forward (goNext) transitions count; backward navigation doesn't trigger ads.
- **Ad impression endpoint is unauthenticated**: `POST /payments/ad-impression` doesn't require auth so anonymous users' impressions can be tracked. The earnings query endpoint requires auth.
- **Responsive ad placement on Home**: Desktop shows leaderboard (728x90), mobile shows mobile-banner (320x50) using Tailwind responsive classes (`hidden sm:block` / `sm:hidden`).

### Ad Placement Summary
| Page | Format | Location | Auth Required |
|------|--------|----------|---------------|
| Home | leaderboard / mobile-banner | Between "Trending" and "Just Created" sections | No |
| Home | rectangle | Bottom of page | No |
| Explore | rectangle | Every 8th card in results grid (full-width row) | No |
| Feed | interstitial | Full-screen overlay every 3rd transition | No |
| Game | rectangle | Below game info panel | No |

### API Endpoints Added
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/payments/ad-impression` | No | Records ad impression with provider, format, optional gameId/creatorId |
| GET | `/payments/earnings?creatorId=X&month=YYYY-MM` | Yes | Returns creator earnings summary or all-time history |

### Env Vars Added
```
VITE_AD_PROVIDER — placeholder | adinplay | adsense (default: placeholder)
VITE_ADSENSE_CLIENT_ID — Google AdSense client ID (when using adsense provider)
VITE_ADSENSE_SLOT_ID — Google AdSense slot ID (when using adsense provider)
```

### Downstream Impact for Next Prompts
- **Creator Dashboard earnings display**: A frontend earnings/revenue page needs to be built to call `GET /payments/earnings` and display the data. Currently no UI for viewing earnings exists.
- **Real ad SDK integration**: When AdinPlay/Venatus is approved, the `AdinPlaySlot` component in `AdSlot.tsx` needs the SDK script tag added to `index.html` and the slot IDs configured. The placeholder architecture makes this a drop-in replacement.
- **Ad frequency session cap**: The spec says "no interstitial more than once per session on mobile". Currently the Feed uses a simple counter (every 3rd transition). A session-level cap using sessionStorage should be added if mobile interstitials are used outside the feed.
- **Rewarded video opt-in**: The `rewarded-video` ad format is defined but not yet placed anywhere. Games that support it should use the SDK bridge to offer opt-in rewarded ads (e.g., extra lives, power-ups).

---

## Completed: Prompt 18 — Stripe Connect Creator Payouts

### What Changed

**`services/payments/src/stripe/connect.ts`** — New file: Stripe Connect Express integration
- `createConnectAccount(creatorId, email)` — creates a Stripe Connect Express account with `transfers` capability and stores `creatorId` in metadata
- `createAccountLink(accountId, refreshUrl, returnUrl)` — generates onboarding link for Stripe-hosted KYC/identity flow
- `getAccountStatus(accountId)` — retrieves `detailsSubmitted`, `payoutsEnabled`, `chargesEnabled` from the Stripe account
- `createTransfer(amount, currency, destinationAccountId, metadata)` — creates a transfer to the creator's Express account (amount converted to cents internally)
- `getAccountBalance(accountId)` — retrieves available and pending balance for a connected account

**`services/payments/src/revenue/calculator.ts`** — New file: payout eligibility logic
- `createPayoutCalculator(earningsRepo, stripeRepo)` factory returning:
  - `calculateCreatorBalance(creatorId)` — delegates to `earningsRepo.getTotalBalance()` (sums confirmed unpaid `creator_share`)
  - `canRequestPayout(creatorId)` — checks balance >= threshold ($60 default), Stripe account exists, onboarding is complete; returns `{ eligible, reason?, balance }`

**`services/payments/src/revenue/payout-trigger.ts`** — New file: payout execution
- `createPayoutTrigger(db, stripeRepo, earningsRepo, calculator)` factory returning:
  - `requestPayout(creatorId)` — validates eligibility via calculator, creates Stripe transfer, marks all `confirmed` earnings as `paid`, resets `payoutBalance` and increments `totalPaidOut` on `creator_stripe_accounts`
  - `getEligibleCreators()` — queries all creators with confirmed earnings >= threshold and completed Stripe onboarding

**`services/payments/src/routes/payout.ts`** — New file: payout route handlers
- `POST /payments/connect-stripe` — initiates Stripe Connect onboarding (creates Express account if needed, returns onboarding URL)
- `GET /payments/connect-status` — returns whether creator's Stripe account is connected and onboarding complete (also syncs `onboardingComplete` flag if Stripe says details are submitted)
- `POST /payments/request-payout` — initiates payout transfer (validates eligibility, returns transferId + amount or error)
- `GET /payments/balance` — returns current payout balance and eligibility status

#### Files Modified

**`services/payments/src/stripe/webhooks.ts`** — Added Connect event handling
- `createWebhookHandler` now accepts optional `stripeRepo` parameter
- New event handlers: `account.updated` (marks onboarding complete), `transfer.created` (logs success), `transfer.reversed` (logs reversal for manual intervention)
- Backward compatible — `stripeRepo` is optional; old callers don't break

**`services/payments/src/config.ts`** — Added payout configuration
- `stripe.connectSecret` (env: `STRIPE_CONNECT_SECRET`)
- `payout.minimumThreshold` (env: `PAYOUT_MINIMUM_THRESHOLD`, default: 60)
- `payout.currency` — hardcoded `'usd'` for v2

**`services/payments/src/app.ts`** — Wired up payout system
- Added imports for `createCreatorStripeRepository`, `payoutRouter`, `createPayoutCalculator`, `createPayoutTrigger`
- Instantiated `stripeRepo`, `payoutCalculator`, `payoutTriggerInstance`
- Mounted `payoutRouter` on the Express app
- Passes `stripeRepo` to `createWebhookHandler` for Connect event handling

**`services/api-gateway/src/proxy.ts`** — Added proxy routes for payout endpoints
- `POST /payments/connect-stripe` (requireAuth)
- `GET /payments/connect-status` (requireAuth)
- `POST /payments/request-payout` (requireAuth)
- `GET /payments/balance` (requireAuth)

**`services/payments/.env.example`** — Added `STRIPE_CONNECT_SECRET` and `PAYOUT_MINIMUM_THRESHOLD`

### Key Architecture Decisions (Prompt 18)
- **Stripe Connect Express**: Express accounts are used so Stripe handles KYC, identity verification, and tax forms. The platform never touches sensitive financial data.
- **Transfer API for payouts**: Uses `stripe.transfers.create()` which moves funds from the platform's Stripe balance to the connected Express account. Amount is passed in dollars and converted to cents internally.
- **$60 minimum threshold**: Configurable via `PAYOUT_MINIMUM_THRESHOLD` env var. Eligibility check requires: (1) confirmed balance >= threshold, (2) Stripe account exists, (3) onboarding complete.
- **Earnings status lifecycle**: `pending` → `confirmed` (after monthly reconciliation via `reconcileMonthlyRevenue`) → `paid` (after successful payout transfer). Only `confirmed` earnings count toward payout balance.
- **Transfer fees borne by platform**: Stripe transfer fees are not deducted from the creator's balance. The platform absorbs this cost.
- **Dual onboarding sync**: Onboarding completion is tracked both via the `account.updated` webhook (primary) and via `GET /payments/connect-status` (fallback sync when creator returns to the app).
- **Webhook handler backward compatible**: The `stripeRepo` parameter is optional in `createWebhookHandler` so existing test setups and callers are unaffected.

### Payout Flow Summary
1. Creator calls `POST /payments/connect-stripe` → gets onboarding URL → completes Stripe-hosted KYC
2. Webhook `account.updated` fires → `onboardingComplete` set to `true` in DB
3. Ad revenue accumulates → `reconcileMonthlyRevenue()` runs (cron/admin) → earnings status set to `confirmed`
4. Creator checks `GET /payments/balance` → sees balance + eligibility
5. Creator calls `POST /payments/request-payout` → transfer created → earnings marked `paid` → balance reset

### API Endpoints Added
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/payments/connect-stripe` | Yes | Initiates Stripe Connect onboarding, returns onboarding URL |
| GET | `/payments/connect-status` | Yes | Returns connected/onboarding status |
| POST | `/payments/request-payout` | Yes | Initiates payout transfer (requires balance >= $60 + connected account) |
| GET | `/payments/balance` | Yes | Returns current payout balance and eligibility |

### Env Vars Added
```
STRIPE_CONNECT_SECRET — Stripe Connect secret key (may be same as STRIPE_SECRET_KEY)
PAYOUT_MINIMUM_THRESHOLD — Minimum balance for payout (default: 60, in USD)
```

### Downstream Impact for Next Prompts
- **Creator Dashboard payout UI**: A frontend settings/payout page needs to call `POST /payments/connect-stripe` (onboarding), `GET /payments/connect-status` (show status), `GET /payments/balance` (show balance + eligibility), and `POST /payments/request-payout` (request payout button). Currently `pages/Dashboard/Settings.tsx` exists but may need these integrations.
- **Payout notifications**: `getEligibleCreators()` is implemented but no notification mechanism (email, in-app) is wired. A cron job should call this monthly and notify eligible creators.
- **Payout history**: Currently payout transfers are logged but there's no dedicated payout history table or endpoint. A `GET /payments/payout-history` could be added that queries `creator_earnings` where `status = 'paid'`.
- **Multi-currency**: Payouts are USD-only in v2. Expanding to other currencies would require per-creator currency preference and multi-currency Stripe Connect setup.
- **Admin dashboard**: No admin endpoints exist for manual payout triggering or reconciliation. An admin API with `POST /admin/reconcile-revenue?month=YYYY-MM` and `POST /admin/trigger-payouts` would be useful for operations.

---

## Completed: Prompt 19 — Creator Dashboard & Profile Pages

### What Changed

**`apps/web/src/App.tsx`** — Routing overhaul for dashboard section
- Added lazy imports for `Creator`, `DashboardLayout`, `Earnings`
- Added `Navigate` import from react-router-dom
- `/dashboard` route wraps `DashboardLayout` as parent with nested child routes:
  - `/dashboard` (index) → redirects to `/dashboard/games`
  - `/dashboard/games` → `MyGames`
  - `/dashboard/earnings` → `Earnings`
  - `/dashboard/settings` → `Settings`
- `/creator/:userId` → public `Creator` profile page
- `/my-games` → redirects to `/dashboard/games` for backward compatibility
- Removed standalone `/my-games` and `/dashboard/settings` routes (now nested under dashboard)

**`apps/web/src/pages/Dashboard/DashboardLayout.tsx`** — NEW: Shared dashboard layout
- Sidebar sub-navigation on desktop (sticky, `w-56`) with links to Games, Earnings, Settings
- Tab bar on mobile (horizontal scrollable strip) with same three links
- Uses `NavLink` with `isActive` styling via `sloppy-primary/15` highlight
- Renders child routes via `<Outlet />`
- Consistent dark theme: `bg-sloppy-surface`, `border-sloppy-border`, `text-sloppy-text`

**`apps/web/src/pages/Creator.tsx`** — NEW: Public creator profile
- Route: `/creator/:userId`
- Fetches profile data from `GET /auth/profile/:userId` and games from `GET /games/creator/:creatorId`
- Shows avatar initial, display name, join date
- Stats: game count, total play count
- Grid of published games using existing `GameCard` component with favourite/unfavourite support
- "Edit Profile" button visible when viewing own profile (links to `/dashboard/settings`)
- Error state for missing creators

**`apps/web/src/pages/Dashboard/Earnings.tsx`** — NEW: Creator earnings dashboard
- Route: `/dashboard/earnings` (requires auth + active subscription)
- Balance card: large current balance display, total earned, total paid out
- Withdraw button:
  - If no Stripe account → calls `paymentsApi.connectStripe()` to start onboarding
  - If Stripe connected → shows payout confirmation modal
  - Disabled when balance < $60 threshold
- Monthly earnings table: period, gross revenue, creator share (50%), status badges
- Payout history table: date, amount, status
- Auth gate for unauthenticated users
- Subscription gate for non-subscribers
- All data fetched via `paymentsApi` (balance, earnings, connect status, payout history)

**`apps/web/src/pages/Dashboard/Settings.tsx`** — Updated theme tokens
- Migrated from light theme (`text-sloppy-dark`, `bg-white`, `border-sloppy-dark/10`) to dark theme (`text-sloppy-text`, `bg-sloppy-surface`, `border-sloppy-border`) for visual consistency within the DashboardLayout
- Removed excessive top padding (`pt-8 md:pt-16` → just `max-w-2xl`)
- Functional logic unchanged

**`apps/web/src/pages/MyGames.tsx`** — Enhanced with new features
- Now renders inside DashboardLayout at `/dashboard/games`
- Added thumbnail display: shows `thumbnailSmUrl` or `thumbnailUrl` with aspect-video container
- Added per-game stats: play count, favourite count, last played date
- Added "Thumbnail" regeneration button on each game card
- Added "Publish" quick-action for draft games (inline on card)
- Migrated to dark theme tokens (was using `text-sloppy-dark`, now uses `text-sloppy-text`)
- Filter tabs restyled: from `bg-sloppy-pink` to `bg-sloppy-primary/15` with border

**`apps/web/src/lib/api.ts`** — New API namespaces and types
- Added `paymentsApi` namespace:
  - `getBalance()` → GET /payments/balance
  - `requestPayout()` → POST /payments/request-payout
  - `connectStripe()` → POST /payments/connect-stripe
  - `getConnectStatus()` → GET /payments/connect-status
  - `getEarnings(period?)` → GET /payments/earnings
  - `getPayoutHistory()` → GET /payments/payouts
- Added `usersApi` namespace:
  - `getProfile(userId)` → GET /auth/profile/:userId
- Added `creatorGamesApi` namespace:
  - `getByCreator(creatorId, opts)` → GET /games/creator/:creatorId
- Added TypeScript interfaces: `EarningsRecord`, `ConnectStatus`, `PayoutRecord`, `CreatorProfile`

**`apps/web/src/components/layout/Sidebar.tsx`** — Updated navigation
- Changed "Profile" link (`/profile`) to "Dashboard" link (`/dashboard`)
- Updated active state detection: uses `startsWith()` for prefix matching (so `/dashboard/games`, `/dashboard/earnings`, etc. all highlight the Dashboard nav item)

**`services/auth/src/app.ts`** — Registered profile route
- Added `createGameRepository` import from `@sloppy/db`
- Created `gameRepo` instance
- Mounted `profileRouter(userRepo, gameRepo)` at `/auth/profile`
- Profile endpoint is public (no `authenticateRequest` middleware required)

**`services/auth/src/routes/profile.ts`** — NEW: Public profile endpoint
- `GET /auth/profile/:userId` — returns `{ id, displayName, createdAt, gameCount, totalPlayCount }`
- Fetches user from `userRepo.findById()`, then all creator games from `gameRepo.findByCreator()`
- Filters to published games only, aggregates play counts
- Returns 404 if user not found, 400 if no userId param

**`services/game-builder/src/routes/search.ts`** — Added creator games endpoint
- `GET /games/creator/:creatorId` — public endpoint returning paginated published games by a creator
- Uses existing `gameRepo.findByCreator()` with post-filter for `status === 'published'`
- Supports `cursor` and `limit` query params

### Route Map (after Prompt 19)

| Path | Component | Auth | Description |
|------|-----------|------|-------------|
| `/` | Home | No | Store homepage |
| `/feed` | Feed | No | TikTok-style full-screen feed |
| `/explore` | Explore | No | Browse/search games |
| `/category/:genre` | Category | No | Genre-filtered game list |
| `/game/:id` | Game | No | Individual game player |
| `/create` | Create | Yes | Game creation wizard |
| `/favourites` | Favourites | Yes | User's favourited games |
| `/creator/:userId` | Creator | No | Public creator profile |
| `/dashboard` | DashboardLayout | Yes | Dashboard wrapper (redirects to /dashboard/games) |
| `/dashboard/games` | MyGames | Yes | Creator's own games with stats |
| `/dashboard/earnings` | Earnings | Yes+Sub | Revenue tracking + payout |
| `/dashboard/settings` | Settings | Yes | Subscription management |
| `/my-games` | (redirect) | — | Legacy redirect → /dashboard/games |

### API Endpoints Added

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/profile/:userId` | No | Public creator profile (name, join date, game count, total plays) |
| GET | `/games/creator/:creatorId` | No | Paginated published games by a creator |

### API Client Methods Added (Frontend)

| Namespace | Method | Backend Endpoint |
|-----------|--------|-----------------|
| `paymentsApi` | `getBalance()` | GET /payments/balance |
| `paymentsApi` | `requestPayout()` | POST /payments/request-payout |
| `paymentsApi` | `connectStripe()` | POST /payments/connect-stripe |
| `paymentsApi` | `getConnectStatus()` | GET /payments/connect-status |
| `paymentsApi` | `getEarnings(period?)` | GET /payments/earnings |
| `paymentsApi` | `getPayoutHistory()` | GET /payments/payouts |
| `usersApi` | `getProfile(userId)` | GET /auth/profile/:userId |
| `creatorGamesApi` | `getByCreator(creatorId)` | GET /games/creator/:creatorId |

**`services/api-gateway/src/proxy.ts`** — Added payout history proxy route
- Added `app.get('/payments/payouts', requireAuth, paymentsProxy)` for the payout history endpoint

### Backward Compatibility Notes (Prompt 19)
- `/my-games` route redirects to `/dashboard/games` — old bookmarks/links continue to work
- Settings page functionality unchanged, only visual tokens updated for dark theme consistency
- Profile endpoint is public — no auth required, safe for anonymous browsing
- `adsApi.getEarnings()` still exists alongside `paymentsApi.getEarnings()` — the former is a lower-level ad tracking call, the latter is the higher-level creator earnings view

### Downstream Impact for Next Prompts
- **Creator profile enrichment**: The profile page is basic (avatar initial, name, stats). Future work: profile editing, bio/avatar upload, social links.
- **Thumbnail regeneration**: The "Thumbnail" button on MyGames currently only calls `gamesApi.get()` as a placeholder. A proper `POST /games/:id/regenerate-thumbnail` endpoint should be created in game-builder to trigger the thumbnail pipeline.
- **Earnings chart visualization**: Monthly earnings are displayed as a table. A bar chart using a lightweight chart library (e.g., recharts) would improve the UX.
- **Payout history endpoint**: `paymentsApi.getPayoutHistory()` calls `GET /payments/payouts` which may not exist yet — needs to be created in the payments service.
- **Dashboard notifications**: No notification system for payout eligibility, subscription expiry warnings, or game performance milestones.

---

## Completed: Prompt 20 — Game Population Pipeline

### What Changed

**`services/game-population/`** — NEW local CLI tool for mass-generating games

This is a **local-only** Node.js CLI tool (not deployed to Cloud Run) that brainstorms diverse game concepts via an LLM, submits them through the existing generation pipeline, applies quality filters, and auto-publishes passing games.

**`services/game-population/package.json`** — Package definition
- Name: `@sloppy/game-population`
- Dependencies: `commander` (CLI framework), `chalk` (colored output), `ora` (spinners), `eventsource` (SSE client for monitoring generation)
- Dev dependencies: `tsx`, `typescript`
- Entry script: `pnpm --filter=game-population populate <args>`

**`services/game-population/tsconfig.json`** — Extends root tsconfig

**`services/game-population/src/types.ts`** — Local type definitions
- Re-exports `GameGenre` and `GameEngine` unions matching `@sloppy/runtime-sdk`
- Exports `ALL_2D_GENRES`, `ALL_3D_GENRES`, `ALL_GENRES` arrays for filtering

**`services/game-population/src/brainstorm-agent.ts`** — LLM-powered concept generator
- `brainstormConcepts(options)` generates diverse game concepts in batches of 10
- System prompt enforces valid genre tags, engine selection, and complexity limits (simple/medium only)
- Diversity enforcement: each batch sees the last 20 titles to avoid repeats
- Infinite-loop guard: caps batch attempts at 3× expected, breaks early when batches yield zero usable concepts
- Supports OpenAI and Anthropic providers (configurable via env vars)
- Auto-corrects engine to match genre dimension (2d → phaser3, 3d → threejs)
- Validates each concept: title length, genre validity, engine validity
- Retries once on JSON parse failures
- Exported `GameConcept` interface: `title`, `tagline`, `genre`, `engine`, `coreMechanic`, `uniqueTwist`, `visualStyle`, `estimatedComplexity`

**`services/game-population/src/batch-runner.ts`** — Pipeline submission runner
- `runBatch(concepts, options)` queues and executes generations
- Submits each concept to `POST /generate` via the API gateway
- Constructs a natural-language prompt from the concept fields
- Monitors generation via SSE (`GET /generate/:sessionId/status`)
- Concurrency control via semaphore (default max 2 in-flight)
- Rate limit handling: exponential backoff (1s → 120s max) on 429 responses
- Resume capability: stores completed game IDs and titles in `.resume-state.json`
- Configurable delay between submissions (default 20s)
- Reports per-game status: `success` / `failed` / `skipped`

**`services/game-population/src/quality-filter.ts`** — Post-generation quality gate
- `runQualityFilter(gameIds, options)` checks each generated game
- Check 1: Has a stored bundle (storagePath exists)
- Check 2: Has a thumbnail (screenshots were captured during validation)
- Check 3: Bundle size ≥ 5KB
- Check 4: Title is unique (searches existing games for exact match)
- Passing games are auto-published via `POST /games/:id/publish`
- Failing games are marked `needs_review` (not deleted)

**`services/game-population/src/cli.ts`** — Commander-based CLI entry point
- `populate` command (set as `isDefault: true` + hardcoded in npm script) with options:
  - `--count <n>` (required) — number of games to generate
  - `--genres <filter>` — `all`, `2d`, `3d`, or comma-separated genre tags
  - `--delay-ms <ms>` — delay between submissions (default 20000)
  - `--api-url <url>` — API base URL (default `http://localhost:3001`)
  - `--dry-run` — generate concepts only, print to stdout with genre distribution chart
  - `--resume` — skip already-generated games from previous interrupted run
  - `--max-concurrent <n>` — max parallel generations (default 2)
  - `--skip-quality` — bypass quality filter step
- Auth via `POPULATION_AUTH_TOKEN` or `FIREBASE_ID_TOKEN` env var
- LLM config via `LLM_PROVIDER`, `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` env vars
- Outputs colored summary with success/failure counts and duration

**`services/game-population/src/logger.ts`** — File-based logging
- Creates timestamped log files in `services/game-population/logs/`
- Format: `population-YYYY-MM-DD-HHmmss.log`
- Logs concept generation, pipeline submission, completion/failure, quality filter results

**`services/game-population/config/seed-concepts.json`** — 20 hand-curated starting concepts
- Covers all major genres: platformer, endless-runner, arcade, puzzle, shooter, tower-defense, cards, rhythm, idle, topdown, custom (2D) and racing, platformer, puzzle, flight, FPS, third-person (3D)
- Mix of simple and medium complexity
- Used as diversity seed — brainstorm agent avoids repeating these titles

**`services/game-population/config/genre-weights.json`** — Genre distribution weights
- Sums to 1.0 across all 18 genres
- Heavier weight on proven genres: 2d-arcade (15%), 2d-platformer (12%), 2d-puzzle (10%)
- Lower weight on experimental: 3d-custom (1%), 3d-flight (2%), 2d-rhythm (3%)

**`services/game-population/.gitignore`** — Ignores log files, resume state, dist, node_modules

### How to Use

```bash
# Dry run — generate concepts, print to stdout (no API calls)
pnpm --filter=game-population populate --count=50 --dry-run

# Populate 100 games across all genres
OPENAI_API_KEY=sk-... POPULATION_AUTH_TOKEN=... \
  pnpm --filter=game-population populate --count=100

# Populate only 3D games with longer delay
OPENAI_API_KEY=sk-... POPULATION_AUTH_TOKEN=... \
  pnpm --filter=game-population populate --count=20 --genres=3d --delay-ms=30000

# Resume from a failed run
OPENAI_API_KEY=sk-... POPULATION_AUTH_TOKEN=... \
  pnpm --filter=game-population populate --count=100 --resume
```

### Key Architecture Decisions (Prompt 20)
- **Local-only tool**: Not deployed to Cloud Run. Runs on developer machines.
- **No direct database access**: All operations go through the API gateway (same auth flow as the frontend)
- **Auth requirement**: Population user needs a valid Firebase auth token — set via env var
- **LLM for brainstorming**: Uses the same LLM provider config as the orchestrator but runs separately (dedicated API key recommended to avoid rate limit interference)
- **SSE monitoring**: Uses `eventsource` package to listen for generation completion events, same protocol as the frontend
- **Estimated cost**: ~$0.10-0.20 per game (LLM tokens + thumbnail + audio). 200 games ≈ $20-40.

### Workspace Integration
- `pnpm-workspace.yaml` already includes `services/*` — no modification needed
- Package name: `@sloppy/game-population`

### Files Created
- `services/game-population/package.json`
- `services/game-population/tsconfig.json`
- `services/game-population/.gitignore`
- `services/game-population/src/types.ts`
- `services/game-population/src/brainstorm-agent.ts`
- `services/game-population/src/batch-runner.ts`
- `services/game-population/src/quality-filter.ts`
- `services/game-population/src/cli.ts`
- `services/game-population/src/logger.ts`
- `services/game-population/config/seed-concepts.json`
- `services/game-population/config/genre-weights.json`
- `services/game-population/logs/.gitkeep`

### Files Modified
- None (pnpm-workspace.yaml already has `services/*`)

### Backward Compatibility Notes (Prompt 20)
- No existing code is modified — this is a purely additive local tool
- All API interactions go through the existing gateway with standard auth
- Brainstormed concepts use valid `GameGenre` and `GameEngine` types from the SDK
- Quality filter uses existing publish endpoint semantics

### Downstream Impact for Next Prompts
- **Auth for population**: Currently requires a manually obtained Firebase ID token. A service account or admin API key flow would simplify batch operations.
- **Admin panel**: A web-based admin UI for managing population runs, reviewing `needs_review` games, and monitoring quality metrics would be useful at scale.
- **Analytics**: Population runs generate games but don't track population-specific analytics (genre distribution of published vs failed, common failure modes). This data would help tune the brainstorm agent and genre weights.
- **Cost tracking**: The CLI doesn't track LLM token costs directly — those are logged by the orchestrator's `generation_logs` table. A summary report pulling from that table would be useful.
- **Game variety scoring**: Beyond title uniqueness, a semantic similarity check against existing games would prevent conceptually duplicate games with different titles.

---

## Completed: Prompt 21 — Enhanced Generation UX & Game Player Chrome

### What Changed

**`apps/web/src/stores/generation.ts`** — Full rewrite for v2 SSE events
- Now handles both v1 flat events and v2 rich `GenerationEvent` discriminated union (keyed by `type` field)
- New state fields: `iteration` (current `IterationInfo` with attempt/maxAttempts/error), `iterationHistory` (array of all iterations), `screenshots` (map of `GenerationGameState` → base64 string)
- v2 event handling: `phase` → updates current phase and clears iteration; `progress` → updates percent and message; `iteration` → pushes to iteration history and sets phase to `fixing`; `screenshot` → merges into screenshots map; `complete` → finalizes; `failed` → errors out
- `INITIAL_STATE` extracted as a constant for clean `reset()` semantics
- Absorbs `title`, `description`, `gameId` from any event that includes them (not just v1-style flat events)
- Backward compatible: v1 flat events (no `type` field) still handled via `handleV1Event()`

**`apps/web/src/pages/Create.tsx`** — Major upgrade to generation progress UI
- Replaced v1 5-phase display (`concept/code/assets/multiplayer/music`) with v2 9-phase pipeline: Designing → Planning → Building → Testing → Fixing (conditional) → Polishing → Sound → Thumbnail → Deploying
- Each phase has estimated seconds for time-remaining calculation
- `PhaseStep` component now shows "if needed" badge for conditional phases instead of "optional"
- New `IterationCounter` component: shows during `fixing` phase with progress dots, current error being fixed (truncated to 120 chars), scrollable history of previous attempts, encouraging copy ("Perfecting your game...")
- New `ScreenshotGrid` component: 2×2 grid (intro/playing/paused/gameover) with fade-in animation on each screenshot, only renders when at least one screenshot exists
- Game preview section now uses `GamePlayerShell` component instead of raw iframe — provides proper scaling, loading/error states, and consistent player experience
- Added `GameControlBar` below game preview with Start/Pause/Resume/Restart/Mute/Fullscreen controls
- Added `GameStateIndicator` badge in preview header next to game title (shows IDLE/INTRO/PLAYING/PAUSED/GAME OVER)
- Removed standalone Fullscreen button from action bar (now in control bar)
- Uses `useGameBridge` hook for game state tracking in the preview section

**`apps/web/src/components/GamePlayer/GameControlBar.tsx`** — NEW
- Control bar with Start, Pause/Resume, Restart, Mute/Unmute, Fullscreen buttons
- Uses `useGameBridge` hook to track game state and send postMessage commands
- Buttons contextually show/hide: Start shown when idle/intro/gameover, Pause shown when playing, Resume shown when paused
- Disabled state support for when game is loading or in error
- Responsive: button labels hidden on mobile (icons only via `hidden sm:inline`)
- SVG icon components for all controls (Play, Pause, Restart, Volume, Mute, Fullscreen)
- Styled with sloppy design tokens: `rounded-wobbly`, `bg-sloppy-surface`, borders, hover states

**`apps/web/src/components/GamePlayer/GameStateIndicator.tsx`** — NEW
- Badge component showing current game state with color coding
- States: IDLE (neutral), INTRO (secondary), PLAYING (primary, with pulsing dot), PAUSED (accent), GAME OVER (pink)
- AnimatePresence transitions between states with scale/opacity animation

### Key Architecture Decisions (Prompt 21)
- **Dual event handling**: The generation store handles both v1 and v2 SSE event formats by checking for the `type` field. This ensures backward compatibility during the transition period.
- **Screenshot memory management**: Screenshots are stored as base64 strings in Zustand state. Per the spec, components should display and release these — the store `reset()` clears them. For long generation sessions, this prevents memory accumulation.
- **GamePlayerShell reuse**: The preview section now uses the same `GamePlayerShell` component used in the Game page and Feed, providing consistent scaling and error handling. The `iframeRef` is passed through for `GameControlBar` to send postMessage commands.
- **Separate useGameBridge instances**: `GameControlBar` instantiates its own `useGameBridge`, and the Create page also instantiates one for the `GameStateIndicator`. Since both listen to the same postMessage events from the iframe, they stay in sync naturally.

### Component Hierarchy (Create Page, Done State)
```
Create
├── GameStateIndicator (in header, next to title)
├── GamePlayerShell (replaces raw iframe)
│   └── iframe (with iframeRef)
├── GameControlBar (below player)
│   └── useGameBridge (sends commands to iframe)
└── RefinementPanel (optional, side panel)
```

### Files Modified
- `apps/web/src/stores/generation.ts`
- `apps/web/src/pages/Create.tsx`

### Files Created
- `apps/web/src/components/GamePlayer/GameControlBar.tsx`
- `apps/web/src/components/GamePlayer/GameStateIndicator.tsx`

### Backward Compatibility Notes (Prompt 21)
- Generation store still handles v1-style flat SSE events — no breakage for v1 backend
- All new generation store fields (`iteration`, `iterationHistory`, `screenshots`) default to null/empty — existing code that only uses `status`, `phase`, `progress`, `message` continues to work
- `GameFeedItem` type doesn't include resolution/scaleMode fields — `GamePlayerShell` uses its own defaults (960×540, fit mode)
- The `GamePlayer/` directory is new — no conflicts with existing components

### Downstream Impact for Next Prompts
- **Game page integration**: The `GameControlBar` and `GameStateIndicator` should also be added to the individual Game page (`apps/web/src/pages/Game.tsx`) for a consistent player experience
- **Feed player controls**: The TikTok-style feed may want a minimal version of the control bar (just mute/unmute) overlaid on the game
- **Screenshot cleanup**: Currently screenshots persist in Zustand until `reset()`. If generation sessions become long, a TTL-based cleanup or explicit `clearScreenshots()` action may be needed
- **Resolution from API**: `GameFeedItem` doesn't expose `resolutionWidth`/`resolutionHeight`/`scaleMode` — when these are needed for proper scaling, the shared Game type and API mapper should be extended
- **Keyboard shortcuts**: The control bar doesn't bind keyboard shortcuts (Space for pause, R for restart). These would improve desktop UX but need to avoid conflicts with game input
