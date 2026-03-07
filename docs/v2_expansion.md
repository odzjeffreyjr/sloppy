# Sloppy v2 — Full Platform Expansion Plan
## UI Overhaul · TikTok Feed · Game Population Pipeline · Monetisation · Fullscreen

---

## Overview

This document covers five major additions to the Sloppy platform, building on the AI agent pipeline plan already defined. Each section is self-contained with concrete implementation details, technology choices, and sequencing guidance.

---

# Part 1: UI Overhaul — Game Store Meets CrazyGames

## 1.1 Design Direction

The target aesthetic is **dark premium gaming** — think CrazyGames.com blended with the energy of Sloppy's chaotic identity. Not a flat productivity app, not a generic marketplace. A place that feels like entering an arcade.

Key visual pillars:
- Deep dark background (`#0d0d0f`) with neon accent system (primary purple `#7c3aed`, secondary cyan `#06b6d4`, danger red `#ef4444`)
- Game cards with subtle 3D tilt-on-hover (CSS `perspective` + `rotateX/Y`)
- Glassmorphism panels for overlays and sidebars (`backdrop-filter: blur(20px)`)
- Skeleton loading states that match card dimensions exactly (no layout shift)
- Category chips with game-genre icons (not generic emoji)
- A persistent left sidebar on desktop, bottom tab bar on mobile

## 1.2 Navigation Structure

```
DESKTOP LAYOUT:
┌──────────────────────────────────────────────────────────┐
│  🎮 SLOPPY          [Search...]        [Create] [Profile] │  ← Top bar
├──────────┬───────────────────────────────────────────────┤
│          │                                               │
│ SIDEBAR  │               CONTENT AREA                   │
│          │                                               │
│ 🏠 Home  │   [Category chips row]                        │
│ 🔥 Feed  │   [Hero banner / featured game]               │
│ 🔍 Explore│  [Section: New Games]                        │
│ ⭐ Faves │   [Section: Trending]                         │
│ 🎨 Create│   [Section: 3D Games]                         │
│ 👤 Profile│  [Section: Multiplayer]                      │
│          │                                               │
│ ─────── │                                               │
│ CATEGORIES│                                              │
│ 🏃 Action│                                               │
│ 🧩 Puzzle│                                               │
│ 🚗 Racing│                                               │
│ 👾 Arcade│                                               │
│ 🌍 Open  │                                               │
│   World  │                                               │
│ 🎯 Tower │                                               │
│   Defense│                                               │
│ 🃏 Card  │                                               │
│ 👫 Multi │                                               │
│   player │                                               │
└──────────┴───────────────────────────────────────────────┘

MOBILE LAYOUT:
┌──────────────────────────────┐
│  🎮 SLOPPY       [🔍] [👤]  │  ← Top bar (minimal)
├──────────────────────────────┤
│                              │
│    SCROLLABLE CONTENT        │
│                              │
├──────────────────────────────┤
│  🏠    🔥    🔍    ⭐    🎨  │  ← Bottom tab bar
└──────────────────────────────┘
```

## 1.3 Core Pages

### Home (Discovery Store)

The main browse experience, inspired by CrazyGames's layout but darker and more alive.

Sections (in order):
1. **Hero Banner** — rotating featured games, large card with trailer-like preview (auto-plays game screenshot loop or a 5s captured GIF from validation)
2. **Category Quick Access** — horizontal scroll chips: All · Action · Puzzle · Racing · 3D · Multiplayer · New
3. **🔥 Trending Now** — 6-card grid, sorted by play count last 24h
4. **⚡ Just Created** — live feed of newest games, auto-refreshes every 30s
5. **🎮 3D Games** — dedicated row for Three.js games, prominent badge
6. **👥 Play With Friends** — multiplayer-enabled games only
7. **🧩 By Category** — each genre gets its own row

Card anatomy:
```
┌─────────────────────┐
│   [SCREENSHOT]      │  ← Auto-captured during validation
│   [PLAY ▶ on hover] │
├─────────────────────┤
│ Game Title          │
│ 🎮 Action · 3D      │  ← Engine + genre badges
│ ▶ 12.4k plays  ⭐ 847│  ← Play count + favourites
└─────────────────────┘
```

