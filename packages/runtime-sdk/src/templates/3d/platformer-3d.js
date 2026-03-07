/**
 * Sloppy SDK v2 — 3D Platformer Template
 *
 * Boilerplate: third-person orbit camera with spherical coordinates,
 * camera-relative WASD movement, manual gravity + jump, AABB platform
 * collision, collectibles with rotation + bob, and all SDK v2 lifecycle
 * methods.
 *
 * The AI fills in: level geometry, platform layouts, enemy types, hazards,
 * visual theme, collectible types, and progression.
 */

(function () {
  const GAME_TITLE = '3D Platformer';
  const MOVE_SPEED = 8;
  const JUMP_FORCE = 12;
  const GRAVITY = 30;
  const CAM_SPEED = 0.005;
  const CAM_DIST = 10;

  let renderer, scene, camera, clock, animationId;
  let container, hudEl, overlayEl;
  let state = 'idle';
  let score = 0, level = 1, lives = 3, timeElapsed = 0;
  let playerMesh, playerY = 0, velocityY = 0, grounded = false;
  let camTheta = 0, camPhi = Math.PI / 4;
  let isDragging = false, lastMouseX = 0, lastMouseY = 0;
  const keys = {};
  const platforms = [];
  const collectibles = [];
  let _forward, _right, _moveDir, _camTarget, _playerBox, _platBox;

  function createOverlay() {
    overlayEl = document.createElement('div');
    overlayEl.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);color:#fff;font-family:Arial,sans-serif;z-index:100;user-select:none;';
    container.appendChild(overlayEl);
    return overlayEl;
  }
  function hideOverlay() { if (overlayEl) { overlayEl.remove(); overlayEl = null; } }
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
    scene.background = new THREE.Color(0x66aadd);
    scene.fog = new THREE.FogExp2(0x66aadd, 0.008);

    camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 300);
    scene.add(new THREE.AmbientLight(0x8899bb, 0.5));
    const sun = new THREE.DirectionalLight(0xffeedd, 1.2);
    sun.position.set(15, 30, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    scene.add(sun);
    scene.add(sun.target);

    // Player
    playerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.2, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x44aaff, roughness: 0.3, metalness: 0.3 })
    );
    playerMesh.castShadow = true;
    scene.add(playerMesh);

    // Ground platform
    addPlatform(0, -0.5, 0, 20, 1, 20, 0x44aa44);

    // Floating platforms
    const layout = [
      { x: 4, y: 2, z: -4, w: 3, d: 3 }, { x: -3, y: 4, z: -8, w: 3, d: 3 },
      { x: 5, y: 6, z: -12, w: 2.5, d: 2.5 }, { x: 0, y: 8, z: -16, w: 3, d: 3 },
      { x: -4, y: 10, z: -20, w: 4, d: 4 },
    ];
    layout.forEach(p => addPlatform(p.x, p.y, p.z, p.w, 0.5, p.d, 0x886644));

    // Collectibles on platforms
    layout.forEach(p => {
      const c = new THREE.Mesh(
        new THREE.TorusGeometry(0.3, 0.1, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffaa00, emissiveIntensity: 0.3 })
      );
      c.position.set(p.x, p.y + 1.5, p.z);
      c.castShadow = true;
      scene.add(c);
      collectibles.push({ mesh: c, collected: false, baseY: p.y + 1.5 });
    });

    _forward = new THREE.Vector3();
    _right = new THREE.Vector3();
    _moveDir = new THREE.Vector3();
    _camTarget = new THREE.Vector3();
    _playerBox = new THREE.Box3();
    _platBox = new THREE.Box3();
    clock = new THREE.Clock(false);
  }

  function addPlatform(x, y, z, w, h, d, color) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
    );
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);
    platforms.push({ mesh, box: new THREE.Box3().setFromObject(mesh) });
  }

  function resetPlayer() {
    playerMesh.position.set(0, 1, 0);
    playerY = 1; velocityY = 0; grounded = false;
    score = 0; lives = 3; timeElapsed = 0;
    collectibles.forEach(c => { c.collected = false; c.mesh.visible = true; });
  }

  function onKeyDown(e) {
    keys[e.code] = true;
    if (state === 'playing' && (e.code === 'Space' || e.code === 'KeyW') && grounded) {
      velocityY = JUMP_FORCE;
      grounded = false;
    }
  }
  function onKeyUp(e) { keys[e.code] = false; }

  function onMouseDown(e) { isDragging = true; lastMouseX = e.clientX; lastMouseY = e.clientY; }
  function onMouseMove(e) {
    if (!isDragging) return;
    camTheta -= (e.clientX - lastMouseX) * CAM_SPEED;
    camPhi += (e.clientY - lastMouseY) * CAM_SPEED;
    camPhi = Math.max(0.15, Math.min(Math.PI / 2 - 0.05, camPhi));
    lastMouseX = e.clientX; lastMouseY = e.clientY;
  }
  function onMouseUp() { isDragging = false; }

  function updateGame(dt) {
    timeElapsed += dt;

    // Camera-relative movement
    _forward.set(-Math.sin(camTheta), 0, -Math.cos(camTheta)).normalize();
    _right.set(_forward.z, 0, -_forward.x);
    _moveDir.set(0, 0, 0);
    if (keys['KeyW'] || keys['ArrowUp']) _moveDir.add(_forward);
    if (keys['KeyS'] || keys['ArrowDown']) _moveDir.sub(_forward);
    if (keys['KeyA'] || keys['ArrowLeft']) _moveDir.sub(_right);
    if (keys['KeyD'] || keys['ArrowRight']) _moveDir.add(_right);

    if (_moveDir.lengthSq() > 0) {
      _moveDir.normalize().multiplyScalar(MOVE_SPEED * dt);
      playerMesh.position.x += _moveDir.x;
      playerMesh.position.z += _moveDir.z;
      playerMesh.rotation.y = Math.atan2(_moveDir.x, _moveDir.z);
    }

    // Gravity & jump
    velocityY -= GRAVITY * dt;
    playerMesh.position.y += velocityY * dt;
    grounded = false;

    // Platform collision
    _playerBox.setFromObject(playerMesh);
    for (const p of platforms) {
      if (_playerBox.intersectsBox(p.box)) {
        if (velocityY <= 0 && playerMesh.position.y >= p.box.max.y - 0.5) {
          playerMesh.position.y = p.box.max.y + 0.6;
          velocityY = 0;
          grounded = true;
        }
      }
    }

    // Fall death
    if (playerMesh.position.y < -20) {
      lives--;
      if (lives <= 0) { game.renderGameOverScreen(game.getScore()); return; }
      playerMesh.position.set(0, 2, 0); velocityY = 0;
    }

    // Collectibles
    for (const c of collectibles) {
      if (c.collected) continue;
      c.mesh.rotation.y += dt * 2;
      c.mesh.position.y = c.baseY + Math.sin(timeElapsed * 2) * 0.2;
      if (playerMesh.position.distanceTo(c.mesh.position) < 1.2) {
        c.collected = true; c.mesh.visible = false; score += 100;
      }
    }

    // Orbit camera
    _camTarget.set(
      playerMesh.position.x + CAM_DIST * Math.sin(camPhi) * Math.sin(camTheta),
      playerMesh.position.y + CAM_DIST * Math.cos(camPhi),
      playerMesh.position.z + CAM_DIST * Math.sin(camPhi) * Math.cos(camTheta)
    );
    camera.position.lerp(_camTarget, 0.08);
    camera.lookAt(playerMesh.position);

    // Win check
    if (collectibles.every(c => c.collected)) {
      score += 500;
      game.renderGameOverScreen(game.getScore());
    }
  }

  function animate() {
    animationId = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (state === 'playing') { updateGame(dt); game.renderHUD(); }
    renderer.render(scene, camera);
  }

  const game = {
    metadata: {
      title: GAME_TITLE, genre: '3d-platformer', engine: 'threejs', supportsMultiplayer: false,
      controls: [
        { key: 'WASD / Arrows', action: 'Move' }, { key: 'Space', action: 'Jump' },
        { key: 'Mouse Drag', action: 'Orbit Camera' },
      ],
      estimatedPlayTime: '3-8 min',
    },
    supportsMultiplayer: false,

    async init(el, config) {
      container = el; container.style.position = 'relative';
      buildScene(config.width, config.height); createHUD();
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('keyup', onKeyUp);
      renderer.domElement.addEventListener('mousedown', onMouseDown);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      window.parent.postMessage({ type: 'sloppy:game:ready' }, '*');
    },

    destroy() {
      cancelAnimationFrame(animationId);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) { if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose()); else obj.material.dispose(); }
      });
      renderer.dispose(); renderer.domElement.remove();
      if (hudEl) hudEl.remove(); hideOverlay();
    },

    start() { hideOverlay(); resetPlayer(); for (const k in keys) keys[k] = false; state = 'playing'; hudEl.style.display = ''; clock.start(); if (!animationId) animate(); },
    pause() { state = 'paused'; game.renderPauseScreen(); },
    resume() { hideOverlay(); state = 'playing'; clock.getDelta(); },
    restart() { hideOverlay(); game.start(); },

    renderIntroScreen() {
      state = 'intro'; hudEl.style.display = 'none';
      const ol = createOverlay();
      ol.innerHTML = `<div style="font-size:42px;font-weight:bold;color:#ffcc00;margin-bottom:12px;">${GAME_TITLE}</div>
        <div style="font-size:18px;margin-bottom:8px;">WASD — Move &nbsp;|&nbsp; Space — Jump &nbsp;|&nbsp; Drag — Camera</div>
        <div style="font-size:18px;margin-bottom:8px;">Collect all the rings!</div>
        <div style="font-size:20px;margin-top:20px;cursor:pointer;animation:pulse 1.5s ease-in-out infinite;" id="start-btn">Click to Start</div>
        <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}</style>`;
      ol.querySelector('#start-btn').addEventListener('click', () => game.start(), { once: true });
      animate();
    },

    renderPauseScreen() {
      const ol = createOverlay();
      ol.innerHTML = `<div style="font-size:36px;font-weight:bold;margin-bottom:16px;">PAUSED</div>
        <div style="font-size:20px;cursor:pointer;animation:pulse 1.5s ease-in-out infinite;" id="resume-btn">Click to Resume</div>
        <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}</style>`;
      ol.querySelector('#resume-btn').addEventListener('click', () => game.resume(), { once: true });
    },

    renderGameOverScreen(result) {
      state = 'gameover'; hudEl.style.display = 'none';
      const best = Math.max(result.score, parseInt(localStorage.getItem('plat3d_best') || '0'));
      localStorage.setItem('plat3d_best', String(best));
      const isNew = result.score >= best && result.score > 0;
      const allCollected = collectibles.every(c => c.collected);
      const ol = createOverlay();
      ol.innerHTML = `<div style="font-size:40px;font-weight:bold;color:${allCollected ? '#44ff44' : '#ff4444'};margin-bottom:12px;">${allCollected ? 'LEVEL COMPLETE!' : 'GAME OVER'}</div>
        <div style="font-size:24px;margin-bottom:8px;">Score: ${result.score}</div>
        ${isNew ? '<div style="font-size:20px;color:#ffcc00;margin-bottom:8px;">NEW HIGH SCORE!</div>' : `<div style="font-size:18px;opacity:0.7;margin-bottom:8px;">Best: ${best}</div>`}
        <div style="font-size:20px;cursor:pointer;margin-top:16px;animation:pulse 1.5s ease-in-out infinite;" id="restart-btn">Click to Play Again</div>
        <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}</style>`;
      ol.querySelector('#restart-btn').addEventListener('click', () => game.restart(), { once: true });
    },

    renderHUD() {
      if (hudEl) {
        const collected = collectibles.filter(c => c.collected).length;
        hudEl.innerHTML = `<div>Score: ${score} &nbsp; Lives: ${lives}</div><div>Rings: ${collected}/${collectibles.length}</div>`;
      }
    },

    getState() { return state; },
    getScore() { return { score, level, timeElapsed: Math.floor(timeElapsed) }; },
  };

  window.SloppyGame = game;
  window.game = game;
})();
