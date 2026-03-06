/**
 * Sloppy SDK v2 — 2D Tower Defense Template (Phaser 3)
 *
 * Boilerplate: Grid-based tower placement, waypoint enemy paths, basic shooter
 * tower with range visualization, gold economy, wave spawning, base lives,
 * and all SDK v2 lifecycle methods.
 *
 * The AI fills in: tower types, enemy variants, path layouts, visual theme,
 * upgrade systems, and scoring mechanics.
 */

(function () {
  // ── Config ──────────────────────────────────────────────────────────────
  const GAME_TITLE = 'Tower Defense';
  const WIDTH = 960;
  const HEIGHT = 540;
  const CELL = 48;
  const GRID_COLS = Math.floor(WIDTH / CELL);
  const GRID_ROWS = Math.floor(HEIGHT / CELL);
  const TOWER_COST = 50;
  const GOLD_PER_KILL = 10;
  const INITIAL_GOLD = 100;
  const INITIAL_LIVES = 20;
  const TOWER_RANGE = 120;
  const TOWER_DAMAGE = 25;
  const TOWER_FIRE_RATE = 600;
  const ENEMY_SPEED = 80;
  const ENEMY_HP = 50;
  const WAYPOINT_THRESHOLD = 12;

  // Waypoints: top-left → right → down → right → bottom (base)
  const WAYPOINTS = [
    { x: 24, y: 24 },
    { x: WIDTH - 24, y: 24 },
    { x: WIDTH - 24, y: HEIGHT / 2 },
    { x: 24, y: HEIGHT / 2 },
    { x: 24, y: HEIGHT - 24 },
  ];

  // ── State ───────────────────────────────────────────────────────────────
  let phaserGame = null;
  let container;
  let state = 'idle';
  const shared = { score: 0, wave: 1, lives: INITIAL_LIVES, gold: INITIAL_GOLD };

  // ── Boot Scene ──────────────────────────────────────────────────────────

  class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    create() {
      const g = this.add.graphics();

      g.fillStyle(0x4488ff);
      g.fillRect(0, 0, CELL - 4, CELL - 4);
      g.generateTexture('tower', CELL, CELL);

      g.clear();
      g.fillStyle(0xff4444);
      g.fillCircle(10, 10, 10);
      g.generateTexture('enemy', 20, 20);

      g.clear();
      g.fillStyle(0xffff44);
      g.fillCircle(4, 4, 4);
      g.generateTexture('projectile', 8, 8);

      g.clear();
      g.fillStyle(0x334433);
      g.fillRect(0, 0, CELL, CELL);
      g.lineStyle(1, 0x445544);
      g.strokeRect(0, 0, CELL, CELL);
      g.generateTexture('grid', CELL, CELL);

      g.clear();
      g.fillStyle(0x553333, 0.8);
      g.fillRect(0, 0, CELL, CELL);
      g.generateTexture('path', CELL, CELL);

      g.destroy();
      this.scene.start('IntroScene');
    }
  }

  // ── Intro Scene ─────────────────────────────────────────────────────────

  class IntroScene extends Phaser.Scene {
    constructor() { super('IntroScene'); }
    create() {
      state = 'intro';
      const cx = WIDTH / 2, cy = HEIGHT / 2;
      this.cameras.main.setBackgroundColor('#1a2e1a');

      this.add.text(cx, cy - 60, GAME_TITLE, {
        fontSize: '48px', color: '#ffcc00', fontFamily: 'Arial'
      }).setOrigin(0.5);

      this.add.text(cx, cy, 'Click — Place Tower', {
        fontSize: '18px', color: '#ffffff', fontFamily: 'Arial'
      }).setOrigin(0.5);

      const best = localStorage.getItem('td_best') || '0';
      this.add.text(cx, cy + 40, `High Score: ${best}`, {
        fontSize: '16px', color: '#aaaaaa', fontFamily: 'Arial'
      }).setOrigin(0.5);

      const prompt = this.add.text(cx, cy + 100, 'Press SPACE or Click to Start', {
        fontSize: '22px', color: '#ffffff', fontFamily: 'Arial'
      }).setOrigin(0.5);

      this.tweens.add({
        targets: prompt, alpha: 0.3, duration: 800,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });

      this.input.keyboard.once('keydown-SPACE', () => { window.game.start(); });
      this.input.once('pointerdown', () => { window.game.start(); });
    }
  }

  // ── Game Scene ──────────────────────────────────────────────────────────

  class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    create() {
      this.cameras.main.setBackgroundColor('#1a2e1a');
      shared.gold = INITIAL_GOLD;
      shared.lives = INITIAL_LIVES;
      shared.wave = 1;
      shared.score = 0;

      // Path cells (invalid for placement)
      this.pathCells = new Set();
      const pathPts = WAYPOINTS;
      for (let i = 0; i < pathPts.length - 1; i++) {
        const a = pathPts[i], b = pathPts[i + 1];
        const steps = Math.max(1, Math.floor(Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) / (CELL / 2)));
        for (let t = 0; t <= steps; t++) {
          const x = Math.round((a.x + (b.x - a.x) * t / steps) / CELL) * CELL + CELL / 2;
          const y = Math.round((a.y + (b.y - a.y) * t / steps) / CELL) * CELL + CELL / 2;
          this.pathCells.add(`${Math.floor(x / CELL)},${Math.floor(y / CELL)}`);
        }
      }

      // Grid & path visuals
      for (let gy = 0; gy < GRID_ROWS; gy++) {
        for (let gx = 0; gx < GRID_COLS; gx++) {
          const key = this.pathCells.has(`${gx},${gy}`) ? 'path' : 'grid';
          this.add.image(gx * CELL + CELL / 2, gy * CELL + CELL / 2, key);
        }
      }

      this.towers = this.add.group();
      this.enemies = this.physics.add.group({ allowGravity: false });
      this.projectiles = this.physics.add.group({ allowGravity: false });

      // Range indicator (hidden by default)
      this.rangeCircle = this.add.graphics().setVisible(false);

      // Wave state
      this.waveInProgress = false;
      this.waveSpawnIndex = 0;
      this.waveSpawnTimer = 0;
      this.enemiesToSpawn = 0;

      // Tower targeting & projectiles
      this.physics.add.overlap(this.projectiles, this.enemies, (proj, enemy) => {
        proj.disableBody(true, true);
        enemy.userData.hp -= (proj.userData?.damage || TOWER_DAMAGE);
        if (enemy.userData.hp <= 0) {
          enemy.disableBody(true, true);
          shared.gold += GOLD_PER_KILL;
          shared.score += 10;
          this.cameras.main.flash(50, 255, 204, 0);
        }
      }, null, this);

      // Click to place tower
      this.input.on('pointerdown', (p) => {
        if (state !== 'playing') return;
        const gx = Math.floor(p.x / CELL), gy = Math.floor(p.y / CELL);
        if (gx < 0 || gx >= GRID_COLS || gy < 0 || gy >= GRID_ROWS) return;
        if (this.pathCells.has(`${gx},${gy}`)) return;
        const cx = gx * CELL + CELL / 2, cy = gy * CELL + CELL / 2;
        const occupied = this.towers.getChildren().some(t => Math.abs(t.x - cx) < 2 && Math.abs(t.y - cy) < 2);
        if (occupied || shared.gold < TOWER_COST) return;
        shared.gold -= TOWER_COST;
        const tower = this.add.image(cx, cy, 'tower');
        tower.userData = { lastFire: 0, range: TOWER_RANGE };
        this.towers.add(tower);
      });

      // Hover: show range of tower under cursor
      this.input.on('pointermove', (p) => {
        const gx = Math.floor(p.x / CELL), gy = Math.floor(p.y / CELL);
        const cx = gx * CELL + CELL / 2, cy = gy * CELL + CELL / 2;
        const tower = this.towers.getChildren().find(t => Math.abs(t.x - cx) < 2 && Math.abs(t.y - cy) < 2);
        this.rangeCircle.setVisible(!!tower);
        if (tower) {
          this.rangeCircle.clear();
          this.rangeCircle.lineStyle(2, 0x4488ff, 0.5);
          this.rangeCircle.strokeCircle(tower.x, tower.y, tower.userData.range);
        }
      });

      // HUD
      this.goldText = this.add.text(16, 16, '', { fontSize: '18px', color: '#ffcc00', fontFamily: 'Arial' }).setScrollFactor(0);
      this.waveText = this.add.text(WIDTH / 2 - 60, 16, '', { fontSize: '18px', color: '#fff', fontFamily: 'Arial' }).setScrollFactor(0);
      this.livesText = this.add.text(WIDTH - 16, 16, '', { fontSize: '18px', color: '#ff4444', fontFamily: 'Arial' }).setOrigin(1, 0).setScrollFactor(0);
      this.scoreText = this.add.text(16, 44, '', { fontSize: '16px', color: '#aaa', fontFamily: 'Arial' }).setScrollFactor(0);
    }

    startWave() {
      this.waveInProgress = true;
      this.enemiesToSpawn = 5 + shared.wave * 2;
      this.waveSpawnIndex = 0;
      this.waveSpawnTimer = 0;
    }

    spawnEnemy() {
      const e = this.enemies.create(WAYPOINTS[0].x, WAYPOINTS[0].y, 'enemy');
      e.userData = { waypointIndex: 0, hp: ENEMY_HP + shared.wave * 5 };
    }

    update(time, delta) {
      if (state !== 'playing') return;

      // Wave logic
      if (!this.waveInProgress) {
        if (this.enemies.countActive() === 0) {
          this.startWave();
        }
      } else {
        this.waveSpawnTimer += delta;
        if (this.waveSpawnTimer >= 400 && this.waveSpawnIndex < this.enemiesToSpawn) {
          this.waveSpawnTimer = 0;
          this.waveSpawnIndex++;
          this.spawnEnemy();
        }
        if (this.waveSpawnIndex >= this.enemiesToSpawn && this.enemies.countActive() === 0) {
          this.waveInProgress = false;
          shared.wave++;
          shared.score += 50;
        }
      }

      // Enemies follow waypoints
      this.enemies.getChildren().forEach(enemy => {
        if (!enemy.active) return;
        const idx = enemy.userData.waypointIndex;
        if (idx >= WAYPOINTS.length) {
          enemy.disableBody(true, true);
          shared.lives--;
          this.cameras.main.shake(150, 0.01);
          if (shared.lives <= 0) window.game.renderGameOverScreen(window.game.getScore());
          return;
        }
        const wp = WAYPOINTS[idx];
        const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, wp.x, wp.y);
        if (dist < WAYPOINT_THRESHOLD) {
          enemy.userData.waypointIndex++;
        } else {
          const speed = ENEMY_SPEED + shared.wave * 3;
          this.physics.moveTo(enemy, wp.x, wp.y, speed);
        }
      });

      // Towers shoot
      this.towers.getChildren().forEach(tower => {
        if (time < tower.userData.lastFire + TOWER_FIRE_RATE) return;
        const inRange = this.enemies.getChildren().filter(e =>
          e.active && Phaser.Math.Distance.Between(tower.x, tower.y, e.x, e.y) < tower.userData.range
        );
        if (inRange.length === 0) return;
        const target = inRange.reduce((a, b) =>
          (a.userData.waypointIndex > b.userData.waypointIndex) ? a : b
        );
        tower.userData.lastFire = time;
        const proj = this.projectiles.get(tower.x, tower.y, 'projectile');
        if (proj) {
          proj.enableBody(true, tower.x, tower.y, true, true);
          proj.userData = { damage: TOWER_DAMAGE };
          this.physics.moveToObject(proj, target, 300);
          this.time.delayedCall(1500, () => { if (proj.active) proj.disableBody(true, true); });
        }
      });

      // HUD
      this.goldText.setText(`Gold: ${shared.gold}`);
      this.waveText.setText(`Wave ${shared.wave}`);
      this.livesText.setText(`Lives: ${shared.lives}`);
      this.scoreText.setText(`Score: ${shared.score}`);
    }
  }

  // ── Pause Scene ─────────────────────────────────────────────────────────

  class PauseScene extends Phaser.Scene {
    constructor() { super('PauseScene'); }
    create() {
      const cx = WIDTH / 2, cy = HEIGHT / 2;
      this.add.rectangle(cx, cy, WIDTH, HEIGHT, 0x000000, 0.6);
      this.add.text(cx, cy - 30, 'PAUSED', { fontSize: '36px', color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
      const p = this.add.text(cx, cy + 30, 'Press SPACE or Click to Resume', { fontSize: '20px', color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
      this.tweens.add({ targets: p, alpha: 0.3, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.input.keyboard.once('keydown-SPACE', () => window.game.resume());
      this.input.once('pointerdown', () => window.game.resume());
    }
  }

  // ── Game Over Scene ─────────────────────────────────────────────────────

  class GameOverScene extends Phaser.Scene {
    constructor() { super('GameOverScene'); }
    create() {
      const cx = WIDTH / 2, cy = HEIGHT / 2;
      this.cameras.main.setBackgroundColor('#1a2e1a');
      const data = this.scene.settings.data || {};
      const result = data.score || { score: 0, timeElapsed: 0 };
      const best = Math.max(result.score, parseInt(localStorage.getItem('td_best') || '0'));
      localStorage.setItem('td_best', String(best));
      const isNew = result.score >= best && result.score > 0;

      this.add.text(cx, cy - 80, 'GAME OVER', { fontSize: '40px', color: '#ff4444', fontFamily: 'Arial' }).setOrigin(0.5);
      this.add.text(cx, cy - 20, `Score: ${result.score}`, { fontSize: '24px', color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
      if (isNew) {
        this.add.text(cx, cy + 20, 'NEW HIGH SCORE!', { fontSize: '20px', color: '#ffcc00', fontFamily: 'Arial' }).setOrigin(0.5);
      } else {
        this.add.text(cx, cy + 20, `Best: ${best}`, { fontSize: '18px', color: '#aaa', fontFamily: 'Arial' }).setOrigin(0.5);
      }
      const p = this.add.text(cx, cy + 80, 'Press SPACE or Click to Play Again', { fontSize: '20px', color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
      this.tweens.add({ targets: p, alpha: 0.3, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.input.keyboard.once('keydown-SPACE', () => window.game.restart());
      this.input.once('pointerdown', () => window.game.restart());
    }
  }

  // ── SDK v2 Game Object ──────────────────────────────────────────────────

  const game = {
    metadata: {
      title: GAME_TITLE,
      genre: '2d-tower-defense',
      engine: 'phaser3',
      supportsMultiplayer: false,
      controls: [{ key: 'Click', action: 'Place Tower' }],
      estimatedPlayTime: '5-15 min',
    },

    supportsMultiplayer: false,

    async init(el, config) {
      container = el;
      phaserGame = new Phaser.Game({
        type: Phaser.AUTO,
        parent: container,
        width: config.width || WIDTH,
        height: config.height || HEIGHT,
        backgroundColor: '#000000',
        physics: {
          default: 'arcade',
          arcade: { gravity: { y: 0 }, debug: false },
        },
        scene: [BootScene, IntroScene, GameScene, PauseScene, GameOverScene],
      });
      await new Promise(resolve => phaserGame.events.once('ready', resolve));
      window.parent.postMessage({ type: 'sloppy:game:ready' }, '*');
    },

    destroy() {
      if (phaserGame) { phaserGame.destroy(true); phaserGame = null; }
    },

    start() {
      shared.score = 0; shared.wave = 1; shared.lives = INITIAL_LIVES; shared.gold = INITIAL_GOLD;
      state = 'playing';
      phaserGame.scene.stop('IntroScene');
      phaserGame.scene.stop('GameOverScene');
      phaserGame.scene.stop('PauseScene');
      phaserGame.scene.start('GameScene');
    },

    pause() {
      state = 'paused';
      phaserGame.scene.pause('GameScene');
      phaserGame.scene.launch('PauseScene');
    },

    resume() {
      state = 'playing';
      phaserGame.scene.stop('PauseScene');
      phaserGame.scene.resume('GameScene');
    },

    restart() {
      phaserGame.scene.stop('PauseScene');
      phaserGame.scene.stop('GameOverScene');
      game.start();
    },

    renderIntroScreen() {
      state = 'intro';
      phaserGame.scene.start('IntroScene');
    },

    renderPauseScreen() {
      phaserGame.scene.launch('PauseScene');
    },

    renderGameOverScreen(result) {
      state = 'gameover';
      phaserGame.scene.stop('GameScene');
      phaserGame.scene.start('GameOverScene', { score: result });
    },

    renderHUD() {},

    getState() { return state; },

    getScore() {
      return { score: shared.score, wave: shared.wave, timeElapsed: 0 };
    },
  };

  window.SloppyGame = game;
  window.game = game;
})();
