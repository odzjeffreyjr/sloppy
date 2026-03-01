# Sloppy

AI-powered browser game platform. Users generate games with natural language prompts, and games are instantly playable in a scrollable feed.

## Tech Stack

- **Frontend:** React (Vite), Zustand, TailwindCSS, Framer Motion
- **Backend:** Node.js services on Google Cloud Run
- **Database:** PostgreSQL
- **Auth:** Firebase Auth
- **Multiplayer:** WebSocket server + Redis
- **AI:** Orchestrator service calling LLM APIs
- **Desktop:** Electron wrapper

## Monorepo Structure

```
/sloppy
  /apps
    /web              — React (Vite) frontend
    /electron         — Electron wrapper
  /services
    /api-gateway      — Cloud Run API gateway
    /auth             — Auth service (Firebase)
    /ai-orchestrator  — AI prompt → game pipeline
    /game-builder     — Game validation, storage, sandboxing
    /multiplayer      — WebSocket server + room management
  /packages
    /runtime-sdk      — Game runtime contract/SDK
    /multiplayer-sdk  — Multiplayer client SDK
    /ui               — Shared UI components
    /shared           — Shared types, utils, constants
  /infra
    /terraform
  /docs
```

## Prerequisites

- Node.js >= 20
- pnpm >= 9

## Setup

```bash
# Install dependencies
pnpm install

# Start all services in dev mode
pnpm dev

# Build everything
pnpm build

# Lint
pnpm lint

# Format code
pnpm format
```
