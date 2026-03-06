export const CUSTOM_3D_PROMPT = `## Genre: 3D Custom / Novel Concept (Three.js)

This game has a novel or hybrid concept that doesn't fit standard genre categories. Apply these general 3D game development principles and adapt them to the specific GDD.

### Core Architecture
- **Renderer Setup:** Create \`THREE.WebGLRenderer({ antialias: true })\` with shadow maps enabled (\`PCFSoftShadowMap\`), ACES Filmic tone mapping, and pixel ratio capped at 2. Append to the container.
- **Scene & Lighting:** Create a \`THREE.Scene()\` with \`FogExp2\` for depth. Add \`AmbientLight\` (base illumination) + \`DirectionalLight\` (with shadows). Ground plane with \`receiveShadow = true\`. Game objects with \`castShadow = true\`.
- **Camera:** \`PerspectiveCamera(60, aspect, 0.1, 1000)\`. Choose the best camera for the concept:
  - Third-person follow: \`camera.position.lerp(targetBehind, 0.05)\` with \`camera.lookAt(subject)\`.
  - Orbit: spherical coordinates converted to Cartesian, controlled by mouse drag.
  - Fixed/isometric: set position once, only adjust lookAt target.
  Always use \`lerp\` for smooth transitions — never snap the camera.
- **Game Loop:** \`requestAnimationFrame\`-based with \`THREE.Clock\` for delta time. Gate game logic updates on state === 'playing'. Always render (even when paused, to show the frozen scene behind overlays).
- **State Management:** Module-level state object storing score, lives, level, game state, and any custom data. Accessed by both the game loop and the SloppyGame wrapper methods.

### General 3D Patterns
- **Object Pooling:** Pre-create all meshes in setup. Toggle \`mesh.visible\` for activation. Never create or destroy meshes during gameplay. Pre-allocate reusable \`Vector3\` and \`Box3\` instances — never allocate in the game loop.
- **Collision Detection:** Use \`Box3.setFromObject(mesh)\` + \`box1.intersectsBox(box2)\` for AABB collision. For spherical objects, use distance checks: \`pos1.distanceTo(pos2) < r1 + r2\`. Check collisions once per frame for active objects only.
- **Materials:** Always use \`MeshStandardMaterial\` or \`MeshPhongMaterial\` (never Basic — it ignores lighting). Use \`emissive\` and \`emissiveIntensity\` for glowing effects. Different colors for different object types.
- **Geometries:** Build from primitives: \`BoxGeometry\`, \`SphereGeometry\`, \`CylinderGeometry\`, \`ConeGeometry\`, \`PlaneGeometry\`, \`TorusGeometry\`. Use \`THREE.Group\` to compose complex objects from primitives. Keep segment counts low (8–16) for performance.
- **HUD & Overlays:** HTML divs positioned absolutely over the canvas (\`z-index: 10, pointer-events: none\`). Update \`textContent\` each frame. Use CSS text-shadow for readability against the 3D scene.
- **Cleanup:** In \`destroy()\`, cancel the animation frame, traverse the scene to dispose all geometries and materials, dispose the renderer, remove DOM elements, and remove event listeners.

### Scoring & Progression
- Implement the scoring mechanism described in the GDD.
- Display score in the HUD overlay with visual feedback on change.
- Save high score to \`localStorage\`.
- Implement difficulty progression as described in the GDD — if not specified, gradually increase speed, density, or complexity over time.
- Provide feedback for success (emissive flash, camera zoom, overlay text) and failure (camera shake effect via small random position offsets, red screen flash overlay).

### Adaptability Guidelines
- Read the GDD carefully and prioritize implementing the **core mechanic** first.
- If the concept involves physics, implement simplified custom physics (velocity, gravity, collision response) — no external physics libraries.
- If the concept is exploration-based, focus on procedural environment generation from primitives and smooth camera controls.
- If the concept involves building or creation, implement raycasting for placement (\`raycaster.setFromCamera(mouse, camera)\` → intersection with ground plane → snap to grid).
- If the concept is simulation-based, represent system state visually with mesh colors, positions, and scales that update each frame.
- If the concept involves turn-based mechanics, implement a phase state machine and show clear visual indicators for whose turn it is and available actions.
`;
