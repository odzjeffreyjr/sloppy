# Neon Drift — Iteration, Deployment & Asset Generation Handoff

## Overview

A complete Phaser 3 v2 SDK game called **Neon Drift** has been generated through the full multi-agent pipeline. This document contains everything needed to continue with iteration, asset generation, and production deployment.

**Game premise:** Lane-switching arcade dodger — the player navigates a neon ship through 5 lanes, dodging cascading obstacles, collecting bonus orbs, and building combo multipliers. Single-life, score-chasing gameplay with increasing speed.

---

## Current State

| Pipeline Phase | Status | Notes |
|---|---|---|
| Concept Architect (GDD) | ✅ Complete | Full Game Design Document |
| Technical Planner | ✅ Complete | Phaser 3 scene architecture |
| Code Generation | ✅ Complete | 25KB self-contained HTML, Phaser 3.80.1 CDN |
| Static Validation | ✅ Passed | All 11 v2 methods, 0 forbidden patterns, config schema valid |
| Debug/Fix Loop | ✅ Skipped | Passed first-try validation |
| Polish Pass | ✅ Integrated | Particles, tweens, camera effects built into code gen |
| Audio (ZzFX) | ✅ Integrated | ZzFX engine + 14 SFX presets + AudioManager (10 play() calls) |
| Thumbnail Prompt | ✅ Generated | FLUX image prompt ready |
| Thumbnail Image | ❌ Not generated | Needs fal.ai FLUX call or manual generation |
| Runtime Validation (Puppeteer) | ❌ Not run | Needs game-builder service running |
| Production Deploy | ❌ Not deployed | Deploy script ready, needs Cloud SQL proxy |

---

## Game Files (all paths relative to repo root)

### Core Game Bundle
- **`scripts/games/neon-drift/index.html`** — Complete self-contained Phaser 3 game (THE deployable artifact)
- **`scripts/games/neon-drift/config.json`** — v2 config schema (engine: phaser3, genre: 2d-arcade)

### Pipeline Artifacts
- **`scripts/games/neon-drift/gdd.json`** — Game Design Document (Concept Architect output)
- **`scripts/games/neon-drift/tech-spec.json`** — Technical Specification (Technical Planner output)
- **`scripts/games/neon-drift/thumbnail-prompt.txt`** — FLUX image generation prompt (Thumbnail Prompter output)

### Deploy Script
- **`services/game-builder/src/scripts/deploy-game.ts`** — Deploys game to prod DB + GCS

---

## SDK v2 Contract Compliance Checklist

The game implements the full `SloppyGameV2` interface:

```
window.SloppyGame = {
  // Lifecycle
  init(container, config)    ✅  Creates Phaser.Game, boots BootScene, posts sloppy:game:ready
  destroy()                  ✅  Calls phaserGame.destroy(true), audioManager.onDestroy()
  
  // State Machine (idle → intro → playing → paused → gameover)
  start()                    ✅  Starts IntroScene, sets state to 'intro'
  pause()                    ✅  Launches PauseScene overlay, pauses GameScene
  resume()                   ✅  Stops PauseScene, resumes GameScene
  restart()                  ✅  Stops all scenes, starts fresh GameScene
  
  // Screen Rendering
  renderIntroScreen()        ✅  Starts IntroScene
  renderPauseScreen()        ✅  Launches PauseScene overlay
  renderGameOverScreen(s)    ✅  Starts GameOverScene with score
  renderHUD()                ✅  Delegates to GameScene.renderHUD()
  
  // State Introspection
  getState()                 ✅  Returns current state string
  getScore()                 ✅  Returns { score, level, timeElapsed, customData }
  
  // Static Properties
  metadata                   ✅  { title, genre, engine, supportsMultiplayer, controls, estimatedPlayTime }
  supportsMultiplayer        ✅  false
}
window.game = window.SloppyGame;  ✅
```

**Post-init messages:**
- `sloppy:game:ready` — sent after Phaser 'ready' event
- `sloppy:game:error` — sent on init failure with message + stack

**Runtime validation hook:**
- `window.triggerGameOver()` — forces game-over state for Puppeteer testing

