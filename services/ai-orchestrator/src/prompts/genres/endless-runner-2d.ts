export const ENDLESS_RUNNER_2D_PROMPT = `## Genre: 2D Endless Runner (Phaser 3)

### Core Mechanics
- **Auto-Run:** The player character moves forward automatically at a constant (increasing) speed. The player does NOT control horizontal movement — they only react (jump, duck, switch lane). Implement by scrolling the world/obstacles leftward while the player stays at a fixed X position.
- **Jump:** Single button (SPACE or tap) triggers a jump. Use Arcade Physics gravity (\`gravity.y: 800–1200\`). Jump: \`player.setVelocityY(-jumpForce)\` only when \`body.blocked.down\`. Optional double-jump: allow one mid-air jump, track with a \`jumpsRemaining\` counter.
- **Duck/Slide:** Down arrow or swipe-down. Temporarily reduce player hitbox height (\`player.setSize(w, reducedH)\`) and play a slide animation (flatten sprite). Revert after a short duration (\`this.time.delayedCall(500, ...)\`). Used to avoid overhead obstacles.
- **Procedural Obstacles:** Maintain a pool of obstacle groups. As the world scrolls, spawn new obstacles at the right edge. Recycle obstacles that pass the left edge. Randomize obstacle type and gap distance. Types: ground barriers (jump over), overhead barriers (slide under), pits (jump over gap), floating collectibles.
- **Ground Scrolling:** Use a \`tileSprite\` for the ground that scrolls continuously: \`ground.tilePositionX += speed * delta\`. Layer multiple tileSprites at different scroll speeds for parallax depth (sky, mountains, ground).
- **Speed Increase:** Base scroll speed increases over time: \`speed = baseSpeed + elapsed * acceleration\`. Cap at a maximum speed to keep the game playable.

### Object Archetypes
- **Player:** Physics sprite at a fixed X position (e.g., x=150). Animated states: running (frame cycle or bob tween), jumping (arms up), sliding (flattened). \`setCollideWorldBounds(true)\` on Y axis.
- **Ground:** Static physics body at the bottom. TileSprite for visual scrolling. The player collides with this.
- **Obstacles:** Physics group, \`allowGravity: false\`, moving leftward at scroll speed. Ground obstacles: short boxes to jump over. Overhead obstacles: tall boxes or beams to slide under. Pits: gaps in the ground (disable ground collider over the gap zone).
- **Collectibles:** Coins/stars floating in the air in patterns (arcs, lines, clusters). Physics group moving leftward. Overlap detection with player → score + tween pop + disable.
- **Parallax Backgrounds:** 2–3 layers of tileSprites with decreasing scroll factors (0.1, 0.3, 0.6). Adds depth without gameplay impact.

### Scoring Patterns
- Distance-based: score increases every frame proportional to speed. Display as meters.
- Collectibles: each coin/star adds a flat bonus (10–50 points).
- Milestone bonuses: visual flash and bonus at every 500m or 1000m.
- High score saved in \`localStorage\` and displayed on game-over and intro screens.
- Speed multiplier: score accumulates faster as speed increases.

### Difficulty Progression
- Scroll speed increases linearly with time.
- Obstacle density increases (shorter gaps between obstacles).
- Introduce obstacle combinations (ground + overhead requiring precise timing).
- Increase pit width over time.
- Reduce collectible frequency, place them in riskier positions.
- Visual speed lines or screen effects at high speeds for intensity.
`;
