# Mobile Overlay, Input & Iframe Sizing Changes

This document covers all changes made to improve mobile responsiveness, game playability on touch devices, and iframe display/sizing.

---

## Table of Contents

1. [Layout & Viewport Fixes](#1-layout--viewport-fixes)
2. [NavBar & BottomNav Responsiveness](#2-navbar--bottomnav-responsiveness)
3. [Game Iframe Sizing & Orientation](#3-game-iframe-sizing--orientation)
4. [Mobile Touch Controls Overlay](#4-mobile-touch-controls-overlay)
5. [Portrait Blocker & Pause/Resume](#5-portrait-blocker--pauseresume)
6. [GameOverlay Landscape Fullscreen](#6-gameoverlay-landscape-fullscreen)
7. [Feed Integration](#7-feed-integration)
8. [AI Pipeline & Game Docs Updates](#8-ai-pipeline--game-docs-updates)
9. [Page-Level Responsive Fixes](#9-page-level-responsive-fixes)
10. [Files Reference](#10-files-reference)

---

## 1. Layout & Viewport Fixes

### Layout restructure (`apps/web/src/components/layout/Layout.tsx`)

The root layout was changed from a `min-h-screen` expanding container to a `h-screen overflow-hidden` fixed viewport. Only `<main>` scrolls:

```
Root (h-screen, flex, overflow-hidden)
  ├── Sidebar (h-full, no scroll — stays fixed)
  └── Content column (flex-1, flex-col, h-full, min-w-0)
       ├── NavBar (shrink-0)
       └── main (flex-1, overflow-y-auto, pb-24 md:pb-6)
```

This ensures the sidebar never participates in scrolling.

### Sidebar (`apps/web/src/components/layout/Sidebar.tsx`)

Changed from `h-screen sticky top-0` to `h-full`. Since the root is now a fixed-height container, the sidebar fills it without needing sticky positioning.

### Viewport meta tag (`apps/web/index.html`)

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover" />
```

- `maximum-scale=1.0` prevents the browser from zooming beyond 1x on any interaction or navigation.
- `viewport-fit=cover` enables safe area insets for notched devices.

### Global CSS (`apps/web/src/index.css`)

```css
html, body {
  overflow-x: hidden;
  max-width: 100vw;
  touch-action: manipulation;
}

#root {
  max-width: 100vw;
  overflow-x: hidden;
}

.safe-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

- `touch-action: manipulation` disables double-tap-to-zoom while preserving normal scroll and pinch.
- `max-width: 100vw` + `overflow-x: hidden` at multiple levels prevents horizontal overflow.
- `.safe-bottom` provides safe area padding for devices with home indicators.

---

## 2. NavBar & BottomNav Responsiveness

### NavBar (`apps/web/src/components/layout/NavBar.tsx`)

All elements are always visible at every width — nothing is hidden with breakpoints:

| Element | Small screens | Medium+ screens |
|---------|--------------|-----------------|
| Logo | `w-8 h-8` | `w-9 h-9` |
| Search input | Always visible, `text-base` (16px to prevent iOS auto-zoom) | `text-sm` |
| Sound toggle | `w-4 h-4`, `p-1.5` | `w-5 h-5`, `p-2` |
| Create button | Icon-only (`+`), `px-2` | Icon + "Create" label, `px-4` |
| Sign in / Avatar | Always visible, Avatar links to `/dashboard` | Same |

Gaps adapt: `gap-1 sm:gap-2 md:gap-4`.

### BottomNav (`apps/web/src/components/layout/BottomNav.tsx`)

Replaced the "Create" tab with "Dashboard" since Create is always accessible in the top NavBar. The Dashboard tab uses `startsWith('/dashboard')` for active state matching across sub-routes.

Tabs: Home, Feed, Explore, Favourites, Dashboard.

The `safe-bottom` class is applied for device safe area insets.

---

## 3. Game Iframe Sizing & Orientation

### `useMobileOrientation` hook (`apps/web/src/components/GamePlayerShell.tsx`)

Detects mobile portrait/landscape using `ontouchstart` presence, `window.innerWidth < 1024`, and `height > width` comparison. Listens to `resize` and `orientationchange` events.

### Iframe sizing logic

On mobile landscape, the iframe is forced to stretch mode regardless of the `scaleMode` prop:

```typescript
// Scale computation
if (scaleMode === 'stretch' || isMobileLandscape) return 1;

// Style computation
if (scaleMode === 'stretch' || isMobileLandscape) {
  return { width: '100%', height: '100%' };
}
```

This ensures the game fills the entire available area edge-to-edge without using CSS transforms that could cause overflow.

On desktop or when not in landscape, the original `fit`/`fill`/`stretch` scale modes apply using `transform: scale()`.

---

## 4. Mobile Touch Controls Overlay

### Component (`apps/web/src/components/MobileTouchControls.tsx`)

A React component that renders genre-specific touch controls over the game iframe on mobile devices.

**Detection:** Only renders when `isTouchDevice()` and `window.innerWidth < 768`.

**Genre-to-control mapping:**

| Genre | Left control | Right control |
|-------|-------------|---------------|
| `2d-platformer` | D-pad | 1 button (Jump) |
| `2d-topdown` | Joystick | 2 buttons (Shoot, Dash) |
| `2d-arcade` | D-pad | 1 button (Action) |
| `2d-shooter` | Joystick | 1 button (Fire) |
| `2d-endless-runner` | Tap zones | 2 buttons (Jump, Duck) |
| `2d-puzzle`, `2d-rhythm`, `2d-cards`, `2d-idle` | Tap zones only | — |
| `3d-*` | Joystick | 1–2 buttons |

**Communication:** Sends `sloppy:touch` postMessages to the game iframe with payloads like `touch:move` (with dx/dy), `touch:release`, and `touch:action` (with key index mapped to `Space`, `KeyX`, `KeyZ`, `KeyC`).

**Sub-components:** `JoystickControl`, `DPadControl`, `ActionButtons`.

---

## 5. Portrait Blocker & Pause/Resume

### Component (`PortraitBlocker` in `apps/web/src/components/GamePlayerShell.tsx`)

A mandatory full-screen overlay that blocks game interaction in portrait mode on mobile. Unlike the previous `OrientationHint` (which was dismissible), the blocker cannot be dismissed — the user must rotate their device.

**Behavior:**
- Detects portrait via `useMobileOrientation()` hook
- When portrait is detected: sends `{ type: 'sloppy:command', command: 'pause' }` to the game iframe
- When landscape is restored: sends `{ type: 'sloppy:command', command: 'start' }` to resume
- Uses a `wasPaused` ref to only send resume if it previously sent pause

**Visual:** Black overlay with animated rotating phone icon and "Rotate your device to play" text.

**Scope:** Only active when `mode !== 'inline'` (so the Create page inline preview is unaffected).

---

## 6. GameOverlay Landscape Fullscreen

### Changes (`apps/web/src/components/layout/GameOverlay.tsx`)

**`useIsMobileLandscape` hook:** Detects touch device in landscape orientation.

**Header hiding:** The header bar (back button, title, favourite, multiplayer) is conditionally hidden on mobile landscape:
```tsx
{!isMobileLandscape && ( <div>/* header */</div> )}
```

This gives the game the full viewport height.

**Floating close button:** In mobile landscape, a small `×` button appears at the top-left corner (with 0.5s fade-in delay) so users can still exit the game:
```tsx
{isMobileLandscape && (
  <motion.button className="absolute top-2 left-2 z-[60] ..." />
)}
```

**Scale mode:** Always uses `scaleMode="fill"`. Combined with the `isMobileLandscape` override in `GamePlayerShell`, this results in `width: 100%; height: 100%` stretch mode on mobile landscape.

**Fullscreen toggle:** Hidden on mobile landscape (`showFullscreenToggle={!isMobileLandscape}`).

---

## 7. Feed Integration

### Changes (`apps/web/src/pages/Feed.tsx`)

The `FeedSlide` component (which has its own iframes, separate from `GamePlayerShell`) was updated to include:

- **`MobileTouchControls`**: Rendered when `isPlaying` is true, with `genre={game.genre ?? undefined}` and `iframeRef`
- **`PortraitBlocker`**: Rendered when `isPlaying` is true, with `iframeRef` for pause/resume

The portrait blocker only appears when the user taps to play — browsing the feed in portrait (swiping) works normally.

---

## 8. AI Pipeline & Game Docs Updates

### Code generation prompt (`services/ai-orchestrator/src/prompts/code.ts`)

Added `MOBILE_TOUCH_RULES` constant injected into `buildCodeSystemPrompt()`:
- Requires keyboard + pointer/touch dual input for all games
- Mandates 44x44px minimum tap targets
- Includes the Sloppy Touch Controls Bridge (JavaScript IIFE) that listens for `sloppy:touch` postMessages and dispatches synthetic keyboard events
- Provides genre-specific movement patterns (platformer, runner, puzzle, shooter, etc.)

### Concept architect prompt (`services/ai-orchestrator/src/agents/concept-architect.ts`)

Updated the "Controls / Input Selection" section to state:
- All games MUST be playable on mobile touch devices
- The platform provides an on-screen touch overlay that sends synthetic keyboard events
- Games should also implement direct pointer/touch handling
- Prefer `pointerdown` over `click` or `mousedown`

### Game creation guide (`docs/game-creation-guide.md`)

Added section "9B. Mobile & Touch Support (REQUIRED)" covering:
- Touch controls architecture and bridge code
- Direct touch handling for Phaser, Three.js, and Canvas
- Touch-friendly UI guidelines
- Genre-specific touch patterns table

### Batch game prompts (`docs/batch-game-prompts.md`)

Added "Mobile & Touch Requirements" section with:
- Touch bridge inclusion requirement
- Pointer events for all interactions
- Quality bar criterion: "Playable on mobile with touch controls"

---

## 9. Page-Level Responsive Fixes

### Earnings (`apps/web/src/pages/Dashboard/Earnings.tsx`)
- Grids changed from `grid-cols-4` to `grid-cols-2 sm:grid-cols-4`
- "Your Share" and "Status" columns hidden on small screens with `hidden sm:block`
- Root container has `overflow-x-hidden`

### Settings (`apps/web/src/pages/Dashboard/Settings.tsx`)
- Button rows use `flex flex-wrap gap-3` to wrap on small screens
- Account info uses `gap-2` and `truncate` for long text

### Create (`apps/web/src/pages/Create.tsx`)
- "Generate Game" button moved directly below the textarea (before example prompts)
- `minHeight` values use `min(250px, 50vh)` for small viewports
- Root container has `overflow-x-hidden`

### Creator (`apps/web/src/pages/Creator.tsx`)
- Added `min-w-0` to `flex-1` profile header for text truncation

### MyGames (`apps/web/src/pages/MyGames.tsx`)
- Added `min-w-0` to `flex-1` card info container

### Home (`apps/web/src/pages/Home.tsx`)
- Added `min-w-0` to root container

### SectionRow (`apps/web/src/components/ui/SectionRow.tsx`)
- Added `min-w-0` to section element to prevent horizontal scroll overflow

---

## 10. Files Reference

### Frontend — Layout & Navigation
- `apps/web/index.html` — viewport meta tag
- `apps/web/src/index.css` — global overflow, touch-action, safe-bottom
- `apps/web/src/components/layout/Layout.tsx` — root layout structure
- `apps/web/src/components/layout/Sidebar.tsx` — sidebar positioning
- `apps/web/src/components/layout/NavBar.tsx` — responsive top nav
- `apps/web/src/components/layout/BottomNav.tsx` — mobile bottom nav with Dashboard

### Frontend — Game Display
- `apps/web/src/components/GamePlayerShell.tsx` — iframe scaling, portrait blocker, mobile orientation
- `apps/web/src/components/MobileTouchControls.tsx` — genre-specific touch overlay
- `apps/web/src/components/layout/GameOverlay.tsx` — fullscreen game overlay, landscape header hiding
- `apps/web/src/pages/Feed.tsx` — feed game slides with touch controls and portrait blocker

### Frontend — Page Fixes
- `apps/web/src/pages/Create.tsx` — generate button placement, responsive sizing
- `apps/web/src/pages/Dashboard/Earnings.tsx` — responsive grids
- `apps/web/src/pages/Dashboard/Settings.tsx` — flex-wrap buttons
- `apps/web/src/pages/Home.tsx` — min-w-0 overflow fix
- `apps/web/src/pages/Creator.tsx` — min-w-0 overflow fix
- `apps/web/src/pages/MyGames.tsx` — min-w-0 overflow fix
- `apps/web/src/components/ui/SectionRow.tsx` — min-w-0 overflow fix

### AI Pipeline & Documentation
- `services/ai-orchestrator/src/prompts/code.ts` — MOBILE_TOUCH_RULES in code generation prompt
- `services/ai-orchestrator/src/agents/concept-architect.ts` — mobile touch in GDD prompt
- `docs/game-creation-guide.md` — Section 9B: Mobile & Touch Support
- `docs/batch-game-prompts.md` — Mobile & Touch Requirements section

### Configuration
- `.env.production` — `VITE_CDN_URL` bucket name fix (`sloppy-game-bundles-prod`)

---

## 11. Known Issues & Bug Fixes (March 2026)

Three compounding bugs were discovered that broke mobile gameplay across all 21 games.

### Bug 1: Game canvas cropping on mobile

**Symptom:** Games appear cropped in the mobile overlay — the iframe fills the screen but the game content is cut off.

**Root cause — Three.js games (7 of 21):** Each Three.js game calls `renderer.setSize(W, H)` with a fixed resolution (1280x720) during `init()`, and none (except tesseract, partially) listen for `resize` events. When the iframe is set to `width: 100%; height: 100%` on mobile landscape, the internal viewport might be smaller than 1280x720. The canvas overflows and `overflow: hidden` on `<body>` crops the excess. The player only sees the top-left portion of the game.

**Root cause — Phaser games (14 of 21):** Phaser's `Scale.FIT` + `CENTER_BOTH` handles scaling correctly, so these games are not cropped. However, they letterbox (show black bars) when the viewport aspect ratio differs from 960:540 (16:9). This is less severe but still not edge-to-edge.

**Fix:** All Three.js games must include a `window.addEventListener('resize', ...)` handler that calls `renderer.setSize(w, h)` and updates `camera.aspect`. The resize handler must also fire once during init so the game renders at the correct viewport size from the start.

### Bug 2: Mobile touch controls never render in landscape

**Symptom:** The `MobileTouchControls` overlay (joystick, d-pad, action buttons) never appears when playing games on mobile.

**Root cause:** The component uses `window.innerWidth < 768` to detect mobile devices. However, the `PortraitBlocker` forces landscape orientation, and in landscape `window.innerWidth` is the LONG edge of the screen (e.g., 844px on iPhone 14, 932px on iPhone 15 Pro Max). Since 844 > 768, the condition evaluates to `false` and touch controls are never rendered.

**Fix:** Use the shorter viewport dimension instead:
```typescript
const shorter = Math.min(window.innerWidth, window.innerHeight);
setIsMobile(isTouchDevice() && shorter < 1024);
```
The 1024px threshold catches all phones and small tablets in landscape while excluding desktop.

### Bug 3: Touch bridge synthetic keyboard events lack `keyCode`

**Symptom:** Even when touch controls render (e.g., on devices where width < 768 coincidentally), Phaser games do not respond to touch input.

**Root cause:** The Sloppy Touch Controls Bridge inside each game creates `KeyboardEvent` objects like this:
```javascript
new KeyboardEvent(evType, { key: input.key, code: input.key, bubbles: true, cancelable: true });
```
The `KeyboardEvent` constructor does NOT auto-populate the deprecated `keyCode` and `which` properties from `key`/`code` strings — they default to `0`. Phaser 3's keyboard system internally reads `event.keyCode` to identify keys. With `keyCode: 0`, Phaser ignores every synthetic event from the bridge.

**Fix:** Include an explicit `keyCode` mapping in the bridge:
```javascript
var kc = {
  ArrowUp:38, ArrowDown:40, ArrowLeft:37, ArrowRight:39,
  Space:32, KeyX:88, KeyZ:90, KeyC:67,
  KeyW:87, KeyA:65, KeyS:83, KeyD:68
};
var evt = new KeyboardEvent(evType, {
  key: input.key, code: input.key,
  keyCode: kc[input.key] || 0, which: kc[input.key] || 0,
  bubbles: true, cancelable: true
});
```

### Corrected Touch Controls Bridge (canonical version)

All games must include this updated bridge at the end of their inline script:

```javascript
// Sloppy Touch Controls Bridge — receives synthetic keyboard events from platform overlay
(function() {
  if (!('ontouchstart' in window)) return;
  var kc = {
    ArrowUp:38, ArrowDown:40, ArrowLeft:37, ArrowRight:39,
    Space:32, KeyX:88, KeyZ:90, KeyC:67,
    KeyW:87, KeyA:65, KeyS:83, KeyD:68
  };
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'sloppy:touch') {
      var input = e.data.input;
      if (!input) return;
      if (input.key) {
        var evType = input.type === 'touch:release' ? 'keyup' : 'keydown';
        var evt = new KeyboardEvent(evType, {
          key: input.key, code: input.key,
          keyCode: kc[input.key] || 0, which: kc[input.key] || 0,
          bubbles: true, cancelable: true
        });
        document.dispatchEvent(evt);
      }
    }
  });
})();
```

### Responsive Canvas Contract

Games must render correctly at any viewport size. The iframe may be any dimensions depending on the device and orientation.

**Three.js games — required resize handler:**
```javascript
var W = 1280, H = 720; // logical design resolution (used for game logic ratios)

function onWindowResize() {
  var w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onWindowResize);

// In init(), use window dimensions instead of fixed W/H:
renderer.setSize(window.innerWidth, window.innerHeight);
camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, near, far);
```

**Phaser games — no changes needed:**
Phaser's `Scale.FIT` + `CENTER_BOTH` already handles responsive sizing. Letterboxing is acceptable. Games use the fixed 960x540 coordinate space; Phaser scales the canvas to fit the viewport automatically.