---

## Audio Integration

**Engine:** ZzFX Micro (~900 bytes inline)
**Presets:** 14 SFX presets (jump, land, dash, shoot, hit, explosion, coin, powerUp, select, confirm, back, levelUp, gameOver, impact)
**Manager:** Sloppy AudioManager with pause/resume/destroy lifecycle + postMessage mute bridge

**Sound mapping in game:**
| Event | SFX Key | Location |
|---|---|---|
| Lane change | `dash` | `GameScene.moveLane()` |
| Obstacle hit | `hit` + `gameOver` | `GameScene.onHitObstacle()` |
| Orb collected | `coin` + `powerUp` | `GameScene.onCollectOrb()` |
| Combo milestone | `levelUp` | `GameScene.update()` (every 10 dodges) |
| Obstacle dodged | `select` | `GameScene.update()` |
| Start/Resume/Restart | `confirm` | IntroScene, PauseScene, GameOverScene |
| Pause | via `audioManager.onPause()` | `SloppyGame.pause()` |
| Resume | via `audioManager.onResume()` | `SloppyGame.resume()` |

---

## Phaser 3 Scene Architecture

```
BootScene → IntroScene → GameScene ⇄ PauseScene
                              ↓
                        GameOverScene
```

- **BootScene** — Generates 7 procedural textures via `Graphics.generateTexture()` (player, obstacle, orb, star, particle_cyan, particle_orange, particle_gold)
- **IntroScene** — Animated title, starfield, grid, control hints, high score display
- **GameScene** — Core gameplay: lane movement, obstacle spawning (physics group pool, maxSize 40), collision detection, scoring, combo system, HUD, difficulty scaling
- **PauseScene** — Overlay scene (launched on top of GameScene, pauses it)
- **GameOverScene** — Score display, high score comparison, dramatic tweens, particle celebration

---

## Game Improvement & Iteration Loop

This section describes exactly how to iterate on and improve the game file (`scripts/games/neon-drift/index.html`), following the same agent-based improvement pipeline used in production.

### Iteration Workflow

Each improvement cycle follows this order:

1. **Identify issues** — Play the game, review code, or note specific areas for improvement
2. **Apply changes** — Edit `scripts/games/neon-drift/index.html` directly
3. **Re-validate** — Run the validation checks below to confirm nothing broke
4. **Polish pass** — Apply visual/audio polish if needed
5. **Re-validate again** — Confirm polish didn't break the SDK contract

### Validation Script (run after every change)

After any edit to `index.html`, extract the inline JS and validate it against the full pipeline checks. Here is the manual validation checklist to run:

**Check 1: Required files exist**
- `scripts/games/neon-drift/index.html` — must exist
- `scripts/games/neon-drift/config.json` — must exist
- Inline `<script>` block extracts to `game.js` — must be non-empty

**Check 2: V2 method detection — all 11 must appear in the inline JS**
Search the inline `<script>` for these method patterns (as function declarations, object properties, or arrow functions):
```
init, destroy, start, pause, resume, restart,
renderIntroScreen, renderPauseScreen, renderGameOverScreen,
getState, getScore
```

**Check 3: Forbidden patterns — NONE of these can appear in the JS**
```
eval(
new Function(
fetch(
importScripts(
document.cookie
localStorage
sessionStorage
```

**Check 4: Config schema — `config.json` must have**
```json
{
  "title": "string (required)",
  "version": "string (required)",
  "engine": "phaser3",
  "genre": "2d-arcade",
  "supportsMultiplayer": false,
  "assets": [],
  "controls": [{ "key": "string", "action": "string" }]
}
```

**Check 5: SDK contract markers — all must appear in the JS**
```
window.SloppyGame
window.game
sloppy:game:ready
sloppy:game:error
metadata
supportsMultiplayer
```

**Check 6: Audio markers — all must appear in the JS**
```
zzfx (or ZzFX)
SFX
AudioManager (or createAudioManager)
onPause
onResume
onDestroy
audioManager.play (or zzfx(...SFX.) — at least 5 distinct play() calls
```

