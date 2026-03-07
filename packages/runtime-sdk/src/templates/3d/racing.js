/**
 * Sloppy SDK v2 — 3D Racing Template
 *
 * Boilerplate: track segments, simplified vehicle physics (acceleration,
 * steering, friction), lap counting, chase camera with lerp, barrier
 * collision, and all SDK v2 lifecycle methods.
 *
 * The AI fills in: track layout, visual theme, difficulty curve, opponent
 * AI, power-ups, and game-specific scoring.
 */

(function () {
  // ── Config ──────────────────────────────────────────────────────────────
  const GAME_TITLE = 'Racing Game';
  const MAX_SPEED = 30;
  const ACCELERATION = 15;
  const BRAKE_FORCE = 25;
  const FRICTION = 5;
  const STEER_SPEED = 2.5;
  const TOTAL_LAPS = 3;
  const TRACK_RADIUS = 40;
  const TRACK_WIDTH = 8;

  // ── State ───────────────────────────────────────────────────────────────
  let renderer, scene, camera, clock, animationId;
  let container, hudEl, overlayEl;
  let state = 'idle';
  let score = 0, lap = 0, timeElapsed = 0;
  let speed = 0, steerAngle = 0;
  let playerMesh, playerPos, playerDir;
  const keys = {};
  const checkpoints = [];
  let nextCheckpoint = 0;

  // Reusable vectors
  let _tmpV3, _cameraTarget, _cameraPos;

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
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.008);

    camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 500);

    // Lights
    scene.add(new THREE.AmbientLight(0x8899bb, 0.5));
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3a7d3a, 0.3));
    const sun = new THREE.DirectionalLight(0xffeedd, 1.2);
    sun.position.set(30, 50, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 150;
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    scene.add(sun);
    scene.add(sun.target);

    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0x3a7d3a, roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Circular track
    const trackShape = new THREE.RingGeometry(TRACK_RADIUS - TRACK_WIDTH / 2, TRACK_RADIUS + TRACK_WIDTH / 2, 64);
    const track = new THREE.Mesh(trackShape, new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7 }));
    track.rotation.x = -Math.PI / 2;
    track.position.y = 0.01;
    track.receiveShadow = true;
    scene.add(track);

    // Checkpoints (4 around the track)
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI * 2 * i) / 4;
      checkpoints.push({
        x: Math.cos(angle) * TRACK_RADIUS,
        z: Math.sin(angle) * TRACK_RADIUS,
        box: new THREE.Box3(),
      });
    }

    // Player car
    const carBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.5, 2.4),
      new THREE.MeshStandardMaterial({ color: 0xff3333, roughness: 0.4, metalness: 0.3 })
    );
    carBody.position.y = 0.4;
    carBody.castShadow = true;

    const carRoof = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.4, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.4, metalness: 0.3 })
    );
    carRoof.position.y = 0.45;
    carRoof.position.z = -0.2;

    playerMesh = new THREE.Group();
    playerMesh.add(carBody);
    playerMesh.add(carRoof);
    scene.add(playerMesh);

    // Init vectors
    playerPos = new THREE.Vector3(TRACK_RADIUS, 0, 0);
    playerDir = Math.PI / 2;
    _tmpV3 = new THREE.Vector3();
    _cameraTarget = new THREE.Vector3();
    _cameraPos = new THREE.Vector3();

    clock = new THREE.Clock(false);
  }

  function resetPlayer() {
    playerPos.set(TRACK_RADIUS, 0, 0);
    playerDir = Math.PI / 2;
    speed = 0;
    steerAngle = 0;
    nextCheckpoint = 0;
    lap = 0;
    score = 0;
    timeElapsed = 0;
  }

  function onKeyDown(e) { keys[e.code] = true; }
  function onKeyUp(e) { keys[e.code] = false; }

  function updateGame(dt) {
    timeElapsed += dt;

    // Acceleration / braking
    if (keys['ArrowUp'] || keys['KeyW']) speed = Math.min(MAX_SPEED, speed + ACCELERATION * dt);
    else if (keys['ArrowDown'] || keys['KeyS']) speed = Math.max(-MAX_SPEED * 0.3, speed - BRAKE_FORCE * dt);
    else speed *= (1 - FRICTION * dt / MAX_SPEED);

    if (Math.abs(speed) < 0.1) speed = 0;

    // Steering
    if (speed !== 0) {
      const steerDir = speed > 0 ? 1 : -1;
      if (keys['ArrowLeft'] || keys['KeyA']) playerDir += STEER_SPEED * dt * steerDir;
      if (keys['ArrowRight'] || keys['KeyD']) playerDir -= STEER_SPEED * dt * steerDir;
    }

    // Move
    playerPos.x += Math.cos(playerDir) * speed * dt;
    playerPos.z -= Math.sin(playerDir) * speed * dt;

    // Keep on track (soft boundary)
    const distFromCenter = Math.sqrt(playerPos.x * playerPos.x + playerPos.z * playerPos.z);
    if (distFromCenter > TRACK_RADIUS + TRACK_WIDTH / 2 + 1 || distFromCenter < TRACK_RADIUS - TRACK_WIDTH / 2 - 1) {
      speed *= 0.9;
    }

    // Update mesh
    playerMesh.position.set(playerPos.x, 0, playerPos.z);
    playerMesh.rotation.y = playerDir - Math.PI / 2;

    // Checkpoint detection
    const cp = checkpoints[nextCheckpoint];
    const dx = playerPos.x - cp.x;
    const dz = playerPos.z - cp.z;
    if (dx * dx + dz * dz < 36) {
      nextCheckpoint++;
      if (nextCheckpoint >= checkpoints.length) {
        nextCheckpoint = 0;
        lap++;
        score += 1000;
        if (lap >= TOTAL_LAPS) {
          game.renderGameOverScreen(game.getScore());
          return;
        }
      }
    }

    // Chase camera
    const camDist = 6;
    const camHeight = 3;
    _cameraTarget.set(
      playerPos.x - Math.cos(playerDir) * camDist,
      camHeight,
      playerPos.z + Math.sin(playerDir) * camDist
    );
    camera.position.lerp(_cameraTarget, 0.08);
    _tmpV3.set(playerPos.x, 1, playerPos.z);
    camera.lookAt(_tmpV3);
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
      genre: '3d-racing',
      engine: 'threejs',
      supportsMultiplayer: false,
      controls: [
        { key: 'Up / W', action: 'Accelerate' },
        { key: 'Down / S', action: 'Brake' },
        { key: 'Left / A', action: 'Steer Left' },
        { key: 'Right / D', action: 'Steer Right' },
      ],
      estimatedPlayTime: '2-4 min',
    },

    supportsMultiplayer: false,

    async init(el, config) {
      container = el;
      container.style.position = 'relative';
      buildScene(config.width, config.height);
      createHUD();

      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('keyup', onKeyUp);

      window.parent.postMessage({ type: 'sloppy:game:ready' }, '*');
    },

    destroy() {
      cancelAnimationFrame(animationId);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
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
      resetPlayer();
      for (const k in keys) keys[k] = false;
      state = 'playing';
      hudEl.style.display = '';
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

    restart() {
      hideOverlay();
      game.start();
    },

    renderIntroScreen() {
      state = 'intro';
      hudEl.style.display = 'none';
      const ol = createOverlay();
      ol.innerHTML = `
        <div style="font-size:42px;font-weight:bold;color:#ffcc00;margin-bottom:12px;">${GAME_TITLE}</div>
        <div style="font-size:18px;margin-bottom:8px;">Arrow Keys or WASD to drive</div>
        <div style="font-size:18px;margin-bottom:8px;">Complete ${TOTAL_LAPS} laps!</div>
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
      const best = Math.min(result.timeElapsed, parseInt(localStorage.getItem('race_best') || '99999'));
      localStorage.setItem('race_best', String(best));
      const ol = createOverlay();
      ol.innerHTML = `
        <div style="font-size:40px;font-weight:bold;color:#ffcc00;margin-bottom:12px;">RACE COMPLETE!</div>
        <div style="font-size:24px;margin-bottom:8px;">Time: ${result.timeElapsed}s</div>
        <div style="font-size:18px;opacity:0.7;margin-bottom:8px;">Best: ${best}s</div>
        <div style="font-size:20px;cursor:pointer;margin-top:16px;animation:pulse 1.5s ease-in-out infinite;" id="restart-btn">Click to Race Again</div>
        <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}</style>
      `;
      ol.querySelector('#restart-btn').addEventListener('click', () => game.restart(), { once: true });
    },

    renderHUD() {
      if (hudEl) {
        const speedPct = Math.round((Math.abs(speed) / MAX_SPEED) * 100);
        hudEl.innerHTML = `
          <div>Lap: ${lap + 1}/${TOTAL_LAPS}</div>
          <div>Time: ${Math.floor(timeElapsed)}s</div>
          <div>Speed: ${speedPct}%</div>
        `;
      }
    },

    getState() { return state; },

    getScore() {
      return { score, level: lap + 1, timeElapsed: Math.floor(timeElapsed) };
    },
  };

  window.SloppyGame = game;
  window.game = game;
})();
