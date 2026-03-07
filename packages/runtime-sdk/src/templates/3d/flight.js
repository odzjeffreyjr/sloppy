/**
 * Sloppy SDK v2 — 3D Flight / Space Shooter Template
 *
 * Boilerplate: pitch/yaw/roll flight controls with quaternion-based forward
 * vector, throttle speed, projectile pools, enemy ship AI, third-person
 * follow camera with lag, starfield environment, and all SDK v2 lifecycle
 * methods.
 *
 * The AI fills in: specific enemy types, wave configurations, power-ups,
 * visual theme, weapon types, and scoring rules.
 */

(function () {
  const GAME_TITLE = 'Flight Game';
  const MAX_SPEED = 25;
  const MIN_SPEED = 5;
  const PITCH_RATE = 2.0;
  const YAW_RATE = 2.0;
  const ROLL_RATE = 2.5;
  const BULLET_SPEED = 60;
  const SHOOT_COOLDOWN = 0.2;
  const MAX_ENEMIES = 15;
  const MAX_BULLETS = 30;

  let renderer, scene, camera, clock, animationId;
  let container, hudEl, overlayEl;
  let state = 'idle';
  let score = 0, wave = 1, health = 100, timeElapsed = 0;
  let speed = 12, shootTimer = 0;
  let shipMesh;
  const keys = {};
  const enemies = [];
  const bullets = [];

  let _forward, _tmpV3, _camTarget;

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
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050510);
    scene.fog = new THREE.FogExp2(0x050510, 0.003);

    camera = new THREE.PerspectiveCamera(65, w / h, 0.1, 1000);
    scene.add(new THREE.AmbientLight(0x334466, 0.4));
    const sun = new THREE.DirectionalLight(0xffeedd, 1.0);
    sun.position.set(20, 30, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    scene.add(sun.target);

    // Starfield
    for (let i = 0; i < 300; i++) {
      const star = new THREE.Mesh(
        new THREE.SphereGeometry(0.1 + Math.random() * 0.15, 4, 4),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0 })
      );
      star.position.set(
        (Math.random() - 0.5) * 400,
        (Math.random() - 0.5) * 400,
        (Math.random() - 0.5) * 400
      );
      scene.add(star);
    }

    // Player ship (group of primitives)
    shipMesh = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.6, 2.5, 6), new THREE.MeshStandardMaterial({ color: 0x4488ff, roughness: 0.3, metalness: 0.5 }));
    body.rotation.x = Math.PI / 2;
    body.castShadow = true;
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.08, 0.8), new THREE.MeshStandardMaterial({ color: 0x3366cc, roughness: 0.4 }));
    wingL.position.set(-0.6, 0, 0.2);
    const wingR = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.08, 0.8), new THREE.MeshStandardMaterial({ color: 0x3366cc, roughness: 0.4 }));
    wingR.position.set(0.6, 0, 0.2);
    const engine = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 6), new THREE.MeshStandardMaterial({ color: 0x00aaff, emissive: 0x0066ff, emissiveIntensity: 0.8 }));
    engine.position.set(0, 0, 1.2);
    shipMesh.add(body, wingL, wingR, engine);
    scene.add(shipMesh);

    // Enemy pool
    const enemyGeo = new THREE.ConeGeometry(0.5, 1.5, 6);
    const enemyMat = new THREE.MeshStandardMaterial({ color: 0xff4444, roughness: 0.5 });
    for (let i = 0; i < MAX_ENEMIES; i++) {
      const m = new THREE.Mesh(enemyGeo, enemyMat.clone());
      m.rotation.x = Math.PI / 2;
      m.castShadow = true;
      m.visible = false;
      scene.add(m);
      enemies.push({ mesh: m, active: false, health: 0, vel: new THREE.Vector3() });
    }

    // Bullet pool
    const bGeo = new THREE.SphereGeometry(0.12, 4, 4);
    const bMat = new THREE.MeshStandardMaterial({ color: 0x00ffaa, emissive: 0x00ff66, emissiveIntensity: 0.6 });
    for (let i = 0; i < MAX_BULLETS; i++) {
      const m = new THREE.Mesh(bGeo, bMat.clone());
      m.visible = false;
      scene.add(m);
      bullets.push({ mesh: m, active: false, vel: new THREE.Vector3(), dist: 0 });
    }

    _forward = new THREE.Vector3();
    _tmpV3 = new THREE.Vector3();
    _camTarget = new THREE.Vector3();
    clock = new THREE.Clock(false);
  }

  function spawnEnemy() {
    const e = enemies.find(en => !en.active);
    if (!e) return;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(shipMesh.quaternion);
    const angle = (Math.random() - 0.5) * 1.5;
    const dist = 40 + Math.random() * 30;
    e.mesh.position.copy(shipMesh.position).addScaledVector(fwd, dist);
    e.mesh.position.x += (Math.random() - 0.5) * 30;
    e.mesh.position.y += (Math.random() - 0.5) * 20;
    e.mesh.visible = true;
    e.active = true;
    e.health = 20 + wave * 5;
    e.vel.set(0, 0, 0);
  }

  function onKeyDown(e) { keys[e.code] = true; }
  function onKeyUp(e) { keys[e.code] = false; }

  function updateGame(dt) {
    timeElapsed += dt;
    shootTimer = Math.max(0, shootTimer - dt);

    // Flight controls
    if (keys['ArrowUp'] || keys['KeyW']) shipMesh.rotateX(-PITCH_RATE * dt);
    if (keys['ArrowDown'] || keys['KeyS']) shipMesh.rotateX(PITCH_RATE * dt);
    if (keys['ArrowLeft'] || keys['KeyA']) shipMesh.rotateY(YAW_RATE * dt);
    if (keys['ArrowRight'] || keys['KeyD']) shipMesh.rotateY(-YAW_RATE * dt);
    if (keys['KeyQ']) shipMesh.rotateZ(ROLL_RATE * dt);
    if (keys['KeyE']) shipMesh.rotateZ(-ROLL_RATE * dt);

    // Throttle
    if (keys['ShiftLeft'] || keys['ShiftRight']) speed = Math.min(MAX_SPEED, speed + 10 * dt);
    else speed = Math.max(MIN_SPEED, speed - 3 * dt);

    // Move ship forward
    _forward.set(0, 0, -1).applyQuaternion(shipMesh.quaternion);
    shipMesh.position.addScaledVector(_forward, speed * dt);

    // Shoot
    if ((keys['Space'] || keys['Mouse0']) && shootTimer <= 0) {
      shootTimer = SHOOT_COOLDOWN;
      const b = bullets.find(bl => !bl.active);
      if (b) {
        b.mesh.position.copy(shipMesh.position);
        b.vel.copy(_forward).multiplyScalar(BULLET_SPEED);
        b.mesh.visible = true;
        b.active = true;
        b.dist = 0;
      }
    }

    // Update bullets
    for (const b of bullets) {
      if (!b.active) continue;
      b.mesh.position.addScaledVector(b.vel, dt);
      b.dist += BULLET_SPEED * dt;
      if (b.dist > 120) { b.active = false; b.mesh.visible = false; continue; }
      // Hit check
      for (const e of enemies) {
        if (!e.active) continue;
        if (b.mesh.position.distanceTo(e.mesh.position) < 1.5) {
          e.health -= 15;
          b.active = false; b.mesh.visible = false;
          if (e.health <= 0) { e.active = false; e.mesh.visible = false; score += 100; }
          break;
        }
      }
    }

    // Enemy AI: fly toward player
    for (const e of enemies) {
      if (!e.active) continue;
      _tmpV3.copy(shipMesh.position).sub(e.mesh.position);
      const dist = _tmpV3.length();
      if (dist > 2) {
        _tmpV3.normalize().multiplyScalar(4 * dt);
        e.mesh.position.add(_tmpV3);
      } else {
        health -= 20 * dt;
        if (health <= 0) { health = 0; game.renderGameOverScreen(game.getScore()); return; }
      }
      e.mesh.lookAt(shipMesh.position);
    }

    // Spawn
    if (enemies.filter(e => e.active).length < 2 + wave) spawnEnemy();
    if (score >= wave * 500) wave++;

    // Camera follow (third-person behind ship)
    const camBack = new THREE.Vector3(0, 2, 6).applyQuaternion(shipMesh.quaternion);
    _camTarget.copy(shipMesh.position).add(camBack);
    camera.position.lerp(_camTarget, 0.06);
    camera.lookAt(shipMesh.position);
  }

  function animate() {
    animationId = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (state === 'playing') { updateGame(dt); game.renderHUD(); }
    renderer.render(scene, camera);
  }

  const game = {
    metadata: {
      title: GAME_TITLE, genre: '3d-flight', engine: 'threejs', supportsMultiplayer: false,
      controls: [
        { key: 'W/S or Up/Down', action: 'Pitch' }, { key: 'A/D or Left/Right', action: 'Yaw' },
        { key: 'Q/E', action: 'Roll' }, { key: 'Shift', action: 'Boost' }, { key: 'Space', action: 'Shoot' },
      ],
      estimatedPlayTime: '3-5 min',
    },
    supportsMultiplayer: false,

    async init(el, config) {
      container = el; container.style.position = 'relative';
      buildScene(config.width, config.height); createHUD();
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('keyup', onKeyUp);
      renderer.domElement.addEventListener('mousedown', () => { keys['Mouse0'] = true; });
      renderer.domElement.addEventListener('mouseup', () => { keys['Mouse0'] = false; });
      window.parent.postMessage({ type: 'sloppy:game:ready' }, '*');
    },

    destroy() {
      cancelAnimationFrame(animationId);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) { if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose()); else obj.material.dispose(); }
      });
      renderer.dispose(); renderer.domElement.remove();
      if (hudEl) hudEl.remove(); hideOverlay();
    },

    start() {
      hideOverlay(); score = 0; wave = 1; health = 100; timeElapsed = 0; speed = 12; shootTimer = 0;
      shipMesh.position.set(0, 0, 0); shipMesh.rotation.set(0, 0, 0);
      enemies.forEach(e => { e.active = false; e.mesh.visible = false; });
      bullets.forEach(b => { b.active = false; b.mesh.visible = false; });
      for (const k in keys) keys[k] = false;
      state = 'playing'; hudEl.style.display = ''; clock.start();
      if (!animationId) animate();
    },

    pause() { state = 'paused'; game.renderPauseScreen(); },
    resume() { hideOverlay(); state = 'playing'; clock.getDelta(); },
    restart() { hideOverlay(); game.start(); },

    renderIntroScreen() {
      state = 'intro'; hudEl.style.display = 'none';
      const ol = createOverlay();
      ol.innerHTML = `<div style="font-size:42px;font-weight:bold;color:#ffcc00;margin-bottom:12px;">${GAME_TITLE}</div>
        <div style="font-size:18px;margin-bottom:8px;">WASD/Arrows — Fly &nbsp;|&nbsp; Q/E — Roll &nbsp;|&nbsp; Space — Shoot</div>
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
      const best = Math.max(result.score, parseInt(localStorage.getItem('flight_best') || '0'));
      localStorage.setItem('flight_best', String(best));
      const isNew = result.score >= best && result.score > 0;
      const ol = createOverlay();
      ol.innerHTML = `<div style="font-size:40px;font-weight:bold;color:#ff4444;margin-bottom:12px;">GAME OVER</div>
        <div style="font-size:24px;margin-bottom:8px;">Score: ${result.score} • Wave: ${wave}</div>
        ${isNew ? '<div style="font-size:20px;color:#ffcc00;margin-bottom:8px;">NEW HIGH SCORE!</div>' : `<div style="font-size:18px;opacity:0.7;margin-bottom:8px;">Best: ${best}</div>`}
        <div style="font-size:20px;cursor:pointer;margin-top:16px;animation:pulse 1.5s ease-in-out infinite;" id="restart-btn">Click to Play Again</div>
        <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}</style>`;
      ol.querySelector('#restart-btn').addEventListener('click', () => game.restart(), { once: true });
    },

    renderHUD() {
      if (hudEl) {
        const barW = Math.max(0, health);
        const barC = health > 50 ? '#4f4' : health > 25 ? '#ff4' : '#f44';
        hudEl.innerHTML = `<div>Score: ${score} &nbsp; Wave: ${wave}</div>
          <div style="display:flex;align-items:center;gap:8px;"><span>HP</span>
          <div style="width:120px;height:14px;background:#333;border-radius:7px;overflow:hidden;">
          <div style="width:${barW}%;height:100%;background:${barC};transition:width 0.2s;"></div></div>
          <span>Speed: ${Math.round(speed)}</span></div>`;
      }
    },

    getState() { return state; },
    getScore() { return { score, level: wave, timeElapsed: Math.floor(timeElapsed) }; },
  };

  window.SloppyGame = game;
  window.game = game;
})();
