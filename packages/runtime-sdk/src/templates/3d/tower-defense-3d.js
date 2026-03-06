/**
 * Sloppy SDK v2 — 3D Tower Defense Template
 *
 * Boilerplate: grid system, A* pathfinding, top-down overview camera, tower
 * placement via raycasting, enemy wave spawning, projectile system, and all
 * SDK v2 lifecycle methods.
 *
 * The AI fills in: tower types, enemy types, wave configurations, upgrade
 * system, visual theme, map layout, and economy balancing.
 */

(function () {
  // ── Config ──────────────────────────────────────────────────────────────
  const GAME_TITLE = 'Tower Defense';
  const GRID_SIZE = 10;
  const CELL_SIZE = 2;
  const MAX_TOWERS = 20;
  const MAX_ENEMIES = 30;
  const MAX_PROJECTILES = 40;
  const START_GOLD = 200;
  const TOWER_COST = 50;
  const TOWER_RANGE = 5;
  const TOWER_FIRE_RATE = 1;
  const ENEMY_SPEED = 2;

  // ── State ───────────────────────────────────────────────────────────────
  let renderer, scene, camera, clock, animationId;
  let container, hudEl, overlayEl;
  let state = 'idle';
  let score = 0, wave = 0, lives = 20, gold = START_GOLD, timeElapsed = 0;
  let grid, pathNodes;
  const towers = [];
  const enemies = [];
  const projectiles = [];
  let groundMesh, gridHelper;
  let raycaster, mouse, groundPlane;
  let waveTimer = 0, spawnIndex = 0, enemiesPerWave = 5;

  // ── A* Pathfinding ──────────────────────────────────────────────────────

  function findPath(grid, startR, startC, endR, endC) {
    const rows = grid.length, cols = grid[0].length;
    const open = [{ r: startR, c: startC, g: 0, h: 0, f: 0, parent: null }];
    const closed = new Set();
    const key = (r, c) => r * cols + c;

    while (open.length > 0) {
      open.sort((a, b) => a.f - b.f);
      const cur = open.shift();
      if (cur.r === endR && cur.c === endC) {
        const path = [];
        let n = cur;
        while (n) { path.unshift({ r: n.r, c: n.c }); n = n.parent; }
        return path;
      }
      closed.add(key(cur.r, cur.c));
      for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
        const nr = cur.r + dr, nc = cur.c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        if (grid[nr][nc] === 1 || closed.has(key(nr, nc))) continue;
        const g = cur.g + 1;
        const h = Math.abs(nr - endR) + Math.abs(nc - endC);
        const existing = open.find(n => n.r === nr && n.c === nc);
        if (!existing || g < existing.g) {
          if (existing) { existing.g = g; existing.f = g + h; existing.parent = cur; }
          else open.push({ r: nr, c: nc, g, h, f: g + h, parent: cur });
        }
      }
    }
    return null;
  }

  function gridToWorld(r, c) {
    const offset = (GRID_SIZE * CELL_SIZE) / 2 - CELL_SIZE / 2;
    return { x: c * CELL_SIZE - offset, z: r * CELL_SIZE - offset };
  }

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
    hudEl.style.cssText = 'position:absolute;top:0;left:0;width:100%;padding:12px;color:#fff;font-family:Arial,sans-serif;font-size:16px;pointer-events:none;z-index:10;display:flex;justify-content:space-between;';
    container.appendChild(hudEl);
  }

  function buildScene(w, h) {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a3a2a);
    scene.fog = new THREE.FogExp2(0x2a3a2a, 0.015);

    const totalSize = GRID_SIZE * CELL_SIZE;
    camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200);
    camera.position.set(0, totalSize * 1.2, totalSize * 0.6);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0x667766, 0.5));
    const sun = new THREE.DirectionalLight(0xffeedd, 1.0);
    sun.position.set(10, 20, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);

    // Ground
    groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(totalSize + 4, totalSize + 4),
      new THREE.MeshStandardMaterial({ color: 0x4a6a4a, roughness: 0.9 })
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Grid visualization
    const gridMat = new THREE.LineBasicMaterial({ color: 0x667766, transparent: true, opacity: 0.3 });
    for (let i = 0; i <= GRID_SIZE; i++) {
      const offset = i * CELL_SIZE - totalSize / 2;
      const pts1 = [new THREE.Vector3(offset, 0.01, -totalSize / 2), new THREE.Vector3(offset, 0.01, totalSize / 2)];
      const pts2 = [new THREE.Vector3(-totalSize / 2, 0.01, offset), new THREE.Vector3(totalSize / 2, 0.01, offset)];
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts1), gridMat));
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts2), gridMat));
    }

    // Initialize grid (0 = open, 1 = tower)
    grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));

    // Tower pool
    const towerGeo = new THREE.CylinderGeometry(0.3, 0.5, 1.5, 8);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x4488ff, roughness: 0.4, metalness: 0.3 });
    for (let i = 0; i < MAX_TOWERS; i++) {
      const mesh = new THREE.Mesh(towerGeo, towerMat.clone());
      mesh.castShadow = true;
      mesh.visible = false;
      scene.add(mesh);
      towers.push({ mesh, active: false, r: 0, c: 0, fireTimer: 0 });
    }

    // Enemy pool
    const enemyGeo = new THREE.SphereGeometry(0.4, 8, 8);
    const enemyMat = new THREE.MeshStandardMaterial({ color: 0xff4444, roughness: 0.5 });
    for (let i = 0; i < MAX_ENEMIES; i++) {
      const mesh = new THREE.Mesh(enemyGeo, enemyMat.clone());
      mesh.castShadow = true;
      mesh.visible = false;
      scene.add(mesh);
      enemies.push({ mesh, active: false, health: 0, path: null, pathIdx: 0, worldPos: new THREE.Vector3() });
    }

    // Projectile pool
    const projGeo = new THREE.SphereGeometry(0.15, 6, 6);
    const projMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffaa00, emissiveIntensity: 0.5 });
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      const mesh = new THREE.Mesh(projGeo, projMat.clone());
      mesh.visible = false;
      scene.add(mesh);
      projectiles.push({ mesh, active: false, target: null, speed: 15 });
    }

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    clock = new THREE.Clock(false);
  }

  function resetGame() {
    score = 0; wave = 0; lives = 20; gold = START_GOLD; timeElapsed = 0;
    waveTimer = 3; spawnIndex = 0; enemiesPerWave = 5;
    grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
    towers.forEach(t => { t.active = false; t.mesh.visible = false; });
    enemies.forEach(e => { e.active = false; e.mesh.visible = false; });
    projectiles.forEach(p => { p.active = false; p.mesh.visible = false; });
    pathNodes = findPath(grid, 0, 0, GRID_SIZE - 1, GRID_SIZE - 1);
  }

  function placeTower(r, c) {
    if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return;
    if (grid[r][c] !== 0 || gold < TOWER_COST) return;
    // Ensure path still exists
    grid[r][c] = 1;
    const testPath = findPath(grid, 0, 0, GRID_SIZE - 1, GRID_SIZE - 1);
    if (!testPath) { grid[r][c] = 0; return; }
    pathNodes = testPath;

    const tower = towers.find(t => !t.active);
    if (!tower) { grid[r][c] = 0; return; }
    const pos = gridToWorld(r, c);
    tower.mesh.position.set(pos.x, 0.75, pos.z);
    tower.mesh.visible = true;
    tower.active = true;
    tower.r = r;
    tower.c = c;
    tower.fireTimer = 0;
    gold -= TOWER_COST;
  }

  function spawnEnemy() {
    const e = enemies.find(en => !en.active);
    if (!e || !pathNodes) return;
    const start = gridToWorld(pathNodes[0].r, pathNodes[0].c);
    e.mesh.position.set(start.x, 0.4, start.z);
    e.worldPos.copy(e.mesh.position);
    e.mesh.visible = true;
    e.active = true;
    e.health = 30 + wave * 10;
    e.path = [...pathNodes];
    e.pathIdx = 0;
  }

  function onClick(e) {
    if (state !== 'playing') return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersect = new THREE.Vector3();
    raycaster.ray.intersectPlane(groundPlane, intersect);
    if (intersect) {
      const offset = (GRID_SIZE * CELL_SIZE) / 2 - CELL_SIZE / 2;
      const c = Math.round((intersect.x + offset) / CELL_SIZE);
      const r = Math.round((intersect.z + offset) / CELL_SIZE);
      placeTower(r, c);
    }
  }

  function updateGame(dt) {
    timeElapsed += dt;

    // Wave spawning
    waveTimer -= dt;
    if (waveTimer <= 0 && spawnIndex < enemiesPerWave) {
      spawnEnemy();
      spawnIndex++;
      waveTimer = 0.8;
      if (spawnIndex >= enemiesPerWave) {
        waveTimer = 5;
      }
    }

    // Check if wave complete
    const activeEnemies = enemies.filter(e => e.active).length;
    if (spawnIndex >= enemiesPerWave && activeEnemies === 0) {
      wave++;
      spawnIndex = 0;
      enemiesPerWave = 5 + wave * 2;
      waveTimer = 3;
      gold += 50;
    }

    // Move enemies along path
    for (const e of enemies) {
      if (!e.active || !e.path) continue;
      if (e.pathIdx >= e.path.length) {
        e.active = false;
        e.mesh.visible = false;
        lives--;
        if (lives <= 0) {
          lives = 0;
          game.renderGameOverScreen(game.getScore());
          return;
        }
        continue;
      }
      const target = gridToWorld(e.path[e.pathIdx].r, e.path[e.pathIdx].c);
      const dx = target.x - e.mesh.position.x;
      const dz = target.z - e.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 0.2) {
        e.pathIdx++;
      } else {
        const step = ENEMY_SPEED * dt;
        e.mesh.position.x += (dx / dist) * step;
        e.mesh.position.z += (dz / dist) * step;
      }
      e.worldPos.copy(e.mesh.position);
    }

    // Tower firing
    for (const t of towers) {
      if (!t.active) continue;
      t.fireTimer -= dt;
      if (t.fireTimer > 0) continue;
      // Find nearest enemy in range
      let nearest = null, nearestDist = TOWER_RANGE;
      for (const e of enemies) {
        if (!e.active) continue;
        const dx = e.mesh.position.x - t.mesh.position.x;
        const dz = e.mesh.position.z - t.mesh.position.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < nearestDist) { nearest = e; nearestDist = d; }
      }
      if (nearest) {
        t.fireTimer = 1 / TOWER_FIRE_RATE;
        const p = projectiles.find(pr => !pr.active);
        if (p) {
          p.mesh.position.copy(t.mesh.position);
          p.mesh.position.y = 1.2;
          p.mesh.visible = true;
          p.active = true;
          p.target = nearest;
        }
      }
    }

    // Move projectiles
    for (const p of projectiles) {
      if (!p.active) continue;
      if (!p.target || !p.target.active) { p.active = false; p.mesh.visible = false; continue; }
      const dx = p.target.mesh.position.x - p.mesh.position.x;
      const dy = p.target.mesh.position.y - p.mesh.position.y;
      const dz = p.target.mesh.position.z - p.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 0.4) {
        p.target.health -= 15;
        if (p.target.health <= 0) {
          p.target.active = false;
          p.target.mesh.visible = false;
          score += 10;
          gold += 10;
        }
        p.active = false;
        p.mesh.visible = false;
      } else {
        const step = p.speed * dt;
        p.mesh.position.x += (dx / dist) * step;
        p.mesh.position.y += (dy / dist) * step;
        p.mesh.position.z += (dz / dist) * step;
      }
    }
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
      genre: '3d-puzzle',
      engine: 'threejs',
      supportsMultiplayer: false,
      controls: [
        { key: 'Click', action: 'Place Tower' },
        { key: 'Mouse', action: 'Select Grid Cell' },
      ],
      estimatedPlayTime: '5-15 min',
    },

    supportsMultiplayer: false,

    async init(el, config) {
      container = el;
      container.style.position = 'relative';
      buildScene(config.width, config.height);
      createHUD();

      renderer.domElement.addEventListener('click', onClick);

      window.parent.postMessage({ type: 'sloppy:game:ready' }, '*');
    },

    destroy() {
      cancelAnimationFrame(animationId);
      renderer.domElement.removeEventListener('click', onClick);
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
        <div style="font-size:18px;margin-bottom:8px;">Click the grid to place towers</div>
        <div style="font-size:18px;margin-bottom:8px;">Enemies follow the path — defend your base!</div>
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
      const best = Math.max(result.score, parseInt(localStorage.getItem('td_best') || '0'));
      localStorage.setItem('td_best', String(best));
      const ol = createOverlay();
      ol.innerHTML = `
        <div style="font-size:40px;font-weight:bold;color:#ff4444;margin-bottom:12px;">GAME OVER</div>
        <div style="font-size:24px;margin-bottom:8px;">Score: ${result.score} • Wave: ${wave}</div>
        <div style="font-size:18px;opacity:0.7;margin-bottom:8px;">Best: ${best}</div>
        <div style="font-size:20px;cursor:pointer;margin-top:16px;animation:pulse 1.5s ease-in-out infinite;" id="restart-btn">Click to Play Again</div>
        <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}</style>
      `;
      ol.querySelector('#restart-btn').addEventListener('click', () => game.restart(), { once: true });
    },

    renderHUD() {
      if (hudEl) {
        hudEl.innerHTML = `
          <div>Wave: ${wave + 1} &nbsp; Lives: ${lives}</div>
          <div>Gold: ${gold} &nbsp; Score: ${score}</div>
        `;
      }
    },

    getState() { return state; },

    getScore() {
      return { score, level: wave + 1, timeElapsed: Math.floor(timeElapsed) };
    },
  };

  window.SloppyGame = game;
  window.game = game;
})();