**Check 7: JS syntax — the extracted inline JS must parse without errors**
```bash
node -e "new Function(require('fs').readFileSync('game.js','utf8'))"
```

### What to Improve (Polish Agent Criteria)

When iterating, focus on these categories from the production Polish Agent (`services/ai-orchestrator/src/agents/polish-agent.ts`):

**Visual Quality:**
- Color palette: harmonious neon colors, better contrast, gradient backgrounds
- Particle effects: more particles on collisions, scoring, game-over, near-misses
- Screen transitions: fade between states, slide-in text animations
- HUD polish: smooth score counter (tween from old to new value), subtle text shadows

**Game Feel ("Juice"):**
- Screen shake on damage (adjustable intensity/duration)
- Camera flash on power-up collection or combo milestone
- Scale bounce on item collection (tween targets → scale → 1.2 → 1.0)
- Button hover effects with setScale tween on intro/pause/gameover buttons
- Easing functions: use `'Sine.easeInOut'`, `'Bounce.easeOut'`, `'Back.easeOut'` for tweens

**Phaser 3 Polish Techniques (use these APIs):**
```javascript
// Particle emitters on scoring events
this.add.particles(x, y, 'particle_key', { speed: 100, lifespan: 500, quantity: 20 });

// Tweens for smooth transitions
this.tweens.add({ targets: sprite, scaleX: 1.2, scaleY: 1.2, duration: 100, yoyo: true });

// Camera effects
this.cameras.main.shake(200, 0.01);       // damage
this.cameras.main.flash(100, 0, 255, 255); // power-up

// Smooth score counter
this.tweens.addCounter({ from: oldScore, to: newScore, duration: 300, onUpdate: (t) => scoreText.setText(Math.floor(t.getValue())) });

// Text shadow effects
text.setShadow(2, 2, '#00ccff', 8, true, true);

// Staggered spawn animations
this.time.addEvent({ delay: 100, callback: spawnNext, repeat: 5 });
```

**Intro Screen Improvements:**
- Animated title with pulsing glow or scale breath
- Scrolling starfield or grid background
- Control hints displayed with icons or key badges
- High score display if available
- Pulsing "Click to Start" prompt

**Game-Over Screen Improvements:**
- Dramatic entrance animation (scale from 0 → 1 with bounce ease)
- New high score celebration with particle burst + golden text
- Stats display (score, combo, obstacles dodged, time survived)
- Smooth fade-in of each element with staggered delays

### Audio Improvements

When improving audio, follow the Audio Generator rules (`services/ai-orchestrator/src/agents/audio-generator.ts`):

**Minimum required sounds:**
| Category | Preset Keys | When to play |
|---|---|---|
| Movement | `dash` | Lane change |
| Combat/Collision | `hit`, `impact` | Obstacle collision |
| Collection | `coin`, `powerUp` | Orb pickup |
| UI | `select`, `confirm`, `back` | Menu interactions |
| State Changes | `levelUp`, `gameOver` | Milestones, death |

**Adding new sounds:**
```javascript
// Play via AudioManager (respects pause/mute state):
audioManager.play('coin');

// Or play directly via ZzFX (ignores pause/mute):
zzfx(...SFX.coin);
```

**Available SFX preset keys:**
`jump`, `land`, `dash`, `shoot`, `hit`, `explosion`, `coin`, `powerUp`, `select`, `confirm`, `back`, `levelUp`, `gameOver`, `impact`

**Critical audio rules:**
- `audioManager.onPause()` MUST be called in `SloppyGame.pause()`
- `audioManager.onResume()` MUST be called in `SloppyGame.resume()`
- `audioManager.onDestroy()` MUST be called in `SloppyGame.destroy()`
- NEVER use `new Audio()` or raw `AudioContext` — only ZzFX and AudioManager
- NEVER auto-play audio on load — ZzFX handles AudioContext creation on first user interaction

### Debug/Fix Loop (if validation breaks)

If changes break validation, follow the Debug Fixer approach (`services/ai-orchestrator/src/agents/debug-fixer.ts`):

