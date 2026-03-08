# Feed Page — Iframe Game Start Fix

## Problem

Games in the TikTok-style feed page (`Feed.tsx`) would not start when the user clicked "Tap to play." The game loaded correctly inside a cross-origin sandboxed iframe (from GCS), and the `restart` command was received and processed by the game engine, but the game appeared frozen — no keyboard or click input ever reached the iframe.

The same games worked perfectly on the regular game page (`GamePlayerShell.tsx`).

## Root Cause

Three interacting issues prevented user input from reaching the game iframe:

### 1. Z-index stacking: overlays blocked event routing

The feed renders several overlay layers (header, game info, nav hints, "Playing" indicator) at `z-index: 50–55` above the iframe. Even though these overlays set `pointer-events: none` during play mode, the iframe sat in a lower stacking context with no explicit `z-index`. Browsers do not reliably route pointer events through `pointer-events: none` layers down to elements in a lower stacking context — especially cross-origin iframes.

**Fix:** When `isPlaying` is true, the iframe gets `position: relative; z-index: 60`, putting it *above* all overlay layers. The "Playing" close button was bumped to `z-[70]` so it remains accessible.

```tsx
// Feed.tsx — iframe style
style={{
  pointerEvents: isPlaying ? 'auto' : 'none',
  position: isPlaying ? 'relative' : undefined,
  zIndex: isPlaying ? 60 : undefined,
}}
```

### 2. Focus transfer: user gesture context lost

The original code called `iframeRef.current.focus()` inside a React `useEffect`, which runs *after* the click handler returns. By that point, Chrome's user-gesture context has expired. Chrome requires an active user gesture to transfer keyboard focus to a cross-origin iframe — without it, `focus()` silently fails.

**Fix:** Focus and command sending were moved into the click handler itself via `setTimeout(0)`. This fires after React's batched state flush (so the overlay is removed and the iframe has `pointer-events: auto`) but within Chrome's ~1 s user-gesture window:

```tsx
// Feed.tsx — handleSlideClick
const handleSlideClick = useCallback(() => {
  if (!isPlaying && onPlay) {
    onPlay();
    setTimeout(() => {
      if (iframeRef.current) {
        iframeRef.current.focus();              // focus the <iframe> element
        iframeRef.current.contentWindow?.focus(); // focus the content window
      }
      if (ready && iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          { type: 'sloppy:command', command: 'restart' },
          '*',
        );
      }
    }, 0);
  }
}, [isPlaying, onPlay, ready]);
```

### 3. Overlay buttons stealing focus

Several overlay buttons (header close/search/mute, "Playing" indicator) had explicit `pointer-events-auto` that overrode the parent's `pointer-events-none` during play mode. These could capture stray clicks and steal focus from the iframe.

**Fix:**
- FeedHeader buttons: `pointer-events-auto` is now conditional — only applied when `!isPlaying`.
- "Playing" indicator: container changed from `pointer-events-auto` to `pointer-events-none`; only the close button itself has `pointer-events-auto`.

## Why the Game Page Works

`GamePlayerShell.tsx` uses `sandbox="allow-scripts"` (no `allow-same-origin`), sends **no commands** to the game, and has **no overlay layers** above the iframe. The user clicks directly on the iframe, which gives it native focus via a real user gesture. The feed page's architecture (overlays + postMessage commands + programmatic focus) required all three fixes above.

## Key Differences: Feed vs Game Page

| Aspect | Game Page (`GamePlayerShell`) | Feed Page (`FeedSlide`) |
|--------|-------------------------------|-------------------------|
| Sandbox | `allow-scripts` | `allow-scripts allow-same-origin` |
| Commands sent | None | `start`, `restart`, `pause`, `mute`/`unmute` |
| Overlays above iframe | None | Header (z-50), game info (z-50), nav (z-50), playing indicator (z-70) |
| User clicks iframe directly | Yes | No — clicks hit an overlay first |
| Focus method | Native (user clicks iframe) | Programmatic (`setTimeout` + `focus()` in click handler) |
| Iframe z-index during play | Default | `z-index: 60` (above overlays) |

## Diagnostic Logging

Debug logs (dev mode only) are available in the browser console:

| Log | Meaning |
|-----|---------|
| `[FeedSlide:Title] iframe onLoad fired` | iframe HTML loaded |
| `[FeedSlide:Title] READY!` | Game sent `sloppy:game:ready` |
| `[FeedSlide:Title] Play clicked, game ready → sending restart` | Click registered, restart command queued |
| `[FeedSlide:Title] Sending restart command, contentWindow: true` | postMessage dispatched |
| `[Game:Name] Received command: restart gameState: intro` | Game received and processed the command (logged inside game template) |

Game-side logging was added to `synth-wave/index.html` and `turbo-circuit/index.html` in the `sloppy:command` message handler. These were uploaded to the dev GCS bucket via `./scripts/upload-dev-games.sh`.

## Files Changed

- `apps/web/src/pages/Feed.tsx` — iframe z-index, click handler focus logic, overlay pointer-events
- `scripts/games/synth-wave/index.html` — diagnostic logging in message handler
- `scripts/games/turbo-circuit/index.html` — diagnostic logging in message handler
