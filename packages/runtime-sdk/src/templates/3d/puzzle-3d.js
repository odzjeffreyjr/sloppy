/**
 * Sloppy SDK v2 — 3D Puzzle Template
 *
 * Boilerplate: orbit camera (spherical coords), object interaction via
 * raycasting, click/drag mechanics, spatial puzzle structure, snap-to
 * positions, completion detection, and all SDK v2 lifecycle methods.
 *
 * The AI fills in: specific puzzle mechanics (alignment, stacking, color
 * matching, path finding), object types, visual theme, level progression.
 */

(function () {
  // ── Config ──────────────────────────────────────────────────────────────
  const GAME_TITLE = '3D Puzzle';
  const ORBIT_SPEED = 0.005;
  const ZOOM_SPEED = 0.5;
  const MIN_DIST = 5;
  const MAX_DIST = 25;

  // ── State ───────────────────────────────────────────────────────────────
  let renderer, scene, camera, clock, animationId;
  let container, hudEl, overlayEl;
  let state = 'idle';
  let score = 0, level = 1, moves = 0, timeElapsed = 0;

  // Orbit camera
  let orbitTheta = Math.PI / 4;
  let orbitPhi = Math.PI / 3;
  let orbitDist = 12;
  let orbitTarget = null;
  let isDragging = false;
  let lastMouseX = 0, lastMouseY = 0;

  // Puzzle objects
  const puzzlePieces = [];
  const goalPositions = [];
  let selectedPiece = null;
  let raycaster, mouse;

  // ── Helpers ─────────────────────────────────────────────────────────────

  function createOverlay() {
    overlayEl = document.createElement('div');
    overlayEl.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);color:#fff;font-family:Arial,sans-serif;z-index:100;user-select:none;';
    container.appendChild(overlayEl);
    return overlayEl;
  }

  function hideOverlay() {
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
  }

  function createHUD() {
    hudEl = document.createElement('div');
    hudEl.style.cssText = 'position:absolute;top:0;left:0;width:100%;padding:12px;color:#fff;font-family:Arial,sans-serif;font-size:18px;pointer-events:none;z-index:10;display:flex;justify-content:space-between;';
    container.appendChild(hudEl);
  }

  function buildScene(w, h) {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a2a3a);
    scene.fog = new THREE.FogExp2(0x1a2a3a, 0.015);

    camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200);
    orbitTarget = new THREE.Vector3(0, 0, 0);

    // Lighting
    scene.add(new THREE.AmbientLight(0x667788, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(8, 12, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    scene.add(key);
    scene.add(key.target);
    scene.add(new THREE.PointLight(0x4488ff, 0.4, 30));

    // Ground platform
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(6, 6, 0.3, 32),
      new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 0.6, metalness: 0.2 })
    );
    platform.position.y = -0.15;
    platform.receiveShadow = true;
    scene.add(platform);

    // Goal positions (visual indicators)
    const goalGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 16);
    const goalMat = new THREE.MeshStandardMaterial({
      color: 0x44ff44, emissive: 0x22aa22, emissiveIntensity: 0.3, transparent: true, opacity: 0.5,
    });

    // Create puzzle pieces and goals (4 pieces for template)
    const colors = [0xff4444, 0x44aaff, 0xffaa00, 0x44ff44];
    const positions = [
      { x: -2, z: -2 }, { x: 2, z: -2 }, { x: -2, z: 2 }, { x: 2, z: 2 },
    ];
    const scrambled = [
      { x: 2, z: -2 }, { x: -2, z: 2 }, { x: 2, z: 2 }, { x: -2, z: -2 },
    ];

    for (let i = 0; i < 4; i++) {
      // Goal marker
      const gm = new THREE.Mesh(goalGeo, goalMat.clone());
      gm.position.set(positions[i].x, 0.03, positions[i].z);
      scene.add(gm);
      goalPositions.push(new THREE.Vector3(positions[i].x, 0.5, positions[i].z));

      // Puzzle piece
      const piece = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.9, 0.9),
        new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.4, metalness: 0.2 })
      );
      piece.position.set(scrambled[i].x, 0.5, scrambled[i].z);
      piece.castShadow = true;
      piece.userData.goalIndex = i;
      piece.userData.originalColor = colors[i];
      scene.add(piece);
      puzzlePieces.push(piece);
    }

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    clock = new THREE.Clock(false);
  }

  function updateOrbitCamera() {
    orbitPhi = Math.max(0.2, Math.min(Math.PI / 2 - 0.05, orbitPhi));
    orbitDist = Math.max(MIN_DIST, Math.min(MAX_DIST, orbitDist));
    camera.position.x = orbitTarget.x + orbitDist * Math.sin(orbitPhi) * Math.cos(orbitTheta);
    camera.position.y = orbitTarget.y + orbitDist * Math.cos(orbitPhi);
    camera.position.z = orbitTarget.z + orbitDist * Math.sin(orbitPhi) * Math.sin(orbitTheta);
    camera.lookAt(orbitTarget);
  }

  function checkCompletion() {
    let solved = 0;
    for (const piece of puzzlePieces) {
      const goal = goalPositions[piece.userData.goalIndex];
      const dx = piece.position.x - goal.x;
      const dz = piece.position.z - goal.z;
      if (dx * dx + dz * dz < 0.5) solved++;
    }
    return solved === puzzlePieces.length;
  }

  function snapToNearest(piece) {
    // Snap to grid positions: -2, 0, 2 on each axis
    const gridSize = 2;
    piece.position.x = Math.round(piece.position.x / gridSize) * gridSize;
    piece.position.z = Math.round(piece.position.z / gridSize) * gridSize;
    piece.position.y = 0.5;
  }

  // ── Input Handlers ─────────────────────────────────────────────────────

  function onMouseDown(e) {
    if (state !== 'playing') return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(puzzlePieces);
    if (hits.length > 0) {
      selectedPiece = hits[0].object;
      selectedPiece.material.emissive.setHex(0xffff00);
      selectedPiece.material.emissiveIntensity = 0.3;
    } else {
      isDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    }
  }

  function onMouseMove(e) {
    if (state !== 'playing') return;
    if (isDragging) {
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      orbitTheta -= dx * ORBIT_SPEED;
      orbitPhi += dy * ORBIT_SPEED;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    }
  }

  function onMouseUp(e) {
    isDragging = false;
    if (selectedPiece) {
      selectedPiece.material.emissive.setHex(0x000000);
      selectedPiece.material.emissiveIntensity = 0;
      selectedPiece = null;
    }
  }

  function onKeyDown(e) {
    if (state !== 'playing' || !selectedPiece) return;
    const step = 2;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { selectedPiece.position.x -= step; moves++; }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { selectedPiece.position.x += step; moves++; }
    if (e.code === 'ArrowUp' || e.code === 'KeyW') { selectedPiece.position.z -= step; moves++; }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') { selectedPiece.position.z += step; moves++; }
    snapToNearest(selectedPiece);

    if (checkCompletion()) {
      score += Math.max(100, 1000 - moves * 10);
      game.renderGameOverScreen(game.getScore());
    }
  }

  function onWheel(e) {
    if (state !== 'playing') return;
    orbitDist += e.deltaY > 0 ? ZOOM_SPEED : -ZOOM_SPEED;
  }

  function updateGame(dt) {
    timeElapsed += dt;
    updateOrbitCamera();

    // Gentle piece bob for visual feedback
    for (const piece of puzzlePieces) {
      piece.rotation.y += dt * 0.3;
    }
  }

  function animate() {
    animationId = requestAnimationFrame(animate);
    const dt = clock.getDelta();
    if (state === 'playing') {
      updateGame(dt);
      game.renderHUD();
    }
    renderer.render(scene, camera);
  }

  // ── SDK v2 Game Object ──────────────────────────────────────────────────

  const game = {
    metadata: {
      title: GAME_TITLE,
      genre: '3d-puzzle',
      engine: 'threejs',
      supportsMultiplayer: false,
      controls: [
        { key: 'Click', action: 'Select Piece' },
        { key: 'Arrow Keys', action: 'Move Piece' },
        { key: 'Drag', action: 'Orbit Camera' },
        { key: 'Scroll', action: 'Zoom' },
      ],
      estimatedPlayTime: '3-10 min',
    },

    supportsMultiplayer: false,

    async init(el, config) {
      container = el;
      container.style.position = 'relative';
      buildScene(config.width, config.height);
      createHUD();

      renderer.domElement.addEventListener('mousedown', onMouseDown);
      renderer.domElement.addEventListener('mousemove', onMouseMove);
      renderer.domElement.addEventListener('mouseup', onMouseUp);
      renderer.domElement.addEventListener('wheel', onWheel);
      document.addEventListener('keydown', onKeyDown);

      window.parent.postMessage({ type: 'sloppy:game:ready' }, '*');
    },

    destroy() {
      cancelAnimationFrame(animationId);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      document.removeEventListener('keydown', onKeyDown);
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      if (hudEl) hudEl.remove();
      hideOverlay();
    },

    start() {
      hideOverlay();
      score = 0; moves = 0; timeElapsed = 0; level = 1;
      // Rescramble pieces
      const scrambled = [
        { x: 2, z: -2 }, { x: -2, z: 2 }, { x: 2, z: 2 }, { x: -2, z: -2 },
      ];
      for (let i = 0; i < puzzlePieces.length; i++) {
        puzzlePieces[i].position.set(scrambled[i].x, 0.5, scrambled[i].z);
      }
      selectedPiece = null;
      state = 'playing';
      hudEl.style.display = '';
      updateOrbitCamera();
      clock.start();
      if (!animationId) animate();
    },

    pause() {
      state = 'paused';
      game.renderPauseScreen();
    },

    resume() {
      hideOverlay();
      state = 'playing';
      clock.getDelta();
    },

    restart() { hideOverlay(); game.start(); },

    renderIntroScreen() {
      state = 'intro';
      hudEl.style.display = 'none';
      updateOrbitCamera();
      const ol = createOverlay();
      ol.innerHTML = `
        <div style="font-size:42px;font-weight:bold;color:#ffcc00;margin-bottom:12px;">${GAME_TITLE}</div>
        <div style="font-size:18px;margin-bottom:8px;">Click a piece, then use arrow keys to move it</div>
        <div style="font-size:18px;margin-bottom:8px;">Drag to orbit • Scroll to zoom</div>
        <div style="font-size:20px;margin-top:20px;cursor:pointer;animation:pulse 1.5s ease-in-out infinite;" id="start-btn">Click to Start</div>
        <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}</style>
      `;
      ol.querySelector('#start-btn').addEventListener('click', () => game.start(), { once: true });
      animate();
    },

    renderPauseScreen() {
      const ol = createOverlay();
      ol.innerHTML = `
        <div style="font-size:36px;font-weight:bold;margin-bottom:16px;">PAUSED</div>
        <div style="font-size:20px;cursor:pointer;animation:pulse 1.5s ease-in-out infinite;" id="resume-btn">Click to Resume</div>
        <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}</style>
      `;
      ol.querySelector('#resume-btn').addEventListener('click', () => game.resume(), { once: true });
    },

    renderGameOverScreen(result) {
      state = 'gameover';
      hudEl.style.display = 'none';
      const ol = createOverlay();
      ol.innerHTML = `
        <div style="font-size:40px;font-weight:bold;color:#44ff44;margin-bottom:12px;">PUZZLE SOLVED!</div>
        <div style="font-size:24px;margin-bottom:8px;">Score: ${result.score}</div>
        <div style="font-size:18px;opacity:0.7;margin-bottom:8px;">Moves: ${moves} • Time: ${result.timeElapsed}s</div>
        <div style="font-size:20px;cursor:pointer;margin-top:16px;animation:pulse 1.5s ease-in-out infinite;" id="restart-btn">Click to Play Again</div>
        <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}</style>
      `;
      ol.querySelector('#restart-btn').addEventListener('click', () => game.restart(), { once: true });
    },

    renderHUD() {
      if (hudEl) {
        hudEl.innerHTML = `
          <div>Moves: ${moves}</div>
          <div>Time: ${Math.floor(timeElapsed)}s</div>
          <div>Level: ${level}</div>
        `;
      }
    },

    getState() { return state; },

    getScore() {
      return { score, level, timeElapsed: Math.floor(timeElapsed) };
    },
  };

  window.SloppyGame = game;
  window.game = game;
})();
