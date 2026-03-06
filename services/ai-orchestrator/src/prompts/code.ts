import type { GameDesignDocument, TechnicalSpec } from '../pipeline/types.js';
import { getEnginePrompt } from './engines/index.js';
import { getGenrePrompt } from './genres/index.js';
import { getScreenPrompts } from './screens/index.js';

// ---------------------------------------------------------------------------
// SDK v2 contract definition embedded in prompts
// ---------------------------------------------------------------------------

const SDK_V2_CONTRACT = `## SDK v2 Contract — window.SloppyGame

The generated HTML must assign a game object to \`window.SloppyGame\` that implements ALL of the following:

### Lifecycle Methods
- \`init(container: HTMLElement, config: { container, width, height }): Promise<void>\` — Create the engine, set up the scene inside the container. Called once. MUST resolve a Promise. After init completes, post: \`window.parent.postMessage({ type: 'sloppy:game:ready' }, '*');\`
- \`destroy(): void\` — Tear down everything: engine instance, event listeners, timers, DOM nodes, GPU resources.

### State Machine Methods (states: idle → intro → playing → paused → gameover)
- \`start(): void\` — Transition to playing. Begin the game loop.
- \`pause(): void\` — Freeze gameplay. Show pause overlay.
- \`resume(): void\` — Unfreeze gameplay. Hide pause overlay.
- \`restart(): void\` — Reset all game state, transition to playing.

### Screen Rendering Methods
- \`renderIntroScreen(): void\` — Show title screen with game name, controls, and start prompt.
- \`renderPauseScreen(): void\` — Show pause overlay with resume option.
- \`renderGameOverScreen(score: { score, level?, timeElapsed, customData? }): void\` — Show game-over screen with final score and replay option.
- \`renderHUD(): void\` — Update the in-game heads-up display (score, lives, timer, etc.).

### State Introspection
- \`getState(): string\` — Return current state: 'idle' | 'intro' | 'playing' | 'paused' | 'gameover'.
- \`getScore(): { score: number, level?: number, timeElapsed: number, customData?: object }\` — Return current score snapshot.

### Static Properties
- \`metadata: { title, genre, engine, supportsMultiplayer, maxPlayers?, controls: [{ key, action }], estimatedPlayTime }\` — Readonly object.
- \`supportsMultiplayer: boolean\` — Whether this game supports multiplayer.

### Required Assignment
\`\`\`js
window.SloppyGame = {
  init, destroy, start, pause, resume, restart,
  renderIntroScreen, renderPauseScreen, renderGameOverScreen, renderHUD,
  getState, getScore,
  metadata: { title: '...', genre: '...', engine: '...', supportsMultiplayer: false, controls: [...], estimatedPlayTime: '...' },
  supportsMultiplayer: false
};
\`\`\`

The game object must ALSO be accessible as \`window.game\` for runtime validation:
\`\`\`js
window.game = window.SloppyGame;
\`\`\`
`;

const AUDIO_RULES = `## Audio Rules

### Sound Effects (ZzFX Procedural Audio)
- ALWAYS initialize the ZzFX micro engine at the top of the inline script — it's ~900 bytes of inline JS, no external dependency
- ALWAYS include the SFX preset map after the ZzFX engine
- ALWAYS include the AudioManager factory and initialize it: \`const audioManager = createAudioManager();\`
- NEVER use \`new Audio()\` or raw \`AudioContext\` directly — use only zzfx() and AudioManager
- Every player action MUST have a sound response — movement, collection, damage, UI interaction
- Required sounds for ALL games: jump/move, collect/score, hurt/die, game-over, level-up
- For 3D games: use THREE.AudioListener + THREE.PositionalAudio for spatial sounds attached to game objects (explosions, footsteps)
- All audio MUST be paused when game.pause() is called (call \`audioManager.onPause()\`)
- All audio MUST resume when game.resume() is called (call \`audioManager.onResume()\`)
- All audio MUST be cleaned up in destroy() (call \`audioManager.onDestroy()\`)
- Audio context is created on first user interaction automatically — do NOT manually create AudioContext

### ZzFX Usage Pattern
\`\`\`javascript
// Play a preset sound:
zzfx(...SFX.jump);    // Player jump
zzfx(...SFX.coin);    // Collect item
zzfx(...SFX.hit);     // Take damage
zzfx(...SFX.gameOver); // Game over
zzfx(...SFX.select);  // UI button click

// Or use AudioManager for pause/mute support:
audioManager.play('jump');
\`\`\`

### Feed Mute Integration
The AudioManager automatically listens for postMessage events from the feed:
- \`sloppy:mute\` → mutes all game audio
- \`sloppy:unmute\` → unmutes all game audio
No additional code needed — just initialize the AudioManager.
`;

