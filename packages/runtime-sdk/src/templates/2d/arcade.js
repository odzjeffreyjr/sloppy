/**
 * Sloppy SDK v2 — 2D Arcade Template (Phaser 3)
 *
 * Boilerplate: dodge/collect gameplay, falling obstacles and collectibles,
 * lives system with invincibility frames, difficulty scaling with score/time,
 * spawn patterns via time events, high score persistence, and all SDK v2
 * lifecycle methods.
 *
 * The AI fills in: visual theme, obstacle/collectible variety, power-ups,
 * spawn patterns, and scoring nuances.
 */

(function () {
  // ── Config ──────────────────────────────────────────────────────────────
  const GAME_TITLE = 'Arcade';
  const WIDTH = 960;
  const HEIGHT = 540;
  const MOVE_SPEED = 280;
  const OBSTACLE_FALL_SPEED = 180;
  const COLLECTIBLE_FALL_SPEED = 120;
  const INVINCIBILITY_MS = 1500;
  const INITIAL_SPAWN_INTERVAL = 1200;
  const MIN_SPAWN_INTERVAL = 400;
  const DIFFICULTY_SCORE_STEP = 500;

  // ── State ───────────────────────────────────────────────────────────────
  let phaserGame = null;
  let container;
  let state = 'idle';
  const shared = { score: 0, lives: 3, time: 0, difficulty: 1 };

  // ── Boot Scene ──────────────────────────────────────────────────────────

  class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    create() {
      const g = this.add.graphics();

      // Player (blue square)
      g.fillStyle(0x4488ff);
      g.fillRect(0, 0, 36, 36);
      g.generateTexture('player', 36, 36);

      // Obstacle (red square)
      g.clear();
      g.fillStyle(0xff3333);
      g.fillRect(0, 0, 32, 32);
      g.generateTexture('obstacle', 32, 32);

      // Collectible (yellow circle)
      g.clear();
      g.fillStyle(0xffcc00);
      g.fillCircle(10, 10, 10);
      g.generateTexture('collectible', 20, 20);

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
      this.cameras.main.setBackgroundColor('#1a1a2e');

      this.add.text(cx, cy - 60, GAME_TITLE, {
        fontSize: '48px', color: '#ffcc00', fontFamily: 'Arial'
      }).setOrigin(0.5);

      this.add.text(cx, cy, 'Arrow Keys / A/D — Dodge obstacles, collect items', {
        fontSize: '18px', color: '#ffffff', fontFamily: 'Arial'
      }).setOrigin(0.5);

      const best = localStorage.getItem('arcade_best') || '0';
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
      this.cameras.main.setBackgroundColor('#1a1a2e');
      shared.time = 0;
      shared.difficulty = 1;
      this.invincibleUntil = 0;
      this.spawnInterval = INITIAL_SPAWN_INTERVAL;

      // Player
      this.player = this.physics.add.sprite(WIDTH / 2, HEIGHT - 80, 'player');
      this.player.setCollideWorldBounds(true);
      this.player.setVelocity(0, 0);

      // Falling objects
      this.obstacles = this.physics.add.group();
      this.collectibles = this.physics.add.group();

      this.physics.add.overlap(this.player, this.obstacles, (_, obs) => {
        if (this.time.now < this.invincibleUntil) return;
        obs.disableBody(true, true);
        shared.lives--;
        this.invincibleUntil = this.time.now + INVINCIBILITY_MS;
        this.player.setAlpha(0.5);
        this.cameras.main.shake(200, 0.01);
        this.time.delayedCall(INVINCIBILITY_MS, () => {
          this.player.setAlpha(1);
        });
        if (shared.lives <= 0) {
          window.game.renderGameOverScreen(window.game.getScore());
        }
      }, null, this);

      this.physics.add.overlap(this.player, this.collectibles, (_, col) => {
        col.disableBody(true, true);
        shared.score += 25 * Math.floor(shared.difficulty);
        this.cameras.main.flash(80, 255, 204, 0);
      }, null, this);

      // Input
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keys = {
        left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };

      // Spawn loop
      this.spawnEvent = this.time.addEvent({
        delay: this.spawnInterval,
        callback: this.spawnFallingObject,
        callbackScope: this,
        loop: true,
      });

      // Pause on ESC
      this.input.keyboard.on('keydown-ESC', () => { window.game.pause(); });

      // HUD
      this.scoreText = this.add.text(16, 16, '', { fontSize: '18px', color: '#fff', fontFamily: 'Arial' }).setScrollFactor(0);
      this.livesText = this.add.text(WIDTH - 16, 16, '', { fontSize: '18px', color: '#fff', fontFamily: 'Arial' }).setOrigin(1, 0).setScrollFactor(0);
    }

    spawnFallingObject() {
      const isCollectible = Phaser.Math.Between(0, 1) === 1;
      const x = Phaser.Math.Between(40, WIDTH - 40);
      const speed = OBSTACLE_FALL_SPEED * shared.difficulty;

      if (isCollectible) {
        const c = this.collectibles.create(x, -20, 'collectible');
        c.setVelocity(0, COLLECTIBLE_FALL_SPEED * shared.difficulty);
      } else {
        const o = this.obstacles.create(x, -20, 'obstacle');
        o.setVelocity(0, speed);
      }
    }

    update(time, delta) {
      if (state !== 'playing') return;
      shared.time += delta / 1000;

      // Remove off-screen objects
      this.obstacles.getChildren().forEach(obj => {
        if (obj.active && obj.y > HEIGHT + 50) obj.disableBody(true, true);
      });
      this.collectibles.getChildren().forEach(obj => {
        if (obj.active && obj.y > HEIGHT + 50) obj.disableBody(true, true);
      });

      // Difficulty scaling
      const prevDiff = shared.difficulty;
      shared.difficulty = 1 + Math.floor(shared.score / DIFFICULTY_SCORE_STEP) * 0.2;
      if (shared.difficulty > prevDiff) {
        this.spawnInterval = Math.max(MIN_SPAWN_INTERVAL, INITIAL_SPAWN_INTERVAL - shared.difficulty * 150);
        this.spawnEvent.destroy();
        this.spawnEvent = this.time.addEvent({
          delay: this.spawnInterval,
          callback: this.spawnFallingObject,
          callbackScope: this,
          loop: true,
        });
      }

      // Movement
      const left = this.cursors.left.isDown || this.keys.left.isDown;
      const right = this.cursors.right.isDown || this.keys.right.isDown;
      if (left) this.player.setVelocityX(-MOVE_SPEED);
      else if (right) this.player.setVelocityX(MOVE_SPEED);
      else this.player.setVelocityX(0);

      // HUD
      this.scoreText.setText(`Score: ${shared.score}`);
      this.livesText.setText(`Lives: ${shared.lives}`);
    }
  }

  // ── Pause Scene ─────────────────────────────────────────────────────────

  class PauseScene extends Phaser.Scene {
    constructor() { super('PauseScene'); }
    create() {
      const cx = WIDTH / 2, cy = HEIGHT / 2;
      this.add.rectangle(cx, cy, WIDTH, HEIGHT, 0x000000, 0.6);

      this.add.text(cx, cy - 30, 'PAUSED', {
        fontSize: '36px', color: '#ffffff', fontFamily: 'Arial'
      }).setOrigin(0.5);

      const prompt = this.add.text(cx, cy + 30, 'Press SPACE or Click to Resume', {
        fontSize: '20px', color: '#ffffff', fontFamily: 'Arial'
      }).setOrigin(0.5);

      this.tweens.add({
        targets: prompt, alpha: 0.3, duration: 800,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });

      this.input.keyboard.once('keydown-SPACE', () => { window.game.resume(); });
      this.input.once('pointerdown', () => { window.game.resume(); });
    }
  }

  // ── Game Over Scene ─────────────────────────────────────────────────────

  class GameOverScene extends Phaser.Scene {
    constructor() { super('GameOverScene'); }
    create() {
      const cx = WIDTH / 2, cy = HEIGHT / 2;
      this.cameras.main.setBackgroundColor('#1a1a2e');
      const data = this.scene.settings.data || {};
      const result = data.score || { score: 0, timeElapsed: 0 };

      const best = Math.max(result.score, parseInt(localStorage.getItem('arcade_best') || '0'));
      localStorage.setItem('arcade_best', String(best));
      const isNew = result.score >= best && result.score > 0;

      this.add.text(cx, cy - 80, 'GAME OVER', {
        fontSize: '40px', color: '#ff4444', fontFamily: 'Arial'
      }).setOrigin(0.5);

      this.add.text(cx, cy - 20, `Score: ${result.score}`, {
        fontSize: '24px', color: '#ffffff', fontFamily: 'Arial'
      }).setOrigin(0.5);

      if (isNew) {
        this.add.text(cx, cy + 20, 'NEW HIGH SCORE!', {
          fontSize: '20px', color: '#ffcc00', fontFamily: 'Arial'
        }).setOrigin(0.5);
      } else {
        this.add.text(cx, cy + 20, `Best: ${best}`, {
          fontSize: '18px', color: '#aaaaaa', fontFamily: 'Arial'
        }).setOrigin(0.5);
      }

      const prompt = this.add.text(cx, cy + 80, 'Press SPACE or Click to Play Again', {
        fontSize: '20px', color: '#ffffff', fontFamily: 'Arial'
      }).setOrigin(0.5);

      this.tweens.add({
        targets: prompt, alpha: 0.3, duration: 800,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });

      this.input.keyboard.once('keydown-SPACE', () => { window.game.restart(); });
      this.input.once('pointerdown', () => { window.game.restart(); });
    }
  }

  // ── SDK v2 Game Object ──────────────────────────────────────────────────

  const game = {
    metadata: {
      title: GAME_TITLE,
      genre: '2d-arcade',
      engine: 'phaser3',
      supportsMultiplayer: false,
      controls: [
        { key: 'Arrow Keys / A / D', action: 'Move Left/Right' },
        { key: 'ESC', action: 'Pause' },
      ],
      estimatedPlayTime: '2-5 min',
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

      await new Promise(resolve => {
        phaserGame.events.once('ready', resolve);
      });
      window.parent.postMessage({ type: 'sloppy:game:ready' }, '*');
    },

    destroy() {
      if (phaserGame) { phaserGame.destroy(true); phaserGame = null; }
    },

    start() {
      shared.score = 0; shared.lives = 3; shared.time = 0; shared.difficulty = 1;
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
      return {
        score: shared.score,
        timeElapsed: Math.floor(shared.time),
      };
    },
  };

  window.SloppyGame = game;
  window.game = game;
})();
