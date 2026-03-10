# Game Creation Pipeline — Fixes & Hardening

This document covers all fixes applied to the game creation pipeline to resolve generation failures, improve reliability, and add new features.

---

## 1. Puppeteer / Chrome in Docker

**Problem:** `Could not find Chrome (ver. 146.0.7680.31)` — the `game-builder` container had no browser installed, so Puppeteer-based runtime validation always failed.

**Fix (commit `9cd2181`):**
- Updated `game-builder` Dockerfile to install Chromium and its runtime dependencies on Alpine Linux.
- Set `PUPPETEER_EXECUTABLE_PATH` and `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` environment variables.
- Increased `game-builder` Cloud Run memory/CPU to handle headless browser workloads.

**Files:** `services/game-builder/Dockerfile`, `infra/terraform/modules/services/main.tf`

---

## 2. LLM Client Hardening

### 2a. Output Token Clamping & Truncation Detection

**Problem:** LLM responses were silently truncated when `max_tokens` exceeded the model's actual limit, producing incomplete HTML that failed validation.

**Fix:** Each LLM client (Anthropic, OpenAI, Grok) now:
- Defines a `MAX_OUTPUT_TOKENS` constant matching the model's real ceiling (Anthropic: 64K, OpenAI: 16K, Grok: 131K).
- Clamps the requested `max_tokens` via `clampTokens()` before every API call.
- Checks the response's stop/finish reason — if it's `max_tokens` / `length`, throws a descriptive error instead of returning truncated output.

**Files:** `services/ai-orchestrator/src/llm/anthropic.ts`, `openai.ts`, `grok.ts`

### 2b. Increased Token Limits Per Phase

**Problem:** Several phases had token limits too low for the content they needed to generate, especially the code phase (was 8,000) and assets phase (was 2,000).

**Fix:**
| Phase | Before | After |
|-------|--------|-------|
| `concept` | 2,000 | 4,000 |
| `planning` | 3,000 | 4,000 |
| `code` | 8,000 | 16,384 |
| `fix` | 12,000 | 16,384 |
| `polish` | 12,000 | 16,384 |
| `audio` | 12,000 | 16,384 |
| `assets` | 2,000 | 8,192 |
| `multiplayer` | 4,000 | 16,384 |

Both `config.ts` defaults and Terraform environment variables were updated to stay in sync.

**Files:** `services/ai-orchestrator/src/config.ts`, `infra/terraform/modules/services/main.tf`

### 2c. Rate Limit Resilience

**Problem:** Anthropic's personal API tier has a 30,000 input tokens/minute limit. The debug/fix loop makes rapid sequential calls with large prompts (full game HTML + errors), easily exceeding this limit. The pipeline crashed on 429 errors instead of waiting.

**Fix:**
- Increased SDK `maxRetries` from 2 to 5 across all LLM clients. The SDKs have built-in exponential backoff for 429 errors — with 5 retries, they wait progressively longer (up to ~60s).
- Added a 15-second pause between debug fix iterations (starting from iteration 2) to space out API calls.

**Files:** `services/ai-orchestrator/src/llm/anthropic.ts`, `openai.ts`, `grok.ts`, `services/ai-orchestrator/src/pipeline/orchestrator.ts`

### 2d. Request Logging

**Problem:** No visibility into LLM call durations, token usage, or truncation events.

**Fix:** Added structured logging (`createLogger`) to all LLM clients:
- Log on call start: model, max tokens, prompt length
- Log on completion: duration, token usage, stop reason
- Warn on truncation before throwing

**Files:** `services/ai-orchestrator/src/llm/anthropic.ts`, `openai.ts`, `grok.ts`

---

## 3. Code Generation Prompts

**Problem:** Generated games were missing critical SDK v2 requirements — the PostMessage command bridge, auto-init boot, `window.triggerGameOver`, and properly defined standalone methods. This caused persistent validation failures.