const CHAIN_OF_THOUGHT = `## Chain of Thought — THINK BEFORE CODING

Before writing ANY code, reason through these questions (include your reasoning as a comment block at the top of your script):

1. **Game Loop Structure** — What is the core update cycle? What gets updated each frame? What triggers state transitions?
2. **Scenes / Modules** — What logical sections does the code need? How do they interact?
3. **State Machine Mapping** — How does each SDK lifecycle method map to engine-specific calls? What happens to the game loop in each state?
4. **Object Management** — What game objects exist? How are they created, pooled, and destroyed? What collision detection is needed?
5. **Screen Rendering** — What does each screen (intro, pause, game-over, HUD) look like? How are they shown/hidden?
`;

const OUTPUT_FORMAT = `## Output Format

You MUST output a COMPLETE, SELF-CONTAINED HTML file. The response must:
1. Start with \`<!DOCTYPE html>\`
2. Include the engine CDN \`<script>\` tag in \`<head>\`
3. Include all game code inline in a \`<script>\` tag in \`<body>\`
4. Include necessary CSS for full-viewport layout
5. Assign the game object to \`window.SloppyGame\` AND \`window.game\`
6. Call \`window.parent.postMessage({ type: 'sloppy:game:ready' }, '*')\` after init completes
7. Include error handling that posts errors to parent: \`window.parent.postMessage({ type: 'sloppy:game:error', message, stack }, '*')\`

Output ONLY the HTML. No markdown fences, no explanations, no surrounding text. Just the raw HTML starting with \`<!DOCTYPE html>\`.

FORBIDDEN — the following will cause immediate rejection:
- \`eval()\` or \`new Function()\`
- \`fetch()\` to any external URL
- \`document.cookie\` access
- \`importScripts()\`
- Loading external asset files (images, audio, models, textures) — ALL visuals must be procedural
- Module imports (\`import\` / \`require\`) — everything must be inline
`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the complete system prompt for code generation by composing:
 * SDK v2 contract + engine-specific guide + quality rules + forbidden patterns +
 * chain-of-thought instruction + output format.
 */
export function buildCodeSystemPrompt(
  gdd: GameDesignDocument,
  spec: TechnicalSpec,
): string {
  const enginePrompt = getEnginePrompt(gdd.engine);
  const genrePrompt = getGenrePrompt(gdd.genre);
  const screenPrompts = getScreenPrompts();

  return [
    `You are Sloppy, an expert browser game developer. You generate complete, self-contained HTML games using ${gdd.engine === 'phaser3' ? 'Phaser 3' : 'Three.js'}.`,
    '',
    SDK_V2_CONTRACT,
    enginePrompt.systemPrompt,
    genrePrompt,
    `## Screen Rendering Templates\n\n${screenPrompts.intro}\n\n${screenPrompts.pause}\n\n${screenPrompts.gameover}\n\n${screenPrompts.hud}`,
    AUDIO_RULES,
    enginePrompt.qualityRules,
    enginePrompt.forbiddenPatterns,
    CHAIN_OF_THOUGHT,
    OUTPUT_FORMAT,
  ].join('\n');
}

/**
 * Build the user prompt from the GDD + TechnicalSpec.
 */