### Explore / Search Page

A full dedicated page for search and filtering, similar to CrazyGames's explore.

Features:
- Full-text search (searches title + description + tags via PostgreSQL `tsvector`)
- Filter bar: Genre, Engine (2D/3D), Multiplayer, Date Range, Sort (Popular/New/Trending)
- Infinite scroll results grid (masonry for variety)
- "No results" state with a CTA to generate the missing game

### Individual Game Page

When a user clicks a game from any feed, they land on a full-page game view:

```
┌──────────────────────────────────────────────────────┐
│  ← Back    Game Title           ⭐ Fave  👥 Multiplayer│
├──────────────────────────────────────────────────────┤
│                                                      │
│              [GAME IFRAME — FULLSCREEN]               │
│                                                      │
├──────────────────────────────────────────────────────┤
│ Description · Controls · Stats · Comments (future)   │
└──────────────────────────────────────────────────────┘
```

The game auto-starts in fullscreen. Pressing Escape or tapping the back arrow exits.

### Creator Profile Page

Every user who has created games gets a profile page:
- Avatar + username + join date
- "Games created: N" stat
- Grid of their published games
- Monthly earnings card (if creator subscriber) — shows current revenue balance

### Categories Page

One page per genre category. Same card grid layout. SEO-friendly slugs: `/category/action`, `/category/puzzle`, etc.

## 1.4 Component Library Additions

New components needed in `/packages/ui`:

| Component | Purpose |
|---|---|
| `GameCard` | Universal card for all grid views |
| `GameCardSkeleton` | Loading placeholder matching card exactly |
| `CategoryChip` | Genre pill with icon |
| `HeroBanner` | Rotating featured game spotlight |
| `SectionRow` | Titled horizontal scroll row |
| `SearchBar` | Debounced search with recent history |
| `FilterBar` | Multi-filter panel with active state |
| `GamePlayerShell` | Fullscreen iframe + control bar |
| `EarningsBadge` | Shows creator's current ad revenue |
| `AdSlot` | Wraps all ad placements uniformly |

---

# Part 2: TikTok-Style Infinite Scroll Feed

## 2.1 Architecture

The Feed page (`/feed`) is a separate experience from the Store. It's vertical, full-screen, one game at a time — like TikTok but for games.

### Core Design

```
┌────────────────────────────────┐
│  🎮 SLOPPY FEED      [🔍][👤] │  ← Minimal header
├────────────────────────────────┤
│                                │
│      [GAME PLAYS HERE]         │
│      Full viewport height      │
│      Full viewport width       │
│                                │
│  ┌──────────────────────────┐  │
│  │ ▶ Start  ⏸ Pause  🔄    │  │  ← Control bar (fades in on hover/tap)
│  └──────────────────────────┘  │
│                                │
│  Game Title · Action · 3D      │  ← Info overlay (bottom left)
│  ▶ 12,450 plays                │
│                   [⭐][👥][⋮] │  ← Action buttons (right side TikTok-style)
└────────────────────────────────┘
      ↕ Swipe/scroll to next game
```

## 2.2 Feed Loading Strategy (Non-Laggy)

This is the hardest part. The solution uses a **3-iframe sliding window**:

```
          Window position:
          
   [GAME N-1]  ← Preloaded, hidden above viewport (src already loaded)
   [GAME N  ]  ← ACTIVE: visible, playing, sound on
   [GAME N+1]  ← Preloaded, hidden below viewport (src already loaded)
   
   As user scrolls to N+1:
   - N-1 iframe src = '' (destroyed, memory freed)
   - N+1 becomes active
   - N+2 is created and preloaded in background
```

Implementation detail:

```typescript
// useFeedWindow.ts
const PRELOAD_AHEAD = 1;   // preload 1 game ahead
const KEEP_BEHIND = 0;     // destroy games behind immediately (memory)

// Each iframe in the sliding window:
// - position: fixed, translate3d for GPU-composited scrolling
// - visibility: hidden (not display:none — keeps DOM alive for faster reveal)
// - src: set as soon as game enters window; cleared when it leaves

// Game reveal is instant because:
// 1. The iframe is already loaded (just hidden)
// 2. We only reveal — no network fetch on scroll
// 3. We use CSS transform for scroll animation (GPU, no layout reflow)
```

