export const RACING_3D_PROMPT = `## Genre: 3D Racing (Three.js)

### Core Mechanics
- **Track Generation:** Build the track from a series of straight and curved segments using \`THREE.BoxGeometry\` or extruded shapes. Each segment is a mesh added to the scene. Store track as an array of segment objects with position, rotation, and width. Walls/barriers on both sides as thin box meshes.
- **Vehicle Physics (simplified):** Represent the vehicle as a group of box/cylinder meshes. Track velocity, steering angle, and acceleration as numeric state. Update per frame:
  \`\`\`
  speed += (accelerating ? accel : -friction) * delta;
  speed = clamp(speed, 0, maxSpeed);
  rotation.y += steerInput * turnRate * speed/maxSpeed * delta;
  position.x += Math.sin(rotation.y) * speed * delta;
  position.z += Math.cos(rotation.y) * speed * delta;
  \`\`\`
- **Lap Counting:** Place invisible checkpoint zones (Box3) along the track. Player must cross checkpoints in order. Crossing the start/finish after all checkpoints = 1 lap. Display current lap and total laps in HUD.
- **Camera Follow:** Position camera behind and above the vehicle. Smooth follow using \`camera.position.lerp(targetBehindCar, 0.05)\`. Camera looks at car position: \`camera.lookAt(vehicle.position)\`.
- **Collision with Barriers:** Use \`Box3.setFromObject()\` on the vehicle and each barrier. On intersection, bounce the vehicle inward and reduce speed.

### Object Archetypes
- **Vehicle:** Group of 3–5 box/cylinder meshes (body, wheels, spoiler). Distinct color. \`castShadow = true\`.
- **Track Segments:** Wide flat boxes for road surface (\`receiveShadow = true\`). Colored lane markings via separate thin geometry or material tricks.
- **Barriers/Walls:** Tall thin boxes along track edges. Different color from road.
- **Checkpoints:** Invisible Box3 volumes. Optional visible arch (two cylinders + connecting box) as visual marker.
- **Pickups (optional):** Speed boost items on the track. Sphere or torus geometry with emissive material and slow rotation.

### Scoring Patterns
- Time-based: total race time, best lap time.
- Position-based (if AI opponents): 1st = max points, diminishing per position.
- Track collectible pickups for bonus score.
- Penalty time for barrier collisions.

### Difficulty Progression
- Tighter turns and narrower track on later laps or levels.
- Increase number of laps required.
- Add dynamic obstacles (barriers that move, track sections that shift).
- Introduce AI opponents with increasing competence.
`;
