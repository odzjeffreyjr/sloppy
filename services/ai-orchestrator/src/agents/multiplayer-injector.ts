import { createLogger } from '@sloppy/logger';
import type { LLMClient } from '../llm/index.js';
import type { GameDesignDocument, ProgressCallback } from '../pipeline/types.js';

const log = createLogger('multiplayer-injector');

const MULTIPLAYER_SDK_API = `
## @sloppy/multiplayer-sdk API

The multiplayer SDK is loaded via CDN at runtime. The game accesses it via a global:

\`\`\`js
// The MultiplayerClient is available as window.SloppyMultiplayer
const mp = new window.SloppyMultiplayer({
  serverUrl: 'wss://mp.sloppy.app',
});

// Connect to a session
mp.connect(sessionId, playerId);

// Send player input to the server (keep payloads small)
mp.sendInput({ type: 'move', x: 100, y: 200 });
mp.sendInput({ type: 'action', action: 'shoot', angle: 1.57 });

// Receive authoritative state updates from the server
mp.onStateUpdate((state) => {
  // state = { gameState: {...}, players: { [playerId]: {...} } }
  // Update all game objects to match the authoritative state
});

// Handle player join/leave
mp.onPlayerJoin((playerId) => { /* create visual for new player */ });
mp.onPlayerLeave((playerId) => { /* remove visual for departed player */ });

// Connection state changes
mp.onConnectionChange((state) => {
  // state: 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
});

// Disconnect
mp.disconnect();
\`\`\`

### Server Protocol
- Client sends \`c2s:input\` events with player input data
- Server broadcasts \`s2c:state_update\` with \`{ gameState, players }\`
- Server sends \`s2c:player_join\` and \`s2c:player_leave\` with playerId
- State is stored in Redis — the server runs an authoritative tick loop
`;

const MULTIPLAYER_HOOKS_CONTRACT = `
## MultiplayerHooks Contract

The game's \`window.SloppyGame\` object must have a \`multiplayerHooks\` property implementing:

\`\`\`js
window.SloppyGame.multiplayerHooks = {
  // Return the initial shared game state (plain serializable object)
  getInitialState() {
    return { players: {}, tick: 0 };
  },

  // Apply a single player's input to the local game state
  // Called when the server relays inputs (input-relay) or for local prediction
  applyPlayerInput(playerId, input) {
    // e.g. update player position, fire projectile, play card
  },

  // Receive the full authoritative state from the server and update the game
  // This is the primary sync mechanism for state-sync strategy
  updateState(state) {
    // e.g. update all player positions, scores, game objects
  },

  // Serialize the current local state for transmission to the server
  serializeState() {
    return { /* plain serializable object */ };
  },

  // Handle a new player joining — create their visual representation
  onPlayerJoin(playerId) {
    // e.g. spawn a player sprite/mesh, add to players map
  },

  // Handle a player leaving — clean up their visual representation
  onPlayerLeave(playerId) {
    // e.g. destroy sprite/mesh, remove from players map
  },
};

// MUST set this to true
window.SloppyGame.supportsMultiplayer = true;
\`\`\`
`;