## 2.3 Progress Saving

Every user (including anonymous) gets per-game progress saved. The mechanism:

**For anonymous users:** `localStorage` keyed by `gameId` + browser fingerprint.

**For logged-in users:** Synced to the backend. Schema:

```sql
CREATE TABLE game_progress (
  user_id       TEXT NOT NULL,
  game_id       UUID NOT NULL,
  progress_data JSONB,           -- game-specific state (score, level, etc.)
  play_time_ms  INTEGER DEFAULT 0,
  last_played   TIMESTAMPTZ DEFAULT NOW(),
  play_count    INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, game_id)
);
```

Games report progress to the parent shell via postMessage:

```javascript
// Inside game (game.js):
window.parent.postMessage({
  type: 'sloppy:progress',
  data: { score: 1250, level: 3, customState: { ... } }
}, '*');

// Shell saves this immediately to localStorage (for anonymous)
// and debounced to backend every 10s (for logged-in users)
```

On next visit to the same game, the shell sends the saved state back:

```javascript
iframe.contentWindow.postMessage({
  type: 'sloppy:restore',
  data: savedProgress
}, '*');
```

Games must implement `restoreProgress(data)` in their SDK v2 contract.

## 2.4 Feed Algorithm

The feed order is computed server-side and served as a paginated list. The algorithm:

```typescript
interface FeedScore {
  recencyScore: number;      // Decays over 7 days: e^(-age_days / 3)
  engagementScore: number;   // play_count * 0.4 + favourite_count * 0.6
  diversityPenalty: number;  // -0.5 if same genre as previous 2 games
  qualityScore: number;      // Passed validation level: 0.7 / 0.85 / 1.0
  randomNoise: number;       // Small random factor to prevent total staleness
}

// Final score = recencyScore * engagementScore * qualityScore 
//               - diversityPenalty + randomNoise
```

The feed endpoint returns 10 games at a time. The frontend requests the next page when the user reaches game N-2.

## 2.5 Sound Design

In the feed, audio is always muted by default (like TikTok). There's a persistent mute/unmute toggle in the top-right of the feed. Games must respect this:

```javascript
// Shell → game
window.postMessage({ type: 'sloppy:mute', muted: true }, '*');

// Games must implement:
setAudioMuted(muted: boolean): void;
```

---

# Part 3: Game Population Pipeline (Local Brainstorm Agent)

## 3.1 Overview

A local Node.js script (not a cloud service) that runs on your machine to continuously brainstorm game concepts, send them through the full generation pipeline, and populate the platform. You run it overnight or over a weekend to seed the initial library.

## 3.2 Architecture

```
services/game-population/
  src/
    brainstorm-agent.ts      ← Generates diverse game concepts
    batch-runner.ts          ← Queues and runs generations
    quality-filter.ts        ← Rejects obviously bad outputs
    cli.ts                   ← `pnpm populate --count=50 --genres=action,puzzle`
  config/
    seed-concepts.json       ← Hand-curated starting concepts
    genre-weights.json       ← How often each genre should appear
  logs/
    population-YYYY-MM-DD.log
```

## 3.3 The Brainstorm Agent

This agent is separate from the game generation pipeline. Its only job is to create a diverse, interesting list of game concepts.

**System prompt strategy:**

```
"You are a game concept generator for an AI-powered browser game platform.
Generate game concepts that are:
- Achievable in a single HTML file (Phaser 3 or Three.js)
- Completable in 2–10 minutes per session
- Immediately understandable (no tutorial needed beyond the title)
- Mechanically interesting but technically simple

For each concept output:
{
  "title": string,
  "tagline": string,          // One-line description
  "genre": GameGenre,
  "engine": "phaser3" | "threejs",
  "coreMechanic": string,     // What the player does every second
  "uniqueTwist": string,      // What makes this different from generic games
  "visualStyle": string,      // Specific art direction
  "estimatedComplexity": "simple" | "medium"  // Only simple/medium for batch
}

Generate 10 diverse concepts. Avoid: clones of famous games, 
overly complex simulations, games requiring more than 3 controls."
```

