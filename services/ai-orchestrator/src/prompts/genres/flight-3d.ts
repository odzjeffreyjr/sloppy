export const FLIGHT_3D_PROMPT = `## Genre: 3D Flight / Space Shooter (Three.js)

### Core Mechanics
- **Flight Controls:** Player ship rotates with mouse/arrow keys. Roll: rotate around Z axis. Pitch: rotate around X axis. Yaw: rotate around Y axis. Apply rotation to the ship mesh and use the ship's forward vector for movement direction:
  \`\`\`
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.quaternion);
  ship.position.addScaledVector(forward, speed * delta);
  \`\`\`
  Pre-allocate the forward vector. Mouse controls: horizontal = yaw, vertical = pitch. Keyboard: arrows for pitch/yaw, Q/E for roll. Smoothly interpolate rotation for fluid feel.
- **Throttle:** W/Up increases speed, S/Down decreases. Maintain a speed variable clamped between minSpeed and maxSpeed. Display speed as a bar or numeric value in the HUD.
- **Projectile System:** Fire projectiles in the ship's forward direction on click or spacebar. Pool of 30+ sphere or cylinder meshes. Set velocity as \`forward.clone().multiplyScalar(bulletSpeed)\`. Update each active bullet's position per frame. Deactivate bullets that exceed a max distance from the ship.
- **Enemy Ships/Targets:** Pool of 10–20 enemy meshes. Spawn at random positions ahead of the player. Basic AI: fly toward the player or along patrol paths. Some enemies fire back. Detect hits via \`Box3\` or distance-based sphere intersection. Explosion effect: brief particle-like burst (scale up a bright mesh, then fade and remove).
- **Camera:** Third-person follow camera positioned behind and above the ship. Smooth follow with \`camera.position.lerp()\`. Camera looks at a point slightly ahead of the ship. Slight lag on roll for cinematic feel.
- **Environment:** Starfield backdrop: scatter 200–500 small sphere meshes or points at great distance. Optional: asteroids (low-poly sphere geometries with random deformation) as obstacles. Fog at far distance to hide popping.

### Object Archetypes
- **Player Ship:** Group of box/cylinder/cone meshes forming a ship silhouette (fuselage + wings + tail). Emissive engine glow on the rear. \`castShadow = true\`. Slight banking animation on turn (rotate Z proportional to yaw input).
- **Enemy Ships:** Simpler mesh groups in a contrasting color. Different shapes per type (fighter = small/fast, bomber = large/slow, turret = stationary). Pool with \`visible\` toggle.
- **Projectiles:** Small elongated cylinders or spheres with emissive material. Distinct color per team (player = blue/green, enemy = red/orange). Pooled, toggle \`visible\`.
- **Asteroids/Obstacles:** Icosahedron or dodecahedron geometries with randomized vertex displacement for organic look. Slowly rotating. Destructible (break into smaller pieces) or indestructible barriers.
- **Explosions:** Quick burst effect: scale a sphere with emissive material from 0 to 3 over 300ms, then set invisible. Reusable pool.
- **Power-Ups:** Floating torus or octahedron with emissive material, slowly rotating. Types: health, weapon upgrade, shield, speed boost.

### Scoring Patterns
- Points per enemy destroyed (scaled by type: fighter=100, bomber=250, turret=150).
- Accuracy bonus: hits / shots fired.
- Survival time contributes to score.
- Wave completion bonus.
- Asteroid destroyed = small bonus.
- Boss defeat = large bonus with time modifier.

### Difficulty Progression
- Increase enemy count per wave and spawn rate.
- Enemies fire more frequently and with better aim.
- Introduce new enemy types at wave milestones.
- Asteroid density increases, requiring evasion while fighting.
- Boss encounters every 5 waves with unique attack patterns.
- Player ship speed and enemy speed both increase for faster-paced action.
`;
