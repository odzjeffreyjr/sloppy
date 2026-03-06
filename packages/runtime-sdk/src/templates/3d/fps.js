/**
 * Sloppy SDK v2 — FPS (First-Person Shooter) Template
 *
 * Boilerplate: pointer lock camera, WASD movement, raycasting projectiles,
 * enemy spawning pool, health system, and all SDK v2 lifecycle methods.
 *
 * The AI fills in: specific enemy behaviors, level geometry, weapon types,
 * scoring rules, visual theme, and game-specific progression.
 */

(function () {
  // ── Config ──────────────────────────────────────────────────────────────
  const GAME_TITLE = 'FPS Game';
  const MOVE_SPEED = 8;
  const MOUSE_SENSITIVITY = 0.002;
  const SHOOT_COOLDOWN = 0.25;
  const MAX_ENEMIES = 20;
  const PLAYER_MAX_HEALTH = 100;

  // ── State ───────────────────────────────────────────────────────────────
  let renderer, scene, camera, clock, animationId;
  let container, hudEl, overlayEl;
  let state = 'idle';
  let score = 0, level = 1, health = PLAYER_MAX_HEALTH, timeElapsed = 0;
  let shootTimer = 0;
  const keys = {};
  let pointerLocked = false;
  let yaw = 0, pitch = 0;

  // Pre-allocated vectors to avoid GC in game loop
  let _forward, _right, _moveDir;
  const enemies = [];
  const projectiles = [];

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
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.FogExp2(0x1a1a2e, 0.025);

    camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 200);
    camera.position.set(0, 1.6, 0);

    const ambient = new THREE.AmbientLight(0x404060, 0.6);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffeedd, 1.0);
    sun.position.set(10, 20, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);

    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({ color: 0x333355, roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Pre-create enemy pool
    for (let i = 0; i < MAX_ENEMIES; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 1.6, 0.8),
        new THREE.MeshStandardMaterial({ color: 0xff3333, roughness: 0.5 })
      );
      mesh.castShadow = true;
      mesh.visible = false;
      scene.add(mesh);
      enemies.push({ mesh, active: false, health: 0, speed: 0, box: new THREE.Box3() });
    }

    // Pre-allocate reusable vectors
    _forward = new THREE.Vector3();
    _right = new THREE.Vector3();
    _moveDir = new THREE.Vector3();

    clock = new THREE.Clock(false);
  }

  function spawnEnemy() {
    const e = enemies.find(en => !en.active);
    if (!e) return;
    const angle = Math.random() * Math.PI * 2;
    const dist = 15 + Math.random() * 20;
    e.mesh.position.set(Math.cos(angle) * dist, 0.8, Math.sin(angle) * dist);
    e.mesh.visible = true;
    e.active = true;
    e.health = 30;
    e.speed = 2 + Math.random() * 2;
  }

  function onMouseMove(e) {
    if (!pointerLocked || state !== 'playing') return;
    yaw -= e.movementX * MOUSE_SENSITIVITY;
    pitch -= e.movementY * MOUSE_SENSITIVITY;
    pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));
  }

  function onKeyDown(e) { keys[e.code] = true; }
  function onKeyUp(e) { keys[e.code] = false; }

  function onPointerLockChange() {
    pointerLocked = document.pointerLockElement === renderer.domElement;
  }

  function shoot() {
    if (shootTimer > 0) return;
    shootTimer = SHOOT_COOLDOWN;

    // Raycasting from camera center
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(camera.quaternion);
    const raycaster = new THREE.Raycaster(camera.position.clone(), dir, 0.1, 100);
    const activeMeshes = enemies.filter(e => e.active).map(e => e.mesh);
    const hits = raycaster.intersectObjects(activeMeshes);
    if (hits.length > 0) {
      const hitMesh = hits[0].object;
      const e = enemies.find(en => en.mesh === hitMesh);
      if (e) {
        e.health -= 25;
        if (e.health <= 0) {
          e.active = false;
          e.mesh.visible = false;
          score += 100;
        }
      }
    }
  }

  function updateGame(dt) {
    timeElapsed += dt;
    shootTimer = Math.max(0, shootTimer - dt);

    // Camera rotation
    const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);

    // Movement
    _moveDir.set(0, 0, 0);
    camera.getWorldDirection(_forward);
    _forward.y = 0;
    _forward.normalize();
    _right.crossVectors(_forward, camera.up).normalize();

    if (keys['KeyW'] || keys['ArrowUp']) _moveDir.add(_forward);
    if (keys['KeyS'] || keys['ArrowDown']) _moveDir.sub(_forward);
    if (keys['KeyA'] || keys['ArrowLeft']) _moveDir.sub(_right);
    if (keys['KeyD'] || keys['ArrowRight']) _moveDir.add(_right);

    if (_moveDir.lengthSq() > 0) {
      _moveDir.normalize().multiplyScalar(MOVE_SPEED * dt);
      camera.position.add(_moveDir);
    }

    // Shooting
    if (keys['Space'] || keys['Mouse0']) shoot();

    // Enemy AI: move toward player
    for (const e of enemies) {
      if (!e.active) continue;
      _forward.copy(camera.position).sub(e.mesh.position);
      _forward.y = 0;
      const dist = _forward.length();
      if (dist > 1.5) {
        _forward.normalize().multiplyScalar(e.speed * dt);
        e.mesh.position.add(_forward);
      } else {
        health -= 10 * dt;
        if (health <= 0) {
          health = 0;
          game.renderGameOverScreen(game.getScore());
        }
      }
    }

    // Spawn wave
    const activeCount = enemies.filter(e => e.active).length;
    if (activeCount < 3 + level) spawnEnemy();

    // Level up
    if (score >= level * 500) level++;
  }

  function animate() {
    animationId = requestAnimationFrame(animate);
    const dt = clock.getDelta();
    if (state === 'playing') updateGame(dt);
    renderer.render(scene, camera);
  }

  // ── SDK v2 Game Object ──────────────────────────────────────────────────

  const game = {
    metadata: {
      title: GAME_TITLE,
      genre: '3d-firstperson',
      engine: 'threejs',
      supportsMultiplayer: false,
      controls: [
        { key: 'WASD', action: 'Move' },
        { key: 'Mouse', action: 'Look' },
        { key: 'Click / Space', action: 'Shoot' },
      ],
      estimatedPlayTime: '3-5 min',
    },

    supportsMultiplayer: false,

    async init(el, config) {
      container = el;
      container.style.position = 'relative';
      buildScene(config.width, config.height);
      createHUD();

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('keyup', onKeyUp);
      document.addEventListener('pointerlockchange', onPointerLockChange);
      renderer.domElement.addEventListener('mousedown', () => {
        if (state === 'playing' && !pointerLocked) {
          renderer.domElement.requestPointerLock();
        }
        keys['Mouse0'] = true;
      });
      renderer.domElement.addEventListener('mouseup', () => { keys['Mouse0'] = false; });

      window.parent.postMessage({ type: 'sloppy:game:ready' }, '*');
    },

    destroy() {
      cancelAnimationFrame(animationId);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      if (document.pointerLockElement) document.exitPointerLock();
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
      score = 0; level = 1; health = PLAYER_MAX_HEALTH; timeElapsed = 0;
      shootTimer = 0; yaw = 0; pitch = 0;
      camera.position.set(0, 1.6, 0);
      enemies.forEach(e => { e.active = false; e.mesh.visible = false; });
      for (const k in keys) keys[k] = false;
      state = 'playing';
      hudEl.style.display = '';
      clock.start();
      if (!animationId) animate();
      renderer.domElement.requestPointerLock();
    },

    pause() {
      state = 'paused';
      if (document.pointerLockElement) document.exitPointerLock();
      game.renderPauseScreen();
    },

    resume() {
      hideOverlay();
      state = 'playing';
      clock.getDelta(); // reset delta
      renderer.domElement.requestPointerLock();
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
        <div style="font-size:18px;margin-bottom:8px;">WASD — Move &nbsp;|&nbsp; Mouse — Aim &nbsp;|&nbsp; Click — Shoot</div>
        <div style="font-size:20px;margin-top:20px;animation:pulse 1.5s ease-in-out infinite;">Click to Start</div>
        <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}</style>
      `;
      ol.style.cursor = 'pointer';
      ol.addEventListener('click', () => game.start(), { once: true });
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
      if (document.pointerLockElement) document.exitPointerLock();
      hudEl.style.display = 'none';
      const best = Math.max(result.score, parseInt(localStorage.getItem('fps_best') || '0'));
      localStorage.setItem('fps_best', String(best));
      const isNew = result.score >= best && result.score > 0;
      const ol = createOverlay();
      ol.innerHTML = `
        <div style="font-size:40px;font-weight:bold;color:#ff4444;margin-bottom:12px;">GAME OVER</div>
        <div style="font-size:24px;margin-bottom:8px;">Score: ${result.score}</div>
        ${isNew ? '<div style="font-size:20px;color:#ffcc00;margin-bottom:8px;">NEW HIGH SCORE!</div>' : `<div style="font-size:18px;opacity:0.7;margin-bottom:8px;">Best: ${best}</div>`}
        <div style="font-size:20px;cursor:pointer;margin-top:16px;animation:pulse 1.5s ease-in-out infinite;" id="restart-btn">Click to Play Again</div>
        <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}</style>
      `;
      ol.querySelector('#restart-btn').addEventListener('click', () => game.restart(), { once: true });
    },

    renderHUD() {
      if (hudEl) {
        const barWidth = Math.max(0, (health / PLAYER_MAX_HEALTH) * 100);
        const barColor = health > 50 ? '#4f4' : health > 25 ? '#ff4' : '#f44';
        hudEl.innerHTML = `
          <div>Score: ${score} &nbsp; Level: ${level}</div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span>HP</span>
            <div style="width:120px;height:14px;background:#333;border-radius:7px;overflow:hidden;">
              <div style="width:${barWidth}%;height:100%;background:${barColor};transition:width 0.2s;"></div>
            </div>
          </div>
        `;
      }
    },

    getState() { return state; },

    getScore() {
      return { score, level, timeElapsed: Math.floor(timeElapsed) };
    },
  };

  // Keep HUD updated during play
  const _origAnimate = animate;
  animate = function () {
    animationId = requestAnimationFrame(animate);
    const dt = clock.getDelta();
    if (state === 'playing') {
      updateGame(dt);
      game.renderHUD();
    }
    renderer.render(scene, camera);
  };

  window.SloppyGame = game;
  window.game = game;
})();
