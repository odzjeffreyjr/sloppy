/**
 * Sloppy SDK v2 — 2D Top-Down Template (Phaser 3)
 *
 * Boilerplate: 8-directional movement with diagonal normalization, projectile
 * pooling, enemy AI (chase, patrol), camera follow, multi-scene setup, and
 * all SDK v2 lifecycle methods.
 *
 * The AI fills in: enemy types, level layout, weapons, power-ups, visual
 * theme, progression, and scoring mechanics.
 */

(function () {
  // ── Config ──────────────────────────────────────────────────────────────
  const GAME_TITLE = 'Top-Down Game';
  const WIDTH = 960;
  const HEIGHT = 540;
  const MOVE_SPEED = 180;
  const BULLET_SPEED = 400;
  const SHOOT_COOLDOWN = 250;
  const ENEMY_SPEED = 80;
  const MAX_ENEMIES = 15;
  const MAX_BULLETS = 20;

  // ── State ───────────────────────────────────────────────────────────────
  let phaserGame = null;
  let container;
  let state = 'idle';
  const shared = { score: 0, level: 1, lives: 3, time: 0 };

  // ── Boot Scene ──────────────────────────────────────────────────────────

  class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    create() {
      const g = this.add.graphics();

      g.fillStyle(0x44aaff);
      g.fillCircle(12, 12, 12);
      g.generateTexture('player', 24, 24);

      g.clear();
      g.fillStyle(0xff4444);
      g.fillRect(0, 0, 20, 20);
      g.generateTexture('enemy', 20, 20);

      g.clear();
      g.fillStyle(0xffff44);
      g.fillCircle(3, 3, 3);
      g.generateTexture('bullet', 6, 6);

      g.clear();
      g.fillStyle(0x556655);
      g.fillRect(0, 0, 32, 32);
      g.lineStyle(1, 0x667766);
      g.strokeRect(0, 0, 32, 32);
      g.generateTexture('floor', 32, 32);

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
      this.cameras.main.setBackgroundColor('#1a2a1a');

      this.add.text(cx, cy - 60, GAME_TITLE, {
        fontSize: '48px', color: '#ffcc00', fontFamily: 'Arial'
      }).setOrigin(0.5);

      this.add.text(cx, cy, 'WASD / Arrows — Move • Space — Shoot', {
        fontSize: '18px', color: '#ffffff', fontFamily: 'Arial'
      }).setOrigin(0.5);

      const prompt = this.add.text(cx, cy + 80, 'Press SPACE or Click to Start', {
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
      this.cameras.main.setBackgroundColor('#1a2a1a');
      shared.time = 0;
      this.lastShot = 0;

      // World bounds
      this.physics.world.setBounds(0, 0, WIDTH * 2, HEIGHT * 2);

      // Floor tiling
      for (let x = 0; x < WIDTH * 2; x += 32) {
        for (let y = 0; y < HEIGHT * 2; y += 32) {
          this.add.image(x + 16, y + 16, 'floor');
        }
      }

      // Player
      this.player = this.physics.add.sprite(WIDTH, HEIGHT, 'player');
      this.player.setCollideWorldBounds(true);
      this.player.setDamping(true);
      this.player.setDrag(0.9);

      this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
      this.cameras.main.setDeadzone(80, 60);
      this.cameras.main.setBounds(0, 0, WIDTH * 2, HEIGHT * 2);

      // Bullets (pool)
      this.bullets = this.physics.add.group({
        maxSize: MAX_BULLETS,
        allowGravity: false,
      });

      // Enemies
      this.enemies = this.physics.add.group({ allowGravity: false });
      for (let i = 0; i < MAX_ENEMIES; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 200 + Math.random() * 400;
        const ex = WIDTH + Math.cos(angle) * dist;
        const ey = HEIGHT + Math.sin(angle) * dist;
        const e = this.enemies.create(ex, ey, 'enemy');
        e.setCollideWorldBounds(true);
        e.setBounce(1);
        e.userData = { patrolAngle: Math.random() * Math.PI * 2 };
      }

      // Collisions
      this.physics.add.overlap(this.bullets, this.enemies, (bullet, enemy) => {
        bullet.disableBody(true, true);
        enemy.disableBody(true, true);
        shared.score += 100;
        this.cameras.main.shake(80, 0.005);
      }, null, this);

      this.physics.add.overlap(this.player, this.enemies, () => {
        shared.lives--;
        this.cameras.main.flash(200, 255, 0, 0);
        if (shared.lives <= 0) {
          window.game.renderGameOverScreen(window.game.getScore());
        } else {
          this.player.setPosition(WIDTH, HEIGHT);
          this.player.setVelocity(0, 0);
        }
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

      // Facing direction for shooting
      this.facing = { x: 0, y: -1 };

      // HUD
      this.scoreText = this.add.text(16, 16, '', { fontSize: '18px', color: '#fff', fontFamily: 'Arial' }).setScrollFactor(0);
      this.livesText = this.add.text(WIDTH - 16, 16, '', { fontSize: '18px', color: '#fff', fontFamily: 'Arial' }).setOrigin(1, 0).setScrollFactor(0);
    }

    update(time, delta) {
      if (state !== 'playing') return;
      shared.time += delta / 1000;

      // 8-directional movement
      let vx = 0, vy = 0;
      if (this.cursors.left.isDown || this.wasd.left.isDown) vx = -1;
      if (this.cursors.right.isDown || this.wasd.right.isDown) vx = 1;
      if (this.cursors.up.isDown || this.wasd.up.isDown) vy = -1;
      if (this.cursors.down.isDown || this.wasd.down.isDown) vy = 1;

      // Diagonal normalization
      if (vx !== 0 && vy !== 0) {
        const norm = 1 / Math.SQRT2;
        vx *= norm;
        vy *= norm;
      }

      this.player.setVelocity(vx * MOVE_SPEED, vy * MOVE_SPEED);
      if (vx !== 0 || vy !== 0) { this.facing.x = vx; this.facing.y = vy; }

      // Shooting
      if (this.wasd.space.isDown && time > this.lastShot + SHOOT_COOLDOWN) {
        this.lastShot = time;
        const bullet = this.bullets.get(this.player.x, this.player.y, 'bullet');
        if (bullet) {
          bullet.enableBody(true, this.player.x, this.player.y, true, true);
          const len = Math.sqrt(this.facing.x ** 2 + this.facing.y ** 2) || 1;
          bullet.setVelocity(
            (this.facing.x / len) * BULLET_SPEED,
            (this.facing.y / len) * BULLET_SPEED
          );
          this.time.delayedCall(2000, () => {
            if (bullet.active) bullet.disableBody(true, true);
          });
        }
      }

      // Enemy AI: chase player
      this.enemies.getChildren().forEach(enemy => {
        if (!enemy.active) return;
        const dx = this.player.x - enemy.x;
        const dy = this.player.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 300 && dist > 0) {
          enemy.setVelocity((dx / dist) * ENEMY_SPEED, (dy / dist) * ENEMY_SPEED);
        } else {
          // Patrol
          enemy.userData.patrolAngle += 0.02;
          enemy.setVelocity(
            Math.cos(enemy.userData.patrolAngle) * ENEMY_SPEED * 0.5,
            Math.sin(enemy.userData.patrolAngle) * ENEMY_SPEED * 0.5
          );
        }
      });

      // Respawn enemies if all defeated
      if (this.enemies.countActive() === 0) {
        shared.level++;
        this.enemies.getChildren().forEach(enemy => {
          const angle = Math.random() * Math.PI * 2;
          const dist = 200 + Math.random() * 400;
          enemy.enableBody(true, WIDTH + Math.cos(angle) * dist, HEIGHT + Math.sin(angle) * dist, true, true);
        });
      }

      // HUD
      this.scoreText.setText(`Score: ${shared.score}  Level: ${shared.level}`);
      this.livesText.setText(`Lives: ${shared.lives}`);
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
      this.cameras.main.setBackgroundColor('#1a2a1a');
      const data = this.scene.settings.data || {};
      const result = data.score || { score: 0, timeElapsed: 0 };
      const best = Math.max(result.score, parseInt(localStorage.getItem('td_best2') || '0'));
      localStorage.setItem('td_best2', String(best));
      const isNew = result.score >= best && result.score > 0;

      this.add.text(cx, cy - 60, 'GAME OVER', { fontSize: '40px', color: '#ff4444', fontFamily: 'Arial' }).setOrigin(0.5);
      this.add.text(cx, cy, `Score: ${result.score}`, { fontSize: '24px', color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
      if (isNew) {
        this.add.text(cx, cy + 35, 'NEW HIGH SCORE!', { fontSize: '20px', color: '#ffcc00', fontFamily: 'Arial' }).setOrigin(0.5);
      } else {
        this.add.text(cx, cy + 35, `Best: ${best}`, { fontSize: '18px', color: '#aaa', fontFamily: 'Arial' }).setOrigin(0.5);
      }
      const p = this.add.text(cx, cy + 90, 'Press SPACE or Click to Play Again', { fontSize: '20px', color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
      this.tweens.add({ targets: p, alpha: 0.3, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.input.keyboard.once('keydown-SPACE', () => window.game.restart());
      this.input.once('pointerdown', () => window.game.restart());
    }
  }

  // ── SDK v2 Game Object ──────────────────────────────────────────────────

  const game = {
    metadata: {
      title: GAME_TITLE,
      genre: '2d-topdown',
      engine: 'phaser3',
      supportsMultiplayer: false,
      controls: [
        { key: 'WASD / Arrows', action: 'Move' },
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
      shared.score = 0; shared.level = 1; shared.lives = 3; shared.time = 0;
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
      return { score: shared.score, level: shared.level, timeElapsed: Math.floor(shared.time) };
    },
  };

  window.SloppyGame = game;
  window.game = game;
})();
