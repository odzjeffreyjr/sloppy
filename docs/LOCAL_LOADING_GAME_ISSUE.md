# Local dev: game stuck on "Loading game..." — fix brief

Use this file as context when asking to fix the issue.

---

## Which servers and logs are used when running locally

**When you run `./dev.sh`, you are using LOCAL servers only.** The frontend and all backend services run on your machine. No game-generation traffic goes to Cloud Run.

| What you use | Where it runs | Where to see logs |
|--------------|----------------|-------------------|
| Frontend | `http://localhost:5173` (Vite) | Browser DevTools, `.dev-logs/frontend.log` |
| API Gateway | `http://localhost:3001` | `.dev-logs/api-gateway.log` |
| Auth | `http://localhost:3002` | `.dev-logs/auth.log` |
| **Game Builder** | **`http://localhost:3003`** | **`.dev-logs/game-builder.log`** |
| AI Orchestrator | `http://localhost:3004` | `.dev-logs/ai-orchestrator.log` |
| Multiplayer | `http://localhost:3005` | `.dev-logs/multiplayer.log` |

- **Local logs (use these for local dev):**
  - Run `./dev.sh logs` to tail all service logs, or
  - Open e.g. `tail -f .dev-logs/game-builder.log` to watch only game-builder.
  When you generate a game locally you should see `POST /games` and `request completed` (201) in **`.dev-logs/game-builder.log`**.

- **Cloud Run / GCP logs:**
  These are for the **production** deployment only. They show health checks and any traffic that hits the **production** URLs (e.g. if someone uses the deployed app). When you are on `http://localhost:5173` and click "Generate", nothing is sent to Cloud Run, so you will **not** see new game-builder activity there. Do **not** use Cloud Run logs to debug local "loading game" issues.

**To confirm you're on local:** In the browser, requests should go to `http://localhost:3001` (Network tab). If they go to a `*.run.app` or other prod URL, then the app is pointed at production and the doc below may need to account for that.

---

## Symptom

- **Environment:** Running **locally** (`./dev.sh`). Frontend at `http://localhost:5173`, API at `http://localhost:3001`.
- **Flow:** User generates a game on the Create page. Generation completes (phases run, game is persisted). The UI shows the "done" state but the game area stays on **"Loading game..."** with the spinner forever; the game never appears.

## Already in place

- `VITE_CDN_URL` is set to `https://storage.googleapis.com/sloppy-game-bundles-dev` so the iframe URL points at GCS, not localhost.
- GCS bucket `sloppy-game-bundles-dev` exists and has public read; game-builder uploads bundles there and returns `storagePath` (e.g. `games/{id}/v1`).
- Backend flow: when game-builder accepts the bundle (201), orchestrator sends `gameId` via SSE; when game-builder rejects (e.g. 422 validation), no game is created and the UI has nothing to load.

## Suspected causes (prioritised)

1. **Bundle validation 422 (game-builder rejects bundle)**  
   The game-builder validates `game.js` and requires that it implements `init`, `update`, and `destroy` (e.g. regex looks for `init(`, `update(`, `destroy(`). If the AI generates code in a different style (e.g. `init: function(container)`), validation can fail with 422 — then no game is created, no `gameId` is returned, and the UI stays on loading or shows no game.  
   **Check:** `.dev-logs/game-builder.log` for `status":422` and `"message":"Game bundle failed validation"` or `interface_methods` / `required method: init`.  
   **Fix:** Relax or extend validation in `services/game-builder/src/validation/pipeline.ts` to accept common patterns (e.g. `init: function(`, `init: (` arrow), and/or tighten AI prompts so generated code uses the expected style.

2. **CORS**  
   The game runs **inside an iframe** whose `src` is on **`https://storage.googleapis.com/...`** (different origin than the app).  
   If the **game script** (inside the iframe) calls **`http://localhost:3001`** (e.g. play count, multiplayer), the browser sends a cross-origin request from origin `https://storage.googleapis.com`. The API gateway CORS may only allow `http://localhost:5173`, so requests from the iframe are CORS-rejected, the game JS may throw or fail before sending `sloppy:game:ready`, and the Create page never hides the loading overlay.  
   **Check:** API gateway CORS config; DevTools → Network for failed requests from the iframe to localhost:3001. For local dev, consider allowing the GCS origin or using a local proxy for game bundles.

