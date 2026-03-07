# Sloppy — Batch Game Creation Prompts (20 Games)

Each game below has its own **self-contained prompt**. To use: copy the **COMMON PREAMBLE** section, then append the specific game section. Paste the combined text into a fresh Cursor agent conversation. Each agent builds one game end-to-end.

---

# COMMON PREAMBLE (prepend to every game prompt below)

```text
You are building a high-quality browser game for the Sloppy platform. This is a complete self-contained task — you will design, build, validate, polish, and iterate on the game until it is production-ready.

## STEP 0: Read Required Files

Before writing any code, you MUST read these files in order:

1. `docs/game-creation-guide.md` — THE source of truth. Contains the full SDK v2 contract, Phaser 3 engine guide, Three.js engine guide, ZzFX audio system, validation rules (all 8 checks), screen rendering requirements, config schema, file structure, and deployment info.
2. `scripts/games/neon-drift/index.html` — A working reference game. Study its structure: ZzFX engine inline, SFX presets, AudioManager, BootScene, IntroScene, GameScene, PauseScene, GameOverScene, SloppyGame adapter, window.game, triggerGameOver, postMessage command bridge, and auto-init call.
3. `scripts/games/neon-drift/config.json` — Reference config format.
4. `scripts/deploy-game.ts` — Understand what the deploy script expects: index.html + config.json in a directory under scripts/games/.

## CRITICAL SDK v2 Requirements (must be in every game)

Every game is a SINGLE self-contained `index.html` file with all code inline. No external assets. Two engines: Phaser 3 (2D, 960×540) or Three.js (3D, 1280×720).

### All 12 Required Methods on window.SloppyGame:

```javascript
window.SloppyGame = {
  async init(container, config) { ... },   // Create engine, post sloppy:game:ready
  destroy() { ... },                        // Clean up everything
  start() { ... },                          // → show intro screen
  pause() { ... },                          // → show pause overlay, audioManager.onPause()
  resume() { ... },                         // → hide overlay, audioManager.onResume()
  restart() { ... },                        // Reset all state → playing
  renderIntroScreen() { ... },
  renderPauseScreen() { ... },
  renderGameOverScreen(score) { ... },
  renderHUD() { ... },
  getState() { ... },                       // Returns 'idle'|'intro'|'playing'|'paused'|'gameover'
  getScore() { ... },                       // Returns { score, level?, timeElapsed, customData? }
  metadata: { title, genre, engine, supportsMultiplayer, controls, estimatedPlayTime },
  supportsMultiplayer: false
};
window.game = window.SloppyGame;
```

### PostMessage Command Bridge (REQUIRED — without this, parent buttons don't work):

```javascript
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
```

### Auto-Init (REQUIRED — without this, the game shows a blank screen):

```javascript
window.SloppyGame.init(document.body, { container: document.body, width: W, height: H });
```

### triggerGameOver (REQUIRED — for Puppeteer validation):

```javascript
window.triggerGameOver = function() {
  if (gameState === 'playing') {
    gameState = 'gameover';
    // transition to game over scene/state
  }
};
```

### Correct order at end of <script>:
1. Define window.SloppyGame = { ... };
2. Set window.game = window.SloppyGame;
3. Define window.triggerGameOver = function() { ... };
4. Register message event listener (command bridge)
5. Call window.SloppyGame.init(document.body, ...)

## Audio Requirements

All audio is procedural via ZzFX (~900 bytes inline). NEVER use new Audio() or load external audio files.

Required in every game:
- ZzFX micro engine function inlined at top of script
- SFX presets object with at least 8 distinct sounds
- AudioManager created via createAudioManager() factory
- audioManager.onPause() called in pause()
- audioManager.onResume() called in resume()
- audioManager.onDestroy() called in destroy()
- At least 5 distinct audioManager.play() calls in game logic

Get the exact ZzFX engine code, SFX presets, and AudioManager factory from the neon-drift reference game.

## Validation Checklist (run after EVERY code change)

After building and after each iteration, verify ALL of these:

1. FILES: index.html and config.json exist in scripts/games/<game-name>/
2. V2 METHODS: All 12 methods present (init, destroy, start, pause, resume, restart, renderIntroScreen, renderPauseScreen, renderGameOverScreen, renderHUD, getState, getScore)
3. FORBIDDEN PATTERNS: None of these appear: eval(, new Function(, fetch(, importScripts(, document.cookie, localStorage (exception: high score persistence OK), sessionStorage
4. CONFIG SCHEMA: config.json has title, version, engine, genre, supportsMultiplayer, controls, resolution, assets
5. SDK MARKERS: All present in JS: window.SloppyGame, window.game, sloppy:game:ready, sloppy:game:error, sloppy:command, .init(document.body, metadata, supportsMultiplayer
6. AUDIO MARKERS: All present: zzfx/ZzFX, SFX, AudioManager/createAudioManager, onPause, onResume, onDestroy, at least 5 audioManager.play() calls
7. JS SYNTAX: Extract inline JS and verify with: node -e "new Function(js)"
8. BUNDLE SIZE: Total index.html under 5MB

## Quality Bar

The game is NOT done until ALL of these are true:
- Passes all 8 validation checks above
- Visually polished (particles, tweens, camera effects, text shadows, animated backgrounds)
- Great game feel (responsive controls, satisfying feedback on every action)
- Complete screens (Intro with animated title + controls + high score, Pause with frozen game visible, Game Over with score + high score + celebration)
- Full audio (8+ distinct ZzFX sounds: movement, collision, collection, UI, state changes)
- Difficulty progression (game gets harder over time, fair and engaging)
- No bugs (no console errors, no stuck states, no visual glitches)
- At least 3 full review-and-fix iterations after initial build

## HTML File Structure (Phaser 3 games)

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
  // 1. ZzFX Micro engine (~900 bytes)
  // 2. SFX presets object
  // 3. createAudioManager factory + const audioManager = createAudioManager()
  // 4. Game constants (W=960, H=540, etc.)
  // 5. Game state variables
  // 6. Utility functions
  // 7. BootScene (generate all textures via generateTexture)
  // 8. IntroScene (title, controls, high score, animated bg, "Click to Start")
  // 9. GameScene (core gameplay, input, physics, spawning, collision, HUD, difficulty)
  // 10. PauseScene (overlay on top of GameScene)
  // 11. GameOverScene (score, high score, "NEW HIGH SCORE!", replay prompt)
  // 12. window.SloppyGame = { all 12 methods + metadata + supportsMultiplayer }
  // 13. window.game = window.SloppyGame
  // 14. window.triggerGameOver = function() { ... }
  // 15. window.addEventListener('message', ...) — command bridge
  // 16. window.SloppyGame.init(document.body, { container: document.body, width: W, height: H })
</script>
</body>
</html>
```

## HTML File Structure (Three.js games)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Game Title</title>
  <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
    canvas { display: block; }
  </style>
</head>
<body>
<script>
  // 1. ZzFX Micro engine (~900 bytes)
  // 2. SFX presets object (include footstep + footstep2 variants for walking games)
  // 3. createAudioManager factory + const audioManager = createAudioManager()
  // 4. Game constants (W=1280, H=720, head bob params, etc.)
  // 5. Game state variables (including bobTimer, bobIntensity for FP games)
  // 6. Three.js setup (renderer, scene, camera, lights)
  //    - Use 2048 shadow maps, configure shadow camera frustum to scene size
  //    - scene.add(dirLight.target) — REQUIRED for shadow aiming
  //    - Position dirLight at angle for visible floor shadows
  // 7. HUD overlay (HTML div, pointer-events:none, z-index:10, text-shadow for readability)
  // 8. Screen overlays (intro, pause, gameover — HTML divs)
  // 9. Game objects creation (meshes, materials — all pre-created)
  //    - InstancedMesh with setColorAt() for repeated blocks (walls, tiles)
  //    - Geometry 0.96 size for gaps between adjacent blocks
  //    - Wall caps (thin darker InstancedMesh on top) for edge definition
  //    - Track shared geometries in array for single disposal
  // 10. Input handler
  // 11. Game logic functions
  //    - Head bob (vertical + sway + roll) for first-person games
  //    - Sync footstep SFX to bob zero-crossings
  //    - Minimap with directional player triangle + FOV cone
  //    - Procedural gen: retry counters, validate pathfinding inputs
  // 12. Animation loop (requestAnimationFrame, Clock.getDelta)
  // 13. window.SloppyGame = { all 12 methods + metadata + supportsMultiplayer }
  // 14. window.game = window.SloppyGame
  // 15. window.triggerGameOver = function() { ... }
  // 16. window.addEventListener('message', ...) — command bridge
  // 17. window.SloppyGame.init(document.body, { container: document.body, width: W, height: H })
</script>
</body>
</html>
```

### Three.js Critical Rules (MUST follow)
- **CDN**: ONLY use `three@0.160.0` — versions 0.161+ removed the UMD build (`three.min.js`), causing "THREE is not defined"
- **Shadow camera**: ALWAYS configure `dirLight.shadow.camera.left/right/top/bottom` to cover scene. ALWAYS `scene.add(dirLight.target)`.
- **InstancedMesh**: Use `setColorAt()` for per-instance color variation. Make geometry ~0.96 of grid cell for visible seams.
- **Materials**: NEVER use `MeshBasicMaterial` — use `MeshStandardMaterial` with emissive for glow effects.
- **Disposal**: Track shared geometries in an array, dispose once. Never dispose same geometry multiple times.
- **First-person feel**: Head bob (sin vertical + cos sway + sin roll), smooth ease in/out, synced footstep SFX at zero-crossings.
- **Minimap**: Directional triangle for player + FOV cone, not just a dot.

## Output Files

Create directory: scripts/games/<game-slug>/
Files to produce:
- index.html — Complete self-contained game
- config.json — Game metadata per schema
- gdd.json — Full game design document
- thumbnail-prompt.txt — 100-200 word FLUX image prompt for thumbnail

## Iteration Process

1. Build initial index.html
2. Run all 8 validation checks — fix any failures
3. Mental play-test: Walk through every state (intro → playing → pause → resume → game over → restart). Check: Are controls responsive? Do particles work? Does difficulty scale? Do all screens render correctly?
4. Polish pass: Add juice (screen shake, scale bounce, particle bursts, smooth score counter, text shadows)
5. Re-validate after polish
6. Review and improve: Find 3+ things to make better, fix them
7. Final validation pass
```

---
---

# GAME 1: Chrono Hop

## Prompt (append after Common Preamble)

### Game Concept

**Title:** Chrono Hop
**Slug:** `chrono-hop`
**Genre:** `2d-platformer`
**Engine:** `phaser3`
**Logline:** A time-bending platformer where platforms phase between two timelines — master the rhythm of reality to reach ever-greater heights.

**Visual Style:** Deep indigo/purple backgrounds with two contrasting timeline color schemes — Timeline A uses warm amber/orange tones, Timeline B uses cool cyan/teal. Platforms glow with their timeline color and pulse gently. Star-field particle background that shifts hue with timeline changes. Player character is a small luminous humanoid figure with a trailing afterimage.

**Core Mechanic:** The player ascends vertically through a procedurally generated field of platforms. Platforms belong to one of two timelines (A or B) that alternate visibility on a regular cycle (every 3 seconds). The player presses Shift to manually shift timelines at any moment, revealing the other set of platforms. The challenge is timing jumps to land on platforms that are currently solid. Falling off the bottom of the screen or landing where no platform exists ends the game. The camera scrolls upward at an increasing pace.

