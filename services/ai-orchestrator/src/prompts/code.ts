import type { GameConcept } from '../pipeline/types.js';

const SLOPPY_GAME_INTERFACE = `interface SloppyGame {
  init(container: HTMLElement): void | Promise<void>;
  update(deltaTime: number): void;
  destroy(): void;
  supportsMultiplayer: boolean;

  // Multiplayer hooks (required only when supportsMultiplayer is true)
  getInitialState?(): Record<string, unknown>;
  applyPlayerInput?(playerId: string, input: unknown): void;
  updateState?(state: Record<string, unknown>): void;
  serializeState?(): Record<string, unknown>;
}`;

export const CODE_SYSTEM_PROMPT = `You are Sloppy, an expert browser game developer. Write a complete, self-contained game.js file that implements the SloppyGame interface.

The game MUST implement this interface and assign it to window.SloppyGame:

${SLOPPY_GAME_INTERFACE}

Technical requirements:
- Use the Canvas 2D API for all rendering
- The container element passed to init() is your root — create a <canvas> inside it
- The game must be COMPLETELY self-contained: no external libraries, no fetch() calls, no imports
- deltaTime in update() is in seconds (e.g. 0.016 for 60fps)
- Clean up ALL event listeners, timers, and DOM nodes in destroy()
- Handle window resize gracefully
- init() MUST start its own requestAnimationFrame game loop that calls update(deltaTime) every frame — nothing external will call update() for you
- destroy() MUST cancel the requestAnimationFrame loop (store the rAF ID so you can cancelAnimationFrame it)

FORBIDDEN — the following will cause rejection:
- eval() or new Function()
- fetch() to any external URL
- document.cookie access
- importScripts()

Output ONLY the JavaScript code. No markdown fences, no explanations, just the raw JS code.
The code must:
1. Define all game logic (state, rendering, input handling)
2. Implement init(container) — create a <canvas>, initialize game state, and start the rAF loop that calls update(deltaTime) each frame
3. Implement update(deltaTime) — advance game state and render (deltaTime is in seconds)
4. Implement destroy() — cancelAnimationFrame, remove event listeners, clean up DOM nodes
5. End with: window.SloppyGame = { init, update, destroy, supportsMultiplayer: false };`;

export function buildCodeUserPrompt(concept: GameConcept): string {
  return `Build a game based on this concept:

Title: ${concept.title}
Description: ${concept.description}
Mechanics: ${concept.mechanics.join(', ')}
Visual Style: ${concept.visualStyle}
Controls: ${concept.controls}
Win Condition: ${concept.winCondition}
Difficulty: ${concept.difficulty}
Supports Multiplayer: ${concept.supportsMultiplayer}

Assets to render (draw these with Canvas 2D — shapes, colors, or emoji):
${concept.assets.map((a) => `- ${a.name}: ${a.description} (${a.type})`).join('\n')}

Write the complete game.js now.`;
}

export function buildCodeRetryPrompt(
  concept: GameConcept,
  previousCode: string,
  errors: string[],
): string {
  return `The previous game.js had validation errors. Fix them and return the corrected code.

Errors:
${errors.map((e) => `- ${e}`).join('\n')}

Previous code:
\`\`\`javascript
${previousCode}
\`\`\`

Game concept for reference:
Title: ${concept.title}
Description: ${concept.description}

Fix ALL errors and return ONLY the corrected JavaScript code.`;
}