function buildSystemPrompt(gdd: GameDesignDocument): string {
  const syncStrategy = gdd.multiplayer.syncStrategy ?? 'state-sync';
  const mode = gdd.multiplayer.mode ?? 'competitive';
  const maxPlayers = gdd.multiplayer.maxPlayers ?? 4;
  const engine = gdd.engine;

  const engineVisualGuidance = engine === 'phaser3'
    ? `
### Engine-Specific Guidance (Phaser 3)
- Create additional sprites/graphics for remote players in the game scene
- Use a \`remotePlayers\` map (Map<string, Phaser.GameObjects.Sprite>) to track other players
- On \`updateState\`: iterate the players object, update each remote player's position/animation
- On \`onPlayerJoin\`: create a new sprite with a tinted color or name label to distinguish
- On \`onPlayerLeave\`: destroy the sprite and remove from map
- For competitive: show all players' scores in the HUD
- For cooperative: show shared health/progress
- Use Phaser's built-in tween system for smooth interpolation of remote player movement
`
    : `
### Engine-Specific Guidance (Three.js)
- Create additional meshes for remote players using the same geometry/material pattern as the local player
- Use a \`remotePlayers\` Map<string, THREE.Group> to track other players' 3D objects
- On \`updateState\`: lerp remote player positions toward their authoritative positions for smooth movement
- On \`onPlayerJoin\`: create a new mesh group with a different color material + floating name label (HTML overlay or sprite)
- On \`onPlayerLeave\`: remove mesh from scene, dispose geometry/material, delete from map
- For competitive: update HUD overlay with all players' scores
- For cooperative: show shared objectives/health
- Pre-allocate reusable Vector3 instances for position interpolation — never allocate in the game loop
`;

  return `You are the Multiplayer Injector for Sloppy, an AI-powered browser game platform. Your job is to take a working single-player game and add multiplayer support ON TOP of the existing code.

## Critical Rules
1. **DO NOT rewrite the game.** You are ADDING multiplayer, not rebuilding.
2. **DO NOT break single-player functionality.** The game must still work perfectly as a single-player experience when no other players are connected.
3. **DO NOT remove or modify the existing SDK v2 contract** — all 12 lifecycle methods, metadata, screens, and state introspection must remain intact.
4. **DO NOT change the game logic, scoring system, or state machine transitions.**
5. **Preserve ALL existing code.** Only ADD new code blocks, variables, and hook implementations.
6. The output must be the COMPLETE HTML file (starting with \`<!DOCTYPE html>\`). Do not output partial code or just the changes.

## What You Are Adding
- The \`multiplayerHooks\` object on \`window.SloppyGame\`
- Set \`window.SloppyGame.supportsMultiplayer = true\`
- Visual representations of remote players (sprites, meshes, labels)
- Connection setup code that activates when multiplayer session params are present
- HUD updates showing other players' scores/status

## Game Context
- **Title:** ${gdd.title}
- **Engine:** ${engine}
- **Genre:** ${gdd.genre}
- **Multiplayer Mode:** ${mode}
- **Max Players:** ${maxPlayers}
- **Sync Strategy:** ${syncStrategy}
- **Core Mechanic:** ${gdd.coreMechanic}

## Sync Strategy: ${syncStrategy}
${syncStrategy === 'state-sync' ? `
State-sync means the server sends full authoritative state snapshots at its tick rate (~20Hz).
- \`updateState(state)\` is the PRIMARY method — it receives the full game state from the server
- \`serializeState()\` packages local state for the server
- \`applyPlayerInput()\` applies inputs locally for prediction before server confirmation
- Remote player positions should be interpolated (lerp) between state updates for smoothness
- The local player's input is sent to the server AND applied locally for instant feedback
` : syncStrategy === 'input-relay' ? `
Input-relay means the server relays all player inputs to all clients, and each client simulates independently.
- \`applyPlayerInput()\` is the PRIMARY method — it must apply any player's input deterministically
- \`sendInput()\` sends the local player's input to the server for relay
- Game logic must be deterministic — same inputs must produce same results on all clients
- \`updateState()\` is used for periodic state correction/reconciliation
- Remote player inputs arrive with minimal latency for responsive feel
` : `
Lockstep means all clients advance in synchronized steps, waiting for all inputs.
- The game pauses each frame until all player inputs for that step are received
- \`applyPlayerInput()\` applies inputs in a deterministic order (sorted by playerId)
- \`updateState()\` receives the synchronized state at each step
- This guarantees identical state across all clients
- Input delay is expected — the game should feel deliberate (strategy, puzzle)
`}

${MULTIPLAYER_SDK_API}

${MULTIPLAYER_HOOKS_CONTRACT}

${engineVisualGuidance}