**Diversity enforcement:** After each batch of 10, the agent sees the last 20 concepts already generated and is told to avoid repeating genres or mechanics.

## 3.4 CLI Usage

```bash
# Populate 100 games across all genres
pnpm --filter=game-population populate --count=100

# Populate only 3D games, 20 of them, at slow pace (avoid rate limits)
pnpm --filter=game-population populate \
  --count=20 \
  --genres=3d \
  --delay-ms=30000 \
  --api-url=http://localhost:3001

# Dry run — just generate concepts, don't send to pipeline
pnpm --filter=game-population populate --count=50 --dry-run

# Resume from a failed run (skips already-generated game IDs)
pnpm --filter=game-population populate --count=100 --resume
```

## 3.5 Rate Limiting & Cost Control

The pipeline is expensive (each game = ~10–15 Claude API calls). The population script enforces:

- Default delay: 20 seconds between submissions (3 games/min max)
- Max concurrent in-flight: 2 (set by a local semaphore)
- Daily token budget: configurable via `MAX_DAILY_TOKENS=500000`
- Auto-pause if Claude API returns rate limit error (exponential backoff)

Estimated cost to populate 200 games: approximately $15–40 in API costs at current Claude pricing.

## 3.6 Quality Filter

After generation completes, before the game is published to the feed, the population script runs an additional quality check:

- Must have passed all 4 state screenshots (intro, playing, paused, gameover)
- Title must be unique (checked against existing game titles)
- Game bundle must be > 5KB (too small = placeholder output)
- Visual uniqueness: rejects if game's screenshot hash is >90% similar to an existing game (perceptual hash check)

Auto-publishes games that pass, marks others as `needs_review`.

---

# Part 4: Monetisation — Full Strategy

## 4.1 Revenue Architecture Overview

```
REVENUE STREAMS:
├── Creator Subscriptions ($5/month via Stripe)
├── Ad Revenue (display + video via ad networks)
│   ├── Platform keeps 50% of all ad revenue
│   └── Creator earns 50% of ad revenue attributed to their games
└── (Future) Premium game access / tipping
```

## 4.2 Ad Stack — Technology Decisions

After researching the HTML5 browser game ad ecosystem, here is the recommended stack:

### Primary Partner: AdinPlay / Venatus

**Why:** AdinPlay is the #1 ad platform specifically for HTML5 browser games. In 2023 they were acquired by Venatus, giving access to premium direct-sales campaigns (up to 10x RPM vs pure programmatic). They serve games like Paper.io, Gartic Phone, and Skribbl.io — exactly your audience profile. They offer: rewarded video, interstitials, banner ads, and site skins.

**Integration:** JavaScript SDK tag placed in the site shell and inside game iframes.

### Secondary / Fallback: Google AdSense (Display)

**Why:** For display ads in the sidebar, between sections on the store page, and as fill for any inventory AdinPlay doesn't cover. AdSense has near-100% fill rate globally.

### Video Ad Layer: Playwire (or AdinPlay's Video Player)

**Why:** For the TikTok-style feed, you need pre-game video ads that play before the game starts, exactly like YouTube pre-roll. Playwire offers a unified video player with programmatic + direct demand, Google Open Bidding, and Amazon TAM. Alternatively, AdinPlay's video player does the same within the Venatus ecosystem — start with AdinPlay and only add Playwire if you need extra fill.

### Mediation Strategy (Session RPM Optimization)

The key insight from research: **session RPM matters more than eCPM**. A 60% fill at $5 eCPM earns less than 85% fill at $4.50. Strategy:

```
Ad Inventory Priority Waterfall:
1. AdinPlay / Venatus DIRECT CAMPAIGNS     ← Highest RPM, 30%+ premium
2. AdinPlay Programmatic (header bidding)  ← Strong gaming fill
3. Google AdSense                          ← Fallback, near-100% fill
```

### Ad Placement Map

**Store / Browse Pages:**
- `728x90` leaderboard above fold (desktop sidebar top)
- `300x250` medium rectangle in right rail (desktop)
- `320x50` banner bottom of screen (mobile)
- `320x480` interstitial between game opens (max 1 per session)

