export const PUZZLE_3D_PROMPT = `## Genre: 3D Puzzle (Three.js)

### Core Mechanics
- **Camera Orbit:** Implement orbit-style camera: track mouse drag to rotate camera around a center point. Store spherical coordinates (theta, phi, radius). Convert to Cartesian for camera position. Scroll wheel adjusts radius (zoom). \`camera.lookAt(centerPoint)\` each frame.
- **Object Interaction:** Raycasting for selection: \`raycaster.setFromCamera(mouse, camera)\`, test against interactive objects. Highlight selected object (change emissive color or scale tween). Click to pick up, click again to place. Drag-to-move: project mouse ray onto a plane at the object's Y level.
- **Spatial Puzzles:** Common patterns:
  - **Alignment:** Rotate objects to form a complete shape/pattern. Track rotation state discretely (0°, 90°, 180°, 270°).
  - **Stacking/Sorting:** Move objects between positions. Validate final arrangement against a target configuration.
  - **Path Finding:** Player must configure the environment (bridges, platforms, switches) to create a path.
  - **Light/Color Mixing:** Direct beams or match colors by combining objects.
- **Snap-to-Position:** Define valid placement positions as an array of Vector3. On drop, snap to nearest valid position within a threshold distance.
- **Completion Detection:** Compare current state array against the goal state. Trigger win sequence (particle burst, camera zoom out, congratulatory overlay) on match.

### Object Archetypes
- **Puzzle Pieces:** Distinct geometric shapes (boxes, spheres, cylinders, torus) with unique colors. \`castShadow = true\`. Interactive — highlight on hover.
- **Slots/Targets:** Semi-transparent meshes or wireframe outlines showing where pieces should go. Use \`MeshStandardMaterial({ wireframe: true })\` or low-opacity material.
- **Environment:** Platform or table surface (\`receiveShadow\`). Subtle background elements for atmosphere (distant shapes, gradient fog).
- **Indicators:** Visual feedback for correct placement (color change to green, particle burst) and incorrect (brief red flash, camera shake).
- **UI Overlay:** Move counter, timer, hint button (HTML overlay).

### Scoring Patterns
- Fewest moves: track total interactions, compare against par for each level.
- Time to completion: faster = higher score.
- Hint penalty: deduct points each time a hint is used.
- Star rating: 3 stars for perfect (par moves + no hints), scale down from there.

### Difficulty Progression
- Increase number of puzzle pieces.
- Introduce rotation as an additional degree of freedom.
- Add distractor pieces that are not part of the solution.
- Multi-step puzzles: solving one sub-puzzle unlocks the next.
- Constrain moves (limited number of allowed interactions).
`;
