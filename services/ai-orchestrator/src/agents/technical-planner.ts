import { createLogger } from '@sloppy/logger';
import type { LLMClient } from '../llm/index.js';
import type { GameDesignDocument, TechnicalSpec, ProgressCallback } from '../pipeline/types.js';

const log = createLogger('technical-planner');

const GENRE_TEMPLATE_MAP: Record<string, { engine: '2d' | '3d'; template: string } | undefined> = {
  '3d-firstperson': { engine: '3d', template: 'fps' },
  '3d-racing': { engine: '3d', template: 'racing' },
  '3d-thirdperson': { engine: '3d', template: 'endless-runner' },
  '3d-puzzle': { engine: '3d', template: 'puzzle-3d' },
  '3d-flight': { engine: '3d', template: 'flight' },
  '3d-platformer': { engine: '3d', template: 'platformer-3d' },
  '2d-platformer': { engine: '2d', template: 'platformer' },
  '2d-topdown': { engine: '2d', template: 'topdown' },
  '2d-puzzle': { engine: '2d', template: 'puzzle' },
  '2d-arcade': { engine: '2d', template: 'arcade' },
  '2d-shooter': { engine: '2d', template: 'shooter' },
  '2d-tower-defense': { engine: '2d', template: 'tower-defense' },
  '2d-endless-runner': { engine: '2d', template: 'endless-runner' },
  '2d-rhythm': { engine: '2d', template: 'rhythm' },
  '2d-cards': { engine: '2d', template: 'cards' },
  '2d-idle': { engine: '2d', template: 'idle' },
};

function getTemplateGuidance(gdd: GameDesignDocument): string {
  const match = GENRE_TEMPLATE_MAP[gdd.genre];
  if (!match) {
    return `\n## Templates\nNo pre-built template exists for genre "${gdd.genre}". The Code Generator will build the game from scratch using the engine guide and genre prompt.\n`;
  }

  return `
## Available Template
A pre-built **${match.template}** template exists for this genre (\`templates/${match.engine}/${match.template}.js\`).

The template provides working boilerplate for:
- Complete SDK v2 lifecycle implementation (init, destroy, start, pause, resume, restart)
- All screen renderers (intro, pause, game-over, HUD)
- State machine management
- ${match.engine === '3d' ? 'Three.js scene setup with shadows, ACES tone mapping, fog, and proper lighting' : 'Phaser 3 multi-scene architecture with procedural texture generation'}
- ${match.engine === '3d' ? 'HTML overlay system for HUD and screen rendering' : 'Physics, input, and camera setup'}
- ${match.engine === '3d' ? 'Object pooling with mesh.visible toggling' : 'Object pooling via physics groups'}

**Recommendation:** The Code Generator should use the ${match.template} template as its starting point. In the \`fileStructure\` field, note that the template handles the SDK v2 boilerplate, and describe which sections the Code Generator needs to customize:
1. Game-specific objects and visual theme
2. Level design / procedural generation
3. Scoring and progression mechanics
4. Difficulty curve
5. Any mechanics unique to this specific game

In \`sdkV2Mapping\`, reference the template's existing implementation and describe what the Code Generator should modify for this specific game.
`;
}

