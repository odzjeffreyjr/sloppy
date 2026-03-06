/**
 * Sloppy SDK v2 — 2D Platformer Template (Phaser 3)
 *
 * Boilerplate: Phaser platform physics, multi-scene setup (Boot, Intro,
 * Game, Pause, GameOver), procedural sprite generation, gravity/jump,
 * platform collision, collectibles, and all SDK v2 lifecycle methods.
 *
 * The AI fills in: level design, enemy types, power-ups, visual theme,
 * progression, scoring, and specific platform layouts.
 */

(function () {
  // ── Config ──────────────────────────────────────────────────────────────
  const GAME_TITLE = 'Platformer';
  const WIDTH = 960;
  const HEIGHT = 540;
  const GRAVITY_Y = 600;
  const JUMP_VELOCITY = -400;
  const MOVE_SPEED = 200;

  // ── State ───────────────────────────────────────────────────────────────
  let phaserGame = null;
  let container;
  let state = 'idle';
  let score = 0, level = 1, lives = 3, timeElapsed = 0;

  // Shared state accessible by all scenes
  const shared = { score: 0, level: 1, lives: 3, time: 0 };

  // ── Boot Scene ──────────────────────────────────────────────────────────

  class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    create() {
      // Generate textures
      const g = this.add.graphics();

      // Player (blue square)
      g.fillStyle(0x4488ff);
      g.fillRect(0, 0, 32, 32);
      g.generateTexture('player', 32, 32);

      // Platform (brown)
      g.clear();
      g.fillStyle(0x885522);
      g.fillRect(0, 0, 128, 16);
      g.generateTexture('platform', 128, 16);

      // Collectible (yellow circle)
      g.clear();
      g.fillStyle(0xffcc00);
      g.fillCircle(8, 8, 8);
      g.generateTexture('coin', 16, 16);

      // Hazard (red triangle)
      g.clear();
      g.fillStyle(0xff3333);
      g.fillTriangle(12, 0, 0, 24, 24, 24);
      g.generateTexture('hazard', 24, 24);

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

      this.add.text(cx, cy, 'Arrow Keys / WASD — Move & Jump', {
        fontSize: '18px', color: '#ffffff', fontFamily: 'Arial'
      }).setOrigin(0.5);

      const best = localStorage.getItem('plat_best') || '0';
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

      // Player
      this.player = this.physics.add.sprite(100, HEIGHT - 100, 'player');
      this.player.setBounce(0.1);
      this.player.setCollideWorldBounds(true);

      // Platforms
      this.platforms = this.physics.add.staticGroup();
      // Ground
      for (let x = 0; x < WIDTH; x += 128) {
        this.platforms.create(x + 64, HEIGHT - 8, 'platform');
      }
      // Floating platforms
      this.platforms.create(200, 400, 'platform');
      this.platforms.create(500, 300, 'platform');
      this.platforms.create(750, 380, 'platform');
      this.platforms.create(350, 200, 'platform');

      this.physics.add.collider(this.player, this.platforms);

      // Collectibles
      this.coins = this.physics.add.group();
      [{ x: 200, y: 370 }, { x: 500, y: 270 }, { x: 750, y: 350 }, { x: 350, y: 170 }].forEach(p => {
        const c = this.coins.create(p.x, p.y, 'coin');
        c.setBounceY(0.3);
        this.tweens.add({ targets: c, y: p.y - 8, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      });

      this.physics.add.collider(this.coins, this.platforms);
      this.physics.add.overlap(this.player, this.coins, (_, coin) => {
        coin.disableBody(true, true);
        shared.score += 50;
        this.cameras.main.flash(100, 255, 204, 0);
      }, null, this);

      // Hazards
      this.hazards = this.physics.add.staticGroup();
      this.hazards.create(400, HEIGHT - 24, 'hazard');

      this.physics.add.overlap(this.player, this.hazards, () => {
        shared.lives--;
        this.cameras.main.shake(200, 0.01);
        if (shared.lives <= 0) {
          window.game.renderGameOverScreen(window.game.getScore());
        } else {
          this.player.setPosition(100, HEIGHT - 100);
          this.player.setVelocity(0, 0);
        }
      }, null, this);

      // Input
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = {
        up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };

      // HUD (fixed to camera)
      this.scoreText = this.add.text(16, 16, '', { fontSize: '18px', color: '#fff', fontFamily: 'Arial' }).setScrollFactor(0);
      this.livesText = this.add.text(WIDTH - 16, 16, '', { fontSize: '18px', color: '#fff', fontFamily: 'Arial' }).setOrigin(1, 0).setScrollFactor(0);
    }

    update(time, delta) {
      if (state !== 'playing') return;
      const dt = delta / 1000;
      shared.time += dt;

      // Movement
      const left = this.cursors.left.isDown || this.wasd.left.isDown;
      const right = this.cursors.right.isDown || this.wasd.right.isDown;
      const jump = this.cursors.up.isDown || this.wasd.up.isDown || this.cursors.space?.isDown;

      if (left) this.player.setVelocityX(-MOVE_SPEED);
      else if (right) this.player.setVelocityX(MOVE_SPEED);
      else this.player.setVelocityX(0);

      if (jump && this.player.body.blocked.down) {
        this.player.setVelocityY(JUMP_VELOCITY);
      }

      // HUD
      this.scoreText.setText(`Score: ${shared.score}  Level: ${shared.level}`);
      this.livesText.setText(`Lives: ${shared.lives}`);

      // Win condition: all coins collected
      if (this.coins.countActive() === 0) {
        shared.level++;
        shared.score += 200;
        window.game.renderGameOverScreen(window.game.getScore());
      }
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

      const best = Math.max(result.score, parseInt(localStorage.getItem('plat_best') || '0'));
      localStorage.setItem('plat_best', String(best));
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
      genre: '2d-platformer',
      engine: 'phaser3',
      supportsMultiplayer: false,
      controls: [
        { key: 'Arrow Keys / WASD', action: 'Move' },
        { key: 'Up / W', action: 'Jump' },
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
          arcade: { gravity: { y: GRAVITY_Y }, debug: false },
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
      shared.score = 0; shared.level = 1; shared.lives = 3; shared.time = 0;
      score = 0; level = 1; lives = 3; timeElapsed = 0;
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
      score = shared.score; level = shared.level; timeElapsed = shared.time;
      phaserGame.scene.stop('GameScene');
      phaserGame.scene.start('GameOverScene', { score: result });
    },

    renderHUD() {
      // HUD is rendered inside GameScene.update() using Phaser text objects
    },

    getState() { return state; },

    getScore() {
      return {
        score: shared.score,
        level: shared.level,
        timeElapsed: Math.floor(shared.time),
      };
    },
  };

  window.SloppyGame = game;
  window.game = game;
})();