**Fix:** Enhanced the `OUTPUT_FORMAT` section in the code generation system prompt with:
- Explicit PostMessage `sloppy:command` bridge listener code.
- Auto-init boot function (`window.SloppyGame.init(...)`) that fires on DOM ready.
- `window.triggerGameOver` function definition.
- A new "Method Definition Rules" section requiring all 12 SDK methods as standalone named functions before `window.SloppyGame` assignment, with a code example.
- Updated "Required Script Order" to an 8-step process reflecting the above.
- Updated `FORBIDDEN` list.

**Files:** `services/ai-orchestrator/src/prompts/code.ts`

---

## 4. Static Validator Fixes

### 4a. Method Detection Regex

**Problem:** The V2 source pattern regex `new RegExp(\`\\b${m}\\s*\\(\`)` required methods to be followed by `(`, which didn't match property-style function definitions like `getScore: function() {}`.

**Fix:** Changed to `new RegExp(\`\\b${m}\\b\`)` — matches method names by word boundary only.

**File:** `packages/runtime-sdk/src/validator.ts`

### 4b. Overly Strict `Function()` Pattern

**Problem:** The forbidden pattern `/\bFunction\s*\(/` blocked the `Function` constructor but was too broad — it triggered repeatedly on legitimate code patterns in generated games, causing the coding phase to fail and retry multiple times.

**Fix:** Removed the standalone `/\bFunction\s*\(/` pattern. The more specific `/\bnew\s+Function\s*\(/` pattern remains to catch the actual dangerous usage.

**File:** `packages/runtime-sdk/src/validator.ts`

---

## 5. Debug Fixer — Prompt Size Reduction

**Problem:** The debug fixer embedded full base64 PNG screenshots directly in the text prompt. Each screenshot was ~50K+ tokens of raw base64 text. With 4 game state screenshots, this alone consumed 200K+ tokens — exceeding Anthropic's 200K context window (`prompt is too long: 209725 tokens > 200000 maximum`). The model can't "see" images in a text prompt anyway.

**Fix:** Removed base64 screenshot data from the debug fixer prompt. Screenshots are still captured and displayed to the user in the frontend UI; only the list of captured states is mentioned in the prompt for context.

**File:** `services/ai-orchestrator/src/agents/debug-fixer.ts`

---

## 6. Markdown Fence Stripping

**Problem:** LLM responses sometimes included markdown code fences (`` ```html ... ``` ``), leading/trailing text, or other wrapping that broke parsing.

**Fix:** Improved `stripMarkdownFences` regex in the code phase and all agent files (debug fixer, polish agent, audio generator, multiplayer injector) to more robustly extract clean HTML/JSON from wrapped responses.

**Files:** `services/ai-orchestrator/src/pipeline/code.ts`, `src/agents/debug-fixer.ts`, `polish-agent.ts`, `audio-generator.ts`, `multiplayer-injector.ts`

---

## 7. SSE Status Route Crash Fix

**Problem:** When a client's HTTP/3 (QUIC) connection dropped mid-generation (common during long generations), the SSE status route attempted to write to the closed response stream. This threw an unhandled `ERR_STREAM_WRITE_AFTER_END` error that crashed the entire Node.js process — killing the in-progress generation along with it.

**Fix:**
- Added a `connectionAlive` flag and `res.on('error', ...)` listener.
- Wrapped all `res.write()` calls (both `sendEvent` and heartbeat) in try/catch.
- Protected `res.end()` in cleanup with a `res.writableEnded` check.
- A disconnected SSE observer now cleans up silently without affecting the generation pipeline.

**File:** `services/ai-orchestrator/src/routes/status.ts`

---

## 8. Pipeline Orchestrator — Cancellation

**Problem:** No way for users to cancel a generation in progress.

**Fix:**
- **Session manager:** Added `cancelled` status, `cancel()` method (sets Redis flag, returns granular status), and `isCancelled()` check.
- **Generate route:** Added `DELETE /:sessionId` endpoint with Firebase UID ownership verification. Always returns 200 with a `reason` field (not 404) to handle race conditions gracefully.
- **Orchestrator:** Added `checkCancelled()` calls before every major phase for graceful early exit.
- **API Gateway:** Proxied DELETE requests to the orchestrator.
- **Frontend:** Added `cancelGeneration()` action, cancel button in the generating UI, and `cancelling` state.

