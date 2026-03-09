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

const MOBILE_TOUCH_RULES = `## Mobile & Touch Support (REQUIRED)

Games run on both desktop and mobile. Every game MUST support touch input:

### Touch Input Rules
1. **ALL gameplay actions must work with BOTH keyboard AND pointer/touch events.** Never use keyboard-only controls without a touch alternative.
2. For Phaser games: use \`this.input.on('pointerdown')\`, \`this.input.on('pointermove')\`, \`this.input.on('pointerup')\` — Phaser pointer events fire for both mouse and touch automatically.
3. For Three.js / Canvas games: add \`touchstart\`, \`touchmove\`, \`touchend\` event listeners that map to the same logic as keyboard handlers.
4. All tappable UI elements (buttons, interactive areas) must be at least 44×44 pixels.
5. The platform provides a touch controls overlay that sends synthetic keyboard events via \`sloppy:touch\` postMessage. To receive these, include this bridge at the end of your inline script:

\`\`\`javascript
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
\`\`\`

CRITICAL: The \`keyCode\` and \`which\` properties MUST be included. Phaser 3 reads \`event.keyCode\` to identify keys — without them, all synthetic keyboard events are silently ignored.

### Responsive Canvas (REQUIRED)

Games run inside an iframe at arbitrary viewport sizes. The game MUST render correctly at any viewport size.

**Three.js games MUST include:**
1. Use \`window.innerWidth\` / \`window.innerHeight\` for initial \`renderer.setSize()\` and \`camera.aspect\` — NOT fixed W/H constants.
2. A \`resize\` event listener that updates the renderer and camera on viewport change:
\`\`\`javascript
function onWindowResize() {
  var w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onWindowResize);
\`\`\`

**Phaser games:** \`Scale.FIT\` + \`CENTER_BOTH\` handles responsive sizing automatically. No resize handler needed.

### Movement Patterns for Touch
- **Platformers / Arcade:** D-pad or joystick from overlay → Arrow key events. Also add \`pointerdown\` on left/right halves for direct touch.
- **Endless runners:** Tap anywhere → jump/action. Swipe → lane change.
- **Puzzles / Cards / Idle:** Pointer events only (click/tap to interact). These work natively.
- **Top-down / Shooters:** Joystick from overlay → Arrow/WASD events. Also consider \`pointermove\` for aim.
- **Racing / Flight / FPS:** Joystick from overlay → key events. Tap buttons for actions.
`;

const OUTPUT_FORMAT = `## Output Format

You MUST output a COMPLETE, SELF-CONTAINED HTML file. The response must:
1. Start with \`<!DOCTYPE html>\`
2. Include the engine CDN \`<script>\` tag in \`<head>\`
3. Include all game code inline in a SINGLE \`<script>\` tag in \`<body>\`
4. Include necessary CSS for full-viewport layout
5. Assign the game object to \`window.SloppyGame\` AND \`window.game\`
6. Call \`window.parent.postMessage({ type: 'sloppy:game:ready' }, '*')\` after init completes
7. Include error handling that posts errors to parent: \`window.parent.postMessage({ type: 'sloppy:game:error', message, stack }, '*')\`
8. Include the Sloppy Touch Controls Bridge (with keyCode mapping) — see Mobile & Touch Support section
9. For Three.js games: include a \`window.addEventListener('resize', ...)\` handler and use \`window.innerWidth/innerHeight\` for initial sizing (see Responsive Canvas section)
10. Include the PostMessage command bridge (see below)
11. Include the auto-init boot function (see below)
12. Include \`window.triggerGameOver\` (see below)

### PostMessage Command Bridge (CRITICAL — without this, games cannot be controlled from the site)

The parent page sends \`sloppy:command\` messages to start/pause/resume/restart the game. You MUST include this listener:

\`\`\`javascript
window.addEventListener('message', function(e) {
  if (!e.data || !e.data.type) return;
  var g = window.SloppyGame;
  switch (e.data.type) {
    case 'sloppy:command':
      var cmd = e.data.command;
      if (cmd === 'start' && g.start) g.start();
      if (cmd === 'pause' && g.pause) g.pause();
      if (cmd === 'resume' && g.resume) g.resume();
      if (cmd === 'restart' && g.restart) g.restart();
      break;
    case 'sloppy:mute':
      if (typeof audioManager !== 'undefined') audioManager.mute();
      break;
    case 'sloppy:unmute':
      if (typeof audioManager !== 'undefined') audioManager.unmute();
      break;
  }
});
\`\`\`

### Auto-Init Boot Function (CRITICAL — without this, games show a blank screen)

The game must auto-initialize when the DOM is ready. Include this boot function:

\`\`\`javascript
(function boot() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
    return;
  }
  window.SloppyGame.init(document.body, { container: document.body, width: window.innerWidth, height: window.innerHeight })
    .catch(function(err) {
      window.parent.postMessage({ type: 'sloppy:game:error', message: err.message, stack: err.stack || '' }, '*');
    });
})();
\`\`\`

### window.triggerGameOver (CRITICAL — needed for runtime validation)

Define \`window.triggerGameOver\` so the validation system can programmatically end the game:

\`\`\`javascript
window.triggerGameOver = function() {
  var g = window.SloppyGame;
  if (g.getState() === 'playing') {
    // Trigger game over — call your internal game-over logic here
    // then call renderGameOverScreen with final score
  }
};
\`\`\`

### Method Definition Rules (CRITICAL — validation checks for these)

You MUST define ALL 12 required SDK methods as standalone named functions BEFORE the \`window.SloppyGame\` assignment. Then assign them using shorthand property names. Example:

\`\`\`javascript
function init(container, config) { /* ... */ }
function destroy() { /* ... */ }
function start() { /* ... */ }
function pause() { /* ... */ }
function resume() { /* ... */ }
function restart() { /* ... */ }
function renderIntroScreen() { /* ... */ }
function renderPauseScreen() { /* ... */ }
function renderGameOverScreen(score) { /* ... */ }
function renderHUD() { /* ... */ }
function getState() { return gameState; }
function getScore() { return { score: currentScore, timeElapsed: elapsed }; }

window.SloppyGame = {
  init, destroy, start, pause, resume, restart,
  renderIntroScreen, renderPauseScreen, renderGameOverScreen, renderHUD,
  getState, getScore,
  metadata: { /* ... */ },
  supportsMultiplayer: false
};
\`\`\`

Do NOT define methods only as inline anonymous functions on the object (e.g. \`renderIntroScreen: function() {}\`). They MUST be standalone named functions.

### Required Script Order (MUST follow this exact order at the end of the inline <script>)

1. Game code (classes, functions, state variables, game loop)
2. All 12 required SDK methods as standalone named functions
3. \`window.SloppyGame = { init, destroy, start, pause, resume, restart, renderIntroScreen, renderPauseScreen, renderGameOverScreen, renderHUD, getState, getScore, metadata, supportsMultiplayer }\`
4. \`window.game = window.SloppyGame;\`
5. \`window.triggerGameOver = function() { ... };\`
6. PostMessage command bridge (\`sloppy:command\` listener)
7. Auto-init boot function
8. Sloppy Touch Controls Bridge

Output ONLY the HTML. No markdown fences, no explanations, no surrounding text. Just the raw HTML starting with \`<!DOCTYPE html>\`.

FORBIDDEN — the following will cause immediate rejection:
- \`eval()\` or \`new Function()\` or \`Function()\` — NEVER use the Function constructor in any form
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
    MOBILE_TOUCH_RULES,
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