**TikTok Feed (between games):**
- Pre-game video ad (15–30s skippable after 5s) — plays before game N+1 loads, every 3rd game
- `300x250` overlay briefly after game ends (before game over screen dismisses)

**Inside Games (in-game ads):**
- Rewarded video: game offers bonus lives/score in exchange for watching 30s ad
- This must be opt-in by the player, never forced
- Implemented via the AdinPlay SDK loaded inside the game iframe

**Creator Profile / Dashboard:**
- `728x90` leaderboard above earnings card (ironic but effective)

## 4.3 Ad SDK Integration Plan

### Step 1: AdinPlay Setup (Do This First)
1. Apply at adinplay.com (takes 2–4 weeks for approval — apply immediately)
2. While waiting: integrate Google AdSense as placeholders at the same slot positions
3. When approved: replace AdSense slots with AdinPlay tags (or A/B test)

```javascript
// packages/ui/src/components/AdSlot/AdSlot.tsx
// Unified ad slot component — swap provider without touching all pages

interface AdSlotProps {
  format: 'leaderboard' | 'rectangle' | 'mobile-banner' | 'interstitial' | 'rewarded-video';
  provider: 'adinplay' | 'adsense' | 'playwire';
  gameId?: string;  // For revenue attribution to creator
}
```

### Step 2: Revenue Attribution Tracking

Every ad impression must be attributed to either:
- **Platform inventory** (store pages, feed transitions): 100% to platform
- **Game inventory** (in-game rewarded, game page overlay): 50% creator / 50% platform

Attribution is tracked by:
- A custom `pub_id` parameter appended to ad tags per game page
- A server-side event when AdinPlay fires an impression callback

```typescript
// services/monetisation/src/attribution.ts
interface AdImpression {
  adProvider: 'adinplay' | 'adsense';
  format: AdFormat;
  gameId: string | null;      // null = platform inventory
  creatorId: string | null;   // null = platform inventory
  estimatedRevenue: number;   // From ad provider callback
  timestamp: Date;
}
```

**Important:** Ad networks report revenue in aggregate (monthly), not per-impression in real time. The attribution system estimates real-time allocation, then reconciles with actual monthly payouts when the ad network reports. This is standard practice.

## 4.4 Creator Subscription ($5/month via Stripe)

### What Creators Get

| Feature | Free | Creator ($5/month) |
|---|---|---|
| Browse & play games | ✅ | ✅ |
| Favourite games | ✅ | ✅ |
| Create games | ❌ | ✅ |
| Games per month | — | 20 |
| Revenue share on their games | — | ✅ 50% of ad revenue |
| Profile page | — | ✅ |
| Analytics dashboard | — | ✅ |
| Early access to new features | — | ✅ |

### Stripe Integration

Use **Stripe Billing** for the subscription + **Stripe Connect** for creator payouts.

```
PAYMENT FLOW:
User pays $5/month
    ↓
Stripe Billing charges the user's card
    ↓
Revenue lands in YOUR Stripe account (platform account)
    ↓
Platform tracks ad revenue attribution per creator
    ↓
When creator hits $60 threshold:
    → System prompts creator to connect Stripe Express account
    → Stripe Connect transfers creator's earned balance
    → Creator receives payout to their bank/card
```

### Stripe Connect Account Type: **Express**

