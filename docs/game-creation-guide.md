# Sloppy Game Creation — Comprehensive Guide

Complete reference for creating, iterating, validating, and deploying games on the Sloppy platform. Use this document as context for all game creation sessions.

---

## Table of Contents

1. [Pipeline Overview](#1-pipeline-overview)
2. [Game Design Document (GDD)](#2-game-design-document-gdd)
3. [Technical Specification](#3-technical-specification)
4. [SDK v2 Contract](#4-sdk-v2-contract)
5. [Engine Guides](#5-engine-guides)
6. [Genre Guides](#6-genre-guides)
7. [Screen Rendering](#7-screen-rendering)
8. [Audio System](#8-audio-system)
9. [Validation Rules](#9-validation-rules)
10. [Polish & Iteration](#10-polish--iteration)
11. [Debug & Fix Loop](#11-debug--fix-loop)
12. [Thumbnail Generation](#12-thumbnail-generation)
13. [Deployment](#13-deployment)
14. [Config Schema](#14-config-schema)
15. [Database Schema](#15-database-schema)
16. [File Structure](#16-file-structure)
17. [Reference: Source Files](#17-reference-source-files)

---

## 1. Pipeline Overview

Each game flows through these phases in order:

```
Concept Architect (GDD) → Technical Planner → Code Generation → Static Validation
    → Debug/Fix Loop (if needed, max 5 iterations)
    → Polish Pass (visual quality + game feel)
    → Audio Injection (ZzFX + AudioManager)
    → Thumbnail Prompt → Thumbnail Image (fal.ai FLUX)
    → Production Deploy (DB + GCS)
```

**Key principles:**
- Every game is a single self-contained `index.html` file with inline JS
- No external assets — all visuals are procedural (Graphics + generateTexture for Phaser, primitive geometries for Three.js)
- Audio is procedural via ZzFX (~900 bytes inline)
- Games run inside an iframe on sloppygames.io and communicate via `postMessage`
- Two supported engines: **Phaser 3** (2D) and **Three.js** (3D)

---

## 2. Game Design Document (GDD)

The GDD is the output of the Concept Architect agent. It defines everything about the game except implementation details.

### GDD Interface

```typescript
interface GameDesignDocument {
  title: string;
  logline: string;                    // One-sentence pitch
  engine: 'phaser3' | 'threejs';     // NOT canvas2d for new games
  genre: GameGenre;                   // See genre list below
  visualStyle: string;               // Color palette, art direction, mood
  coreMechanic: string;              // The primary gameplay loop in one paragraph
  controls: Array<{ key: string; action: string }>;
  progression: string;               // How difficulty scales
  scoring: string;                   // How points are earned
  gameOverCondition: string;         // What ends the game
  restartBehavior: string;           // What resets on restart
  screens: {
    intro: string;                   // Title screen description
    hud: string;                     // In-game UI description
    pause: string;                   // Pause overlay description
    gameOver: string;                // Game over screen description
  };
  multiplayer: {
    suitable: boolean;
    mode?: 'competitive' | 'cooperative' | 'versus';
    description?: string;
    maxPlayers?: number;
    syncStrategy?: 'state-sync' | 'input-relay' | 'lockstep';
  };
  objects: Array<{ name: string; description: string }>;  // All game entities
  complexity: 'simple' | 'medium' | 'complex';
  estimatedGenerationTimeSeconds: number;
}
```

### Supported Genres

**2D (Phaser 3):**
`2d-platformer` | `2d-topdown` | `2d-puzzle` | `2d-arcade` | `2d-shooter` | `2d-tower-defense` | `2d-endless-runner` | `2d-rhythm` | `2d-cards` | `2d-idle` | `2d-custom`

**3D (Three.js):**
`3d-firstperson` | `3d-thirdperson` | `3d-racing` | `3d-puzzle` | `3d-flight` | `3d-platformer` | `3d-custom`

---

## 3. Technical Specification

The Technical Planner translates the GDD into implementation details.

```typescript
interface TechnicalSpec {
  fileStructure: string;       // "Single self-contained index.html with..."
  engineVersion: string;       // "Phaser 3.80.1 via CDN" or "Three.js 0.160.0 via CDN"
  modules: Array<{
    name: string;              // Scene name or module name
    responsibility: string;    // What it handles
  }>;
  criticalApis: string[];      // Key engine APIs to use
  performanceConstraints: string[];
  sdkV2Mapping: {              // How each lifecycle method maps to engine calls
    init: string;
    start: string;
    pause: string;
    resume: string;
    restart: string;
    destroy: string;
  };
}
```

---

## 4. SDK v2 Contract

Every game MUST implement the full `SloppyGameV2` interface and assign it to both `window.SloppyGame` and `window.game`.

### Required Methods (all 11 + renderHUD = 12 total)

```javascript
window.SloppyGame = {
  // ── Lifecycle ──
  async init(container, config) { ... },  // Create engine, post sloppy:game:ready
  destroy() { ... },                       // Clean up everything

  // ── State Machine (idle → intro → playing → paused → gameover) ──
  start() { ... },       // → playing
  pause() { ... },       // → paused
  resume() { ... },      // → playing
  restart() { ... },     // Reset all state → playing

  // ── Screen Rendering ──
  renderIntroScreen() { ... },             // Show title/intro screen
  renderPauseScreen() { ... },             // Show pause overlay
  renderGameOverScreen(score) { ... },     // Show game over with results
  renderHUD() { ... },                     // Update in-game HUD

  // ── State Introspection ──
  getState() { ... },    // Returns 'idle' | 'intro' | 'playing' | 'paused' | 'gameover'
  getScore() { ... },    // Returns { score, level?, timeElapsed, customData? }

  // ── Static Properties ──
  metadata: {
    title: 'Game Name',
    genre: '2d-arcade',
    engine: 'phaser3',
    supportsMultiplayer: false,
    controls: [{ key: 'ArrowLeft', action: 'Move left' }],
    estimatedPlayTime: '1-5 min'
  },
  supportsMultiplayer: false
};

window.game = window.SloppyGame;
```

### Required Post-Init Messages

```javascript
// After init completes successfully:
window.parent.postMessage({ type: 'sloppy:game:ready' }, '*');

// On init failure:
window.parent.postMessage({
  type: 'sloppy:game:error',
  message: err.message,
  stack: err.stack
}, '*');
```

### Auto-Init & PostMessage Command Bridge (CRITICAL)

Games run inside a sandboxed iframe. The parent page **cannot** directly call methods on `window.SloppyGame` — it communicates via `postMessage`. Every game **must** include these two blocks at the very end of the `<script>` tag, after defining `window.SloppyGame` and `window.triggerGameOver`:

```javascript
// 1. PostMessage command bridge — routes parent commands to SDK methods
window.addEventListener('message', function(e) {
  if (!e.data || !e.data.type) return;
  if (e.data.type === 'sloppy:command') {
    const cmd = e.data.command;
    if (cmd === 'start')   window.SloppyGame.start();
    if (cmd === 'pause')   window.SloppyGame.pause();
    if (cmd === 'resume')  window.SloppyGame.resume();
    if (cmd === 'restart') window.SloppyGame.restart();
  }
});

// 2. Auto-init — kicks off Phaser/Three.js, which posts sloppy:game:ready when done
window.SloppyGame.init(document.body, { container: document.body, width: W, height: H });
```

**Why this matters:**
- Without the command bridge, the parent's start/pause/resume/restart buttons do nothing.
- Without auto-init, `init()` is never called, Phaser/Three.js never creates a canvas, and the player sees a **blank screen**.
- The `init()` method must post `sloppy:game:ready` when done — the parent waits for this before enabling controls.

**Correct order at the end of the script:**
1. Define `window.SloppyGame = { ... };`
2. Set `window.game = window.SloppyGame;`
3. Define `window.triggerGameOver = function() { ... };`
4. Register the `message` event listener (command bridge)
5. Call `window.SloppyGame.init(document.body, ...)` (auto-init)

### Runtime Validation Hook

Every game must include this for Puppeteer testing:

```javascript
window.triggerGameOver = function() {
  if (gameState === 'playing' && phaserGame) {
    if (score > highScore) highScore = score;
    gameState = 'gameover';
    phaserGame.scene.start('GameOverScene');
  }
};
```

### State Machine Rules

```
idle ──init()──→ idle
idle ──start()──→ intro ──(user action)──→ playing
playing ──pause()──→ paused ──resume()──→ playing
playing ──(death)──→ gameover ──restart()──→ playing
ANY ──restart()──→ playing
ANY ──destroy()──→ (cleaned up)
```

### GameResult Interface

```typescript
interface GameResult {
  score: number;
  level?: number;
  timeElapsed: number;        // Seconds elapsed
  customData?: Record<string, unknown>;
}
```

---

## 5. Engine Guides

### 5A. Phaser 3

**CDN:** `https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js`
**Resolution:** 960×540 (16:9)

#### Scene Architecture

```
BootScene → IntroScene → GameScene ⇄ PauseScene
                              ↓
                        GameOverScene
```

- **BootScene** — Generate procedural textures via `Graphics.generateTexture()`, then transition to IntroScene
- **IntroScene** — Title, controls, high score, animated background, "Click to Start"
- **GameScene** — Core gameplay: input, physics, spawning, collision, HUD, difficulty scaling
- **PauseScene** — Overlay scene launched on top of GameScene
- **GameOverScene** — Score display, high score comparison, replay prompt

#### SDK ↔ Phaser Mapping

```javascript
init(container, config) →
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: config.width || 960,
    height: config.height || 540,
    backgroundColor: '#000000',
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    scene: [BootScene, IntroScene, GameScene, PauseScene, GameOverScene],
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }
  });
  // Wait for 'ready' event, then post sloppy:game:ready

destroy()      → phaserGame.destroy(true); audioManager.onDestroy();
start()        → scene.start('IntroScene'); state = 'intro';
pause()        → scene.launch('PauseScene'); scene.pause('GameScene'); audioManager.onPause();
resume()       → scene.stop('PauseScene'); scene.resume('GameScene'); audioManager.onResume();
restart()      → Stop all scenes; scene.start('GameScene'); Reset score/combo/speed;
```

#### Key Phaser 3 APIs

```javascript
// Physics
this.physics.add.sprite(x, y, 'key')
this.physics.add.group({ maxSize: 40 })      // Object pooling
this.physics.add.collider(obj1, obj2, callback)
this.physics.add.overlap(obj1, obj2, callback)
sprite.setVelocity(x, y)
sprite.setCollideWorldBounds(true)

// Procedural textures (ALL visuals must use this — no external assets)
const g = this.add.graphics();
g.fillStyle(0x00ccff);
g.fillCircle(12, 12, 12);
g.generateTexture('ball', 24, 24);
g.clear();
g.destroy();

// Text
this.add.text(x, y, 'text', { fontFamily: 'monospace', fontSize: '24px', color: '#fff' })
  .setOrigin(0.5)
  .setScrollFactor(0)  // Pin to camera for HUD
  .setDepth(20);

// Input
this.input.keyboard.createCursorKeys()
this.input.keyboard.addKey('SPACE')
this.input.on('pointerdown', callback)
this.input.keyboard.on('keydown-LEFT', callback)

// Camera effects
this.cameras.main.shake(200, 0.01)
this.cameras.main.flash(100, 0, 255, 255)
this.cameras.main.setBackgroundColor('#0a0a1a')

// Tweens
this.tweens.add({ targets: sprite, scaleX: 1.2, scaleY: 1.2, duration: 100, yoyo: true, ease: 'Sine.easeInOut' })
this.tweens.addCounter({ from: oldScore, to: newScore, duration: 300, onUpdate: (t) => text.setText(Math.floor(t.getValue())) })

// Particles (Phaser 3.60+)
this.add.particles(x, y, 'particle_key', { speed: 100, lifespan: 500, quantity: 20, blendMode: 'ADD' })

// Timers
this.time.addEvent({ delay: 700, callback: fn, loop: true })
this.time.delayedCall(500, callback)

// Text shadows
text.setShadow(2, 2, '#00ccff', 8, true, true)
```

#### Phaser 3 Quality Rules

- Use particle effects for impacts, pickups, explosions — never silently delete sprites
- Use tweens for smooth transitions: scale pops, fade-ins, bounce on landing
- Camera shake on damage, camera flash on power-ups
- HUD elements: `setScrollFactor(0)` and `setDepth(20)`
- Object pooling with `maxSize` for enemies, bullets, collectibles
- Always `setCollideWorldBounds(true)` on the player
- Generate textures in `create()`, NEVER in `update()`
- Use module-level state or `this.registry` to share data between scenes

#### Phaser 3 Forbidden Patterns

- NEVER use `this.load.image()`, `this.load.audio()`, `this.load.spritesheet()` — no external assets
- NEVER call `new Phaser.Game()` more than once
- NEVER use `scene.scene.restart()` from within `update()` without a guard
- NEVER create Graphics objects inside `update()` — memory leak
- NEVER use `document.createElement('canvas')` — Phaser manages its canvas

---

### 5B. Three.js

**CDN:** `https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js`
**Resolution:** 1280×720 (16:9)

#### Architecture

```
Renderer + Camera → Scene Graph → Game State Machine → HUD Overlay (HTML)
                                → Screen Overlays (Intro, Pause, GameOver)
                                → Input Handler
                                → Animation Loop (requestAnimationFrame)
```

#### SDK ↔ Three.js Mapping

```javascript
init(container, config) →
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  // Use viewport dimensions for responsive sizing (NOT fixed W/H)
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  // Camera must use viewport aspect ratio
  camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, near, far);

  // REQUIRED: resize handler for responsive canvas
  function onWindowResize() {
    var w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onWindowResize);

  // Create scene, lights, meshes
  // Post sloppy:game:ready

destroy() →
  cancelAnimationFrame(animationId);
  window.removeEventListener('resize', onWindowResize);
  scene.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) { /* dispose materials */ }
  });
  renderer.dispose();
  // Remove DOM elements, event listeners

pause()   → Show HTML overlay, set state = 'paused' (loop still renders but skips logic)
resume()  → Hide overlay, reset clock, state = 'playing'
```

#### Key Three.js APIs

```javascript
// Geometries (built-in only — no external models)
new THREE.BoxGeometry(w, h, d)
new THREE.SphereGeometry(radius, 16, 16)
new THREE.CylinderGeometry(rTop, rBot, height, 16)
new THREE.PlaneGeometry(w, h)
new THREE.ConeGeometry(radius, height, 8)

// Materials (NEVER use MeshBasicMaterial — it ignores lighting)
new THREE.MeshStandardMaterial({ color, roughness, metalness })
new THREE.MeshPhongMaterial({ color, shininess })
// Emissive glow: { emissive: 0xff0000, emissiveIntensity: 2 }

// Lighting (always include ambient + directional + optional hemisphere)
new THREE.AmbientLight(0xffffff, 0.4)
new THREE.HemisphereLight(skyColor, groundColor, 0.45) // natural gradient
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.bias = -0.0005;
dirLight.shadow.normalBias = 0.02;
// CRITICAL: Configure shadow camera to cover the scene
dirLight.shadow.camera.left = -sceneHalfSize;
dirLight.shadow.camera.right = sceneHalfSize;
dirLight.shadow.camera.top = sceneHalfSize;
dirLight.shadow.camera.bottom = -sceneHalfSize;
dirLight.shadow.camera.updateProjectionMatrix();
scene.add(dirLight.target); // MUST add target to scene

// InstancedMesh (for walls, tiles, blocks — many copies, one draw call)
const wallMesh = new THREE.InstancedMesh(geo, mat, count);
wallMesh.setMatrixAt(idx, matrix); // per-instance transform
wallMesh.setColorAt(idx, color);   // per-instance color variation
wallMesh.instanceMatrix.needsUpdate = true;
wallMesh.instanceColor.needsUpdate = true;

// Collision (no physics library — use Box3/Sphere)
const box1 = new THREE.Box3().setFromObject(mesh1);
const box2 = new THREE.Box3().setFromObject(mesh2);
if (box1.intersectsBox(box2)) { /* collision */ }

// Animation loop
const clock = new THREE.Clock();
function animate() {
  animationId = requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (state === 'playing') updateGameLogic(delta);
  renderer.render(scene, camera);
}

// HUD (HTML overlay)
const hud = document.createElement('div');
hud.style.cssText = 'position:absolute;top:0;left:0;width:100%;pointer-events:none;color:#fff;z-index:10;';
container.style.position = 'relative';
container.appendChild(hud);
```

#### Three.js Quality Rules

- ALWAYS add a `window.addEventListener('resize', ...)` handler that updates `renderer.setSize` and `camera.aspect` — games must fill any viewport size
- ALWAYS use `window.innerWidth` / `window.innerHeight` for initial `renderer.setSize()` and `camera.aspect` — never fixed W/H
- ALWAYS enable shadows with `THREE.PCFSoftShadowMap`
- ALWAYS use ACES Filmic tone mapping
- ALWAYS add fog: `scene.fog = new THREE.FogExp2(color, density)`
- Camera smoothing: `camera.position.lerp(target, factor)` — never snap (exception: first-person cameras use direct position + head bob)
- Max 10,000 triangles total. Low-poly geometries (8-16 segments)
- Pre-create all meshes; toggle `mesh.visible` for pooling
- Use `THREE.Clock` for delta time
- Dispose ALL geometries and materials in `destroy()`
- `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`
- Shadow camera frustum MUST be configured to cover the scene (`shadow.camera.left/right/top/bottom`). Default is tiny and clips shadows silently.
- ALWAYS add `light.target` to the scene when using DirectionalLight shadows
- Use 2048×2048 shadow maps with `shadow.bias = -0.0005` for quality
- Position directional light at an angle (not directly above) for visible floor shadows
- Use `InstancedMesh.setColorAt()` for per-instance color variation on repeated geometry — prevents adjacent blocks from merging visually
- Make InstancedMesh geometry slightly smaller than grid cell (e.g., 0.96 vs 1.0) for visible seams between blocks
- Add wall caps (thin darker InstancedMesh on top) for edge definition
- Floor tiles: checkerboard color alternation + random brightness for depth
- First-person games: add head bob (vertical + horizontal sway + camera roll) with smooth ease in/out, sync footstep SFX to bob zero-crossings
- Minimap: show player as directional triangle + FOV cone, not just a dot
- HUD text: add `text-shadow` for readability against bright 3D scenes
- Procedural generators: add retry counters to prevent infinite recursion; validate pathfinding start/end cells
- Third-person camera: ALWAYS verify forward/right/orbit directions match level layout at initial angle. See "Third-Person Camera-Relative Movement" section for cross product formulas and verification checklist.

#### Third-Person Camera-Relative Movement (CRITICAL for 3D platformers)

Third-person games with camera-relative WASD controls are extremely prone to reversed/swapped inputs. Every direction must be mathematically verified before shipping.

**Camera orbit formula:**
```javascript
cameraX = playerX - sin(camOrbitAngle) * CAM_DIST
cameraZ = playerZ - cos(camOrbitAngle) * CAM_DIST
```

**Forward vector** (direction the camera looks, projected to XZ):
```javascript
var fwd = new THREE.Vector3(Math.sin(camOrbitAngle), 0, Math.cos(camOrbitAngle));
```

**Right vector** (must be computed as `Forward × Up` cross product):
```javascript
// CORRECT — Forward × Up gives screen-right direction
var right = new THREE.Vector3(-Math.cos(camOrbitAngle), 0, Math.sin(camOrbitAngle));

// WRONG — this is the LEFT vector, will swap A/D
var right = new THREE.Vector3(Math.cos(camOrbitAngle), 0, -Math.sin(camOrbitAngle));
```

**Initial camera angle MUST match level layout direction:**
- If the level progresses in **-Z**, set `camOrbitAngle = Math.PI` (camera at +Z, looking toward -Z)
- If the level progresses in **+Z**, set `camOrbitAngle = 0` (camera at -Z, looking toward +Z)
- Getting this wrong makes W/S feel reversed — player moves toward camera instead of toward the level

**Camera orbit direction:**
```javascript
// ArrowRight = clockwise from above = decrease angle
if (inputKeys['arrowleft'])  camOrbitAngle += CAM_ORBIT_SPEED * delta;
if (inputKeys['arrowright']) camOrbitAngle -= CAM_ORBIT_SPEED * delta;
```

**Verification checklist** (trace at initial angle before shipping):

| Input | Expected Screen Direction | Formula Check |
|---|---|---|
| W | Away from camera, toward level | `fwd` should point toward platforms |
| S | Toward camera, backward | `-fwd` should point away from platforms |
| D | Screen right | `right` at initial angle must be +X when facing -Z |
| A | Screen left | `-right` at initial angle must be -X when facing -Z |
| ArrowRight | View orbits clockwise from above | Decreasing angle → camera moves right |
| ArrowLeft | View orbits counter-clockwise | Increasing angle → camera moves left |

**Also reset the camera angle on restart:**
```javascript
function resetState() {
  camOrbitAngle = Math.PI; // must match initial value, not default to 0
  // ...
}
```

#### Flight / 6DOF Rotation Axes (CRITICAL for flight games)

Flight games using `rotateX` / `rotateY` / `rotateZ` on the ship group are prone to inverted pitch. The signs are non-obvious because Three.js uses a right-hand coordinate system where forward is **-Z**.

**Axis rotation effects on the forward vector `(0, 0, -1)`:**

| Method | Positive angle effect | Negative angle effect |
|---|---|---|
| `rotateX(θ)` | Nose pitches **UP** (forward gains +Y) | Nose pitches **DOWN** (forward gains -Y) |
| `rotateY(θ)` | Nose yaws **LEFT** (forward gains -X) | Nose yaws **RIGHT** (forward gains +X) |
| `rotateZ(θ)` | Ship rolls **LEFT** (counter-clockwise from behind) | Ship rolls **RIGHT** (clockwise from behind) |

**Correct input mapping for standard (non-inverted) flight controls:**
```javascript
if (keys['KeyW'] || keys['ArrowUp'])    pitchInput = 1;   // rotateX(+) = nose UP
if (keys['KeyS'] || keys['ArrowDown'])  pitchInput = -1;  // rotateX(-) = nose DOWN
if (keys['KeyA'] || keys['ArrowLeft'])  yawInput = 1;     // rotateY(+) = nose LEFT
if (keys['KeyD'] || keys['ArrowRight']) yawInput = -1;    // rotateY(-) = nose RIGHT
if (keys['KeyQ'])                       rollInput = 1;    // rotateZ(+) = roll LEFT
if (keys['KeyE'])                       rollInput = -1;   // rotateZ(-) = roll RIGHT
```

**Math derivation** (trace once, reference forever):
- `rotateX(θ)` matrix applied to `(0, 0, -1)` → `y' = sin(θ)`. Positive θ → positive Y → UP.
- `rotateY(θ)` matrix applied to `(0, 0, -1)` → `x' = -sin(θ)`. Positive θ → negative X → LEFT.
- `rotateZ(θ)` applies the right-hand rule around +Z: +X rotates toward +Y → counter-clockwise from behind.

**Also reset ship orientation when transitioning from intro to gameplay:**
```javascript
function startPlaying() {
  shipGroup.position.set(0, 0, 0);
  shipGroup.quaternion.identity();
  shipGroup.rotation.set(0, 0, 0);
  camera.position.set(0, 2.5, 7);
  camera.lookAt(0, 0, -5);
}
```
If the intro screen rotates the ship for visual effect, accumulated rotation will carry into gameplay and make controls feel swapped or inverted.

#### Top-Down / Overhead Camera Positioning (CRITICAL for iframe embedding)

Games run inside an iframe on sloppygames.io with site chrome (header, navigation) that can clip the visible area. A camera that looks perfectly centered in isolation will appear cropped when embedded. Follow these rules for any game with a top-down or overhead camera:

1. **The board/scene MUST appear vertically centered in the viewport, accounting for iframe clipping.** The site header eats into the top of the visible area, so the scene needs to be shifted slightly upward in the frame to compensate.

2. **Camera Z offset controls vertical centering.** With a near-top-down camera, +Z maps to the bottom of the screen and -Z maps to the top. The `lookAt` target's Z value shifts the scene vertically:
   - `lookAt(0, 0, 0)` with camera at `(0, H, 0.01)` → scene centered, but appears low due to iframe clipping
   - `lookAt(0, 0, positive)` → shifts scene **upward** on screen (compensates for header)
   - `lookAt(0, 0, negative)` → shifts scene **downward** on screen (makes clipping worse)

3. **Recommended starting point for a 10-unit board:**
   ```javascript
   camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
   camera.position.set(0, 18, 2);
   camera.lookAt(0, 0, 1.5);
   ```
   This gives a near-top-down view with a subtle perspective angle and the scene shifted slightly upward to account for iframe embedding.

4. **Avoid pure top-down** (`camera.position.set(0, H, 0)`) — this causes gimbal lock with `lookAt`. Use a tiny Z offset (minimum `0.01`) on the camera position.

5. **FOV affects how much margin surrounds the scene.** For a 10-unit board at height 18, FOV 38-42 provides comfortable margins. Too narrow and the board edges get clipped when tilting.

6. **Test in the actual iframe**, not just in isolation. The game page at `sloppygames.io/game/<slug>` has site chrome that changes the visible area compared to opening `index.html` directly.

#### Three.js Forbidden Patterns

- NEVER create `new THREE.*` objects inside the game loop — causes GC spikes
- NEVER use `MeshBasicMaterial` — looks flat and unlit. Use `MeshStandardMaterial` with emissive for glow.
- NEVER load external 3D models or textures — no files exist
- NEVER forget `cancelAnimationFrame()` in `destroy()`
- NEVER allocate `new THREE.Vector3()` or `new THREE.Box3()` in the loop — pre-allocate
- NEVER use Three.js CDN above v0.160.0 — versions 0.161+ removed UMD build, causing "THREE is not defined"
- NEVER dispose shared geometry multiple times — track in array, dispose once
- NEVER leave DirectionalLight shadow camera at default bounds — configure to scene size
- NEVER forget to add `light.target` to scene for DirectionalLight shadows
- NEVER rely on JS variable hoisting for assignment — declare helpers before first use
- NEVER assume camera-relative movement directions are correct without tracing the math at the initial angle — see "Third-Person Camera-Relative Movement" section
- NEVER initialize `camOrbitAngle = 0` without checking which side of the level that places the camera
- NEVER assume `rotateX(-1)` = pitch UP — it's the opposite. `rotateX(+)` = UP in Three.js right-hand coords. See "Flight / 6DOF Rotation Axes" section
- NEVER transition from intro to gameplay without resetting ship `quaternion`/`rotation` — accumulated intro animation will corrupt controls
- NEVER use fixed W/H for `renderer.setSize()` — always use `window.innerWidth`/`window.innerHeight` for responsive rendering
- NEVER omit the `resize` event listener — games run in iframes at arbitrary viewport sizes

---

## 6. Genre Guides

### 2D Arcade (most common)

**Core patterns:**
- Simple controls: 1-2 input axes, immediately intuitive
- Score chasing: Score is the primary goal, no level completion
- Increasing difficulty: `difficulty = 1 + score * 0.001` or time-based
- Lives system: Start with 1-3 lives, invincibility frames on hit
- Spawn patterns: `this.time.addEvent({ delay, callback, loop: true })`, decrease delay over time

**Object archetypes:**
- **Player:** Simple shape, constrained to bounds, quick responsive movement
- **Enemies/Obstacles:** Physics group with `maxSize` for pooling, recycle when off-screen
- **Collectibles:** Bonus items, less frequent than obstacles, visual pop on collect
- **Power-ups:** Temporary effects (shield, magnet, slow-mo), show timer bar

**Scoring:**
- Time-based survival: +1 per second alive
- Points per dodge/destroy
- Collectible bonuses (variable value)
- Milestone bonuses at score thresholds
- High score display on game-over

**Difficulty progression:**
- Increase spawn rate linearly or exponentially
- Increase movement speed
- Introduce new types at score thresholds
- Brief plateaus after milestones for relief

### Other Genres Available

Each has a dedicated prompt file in `services/ai-orchestrator/src/prompts/genres/`:

| Genre | File | Key Mechanics |
|---|---|---|
| 2D Platformer | `platformer-2d.ts` | Jump, gravity, platforms, collectibles |
| 2D Top-Down | `topdown-2d.ts` | 4/8-directional movement, exploration |
| 2D Puzzle | `puzzle-2d.ts` | Grid logic, matching, chain reactions |
| 2D Shooter | `shooter-2d.ts` | Projectiles, enemy waves, power-ups |
| 2D Tower Defense | `tower-defense-2d.ts` | Path, towers, waves, economy |
| 2D Endless Runner | `endless-runner-2d.ts` | Auto-scroll, obstacles, lane switching |
| 2D Rhythm | `rhythm-2d.ts` | Beat matching, timing windows |
| 2D Cards | `cards-2d.ts` | Hand management, deck building |
| 2D Idle | `idle-2d.ts` | Auto-progression, upgrades, prestige |
| 3D Racing | `racing-3d.ts` | Vehicle physics, track, checkpoints |
| 3D FPS | `fps-3d.ts` | First-person camera, shooting, enemies |
| 3D Puzzle | `puzzle-3d.ts` | 3D spatial reasoning, manipulation |
| 3D Flight | `flight-3d.ts` | Aircraft controls, obstacles, scoring |
| 3D Platformer | `platformer-3d.ts` | Third-person, jumping, collectibles |
| 3D Endless Runner | `endless-runner-3d.ts` | Lane switching, 3D obstacles |

---

## 7. Screen Rendering

### Intro Screen

**Required elements:**
- Large centered title with subtle tween (pulse scale or glow)
- "Click to Start" / "Press SPACE to Start" prompt — pulsing or blinking
- Control hints in smaller muted text
- High score display (if available)
- Animated background (moving shapes, parallax, particles)

**Behavior:**
- Click or SPACE/ENTER triggers `start()`
- Must be rendered inside the game canvas (Phaser) or as HTML overlay (Three.js)
- Sets state to `'intro'`

### Pause Screen

**Required elements:**
- Semi-transparent dark overlay (alpha 0.5-0.7) — frozen game visible underneath
- Large centered "PAUSED" text
- "Click to Resume" or "Press ESC to Resume" prompt
- Current score display

**Behavior:**
- Game loop frozen (no logic updates)
- ESC or click triggers `resume()`
- Phaser: separate Scene launched on top of GameScene
- Three.js: HTML overlay div

### Game Over Screen

**Required elements:**
- "GAME OVER" header with dramatic entrance tween (scale from 0, or bounce)
- Final score prominently displayed
- High score comparison — if new record: "NEW HIGH SCORE!" with celebration effects
- "Click to Play Again" prompt
- Game stats (time, combo, etc.)

**Behavior:**
- `renderGameOverScreen(score)` receives `{ score, level?, timeElapsed, customData? }`
- Game loop stopped
- Click triggers `restart()`

### HUD

**Required elements:**
- Score counter (top-left, update every frame or on change)
- Health/lives display (if applicable)
- Timer (if time-based, format as MM:SS)
- Level/wave indicator (if applicable)

**Design guidelines:**
- Minimal — don't obscure gameplay
- `setScrollFactor(0)` for Phaser, `pointer-events: none` for Three.js
- Text shadow or semi-transparent background for readability
- Animate score changes (brief scale pop or color flash)

---

## 8. Audio System

### ZzFX Micro Engine (~900 bytes inline)

Procedural sound synthesis via Web Audio API. No external audio files needed.

```javascript
// Inline at top of game script
let zzfxCtx;
function zzfx(v=1,r=.05,f=220,a=0,s=0,rl=.1,sh=0,sc=1,sl=0,ds=0,pj=0,pjt=0,rt=0,n=0,m=0,bc=0,dl=0,sv=1,dc=0,tr=0){
  // ... (~900 bytes minified) ...
}
```

### SFX Presets

```javascript
const SFX = {
  // Movement
  jump:      [,,220,,.1,,.3,2,,,,,.12,.1],
  land:      [.5,,123,.01,,.03,,1.8,,,,,,8,-2],
  dash:      [,,880,,.06,.04,,1.3,,7,,,,6],

  // Combat
  shoot:     [,,90,.01,.03,.02,4,2,,,,,,,4],
  hit:       [1,.1,480,.03,.1,.02,1,.5,,,,,,.5],
  explosion: [2,.1,130,.01,.6,.5,4,.1,,30,,,,.5,-5],

  // Collectibles
  coin:      [,,537,.02,.02,.22,1,1.59,-6.98,4.97],
  powerUp:   [,,660,,.1,.3,1,1.8,,7,,,.09],

  // UI
  select:    [,,440,,.03,.03,1,2,,,100,.03],
  confirm:   [,,660,,.05,.1,1,1.5],
  back:      [,,220,,.05,.1,1,.5],

  // Game states
  levelUp:   [1.5,.8,270,,.1,,1,1.5,,,,,,.1,.01],
  gameOver:  [,,925,.04,.3,.6,1,.3,,6.27,-184,.09,.17],

  // 3D-specific
  impact:    [2,,100,.01,.1,.2,4,1.5,,,-200,.1,,2],
};
```

### AudioManager

```javascript
const audioManager = createAudioManager();

// Play sounds:
audioManager.play('coin');     // Respects pause/mute state
// or directly:
zzfx(...SFX.coin);             // Ignores pause/mute

// Lifecycle integration (REQUIRED):
// In pause():   audioManager.onPause();
// In resume():  audioManager.onResume();
// In destroy(): audioManager.onDestroy();
```

### Minimum Required Sound Mapping

| Category | Preset Keys | When to Play |
|---|---|---|
| Movement | `jump`, `dash`, `land` | Player actions |
| Combat/Collision | `hit`, `impact`, `explosion` | Damage, collisions |
| Collection | `coin`, `powerUp` | Item pickup, score |
| UI | `select`, `confirm`, `back` | Menu interactions |
| State Changes | `levelUp`, `gameOver` | Milestones, death |

### Critical Audio Rules

- `audioManager.onPause()` MUST be called in `SloppyGame.pause()`
- `audioManager.onResume()` MUST be called in `SloppyGame.resume()`
- `audioManager.onDestroy()` MUST be called in `SloppyGame.destroy()`
- NEVER use `new Audio()` or raw `AudioContext` — only ZzFX and AudioManager
- NEVER auto-play audio on load — ZzFX handles AudioContext creation on first user interaction
- The AudioManager auto-listens for `sloppy:mute` / `sloppy:unmute` postMessage events

---

## 9. Validation Rules

After EVERY change to a game, validate against ALL of these checks.

### Check 1: Required Files

- `index.html` — must exist
- `config.json` — must exist
- Inline `<script>` block must extract to non-empty `game.js`

### Check 2: V2 Method Detection (all 11 must appear)

Search the inline JS for these method patterns:

```
init, destroy, start, pause, resume, restart,
renderIntroScreen, renderPauseScreen, renderGameOverScreen,
getState, getScore
```

### Check 3: Forbidden Patterns (NONE may appear)

```
eval(
new Function(
fetch(           // to external URLs
importScripts(
document.cookie
localStorage
sessionStorage
```

### Check 4: Config Schema Validation

`config.json` must have:
```json
{
  "title": "string (required)",
  "version": "semver string (required)",
  "engine": "phaser3 | threejs",
  "genre": "valid genre string",
  "supportsMultiplayer": false,
  "assets": [],
  "controls": [{ "key": "string", "action": "string" }],
  "resolution": { "width": 960, "height": 540, "scaleMode": "fit" }
}
```

### Check 5: SDK Contract Markers

All must appear in the JS:
```
window.SloppyGame
window.game
sloppy:game:ready
sloppy:game:error
sloppy:command
.init(document.body
metadata
supportsMultiplayer
```

### Check 6: Audio Markers

All must appear in the JS:
```
zzfx (or ZzFX)
SFX
AudioManager (or createAudioManager)
onPause
onResume
onDestroy
audioManager.play (at least 5 distinct play() calls)
```

### Check 7: JS Syntax

```bash
node -e "new Function(require('fs').readFileSync('game.js','utf8'))"
```

### Check 8: Bundle Size

Total bundle must be under 5MB (5,242,880 bytes).

### Validation Script

```bash
# Extract inline JS from the HTML and validate
node -e "
const fs = require('fs');
const html = fs.readFileSync('scripts/games/<game-name>/index.html', 'utf-8');
const scripts = [];
const re = /<script(?:\s[^>]*)?>([\\s\\S]*?)<\\/script>/gi;
let match;
while ((match = re.exec(html)) !== null) {
  if (match[0].includes(' src=')) continue;
  scripts.push(match[1]);
}
const gameJs = scripts.join('\\n');
// Run all 8 checks against gameJs and config.json...
"
```

---

## 9B. Mobile & Touch Support (REQUIRED)

All games MUST be playable on mobile touch devices. The platform runs on phones and tablets, and games that only work with keyboard input are not acceptable.

### Touch Controls Architecture

The platform provides an automatic touch controls overlay (d-pad, joystick, action buttons) that sits above the game iframe. This overlay sends `sloppy:touch` postMessage events to the game. To receive these events, include this bridge at the end of your inline script:

```javascript
// Sloppy Touch Controls Bridge
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

The `keyCode` and `which` properties are required because Phaser 3's keyboard system reads `event.keyCode` to identify keys. Without them, synthetic events are silently ignored.

### Direct Touch Handling

In addition to the bridge, games should implement direct touch/pointer handling wherever possible:

**Phaser 3 Games:**
- Use `this.input.on('pointerdown', callback)` — fires for both mouse clicks and touch taps
- Use `this.input.on('pointermove', callback)` for drag/aim mechanics
- Use `this.input.on('pointerup', callback)` for release detection
- Phaser's pointer system abstracts mouse vs touch — use it instead of raw DOM events

**Three.js / Canvas Games:**
- Add `touchstart`, `touchmove`, `touchend` event listeners alongside `mousedown`/`mousemove`/`mouseup`
- Map touch events to the same handler functions as mouse events
- Use `e.touches[0].clientX/clientY` instead of `e.clientX/clientY`

### Touch-Friendly UI
- All interactive elements (buttons, cards, game objects) must have a minimum tap target of 44×44 pixels
- Intro/Pause/GameOver screens must use `pointerdown` for "Tap to Start/Resume/Restart" instead of keyboard-only prompts
- Text prompts should say "Tap" or "Tap / Press" instead of just "Press"

### Responsive Canvas (REQUIRED)

Games run inside an iframe that may be any size depending on the device and orientation. Games MUST render correctly at any viewport size, not just the default W x H.

**Three.js games:** MUST include a `window.addEventListener('resize', ...)` handler that updates `renderer.setSize()` and `camera.aspect` on viewport change. During `init()`, use `window.innerWidth` / `window.innerHeight` instead of fixed W/H for `renderer.setSize()` and `camera.aspect`. The fixed W/H constants are retained for game logic ratios only.

**Phaser games:** Phaser's `Scale.FIT` + `CENTER_BOTH` handles responsive sizing automatically. No additional resize handler is needed. Letterboxing is acceptable when the viewport aspect ratio differs from the game's internal resolution.

### Genre-Specific Touch Patterns

| Genre | Touch Controls | Implementation |
|-------|---------------|----------------|
| Platformer | D-pad + Jump button | Overlay handles d-pad; also add `pointerdown` on screen halves for left/right |
| Arcade | D-pad + Action button | Overlay handles movement; game should also support `pointerdown` for action |
| Endless Runner | Tap to jump/act | `this.input.on('pointerdown', jump)` — works natively |
| Puzzle | Tap to interact | `this.input.on('pointerdown', select)` — works natively |
| Top-down / Shooter | Joystick + Fire button | Overlay sends arrow key events; game receives them via bridge |
| Racing | Joystick + Gas/Brake | Overlay sends key events; game receives them via bridge |
| Rhythm | Tap zones | Must implement `pointerdown` on each lane zone |
| Cards / Idle | Tap | `this.input.on('pointerdown')` — works natively |

---

## 10. Polish & Iteration

### What to Improve

**Visual Quality:**
- Color palette: harmonious colors, better contrast, gradient backgrounds
- Particle effects: on collisions, scoring, game-over, near-misses
- Screen transitions: fade between states, slide-in text
- HUD polish: smooth score counter (lerp displayScore toward actual score), text shadows

**Game Speed & Responsiveness (3D physics games):**
- Default physics values are often too slow — playtest and increase gravity, max velocity, and tilt/turn speed iteratively
- For tilt/marble games: gravity 30-40, max tilt 12-15°, tilt response speed 5-7, max velocity 5-7 units/s feels responsive
- Use sub-stepped physics (3-4 substeps per frame) to prevent tunneling through walls at higher speeds
- Frame-rate-independent friction: `velocity *= Math.pow(FRICTION, delta * 60)` instead of per-frame `velocity *= FRICTION`
- Verify stopping distance at terminal velocity stays under 2 cells: `v_terminal / ((1-friction) * 60)`. If too long, increase friction or decrease max tilt

**Game Feel ("Juice"):**
- Screen shake on damage: `this.cameras.main.shake(200, 0.01)`
- Camera flash on power-up: `this.cameras.main.flash(100, 0, 255, 255)`
- Scale bounce on collect: tween scaleX/Y to 1.2, yoyo back to 1.0
- Easing: `'Sine.easeInOut'`, `'Bounce.easeOut'`, `'Back.easeOut'`
- Near-miss feedback: sparks + bonus points when narrowly avoiding danger
- Dynamic HUD: score color shifts as score climbs
- Combo trail: persistent particle emitter that grows with combo level
- Death animation: player explodes into particles before game-over screen

**Phaser 3 Polish APIs:**

```javascript
// Particle burst on event
this.add.particles(x, y, 'particle_key', {
  speed: { min: 50, max: 150 }, lifespan: 500, quantity: 20, blendMode: 'ADD', emitting: false
}).explode(20);

// Scale bounce on collect
this.tweens.add({ targets: sprite, scaleX: 1.2, scaleY: 1.2, duration: 100, yoyo: true });

// Smooth score counter
displayScore += (score - displayScore) * 0.15;
scoreText.setText(`SCORE ${Math.floor(displayScore)}`);

// Text shadow glow
text.setShadow(2, 2, '#00ccff', 8, true, true);

// Staggered spawn animation
this.time.addEvent({ delay: 100, callback: spawnNext, repeat: 5 });
```

### Iteration Workflow

1. **Identify issues** — Play the game, review code, note improvements
2. **Apply changes** — Edit `index.html` directly with targeted edits
3. **Re-validate** — Run all 8 validation checks
4. **Polish pass** — Apply visual/audio polish
5. **Re-validate** — Confirm polish didn't break the SDK contract

---

## 11. Debug & Fix Loop

When changes break validation, follow these rules:

1. **Targeted fixes only** — do NOT rewrite the entire game
2. **Preserve existing code** — keep all working logic, visuals, and SDK contract intact
3. **Max 5 iterations** — if it can't be fixed in 5 attempts, revert to last known good state

### Common Fix Patterns

| Problem | Fix |
|---|---|
| Missing method | Add with appropriate engine implementation |
| State not transitioning | Ensure `gameState` updates in every lifecycle method |
| Blank screen on pause/gameover | Ensure overlay elements are created and made visible |
| Console errors (undefined refs) | Check variables declared before use, objects exist before property access |
| `sloppy:game:ready` not firing | Add `postMessage` at end of `init()` after 'ready' event |
| `window.game` not set | Add `window.game = window.SloppyGame;` after assignment |
| Audio not working | Ensure ZzFX engine + SFX presets + AudioManager are all present before game code |
| **Blank screen in production** (game visible in listing but won't play) | Missing auto-init and/or postMessage command bridge. See "Auto-Init & PostMessage Command Bridge" section. The script must call `window.SloppyGame.init(document.body, ...)` at the end, AND register a `message` listener for `sloppy:command` events. |
| Parent start/pause/restart buttons don't work | Missing `message` event listener for `sloppy:command`. Add the PostMessage command bridge block. |
| **WASD movement reversed** (3D third-person) | Camera starts on wrong side of level. If level progresses in -Z, set `camOrbitAngle = Math.PI`. Verify forward vector `(sin(a), 0, cos(a))` at initial angle points toward platforms. |
| **A/D strafing swapped** (3D third-person) | Right vector is the LEFT perpendicular. Use `(-cos(a), 0, sin(a))` (Forward × Up), NOT `(cos(a), 0, -sin(a))`. |
| **Arrow key orbit reversed** (3D third-person) | ArrowRight should decrease `camOrbitAngle` (clockwise from above), ArrowLeft should increase it. Verify with the camera position formula. |
| **Inputs work at start but feel wrong after orbiting** | Forward/right vectors are not recomputed from `camOrbitAngle` each frame. Ensure they are calculated inside `updatePlayer()`, not cached. |
| **Pitch inverted in flight game** (W goes down, S goes up) | `rotateX(positive)` = nose UP in Three.js. Use `pitchInput = 1` for W/Up and `pitchInput = -1` for S/Down. See "Flight / 6DOF Rotation Axes" section. |
| **Controls feel random after intro screen** (flight game) | Intro animation accumulates rotation on the ship group. Reset `position`, `quaternion`, and `rotation` when transitioning from intro to playing. |
| **Game cropped on mobile** (Three.js) | Missing `resize` event listener. Add `window.addEventListener('resize', ...)` that calls `renderer.setSize(window.innerWidth, window.innerHeight)` and updates `camera.aspect`. Also use viewport dimensions in init instead of fixed W/H. |
| **Touch controls don't appear on mobile** | `MobileTouchControls` width threshold was using `innerWidth` which is the LONG edge in landscape. Fixed in shell to use `Math.min(innerWidth, innerHeight)`. Ensure games include the updated touch bridge with `keyCode` mapping. |
| **Touch overlay visible but Phaser ignores input** | Touch bridge was missing `keyCode`/`which` in synthetic `KeyboardEvent`. Use the updated bridge with the `kc` lookup table. |

---

## 12. Thumbnail Generation

### Step 1: Generate FLUX Prompt

Write a 100-200 word image prompt optimized for FLUX diffusion model:

- **Subject first:** Main character/scene prominently described
- **Action:** Dynamic moment — mid-action, dramatic pose
- **Composition:** Camera angle, framing, focal point. Leave bottom 20% clear (text overlay zone)
- **Lighting:** Dramatic cinematic lighting — rim lighting, volumetric rays, glow
- **Color palette:** Vibrant, saturated colors matching the game's visual style
- **Style keywords:** End with 3-5 descriptors (e.g., "digital painting, game art, cinematic lighting, 4K")

Do NOT include: text, UI elements, HUD, menus, buttons.

Save prompt to `scripts/games/<game-name>/thumbnail-prompt.txt`.

### Step 2: Generate Image via fal.ai

```bash
curl -X POST "https://fal.run/fal-ai/flux/schnell" \
  -H "Authorization: Key $FAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "<thumbnail prompt>",
    "image_size": {"width": 1280, "height": 720},
    "num_images": 1
  }'
```

### Step 3: Create Small Version

Resize the 1280×720 image to 600×338 for the small thumbnail:

```bash
# macOS:
cp thumbnail.jpg thumbnail_sm.jpg && sips --resampleWidth 600 thumbnail_sm.jpg
```

### Genre Visual Archetypes (for prompts)

| Genre | Visual Description |
|---|---|
| 2d-arcade | Dynamic action moment with projectiles, score counter, retro neon glow |
| 2d-platformer | Side-view action pose mid-jump, colorful backgrounds, floating platforms |
| 2d-puzzle | Clean geometric arrangement, color-matched patterns, glow effects |
| 2d-shooter | Bullet-hell moment, player ship centered, projectile trails |
| 3d-racing | Low-angle behind vehicle, speed lines, scenic backdrop |
| 3d-firstperson | FP perspective down corridor, weapon visible, dramatic lighting |

---

## 13. Deployment

### Prerequisites

1. Cloud SQL Auth Proxy available (`brew install cloud-sql-proxy`)
2. `gcloud` authenticated
3. Terraform service account key at `secrets/terraform-sa.json`
4. `.env.production` with `DB_PASSWORD` and `FAL_KEY`

### Deploy Process

The deploy script is fully self-contained — it handles Cloud SQL proxy lifecycle, thumbnail generation, GCS uploads, and DB updates in a single command:

```bash
pnpm tsx scripts/deploy-game.ts \
  --dir scripts/games/<game-name> \
  --creator-name sloppy \
  --publish
```

The script automatically:
1. Enables Cloud SQL public IP
2. Starts Cloud SQL Auth Proxy and waits for connectivity
3. Creates DB records (user + game)
4. Uploads game bundle (index.html, config.json, game.js) to GCS
5. Generates thumbnail via fal.ai FLUX if `thumbnail-prompt.txt` exists (skips if `thumbnail.jpg` already present)
6. Resizes thumbnail to 600px wide for `thumbnail_sm.jpg`
7. Uploads both thumbnails to GCS
8. Updates DB with `storage_path`, `thumbnail_url`, `thumbnail_sm_url`
9. Kills proxy and disables Cloud SQL public IP (even on failure)

**Options:**
- `--publish` — Set game status to `published` (default: `draft`)
- `--skip-thumbnail` — Skip thumbnail generation even if prompt exists
- `--dry-run` — Validate files and print plan without making changes
- `--creator-name <name>` — Creator username (default: `sloppy`)

**Environment overrides** (all optional — defaults read from `.env.production`):
- `DATABASE_URL` — Full connection string (overrides `DB_PASSWORD`)
- `GCS_BUCKET` — GCS bucket name
- `CDN_BASE_URL` — CDN URL prefix
- `FAL_KEY` — fal.ai API key for thumbnail generation
- `DB_PASSWORD` — Database password

### What the Deploy Script Does

1. Creates a `sloppy` user in DB (firebase_uid: `system_sloppy`) if not exists
2. Creates a game record (id, title, slug, genre, engine, status)
3. Uploads 3 files to GCS: `index.html`, `config.json`, `game.js` (extracted inline)
4. Updates game record with `storage_path`
5. Sets status to `published` (with `--publish` flag)

### Post-Deploy URLs

- **Bundle:** `https://storage.googleapis.com/sloppy-game-bundles-prod/games/<gameId>/v1/index.html`
- **Game page:** `https://sloppygames.io/game/<slug>`

### Production Infrastructure

| Resource | Value |
|---|---|
| GCP Project | `sloppy-app` |
| Region | `us-east1` |
| DB Instance | `sloppy-app:us-east1:sloppy-pg-prod` |
| DB User/Name | `sloppy` / `sloppy` |
| Proxy Port | `5433` |
| GCS Bucket | `sloppy-game-bundles-prod` |
| CDN URL | `https://storage.googleapis.com/sloppy-game-bundles-prod` |
| Frontend | `https://sloppygames.io` |

---

## 14. Config Schema

Every game needs a `config.json`:

```json
{
  "title": "Game Title",
  "version": "1.0.0",
  "engine": "phaser3",
  "genre": "2d-arcade",
  "supportsMultiplayer": false,
  "controls": [
    { "key": "ArrowLeft", "action": "Move left" },
    { "key": "ArrowRight", "action": "Move right" },
    { "key": "Space", "action": "Jump" },
    { "key": "Escape", "action": "Pause" }
  ],
  "resolution": {
    "width": 960,
    "height": 540,
    "scaleMode": "fit"
  },
  "assets": [],
  "audio": [],
  "estimatedPlayTime": "1-5 min"
}
```

**Validation rules:**
- `title`: string, 1-120 chars, required
- `version`: semver string (e.g., "1.0.0"), required
- `engine`: must be `phaser3`, `threejs`, or `canvas2d`
- `genre`: must be one of the supported genre strings
- `supportsMultiplayer`: boolean, required
- `assets`: array of strings, required (usually empty `[]`)
- `controls`: array of `{ key, action }` objects
- `resolution.scaleMode`: `fit` | `fill` | `stretch`

---

## 15. Database Schema

### Games Table (key fields)

```sql
games (
  id              TEXT PRIMARY KEY,         -- 21-char random ID
  creator_id      TEXT REFERENCES users,
  title           TEXT NOT NULL,
  description     TEXT DEFAULT '',
  slug            TEXT UNIQUE NOT NULL,     -- URL-safe, auto-generated
  genre           TEXT,                     -- e.g., '2d-arcade'
  engine          TEXT DEFAULT 'canvas2d',  -- 'phaser3' | 'threejs' | 'canvas2d'
  thumbnail_url   TEXT,                     -- Full-size thumbnail URL
  thumbnail_sm_url TEXT,                    -- Small thumbnail URL
  resolution_width  INT DEFAULT 960,
  resolution_height INT DEFAULT 540,
  scale_mode      TEXT DEFAULT 'fit',
  supports_multiplayer BOOLEAN DEFAULT false,
  version         INT DEFAULT 1,
  status          TEXT DEFAULT 'draft',     -- 'draft' | 'published'
  play_count      INT DEFAULT 0,
  favourite_count INT DEFAULT 0,
  storage_path    TEXT,                     -- GCS path: games/<id>/v1
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
)
```

### Users Table

```sql
users (
  id              TEXT PRIMARY KEY,
  firebase_uid    TEXT UNIQUE NOT NULL,     -- 'system_sloppy' for platform games
  email           TEXT NOT NULL,            -- 'sloppy@sloppygames.io' for platform games
  display_name    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
)
```

---

## 16. File Structure

### Per-Game Directory

```
scripts/games/<game-name>/
├── index.html              # Complete self-contained game (THE deployable artifact)
├── config.json             # v2 config schema
├── gdd.json                # Game Design Document (Concept Architect output)
├── tech-spec.json          # Technical Specification (Technical Planner output)
├── thumbnail-prompt.txt    # FLUX image generation prompt
├── thumbnail.jpg           # Generated thumbnail (1280×720)
└── thumbnail_sm.jpg        # Small thumbnail (600×338)
```

### HTML File Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Game Title</title>
  <script src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #0a0a1a; }
    canvas { display: block; }
  </style>
</head>
<body>
<script>
  // 1. Chain of thought comment block
  // 2. ZzFX Micro engine (~900 bytes)
  // 3. SFX presets map
  // 4. AudioManager factory + initialization
  // 5. Game constants (W, H, LANE_COUNT, etc.)
  // 6. Game state variables
  // 7. Utility functions
  // 8. BootScene class
  // 9. IntroScene class
  // 10. GameScene class
  // 11. PauseScene class
  // 12. GameOverScene class
  // 13. window.SloppyGame adapter object (all 12 methods)
  // 14. window.game = window.SloppyGame
  // 15. window.triggerGameOver function
  // 16. PostMessage command bridge (sloppy:command listener)
  // 17. Auto-init: window.SloppyGame.init(document.body, ...)
  // 18. Sloppy Touch Controls Bridge (with keyCode mapping)
</script>
</body>
</html>
```

---

## 17. Reference: Source Files

### SDK & Validation
| File | Purpose |
|---|---|
| `packages/runtime-sdk/src/types.ts` | SloppyGameV2 interface, GameState, GameResult, GameMetadata |
| `packages/runtime-sdk/src/schema.ts` | config.json JSON Schema (Ajv validation) |
| `packages/runtime-sdk/src/validator.ts` | Source-level validation (forbidden patterns, v2 method checks) |
| `services/game-builder/src/validation/pipeline.ts` | Bundle validation (required files, methods, config, syntax, size) |
| `services/game-builder/src/validation/runtime-validator.ts` | Puppeteer runtime validation (state machine traversal) |

### Code Generation
| File | Purpose |
|---|---|
| `services/ai-orchestrator/src/prompts/code.ts` | SDK v2 contract prompt, audio rules, chain-of-thought, output format |
| `services/ai-orchestrator/src/prompts/engines/phaser3.ts` | Phaser 3 scene architecture, CDN URL, quality rules, forbidden patterns |
| `services/ai-orchestrator/src/prompts/engines/threejs.ts` | Three.js setup, shadow/lighting rules, HUD overlay pattern |
| `services/ai-orchestrator/src/prompts/genres/*.ts` | Genre-specific mechanics (18 genre files) |
| `services/ai-orchestrator/src/prompts/screens/*.ts` | Screen rendering templates (intro, pause, gameover, hud) |

### Pipeline Agents
| File | Purpose |
|---|---|
| `services/ai-orchestrator/src/agents/concept-architect.ts` | GDD generation from user prompt |
| `services/ai-orchestrator/src/agents/technical-planner.ts` | Technical spec from GDD |
| `services/ai-orchestrator/src/pipeline/code.ts` | Code generation orchestration |
| `services/ai-orchestrator/src/agents/debug-fixer.ts` | Fix validation failures (max 5 iterations) |
| `services/ai-orchestrator/src/agents/polish-agent.ts` | Visual polish pass |
| `services/ai-orchestrator/src/agents/audio-generator.ts` | ZzFX audio injection |
| `services/ai-orchestrator/src/agents/thumbnail-prompter.ts` | FLUX image prompt generation |
| `services/ai-orchestrator/src/pipeline/types.ts` | GDD, TechnicalSpec, PipelineContext interfaces |

### Audio
| File | Purpose |
|---|---|
| `packages/runtime-sdk/src/v2/audio/zzfx-micro.ts` | ZzFX engine + inline source generator |
| `packages/runtime-sdk/src/v2/audio/zzfx-presets.ts` | 14 SFX presets + inline source generator |
| `packages/runtime-sdk/src/v2/audio/audio-manager.ts` | AudioManager factory + inline source generator |

### Deploy & Storage
| File | Purpose |
|---|---|
| `services/game-builder/src/scripts/deploy-game.ts` | Direct-to-prod deploy script (DB + GCS) |
| `packages/db/src/schema.ts` | DB schema (users, games, sessions, etc.) |
| `packages/db/src/connection.ts` | DB client factory |
| `services/game-builder/src/storage/gcs.ts` | GCS upload/download |
| `.env.production` | Production credentials (DB_PASSWORD, FAL_KEY, etc.) |
| `deploy.sh` | Full platform deploy script |
