export const CUSTOM_2D_PROMPT = `## Genre: 2D Custom / Novel Concept (Phaser 3)

This game has a novel or hybrid concept that doesn't fit standard genre categories. Apply these general 2D game development principles and adapt them to the specific GDD.

### Core Architecture
- **Game Loop:** Use Phaser's Scene \`update(delta, time)\` for the main game loop. Track game state (idle, intro, playing, paused, gameover) and gate logic accordingly. Use \`delta\` for frame-rate independent movement.
- **Input:** Use \`this.input.keyboard.createCursorKeys()\` for arrow keys, \`this.input.keyboard.addKey()\` for specific keys, and \`this.input.on('pointerdown'/'pointermove')\` for mouse/touch. Keep input handling simple and responsive.
- **Physics:** Use Arcade Physics for most interactions. Set up collision groups for different object types. Use \`collider\` for solid interactions, \`overlap\` for triggers/pickups.
- **State Management:** Use \`this.registry\` or a module-level state object to share data between scenes and the SloppyGame wrapper. Store score, lives, level, and any custom state.

### General 2D Patterns
- **Object Pooling:** Use \`this.physics.add.group({ maxSize: N })\` for any object type that spawns frequently. Recycle with \`disableBody(true, true)\` and \`enableBody(true, x, y, true, true)\`.
- **Procedural Visuals:** Generate all textures with \`this.add.graphics()\` + \`generateTexture('key', w, h)\` in \`create()\`. Use distinct colors and shapes for different object types. Never load external assets.
- **Camera:** \`this.cameras.main.startFollow(target)\` for scrolling games. \`setScrollFactor(0)\` for HUD elements. Camera effects (shake, flash) for game feel.
- **Tweens:** Use \`this.tweens.add()\` for smooth animations: scale pops on pickups, fade-ins on scene transitions, pulsing UI elements, bounce effects. Tweens are the primary tool for visual polish.
- **Timers:** \`this.time.addEvent({ delay, callback, loop })\` for periodic spawning, countdowns, and delayed effects. \`this.time.delayedCall()\` for one-shot delays.
- **Text & UI:** \`this.add.text(x, y, text, style)\` with \`setOrigin(0.5)\` for centering. Update text in \`update()\` for live counters. Use contrasting colors for readability.

### Scoring & Progression
- Implement a clear scoring mechanism that matches the GDD's description.
- Display score in the HUD with a visual pop on change.
- Save high score to \`localStorage\`.
- Implement difficulty progression as described in the GDD — if not specified, gradually increase speed, density, or complexity over time.
- Provide clear feedback for success (particles, screen flash, score pop) and failure (camera shake, visual flash).

### Adaptability Guidelines
- Read the GDD carefully and prioritize implementing the **core mechanic** first.
- If the concept involves physics interactions, lean on Arcade Physics colliders and overlaps.
- If the concept is turn-based, implement a state machine for turn phases and disable real-time input during non-player turns.
- If the concept involves drawing or creation, use graphics objects that respond to pointer input (draw paths, place objects).
- If the concept is simulation-based, focus on clear visual representation of the system state and intuitive controls for manipulation.
`;
