export const PHASER3_CDN_URL = 'https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js';

export const PHASER3_RESOLUTION = { width: 960, height: 540 };

export const PHASER3_SYSTEM_PROMPT = `## Phaser 3 Engine — Code Generation Guide

You are generating a self-contained HTML file that uses **Phaser 3** loaded via CDN.

### CDN Import
\`\`\`html
<script src="${PHASER3_CDN_URL}"></script>
\`\`\`

### Standard Resolution
${PHASER3_RESOLUTION.width}×${PHASER3_RESOLUTION.height} (16:9). Configure the Phaser game with these dimensions.

### Phaser 3 Scene Architecture
Structure the game using multiple Phaser Scenes:

1. **BootScene** — Minimal scene that immediately transitions to IntroScene. Use for any one-time setup.
2. **IntroScene** — Title screen with game name, controls hint, and "Click to Start" / "Press SPACE to Start" prompt. Maps to \`renderIntroScreen()\`.
3. **GameScene** — Main gameplay scene. Contains the game loop, physics, input, HUD rendering. Maps to \`start()\`, \`pause()\`, \`resume()\`, \`renderHUD()\`.
4. **PauseScene** — Launched as an overlay scene on top of GameScene. Maps to \`renderPauseScreen()\`.
5. **GameOverScene** — Displays final score, high score, and a "Play Again" button/prompt. Maps to \`renderGameOverScreen()\`.

### Mapping SDK v2 Lifecycle to Phaser

\`\`\`
init(container, config) →
  Create new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: config.width,
    height: config.height,
    backgroundColor: '#000000',
    physics: { default: 'arcade', arcade: { gravity: {...}, debug: false } },
    scene: [BootScene, IntroScene, GameScene, PauseScene, GameOverScene]
  });
  Store reference to the Phaser.Game instance.
  After Phaser fires 'ready', post: window.parent.postMessage({ type: 'sloppy:game:ready' }, '*');

destroy() →
  game.destroy(true);  // removes canvas, cleans up all scenes
  Remove any extra event listeners.

start() →
  game.scene.start('GameScene');
  Set internal state to 'playing'.

pause() →
  game.scene.pause('GameScene');
  game.scene.launch('PauseScene');  // overlay
  Set internal state to 'paused'.

resume() →
  game.scene.stop('PauseScene');
  game.scene.resume('GameScene');
  Set internal state to 'playing'.

restart() →
  game.scene.stop('PauseScene');
  game.scene.stop('GameOverScene');
  game.scene.start('GameScene');  // re-runs create()
  Reset score, level, timer.
  Set internal state to 'playing'.

renderIntroScreen() →
  game.scene.start('IntroScene');
  Set internal state to 'intro'.

renderPauseScreen() →
  game.scene.launch('PauseScene');

renderGameOverScreen(score) →
  game.scene.stop('GameScene');
  game.scene.start('GameOverScene', { score });
  Set internal state to 'gameover'.

getState() → return the internal state string ('idle'|'intro'|'playing'|'paused'|'gameover')

getScore() → return { score: currentScore, level: currentLevel, timeElapsed: elapsedSeconds }
\`\`\`

### Phaser 3 API Essentials

**Physics (Arcade):**
- \`this.physics.add.sprite(x, y, key)\` — physics-enabled sprite
- \`this.physics.add.group()\` — physics group for pooling
- \`this.physics.add.collider(obj1, obj2, callback)\`
- \`this.physics.add.overlap(obj1, obj2, callback)\`
- \`sprite.setVelocity(x, y)\`, \`sprite.setBounce(v)\`, \`sprite.setCollideWorldBounds(true)\`
- \`this.physics.world.setBounds(x, y, w, h)\`

**Graphics (procedural — no external assets):**
- \`this.add.graphics()\` — for shapes, fills, lines
- **Fill primitives:** \`graphics.fillStyle(color, alpha)\`, \`graphics.fillRect(x,y,w,h)\`, \`graphics.fillCircle(x,y,r)\`, \`graphics.fillTriangle(x1,y1,x2,y2,x3,y3)\`, \`graphics.fillRoundedRect(x,y,w,h,radius)\`, \`graphics.fillEllipse(x,y,w,h)\`, \`graphics.fillPoint(x,y,size)\`
- **Stroke primitives:** \`graphics.lineStyle(width, color)\`, \`graphics.strokeRect()\`, \`graphics.strokeCircle()\`, \`graphics.lineBetween(x1,y1,x2,y2)\`
- **Path drawing (for stars, polygons, custom shapes):** \`graphics.beginPath()\`, \`graphics.moveTo(x,y)\`, \`graphics.lineTo(x,y)\`, \`graphics.closePath()\`, \`graphics.fillPath()\`, \`graphics.strokePath()\`
- **Star game object:** \`this.add.star(x, y, points, innerRadius, outerRadius, fillColor)\` — built-in star shape
- Generate textures from graphics: \`graphics.generateTexture('key', w, h)\` then \`graphics.destroy()\`
- **WARNING:** There is NO \`fillStar()\`, \`fillPolygon()\`, or \`drawStar()\` method on Graphics. Use path methods or \`this.add.star()\` instead.

**Text:**
- \`this.add.text(x, y, 'text', { fontSize: '24px', color: '#fff', fontFamily: 'Arial' })\`
- \`text.setOrigin(0.5)\` for centering

**Input:**
- \`this.input.keyboard.createCursorKeys()\` — arrow keys
- \`this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)\`
- \`this.input.on('pointerdown', callback)\`

**Camera & Effects:**
- \`this.cameras.main.shake(duration, intensity)\`
- \`this.cameras.main.flash(duration, r, g, b)\`
- \`this.cameras.main.setBackgroundColor(color)\`

**Tweens:**
- \`this.tweens.add({ targets, props, duration, ease, onComplete })\`

**Particles (Phaser 3.60+):**
- \`this.add.particles(x, y, 'key', { ... })\`

**Timers:**
- \`this.time.addEvent({ delay, callback, loop })\`
- \`this.time.delayedCall(delay, callback)\`

### Important Patterns
- All visual assets MUST be generated procedurally using \`this.add.graphics()\` and \`generateTexture()\`. NEVER reference external image/audio files.
- Store the Phaser.Game instance so \`destroy()\` can call \`game.destroy(true)\`.
- The game object assigned to \`window.SloppyGame\` manages state externally; Phaser scenes handle rendering.
- Share state between the SloppyGame wrapper and Phaser scenes via a shared state object or Phaser's registry (\`this.registry\`).
`;

