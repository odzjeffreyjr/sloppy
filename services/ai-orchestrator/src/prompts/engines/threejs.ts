export const THREEJS_CDN_URL = 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.min.js';

export const THREEJS_RESOLUTION = { width: 1280, height: 720 };

export const THREEJS_SYSTEM_PROMPT = `## Three.js Engine — Code Generation Guide

You are generating a self-contained HTML file that uses **Three.js** loaded via CDN.

### CDN Import
\`\`\`html
<script src="${THREEJS_CDN_URL}"></script>
\`\`\`

### Standard Resolution
${THREEJS_RESOLUTION.width}×${THREEJS_RESOLUTION.height} (16:9). Set the renderer size to these dimensions, scaling to fill the container via CSS.

### Three.js Scene Architecture
Structure the game around a single Three.js scene with logical module sections:

1. **Renderer & Camera Setup** — WebGLRenderer, PerspectiveCamera, resize handling.
2. **Scene Graph** — THREE.Scene with all game objects, lights, fog.
3. **Game State Machine** — Manages idle/intro/playing/paused/gameover transitions.
4. **HUD Overlay** — HTML/CSS overlay for score, lives, timer (on top of the WebGL canvas).
5. **Screen Renderers** — Intro, Pause, GameOver screens using HTML overlays or 3D text in the scene.
6. **Input Handler** — Keyboard/mouse event listeners, input state tracking.
7. **Game Loop** — requestAnimationFrame-based loop with delta time.

### Mapping SDK v2 Lifecycle to Three.js

\`\`\`
init(container, config) →
  Create THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(config.width, config.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  Create THREE.PerspectiveCamera(60, config.width / config.height, 0.1, 1000);
  Create THREE.Scene();
  scene.fog = new THREE.FogExp2(fogColor, density);

  Add lights: AmbientLight + DirectionalLight (with shadow).
  Build all game meshes and add to scene.
  Set internal state to 'idle'.

  Post: window.parent.postMessage({ type: 'sloppy:game:ready' }, '*');

destroy() →
  cancelAnimationFrame(animationId);
  Traverse scene and dispose geometries + materials:
    scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
  renderer.dispose();
  Remove renderer.domElement from container.
  Remove event listeners.
  Remove HUD overlay elements.

start() →
  Reset game objects to initial positions.
  Hide intro overlay, show HUD.
  Set state to 'playing'.
  Begin animation loop if not already running.

pause() →
  Set state to 'paused'.
  Show pause overlay.
  The animation loop should check state and skip game logic updates when paused
  (but can still render to keep the scene visible behind the overlay).

resume() →
  Hide pause overlay.
  Set state to 'playing'.
  Reset delta-time clock to avoid a large time jump.

restart() →
  Reset score, level, timer, all game object positions/states.
  Hide gameover/pause overlays, show HUD.
  Set state to 'playing'.

renderIntroScreen() →
  Show an HTML overlay with game title, controls, and "Click to Start" prompt.
  Set state to 'intro'.

renderPauseScreen() →
  Show an HTML overlay with "PAUSED" text and "Click to Resume" prompt.

renderGameOverScreen(score) →
  Show an HTML overlay with "GAME OVER", final score, and "Click to Restart" prompt.
  Set state to 'gameover'.

getState() → return the internal state string ('idle'|'intro'|'playing'|'paused'|'gameover')

getScore() → return { score: currentScore, level: currentLevel, timeElapsed: elapsedSeconds }
\`\`\`

### Three.js API Essentials

**Geometries (built-in — no external models):**
- \`new THREE.BoxGeometry(w, h, d)\`
- \`new THREE.SphereGeometry(radius, widthSeg, heightSeg)\`
- \`new THREE.CylinderGeometry(radiusTop, radiusBot, height, segments)\`
- \`new THREE.PlaneGeometry(w, h)\`
- \`new THREE.ConeGeometry(radius, height, segments)\`
- \`new THREE.TorusGeometry(radius, tube, radialSeg, tubularSeg)\`

**Materials (always use Standard or Phong — never Basic):**
- \`new THREE.MeshStandardMaterial({ color, roughness, metalness })\`
- \`new THREE.MeshPhongMaterial({ color, shininess })\`
- For emissive/glowing: \`{ emissive: color, emissiveIntensity: n }\`

**Lighting:**
- \`new THREE.AmbientLight(color, intensity)\` — base illumination
- \`new THREE.DirectionalLight(color, intensity)\` — sun-like, cast shadows
  - \`light.castShadow = true\`
  - \`light.shadow.mapSize.set(1024, 1024)\`
- \`new THREE.PointLight(color, intensity, distance)\` — local light source

**Shadows:**
- \`renderer.shadowMap.enabled = true\`
- \`mesh.castShadow = true\`, \`mesh.receiveShadow = true\`
- Ground plane: \`receiveShadow = true\`

**Camera:**
- \`camera.position.set(x, y, z)\`
- \`camera.lookAt(target)\`
- Smooth follow: \`camera.position.lerp(targetPos, smoothFactor)\`

**Animation Loop:**
\`\`\`js
const clock = new THREE.Clock();
function animate() {
  animationId = requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (state === 'playing') {
    updateGameLogic(delta);
  }
  renderer.render(scene, camera);
}
\`\`\`

**Collision Detection (simple, no physics library):**
- \`new THREE.Box3().setFromObject(mesh)\`
- \`box1.intersectsBox(box2)\`
- \`new THREE.Sphere(center, radius)\` + \`sphere.intersectsSphere(other)\`

**Object Management:**
- \`scene.add(mesh)\`, \`scene.remove(mesh)\`
- Object pools: pre-create meshes, toggle \`mesh.visible\` instead of add/remove.
- \`mesh.position.set(x, y, z)\`, \`mesh.rotation.set(rx, ry, rz)\`, \`mesh.scale.set(sx, sy, sz)\`

### HUD & Screen Overlays
For HUD and screen overlays, use HTML elements positioned absolutely over the canvas:
\`\`\`js
const hud = document.createElement('div');
hud.style.cssText = 'position:absolute;top:0;left:0;width:100%;pointer-events:none;color:#fff;font-family:Arial,sans-serif;padding:10px;z-index:10;';
container.style.position = 'relative';
container.appendChild(hud);
\`\`\`
`;

