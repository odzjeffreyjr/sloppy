# 🎮 SLOPPY v1

### AI-Generated No-Effort Browser Games

> Instant. Chaotic. Playable. Scrollable.

---

# 1. Product Definition

Sloppy is a cross-platform AI-powered game platform where:

* Users generate games with natural language
* Games are instantly playable in browser
* Home page is a **scrollable feed of playable games**
* Users can favourite games
* Multiplayer sessions can be created for supported games
* Everything is light, chaotic, playful, sloppy

No monetization.
No ads.
No boosts.
Focus: experience + engagement + scale.

---

# 2. Core User Flows

---

## 2.1 First-Time User

1. Loads app
2. Sloppy chaotic intro GIF plays
3. Music fades in
4. Lands on Home Feed
5. Scrolls through playable games
6. Taps one → full screen playable instantly

---

## 2.2 Create Flow

1. Click “Create”
2. Enter natural language prompt
3. AI generates:

   * Game logic
   * Assets
   * Optional music
4. Game loads in full screen
5. User can:

   * Iterate with AI
   * Click objects → refine via chat popup
   * Save
   * Publish to feed

---

## 2.3 Favourites Flow

1. User favourites games
2. Stored in user profile
3. Accessible via Favourites tab
4. Can replay anytime

---

## 2.4 Multiplayer Flow (Optional Per Game)

1. Click “Multiplayer”
2. Create session
3. Share session ID
4. Real-time synced gameplay

---

# 3. Platform Targets

* Web App (Primary)
* Electron Wrapper (Mac, Windows, Linux)
* PWA enabled

Electron simply loads the web build.

---

# 4. System Architecture

---

## 4.1 High-Level

```
Client (React + Electron)
        ↓
API Gateway (Cloud Run)
        ↓
Core Backend Services
        ↓
AI Orchestrator
        ↓
Game Builder
        ↓
Storage + CDN
        ↓
Multiplayer Engine
```

Hosted entirely on Google Cloud.

---

# 5. Frontend Architecture

---

## 5.1 Stack

* React (Vite)
* Zustand (state management)
* TailwindCSS (light playful theme)
* WebSockets (multiplayer)
* PixiJS or Phaser (game runtime)
* Web Audio API
* Framer Motion (sloppy animations)

---

## 5.2 Core Pages

### 🏠 Home (Scrollable Feed)

* Vertical infinite scroll
* Each card:

  * Title
  * Play count
  * “Play” button
  * Favourite button
* Clicking opens full screen overlay
* Preload next game for smooth scrolling

---

### 🎨 Create Page

* Prompt input
* Model selection (internal routing)
* “Generate Game”
* Live streaming AI progress
* Game preview container
* Chat refinement panel
* Save button

---

### ⭐ Favourites Page

* List of saved games
* Sort by:

  * Most played
  * Recently favourited
* Replay instantly

---

# 6. Backend Services

---

## 6.1 API Gateway

Responsibilities:

* Auth validation
* Rate limiting
* Request routing
* Logging

---

## 6.2 Auth Service

Use:

* Firebase Auth

Features:

* Email login
* Google login
* Anonymous guest sessions
* JWT verification

---

## 6.3 AI Orchestrator Service

Responsibilities:

* Accept prompt
* Break into structured generation phases
* Stream output
* Enforce token limits
* Validate output format

Phases:

1. Game concept design
2. Game runtime code
3. Asset generation
4. Multiplayer injection (if requested)
5. Music generation (optional)

---

## 6.4 Game Builder Service

Every generated game must follow strict SDK interface.

Standard structure:

```
/game
  index.html
  game.js
  multiplayer.js
  config.json
  /assets
  /audio
```

Runtime contract:

```js
window.SloppyGame = {
  init(container),
  update(deltaTime),
  destroy(),
  supportsMultiplayer: boolean,
  getInitialState(),
  applyPlayerInput(),
  updateState(),
  serializeState()
}
```

All games must use Sloppy Runtime SDK.

---

# 7. Game Runtime & Security

---

## 7.1 Sandboxing

All games run in:

* iframe
* sandbox="allow-scripts"
* Strict CSP:

  * No external fetch
  * No inline eval
  * No DOM escape

---

## 7.2 Validation Pipeline

Before saving game:

* Check required interface
* Lint JS
* Reject unsafe code patterns
* Enforce size limits

---

# 8. Multiplayer Architecture

---

## 8.1 Authoritative Server Model

Clients do NOT trust each other.

Architecture:

```
Client A
Client B
Client C
      ↓
WebSocket Server
      ↓
Room Manager
      ↓
Authoritative State (Redis)
```

---

## 8.2 Player Schema

```js
{
  id: string,
  x: number,
  y: number,
  velocity: number,
  health: number,
  score: number
}
```

---

## 8.3 Session Isolation

Each multiplayer session:

* Unique ID
* Dedicated Redis namespace
* TTL expiration
* Cleanup on inactivity

---

# 9. Scrollable Game Feed Engine

---

## 9.1 Game Feed Strategy

Home feed sorted by:

* Recent creations
* Engagement score
* Random injection

Preload:

* Next 2 games
* Audio muted until focused

Game loads instantly on scroll stop.

---

## 9.2 Performance Rules

* Max game size limit
* Asset compression
* Lazy load assets
* Audio streaming

---

# 10. Database Design (Postgres)

---

## Users

* id
* email
* created_at

---

## Games

* id
* creator_id
* title
* description
* slug
* supports_multiplayer
* version
* created_at
* updated_at

---

## Favourites

* user_id
* game_id
* created_at

---

## Sessions

* id
* game_id
* status
* created_at

---

# 11. Rate Limiting Strategy (Critical)

You must protect AI costs.

Per User:

* Max games per hour
* Max tokens per day
* Max concurrent generations

Global:

* Queue overflow protection
* Background task prioritization

If limit exceeded:

* Graceful error
* Suggest retry later

---

# 12. Observability

Implement from day one:

* Centralized logs
* Error tracking
* AI cost tracking
* WebSocket monitoring
* Game crash detection
* Generation failure metrics

---

# 13. Folder Structure (Monorepo)

```
/sloppy
  /apps
    /web
    /electron
  /services
    /api-gateway
    /auth
    /ai-orchestrator
    /game-builder
    /multiplayer
  /packages
    /runtime-sdk
    /multiplayer-sdk
    /ui
  /infra
    /terraform
  /docs
```

---

# 14. UI Design System

Theme:

* Light background
* Neon pastel highlights
* Slight misalignment effects
* Wiggly hover animations
* Sloppy handwritten headings
* Continuous subtle background music

Core Principle:
Fun > Clean
Playful > Professional
Chaotic > Polished

---

# 15. V1 Scope (Strict)

Must Have:

* Scrollable playable feed
* Prompt → playable game
* Favourites
* Secure sandbox
* Rate limiting
* Basic multiplayer support

Not in V1:

* Monetization
* Ads
* Boosts
* Custom domains
* Ranking payments
* Complex creator dashboards

---

# 16. Critical Risks

* AI cost blowout
* Game runtime security vulnerabilities
* Multiplayer sync instability
* Too many low-quality games flooding feed
* No retention

Mitigation:

* Hard rate limits
* Quality validation filters
* Simple ranking algorithm
* Monitor engagement metrics