1. **Targeted fixes only** — do NOT rewrite the entire game, fix only the broken parts
2. **Preserve existing code** — keep all working game logic, visuals, and SDK contract intact
3. **Max 5 iterations** — if it can't be fixed in 5 targeted attempts, revert to last known good state
4. **Common fix patterns:**
   - Missing method → add with appropriate Phaser 3 implementation
   - State not transitioning → ensure internal `gameState` variable updates in every lifecycle method
   - Blank screen on pause/gameover → ensure overlay elements are created and made visible
   - Console errors → check variables declared before use, objects exist before property access
   - `sloppy:game:ready` not firing → add `postMessage` at end of `init()`
   - `window.game` not set → add `window.game = window.SloppyGame;` after assignment

### Game Design Constraints (do NOT change these)

These are locked by the GDD and must remain consistent across iterations:
- **Engine:** Phaser 3.80.1 via CDN (`https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js`)
- **Resolution:** 960x540 (16:9)
- **Lanes:** 5 lanes, 80px wide
- **Controls:** ArrowLeft/A (left), ArrowRight/D (right), Escape (pause)
- **Core mechanic:** Lane-switching dodge
- **Scoring:** +10 per dodge (x combo), +50 per orb, combo resets on death
- **Game over:** Single-life, one hit death
- **Visual style:** Dark cyberpunk, neon glow, deep navy (#0a0a1a) background
- **Scenes:** BootScene → IntroScene → GameScene ⇄ PauseScene → GameOverScene

### Specific Improvement Ideas for This Game

1. **Near-miss feedback** — When an obstacle passes within 10-20px of the player without hitting, show orange sparks and play `impact` sound, award bonus points
2. **Speed tier visual cues** — Background color shifts subtly at each speed tier (every 500 points). Grid line brightness increases
3. **Player invincibility flash** — Brief flashing effect after collecting a bonus orb
4. **Obstacle variety** — Different obstacle widths (narrow/wide), different colors at higher speeds
5. **Progressive starfield** — Stars move faster as game speed increases, parallax depth effect
6. **Combo streak particles** — Persistent particle trail behind player that grows with combo level
7. **Screen-wide flash** — Cyan flash across the screen at combo milestones (5x, 10x, 15x)
8. **Death animation** — Player explodes into particles on collision before game-over screen
9. **Background music beat** — Rhythmic ZzFX tone that increases tempo with speed
10. **Dynamic HUD** — Score text color shifts from white → cyan → gold as score climbs

---

## What Needs to Be Done Next

### 1. Thumbnail Image Generation

The FLUX prompt is ready at `scripts/games/neon-drift/thumbnail-prompt.txt`. Two options:

**Option A: Use the game-builder's thumbnail endpoint (if services are running locally)**
```bash
curl -X POST http://localhost:3003/thumbnails/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "<contents of thumbnail-prompt.txt>",
    "title": "Neon Drift",
    "genre": "2d-arcade",
    "model": "schnell"
  }'
```

**Option B: Use fal.ai directly**
The fal.ai FLUX key is in `.env.production` as `FAL_KEY`. Generate a 1280x720 image using the prompt, then resize to 600x338 for the small thumbnail.

### 2. Production Deployment

**Prerequisites:**
1. Cloud SQL Auth Proxy running:
   ```bash
   cloud-sql-proxy sloppy-app:us-east1:sloppy-pg-prod --port 5433
   ```
   If ADC isn't configured, first run:
   ```bash
   gcloud auth application-default login
   ```

2. gcloud authenticated with Application Default Credentials (for GCS uploads)

**Deploy command:**
```bash
DATABASE_URL=postgresql://sloppy:<DB_PASSWORD from .env.production>@localhost:5433/sloppy \
GCS_BUCKET=sloppy-game-bundles-prod \
npx tsx services/game-builder/src/scripts/deploy-game.ts \
  --dir scripts/games/neon-drift \
  --creator sloppy \
  --publish
```

**What the deploy script does:**
1. Creates a `sloppy` user in the DB (firebase_uid: `system_sloppy`, email: `sloppy@sloppygames.io`) if not exists
2. Creates a game record (id, title, slug, genre, engine, status)
3. Uploads 3 files to GCS: `index.html`, `config.json`, `game.js` (extracted inline)
4. Updates the game record with `storage_path`
5. Sets status to `published` (with `--publish` flag)

**After deploy, the game will be accessible at:**
- Bundle: `https://storage.googleapis.com/sloppy-game-bundles-prod/games/<gameId>/v1/index.html`
- Game page: `https://sloppygames.io/game/<slug>`

### 3. Optional: Thumbnail Upload After Deploy

If you generated a thumbnail image, upload it after the game is deployed:
```bash
# Get the game ID from deploy output, then:
gsutil cp thumbnail.webp gs://sloppy-game-bundles-prod/games/<gameId>/v1/thumbnail.webp
gsutil cp thumbnail_sm.webp gs://sloppy-game-bundles-prod/games/<gameId>/v1/thumbnail_sm.webp

# Update DB record with thumbnail URLs
# (or use the game-builder API: PUT /games/<gameId>/thumbnail)
```

---

## Key Reference Files in the Codebase

These files define the pipeline contracts, validation rules, and templates. Read them if you need to iterate on the game or create additional games.

### SDK & Validation
| File | Purpose |
|---|---|
| `packages/runtime-sdk/src/types.ts` | SloppyGameV2 interface, GameState, GameResult, GameMetadata |
| `packages/runtime-sdk/src/schema.ts` | config.json JSON Schema (Ajv validation) |
| `packages/runtime-sdk/src/validator.ts` | Source-level validation (forbidden patterns, v2 method checks) |
| `services/game-builder/src/validation/pipeline.ts` | Bundle validation (required files, methods, config, syntax, size) |
| `services/game-builder/src/validation/runtime-validator.ts` | Puppeteer runtime validation (state machine traversal) |

### Code Generation Templates
| File | Purpose |
|---|---|
| `services/ai-orchestrator/src/prompts/code.ts` | SDK v2 contract prompt, audio rules, chain-of-thought, output format |
| `services/ai-orchestrator/src/prompts/engines/phaser3.ts` | Phaser 3 scene architecture, CDN URL, quality rules, forbidden patterns |
| `services/ai-orchestrator/src/prompts/genres/arcade-2d.ts` | 2D arcade genre-specific mechanics, scoring, difficulty |
| `services/ai-orchestrator/src/prompts/screens/intro.ts` | Intro screen rendering template |
| `services/ai-orchestrator/src/prompts/screens/pause.ts` | Pause screen rendering template |
| `services/ai-orchestrator/src/prompts/screens/gameover.ts` | Game-over screen rendering template |
| `services/ai-orchestrator/src/prompts/screens/hud.ts` | HUD rendering template |

### Pipeline Agents
| File | Purpose |
|---|---|
| `services/ai-orchestrator/src/agents/concept-architect.ts` | GDD generation from user prompt |
| `services/ai-orchestrator/src/agents/technical-planner.ts` | Technical spec from GDD |
| `services/ai-orchestrator/src/pipeline/code.ts` | Code generation orchestration (retry logic, validation) |
| `services/ai-orchestrator/src/agents/debug-fixer.ts` | Fix validation failures (max 5 iterations) |
| `services/ai-orchestrator/src/agents/polish-agent.ts` | Visual polish pass (particles, tweens, juice) |
| `services/ai-orchestrator/src/agents/audio-generator.ts` | ZzFX audio injection |
| `services/ai-orchestrator/src/agents/thumbnail-prompter.ts` | FLUX image prompt generation |
| `services/ai-orchestrator/src/pipeline/orchestrator.ts` | Full pipeline orchestration (all phases) |

### Audio Sources (for injection)
| File | Purpose |
|---|---|
| `packages/runtime-sdk/src/v2/audio/zzfx-micro.ts` | ZzFX engine (~900 bytes inline) |
| `packages/runtime-sdk/src/v2/audio/zzfx-presets.ts` | 14 SFX presets (jump, hit, coin, gameOver, etc.) |
| `packages/runtime-sdk/src/v2/audio/audio-manager.ts` | AudioManager factory (pause/resume/mute bridge) |

### Database & Storage
| File | Purpose |
|---|---|
| `packages/db/src/schema.ts` | DB schema (users, games tables) |
| `packages/db/src/repositories/game.ts` | Game CRUD repository |
| `packages/db/src/repositories/user.ts` | User CRUD repository |
| `services/game-builder/src/storage/gcs.ts` | GCS upload/download (bundle, screenshots, thumbnails) |
| `services/game-builder/src/routes/games.ts` | POST /games, PUT /games/:id, publish endpoint |

### Deploy & Infrastructure
| File | Purpose |
|---|---|
| `services/game-builder/src/scripts/deploy-game.ts` | Direct-to-prod deploy script (DB + GCS) |
| `services/game-builder/src/scripts/delete-v1-games.ts` | Reference pattern for prod scripts |
| `.env.production` | Production env vars (DB password, API keys, GCS bucket) |
| `deploy.sh` | Full production deploy script (Docker, Terraform, Firebase) |

### Game Population (for mass generation)
| File | Purpose |
|---|---|
| `services/game-population/src/cli.ts` | `pnpm populate --count N` CLI |
| `services/game-population/src/batch-runner.ts` | Batch generation with concurrency, rate limiting, resume |

---

## Production Infrastructure Reference

From the last successful deploy:

| Resource | Value |
|---|---|
| API Gateway | `https://sloppy-api-gateway-prod-vfq6wegrmq-ue.a.run.app` |
| Game Builder | `https://sloppy-game-builder-prod-vfq6wegrmq-ue.a.run.app` (internal only) |
| AI Orchestrator | `https://sloppy-ai-orchestrator-prod-vfq6wegrmq-ue.a.run.app` (internal only) |
| GCS Bucket | `sloppy-game-bundles-prod` |
| CDN URL | `https://storage.googleapis.com/sloppy-game-bundles-prod` |
| DB Instance | `sloppy-app:us-east1:sloppy-pg-prod` |
| Firebase Hosting | `https://sloppygames.io` |
| DB User | `sloppy` |
| DB Name | `sloppy` |
| Cloud SQL Proxy Port | `5433` |

---

## Validation Results (for reference)

```
=== VALIDATION CHECKS ===

1. Required Files: index.html ✔, config.json ✔, game.js ✔ (25276 chars)
2. V2 Detection: ✔ v2 (engine=phaser3)
3. V2 Required Methods: init ✔, destroy ✔, start ✔, pause ✔, resume ✔,
   restart ✔, renderIntroScreen ✔, renderPauseScreen ✔,
   renderGameOverScreen ✔, getState ✔, getScore ✔
4. Forbidden Patterns: All clean (eval, new Function, fetch external,
   importScripts, document.cookie, localStorage, sessionStorage)
5. Config Schema: title ✔, version ✔, supportsMultiplayer ✔, assets ✔,
   genre (2d-arcade) ✔, engine (phaser3) ✔
6. JS Syntax: ✔ No errors
7. SDK Contract: window.SloppyGame ✔, window.game ✔,
   sloppy:game:ready ✔, sloppy:game:error ✔, metadata ✔, supportsMultiplayer ✔
8. Audio: ZzFX ✔, SFX presets ✔, AudioManager ✔,
   onPause ✔, onResume ✔, onDestroy ✔, 10 play() calls

Overall: ✔ PASSED
```

---

## Creating More Games

To create additional games following the same pipeline:

1. **Create a new directory** under `scripts/games/<game-name>/`
2. **Write the GDD** (`gdd.json`) following the `GameDesignDocument` interface in `services/ai-orchestrator/src/pipeline/types.ts`
3. **Write the tech spec** (`tech-spec.json`) following the `TechnicalSpec` interface
4. **Generate the HTML** following the code templates in `services/ai-orchestrator/src/prompts/code.ts`. Must use either `phaser3` or `threejs` engine (not canvas2d). Must implement all 11 v2 methods + metadata + supportsMultiplayer
5. **Validate** — run the validation script checking all 11 methods, forbidden patterns, config schema, JS syntax
6. **Add audio** — inject ZzFX micro engine, SFX presets, and AudioManager. Wire audioManager.onPause/onResume/onDestroy into lifecycle. Add audioManager.play() calls at all game events
7. **Generate thumbnail prompt** — follow the template in `services/ai-orchestrator/src/agents/thumbnail-prompter.ts`
8. **Deploy** — use the deploy script with `--creator sloppy --publish`

The game population CLI (`pnpm populate --count N`) can automate this through the prod AI orchestrator, but requires the services to be running and LLM API keys configured.

---

## Inline Artifacts (for context without file reads)

### GDD (Game Design Document)

```json
{
  "title": "Neon Drift",
  "logline": "Dodge cascading neon obstacles as your ship hurtles through a cyberpunk highway — survive as long as you can while chasing the highest score.",
  "engine": "phaser3",
  "genre": "2d-arcade",
  "visualStyle": "Dark cyberpunk with neon glow effects, grid-line highway, and particle trails. Color palette: deep navy background (#0a0a1a), cyan player (#00ccff), red/orange obstacles, golden collectibles.",
  "coreMechanic": "Lane-switching dodge — player taps left/right to snap between 5 lanes, avoiding procedurally spawned obstacles that scroll down at increasing speed. Collecting bonus orbs grants score multipliers.",
  "controls": [
    { "key": "ArrowLeft", "action": "Move one lane left" },
    { "key": "ArrowRight", "action": "Move one lane right" },
    { "key": "A", "action": "Move one lane left" },
    { "key": "D", "action": "Move one lane right" },
    { "key": "Escape", "action": "Pause game" }
  ],
  "progression": "Difficulty increases continuously — obstacle spawn rate increases, speed rises with score. Every 500 points the speed tier steps up. Every 10 dodged obstacles in a row increases the combo multiplier (max 5x). Bonus orbs appear every 15–25 seconds.",
  "scoring": "+10 base points per obstacle dodged (multiplied by combo). +50 for collecting a bonus orb. Combo multiplier resets on hit (if lives remain). High score persisted across sessions.",
  "gameOverCondition": "Player collides with an obstacle. Single-life — one hit and it's over.",
  "restartBehavior": "Full reset: score to 0, speed to initial, combo to 1x, clear all obstacles and particles, player back to center lane.",
  "screens": {
    "intro": "Neon title 'NEON DRIFT' with pulsing glow animation centered on screen. Below: logline text. Animated starfield/grid scrolling in background. Control hints at bottom. 'Click to Start' prompt pulsing. Phaser particle emitter for ambient floating particles.",
    "hud": "Top-left: Score counter with smooth tween to new value. Below score: current speed multiplier. If combo > 1x, show combo badge with golden glow. Top-right: High score in muted color.",
    "pause": "Semi-transparent dark overlay (alpha 0.7) over frozen game. 'PAUSED' text centered with neon glow. Current score displayed. 'Press ESC to Resume' prompt pulsing below.",
    "gameOver": "Dark overlay over final frame. 'GAME OVER' in red with dramatic scale-in tween. Final score large and cyan. If new high score: golden 'NEW HIGH SCORE!' with particle celebration. Speed and combo stats. 'Click to Play Again' prompt pulsing."
  },
  "multiplayer": { "suitable": false },
  "objects": [
    { "name": "PlayerShip", "description": "Cyan neon triangle/arrow shape in the center-bottom area. Smooth lerp movement between lanes. Particle trail behind it. Glow effect radius around it." },
    { "name": "Obstacle", "description": "Red/orange neon rectangles that fill most of a lane's width. Variable height (30-60px). Spawn at top of screen, scroll down. Glow border with inner accent line. Physics group with object pooling." },
    { "name": "BonusOrb", "description": "Golden pulsing circle collectible. Spawns rarely. Scale tween animation (breathing). Particle burst on collection. Worth +50 points." },
    { "name": "LaneGrid", "description": "Vertical cyan gridlines marking 5 lanes. Horizontal grid lines scrolling down for speed effect. Low opacity (0.08-0.1)." },
    { "name": "Starfield", "description": "Background layer of small white/blue dots scrolling down at variable speeds for parallax depth effect." },
    { "name": "Particles", "description": "Particle emitters for: player trail (cyan), obstacle explosion on near-miss (orange sparks), orb collection (golden burst), combo milestone (screen-wide cyan flash)." }
  ],
  "complexity": "medium",
  "estimatedGenerationTimeSeconds": 45
}
```

### Technical Specification

```json
{
  "fileStructure": "Single self-contained index.html with Phaser 3 CDN in <head> and all game code inline in <body><script>. Five Phaser Scenes: BootScene, IntroScene, GameScene, PauseScene, GameOverScene.",
  "engineVersion": "Phaser 3.80.1 via CDN",
  "modules": [
    { "name": "BootScene", "responsibility": "Generates procedural textures using Graphics + generateTexture. Transitions to IntroScene." },
    { "name": "IntroScene", "responsibility": "Title screen with animated title, scrolling grid, particle ambiance, control hints, pulsing start prompt." },
    { "name": "GameScene", "responsibility": "Core gameplay: lane movement, obstacle spawning, collision detection, scoring, combo tracking, difficulty scaling, HUD." },
    { "name": "PauseScene", "responsibility": "Overlay scene with dark backdrop, PAUSED text, resume prompt." },
    { "name": "GameOverScene", "responsibility": "Final score, high score comparison, stats, dramatic tweens, replay prompt." },
    { "name": "SloppyGameAdapter", "responsibility": "window.SloppyGame object implementing all 12 SDK v2 methods by delegating to Phaser scenes." }
  ],
  "sdkV2Mapping": {
    "init": "Create Phaser.Game with AUTO renderer, physics arcade. Register 5 scenes. On 'ready', post sloppy:game:ready. State = 'idle'.",
    "start": "scene.start('IntroScene'). State = 'intro'. IntroScene click → scene.start('GameScene'), state = 'playing'.",
    "pause": "scene.launch('PauseScene') overlay. scene.pause('GameScene'). State = 'paused'.",
    "resume": "scene.stop('PauseScene'). scene.resume('GameScene'). State = 'playing'.",
    "restart": "Stop all scenes. scene.start('GameScene'). Reset score/combo/speed. State = 'playing'.",
    "destroy": "phaserGame.destroy(true). Remove listeners. Null refs."
  }
}
```

### Config (config.json)

```json
{
  "title": "Neon Drift",
  "version": "1.0.0",
  "engine": "phaser3",
  "genre": "2d-arcade",
  "supportsMultiplayer": false,
  "controls": [
    { "key": "ArrowLeft", "action": "Move left" },
    { "key": "ArrowRight", "action": "Move right" },
    { "key": "A", "action": "Move left" },
    { "key": "D", "action": "Move right" },
    { "key": "Escape", "action": "Pause" }
  ],
  "resolution": { "width": 960, "height": 540, "scaleMode": "fit" },
  "assets": [],
  "audio": [],
  "estimatedPlayTime": "1-5 min"
}
```

### Thumbnail Prompt (for FLUX image generation)

```
A sleek neon cyan triangular spacecraft hurtling down a dark cyberpunk highway at blistering speed, viewed from a dramatic low-angle perspective slightly behind and above the ship. Five glowing lane markers stretch into the distance, converging at a vanishing point. Cascading red and orange neon obstacle blocks tumble toward the viewer from above, creating a gauntlet of danger. The ship leaves a brilliant cyan particle trail streaming behind it. A golden orb collectible floats between the obstacles, pulsing with warm light. The background is a deep navy-black void filled with tiny stars and distant city lights. Neon grid lines on the highway glow with subtle cyan luminescence. Speed lines and motion blur emphasize the velocity. Rim lighting edges the ship in electric blue. Volumetric light rays cut through gaps between obstacles. The bottom 20% is relatively clear with subtle ground glow reflections. Digital painting, cyberpunk game art, neon aesthetic, cinematic lighting, vibrant saturated colors, 4K, action-packed composition.
```
