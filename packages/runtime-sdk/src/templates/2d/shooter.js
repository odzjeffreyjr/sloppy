/**
 * Sloppy SDK v2 — 2D Shooter / Bullet-Hell Template (Phaser 3)
 *
 * Boilerplate: Vertical scrolling shooter, auto-scroll background, projectile
 * pooling (player + enemy bullets), enemy wave spawning, power-up drops,
 * combo multiplier, and all SDK v2 lifecycle methods.
 *
 * The AI fills in: enemy types, bullet patterns, power-up effects, visual
 * theme, wave formations, and difficulty progression.
 */

(function () {
  // ── Config ──────────────────────────────────────────────────────────────
  const GAME_TITLE = '2D Shooter';
  const WIDTH = 960;
  const HEIGHT = 540;
  const SCROLL_SPEED = 80;
  const MOVE_SPEED = 280;
  const BULLET_SPEED = -500;
  const ENEMY_BULLET_SPEED = 200;
  const SHOOT_COOLDOWN = 120;
  const MAX_BULLETS = 40;
  const MAX_ENEMY_BULLETS = 50;
  const COMBO_WINDOW_MS = 1500;

  // ── State ───────────────────────────────────────────────────────────────
  let phaserGame = null;
  let container;
  let state = 'idle';
  const shared = { score: 0, wave: 1, lives: 3, time: 0, combo: 1, lastKillAt: 0 };

  // ── Boot Scene ──────────────────────────────────────────────────────────

  class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    create() {
      const g = this.add.graphics();

      // Player ship (blue triangle)
      g.fillStyle(0x4488ff);
      g.fillTriangle(16, 0, 0, 28, 32, 28);
      g.generateTexture('player', 32, 28);

      // Enemy (red diamond)
      g.clear();
      g.fillStyle(0xff4444);
      g.fillTriangle(12, 0, 24, 12, 12, 24, 0, 12);
      g.generateTexture('enemy', 24, 24);

      // Player bullet (cyan)
      g.clear();
      g.fillStyle(0x44ffff);
      g.fillRect(0, 0, 6, 12);
      g.generateTexture('bullet', 6, 12);

      // Enemy bullet (red/orange)
      g.clear();
      g.fillStyle(0xff8844);
      g.fillCircle(4, 4, 4);
      g.generateTexture('enemyBullet', 8, 8);

      // Power-ups
      g.clear();
      g.fillStyle(0xffcc00);
      g.fillRect(2, 2, 12, 12);
      g.generateTexture('powerup', 16, 16);

      // Scrolling background (dark stripes)
      g.clear();
      g.fillStyle(0x1a1a3a);
      g.fillRect(0, 0, 64, 64);
      g.fillStyle(0x0f0f2a);
      for (let i = 0; i < 64; i += 8) g.fillRect(0, i, 64, 4);
      g.generateTexture('bg', 64, 64);

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
      this.cameras.main.setBackgroundColor('#0a0a1a');

      this.add.text(cx, cy - 60, GAME_TITLE, {
        fontSize: '48px', color: '#44aaff', fontFamily: 'Arial'
      }).setOrigin(0.5);

      this.add.text(cx, cy, 'WASD / Arrows — Move • Space — Shoot', {
        fontSize: '18px', color: '#ffffff', fontFamily: 'Arial'
      }).setOrigin(0.5);

      const best = localStorage.getItem('shooter_best') || '0';
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

      this.input.keyboard.once('keydown-SPACE', () => window.game.start());
      this.input.once('pointerdown', () => window.game.start());
    }
  }

  // ── Game Scene ──────────────────────────────────────────────────────────

  class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    create() {
      this.cameras.main.setBackgroundColor('#0a0a1a');
      shared.time = 0;
      shared.combo = 1;
      shared.lastKillAt = 0;
      this.lastShot = 0;
      this.waveSpawned = 0;

      // Scrolling background
      this.bg = this.add.tileSprite(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 'bg');

      // Player
      this.player = this.physics.add.sprite(WIDTH / 2, HEIGHT - 80, 'player');
      this.player.setCollideWorldBounds(true);
      this.player.setSize(20, 20);
      this.player.setOffset(6, 4);

      // Bullet pools
      this.bullets = this.physics.add.group({
        maxSize: MAX_BULLETS,
        runChildUpdate: false,
      });
      this.enemyBullets = this.physics.add.group({
        maxSize: MAX_ENEMY_BULLETS,
        runChildUpdate: false,
      });

      // Enemies
      this.enemies = this.physics.add.group();
      this.powerups = this.physics.add.group();

      // Collisions
      this.physics.add.overlap(this.bullets, this.enemies, (b, e) => {
        b.disableBody(true, true);
        e.disableBody(true, true);
        const now = this.time.now;
        if (now - shared.lastKillAt < COMBO_WINDOW_MS) shared.combo = Math.min(shared.combo + 0.5, 5);
        else shared.combo = 1;
        shared.lastKillAt = now;
        shared.score += Math.floor(100 * shared.combo);
        this.cameras.main.flash(80, 100, 200, 255);
        if (Math.random() < 0.15) this.spawnPowerup(e.x, e.y);
      }, null, this);

      this.physics.add.overlap(this.player, this.enemyBullets, (p, b) => {
        b.disableBody(true, true);
        shared.lives--;
        this.cameras.main.shake(150, 0.015);
        if (shared.lives <= 0) window.game.renderGameOverScreen(window.game.getScore());
      }, null, this);

      this.physics.add.overlap(this.player, this.enemies, () => {
        shared.lives--;
        this.cameras.main.shake(150, 0.015);
        if (shared.lives <= 0) window.game.renderGameOverScreen(window.game.getScore());
      }, null, this);

      this.physics.add.overlap(this.player, this.powerups, (p, pu) => {
        pu.disableBody(true, true);
        shared.lives = Math.min(shared.lives + 1, 5);
        this.cameras.main.flash(80, 255, 255, 100);
      }, null, this);

      // Input
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = {
        up: this.input.keyboard.addKey('W'),
        down: this.input.keyboard.addKey('S'),
        left: this.input.keyboard.addKey('A'),
        right: this.input.keyboard.addKey('D'),
        space: this.input.keyboard.addKey('SPACE'),
      };

      this.spawnWave();
      this.scoreText = this.add.text(16, 16, '', { fontSize: '18px', color: '#fff', fontFamily: 'Arial' }).setScrollFactor(0);
      this.waveText = this.add.text(WIDTH - 16, 16, '', { fontSize: '18px', color: '#fff', fontFamily: 'Arial' }).setOrigin(1, 0).setScrollFactor(0);
    }

    spawnPowerup(x, y) {
      const pu = this.powerups.get(x, y, 'powerup');
      if (pu) {
        pu.enableBody(true, x, y, true, true);
        pu.setVelocity(0, SCROLL_SPEED * 0.5);
        this.tweens.add({ targets: pu, alpha: 0.7, duration: 400, yoyo: true, repeat: -1 });
      }
    }

    spawnWave() {
      const count = 4 + shared.wave * 2;
      for (let i = 0; i < count; i++) {
        this.time.delayedCall(i * 400, () => {
          const ex = 80 + Math.random() * (WIDTH - 160);
          const e = this.enemies.create(ex, -30, 'enemy');
          if (e) {
            e.enableBody(true, ex, -30, true, true);
            e.setVelocity(0, SCROLL_SPEED * 0.8);
            e.setCollideWorldBounds(false);
            e.userData = { lastShot: 0 };
          }
        });
      }
      this.time.delayedCall(count * 400 + 2000, () => {
        if (this.enemies.countActive() === 0) {
          shared.wave++;
          this.spawnWave();
        } else {
          this.time.delayedCall(500, () => this.checkWaveComplete());
        }
      });
    }

    checkWaveComplete() {
      if (this.enemies.countActive() === 0) {
        shared.wave++;
        shared.score += 500;
        this.spawnWave();
      } else {
        this.time.delayedCall(500, () => this.checkWaveComplete());
      }
    }

    fireBullet() {
      const bullet = this.bullets.get(this.player.x, this.player.y - 14, 'bullet');
      if (bullet) {
        bullet.enableBody(true, this.player.x, this.player.y - 14, true, true);
        bullet.setVelocity(0, BULLET_SPEED);
        this.time.delayedCall(2000, () => { if (bullet.active) bullet.disableBody(true, true); });
      }
    }

    update(time, delta) {
      if (state !== 'playing') return;
      shared.time += delta / 1000;

      // Scroll background
      this.bg.tilePositionY += SCROLL_SPEED * (delta / 1000);

      // Movement
      let vx = 0, vy = 0;
      if (this.cursors.left.isDown || this.wasd.left.isDown) vx = -1;
      if (this.cursors.right.isDown || this.wasd.right.isDown) vx = 1;
      if (this.cursors.up.isDown || this.wasd.up.isDown) vy = -1;
      if (this.cursors.down.isDown || this.wasd.down.isDown) vy = 1;
      if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
      this.player.setVelocity(vx * MOVE_SPEED, vy * MOVE_SPEED);

      // Auto-fire
      if (time > this.lastShot + SHOOT_COOLDOWN) {
        this.lastShot = time;
        this.fireBullet();
      }

      // Enemy bullets
      this.enemies.getChildren().forEach(enemy => {
        if (!enemy.active) return;
        if (time > (enemy.userData.lastShot || 0) + 1200) {
          enemy.userData.lastShot = time;
          const b = this.enemyBullets.get(enemy.x, enemy.y, 'enemyBullet');
          if (b) {
            b.enableBody(true, enemy.x, enemy.y, true, true);
            this.physics.moveToObject(b, this.player, ENEMY_BULLET_SPEED);
            this.time.delayedCall(3000, () => { if (b.active) b.disableBody(true, true); });
          }
        }
      });

      // Despawn off-screen
      this.enemies.getChildren().forEach(e => {
        if (e.active && e.y > HEIGHT + 50) e.disableBody(true, true);
      });

      this.scoreText.setText(`Score: ${shared.score}  Combo: x${shared.combo.toFixed(1)}`);
      this.waveText.setText(`Wave ${shared.wave}  Lives: ${shared.lives}`);
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
      this.cameras.main.setBackgroundColor('#0a0a1a');
      const data = this.scene.settings.data || {};
      const result = data.score || { score: 0, timeElapsed: 0 };
      const best = Math.max(result.score, parseInt(localStorage.getItem('shooter_best') || '0'));
      localStorage.setItem('shooter_best', String(best));
      const isNew = result.score >= best && result.score > 0;

      this.add.text(cx, cy - 80, 'GAME OVER', { fontSize: '40px', color: '#ff4444', fontFamily: 'Arial' }).setOrigin(0.5);
      this.add.text(cx, cy - 20, `Score: ${result.score}  Wave: ${result.level ?? shared.wave}`, { fontSize: '24px', color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
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
      genre: '2d-shooter',
      engine: 'phaser3',
      supportsMultiplayer: false,
      controls: [
        { key: 'WASD/Arrows', action: 'Move' },
        { key: 'Space', action: 'Shoot' },
      ],
      estimatedPlayTime: '3-5 min',
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
      shared.score = 0; shared.wave = 1; shared.lives = 3; shared.time = 0; shared.combo = 1;
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
      return { score: shared.score, level: shared.wave, timeElapsed: Math.floor(shared.time) };
    },
  };

  window.SloppyGame = game;
  window.game = game;
})();