function buildSystemPrompt(gdd: GameDesignDocument): string {
  const engineGuide =
    gdd.engine === 'phaser3'
      ? PHASER3_API_GUIDE
      : THREEJS_API_GUIDE;

  const templateGuidance = getTemplateGuidance(gdd);

  return `You are the Technical Planner for Sloppy, an AI-powered browser game platform. You receive a Game Design Document (GDD) and produce a Technical Specification that the Code Generator will follow.

## SDK v2 Contract
The generated game MUST implement the \`SloppyGameV2\` interface. The game is loaded as a single \`game.js\` file that assigns to \`window.SloppyGame\`. The platform calls these methods:

### Lifecycle
- \`init(container: HTMLElement, config: GameInitConfig)\` — Create the engine instance, set up the scene. Called once. Must resolve a Promise.
- \`destroy()\` — Tear down everything: engine, event listeners, timers, DOM nodes.

### State Machine (states: idle → intro → playing → paused → gameover)
- \`start()\` — Transition from idle/intro to playing. Begin the game loop.
- \`pause()\` — Freeze the game loop. Show pause overlay.
- \`resume()\` — Unfreeze. Hide pause overlay.
- \`restart()\` — Reset all game state, transition to playing.

### Screen Rendering
- \`renderIntroScreen()\` — Show title, controls hint, "Press Start" prompt.
- \`renderPauseScreen()\` — Show pause overlay with resume option.
- \`renderGameOverScreen(score: GameResult)\` — Show final score, replay button.
- \`renderHUD()\` — Update score, lives, timer display each frame.

### State Introspection
- \`getState(): GameState\` — Return current state string.
- \`getScore(): GameResult\` — Return \`{ score, level?, timeElapsed, customData? }\`.

### Metadata (static readonly property)
\`\`\`ts
metadata: {
  title: string;
  genre: GameGenre;
  engine: GameEngine;
  supportsMultiplayer: boolean;
  maxPlayers?: number;
  controls: Array<{ key: string; action: string }>;
  estimatedPlayTime: string;
}
\`\`\`

### Ready Signal
After \`init()\` completes, the game MUST call:
\`window.parent.postMessage({ type: 'sloppy:game:ready' }, '*');\`

The game object must be accessible as \`window.game\` for runtime validation.

### SDK v2 Utility Classes
Generated games can optionally use these utility classes (provided by the platform):
- **GameStateManager** — Manages state transitions with validation (prevents invalid transitions like pausing from idle). Methods: \`transition(to)\`, \`forceState(to)\`, \`canTransition(to)\`, \`onChange(handler)\`.
- **HtmlScreenRenderer** — Creates HTML overlay screens (intro, pause, game-over) on top of the game canvas. Methods: \`show(html)\`, \`showTitle(title, subtitle, prompt)\`, \`showButton(label, onClick)\`, \`hide()\`.
- **Canvas2DEffects** / **ThreeJSEffects** — Juice helpers: screen shake, flash, particle burst. Methods: \`screenShake(intensity, duration)\`, \`screenFlash(color, duration)\`, \`particleBurst(x, y, count, color)\`.

These utilities are optional — the AI may implement equivalent logic inline if the game needs custom behavior.

${engineGuide}
${templateGuidance}
## Your Task
Given the GDD below, produce a Technical Specification as JSON.

### GDD
\`\`\`json
${JSON.stringify(gdd, null, 2)}
\`\`\`

## Output Format
Respond with ONLY a JSON object matching this schema:

\`\`\`json
{
  "fileStructure": "string — description of the single game.js file structure and sections",
  "engineVersion": "string — the CDN version to load (e.g. 'phaser@3.80.1' or 'three@0.170.0')",
  "useTemplate": "string | null — template name if a matching template should be used as base (e.g. 'fps', 'platformer'), or null if building from scratch",
  "templateCustomizations": "string | null — if useTemplate is set, describe what the Code Generator must change/add to the template",
  "modules": [
    {
      "name": "string — logical module/section name (e.g. 'GameScene', 'HUDManager', 'PhysicsSystem')",
      "responsibility": "string — what this module handles, key functions/methods"
    }
  ],
  "criticalApis": [
    "string — specific engine API calls the code must use (e.g. 'this.physics.add.collider', 'THREE.BoxGeometry')"
  ],
  "performanceConstraints": [
    "string — performance rules (e.g. 'object pool enemies, max 20 active', 'use requestAnimationFrame')"
  ],
  "sdkV2Mapping": {
    "init": "string — how init() sets up the engine (e.g. 'new Phaser.Game(config) with custom Scene')",
    "start": "string — what start() triggers in engine terms",
    "pause": "string — how pause() freezes the engine",
    "resume": "string — how resume() unfreezes",
    "restart": "string — how restart() resets state",
    "destroy": "string — how destroy() tears down the engine"
  }
}
\`\`\`

## Rules
- The \`modules\` array should have 4-8 entries covering: main game scene, HUD, screens (intro/pause/gameover), physics/collision, input handling, and entity management
- \`criticalApis\` should list 5-15 specific engine API calls
- \`performanceConstraints\` should include at least 3 rules
- \`sdkV2Mapping\` must provide engine-specific implementation details for each lifecycle method
- If a matching template exists, set \`useTemplate\` and describe what needs customization in \`templateCustomizations\`
- If no template matches, set \`useTemplate\` to null and plan the full architecture from scratch
- Keep the spec actionable — the Code Generator should be able to write code directly from it`;
}

