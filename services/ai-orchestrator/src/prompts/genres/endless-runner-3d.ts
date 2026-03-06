export const ENDLESS_RUNNER_3D_PROMPT = `## Genre: 3D Endless Runner / Third-Person (Three.js)

### Core Mechanics
- **Procedural Track Segments:** Define 3–5 segment templates (straight, left curve, right curve, narrow, wide). Each is a group of meshes (floor plane + walls + decorations). Maintain a pool of segment instances. As the player moves forward, recycle the farthest-behind segment and place it ahead with new obstacle configuration.
- **Forward Motion:** Player auto-moves forward at a base speed that increases over time: \`speed = baseSpeed + elapsed * acceleration\`. Player mesh/group position.z decreases each frame (or world scrolls). Camera follows at fixed offset behind and above.
- **Lane Switching:** Define 3 lanes at fixed X positions (e.g., -2, 0, 2). On left/right input, tween player X toward the target lane: \`player.position.x = THREE.MathUtils.lerp(player.position.x, targetLaneX, 0.15)\`. Tween duration ~200ms for snappy feel.
- **Jump & Slide:** Jump: tween Y up then back down (parabolic arc over ~0.5s). Slide/duck: tween Y down and scale Y to 0.5 briefly. Both provide obstacle avoidance on different axes.
- **Obstacle Spawning:** Each new segment randomly places obstacles in 1–2 of the 3 lanes. Obstacle types: low barriers (jump over), high barriers (slide under), full-lane blockers (must switch lane). Use Box3 collision detection.

### Object Archetypes
- **Player:** Group of simple meshes (body, head, limbs — or a single capsule shape). \`castShadow = true\`. Centered in current lane. Animate run cycle via small rotation tweens on limbs or a bobbing Y position.
- **Track Segments:** Wide box for floor (\`receiveShadow\`), thin box walls on sides. Pool of 6–8 segment groups recycled in a ring buffer.
- **Obstacles:** Box, cylinder, or cone meshes. Color-coded by type (red = lethal, yellow = low barrier, blue = overhead). Placed at specific lane X positions.
- **Collectibles:** Coin-like torus meshes with emissive gold material, floating at player height. Rotate on Y axis. Lines of collectibles guide the player toward optimal paths.
- **Power-Ups:** Distinct shape (star, diamond). Temporary effects: magnet (auto-collect coins within radius), shield (survive one hit), 2x score.

### Scoring Patterns
- Distance-based score: increases with meters traveled.
- Collectible bonus: coins/gems add flat score on pickup.
- Multiplier pickups that temporarily double score rate.
- High score from \`localStorage\` shown on game-over screen.
- Milestone notifications (every 1000 points) with brief screen flash.

### Difficulty Progression
- Base speed increases linearly with time/distance.
- Obstacle density increases (more lanes blocked per segment).
- Introduce new obstacle types at distance milestones.
- Reduce gaps between obstacle clusters.
- Track geometry becomes more complex (sharper curves, narrower sections).
`;