**Controls:**
- Left/Right Arrow or A/D: Move horizontally
- Up Arrow or W or Space: Jump (hold for higher jump)
- Shift: Switch timeline (toggle which set of platforms is solid)
- Escape: Pause

**Progression:** Camera scroll speed increases every 30 seconds. Platform density decreases over time. New hazards appear at score thresholds: spikes at 500, moving platforms at 1000, crumbling platforms at 2000.

**Scoring:** +10 per platform landed. +50 for timeline-shift landings (landing on a platform within 0.5s of shifting). +100 bonus per 1000px height milestone. Combo multiplier for consecutive landings without touching the ground for more than 1s.

**Game Over Condition:** Player falls below the bottom of the camera view, or touches a spike.

**Restart Behavior:** Reset all state — score, height, combo, timeline, platform generation seed. Camera returns to start.

**Screens:**
- **Intro:** "CHRONO HOP" title with timeline-shift animation (text flickers between amber and cyan). Floating platform silhouettes drift in background. Controls displayed. High score shown. "Press SPACE to Start" pulses.
- **HUD:** Score top-left, current timeline indicator top-right (colored circle), height meter right edge, combo counter center-top (fades after 2s).
- **Pause:** Semi-transparent overlay, "PAUSED", current score, "Press ESC to Resume".
- **Game Over:** "GAME OVER" drops in with bounce easing. Final score + height reached. High score comparison with "NEW HIGH SCORE!" burst. "Click to Play Again".

**Objects:**
- Player: 20×24px luminous humanoid, trail particles, squash/stretch on jump/land
- Platform A: 80×12px amber/orange rectangle with glow, fades translucent when in other timeline
- Platform B: 80×12px cyan/teal rectangle with glow, fades translucent when in other timeline
- Spike: 16×16px red triangle on certain platforms, instant death
- Crumble Platform: Shakes and breaks 0.5s after stepped on
- Moving Platform: Slides horizontally on sine wave
- Timeline particles: Ambient floating particles in current timeline color
- Height milestone marker: Horizontal line with sparkle effect

### Build Instructions

1. Create `scripts/games/chrono-hop/` directory
2. Write `config.json`: engine phaser3, genre 2d-platformer, resolution 960×540
3. Write `gdd.json` with the design above
4. Build `index.html` — Phaser 3 via CDN, all code inline, follow the HTML structure from the preamble
5. Use Arcade Physics with gravity for the player. Platforms as static physics groups (one group per timeline). Toggle group visibility/body.enable on timeline switch.
6. Camera: `this.cameras.main.startFollow(player)` with Y deadzone. Auto-scroll upward by increasing camera Y each frame.
7. Platform generation: Spawn platforms above the camera view. Use `this.physics.add.staticGroup()` with `maxSize` for pooling. Recycle platforms that fall below camera.
8. Validate: Run all 8 checks. Fix any failures.
9. Polish: Camera shake on spike death, scale bounce on landing, particle burst on timeline shift, smooth score counter, text shadows on all UI
10. Iterate 3+ times improving something each pass
11. Write `thumbnail-prompt.txt`: Luminous figure mid-jump between amber and cyan glowing platforms in dark void, dramatic cinematic lighting, game art style, 4K

---
---

# GAME 2: Dungeon Dash

## Prompt (append after Common Preamble)

### Game Concept

**Title:** Dungeon Dash
**Slug:** `dungeon-dash`
**Genre:** `2d-topdown`
**Engine:** `phaser3`
**Logline:** Hack and slash through procedurally generated dungeon rooms — clear every enemy, grab the key, and find the exit before the darkness swallows you.

**Visual Style:** Dark stone dungeon aesthetic with procedural tiled floors (dark gray/brown rectangles). Torchlight glow around the player (radial gradient overlay). Enemies are vivid colored shapes — green slimes (circles), red imps (triangles), purple wraiths (diamonds). Walls are dark rectangles. Items glow with golden light.

**Core Mechanic:** Room-based arena combat. The player enters one room at a time, each containing enemies. Player moves in 8 directions (WASD), attacks with Space (slash arc in facing direction), and dodge-rolls with Shift (0.3s dash with invincibility, 1s cooldown). Killing all enemies drops a key. The key unlocks the door to the next room. Health does not regenerate between rooms (rare health potions have 20% spawn chance per room).

**Controls:**
- WASD: Move (8 directions, diagonal normalized)
- Space: Attack (melee slash in facing direction)
- Shift: Dodge roll (0.3s dash with invincibility, 1s cooldown)
- Escape: Pause

**Progression:** Room 1: 3 slimes. Room 2: 5 slimes. Room 3: 3 slimes + 2 imps. Room 4+: Increasing counts, wraiths at room 6+. Enemy speed +5%/room. Every 5 rooms = boss room (large enemy, more HP, attack patterns).

**Scoring:** +10/slime, +25/imp, +50/wraith, +200/boss. +100/room cleared. Time bonus for fast clears. Combo for kills within 2s of each other.

**Game Over Condition:** Player health reaches 0.

**Restart Behavior:** Room 1, full health, score 0.

**Screens:**
- **Intro:** "DUNGEON DASH" in rugged stone-textured font. Flickering torchlight. Sword icon. Controls. High score. "Press SPACE to Enter".
- **HUD:** Health bar top-left (red), Score top-right, Room number center-top, Dodge cooldown bottom-center, Key icon when collected.
- **Pause:** "PAUSED", score + room number, "ESC to Resume".
- **Game Over:** "YOU HAVE FALLEN" with red flash. Rooms cleared, enemies killed, score. High score. "Click to Try Again".

**Objects:**
- Player: 20×20px knight (colored square with directional indicator), 100 HP, slash arc animation
- Slime: 16×16px green circle, 20 HP, slow chase AI (`moveToObject`), 10 contact damage
- Imp: 14×14px red triangle, 30 HP, charges at player, 15 damage
- Wraith: 18×18px purple diamond, 40 HP, teleports every 3s, fires ranged projectile, 20 damage
- Boss: 32×32px dark red square, 200 HP, alternates charge and projectile phases
- Key: 8×12px golden rectangle with glow
- Health Potion: 10×14px green flask, restores 25 HP
- Door: 24×24px brown rectangle, locked (red tint) until key collected

### Build Instructions

1. Create `scripts/games/dungeon-dash/`
2. Write `config.json`: engine phaser3, genre 2d-topdown, resolution 960×540
3. Write `gdd.json`
4. Build `index.html` — combat system + room generation + enemy AI. Enemies use physics groups with maxSize.
5. Room generation: Rectangular arena with random wall placement (avoid blocking paths). Enemies spawn away from player start.
6. Validate: Run all 8 checks.
7. Polish: Screen shake on damage, flash on dodge, particle burst on enemy death, floating damage numbers, smooth health bar
8. Iterate 3+ times — improve AI, balance difficulty, fix edge cases
9. Write `thumbnail-prompt.txt`: Top-down dungeon, knight fighting glowing enemies, torchlight, dramatic shadows

---
---

# GAME 3: Prism Match

## Prompt (append after Common Preamble)

### Game Concept

**Title:** Prism Match
**Slug:** `prism-match`
**Genre:** `2d-puzzle`
**Engine:** `phaser3`
**Logline:** Rotate colorful prisms on a grid to direct light beams to their matching receptors — a serene yet increasingly devious puzzle of optics and color.