Express accounts are the right choice here:
- Stripe handles KYC/identity verification (you don't have to build this)
- Stripe handles tax form generation (1099 in US, equivalents globally)
- Creators see a Stripe-hosted dashboard for their payouts
- You control the payout schedule (you want: manual, triggered at $60 threshold)

**Yes, Stripe can absolutely do what you've described.** Specifically:
- Stripe Connect Express handles the revenue-share payout mechanism
- Stripe supports minimum payout thresholds (you set $60)
- Creators can connect bank accounts, debit cards, and in supported markets: PayPal-equivalent local methods
- Stripe pays out in 50+ currencies globally

### Implementation Plan

```
services/payments/
  src/
    stripe/
      billing.ts          ← $5/month subscription management
      connect.ts          ← Creator account onboarding + payouts
      webhooks.ts         ← Handle payment events
    revenue/
      tracker.ts          ← Tracks ad attribution per creator
      calculator.ts       ← Computes creator balance
      payout-trigger.ts   ← Triggers when balance ≥ $60
    routes/
      subscription.ts     ← POST /subscribe, DELETE /cancel
      creator.ts          ← GET /earnings, POST /connect-stripe, POST /request-payout
```

Database additions:

```sql
-- Creator earnings tracking
CREATE TABLE creator_earnings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id      TEXT NOT NULL,
  game_id         UUID REFERENCES games(id),
  period_month    DATE NOT NULL,           -- First day of month
  gross_revenue   DECIMAL(10,2),           -- Total ad revenue attributed
  creator_share   DECIMAL(10,2),           -- 50% of gross
  platform_share  DECIMAL(10,2),           -- 50% of gross
  status          TEXT DEFAULT 'pending',  -- pending / confirmed / paid
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Creator Stripe accounts
CREATE TABLE creator_stripe_accounts (
  creator_id          TEXT PRIMARY KEY,
  stripe_account_id   TEXT UNIQUE,         -- Stripe Connect account ID
  onboarding_complete BOOLEAN DEFAULT FALSE,
  payout_balance      DECIMAL(10,2) DEFAULT 0,
  total_paid_out      DECIMAL(10,2) DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription state (Stripe webhook synced)
CREATE TABLE creator_subscriptions (
  creator_id          TEXT PRIMARY KEY,
  stripe_customer_id  TEXT,
  stripe_sub_id       TEXT,
  status              TEXT,    -- active / past_due / canceled
  current_period_end  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

## 4.5 Payout Flow in Detail

```
Monthly cycle:
1. Ad networks report monthly earnings (around 21st of following month)
2. Platform reconciles estimates vs actual
3. Creator balances are updated with confirmed amounts
4. Creators with balance ≥ $60 are notified via email

Creator requests payout:
1. Creator clicks "Withdraw $X" in their dashboard
2. If no Stripe account: redirect to Stripe Connect onboarding
3. If Stripe account exists: initiate transfer via Stripe Connect API
4. Stripe sends money to their bank/card within 1–5 business days
5. Balance zeroed, payout recorded

Stripe Connect Transfer API call:
```typescript
await stripe.transfers.create({
  amount: Math.floor(creatorBalance * 100), // cents
  currency: 'usd',
  destination: creatorStripeAccountId,
  metadata: { creatorId, period: 'March 2026' }
});
```

### The $60 Minimum — Why It Makes Sense

- Prevents micro-transfers (Stripe charges fees per transfer)
- Encourages creators to stay engaged (games must keep getting plays)
- Industry standard: YouTube pays at $100, similar platforms at $50–100
- At $0.50–$2.00 per 1000 plays (typical gaming eCPM), a creator needs ~30,000–120,000 plays to earn $60, which is achievable but meaningful

## 4.6 Revenue Share Brainstorm (Sub-Agent Analysis)

*The following is a deep analysis of the model options:*

### Option A: Flat 50/50 Split (Recommended for V1)
- Platform keeps 50%, creator earns 50% of all ad revenue their games generate
- Simple to explain, easy to calculate, no surprises
- Precedent: YouTube's creator split is 55/45 (creator/platform), Twitch is ~50/50
- **Recommended. Start here.**

### Option B: Tiered Split (Scale Incentive)
```
Monthly plays    | Creator share
< 10,000         | 30%
10,000 – 100,000 | 50%
> 100,000        | 60%
```
- Rewards popular games with better terms
- Incentivises creators to promote their games
- More complex to implement and explain
- **Introduce in V2 once you have data on play distributions.**

### Option C: Subscriber-Weighted Split
- Creator's share = base 50% + (subscriber tenure bonus: +2% per year, max +10%)
- Rewards loyal creators who stay on the platform
- Creates retention incentive for the $5/month subscription
- **Interesting but complex — defer to V3.**

### Option D: Creator Fund (Alternative to Ad Share)
- Platform pools X% of total ad revenue into a "Creator Fund"
- Distributed monthly based on each creator's % of total platform plays
- Pros: simplifies ad attribution (no per-game tracking needed)
- Cons: creators can't predict earnings, discourages top creators (diluted by new entries)
- Used by TikTok — widely criticized by creators. **Avoid.**

### Recommendation
Launch with Option A (50/50). Announce Option B on your roadmap as a growth incentive. Never use Option D.

---

# Part 5: Fullscreen & Responsive Game Playing

## 5.1 Fullscreen Architecture

Games must be fullscreen when played regardless of where they're opened (feed, store, direct link).

### Fullscreen Strategy: CSS + Fullscreen API

```typescript
// apps/web/src/hooks/useFullscreen.ts

const enterFullscreen = async (element: HTMLElement) => {
  try {
    // Modern API
    if (element.requestFullscreen) {
      await element.requestFullscreen();
    } else if ((element as any).webkitRequestFullscreen) {
      // Safari
      await (element as any).webkitRequestFullscreen();
    }
  } catch (e) {
    // Fallback: CSS viewport overlay (iOS Safari, some browsers)
    element.classList.add('sloppy-fullscreen-fallback');
  }
};

// CSS fallback (for iOS where Fullscreen API is restricted):
// .sloppy-fullscreen-fallback {
//   position: fixed;
//   inset: 0;
//   z-index: 9999;
//   background: #000;
// }
```

### Game Player Modes

```typescript
type GamePlayerMode = 
  | 'inline'       // Embedded in a card (feed preview, max 300px tall)
  | 'overlay'      // Full-viewport overlay with dark backdrop
  | 'fullscreen';  // Browser native fullscreen (no browser chrome)

// On game click/open:
// 1. Desktop: enter 'fullscreen' mode
// 2. Mobile: enter 'overlay' mode (iOS Fullscreen API is unreliable)
// 3. Feed: games play in 'overlay' on scroll, auto switch to fullscreen on tap
```

## 5.2 Responsive Game Scaling

Games are designed at a fixed internal resolution but must fill any screen size. The scaling is handled by the `GamePlayerShell` component, not the game itself.

```typescript
// GamePlayerShell handles scaling via CSS:

// The iframe is always at its "native" resolution internally.
// The shell scales it to fill the viewport using CSS transform: scale()
// This avoids games needing to handle responsive layouts.

const getScaleTransform = (
  gameWidth: number,    // From game's config.json
  gameHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  mode: 'fit' | 'fill'
): string => {
  const scaleX = viewportWidth / gameWidth;
  const scaleY = viewportHeight / gameHeight;
  const scale = mode === 'fit' 
    ? Math.min(scaleX, scaleY)   // Letterbox/pillarbox
    : Math.max(scaleX, scaleY);  // Fill, may crop edges
  return `scale(${scale})`;
};
```

### Resolution Presets in Game Config

Games declare their preferred resolution in `config.json`:

```json
{
  "resolution": {
    "width": 960,
    "height": 540,
    "scaleMode": "fit"  // "fit" | "fill" | "stretch"
  }
}
```

Standard resolutions to use in prompts:
- 2D games: `960×540` (16:9, good for most)
- 3D games: `1280×720` (more pixels = better 3D quality)
- Mobile-first games: `414×896` (iPhone-like portrait)

## 5.3 Mobile Touch Controls

3D and 2D games need to handle touch. The SDK v2 must include a touch control layer:

```typescript
// packages/runtime-sdk/src/v2/touch-controls.ts

interface TouchControlConfig {
  type: 'joystick' | 'd-pad' | 'tap-zones' | 'gesture' | 'custom';
  layout: TouchLayout;
}

// Injected into every game that declares mobile support.
// The game receives normalized input regardless of whether it's 
// keyboard or touch — no per-game touch handling needed.
```

The AI prompt must include touch controls in the game design for any genre that will be played on mobile. The Technical Planner agent determines whether a joystick, d-pad, or tap-zones are appropriate.

---

# Part 6: Implementation Sequence

## Recommended Build Order

| Phase | Duration | What | Why Now |
|---|---|---|---|
| **Phase A** | 1 week | Apply to AdinPlay/Venatus immediately | Takes 2–4 weeks to approve; start now |
| **Phase B** | 2 weeks | Fullscreen + responsive scaling | Foundation for everything else |
| **Phase C** | 2 weeks | Store UI (Home, Explore, Game Page) | Makes the platform feel real |
| **Phase D** | 2 weeks | TikTok Feed with 3-iframe preload | Core differentiator |
| **Phase E** | 1 week | Game population pipeline | Populate library while building monetisation |
| **Phase F** | 2 weeks | Stripe Billing ($5/month) | Revenue foundation |
| **Phase G** | 2 weeks | Ad integration (AdSense first, AdinPlay when approved) | Revenue |
| **Phase H** | 2 weeks | Stripe Connect creator payouts | Completes the revenue-share loop |
| **Phase I** | 1 week | Creator earnings dashboard | Makes the model visible to creators |

Total: ~15 weeks to full feature parity.

---

# Part 7: New Services & File Changes

## New Service: `services/payments`

Handles all money: subscriptions, ad attribution, creator payouts.

```
services/payments/
  src/
    routes/
      subscription.ts   ← POST /subscribe, GET /status, DELETE /cancel
      earnings.ts       ← GET /earnings (creator), GET /balance
      payout.ts         ← POST /connect-stripe, POST /request-payout
      webhooks.ts       ← Stripe webhook handler (events: invoice.paid, transfer.created)
    lib/
      stripe.ts         ← Stripe SDK singleton
      attribution.ts    ← Ad revenue → creator mapping
      calculator.ts     ← Balance computation
```

## New Frontend Pages

```
apps/web/src/pages/
  Feed.tsx             ← TikTok-style scroll feed (major new page)
  Explore.tsx          ← Search + filter browse
  Category.tsx         ← Per-genre page
  Game.tsx             ← Individual game fullscreen page
  Creator.tsx          ← Creator profile page
  Dashboard/
    Earnings.tsx       ← Creator earnings + withdrawal
    MyGames.tsx        ← Creator's games with stats
    Settings.tsx       ← Subscription management
```

## New Database Tables

```sql
-- Already mentioned: game_progress, creator_earnings, 
-- creator_stripe_accounts, creator_subscriptions

-- New: search index
ALTER TABLE games ADD COLUMN search_vector tsvector 
  GENERATED ALWAYS AS (
    to_tsvector('english', title || ' ' || description)
  ) STORED;
CREATE INDEX games_search_idx ON games USING GIN(search_vector);

-- New: feed analytics
CREATE TABLE feed_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT,
  game_id     UUID REFERENCES games(id),
  event_type  TEXT,   -- 'view' | 'play_start' | 'play_time' | 'skip' | 'favourite'
  duration_ms INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
-- Used to compute trending score and feed algorithm weights
```

---

# Quick Reference: Ad Network Contacts

| Network | Best For | Apply At | Approval Time |
|---|---|---|---|
| **AdinPlay / Venatus** | In-game rewarded video, interstitials, skins | adinplay.com/publishers | 2–4 weeks |
| **Playwire** | Pre-game video ads, full ad stack | playwire.com | 2–3 weeks |
| **Google AdSense** | Display fill, immediate start | adsense.google.com | Days |
| **NitroPay** | Gaming-native, self-serve | nitropay.com | 1 week |

**Recommendation:** Apply to AdinPlay and Playwire today (before building anything). Use AdSense as immediate placeholder. Swap to AdinPlay when approved.

---

# Summary: What You're Building

After these 5 additions, Sloppy becomes:

1. **A game store** — Dark, premium, CrazyGames-inspired UI with categories, search, featured games, and creator profiles
2. **A TikTok for games** — Full-viewport vertical feed with 3-iframe preload for lag-free infinite scrolling, with per-game progress saving
3. **A self-populating platform** — A local CLI agent that brainstorms and mass-generates games to seed the library
4. **A monetised marketplace** — $5/month creator subscriptions via Stripe Billing, ad revenue via AdinPlay/Venatus, and 50/50 revenue sharing via Stripe Connect Express with a $60 payout threshold
5. **A true game platform** — Every game plays fullscreen, scales responsively to any device, and supports touch controls on mobile