export const PHASER3_QUALITY_RULES = `### Phaser 3 Quality Rules
- Use particle effects for impacts, pickups, and explosions — never just delete sprites silently.
- Use tweens for smooth transitions: scale pops on pickup, fade-ins on scene start, bounce on landing.
- Camera shake on damage/collision for game feel ("juice").
- Camera flash on level completion or power-up.
- All text should use \`setOrigin(0.5)\` for proper centering.
- HUD elements should be fixed to camera using \`setScrollFactor(0)\`.
- Use Arcade Physics groups with \`maxSize\` for object pooling (enemies, bullets, collectibles).
- Always set \`setCollideWorldBounds(true)\` on the player sprite.
- Generate textures in \`create()\`, not in \`update()\` — never create new graphics objects per frame.
- Use \`this.registry\` or a module-level state object to share data between scenes.
- Intro screen must have a clear visual prompt to start (pulsing text, animated button).
- Game over screen must show the final score prominently and a clear restart prompt.
`;

export const PHASER3_FORBIDDEN_PATTERNS = `### Phaser 3 Forbidden Patterns
- NEVER use \`this.load.image()\` or \`this.load.audio()\` — no external asset files exist. Generate all visuals with Graphics + generateTexture().
- NEVER use \`this.load.spritesheet()\` — create animated effects with tweens or particles instead.
- NEVER call \`new Phaser.Game()\` more than once — store the instance and reuse it.
- NEVER use \`scene.scene.restart()\` from within the scene's own \`update()\` without a guard — this causes infinite loops.
- NEVER create new Graphics objects inside \`update()\` — this leaks memory. Create them in \`create()\` and reuse.
- NEVER use \`document.createElement('canvas')\` — Phaser manages its own canvas.
- NEVER call non-existent Graphics methods like \`fillStar()\`, \`fillPolygon()\`, \`drawStar()\`, \`drawCircle()\`, or \`drawRect()\`. Use the documented fill/stroke primitives or path drawing (\`beginPath/moveTo/lineTo/fillPath\`). For star shapes, use \`this.add.star()\`.
`;