**Visual Style:** Clean minimalist dark background (#0a0a2e). Grid cells are subtle outlined squares. Prisms are bright geometric triangles in 4 colors (red, blue, green, yellow). Light beams are animated dashed lines with glow effect. Receptors pulse gently when awaiting their beam. Completed connections create a satisfying full-glow state.

**Core Mechanic:** A grid (starting 5×5) contains prisms and receptors. Click a prism to rotate it 90° clockwise. Each prism reflects incoming light beams at 90° angles. Light sources emit beams from grid edges. Rotate all prisms so every beam reaches its matching-color receptor. Timer counts up (speed-run). Moves counter tracks efficiency.

**Controls:**
- Mouse Click: Rotate prism 90° clockwise
- Right Click: Rotate 90° counter-clockwise
- R: Reset current level
- Escape: Pause

**Progression:** Levels 1-3: Single color, small grid. Levels 4-6: Two colors, larger grid. Levels 7-10: Three colors, beam splitters. Levels 11+: Four colors, mirrors, walls. Procedural generation after level 15.

**Scoring:** Base 1000/level. -10/move (min 100). -1/second. Bonus 500 under par moves, 300 under par time. Star rating 3/2/1.

**Game Over Condition:** Level-based — run ends when player quits or fails 5min timeout. Cumulative score.

**Restart Behavior:** Level 1, score 0. Or restart current level only.

**Screens:**
- **Intro:** "PRISM MATCH" with animated light beams crossing. Prism shapes rotate in background. "Click to Start". Highest level reached.
- **HUD:** Level top-left, Moves top-center, Timer top-right, Stars, "R to Reset" hint.
- **Pause:** "PAUSED", level + cumulative score, "Click to Resume".
- **Game Over:** "COMPLETE" or "TIME'S UP". Levels, score, stars. "Play Again".

**Objects:**
- Prism: 40×40px colored triangle, rotatable, click highlight
- Light Source: Edge marker emitting colored beam
- Light Beam: Animated dashed line with glow, deflects off prisms cell-by-cell
- Receptor: 30×30px circle outline, pulses, fills on activation
- Mirror: 40×40px silver rectangle, reflects all beams, not rotatable
- Wall: 40×40px dark block, absorbs beams
- Grid Cell: Subtle outline, highlights on hover

### Build Instructions

1. Create `scripts/games/prism-match/`
2. Write `config.json`: engine phaser3, genre 2d-puzzle, resolution 960×540
3. Write `gdd.json`
4. Build `index.html` — grid system with cell-to-pixel mapping, beam tracing algorithm (ray marches cell-by-cell, deflects on prism faces)
5. Pre-define at least 10 hand-crafted levels as JSON arrays (grid size, prism positions/rotations, sources, receptors)
6. Beam rendering: Use Phaser Graphics for animated dashed lines. Recalculate all beam paths on any prism rotation.
7. Validate: Run all 8 checks.
8. Polish: Smooth rotation tween (0.2s), beam redraw animation, receptor activation particle burst, staggered completion glow
9. Iterate 3+ times — test solvability, difficulty curve, visual feedback
10. Write `thumbnail-prompt.txt`: Geometric grid with colorful light beams crossing, prisms refracting, dark background with glow, clean digital art

---
---

# GAME 4: Gravity Flip

## Prompt (append after Common Preamble)

### Game Concept

**Title:** Gravity Flip
**Slug:** `gravity-flip`
**Genre:** `2d-arcade`
**Engine:** `phaser3`
**Logline:** Flip gravity on the fly to navigate a relentless gauntlet of spikes and gaps — one touch to defy physics, one mistake to die.

**Visual Style:** Dark void (#0d0d1a) with scrolling geometric grid lines. Player is a bright cyan square with pulsing glow trail. Obstacles are hot pink/orange angular shapes. Floor/ceiling are parallel white/gray bars. Minimal, high-contrast, neon.

**Core Mechanic:** Auto-scrolls left-to-right. Player is fixed horizontally, can only flip gravity (Space/Click toggles falling up vs down). Navigate through gaps in alternating floor/ceiling spike walls. Coins float in the path.

**Controls:**
- Space or Click: Flip gravity
- Escape: Pause

**Progression:** Speed starts 200px/s, +10px/s every 15s. Gaps shrink over time. New obstacles: horizontal spikes at 30s, moving walls at 60s, narrow corridors at 90s.

**Scoring:** +1/second survived. +25/coin. +50 near-miss (within 8px). Multiplier: ×2 at 30s, ×3 at 60s, ×5 at 120s.

**Game Over Condition:** Touch spike or obstacle.

**Restart Behavior:** Reset position, score, speed, gravity to default down.

**Screens:**
- **Intro:** "GRAVITY FLIP" with bouncing text (top/bottom). "Tap to Flip". High score.
- **HUD:** Score top-left, multiplier top-center, time survived top-right.
- **Pause:** "PAUSED", score, "ESC to Resume".
- **Game Over:** "GAME OVER" with shake. Score, distance, coins. "NEW HIGH SCORE!" particle explosion. "Tap to Retry".

**Objects:**
- Player: 16×16px cyan square, glow trail particle emitter, squash on flip
- Spike Wall: Vertical bars from floor/ceiling with gap, hot pink
- Coin: 12×12px golden circle, bob animation
- Horizontal Spike: Orange bar crossing mid-area
- Near-miss sparks: White particles on close pass

### Build Instructions

1. Create `scripts/games/gravity-flip/`
2. Write `config.json`: engine phaser3, genre 2d-arcade, resolution 960×540
3. Build `index.html` — Arcade Physics, toggle `player.body.gravity.y` between 800 and -800. Spike walls generated ahead of camera and recycled (physics group with maxSize).
4. Collision: `this.physics.add.collider(player, spikes, gameOver)`. `this.physics.add.overlap(player, coins, collect)`.
5. Validate all 8 checks.
6. Polish: Trail particles, camera shake on death, coin pop + burst, near-miss sparks, smooth score counter
7. Iterate 3+ times — tune gravity, gaps, speed ramp
8. Write `thumbnail-prompt.txt`

---
---

# GAME 5: Plasma Blitz

## Prompt (append after Common Preamble)

### Game Concept

**Title:** Plasma Blitz
**Slug:** `plasma-blitz`
**Genre:** `2d-shooter`
**Engine:** `phaser3`
**Logline:** Pilot a plasma-powered starfighter through relentless alien waves — upgrade weapons, dodge bullet patterns, survive the blitz.

**Visual Style:** Deep space (#050520) with parallax star layers. Player ship is bright green triangle. Enemy ships: red diamonds, orange hexagons, purple circles. Projectiles glow with additive blending. Explosions are particle bursts. Power-ups have golden aura.

**Core Mechanic:** Vertical scrolling shooter (player at bottom, enemies from top). Player moves freely in lower 60%. Auto-fire active (every 0.2s). Enemies spawn in wave formations with patterns (straight, sine, diagonal). Some enemies shoot back. Destroyed enemies may drop power-ups. Boss every 5 waves.

**Controls:**
- Arrow Keys or WASD: Move ship
- Space: Activate bomb (screen-clearing special, limited supply)
- Escape: Pause

**Progression:** Waves 1-2: Straight-down enemies, no return fire. Waves 3-4: Sine-wave + shooters. Wave 5: Mini-boss (circular bullet pattern). Wave 6+: Mixed formations. Wave 10: Full boss (phased attacks). Repeats with increased difficulty.

**Scoring:** +10/basic, +25/shooter, +100/mini-boss, +500/boss. +5/second. Combo for kills within 1s.

**Game Over Condition:** Ship destroyed (shield power-up absorbs 1 hit).

**Restart Behavior:** Wave 1, default weapon, 1 bomb, score 0.

**Screens:**
- **Intro:** "PLASMA BLITZ" in green with energy pulse. Star field. "Arrow Keys + SPACE". High score.
- **HUD:** Score top-left, Wave top-center, Bombs top-right, Weapon level bottom-left, Combo center.
- **Pause:** "PAUSED" over star field, score + wave.
- **Game Over:** Ship explodes → "MISSION FAILED". Score, waves, enemies destroyed. High score.

**Objects:**
- Player Ship: 24×20px green triangle, invincibility flash on respawn
- Player Bullets: 4×8px green rectangles (pooled)
- Spread Shot: 3-bullet fan (weapon upgrade)
- Laser: Continuous beam (weapon level 3)
- Basic Enemy: 16×16px red diamond, 10 HP
- Shooter Enemy: 18×16px orange hexagon, fires downward, 15 HP
- Boss: 48×32px, multiple attack phases, 300 HP, health bar
- Power-Up (Weapon/Shield/Bomb): Distinct colored shapes
- Explosions: 6-12 particles, additive blend

### Build Instructions

1. Create `scripts/games/plasma-blitz/`
2. Write `config.json`: engine phaser3, genre 2d-shooter, resolution 960×540
3. Build `index.html` — object pools for bullets (player + enemy), enemy groups with maxSize, wave spawning via time.addEvent
4. Auto-fire: `time.addEvent({ delay: 200, callback: fire, loop: true })`. Delay decreases with upgrades.
5. Waves: Pre-define wave data arrays `[{ type, x, pattern, delay }]`.
6. Boss: Health bar above, phase 1 circular bullets, phase 2 aimed shots + movement.
7. Validate all 8 checks.
8. Polish: Additive blend explosions, screen shake on bomb, boss entrance zoom, weapon upgrade flash, combo text pop
9. Iterate 3+ times — balance HP, bullet speed, wave pacing, drop rates
10. Write `thumbnail-prompt.txt`

---
---

# GAME 6: Crystal Keep

## Prompt (append after Common Preamble)

### Game Concept

**Title:** Crystal Keep
**Slug:** `crystal-keep`
**Genre:** `2d-tower-defense`
**Engine:** `phaser3`
**Logline:** Place towers of ice, fire, and lightning along winding paths to defend your crystal from relentless waves of shadow creatures.

**Visual Style:** Fantasy meadow (greens, earth tones). Winding brown dirt path. Tower zones are lighter green grid cells. Crystal glows blue. Enemies are dark purple/black silhouettes. Towers color-coded: blue (ice/slow), red (fire/splash), yellow (lightning/chain), gray (arrow). Projectiles leave colored trails.

**Core Mechanic:** Enemies walk along a predefined path toward the crystal. Player places towers on valid grid cells. Towers auto-attack enemies in range. Each type has unique behavior. Gold earned from kills buys more towers or upgrades. Crystal has 20 HP; enemies that reach it deal 1 damage (bosses deal 3).

**Controls:**
- Mouse Click: Select tower type from bottom panel, click cell to place
- 1/2/3/4: Quick-select tower type
- Right Click: Sell tower (50% refund)
- U: Upgrade selected tower
- Space: Start next wave early (bonus gold)
- Escape: Pause

**Progression:** Waves 1-3: Slow walkers. 4-5: Fast runners. 6-7: Armored (high HP). 8-9: Mixed. Wave 10: Boss (10× HP). Repeats with scaling.

**Scoring:** +10/kill, +50/wave, +200/boss. Bonus gold for early wave start. Final = kills × waves.

**Game Over Condition:** Crystal HP = 0.

**Restart Behavior:** Reset waves, gold (start 100), towers removed, crystal restored.

**Screens:**
- **Intro:** "CRYSTAL KEEP" over glowing crystal. Tower icons. "Defend the Crystal". High score (wave record). "Click to Begin".
- **HUD:** Gold top-left, Wave top-center, Crystal HP top-right, Tower panel bottom (4 buttons with costs).
- **Pause:** "PAUSED", wave + gold, "ESC to Resume".
- **Game Over:** Crystal shatters. "THE CRYSTAL FALLS". Waves, kills, towers, score. "Click to Defend Again".

**Objects:**
- Crystal: 32×32px blue diamond, sparkle particles, cracks as HP drops
- Path: Winding route defined as array of waypoints
- Arrow Tower: 50 gold, range 100px, fast single projectiles
- Ice Tower: 75 gold, range 80px, slows 40% for 2s
- Fire Tower: 100 gold, range 90px, splash AoE damage
- Lightning Tower: 125 gold, range 110px, chains to 3 enemies
- Basic Enemy: 30 HP, 60px/s, 10 gold
- Runner: 15 HP, 120px/s, 15 gold
- Armored: 80 HP, 40px/s, 25 gold
- Boss: 300 HP, 30px/s, 100 gold
- Range indicator: Translucent circle on tower hover

### Build Instructions

1. Create `scripts/games/crystal-keep/`
2. Write `config.json`: engine phaser3, genre 2d-tower-defense, resolution 960×540
3. Build `index.html` — path as waypoint array, enemies follow via manual lerp between waypoints. Tower targeting: closest to crystal (furthest along path).
4. Wave system: Pre-defined data `[{ type, count, delay }]`. Space starts next wave early.
5. Economy: Tower costs, kill rewards, sell refunds.
6. Validate all 8 checks.
7. Polish: Tower placement pop-up, projectile trails, enemy death particles, crystal damage flash, wave complete fanfare, gold "+N" floating text
8. Iterate 3+ times — balance economy, HP scaling, tower damage
9. Write `thumbnail-prompt.txt`

---
---

# GAME 7: Shadow Sprint

## Prompt (append after Common Preamble)

### Game Concept

**Title:** Shadow Sprint
**Slug:** `shadow-sprint`
**Genre:** `2d-endless-runner`
**Engine:** `phaser3`
**Logline:** A living shadow sprints through a world of deadly light — leap over beams, slide under spotlights, and collect darkness to survive.

**Visual Style:** Inverted aesthetic — white/light gray background, player and safe zones are dark/black. Light is danger (yellow/white glowing beams). Shadow orbs are dark purple with dark trails. Player is a black humanoid silhouette. Photographic-negative atmosphere.

**Core Mechanic:** Auto-runner. Jump (Space/Up) over vertical light beams, slide (Down/S) under horizontal spotlight bars. Shadow meter constantly depletes — collecting shadow orbs refills it. Meter empty = game over. Additional obstacles: expanding light pulses, alternating laser walls.

**Controls:**
- Space or Up: Jump (hold for higher)
- Down or S: Slide (hold to maintain)
- Escape: Pause

**Progression:** Speed 300px/s → +15px/s every 20s (cap 600). New obstacles: beams (start), bars (15s), pulses (30s), lasers (45s). Meter depletion rate increases.

**Scoring:** +1/meter run. +25/orb. +50 near-miss (within 10px). Multiplier from consecutive orb collection.

**Game Over Condition:** Touch light obstacle, or shadow meter = 0.

**Restart Behavior:** Reset position, speed, meter (full), score.

**Screens:**
- **Intro:** "SHADOW SPRINT" in dark text on light background. Shadow tendrils from edges. Running silhouette. "SPACE to Run". High score.
- **HUD:** Score top-left, Shadow meter bottom-center (pulses red when low), Distance top-right.
- **Pause:** "PAUSED" (dimmed).
- **Game Over:** White flash. "CONSUMED BY LIGHT". Score, distance, orbs. High score. "Click to Run Again".

**Objects:**
- Player: 20×30px black silhouette, tendril trail, squash on jump, stretch on slide
- Ground: Dark gray tileSprite, scrolling
- Light Beam: Vertical yellow rectangle
- Spotlight Bar: Horizontal white rectangle at waist height
- Light Pulse: Expanding bright circle
- Laser Wall: Full-height, toggles on/off every 1.5s
- Shadow Orb: 10×10px dark purple, bobs, dark trail
- Shadow Meter: Bar at bottom, dark → light depletion

### Build Instructions

1. Create `scripts/games/shadow-sprint/`
2. Write `config.json`: engine phaser3, genre 2d-endless-runner, resolution 960×540
3. Build `index.html` — auto-scroll via `tileSprite.tilePositionX`. Obstacle spawning ahead of camera with pool recycling. Jump physics with variable height (hold detection). Slide reduces collision body height.
4. Shadow meter: `meter -= delta * depletionRate`. Orbs add to meter. Warning at < 25%.
5. Validate all 8 checks.
6. Polish: Tendril particles, white flash on death, orb collect burst, meter pulse at low, parallax background
7. Iterate 3+ times — tune depletion rate, obstacle spacing, timing windows
8. Write `thumbnail-prompt.txt`

---
---

# GAME 8: Synth Wave

## Prompt (append after Common Preamble)

### Game Concept

**Title:** Synth Wave
**Slug:** `synth-wave`
**Genre:** `2d-rhythm`
**Engine:** `phaser3`
**Logline:** Ride the synthwave — tap keys in time as neon notes pulse down four lanes to a procedurally generated beat.

**Visual Style:** Full synthwave/retrowave. Dark purple/magenta gradient with perspective grid (80s sunset highway). Four neon lanes (cyan, magenta, yellow, green). Notes are glowing diamonds. Hit zone at bottom glows on press. Animated retro sun with scan lines. Parallax mountain silhouettes.

**Core Mechanic:** Notes fall down 4 lanes at BPM-synced speed. Player presses D/F/J/K when notes reach hit zone. Timing: Perfect (±30ms) = 100pts, Great (±60ms) = 50, Good (±100ms) = 25, Miss = 0 + combo break. Procedurally generated patterns evolve. Combo multiplier for consecutive non-miss hits.

**Controls:**
- D: Lane 1 (cyan)
- F: Lane 2 (magenta)
- J: Lane 3 (yellow)
- K: Lane 4 (green)
- Escape: Pause

**Progression:** Endless, procedural. BPM starts 100, +5 BPM every 30s (max 160). Pattern complexity: single → double → runs → cross-lane → rapid alternating.

**Scoring:** Points × combo multiplier. Combo +1 per non-miss (max ×20). Health: 100%, misses drain 5%, Perfects heal 1%.

**Game Over Condition:** Health = 0%.

**Restart Behavior:** Reset BPM, combo, score, health 100%, new seed.

**Screens:**
- **Intro:** "SYNTH WAVE" chrome/neon with scan-lines. Retro sun. Lane keys (D F J K). High score. "Press any key".
- **HUD:** Score top-left, Combo top-center (scales with size), Health top-right, BPM bottom-right, Hit rating bottom-left.
- **Pause:** Purple overlay, "PAUSED" neon.
- **Game Over:** "GAME OVER" flickering neon. Score, max combo, accuracy %. High score. "Press any key".

**Objects:**
- Note: 20×20px diamond in lane color, falls BPM-synced, glows brighter near hit zone
- Hit Zone: Horizontal bar at bottom, flashes on press
- Combo Counter: "×N" center, scales on increment
- Health Bar: Green → yellow → red gradient
- Background Sun: Circle with horizontal lines, slowly sinks
- Mountain Silhouette: Dark purple, parallax scroll
- Hit particles: Color burst from hit zone on Perfect/Great

### Build Instructions

1. Create `scripts/games/synth-wave/`
2. Write `config.json`: engine phaser3, genre 2d-rhythm, resolution 960×540
3. Build `index.html` — note spawning synced to BPM (`beatInterval = 60000/bpm`). Notes fall at calculated speed to arrive at hit zone exactly on beat.
4. Pattern generation: Beat patterns as arrays of lane indices. Patterns repeat and vary. Seeded randomness.
5. Hit detection: On key press, find closest note in lane within timing window. Classify Perfect/Great/Good/Miss.
6. ZzFX: Different tones for each hit quality.
7. Validate all 8 checks.
8. Polish: Note glow increases near hit zone, hit zone flash, particle burst on Perfect, combo scale animation, sun movement, grid perspective animation
9. Iterate 3+ times — tune timing windows, note speed, health drain
10. Write `thumbnail-prompt.txt`

---
---

# GAME 9: Duel Deck

## Prompt (append after Common Preamble)

### Game Concept

**Title:** Duel Deck
**Slug:** `duel-deck`
**Genre:** `2d-cards`
**Engine:** `phaser3`
**Logline:** Draw, strategize, and strike — battle an AI opponent in a streamlined card dueling game of attack, defense, and sorcery.

**Visual Style:** Rich dark background (#1a0a2e) with particle dust. Cards have colored borders: red (attack), blue (defense), green (heal), purple (spell). Card faces show power number + icon (sword/shield/heart/star). Player at bottom, opponent at top. Mana crystals glow along side. Fan layout for hand.

**Core Mechanic:** Turn-based. Each player: 30 HP, 3 mana (max 10, +1/turn). Each turn: draw 1, play 0-3 cards, end turn. Card types: Attack (deal N damage), Defense (block next N damage), Heal (restore N HP), Spell (special: draw 2, damage all, steal mana). AI plays strategically. Match ends at 0 HP.

**Controls:**
- Mouse Click: Select card, click play area to play
- Right Click: Inspect card details
- Space: End turn
- Escape: Pause

**Progression:** AI difficulty increases per match. Match 1-2: Random. 3-4: Prioritizes defense when low. 5+: Combo strategies.

**Scoring:** +10/match won. +5/efficient card. +20 for winning with HP > 20.

**Game Over Condition:** Player HP = 0.

**Restart Behavior:** Match 1, full HP, fresh shuffle, score 0.

**Screens:**
- **Intro:** "DUEL DECK" with card flip reveal. Cards fan out. "Click to Duel". Match record.
- **HUD:** Player HP bottom-left, Opponent HP top-left, Mana crystals bottom-right, Turn indicator center, Deck/Discard counts.
- **Pause:** "PAUSED" over darkened play area.
- **Game Over:** "DEFEATED" or "VICTORY". Matches, cards played, score. "Play Again".

**Objects:**
- Card: 70×100px with colored border, icon, power number. Fan layout. Hover: scale up.
- Attack: Red, sword, damage 3-8, cost 1-4 mana
- Defense: Blue, shield, block 2-6, cost 1-3
- Heal: Green, heart, heal 3-5, cost 2-3
- Spell: Purple, star, special effect, cost 3-5
- Mana Crystals: Small circles, filled blue = available
- Card effects: Red slash, blue shimmer, green particles, purple burst
- Floating damage numbers: "-N" or "+N"

### Build Instructions

1. Create `scripts/games/duel-deck/`
2. Write `config.json`: engine phaser3, genre 2d-cards, resolution 960×540
3. Build `index.html` — card data structure, deck as array, hand management, turn system. Cards rendered via `generateTexture`.
4. AI logic: Priority system — heal if HP < 10, attack if opponent undefended, else highest-value card mana allows.
5. Mana: Start 3, +1/turn, max 10.
6. Validate all 8 checks.
7. Polish: Card draw animation, play tween, resolve effect, damage flash on HP, mana crystal fill, turn transition
8. Iterate 3+ times — balance card values, AI difficulty, mana curve
9. Write `thumbnail-prompt.txt`

---
---

# GAME 10: Cosmic Tycoon

## Prompt (append after Common Preamble)

### Game Concept

**Title:** Cosmic Tycoon
**Slug:** `cosmic-tycoon`
**Genre:** `2d-idle`
**Engine:** `phaser3`
**Logline:** Mine asteroids, build extractors, and expand your cosmic empire — watch your mineral count soar even when you look away.

**Visual Style:** Space-themed dark background with star field. Central asteroid in grays/browns. Extractors are small colored rectangles with animation. Sci-fi digital resource counters. Clean button panels. Cyan and gold neon accents. Floating mineral particles.

**Core Mechanic:** Click asteroid to mine (+1/click, upgradeable). Buy auto-extractors that produce minerals/second. Upgrade click value and extractor rates. Unlock new mineral types at thresholds (copper → silver → gold → platinum → dark matter). Prestige system: reset for "Cosmic Dust" permanent multipliers. Large numbers formatted as K/M/B/T/Qa.

**Controls:**
- Mouse Click: Mine asteroid, buy upgrades
- 1-5: Quick-buy extractor tiers
- P: Prestige (when available)
- Escape: Pause

**Progression:** Tier 1: 10 cost, 1/s. Tier 2: 100, 5/s. Tier 3: 1000, 25/s. Tier 4: 10000, 100/s. Tier 5: 100000, 500/s. Cost scales ×1.15 per purchase.

**Scoring:** Total minerals mined (lifetime). Prestige count. Highest rate.

**Game Over Condition:** "Complete" at 1 Quadrillion minerals or 10 prestiges (congratulations screen).

**Restart Behavior:** 0 minerals, 0 extractors, keep prestige bonuses.

**Screens:**
- **Intro:** "COSMIC TYCOON" metallic. Asteroid floating. "Click to Mine". Lifetime minerals. "Click to Begin".
- **HUD:** Minerals center-top (large, animated), rate below, Extractor shop right, Upgrades left, Prestige button bottom-center (glows when available), asteroid center.
- **Pause:** "PAUSED", stats.
- **Game Over:** "COSMIC EMPIRE COMPLETE" with celebration. Minerals, prestiges, time. "Click to Start New Empire".

**Objects:**
- Asteroid: 80×80px rocky circle, shakes on click, visual changes with total mined
- Click particles: Mineral chunks + "+N" floating text
- Extractors: 20×16px colored rectangles around asteroid, oscillation animation
- Buy buttons: Panel with icon, name, cost, rate. Gray if unaffordable, pulse when newly affordable.
- Prestige button: Golden glow when available

### Build Instructions

1. Create `scripts/games/cosmic-tycoon/`
2. Write `config.json`: engine phaser3, genre 2d-idle, resolution 960×540
3. Build `index.html` — game loop updates minerals based on extractors × rate × delta. Click handler adds click value.
4. Number formatting function: K, M, B, T, Qa.
5. Cost scaling: `baseCost * Math.pow(1.15, owned)`.
6. NOTE: `localStorage` is allowed for idle game progress persistence (save every 5s + on pause/destroy). This is the one exception to the forbidden patterns rule.
7. Validate all 8 checks.
8. Polish: Click feel (shake, burst, "+N"), smooth counter animation, buy pulse, extractor animation, prestige glow
9. Iterate 3+ times — economy balance, progression feel, prestige threshold
10. Write `thumbnail-prompt.txt`

---
---

# GAME 11: Serpent Neon

## Prompt (append after Common Preamble)

### Game Concept

**Title:** Serpent Neon
**Slug:** `serpent-neon`
**Genre:** `2d-custom`
**Engine:** `phaser3`
**Logline:** A modern neon-soaked reimagining of classic snake — grow your serpent, grab power-ups, and chase high scores in a pulsating arena.

**Visual Style:** Dark black arena (#0a0a0a) with subtle grid. Snake body is chain of glowing cyan circles (head brightest, tail fades). Food glows distinct colors (gold, green, purple). Arena walls pulse with neon border. Fading afterglow trail. Power-ups change snake color temporarily.

**Core Mechanic:** Classic snake on a grid. Continuous movement, player changes direction. Eating food grows snake +1 and spawns new food. Die on hitting self or walls. Power-ups spawn periodically. Speed increases with length.

**Controls:**
- Arrow Keys or WASD: Change direction
- Escape: Pause

**Progression:** Start speed: move every 150ms. +5ms faster per 5 food (min 60ms). Special food: golden apple (×2 points) at length 10, speed boost at 15, phase-through-self for 5s at 20.

**Scoring:** +10/regular food. +25/golden. +5 bonus per length segment when eating. +15 near-wall bonus (within 2 cells).

**Game Over Condition:** Head collides with body (unless phase-through) or wall.

**Restart Behavior:** Length 3 at center, random direction, score 0.

**Screens:**
- **Intro:** "SERPENT NEON" pulsing cyan. Snake coil animation. "Arrow Keys to Move". High score. "SPACE to Start".
- **HUD:** Score top-left (neon glow), Length top-right, Active power-up top-center (icon + timer).
- **Pause:** "PAUSED" neon.
- **Game Over:** Snake explodes into particles. "GAME OVER" flickers. Score, max length, food eaten. High score. "Click to Play Again".

**Objects:**
- Snake Head: 14×14px bright cyan circle
- Body Segments: 12×12px cyan circles, decreasing brightness
- Trail: Fading afterglow circles (alpha over 0.5s)
- Regular Food: 12×12px gold pulsing circle
- Golden Apple: 14×14px bright gold with aura
- Speed Boost: Green lightning bolt
- Phase-Through: Purple swirl (body turns translucent)
- Arena Border: Neon pulse
- Death explosion: Segments scatter as particles

### Build Instructions

1. Create `scripts/games/serpent-neon/`
2. Write `config.json`: engine phaser3, genre 2d-custom, resolution 960×540
3. Build `index.html` — grid-based movement via timer event (not physics). Snake as array of {x,y}. Movement: unshift head, pop tail (unless growing).
4. Grid: Cell size 18px. Convert grid to pixel coords. Food: random empty cell.
5. Validate all 8 checks.
6. **Mechanics feasibility audit**: At fastest speed (60ms tick), verify the snake has ≥2 grid cells of reaction time before hitting a wall from the center. Verify food always spawns on unoccupied cells (not on snake body). Verify phase-through power-up correctly disables self-collision for its full duration. Test that direction-change logic prevents 180° reversal (moving right → pressing left should be ignored, not cause instant self-collision). Verify speed increments don't skip frames at high refresh rates (use delta-time, not frame count).
7. Polish: Smooth tween between positions, glow trail, food pulse, power-up burst, death scatter, score pop
8. Iterate 3+ times — tune speed, growth, power-up timing
9. Write `thumbnail-prompt.txt`

---
---

# GAME 12: Labyrinth

## Prompt (append after Common Preamble)

### Game Concept

**Title:** Labyrinth
**Slug:** `labyrinth`
**Genre:** `3d-firstperson`
**Engine:** `threejs`
**Logline:** Navigate dark procedural mazes in first person — find keys, avoid patrolling shadows, and escape before the clock runs out.

**Visual Style:** Dark stone corridors with dim warm torchlight. Walls: rough gray stone (MeshStandardMaterial, roughness 0.9). Floor: dark tile pattern. Torch sconces emit flickering orange PointLights. Keys glow golden. Exit gate glows green. Shadow creatures: dark semi-transparent spheres with red emissive eyes. Dense fog.

**Core Mechanic:** First-person maze navigation through procedurally generated grid mazes. Find golden key(s), reach green exit gate. Shadow creatures patrol corridors (back-and-forth). Shadow touch = lose 1 of 3 lives (respawn at last safe point). Countdown timer. Levels get larger with more shadows.

**Controls:**
- W/S: Move forward/backward
- A/D: Strafe left/right
- Arrow Keys: Look around
- Escape: Pause

**Progression:** Level 1: 7×7 maze, 1 key, 1 shadow, 90s. Level 2: 9×9, 1 key, 2 shadows, 85s. Level 3: 11×11, 2 keys, 3 shadows, 80s. Shadows +10% speed/level. Level 3+: some chase within 3 cells.

**Scoring:** +500/level. +100/key. Time bonus: remaining sec × 10. Lives bonus: remaining × 50. -50/shadow hit.

**Game Over Condition:** Lives = 0 or timer = 0.

**Restart Behavior:** Level 1, 3 lives, new maze.

**Screens:**
- **Intro:** (HTML overlay) "LABYRINTH" stone text. Rotating maze preview. "WASD to Move, Arrows to Look". Highest level. "Click to Enter".
- **HUD:** (HTML overlay) Lives top-left (hearts), Timer top-center (MM:SS, red < 15s), Keys top-right, Level, Mini-map bottom-right (explored cells).
- **Pause:** "PAUSED" overlay.
- **Game Over:** "LOST IN DARKNESS" fade-to-black. Levels, keys, score. "Click to Try Again".

**Objects:**
- Player: First-person camera height 1.0, Box3 collision (0.3 radius)
- Wall: BoxGeometry 1×2×1, gray stone
- Floor: PlaneGeometry per cell, dark material
- Torch: PointLight (orange, intensity 1, distance 5), flicker via random intensity
- Key: BoxGeometry 0.3×0.3×0.1, golden emissive, rotating, height 0.8
- Exit Gate: Box 1×2×0.2, green emissive, locked until all keys
- Shadow: SphereGeometry 0.3, dark transparent material, red emissive eyes, patrols corridors

### Build Instructions

1. Create `scripts/games/labyrinth/`
2. Write `config.json`: engine threejs, genre 3d-firstperson, resolution 1280×720
3. Build `index.html` — Three.js via CDN, renderer with shadows + ACES + FogExp2
4. Maze generation: Recursive backtracking / randomized DFS. 2D array of walls. Key in farthest dead-end. Exit in opposite corner.
5. FP controls: WASD relative to camera facing. Arrow keys rotate camera. Pre-allocate direction vectors.
6. Wall collision: Pre-compute wall Box3 array. Check player movement against nearby walls.
7. Shadow AI: Pre-compute patrol paths. Level 3+: simple pathfinding toward player within range.
8. Validate all 8 checks.
9. **Mechanics feasibility audit**: Run BFS/pathfinding from spawn to every key AND from every key to the exit — the maze MUST be solvable before the player sees it. Verify shadow patrol paths never fully block a corridor (when a shadow is at one end, the other end must have enough clearance for the player's collision radius of 0.3). Timer must allow traversal: `(shortest_path_cells × 0.4s) + 15s buffer ≤ timer`. All corridors must be wider than `2 × player_radius` (0.6 units minimum). Verify shadows cannot permanently trap the player in a dead end — if a shadow approaches a dead end the player is in, the player must be able to pass the shadow before it blocks the exit. Test every generated level by walking the solution path.
10. Polish: Torch flicker, fog atmosphere, footstep ZzFX, key chime, shadow scare sound, timer warning pulse
11. Iterate 3+ times — maze solvability, shadow paths don't block, timer fairness, smooth movement
12. Write `thumbnail-prompt.txt`

---
---

# GAME 13: Neon Surge

## Prompt (append after Common Preamble)

### Game Concept

**Title:** Neon Surge
**Slug:** `neon-surge`
**Genre:** `3d-thirdperson`
**Engine:** `threejs`
**Logline:** Surf through a neon void at breakneck speed — dodge pillars, leap gaps, and collect energy in this third-person endless runner.

**Visual Style:** Abstract neon world. Dark void with glowing cyan/magenta grid lines on ground. Player: glowing white/cyan low-poly humanoid (box geometries). Obstacles: bright red/orange neon pillars and gaps. Energy orbs: golden with glow. Track stretches into perspective fog. Speed lines at high velocity.

**Core Mechanic:** Third-person camera follows character auto-running on 3-lane track. Switch lanes (A/D), jump (Space), slide (S). Obstacles: tall pillars (switch lane), low bars (jump), gaps (jump over). Energy orbs for points. Speed increases over time. Track segments recycled in ring buffer of 8.

**Controls:**
- A / Left: Left lane
- D / Right: Right lane
- Space / W / Up: Jump
- S / Down: Slide
- Escape: Pause

**Progression:** Speed 15 units/s → +1/10s (cap 35). New obstacles: pillars (start), low bars (20s), pillar pairs (30s), gaps (40s), moving pillars (60s).

**Scoring:** +1/meter. +25/orb. +100 near-miss (< 0.3 units). Multiplier: ×2 at 500m, ×3 at 1000m.

**Game Over Condition:** Hit obstacle or fall in gap.

**Restart Behavior:** Center lane, starting speed, score 0, regenerate track.

**Screens:**
- **Intro:** (HTML overlay) "NEON SURGE" cyan neon. Camera pans empty track. Controls. High score. "Click to Run".
- **HUD:** (HTML overlay) Score top-left, Distance top-right, Multiplier top-center, Speed bottom-right.
- **Pause:** "PAUSED" overlay.
- **Game Over:** Character explodes. "WIPEOUT" glitch text. Score, distance, orbs. High score. "Click to Retry".

**Objects:**
- Player: Low-poly humanoid (3-4 BoxGeometries), white/cyan emissive, ~1.0 height
- Track Segment: PlaneGeometry 3-lanes × 20 units, dark gray + neon grid lines, ring buffer
- Tall Pillar: BoxGeometry 0.8×2.5×0.8, red emissive
- Low Bar: BoxGeometry 3×0.5×0.3, orange emissive
- Gap: Missing track section
- Energy Orb: SphereGeometry 0.2, golden emissive, rotating, bobbing
- Speed Lines: Elongated particles at high speed
- Death particles: Player breaks into scattering cubes
- Camera: Behind and above, smooth lerp follow

### Build Instructions

1. Create `scripts/games/neon-surge/`
2. Write `config.json`: engine threejs, genre 3d-thirdperson, resolution 1280×720
3. Build `index.html` — Three.js with shadows + fog + ACES
4. Ring buffer: 8 track segments. Recycle past segments to front with new obstacles.
5. Lane switching: Target lane (0,1,2). Lerp x to target. Jump/slide: manual gravity, no physics lib.
6. Collision: Box3 checks, pre-allocated.
7. Validate all 8 checks.
8. **Mechanics feasibility audit**: Calculate max jump height: `v² / (2 × gravity)`. Verify it exceeds tallest obstacle height by ≥20%. If the game has variable-height jumps (hold vs tap), verify a SHORT tap-jump still clears the shortest jumpable obstacle with ≥10% margin. Verify slide body height clears low bars — if using Phaser, add a process callback on bar overlap that checks `isSliding` state, because physics runs before `scene.update()` and a same-frame state change won't take effect without it. Verify lane-switch animation completes before the next obstacle arrives at max speed (`lane_switch_duration < obstacle_spacing / max_speed`). Ensure obstacle spawning NEVER creates impossible combinations (e.g., pillar in all 3 lanes simultaneously, or pillar + gap with no escape). For gaps, verify jump air-time covers gap width at max speed. Ground/track colliders must be thick (≥0.5 units) to prevent body clip-through during slide/jump body-resize transitions. When resizing the player body for slide, ensure `body.setOffset()` keeps the body's bottom edge at the same Y position as standing — otherwise the body clips below the ground collider.
9. Polish: Smooth lane switch, jump squash/stretch, speed lines, orb collect particles, camera shake on near-miss, explosion on death, fog depth
10. Iterate 3+ times — lane switch speed, jump height, obstacle spacing, speed ramp
11. Write `thumbnail-prompt.txt`

---
---

# GAME 14: Turbo Circuit

## Prompt (append after Common Preamble)

### Game Concept

**Title:** Turbo Circuit
**Slug:** `turbo-circuit`
**Genre:** `3d-racing`
**Engine:** `threejs`
**Logline:** Race a hover-car through a floating neon circuit — hit boost pads, drift corners, and beat your best lap time.

**Visual Style:** Futuristic low-poly. Track floats in dark sky with stars. Dark gray surface with neon edge lines (cyan left, magenta right). Hover-car: green low-poly wedge. Boost pads: yellow glow. Barriers: orange. Checkpoints: green arches. Fog for depth.

**Core Mechanic:** Hover-car on closed-loop track. Accelerate (W), brake (S), steer (A/D). Track is connected segments (straight + curved). Barriers bounce and slow car. Boost pads double speed for 2s. 3 laps, best time is the goal. Target time decreases per race.

**Controls:**
- W/Up: Accelerate
- S/Down: Brake
- A/Left: Steer left
- D/Right: Steer right
- Space: Handbrake/drift
- Escape: Pause

**Progression:** Race 1: No time pressure. Race 2: Beat 60s. Race 3+: Target -5s/race. Obstacle placement increases.

**Scoring:** Lap time (lower = better). +100/checkpoint, +500/lap, -200/barrier hit. Best total time across 3 laps.

**Game Over Condition:** 3 laps completed (results), or 3min timeout.

**Restart Behavior:** Starting position, lap 0, timer 0.

**Screens:**
- **Intro:** (HTML overlay) "TURBO CIRCUIT" chrome/neon. Camera orbits track. Car spins. "WASD to Drive". Best time. "Click to Race".
- **HUD:** (HTML overlay) Lap time center-top, "LAP 1/3" top-left, Speed bottom-left, Best time top-right.
- **Pause:** "PAUSED" overlay.
- **Game Over:** "RACE COMPLETE" or "TIME OUT". Lap times (fastest highlighted), total, stats. "Race Again".

**Objects:**
- Hover Car: BoxGeometry wedge ~1.5×0.5×0.8, green emissive, hover particle underneath
- Track Straight: PlaneGeometry 4×20, neon edge lines
- Track Curve: Angled short straights
- Barrier: BoxGeometry 0.5×1×0.5, orange emissive
- Boost Pad: PlaneGeometry 2×3, yellow emissive
- Checkpoint: CylinderGeometry pillars + green BoxGeometry arch
- Camera: Third-person behind/above, lerp follow, slight rotation lag

### Build Instructions

1. Create `scripts/games/turbo-circuit/`
2. Write `config.json`: engine threejs, genre 3d-racing, resolution 1280×720
3. Build `index.html` — Three.js with shadows, tone mapping, fog
4. Track: Array of waypoints (x,z,heading). Closed loop. Build segments between waypoints.
5. Car physics (simplified): Forward velocity from acceleration. Steering rotates car. Friction. Max speed cap (boosted). Barrier: Box3 detect, reverse velocity + penalty.
6. Checkpoints: Box3 triggers, must pass all in order per lap.
7. Validate all 8 checks.
8. **Mechanics feasibility audit**: Verify the car can complete the tightest curve at max unboosted speed without hitting barriers (`turn_radius_at_speed < curve_radius`). Verify boosted speed doesn't make any curve impossible — if it does, either widen curves or limit boost in curves. Checkpoint trigger volumes must be wide enough that normal driving always activates them (at least full track width). Verify 3-lap completion is achievable within the timeout: `shortest_driveable_path × 3 / average_speed < timeout - 15s buffer`. Barrier bounce must not trap the car in an infinite bounce loop — apply a cooldown or progressive damping. Verify steering at low speeds is still responsive enough to navigate tight sections.
9. Polish: Camera smooth lerp, boost speed lines, engine hum ZzFX, brake screech, checkpoint chime, lap fanfare, hover particles
10. Iterate 3+ times — steering feel, acceleration curve, track layout, boost placement
11. Write `thumbnail-prompt.txt`

---
---

# GAME 15: Tesseract

## Prompt (append after Common Preamble)

### Game Concept

**Title:** Tesseract
**Slug:** `tesseract`
**Genre:** `3d-puzzle`
**Engine:** `threejs`
**Logline:** Rotate and align faces of increasingly complex 3D structures — a meditative puzzle rewarding spatial thinking.

**Visual Style:** Clean minimalist. Soft dark background (#1a1a2e gradient). Colored cubes in pastel-bright: coral, sky blue, mint green, golden yellow, lavender, peach. Soft ambient lighting. Structure floats and bobs. Completed faces glow.

**Core Mechanic:** 3D cube structure (2×2 → 3×3). Orbit camera around it (drag/A/D). Click a face to rotate that row/column slice 90°. Goal: make each side of structure uniform color. Levels start at 1-2 moves, scale to 5+.

**Controls:**
- Mouse Drag / A/D: Orbit camera
- Click cube face: Rotate slice 90°
- R: Reset current puzzle
- Escape: Pause

**Progression:** Levels 1-3: 2×2, 2 colors, 1-2 moves. 4-6: 2×2, 3 colors, 2-3 moves. 7-10: 3×3, 4 colors, 3-5 moves. 11+: 3×3, 5-6 colors, 5+.

**Scoring:** 1000/level. -20/move over par. -5/second over par. Bonus 500 at/under par. 3/2/1 star rating.

**Game Over Condition:** No traditional — cumulative score after all levels or quit.

**Restart Behavior:** Level 1, score 0.

**Screens:**
- **Intro:** (HTML overlay) "TESSERACT" with rotating cube behind. Soft pastels. "Click faces to rotate". Best level. "Click to Begin".
- **HUD:** (HTML overlay) Level top-left, Moves top-center, Timer top-right, Par, Stars.
- **Pause:** "PAUSED" overlay.
- **Game Over:** "COMPLETE". Total score, levels, average moves. "Play Again".

**Objects:**
- Cube unit: BoxGeometry 0.9³ (0.1 gap), colored MeshStandardMaterial per face
- Structure: Group of cubes in 2×2 or 3×3 grid
- Hover highlight: Emissive increase on face hover
- Rotation animation: Smooth tween 0.3s per slice
- Completion: All faces glow + particle burst
- Camera orbit: Spherical coordinates, smooth lerp
- Background: Soft gradient + floating particles

### Build Instructions

1. Create `scripts/games/tesseract/`
2. Write `config.json`: engine threejs, genre 3d-puzzle, resolution 1280×720
3. Build `index.html` — Three.js with shadows + ACES + soft lighting
4. Cube structure: Grid of cube meshes in slices. Track face colors. "Solved" = all visible faces on each side same color.
5. Rotation: Click face → determine slice → animate 90° around axis → update data.
6. Levels: Start solved, apply N random rotations to scramble.
7. Hit detection: Raycaster to detect clicked face.
8. Validate all 8 checks.
9. **Mechanics feasibility audit**: Every generated puzzle MUST be solvable — scramble by applying N random valid moves FROM a solved state (this guarantees solvability by reversing those moves). Never randomize face colors directly. Verify click/raycaster detection correctly identifies the intended face and slice even at oblique camera angles — test at extreme orbit positions. Lock or queue input during slice rotation animations to prevent corrupted state from overlapping rotations. Verify par move count is achievable for every level (par should equal the scramble move count, not fewer). Test that the "solved" check correctly handles all 6 faces, not just visible ones.
10. Polish: Smooth rotation, hover highlight, completion glow + particles, ambient particles, smooth orbit
11. Iterate 3+ times — solvability, visual clarity, difficulty curve
12. Write `thumbnail-prompt.txt`

---
---

# GAME 16: Star Viper

## Prompt (append after Common Preamble)

### Game Concept

**Title:** Star Viper
**Slug:** `star-viper`
**Genre:** `3d-flight`
**Engine:** `threejs`
**Logline:** Pilot the Star Viper through asteroid-choked space — shoot down drones, dodge debris, survive the void.

**Visual Style:** Deep space (#020210) with star points. Asteroids: brownish-gray low-poly (scaled BoxGeometries/SphereGeometries). Ship: ConeGeometry nose + BoxGeometry wings + CylinderGeometry engines, white/silver with blue emissive thrusters. Drones: red angular shapes. Lasers: bright colored cylinders. Explosions: expanding wireframe spheres + scattered cubes.

**Core Mechanic:** Third-person flight through endless asteroid field. Ship auto-moves forward. Player controls pitch (W/S) and yaw (A/D). Throttle (Shift) = faster but harder to react. Shoot forward with Space (lasers). Drones appear and shoot back. Collecting debris from destroyed targets restores shield.

**Controls:**
- W/S: Pitch up/down
- A/D: Yaw left/right
- Q/E: Roll (cosmetic + brief invincibility)
- Space: Fire lasers
- Shift: Boost speed
- Escape: Pause

**Progression:** Asteroid density increases. Drones at 30s, fast drones at 60s, large asteroids at 90s, boss drone at 120s. Repeats scaled.

**Scoring:** +5/second. +10/asteroid. +50/drone. +200/boss. +25/debris. +30 near-miss (< 0.5 units).

**Game Over Condition:** Shield = 0 (3 hits from drones / 1 asteroid collision).

**Restart Behavior:** Reset ship, shield full, speed default, score 0.

**Screens:**
- **Intro:** (HTML overlay) "STAR VIPER" chrome text. Ship rotates. Controls. High score. "SPACE to Launch".
- **HUD:** (HTML overlay) Score top-left, Shield top-right (3 segments), Boost bottom-left, Speed bottom-right, Crosshair center.
- **Pause:** "PAUSED" overlay.
- **Game Over:** Ship explodes. "DESTROYED". Score, kills, distance, time. High score. "Click to Relaunch".

**Objects:**
- Ship: Composite ConeGeometry + BoxGeometry + CylinderGeometry, ~1 unit, white/silver + blue emissive engines
- Laser Bolt: CylinderGeometry 0.05×0.5, green emissive, pooled max 20
- Asteroid (small): ~1-2 unit, slowly rotating, 1 hit
- Asteroid (large): ~3-4 unit, 3 hits, breaks into 2-3 small
- Drone: Red BoxGeometry composite ~0.8 unit, strafes + fires, 2 hits
- Boss Drone: ~2 unit, spread of 3 bolts, 8 hits
- Shield debris: Blue SphereGeometry, restores 1 shield
- Explosion: Wireframe sphere + scattered cubes, fades over 1s
- Camera: Third-person behind/above, lerp follow, turn lag

### Build Instructions

1. Create `scripts/games/star-viper/`
2. Write `config.json`: engine threejs, genre 3d-flight, resolution 1280×720
3. Build `index.html` — Three.js with shadows, fog, ACES
4. Ship controls: Pitch/yaw via Euler angles. Position moves along forward vector × speed × delta.
5. Object spawning: Cone-shaped spawn zone ahead. Object pools (pre-create, toggle visible). Cull behind ship.
6. Laser pool: 20 bolt meshes. On fire: activate, set position at ship front, velocity along forward.
7. Collision: Box3 checks, pre-allocated.
8. Validate all 8 checks.
9. **Mechanics feasibility audit**: Verify player ship strafe/dodge speed can evade all asteroid speeds (`player_lateral_speed > fastest_asteroid_speed`). Drone projectiles must be dodgeable: time-to-reach from fire to player ≥0.5s at all times. Boss spread-shot pattern must have ≥1 safe gap wide enough for `ship_hitbox_width × 1.2`. Verify shield debris spawns often enough to sustain survival (at least 1 drop per 30s of play). Asteroid spawn zones must NEVER place an asteroid directly on or overlapping the player's ship position on spawn — enforce a minimum spawn distance. At max asteroid density, verify there is always a navigable path (total asteroid cross-section < 60% of the playable area width at any depth slice). Roll invincibility frames must last long enough for the roll animation to complete.
10. Polish: Thruster glow pulse, laser trail, asteroid rotation, explosion particles, camera shake on hit, boost speed lines, shield flash
11. Iterate 3+ times — handling (responsive not twitchy), density, drone accuracy, shield balance
12. Write `thumbnail-prompt.txt`

---
---

# GAME 17: Sky Islands

## Prompt (append after Common Preamble)

### Game Concept

**Title:** Sky Islands
**Slug:** `sky-islands`
**Genre:** `3d-platformer`
**Engine:** `threejs`
**Logline:** Leap between floating islands in the sky — collect crystals, dodge hazards, climb higher into the clouds.

**Visual Style:** Bright, cheerful low-poly. Sky gradient (light blue → deep blue). Islands: green/brown flat BoxGeometry (grass top, earth sides). Crystals: bright colored OctahedronGeometry (cyan, magenta, gold), rotating. Player: small round figure (SphereGeometry body + BoxGeometry limbs) in bright blue. Clouds: white translucent SphereGeometry clusters. Warm directional sunlight.

**Core Mechanic:** Third-person 3D platformer. WASD to move (camera-relative), Space to jump (and double-jump mid-air). Islands at various heights/positions. Some move on paths, some crumble after stepped on, some bounce player extra high. Crystals collectible. Falling into void = game over / checkpoint respawn. Goal: reach highest island.

**Controls:**
- WASD: Move (camera-relative)
- Space: Jump / Double Jump
- Arrow Keys: Rotate camera
- Escape: Pause

**Progression:** Islands start close and level. Gaps widen as player climbs. Moving platforms at height 50+, crumbling at 100+, wind at 150+. Final platform at height 200.

**Scoring:** +10/crystal. +50/checkpoint. +100 height bonus per 50 units.

**Game Over Condition:** Fall below lowest platform. Respawn at last checkpoint (partial score loss), or full game over if no checkpoint.

**Restart Behavior:** Starting island, 0 crystals, 0 score.

**Screens:**
- **Intro:** (HTML overlay) "SKY ISLANDS" cheerful. Camera pans islands. "WASD to Move, SPACE to Jump". High score. "Click to Start".
- **HUD:** (HTML overlay) Crystals top-left, Score top-right, Height meter right side, Checkpoint indicator.
- **Pause:** "PAUSED" overlay.
- **Game Over:** Camera pulls back. "FELL!" or "SUMMIT REACHED!". Crystals, height, score. "Click to Try Again".

**Objects:**
- Player: SphereGeometry 0.3 + BoxGeometry limbs, blue MeshStandardMaterial, casts shadow
- Static Island: BoxGeometry (2-5 × 0.5 × 2-5), green top, brown sides
- Moving Island: Sine oscillation between two points
- Crumbling Island: Darker patches, shakes 0.5s, falls, respawns 3s
- Bouncy Island: Yellow/orange top, 2× jump height
- Crystal: OctahedronGeometry 0.2, colored emissive, rotates, bobs
- Checkpoint: CylinderGeometry flag pole + BoxGeometry flag, white → green on touch
- Cloud: 3-5 white SphereGeometries, translucent, drifts
- Camera: Third-person orbit, lerp follow, arrow key orbit

### Build Instructions

1. Create `scripts/games/sky-islands/`
2. Write `config.json`: engine threejs, genre 3d-platformer, resolution 1280×720
3. Build `index.html` — Three.js with shadows, ACES, light fog
4. Player physics: Manual gravity. Vertical velocity + position update. Box3 AABB collision with platforms. Jump count (0→1→2 for double-jump).
5. Camera-relative movement: WASD direction relative to camera horizontal angle. Pre-compute forward/right vectors.
6. Platforms: Pre-defined position/type arrays. Moving: sine oscillation. Crumbling: shake timer → fall → reset.
7. Validate all 8 checks.
8. **Mechanics feasibility audit**: Calculate max single-jump height: `v² / (2 × gravity)`. Calculate double-jump height: first jump apex + `v² / (2 × gravity)`. For EVERY platform gap, verify reachability: `horizontal_distance ≤ forward_speed × total_air_time` AND `vertical_distance ≤ max_jump_height` (single or double as required). Add 15% safety margin to all calculations. For moving platforms, verify the player can land when the platform is at the farthest point of its oscillation. For crumbling platforms, `shake_duration (0.5s) + human_reaction_time (0.3s)` must be less than `time_before_platform_falls` — the player needs time to jump off. Platform colliders must be thick enough (≥0.3 units) to prevent landing clip-through at high fall speeds. Test a full traversal from start island to summit to confirm it is completable. Verify camera doesn't clip through platforms during fast movement.
9. Polish: Squash/stretch on land/jump, crystal sparkle, checkpoint glow, cloud drift, landing dust, double-jump air puff
10. Iterate 3+ times — jump feel (floaty-fun not frustrating), platform spacing, camera smoothness
11. Write `thumbnail-prompt.txt`

---
---

# GAME 18: Gravity Maze

## Prompt (append after Common Preamble)

### Game Concept

**Title:** Gravity Maze
**Slug:** `gravity-maze`
**Genre:** `3d-custom`
**Engine:** `threejs`
**Logline:** Tilt the world to roll a marble through 3D mazes — navigate ramps, avoid holes, reach the goal in this physics-based puzzler.

**Visual Style:** Clean, polished. Maze board: warm brown MeshStandardMaterial with raised darker brown walls. Marble: shiny chrome sphere (metalness 1.0, roughness 0.1). Holes: dark circular voids. Goal: green emissive pad. Soft gradient sky (warm sunset). Warm directional light, soft shadows.

**Core Mechanic:** Tilt entire maze board with arrow keys/WASD. Gravity pulls marble in tilt direction. Navigate maze corridors, avoid holes (fall = game over), reach green goal. Momentum management is key. Levels get more complex with more holes, narrow passages, ramps.

**Controls:**
- Arrow Keys or WASD: Tilt board
- R: Reset current level
- Escape: Pause

**Progression:** Level 1: Straight path, no holes. Level 2: L-shape, 1 hole. Level 3: T-junction, 2 holes. Level 4+: Complex layouts, narrow bridges, ramps, moving walls.

**Scoring:** 1000/level. -5/second. -100/reset. Bonus 500 for first-try.

**Game Over Condition:** Fall in hole. Retry level (-100 penalty) or full game over after 3 falls on same level.

**Restart Behavior:** Full: level 1, score 0. Level retry: marble to start, -100.

**Screens:**
- **Intro:** (HTML overlay) "GRAVITY MAZE" over tilting board animation. Marble rolls. "Arrow Keys to Tilt". High score. "Click to Start".
- **HUD:** (HTML overlay) Level top-left, Score top-right, Timer top-center, Falls remaining (3 icons), "R to Restart".
- **Pause:** "PAUSED" overlay.
- **Game Over:** "FALLEN" with marble drop animation. Levels, score, best level. "Click to Try Again".

**Objects:**
- Marble: SphereGeometry 0.3, chrome material, rolls based on velocity
- Board: BoxGeometry 10×0.3×10, brown material, tilts on X and Z axes (clamped ±10°)
- Walls: BoxGeometry segments (0.5 height, 0.3 width, variable length), darker brown
- Hole: CircleGeometry 0.5 radius, dark disk on floor
- Goal: BoxGeometry 1×0.05×1, green emissive, pulse glow
- Start: BoxGeometry 1×0.05×1, blue material
- Camera: Fixed above, slightly angled, looking down

### Build Instructions

1. Create `scripts/games/gravity-maze/`
2. Write `config.json`: engine threejs, genre 3d-custom, resolution 1280×720
3. Build `index.html` — Three.js with shadows, ACES, soft lighting
4. Board tilt: Store pitchX, rollZ. Arrows lerp toward target. `board.rotation.x = pitchX; board.rotation.z = rollZ;`
5. Marble physics (manual): Acceleration = gravity × sin(tilt). Velocity += accel × delta. Position += vel × delta. Friction: vel *= 0.995. Wall collision: Box3, reverse velocity + damping.
6. Hole: Check marble center within radius → fall animation + game over.
7. Goal: Check marble within bounds → level complete.
8. Levels: 2D grid arrays (0=floor, 1=wall, 2=hole, 3=start, 4=goal). At least 8 levels.
9. Validate all 8 checks.
10. **Mechanics feasibility audit**: Verify every level is solvable by tracing a valid path from start to goal that avoids all holes. Narrow passages must be wider than `marble_diameter + control_margin` (passage width ≥ `marble_radius × 3`). Calculate terminal velocity at max tilt: `gravity × sin(max_tilt) / friction_factor`. Verify the marble can stop within 2 cells at terminal velocity using friction alone — if not, reduce max tilt or increase friction. Holes must NOT be placed at unavoidable momentum points (e.g., immediately after a long straight corridor with no room to brake). Ramp angles must not launch the marble off the board. Test every level from start to goal with realistic tilt inputs. Verify board tilt angle clamp (±10°) is enforced and tilt lerp speed doesn't cause overshooting past the clamp.
11. Polish: Marble rolling rotation, board tilt lerp, hole fall animation, goal celebration particles, level transition fade
12. Iterate 3+ times — tilt sensitivity, friction, marble feel, level layouts
13. Write `thumbnail-prompt.txt`

---
---

# GAME 19: Meteor Dodge

## Prompt (append after Common Preamble)

### Game Concept

**Title:** Meteor Dodge
**Slug:** `meteor-dodge`
**Genre:** `2d-arcade`
**Engine:** `phaser3`
**Logline:** Pilot a tiny ship through an escalating meteor storm — weave, dodge, and collect shields to survive the cosmos.

**Visual Style:** Deep space (#050510) with dense parallax star field (3 layers). Player: small white/cyan triangle with engine glow. Meteors: irregular brown/gray circles (3 sizes, procedural crater textures). Shield pickups: blue glow. Multiplier pickups: golden. Explosions: orange/yellow particle bursts.

**Core Mechanic:** 360° free movement in bounded arena. Meteors spawn from all edges, drift toward center with randomness. 3 sizes: small (fast), medium (moderate), large (slow, huge hitbox). Shields absorb one hit. Multiplier pickup doubles score for 10s. Pure survival — no shooting.

**Controls:**
- Arrow Keys or WASD: Move (8 directions, diagonal normalized)
- Escape: Pause

**Progression:** Spawn rate 1/second → +0.5/s every 15s (cap 8/s). Small from start, medium at 20s, large at 40s. Speed +10% every 30s. Shields rarer over time.

**Scoring:** +1/second. +30 near-miss (within 10px). +50/shield. Multiplier ×2 for 10s from golden pickup.

**Game Over Condition:** Ship touches any meteor without shield.

**Restart Behavior:** Center, score 0, default spawn rate, clear all.

**Screens:**
- **Intro:** "METEOR DODGE" with drifting meteors. Ship silhouette. "Arrow Keys to Move". High score. "SPACE to Launch".
- **HUD:** Score top-left (smooth), Time top-right (MM:SS), Shield icon when active, Multiplier badge.
- **Pause:** "PAUSED" over star field.
- **Game Over:** Explosion → "DESTROYED" with shake. Score, time, near-misses, shields. High score. "Click to Retry".

**Objects:**
- Ship: 16×20px white/cyan triangle, engine trail particle emitter (additive), setCollideWorldBounds(true)
- Small Meteor: 12-18px, speed 120-180px/s
- Medium Meteor: 28-40px, speed 80-120px/s
- Large Meteor: 50-70px, speed 40-70px/s
- Shield Pickup: 14×14px blue diamond, bobs, 15s spawn interval
- Multiplier Pickup: 14×14px golden star, rare
- Near-miss sparks: White particles on close pass
- Death explosion: 20+ particles, varying sizes

### Build Instructions

1. Create `scripts/games/meteor-dodge/`
2. Write `config.json`: engine phaser3, genre 2d-arcade, resolution 960×540
3. Build `index.html` — physics groups for 3 meteor sizes (maxSize pooling). Shield/multiplier separate groups.
4. Spawning: `time.addEvent` with decreasing delay. Spawn from random edge toward random inner-60% point.
5. Near-miss: Each frame, check distance to all active meteors. If between collision radius and +10px: award points + spark.
6. `setCollideWorldBounds(true)` on player.
7. Validate all 8 checks.
8. **Mechanics feasibility audit**: Verify player max movement speed exceeds the fastest meteor speed by ≥30% (the player must always be able to outrun any single meteor). At max spawn rate (8/s), verify the screen has enough open area for the player to find gaps: `spawned_meteors_per_second × average_meteor_area < 15% of total arena area`. Near-miss detection radius (10px) must be clearly larger than collision radius to prevent false deaths when the player thinks they dodged — add a buffer zone. Shield spawn interval must prevent guaranteed unavoidable death at high difficulty (at least 1 shield per 20s). Meteor edge-spawning must enforce a minimum distance from the player (≥50px) so meteors never appear directly on top of the player when they're near a wall. `setCollideWorldBounds(true)` must be verified — if the player is trapped at a corner with meteors closing in from 2+ directions, their movement speed must allow escape before impact.
9. Polish: Dense star parallax, engine trail, near-miss sparks, shield flash, multiplier gold tint on score, death explosion, camera shake
10. Iterate 3+ times — spawn rates, movement speed, near-miss distance
11. Write `thumbnail-prompt.txt`

---
---

# GAME 20: Ember Guard

## Prompt (append after Common Preamble)

### Game Concept

**Title:** Ember Guard
**Slug:** `ember-guard`
**Genre:** `2d-topdown`
**Engine:** `phaser3`
**Logline:** Guard the last ember through the endless night — place torches, gather wood, and fend off shadow creatures hungry for your light.

**Visual Style:** Dark top-down world. Most screen is black/very dark blue (darkness). Campfire radiates warm orange/yellow circle. Torches create smaller light circles. Player has small lantern light. Shadow creatures: dark purple/black with glowing red eyes, dissolve in light. Wood: brown rectangles. Atmospheric and tense.

**Core Mechanic:** Central campfire slowly dims (fuel depleting). Campfire light = safe zone — shadows dissolve in it. Player ventures into darkness to collect wood, brings it back to refuel. Player places torches (3 wood cost) to extend light network. Shadows spawn from darkness, move toward campfire; if they reach it, they damage it. Campfire destroyed = game over.

**Controls:**
- WASD or Arrows: Move
- Space: Pick up / drop wood
- T: Place torch (costs 3 wood)
- E: Add wood to campfire (costs 1 wood, near campfire)
- Escape: Pause

**Progression:** Campfire full brightness (150px radius) depletes over 60s. Shadows every 5s → every 1s by 3min. Speed +10%/min. Types: basic shadow (start), fast shadow (60s), tank shadow (120s, 3× HP). Wood spawn distance increases.

**Scoring:** +5/second campfire alive. +10/shadow destroyed. +20/wood. +50/torch. Combo for multi-shadow kills. Multiplier: ×2 at 2min, ×3 at 5min.

**Game Over Condition:** Campfire HP = 0.

**Restart Behavior:** Full campfire, no torches, no shadows, player at campfire, score 0.

**Screens:**
- **Intro:** "EMBER GUARD" flickering flame text. Campfire animation. Darkness from edges. Controls. High score. "Click to Begin".
- **HUD:** Campfire HP top-left (orange-to-red), Fuel meter below (yellow, depletes), Wood inventory top-right, Score bottom-left, Time bottom-right.
- **Pause:** "PAUSED" over darkened scene.
- **Game Over:** Campfire extinguishes (glow shrinks to nothing, screen goes dark). "THE LIGHT DIES" fades in. Time, shadows killed, torches, wood, score. High score. "Click to Reignite".

**Objects:**
- Player: 16×16px figure with lantern light (40px radius), carries wood visually
- Campfire: 24×24px animated flame, light radius varies with fuel (150→30px), HP bar
- Torch: 8×8px flame, 60px light radius, permanent, costs 3 wood
- Light Zone: Radial gradient from each light source
- Basic Shadow: 14×14px dark purple circle, red eyes, moves toward campfire, dissolves in light, 1 HP, 1 damage
- Fast Shadow: 10×10px dark red triangle, 2× speed, 1 HP, 1 damage
- Tank Shadow: 20×20px dark gray square, slow, 3 HP, 2 damage
- Wood: 10×6px brown rectangle, spawns outside safe zone
- Darkness overlay: Full-screen dark layer with circular cutouts for lights
- Light flicker: ±5px radius oscillation on all light sources

### Build Instructions

1. Create `scripts/games/ember-guard/`
2. Write `config.json`: engine phaser3, genre 2d-topdown, resolution 960×540
3. Build `index.html` — Light/dark system is the core visual. Draw full-screen dark Graphics layer at high depth. Cut circular holes for each light source using `blendMode: 'ERASE'` or RenderTexture mask approach.
4. Shadow AI: `this.physics.moveToObject(creature, campfire, speed)`. Overlap check with light zones each frame — damage creature in light.
5. Fuel: Decreases every frame. At 0, light radius shrinks. E near campfire adds 20s fuel.
6. Wood: Spawn at random positions 100px+ from campfire, every 8s via time.addEvent.
7. Validate all 8 checks.
8. **Mechanics feasibility audit**: Verify wood spawn rate sustains campfire fuel: `wood_spawn_rate × fuel_per_wood` must exceed `campfire_depletion_rate` with margin for player travel time to collect and return. Calculate round-trip time: `2 × (average_wood_distance / player_speed)`. Verify the campfire doesn't die during a single round-trip. Shadow HP must be killable by light exposure: `time_shadow_spends_in_light × damage_per_second ≥ shadow_HP` for all shadow types. Verify player movement speed allows collecting wood and returning before fuel runs out (worst case: farthest wood spawn). Torch placement cost (3 wood) must be earnable within 1 fuel cycle — if wood spawns too slowly, torches become impossible to build. Test that the first 60 seconds are survivable without placing any torches. Verify shadows path toward the campfire and not toward the player — if they target the player, verify the player can outrun them.
9. Polish: Campfire flicker, torch flicker, shadow dissolve (fade + shrink), "+1 WOOD" floating text, damage flash on campfire, atmospheric light/dark interplay
10. Iterate 3+ times — balance wood rate vs fuel depletion, shadow damage vs HP, torch radius vs cost
11. Write `thumbnail-prompt.txt`

---
---

# Summary Table

| # | Game | Genre | Engine | Core Mechanic |
|---|------|-------|--------|---------------|
| 1 | Chrono Hop | 2d-platformer | Phaser 3 | Timeline-switching vertical platformer |
| 2 | Dungeon Dash | 2d-topdown | Phaser 3 | Room-based melee combat with dodge roll |
| 3 | Prism Match | 2d-puzzle | Phaser 3 | Light beam routing with rotatable prisms |
| 4 | Gravity Flip | 2d-arcade | Phaser 3 | One-button gravity toggle auto-runner |
| 5 | Plasma Blitz | 2d-shooter | Phaser 3 | Vertical shmup with weapon upgrades + bosses |
| 6 | Crystal Keep | 2d-tower-defense | Phaser 3 | 4 tower types with economy and waves |
| 7 | Shadow Sprint | 2d-endless-runner | Phaser 3 | Inverted-light aesthetics with shadow meter |
| 8 | Synth Wave | 2d-rhythm | Phaser 3 | BPM-synced 4-lane note hitting |
| 9 | Duel Deck | 2d-cards | Phaser 3 | Turn-based card dueling with AI opponent |
| 10 | Cosmic Tycoon | 2d-idle | Phaser 3 | Click mining with extractors and prestige |
| 11 | Serpent Neon | 2d-custom | Phaser 3 | Modern snake with power-ups and glow trail |
| 12 | Labyrinth | 3d-firstperson | Three.js | FP maze navigation with keys and shadows |
| 13 | Neon Surge | 3d-thirdperson | Three.js | 3-lane endless runner in neon void |
| 14 | Turbo Circuit | 3d-racing | Three.js | Hover-car racing with laps and boost pads |
| 15 | Tesseract | 3d-puzzle | Three.js | 3D cube structure face-alignment puzzle |
| 16 | Star Viper | 3d-flight | Three.js | Space flight combat with lasers and asteroids |
| 17 | Sky Islands | 3d-platformer | Three.js | Floating island 3D platformer with double-jump |
| 18 | Gravity Maze | 3d-custom | Three.js | Tilt-controlled marble maze physics puzzler |
| 19 | Meteor Dodge | 2d-arcade | Phaser 3 | 360° arena dodger with near-miss scoring |
| 20 | Ember Guard | 2d-topdown | Phaser 3 | Light/dark survival with campfire + torch placement |

### Genre Coverage (all 18 genres covered)

**2D (13 games):** platformer, topdown ×2, puzzle, arcade ×2, shooter, tower-defense, endless-runner, rhythm, cards, idle, custom

**3D (7 games):** firstperson, thirdperson, racing, puzzle, flight, platformer, custom

### Mechanic Uniqueness Verification

No two games share a core mechanic. Each has a distinct primary interaction:
- Timeline phasing, room combat, beam routing, gravity toggle, scrolling shooter, tower placement, shadow/light runner, rhythm hitting, card dueling, idle clicking, snake movement, FP maze, lane runner, racing, cube rotation, space flight, island jumping, marble tilting, meteor dodging, campfire defense