export const THREEJS_QUALITY_RULES = `### Three.js Quality Rules
- ALWAYS enable shadows: \`renderer.shadowMap.enabled = true\` with \`THREE.PCFSoftShadowMap\`.
- ALWAYS use ACES Filmic tone mapping: \`renderer.toneMapping = THREE.ACESFilmicToneMapping\`.
- ALWAYS use \`MeshStandardMaterial\` or \`MeshPhongMaterial\` — NEVER use \`MeshBasicMaterial\` (it ignores lighting and looks flat).
- ALWAYS add fog for depth perception: \`scene.fog = new THREE.FogExp2(color, density)\`.
- Camera smoothing: use \`camera.position.lerp(target, factor)\` — never snap the camera.
- Limit triangle count: max 10,000 triangles total. Use low-poly geometries (8-16 segments for spheres/cylinders).
- Pre-create all meshes in init/setup. Toggle \`mesh.visible\` for pooling — never create/destroy meshes during gameplay.
- Use \`THREE.Clock\` for consistent delta time, not \`Date.now()\` arithmetic.
- Dispose ALL geometries and materials in \`destroy()\` — Three.js does not garbage-collect GPU resources.
- Set \`renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))\` to cap retina rendering.
- Add at least one directional light with shadows and one ambient light for base illumination.
- Ground/floor plane should always have \`receiveShadow = true\`.
- Game objects that matter visually should have \`castShadow = true\`.
- Use emissive materials for glowing effects (pickups, power-ups, UI highlights).
`;

export const THREEJS_FORBIDDEN_PATTERNS = `### Three.js Forbidden Patterns
- NEVER create new THREE.* objects (geometries, materials, meshes, vectors) inside the game loop / update function — this causes massive GC pressure and frame drops.
- NEVER use \`MeshBasicMaterial\` — it ignores all lighting and makes the scene look flat and unlit.
- NEVER load external 3D models (\`GLTFLoader\`, \`OBJLoader\`, etc.) — no model files exist. Build all objects from primitive geometries.
- NEVER load external textures (\`TextureLoader\`) — no texture files exist. Use material colors and procedural patterns.
- NEVER forget to dispose geometries and materials in \`destroy()\` — GPU memory leaks crash the tab.
- NEVER use \`new THREE.Vector3()\` or \`new THREE.Box3()\` inside the game loop — pre-allocate reusable instances.
- NEVER skip the \`cancelAnimationFrame()\` call in \`destroy()\` — the loop will keep running on a dead scene.
- NEVER set camera position without \`lerp\` during gameplay — it causes jarring visual jumps.
`;