## Connection Initialization Pattern
Add this pattern to the game's \`init()\` or \`start()\` method:

\`\`\`js
// Check URL params for multiplayer session
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('sessionId');
const playerId = urlParams.get('playerId');

if (sessionId && playerId && window.SloppyMultiplayer) {
  const mp = new window.SloppyMultiplayer({ serverUrl: 'wss://mp.sloppy.app' });
  mp.connect(sessionId, playerId);

  mp.onStateUpdate((state) => {
    window.SloppyGame.multiplayerHooks.updateState(state);
  });

  mp.onPlayerJoin((id) => {
    window.SloppyGame.multiplayerHooks.onPlayerJoin(id);
  });

  mp.onPlayerLeave((id) => {
    window.SloppyGame.multiplayerHooks.onPlayerLeave(id);
  });

  // Store reference for sending inputs
  window._sloppyMp = mp;
  window._sloppyPlayerId = playerId;
}
\`\`\`

Then, wherever the local player produces input (keydown, mouse move, etc.), also send it:
\`\`\`js
if (window._sloppyMp) {
  window._sloppyMp.sendInput({ type: 'move', x: player.x, y: player.y });
}
\`\`\`

## Output Format
Return the COMPLETE modified HTML file. No markdown fences, no explanations — just the raw HTML starting with \`<!DOCTYPE html>\`.`;
}

function buildUserPrompt(code: string, gdd: GameDesignDocument): string {
  const mode = gdd.multiplayer.mode ?? 'competitive';
  const maxPlayers = gdd.multiplayer.maxPlayers ?? 4;

  return `Add multiplayer support to this working single-player game.

**Multiplayer requirements:**
- Mode: ${mode}
- Max players: ${maxPlayers}
- ${gdd.multiplayer.description ?? 'Standard multiplayer implementation'}

**The game code (complete HTML):**

${code}

Add the multiplayerHooks object, set supportsMultiplayer to true, add remote player visuals, and add the connection initialization. Return the COMPLETE modified HTML.`;
}

export async function runMultiplayerInjector(
  code: string,
  gdd: GameDesignDocument,
  llm: LLMClient,
  onProgress: ProgressCallback,
  maxTokens: number,
): Promise<{ code: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
  log.info({ title: gdd.title, mode: gdd.multiplayer.mode, syncStrategy: gdd.multiplayer.syncStrategy }, 'starting multiplayer injection');

  onProgress('multiplayer', 10, 'Injecting multiplayer hooks…');

  const systemPrompt = buildSystemPrompt(gdd);
  const userPrompt = buildUserPrompt(code, gdd);

  const response = await llm.generateText(
    systemPrompt,
    userPrompt,
    maxTokens,
  );

  let injectedCode = response.content
    .replace(/^```(?:html|javascript|js)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();

  if (!injectedCode.includes('<!DOCTYPE html>') && !injectedCode.includes('<!doctype html>')) {
    log.warn('Multiplayer injector output missing DOCTYPE — may be partial');
  }

  if (!injectedCode.includes('multiplayerHooks')) {
    log.error('Multiplayer injector output missing multiplayerHooks — falling back to original');
    onProgress('multiplayer', 100, 'Multiplayer injection failed — missing hooks');
    return { code, usage: response.usage };
  }

  if (!injectedCode.includes('supportsMultiplayer')) {
    log.warn('Multiplayer injector output missing supportsMultiplayer flag — may need manual fix');
  }

  if (!injectedCode.includes('window.SloppyGame') || !injectedCode.includes('window.game')) {
    log.error('Multiplayer injector broke SDK contract — falling back to original');
    onProgress('multiplayer', 100, 'Multiplayer injection broke SDK contract — using single-player');
    return { code, usage: response.usage };
  }

  log.info('multiplayer injection complete');
  onProgress('multiplayer', 90, 'Multiplayer hooks injected');

  return { code: injectedCode, usage: response.usage };
}