**Files:** `services/ai-orchestrator/src/session/manager.ts`, `src/routes/generate.ts`, `src/pipeline/orchestrator.ts`, `services/api-gateway/src/proxy.ts`, `apps/web/src/stores/generation.ts`, `apps/web/src/lib/api.ts`, `apps/web/src/pages/Create.tsx`

---

## 9. Generation Persistence Across Page Refresh

**Problem:** The Zustand generation store was in-memory only. Refreshing the page or navigating away lost all generation state — users couldn't return to see their game being built.

**Fix:**
- On generation start: save `{ sessionId, prompt, ts }` to `localStorage` key `sloppy:active-generation`.
- On completion, failure, cancel, reset, or SSE exhaustion: clear the key.
- Added `reconnect(sessionId, prompt?)` action that sets state to `generating` and re-opens the SSE stream.
- Added `getPersistedSession()` export with 1-hour TTL check.
- On Create page mount: checks localStorage. If `status === 'idle'` and session exists, calls `reconnect()`. If `status === 'generating'` (navigated away and back within the SPA), re-establishes the SSE connection via `connectToSSE()`.
- The backend SSE endpoint already sends current state as the first event, so the UI catches up immediately.

**Files:** `apps/web/src/stores/generation.ts`, `apps/web/src/pages/Create.tsx`

---

## 10. Timeout Configuration

**Problem:** Generation timeouts were too short. Complex games with debug/fix iterations and rate limit retries could easily exceed the original 8-minute timeout.

**Fix (progressive increases):**
| Setting | Original | Final |
|---------|----------|-------|
| Generation timeout | 180s | 1,500s (25 min) |
| Cloud Run request timeout | 600s | 1,800s (30 min) |
| API Gateway SSE proxy timeout | 120s | 1,200,000ms (20 min) |

The gateway timeout was a critical fix — at 120s (2 min) it was silently killing SSE connections well before generation could complete.

**Files:** `services/ai-orchestrator/src/config.ts`, `infra/terraform/modules/services/main.tf`, `services/api-gateway/src/config.ts`

---

## 11. Deploy Script — Unique Image Tags

**Problem:** The deploy script used `git rev-parse --short HEAD` for Docker image tags. Without new git commits, the tag was unchanged, and Terraform detected no change in the image — skipping Cloud Run revision updates. This meant code fixes weren't actually deployed.

**Fix:** Appended a Unix timestamp to the image tag: `IMAGE_TAG="${GIT_SHA}-$(date +%s)"`. Every deployment now produces a unique tag, forcing Terraform to create new Cloud Run revisions.

**File:** `deploy.sh`

---

## 12. Express Route Ordering — `/games/quota` 404

**Problem:** `GET /games/quota` returned 404 because Express matched it against the `/:id` parameterized route first (treating "quota" as a game ID).

**Fix:** Moved the `router.get('/quota', ...)` route definition above `router.get('/:id', ...)`.

**File:** `services/game-builder/src/routes/games.ts`

---

## 13. UI Improvements

- **Generate button sizing:** Reduced from `text-xl px-10 py-4` to `text-base px-8 py-3` — still prominent but proportional.
- **Cancel button:** Positioned inline with the progress bar, styled as a `SloppyButton` ghost variant for consistency.
- **"Come back" message:** After 5 seconds of generation, a fade-in message appears: *"This can take a few minutes. Feel free to leave and come back — your game will be waiting for you."*
- **Responsive tweaks:** Added `text-xs sm:text-sm` to progress text, responsive icon sizing, mobile-friendly padding and game preview height.

**File:** `apps/web/src/pages/Create.tsx`

---

## 14. Code Phase Validation Logging

**Problem:** When code validation failed, there was no log output showing what specifically went wrong, making debugging difficult.

**Fix:** Added `log.warn(...)` on initial validation failure and `log.error(...)` on retry failure, including the error list, HTML length, and whether the response contained a doctype.

**File:** `services/ai-orchestrator/src/pipeline/code.ts`