const PHASER3_API_GUIDE = `## Phaser 3 Engine Guide
The game loads Phaser 3 via CDN script tag. Key patterns:

**Setup:** Create a \`Phaser.Game\` instance with a config object specifying \`type: Phaser.AUTO\`, \`parent\` (the container), \`width\`, \`height\`, and a \`scene\` array.

**Scenes:** Use \`Phaser.Scene\` subclasses with \`preload()\`, \`create()\`, \`update()\` lifecycle.

**Physics:** Use Arcade Physics (\`physics: { default: 'arcade' }\`). Key APIs:
- \`this.physics.add.sprite(x, y, key)\`
- \`this.physics.add.collider(obj1, obj2, callback)\`
- \`this.physics.add.overlap(obj1, obj2, callback)\`
- \`sprite.setVelocity(x, y)\`, \`sprite.setBounce()\`, \`sprite.setCollideWorldBounds(true)\`

**Input:**
- \`this.input.keyboard.createCursorKeys()\`
- \`this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)\`

**Graphics:** Use \`this.add.graphics()\` for shapes, \`this.add.text()\` for labels.

**Lifecycle mapping:**
- \`init()\` → create \`new Phaser.Game(config)\`
- \`pause()\` → \`game.scene.pause(key)\`
- \`resume()\` → \`game.scene.resume(key)\`
- \`destroy()\` → \`game.destroy(true)\``;

const THREEJS_API_GUIDE = `## Three.js Engine Guide
The game loads Three.js via CDN script tag. Key patterns:

**Setup:** Create \`THREE.Scene\`, \`THREE.PerspectiveCamera\`, \`THREE.WebGLRenderer\`. Attach renderer.domElement to the container.

**Objects:**
- \`new THREE.Mesh(geometry, material)\`
- Geometries: \`BoxGeometry\`, \`SphereGeometry\`, \`PlaneGeometry\`, \`CylinderGeometry\`
- Materials: \`MeshBasicMaterial\`, \`MeshPhongMaterial\`, \`MeshStandardMaterial\`

**Lighting:** \`THREE.AmbientLight\`, \`THREE.DirectionalLight\`, \`THREE.PointLight\`

**Animation:** Use \`requestAnimationFrame\` loop calling \`renderer.render(scene, camera)\`.

**Physics:** Implement simple custom physics (no external library). Use bounding box/sphere collision via \`THREE.Box3\` and \`box.intersectsBox()\`.

**Input:** Add \`keydown\`/\`keyup\` event listeners on \`window\` or the container.

**Lifecycle mapping:**
- \`init()\` → create scene, camera, renderer, add to container
- \`pause()\` → stop the animation loop (\`cancelAnimationFrame\`)
- \`resume()\` → restart the animation loop
- \`destroy()\` → \`renderer.dispose()\`, remove DOM element, clear scene`;

function buildPlannerUserPrompt(gdd: GameDesignDocument): string {
  return `Produce a Technical Specification for the game "${gdd.title}" (${gdd.engine}, ${gdd.genre}, ${gdd.complexity} complexity).\n\nRespond with the TechnicalSpec JSON.`;
}

export async function runTechnicalPlanner(
  gdd: GameDesignDocument,
  llm: LLMClient,
  onProgress: ProgressCallback,
  maxTokens: number,
): Promise<{ spec: TechnicalSpec; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
  log.info({ title: gdd.title, engine: gdd.engine }, 'starting technical planner');
  onProgress('planning', 10, 'Planning technical architecture…');

  const systemPrompt = buildSystemPrompt(gdd);

  const { data, usage } = await llm.generateJSON<TechnicalSpec>(
    systemPrompt,
    buildPlannerUserPrompt(gdd),
    maxTokens,
  );

  if (!data.fileStructure || !data.modules?.length || !data.sdkV2Mapping) {
    throw new Error('Technical Planner returned incomplete spec: missing required fields');
  }

  if (!data.sdkV2Mapping.init || !data.sdkV2Mapping.destroy) {
    throw new Error('Technical Planner returned incomplete spec: missing lifecycle mappings');
  }

  log.info(
    { moduleCount: data.modules.length, apiCount: data.criticalApis?.length ?? 0 },
    'technical spec produced',
  );
  onProgress('planning', 100, 'Technical plan complete');

  return { spec: data, usage };
}