3. **Iframe never loads / X-Frame-Options**  
   If GCS returns **X-Frame-Options: DENY** (or SAMEORIGIN), the iframe may be blocked when embedded on `http://localhost:5173`.  
   **Check:** DevTools → Network: iframe request to `https://storage.googleapis.com/.../index.html` — response headers (X-Frame-Options, CSP frame-ancestors). If embedding is blocked, consider a **local proxy** that serves the game bundle from localhost so the iframe is same-origin.

4. **Wrong iframe URL or missing `storagePath`**  
   Create page builds iframe `src` via `buildIframeSrc(game)` using `game.storagePath` or `game.id` + `game.version`. If `gamesApi.get(gameId)` returns a game without `storagePath` or wrong shape, the URL could be wrong and the iframe 404s.  
   **Check:** After generation, DevTools → Network: iframe request URL and response (200 vs 404).

5. **Game script error before `sloppy:game:ready`**  
   Loading overlay is cleared when the app receives `postMessage('sloppy:game:ready')` from the iframe (or iframe `onLoad`). If the game bundle’s JS throws (e.g. CORS or missing API), it may never send that message.  
   **Check:** DevTools → Console; select the iframe’s context to see errors from the game script.

## Key files (for the person fixing)

- **Frontend – loading state and iframe:**  
  `apps/web/src/pages/Create.tsx` — loading overlay, `buildIframeSrc(game)`, `game` from `gamesApi.get(gameId)`, and the `sloppy:game:ready` / `onLoad` handling.
- **Frontend – CDN base URL:**  
  `apps/web/src/pages/Create.tsx`: `CDN_URL = import.meta.env.VITE_CDN_URL ?? ''`.  
  `apps/web/.env` and root `.env`: `VITE_CDN_URL=https://storage.googleapis.com/sloppy-game-bundles-dev`.
- **Game-builder – bundle validation:**  
  `services/game-builder/src/validation/pipeline.ts` — required methods check (`init`, `update`, `destroy`); relax regex to accept `method: function(` and `method: (` arrow.
- **AI – code generation:**  
  `services/ai-orchestrator/src/prompts/code.ts` — ensure prompt requires output that passes game-builder validation (e.g. explicit `init(`, `update(`, `destroy(` or `window.SloppyGame = { init, update, destroy, ... }`).
- **API gateway – CORS:**  
  `services/api-gateway/src/app.ts` and CORS config; for local dev, consider allowing GCS origin or proxying game assets from localhost.
- **Game bundle URL / storage:**  
  `services/game-builder` — how `storagePath` is set and returned in GET game response; `config.cdn.baseUrl` (e.g. `CDN_BASE_URL`).

## Quick check: am I hitting local or prod?

1. With dev running (`./dev.sh`), generate a game on http://localhost:5173.
2. In another terminal: `tail -20 .dev-logs/game-builder.log`
3. You should see a line like `POST /games` and `status":201` (success) or `status":422` (validation failed) or another error. If you see that, you’re on **local** and the right logs are `.dev-logs/*.log`. If `.dev-logs/game-builder.log` shows nothing new when you generate, the frontend might be using a prod API URL (check `VITE_API_URL` in `apps/web/.env`).

## What to do in the next prompt

- Ask to fix the **local** "Loading game..." issue using this doc as context.
- Mention: **running locally**; use **local logs** (`.dev-logs/` or `./dev.sh logs`), not Cloud Run.
- If game-builder returns 422 (bundle validation): fix validation in `services/game-builder/src/validation/pipeline.ts` and/or AI prompts so generated `game.js` passes (implements `init`, `update`, `destroy` in a way the validator accepts).
- If the game is created (201) but the iframe stays loading: consider **CORS** (iframe origin GCS calling localhost API) or **X-Frame-Options**; optionally add a **local proxy** that serves the game bundle from localhost so the iframe and API calls are same-origin.
