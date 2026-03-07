/**
 * Sloppy SDK v2 — 3D Endless Runner Template
 *
 * Boilerplate: procedural track segments (ring buffer), auto-forward motion,
 * 3-lane switching with lerp, obstacle spawning, speed ramp, and all SDK v2
 * lifecycle methods.
 *
 * The AI fills in: visual theme, obstacle types, collectibles, power-ups,
 * scoring, difficulty curve, and jump/slide mechanics.
 */

(function () {
  // ── Config ──────────────────────────────────────────────────────────────
  const GAME_TITLE = 'Endless Runner';
  const LANE_WIDTH = 2.5;
  const LANES = [-LANE_WIDTH, 0, LANE_WIDTH];
  const SEGMENT_LENGTH = 20;
  const SEGMENT_COUNT = 8;
  const BASE_SPEED = 10;
  const SPEED_INCREASE = 0.3;
  const MAX_OBSTACLES_PER_SEGMENT = 3;
  const JUMP_VELOCITY = 12;
  const GRAVITY = 30;

  // ── State ───────────────────────────────────────────────────────────────
  let renderer, scene, camera, clock, animationId;
  let container, hudEl, overlayEl;
  let state = 'idle';
  let score = 0, timeElapsed = 0, distanceTraveled = 0;
  let currentLane = 1; // index into LANES
  let targetX = 0, playerY = 0, velocityY = 0, isJumping = false;
  let speed = BASE_SPEED;
  let playerMesh;
  const keys = {};
  const segments = [];
  const obstacles = [];
  const MAX_OBSTACLES = SEGMENT_COUNT * MAX_OBSTACLES_PER_SEGMENT;

  // Reusable
  let _playerBox, _obstacleBox;

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
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a0a2e);
    scene.fog = new THREE.FogExp2(0x1a0a2e, 0.012);

    camera = new THREE.PerspectiveCamera(65, w / h, 0.1, 300);
    camera.position.set(0, 4, 8);
    camera.lookAt(0, 0, -10);

    scene.add(new THREE.AmbientLight(0x6644aa, 0.5));
    const sun = new THREE.DirectionalLight(0xeeddff, 1.0);
    sun.position.set(5, 15, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    scene.add(sun.target);

    // Track segments (ring buffer)
    const segGeo = new THREE.PlaneGeometry(LANE_WIDTH * 3 + 2, SEGMENT_LENGTH);
    const segMat = new THREE.MeshStandardMaterial({ color: 0x333355, roughness: 0.8 });
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const mesh = new THREE.Mesh(segGeo, segMat.clone());
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.z = -i * SEGMENT_LENGTH;
      mesh.receiveShadow = true;
      scene.add(mesh);
      segments.push({ mesh, zOffset: -i * SEGMENT_LENGTH });
    }

    // Obstacle pool
    const obsGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    const obsMat = new THREE.MeshStandardMaterial({ color: 0xff4444, roughness: 0.5 });
    for (let i = 0; i < MAX_OBSTACLES; i++) {
      const mesh = new THREE.Mesh(obsGeo, obsMat.clone());
      mesh.castShadow = true;
      mesh.visible = false;
      scene.add(mesh);
      obstacles.push({ mesh, active: false, lane: 0, z: 0 });
    }

    // Player
    playerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1.4, 1),
      new THREE.MeshStandardMaterial({ color: 0x44aaff, roughness: 0.3, metalness: 0.4 })
    );
    playerMesh.castShadow = true;
    playerMesh.position.set(0, 0.7, 0);
    scene.add(playerMesh);

    _playerBox = new THREE.Box3();
    _obstacleBox = new THREE.Box3();
    clock = new THREE.Clock(false);
  }

  function spawnObstaclesForSegment(segZ) {
    const count = 1 + Math.floor(Math.random() * MAX_OBSTACLES_PER_SEGMENT);
    const usedLanes = new Set();
    for (let i = 0; i < count; i++) {
      const obs = obstacles.find(o => !o.active);
      if (!obs) break;
      let lane;
      do { lane = Math.floor(Math.random() * 3); } while (usedLanes.has(lane) && usedLanes.size < 2);
      usedLanes.add(lane);
      obs.lane = lane;
      obs.z = segZ - Math.random() * SEGMENT_LENGTH;
      obs.mesh.position.set(LANES[lane], 0.6, obs.z);
      obs.mesh.visible = true;
      obs.active = true;
    }
  }

  function resetGame() {
    score = 0; timeElapsed = 0; distanceTraveled = 0;
    speed = BASE_SPEED;
    currentLane = 1; targetX = LANES[1]; playerY = 0; velocityY = 0; isJumping = false;
    playerMesh.position.set(LANES[1], 0.7, 0);

    // Reset segments
    for (let i = 0; i < segments.length; i++) {
      segments[i].zOffset = -i * SEGMENT_LENGTH;
      segments[i].mesh.position.z = segments[i].zOffset;
    }

    // Deactivate obstacles
    obstacles.forEach(o => { o.active = false; o.mesh.visible = false; });

    // Spawn initial obstacles
    for (let i = 2; i < SEGMENT_COUNT; i++) {
      spawnObstaclesForSegment(segments[i].zOffset);
    }
  }

  function onKeyDown(e) {
    keys[e.code] = true;
    if (state !== 'playing') return;
    if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && currentLane > 0) {
      currentLane--;
      targetX = LANES[currentLane];
    }
    if ((e.code === 'ArrowRight' || e.code === 'KeyD') && currentLane < 2) {
      currentLane++;
      targetX = LANES[currentLane];
    }
    if ((e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') && !isJumping) {
      isJumping = true;
      velocityY = JUMP_VELOCITY;
    }
  }
  function onKeyUp(e) { keys[e.code] = false; }

  function updateGame(dt) {
    timeElapsed += dt;
    const advance = speed * dt;
    distanceTraveled += advance;
    score = Math.floor(distanceTraveled);

    // Speed ramp
    speed = BASE_SPEED + distanceTraveled * SPEED_INCREASE / 100;

    // Lane switch with lerp
    playerMesh.position.x += (targetX - playerMesh.position.x) * 0.15;

    // Jump
    if (isJumping) {
      velocityY -= GRAVITY * dt;
      playerY += velocityY * dt;
      if (playerY <= 0) { playerY = 0; velocityY = 0; isJumping = false; }
    }
    playerMesh.position.y = 0.7 + playerY;

    // Move world toward player (player stays at z=0)
    for (const seg of segments) {
      seg.mesh.position.z += advance;
      if (seg.mesh.position.z > SEGMENT_LENGTH) {
        seg.mesh.position.z -= SEGMENT_COUNT * SEGMENT_LENGTH;
        seg.zOffset = seg.mesh.position.z;
        // Recycle obstacles for this segment
        const segZ = seg.mesh.position.z;
        obstacles.forEach(o => {
          if (o.active && o.z > segZ + SEGMENT_LENGTH) {
            o.active = false; o.mesh.visible = false;
          }
        });
        spawnObstaclesForSegment(segZ);
      }
    }

    // Move obstacles
    for (const obs of obstacles) {
      if (!obs.active) continue;
      obs.mesh.position.z += advance;
      if (obs.mesh.position.z > 10) {
        obs.active = false;
        obs.mesh.visible = false;
        continue;
      }
    }

    // Collision
    _playerBox.setFromObject(playerMesh);
    for (const obs of obstacles) {
      if (!obs.active) continue;
      _obstacleBox.setFromObject(obs.mesh);
      if (_playerBox.intersectsBox(_obstacleBox)) {
        game.renderGameOverScreen(game.getScore());
        return;
      }
    }

    // Camera follow
    camera.position.x += (playerMesh.position.x * 0.3 - camera.position.x) * 0.05;
  }

  function animate() {
    animationId = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
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
      genre: '3d-thirdperson',
      engine: 'threejs',
      supportsMultiplayer: false,
      controls: [
        { key: 'Left / A', action: 'Move Left' },
        { key: 'Right / D', action: 'Move Right' },
        { key: 'Up / W / Space', action: 'Jump' },
      ],
      estimatedPlayTime: '2-5 min',
    },

    supportsMultiplayer: false,

    async init(el, config) {
      container = el;
      container.style.position = 'relative';
      buildScene(config.width, config.height);
      createHUD();

      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('keyup', onKeyUp);

      // Touch controls
      let touchStartX = 0;
      renderer.domElement.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
      });
      renderer.domElement.addEventListener('touchend', (e) => {
        if (state !== 'playing') return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) > 30) {
          if (dx < 0 && currentLane > 0) { currentLane--; targetX = LANES[currentLane]; }
          if (dx > 0 && currentLane < 2) { currentLane++; targetX = LANES[currentLane]; }
        } else if (!isJumping) {
          isJumping = true;
          velocityY = JUMP_VELOCITY;
        }
      });

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
      resetGame();
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

    restart() { hideOverlay(); game.start(); },

    renderIntroScreen() {
      state = 'intro';
      hudEl.style.display = 'none';
      const ol = createOverlay();
      ol.innerHTML = `
        <div style="font-size:42px;font-weight:bold;color:#ffcc00;margin-bottom:12px;">${GAME_TITLE}</div>
        <div style="font-size:18px;margin-bottom:8px;">← → to switch lanes &nbsp;|&nbsp; ↑ or Space to jump</div>
        <div style="font-size:16px;margin-bottom:8px;">Swipe on mobile</div>
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
      const best = Math.max(result.score, parseInt(localStorage.getItem('runner_best') || '0'));
      localStorage.setItem('runner_best', String(best));
      const isNew = result.score >= best && result.score > 0;
      const ol = createOverlay();
      ol.innerHTML = `
        <div style="font-size:40px;font-weight:bold;color:#ff4444;margin-bottom:12px;">GAME OVER</div>
        <div style="font-size:24px;margin-bottom:8px;">Distance: ${result.score}m</div>
        ${isNew ? '<div style="font-size:20px;color:#ffcc00;margin-bottom:8px;">NEW RECORD!</div>' : `<div style="font-size:18px;opacity:0.7;margin-bottom:8px;">Best: ${best}m</div>`}
        <div style="font-size:20px;cursor:pointer;margin-top:16px;animation:pulse 1.5s ease-in-out infinite;" id="restart-btn">Click to Play Again</div>
        <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}</style>
      `;
      ol.querySelector('#restart-btn').addEventListener('click', () => game.restart(), { once: true });
    },

    renderHUD() {
      if (hudEl) {
        hudEl.innerHTML = `
          <div>Score: ${score}</div>
          <div>Speed: ${Math.round(speed)}m/s</div>
        `;
      }
    },

    getState() { return state; },

    getScore() {
      return { score, timeElapsed: Math.floor(timeElapsed) };
    },
  };

  window.SloppyGame = game;
  window.game = game;
})();
