export const PLATFORMER_2D_PROMPT = `## Genre: 2D Platformer (Phaser 3)

### Core Mechanics
- **Gravity & Jump Physics:** Use Arcade Physics with \`gravity.y: 800–1200\`. Player jump via \`setVelocityY(-400 to -600)\` on ground contact only. Track \`body.blocked.down\` or \`body.touching.down\` for grounded state. Variable jump height: apply reduced gravity while jump key is held, cap with a min velocity.
- **Platform Collision:** Use \`this.physics.add.collider(player, platforms)\`. Static groups for fixed platforms, dynamic groups for moving platforms. Moving platforms: tween X/Y and set \`body.immovable = true\`, \`body.allowGravity = false\`.
- **Horizontal Movement:** \`setVelocityX(±200)\` on left/right input, \`setVelocityX(0)\` on release. Optional acceleration via \`setAccelerationX()\` for smoother feel.
- **Parallax Scrolling:** Multiple background layers using \`tileSprite\` or graphics layers with different \`scrollFactor\` values (e.g., 0.1, 0.3, 0.6). Camera follows player: \`this.cameras.main.startFollow(player)\`.

### Object Archetypes
- **Player:** Physics sprite with animated states (idle, run, jump, fall). Detect direction for sprite flip: \`player.setFlipX(true/false)\`.
- **Platforms:** Static physics group. Vary width/color. One-way platforms: set \`body.checkCollision.down = false\` (only collide from above).
- **Collectibles:** Physics group with overlap detection. Tween scale pop on collect. Disable and recycle via \`disableBody(true, true)\`.
- **Hazards:** Static or moving obstacles. Overlap triggers damage/death. Camera shake on hit.
- **Enemies:** Physics sprites with simple patrol AI (move between two points, reverse on wall/edge).

### Scoring Patterns
- Points per collectible gathered (10–100 per item).
- Bonus for completing a level quickly (time bonus).
- Combo multiplier for collecting items in quick succession.
- Track high score in \`localStorage\`.

### Difficulty Progression
- Increase gap distance between platforms over time or per level.
- Add moving platforms, then disappearing platforms.
- Increase enemy count and speed.
- Reduce collectible density, require riskier jumps for bonus items.
`;
