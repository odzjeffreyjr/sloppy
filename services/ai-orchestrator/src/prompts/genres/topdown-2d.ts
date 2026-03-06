export const TOPDOWN_2D_PROMPT = `## Genre: 2D Top-Down (Phaser 3)

### Core Mechanics
- **8-Directional Movement:** Read cursor keys or WASD. Set velocity based on input combination: \`setVelocity(speed * dirX, speed * dirY)\`. Normalize diagonal movement: multiply each axis by \`1/Math.sqrt(2)\` when both axes are active. Typical speed: 150–250.
- **Tile-Based vs Free Movement:** Free movement is simpler for generation — use Arcade Physics with world bounds. If tile-based, snap to grid on release using \`Phaser.Math.Snap.To(pos, tileSize)\`.
- **Projectiles:** Physics group with \`maxSize\` for pooling. On fire, get from group, set position to player, set velocity toward cursor or facing direction. Despawn on world bounds exit or collision. Fire rate limiter via \`time.now\` check.
- **Enemy AI Patterns:**
  - **Chase:** Move toward player at reduced speed: \`this.physics.moveToObject(enemy, player, speed)\`.
  - **Patrol:** Move between waypoints. Reverse direction at each point.
  - **Wander:** Random direction change on a timer: \`Phaser.Math.Between(-1,1)\` for each axis.
  - **Ranged:** Stop at distance threshold, fire projectiles toward player.
- **Camera:** Follow player with dead zone: \`this.cameras.main.startFollow(player, true, 0.1, 0.1)\`. Set bounds to world size.

### Object Archetypes
- **Player:** Physics sprite, rotates or flips to face movement direction.
- **Enemies:** Physics group. Each enemy type is a different color/shape with distinct AI behavior.
- **Projectiles:** Small fast-moving physics sprites. Player and enemy projectiles in separate groups for collision filtering.
- **Walls/Obstacles:** Static physics group forming the arena boundary and internal obstacles.
- **Pickups:** Health, ammo, power-ups. Overlap detection, tween on collect.

### Scoring Patterns
- Points per enemy defeated (varies by enemy type).
- Wave survival bonus (increasing per wave cleared).
- Accuracy bonus: track shots fired vs hits.
- Streak multiplier for kills without taking damage.

### Difficulty Progression
- Increase enemy spawn rate each wave.
- Introduce new enemy types with different AI behaviors.
- Enemies gain speed and health over time.
- Reduce pickup frequency. Add elite/boss enemies at wave milestones.
`;
