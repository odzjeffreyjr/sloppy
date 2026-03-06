export const FPS_3D_PROMPT = `## Genre: 3D First-Person (Three.js)

### Core Mechanics
- **Pointer Lock Controls:** Request pointer lock on click: \`renderer.domElement.requestPointerLock()\`. Track mouse movement in \`mousemove\` event to rotate camera. Yaw: rotate around Y axis. Pitch: rotate around X axis, clamp to ±80°. Store euler angles and apply to camera each frame.
- **WASD Movement:** Track key state in a map. Each frame, compute movement vector relative to camera facing direction:
  \`\`\`
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  forward.y = 0; forward.normalize();
  right.y = 0; right.normalize();
  // apply WASD to move along forward/right vectors
  \`\`\`
  Pre-allocate these vectors — never create in the loop.
- **Projectile/Raycasting:** On click, cast a ray from camera center: \`raycaster.setFromCamera({x:0, y:0}, camera)\`. Check intersections with enemy group. Alternatively, create visible projectile meshes that travel forward — pool them.
- **Enemy Spawning:** Pre-create a pool of enemy meshes. Activate at random positions around the arena at intervals. Enemies face and move toward the player at varying speeds. Deactivate (set \`visible = false\`) on hit.
- **Health System:** Player starts with 100 HP. Enemies deal damage on proximity or projectile hit. Flash screen red on damage (fullscreen overlay div with red background, fade out). Game over at 0 HP.

### Object Archetypes
- **Player:** Camera itself is the player. No visible player mesh. Weapon/crosshair as HTML overlay centered on screen.
- **Enemies:** Box or cylinder meshes with distinct color per type. Pool of 10–20, toggle \`visible\`. Simple AI: \`lookAt(camera.position)\` then move forward.
- **Arena/Environment:** Floor plane (\`receiveShadow\`), wall boxes forming a room or arena. Use different material colors for walls vs floor. Add pillars or crates as cover (box geometries).
- **Projectiles:** Small sphere meshes. Pool of 20+. Set velocity in camera forward direction. Collision via \`Box3\` intersection with enemies.
- **Pickups:** Health and ammo pickups. Floating meshes with slow Y-axis rotation (\`mesh.rotation.y += delta\`) and emissive glow.

### Scoring Patterns
- Points per enemy defeated (varies by type: basic=100, fast=200, heavy=300).
- Accuracy bonus: hits / shots fired ratio displayed on game-over.
- Wave survival bonus: increasing reward per wave cleared.
- Headshot bonus (if raycasting, check intersection point Y coordinate).

### Difficulty Progression
- Increase enemy spawn rate and pool utilization.
- Mix in faster and tougher enemy types.
- Enemies begin to fire projectiles back at the player.
- Reduce health pickup frequency.
- Shorten intervals between waves.
`;
