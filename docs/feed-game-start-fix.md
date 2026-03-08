# Feed Page: Game Start & CORS Fix Guide

## Status

The feed page no longer crashes (React error #310 was caused by importing `@sentry/react` in Feed.tsx — do NOT import it there). But two issues remain:

1. **Games don't start after "Tap to play"** — the postMessages are sent but the game inside the iframe doesn't respond.
2. **CORS errors** — game iframes can't load assets from `sloppygames.io` because they run in a sandboxed iframe with `origin: null`.

---

## Issue 1: CORS Errors in Game Iframes

### Symptoms

```
Access to script at 'https://sloppygames.io/assets/index-DT44hAfa.js' from origin 'null'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present.

SecurityError: Failed to read the 'serviceWorker' property from 'Navigator':
Service worker is disabled because the context is sandboxed and lacks the 'allow-same-origin' flag.
```

### Root Cause

Game iframes use `sandbox="allow-scripts"` without `allow-same-origin`. This means:
- The iframe's origin is `null` (not `https://sloppygames.io`)
- Any request to `sloppygames.io` from inside the iframe is cross-origin
- The browser blocks JS/CSS fetches that don't have CORS headers
- Service workers are completely unavailable

### Fix Options

**Option A (Recommended): Add `allow-same-origin` to the sandbox attribute**

In `apps/web/src/pages/Feed.tsx`, change the iframe's sandbox attribute:

```tsx
// BEFORE
sandbox="allow-scripts"

// AFTER
sandbox="allow-scripts allow-same-origin"
```

This lets the iframe share the origin with the parent page, so asset fetches work. The game code can now access same-origin resources. This is safe as long as game code is trusted (it's your own generated code).

**Option B: Add CORS headers to Firebase Hosting**

In `firebase.json`, add headers for game assets:

```json
{
  "hosting": {
    "headers": [
      {
        "source": "/games/**",
        "headers": [
          { "key": "Access-Control-Allow-Origin", "value": "*" }
        ]
      },
      {
        "source": "/assets/**",
        "headers": [
          { "key": "Access-Control-Allow-Origin", "value": "*" }
        ]
      }
    ]
  }
}
```

**Option C: Use CDN with CORS headers**

If games are served from a CDN (Cloud Storage), configure the bucket's CORS policy:

```bash
gsutil cors set cors.json gs://YOUR_BUCKET_NAME
```

Where `cors.json` is:
```json
[
  {
    "origin": ["*"],
    "method": ["GET"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
```

---

## Issue 2: Game Doesn't Start After "Tap to Play"

### What Works

- Feed page loads, games are visible, scrolling works
- "Tap to play" click is detected, `isPlaying` flips to `true`
- `sendPlaySequence()` runs and sends `start`, `restart`, `resume` to the iframe
- `contentWindow` is not null, messages are delivered

### What Fails

The game inside the iframe stays on its intro/instruction screen. It receives the postMessages but doesn't transition to the playing state.

### Likely Root Causes

1. **CORS blocks the game from loading at all** (see Issue 1 above). If the game's JS/CSS can't load due to CORS, the message handler never gets set up. Fix CORS first, then retest.

2. **Game doesn't handle the command messages**. Each game template has a message listener. Check that the game's `index.html` has:

```javascript
window.addEventListener('message', (e) => {
  if (e.data?.type === 'sloppy:command') {
    switch (e.data.command) {
      case 'start':   // transition from boot → playing
      case 'restart':  // reset and start playing
      case 'resume':   // unpause
      case 'pause':    // pause
    }
  }
});
```

3. **The `restart` command doesn't bypass the intro**. The SDK v2 lifecycle is: `start()` → intro screen → user click → playing. The `restart` command should bypass the intro and go directly to playing. Check the game template's `restart()` function to verify it starts the game scene directly.

### How to Debug

Open the game's iframe URL directly in a new tab (find it in the network tab or inspect the iframe's `src`). Then in the browser console:

```javascript
// Simulate what the feed page sends:
window.postMessage({ type: 'sloppy:command', command: 'start' }, '*');
// Wait 120ms
window.postMessage({ type: 'sloppy:command', command: 'restart' }, '*');
// Wait 120ms
window.postMessage({ type: 'sloppy:command', command: 'resume' }, '*');
```

If the game doesn't respond to these commands when loaded directly, the issue is in the game template code, not the feed page.

### Game Template Fix

Look at `scripts/games/*/index.html` for the message handler. The typical pattern should be:

```javascript
window.addEventListener('message', function(event) {
  const data = event.data;
  if (!data || !data.type) return;

  switch (data.type) {
    case 'sloppy:command':
      switch (data.command) {
        case 'start':
          startGame();  // Must actually begin gameplay, not just show intro
          break;
        case 'restart':
          restartGame(); // Must reset AND begin gameplay
          break;
        case 'resume':
          resumeGame();
          break;
        case 'pause':
          pauseGame();
          break;
      }
      break;
    case 'sloppy:mute':
      muteAudio();
      break;
    case 'sloppy:unmute':
      unmuteAudio();
      break;
  }
});

// Signal that the game is ready to receive commands
window.parent.postMessage({ type: 'sloppy:game:ready' }, '*');
```

---

## Critical Rule: Do NOT Import @sentry/react in Feed.tsx

Importing `@sentry/react` in `Feed.tsx` causes React error #310 (infinite re-renders). Sentry's React integration wraps hooks, and when combined with the Feed page's component structure, it creates a render loop. Sentry is already initialized in `ErrorBoundary.tsx` — that's sufficient for error tracking.

---

## Files Involved

| File | Purpose |
|------|---------|
| `apps/web/src/pages/Feed.tsx` | Feed page — FeedSlide iframe rendering, play sequence |
| `apps/web/src/hooks/useFeedWindow.ts` | Sliding window logic (prev/current/next game) |
| `apps/web/src/components/ErrorBoundary.tsx` | Sentry init (do NOT duplicate in Feed.tsx) |
| `scripts/games/*/index.html` | Individual game templates with message handlers |
| `firebase.json` | Firebase Hosting config (CORS headers) |
| `docs/game-creation-guide.md` | Game SDK documentation |

---

## Recommended Fix Order

1. **Fix CORS** — Add `allow-same-origin` to the iframe sandbox (Option A above)
2. **Retest** — The game might start working once its JS/CSS can actually load
3. **If still stuck** — Open a game URL directly and test postMessage commands manually
4. **If commands don't work** — Fix the game template's message handler
