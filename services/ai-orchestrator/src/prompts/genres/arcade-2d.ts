export const ARCADE_2D_PROMPT = `## Genre: 2D Arcade (Phaser 3)

### Core Mechanics
- **Simple Controls:** One or two input axes. Examples: left/right only, mouse follow, single-button tap. Map to \`this.input.keyboard.createCursorKeys()\` or \`this.input.on('pointermove')\`. Controls should be immediately intuitive.
- **Score Chasing:** Score is the primary goal — no level completion, game runs until death. Display score prominently in HUD. Track and display high score from \`localStorage\`.
- **Increasing Speed/Difficulty:** Use a difficulty scalar that grows with time or score: \`difficulty = 1 + score * 0.001\` or \`difficulty = 1 + elapsedTime * 0.01\`. Multiply enemy speed, spawn rate, and obstacle frequency by this scalar.
- **Lives System:** Start with 3 lives. Flash player sprite on hit (invincibility frames via tween alpha blink for 1–2 seconds). Camera shake on life loss. Game over at 0 lives.
- **Spawn Patterns:** Use \`this.time.addEvent({ delay, callback, loop: true })\` for periodic spawning. Decrease delay over time. Spawn from off-screen edges. Randomize spawn position within the valid range.

### Object Archetypes
- **Player:** Simple shape (circle, triangle, or small rectangle). Constrained to world bounds. Quick, responsive movement.
- **Enemies/Obstacles:** Physics group with \`maxSize\` for object pooling. Spawn off-screen, move across/down. Recycle when off-screen: \`if (obj.y > height + 50) obj.disableBody(true, true)\`.
- **Collectibles:** Bonus items that grant points, extra lives, or temporary power-ups. Less frequent than obstacles. Visual pop on collect (scale tween + particle burst).
- **Power-Ups:** Temporary effects: shield (invincibility), magnet (auto-collect), slow-mo (reduce game speed via \`this.time.timeScale\`). Show timer bar for active power-up.
- **Projectiles (if applicable):** Auto-fire or button-fire. Small, fast, pooled physics group.

### Scoring Patterns
- Time-based survival score: +1 per second alive.
- Points per enemy destroyed or obstacle dodged.
- Collectible bonuses (variable value).
- Milestone bonuses at score thresholds (every 1000 points).
- High score saved to \`localStorage\` and shown on game-over screen.

### Difficulty Progression
- Linearly or exponentially increase obstacle spawn rate.
- Increase obstacle/enemy movement speed.
- Introduce new obstacle types at score thresholds.
- Reduce gaps and safe zones over time.
- Brief difficulty plateaus after milestone bonuses for player relief.
`;
