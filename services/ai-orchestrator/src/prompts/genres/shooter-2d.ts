export const SHOOTER_2D_PROMPT = `## Genre: 2D Shooter / Bullet-Hell (Phaser 3)

### Core Mechanics
- **Auto-Scrolling:** The camera or world scrolls continuously in one direction (typically left-to-right or bottom-to-top). Player moves freely within the visible screen area. Set world bounds to the viewport size. Use a background tileSprite that scrolls: \`bg.tilePositionX += scrollSpeed * delta\`.
- **Shooting:** Player auto-fires or fires on button press. Projectile pool via \`this.physics.add.group({ maxSize: 30 })\`. On fire, get from pool, set position to player, set velocity in firing direction. Fire rate limiter: track \`lastFiredAt\` and compare against \`this.time.now\`.
- **Bullet Patterns (enemies):** Enemies fire projectiles in patterns:
  - **Single shot:** one projectile aimed at the player: \`this.physics.moveToObject(bullet, player, speed)\`.
  - **Spread:** 3–5 bullets fanning out at evenly spaced angles.
  - **Circle burst:** bullets emitted in all directions at equal angle intervals.
  - **Aimed stream:** continuous fire tracking the player's position.
- **Wave Spawning:** Define waves as arrays of \`{ enemyType, count, spawnDelay, formation }\`. Formations: line, V-shape, diagonal, random. Spawn from the scrolling edge. Use \`this.time.addEvent()\` to stagger spawn within a wave. Next wave triggers when all enemies in the current wave are defeated.
- **Power-Up System:** Dropped by enemies or spawned on a timer. Types: weapon upgrade (wider spread, faster fire rate), shield (absorbs one hit), bomb (clears all enemy bullets on screen), speed boost. Cycle through weapon tiers: single → double → triple → spread.

### Object Archetypes
- **Player Ship/Character:** Physics sprite constrained to screen bounds via \`setCollideWorldBounds(true)\`. Small hitbox relative to visual size for bullet-hell fairness. Trail particles behind the player for visual flair.
- **Enemies:** Physics group with multiple subtypes (basic, fast, tanky, boss). Each type: different shape/color, movement pattern (straight, sine wave, swoop, hover-and-fire), health points. Bosses: large, multi-phase, patterned attacks.
- **Player Projectiles:** Small, fast, pooled group. Destroy on contact with enemy or world bounds.
- **Enemy Projectiles:** Separate pooled group. Distinct color from player bullets (red/orange vs blue/green). Various speeds. Destroy on contact with player or leaving screen.
- **Power-Ups:** Floating items that drift toward the player or remain stationary. Distinct icon/color per type. Tween pulse effect. Overlap detection with player.

### Scoring Patterns
- Points per enemy destroyed (scaled by type: basic=100, fast=150, tanky=250, boss=2000).
- Combo multiplier: kills within a short time window increase multiplier (resets after a pause).
- No-damage bonus at end of each wave.
- Power-up collection bonus.
- Boss defeat bonus with time modifier (faster = more points).

### Difficulty Progression
- Increase enemy count and variety per wave.
- Enemy bullet speed and pattern complexity increase.
- Introduce bullet-hell patterns in later waves (dense, patterned projectile fields).
- Bosses appear every 5–10 waves with escalating mechanics.
- Reduce power-up drop rate in later waves.
- Enemies gain health, requiring more hits to defeat.
`;
