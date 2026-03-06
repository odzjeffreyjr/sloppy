export const TOWER_DEFENSE_2D_PROMPT = `## Genre: 2D Tower Defense (Phaser 3)

### Core Mechanics
- **Path System:** Define enemy paths as arrays of \`{ x, y }\` waypoints. Enemies follow the path using \`this.physics.moveToObject(enemy, nextWaypoint, speed)\`. When an enemy reaches a waypoint (\`Phaser.Math.Distance.Between() < threshold\`), advance to the next. Multiple paths can exist for variety.
- **Grid-Based Placement:** Divide the play area into a grid (e.g., 32×32 or 48×48 cells). Towers can only be placed on valid cells (not on the path). Show a grid overlay and highlight valid/invalid cells on hover. Snap tower placement to cell centers. Track occupied cells to prevent stacking.
- **Tower Types:** Each tower is a static sprite with an attack radius (visualized as a semi-transparent circle on selection):
  - **Basic:** Medium range, single-target projectile, moderate damage.
  - **Splash:** Short range, area-of-effect damage to all enemies in radius.
  - **Slow:** Reduces enemy speed within range (tint enemies blue when slowed).
  - **Sniper:** Long range, high single-target damage, slow fire rate.
- **Tower Targeting:** Each tower tracks enemies within its range using \`Phaser.Math.Distance.Between(tower, enemy) < tower.range\`. Target priority: first enemy along the path (closest to goal), strongest, or weakest. Fire a projectile tween from tower to target.
- **Economy:** Start with initial gold. Earn gold per enemy killed. Towers cost gold to place. Optional: sell towers for partial refund, upgrade towers for increased stats at higher cost.
- **Wave System:** Waves define enemy composition \`{ type, count, interval, path }\`. "Next Wave" button or auto-start after a countdown. Wave counter displayed in HUD. Increasing enemy count and toughness per wave.
- **Lives/Base Health:** Enemies reaching the end of the path deal damage to the base. Display remaining lives prominently. Game over when lives reach 0.

### Object Archetypes
- **Towers:** Static physics sprites placed on the grid. Rotate to face their target. Visual range indicator on hover/select. Upgrade visual changes (color shift, size increase).
- **Enemies:** Physics group following waypoint paths. Types: basic (medium speed, low HP), fast (high speed, low HP), tank (slow, high HP), boss (very slow, very high HP, larger size). Color/shape distinguishes types.
- **Projectiles:** Small fast-moving sprites. Tower-to-enemy tweens or physics projectiles. Splash projectiles trigger an area-of-effect explosion graphic on impact.
- **Path Tiles:** Graphics layer showing the path enemies follow. Distinct color from buildable terrain.
- **UI Elements:** Tower selection panel (bottom or side bar), gold counter, wave counter, lives display, wave start button.

### Scoring Patterns
- Points per enemy killed (scaled by type).
- Wave completion bonus (increases per wave).
- "Perfect wave" bonus when no enemies reach the base.
- Gold remaining at the end contributes to final score.
- Total waves survived is the primary metric.

### Difficulty Progression
- More enemies per wave with increasing HP and speed.
- Introduce new enemy types at wave milestones (fast at wave 3, tank at wave 6, boss every 10).
- Enemies with special abilities in later waves (e.g., healing aura, shield, sprint on low HP).
- Multiple simultaneous paths in later waves.
- Cost of new towers and upgrades increases relative to income.
`;
