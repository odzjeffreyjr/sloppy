export const PLATFORMER_3D_PROMPT = `## Genre: 3D Platformer (Three.js)

### Core Mechanics
- **Third-Person Camera:** Camera positioned behind and above the player. Orbit with mouse drag (track theta and phi in spherical coordinates, convert to Cartesian offset from player). Smooth follow: \`camera.position.lerp(playerPos.clone().add(cameraOffset), 0.08)\`. \`camera.lookAt(player.position)\`. Clamp vertical angle to prevent flipping.
- **Movement:** WASD moves the player relative to the camera facing direction. Compute forward/right vectors from camera orientation (project onto XZ plane, normalize):
  \`\`\`
  const camForward = new THREE.Vector3();
  camera.getWorldDirection(camForward);
  camForward.y = 0; camForward.normalize();
  const camRight = camForward.clone().cross(new THREE.Vector3(0, 1, 0));
  \`\`\`
  Pre-allocate these vectors. Apply WASD input as weighted sum of forward and right vectors. Multiply by moveSpeed * delta.
- **Jump & Gravity:** Track vertical velocity manually. Each frame: \`velocityY -= gravity * delta; player.position.y += velocityY * delta\`. Ground check: if \`player.position.y <= groundHeight\`, snap to ground and set \`velocityY = 0\`, mark as grounded. Jump on SPACE: \`velocityY = jumpForce\` only when grounded. Optional double-jump.
- **Platform Collision:** Each platform stores its bounds (Box3 or manual AABB). Check if player is within XZ bounds and falling from above: snap player to platform top, set grounded. Moving platforms: update platform position with tween or sine, carry the player by adding platform delta to player position while standing.
- **Collectibles:** Floating meshes (coins, gems) with slow Y rotation and subtle Y bob (sine wave). Box3 or distance check with player. On collect: scale tween to 0, particle burst, score increment. Set \`visible = false\` for pooling.

### Object Archetypes
- **Player:** Capsule or box mesh group with basic limb approximation (body + head). \`castShadow = true\`. Squash-and-stretch tween on landing (scale Y briefly to 0.8 then back to 1.0). Rotate to face movement direction smoothly (\`lerp\` the Y rotation).
- **Platforms:** Box meshes of varying sizes and colors. Static platforms: fixed position. Moving platforms: tween or sine-based X/Y/Z animation. Disappearing platforms: timer-based visibility toggle after the player stands on them. Crumbling: visual shake then fall after a delay.
- **Collectibles:** Torus or icosahedron meshes with emissive gold/gem material. Pool of ~20. Rotate on Y axis, bob on Y via sine. Toggle \`visible\` on collect.
- **Hazards:** Spike meshes (cones pointed up), lava floors (plane with red emissive material, animated emissiveIntensity), swinging obstacles (cylinder on a pivot, animated with sine rotation). Contact triggers damage or respawn.
- **Checkpoints:** Flag or beacon mesh. Emits a glow (emissive increase on proximity). Stores the respawn position. Visual change (color shift) when activated.
- **Goal/Exit:** Distinct mesh (portal, door, glowing platform) at the end of the level. Triggers level completion (camera zoom out, celebration particles, score tally).

### Scoring Patterns
- Points per collectible gathered (10–100 depending on type).
- Time bonus: faster completion = more points. Track elapsed time, subtract from a par time.
- Lives remaining bonus at level completion.
- Secret area bonus: hidden collectibles in hard-to-reach locations.
- Score displayed in HUD overlay.

### Difficulty Progression
- Increase gap distances between platforms.
- Introduce moving and disappearing platforms.
- Add hazards that require timing (swinging obstacles, intermittent spikes).
- Platforms become smaller or faster-moving.
- More complex level layouts with branching paths.
- Introduce enemies with simple patrol AI (push player off platforms on contact).
`;