export function buildCodeUserPrompt(
  gdd: GameDesignDocument,
  spec: TechnicalSpec,
): string {
  return `Build a complete HTML game based on the following Game Design Document and Technical Specification.

## Game Design Document

**Title:** ${gdd.title}
**Logline:** ${gdd.logline}
**Engine:** ${gdd.engine}
**Genre:** ${gdd.genre}
**Visual Style:** ${gdd.visualStyle}
**Core Mechanic:** ${gdd.coreMechanic}
**Controls:** ${gdd.controls.map((c) => `${c.key} → ${c.action}`).join(', ')}
**Progression:** ${gdd.progression}
**Scoring:** ${gdd.scoring}
**Game Over Condition:** ${gdd.gameOverCondition}
**Restart Behavior:** ${gdd.restartBehavior}
**Complexity:** ${gdd.complexity}

### Screens
- **Intro:** ${gdd.screens.intro}
- **HUD:** ${gdd.screens.hud}
- **Pause:** ${gdd.screens.pause}
- **Game Over:** ${gdd.screens.gameOver}

### Game Objects
${gdd.objects.map((o) => `- **${o.name}:** ${o.description}`).join('\n')}

### Multiplayer
- Suitable: ${gdd.multiplayer.suitable}${gdd.multiplayer.suitable ? `\n- Mode: ${gdd.multiplayer.mode}\n- Max Players: ${gdd.multiplayer.maxPlayers}` : ''}

## Technical Specification

**File Structure:** ${spec.fileStructure}
**Engine Version:** ${spec.engineVersion}

### Modules
${spec.modules.map((m) => `- **${m.name}:** ${m.responsibility}`).join('\n')}

### Critical APIs
${spec.criticalApis.map((api) => `- ${api}`).join('\n')}

### Performance Constraints
${spec.performanceConstraints.map((c) => `- ${c}`).join('\n')}

### SDK v2 Lifecycle Mapping
- **init:** ${spec.sdkV2Mapping.init}
- **start:** ${spec.sdkV2Mapping.start}
- **pause:** ${spec.sdkV2Mapping.pause}
- **resume:** ${spec.sdkV2Mapping.resume}
- **restart:** ${spec.sdkV2Mapping.restart}
- **destroy:** ${spec.sdkV2Mapping.destroy}

Generate the complete HTML file now.`;
}

/**
 * Build a retry prompt when the first attempt had validation errors.
 */
export function buildCodeRetryPrompt(
  gdd: GameDesignDocument,
  spec: TechnicalSpec,
  previousCode: string,
  errors: string[],
): string {
  return `The previous HTML game had validation errors. Fix ALL of them and return the corrected HTML.

## Validation Errors
${errors.map((e) => `- ${e}`).join('\n')}

## Game Context
**Title:** ${gdd.title}
**Engine:** ${gdd.engine} (${spec.engineVersion})
**Core Mechanic:** ${gdd.coreMechanic}
**Controls:** ${gdd.controls.map((c) => `${c.key} → ${c.action}`).join(', ')}

## SDK v2 Lifecycle Mapping (reference)
- **init:** ${spec.sdkV2Mapping.init}
- **start:** ${spec.sdkV2Mapping.start}
- **pause:** ${spec.sdkV2Mapping.pause}
- **resume:** ${spec.sdkV2Mapping.resume}
- **restart:** ${spec.sdkV2Mapping.restart}
- **destroy:** ${spec.sdkV2Mapping.destroy}

## Previous Code (with errors)
${previousCode}

Fix ALL validation errors listed above. The output must be a complete, self-contained HTML file starting with \`<!DOCTYPE html>\`.
Ensure \`window.SloppyGame\` and \`window.game\` are assigned with all 12 required methods, \`metadata\`, and \`supportsMultiplayer\`.
Output ONLY the corrected HTML. No markdown fences, no explanations.`;
}

// ---------------------------------------------------------------------------
// V1 backward-compat exports (deprecated)
// ---------------------------------------------------------------------------

/** @deprecated Use buildCodeSystemPrompt() for v2. */
export const CODE_SYSTEM_PROMPT = '';
