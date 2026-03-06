/**
 * Sloppy SDK v2 — 2D Endless Runner Template (Phaser 3)
 *
 * Boilerplate: auto-run with fixed player X, tileSprite scrolling ground,
 * jump/duck mechanics, procedural obstacle spawning (ground + overhead),
 * speed ramp, distance-based score, and all SDK v2 lifecycle methods.
 *
 * The AI fills in: visual theme, obstacle variety, power-ups, and scoring nuances.
 */

(function () {
  const GAME_TITLE = 'Endless Runner';
  const WIDTH = 960;
  const HEIGHT = 540;
  const PLAYER_X = 200;
  const GRAVITY_Y = 1000;
  const JUMP_VELOCITY = -420;
  const BASE_SPEED = 280;
  const SPEED_INCREASE = 2;
  const SPAWN_INTERVAL = 1200;
  const DUCK_HEIGHT = 24;

  let phaserGame = null;
  let container;
  let state = 'idle';
  const shared = { score: 0, level: 1, distance: 0, speed: BASE_SPEED };

  class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    create() {
      const g = this.add.graphics();
      g.fillStyle(0x44aaff);
      g.fillRect(0, 0, 32, 48);
      g.generateTexture('player', 32, 48);
      g.clear();
      g.fillStyle(0x885522);
      g.fillRect(0, 0, 64, 24);
      g.generateTexture('ground', 64, 24);
      g.clear();
      g.fillStyle(0xff4444);
      g.fillRect(0, 0, 36, 36);
      g.generateTexture('obstacleGround', 36, 36);
      g.clear();
      g.fillStyle(0xff8844);
      g.fillRect(0, 0, 48, 24);
      g.generateTexture('obstacleOverhead', 48, 24);
      g.destroy();
      this.scene.start('IntroScene');
    }
  }

  class IntroScene extends Phaser.Scene {
    constructor() { super('IntroScene'); }
    create() {
      state = 'intro';
      const cx = WIDTH / 2, cy = HEIGHT / 2;
      this.cameras.main.setBackgroundColor('#1a2a1a');
      this.add.text(cx, cy - 60, GAME_TITLE, { fontSize: '48px', color: '#ffcc00', fontFamily: 'Arial' }).setOrigin(0.5);
      this.add.text(cx, cy, 'Space/Up — Jump • Down — Duck', { fontSize: '18px', color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
      const best = localStorage.getItem('er_best') || '0';
      this.add.text(cx, cy + 40, `High Score: ${best}`, { fontSize: '16px', color: '#aaa', fontFamily: 'Arial' }).setOrigin(0.5);
      const prompt = this.add.text(cx, cy + 100, 'Press SPACE or Click to Start', { fontSize: '22px', color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
      this.tweens.add({ targets: prompt, alpha: 0.3, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.input.keyboard.once('keydown-SPACE', () => window.game.start());
      this.input.once('pointerdown', () => window.game.start());
    }
  }

  class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }
    create() {
      this.cameras.main.setBackgroundColor('#1a2a1a');
      shared.distance = 0;
      shared.speed = BASE_SPEED;

      this.ground = this.add.tileSprite(WIDTH / 2, HEIGHT - 12, WIDTH * 2, 24, 'ground').setOrigin(0.5, 0.5);
      this.player = this.physics.add.sprite(PLAYER_X, HEIGHT - 80, 'player');
      this.player.setCollideWorldBounds(true);
      this.player.ducking = false;
      this.player.normalHeight = 48;

      this.obstacles = this.physics.add.group();
      this.physics.add.overlap(this.player, this.obstacles, (_, obs) => {
        const isOverhead = obs.userData.isOverhead;
        const survived = isOverhead ? this.player.ducking : !this.player.body.blocked.down;
        obs.disableBody(true, true);
        if (!survived) window.game.renderGameOverScreen(window.game.getScore());
      }, null, this);

      this.cursors = this.input.keyboard.createCursorKeys();
      this.input.keyboard.on('keydown-ESC', () => window.game.pause());

      this.spawnEvent = this.time.addEvent({ delay: SPAWN_INTERVAL, callback: this.spawnObstacle, callbackScope: this, loop: true });
      this.scoreText = this.add.text(16, 16, '', { fontSize: '18px', color: '#fff', fontFamily: 'Arial' }).setScrollFactor(0);
    }

    spawnObstacle() {
      const isOverhead = Phaser.Math.Between(0, 1) === 1;
      const key = isOverhead ? 'obstacleOverhead' : 'obstacleGround';
      const obs = this.obstacles.create(WIDTH + 40, isOverhead ? HEIGHT - 120 : HEIGHT - 54, key);
      obs.setVelocityX(-shared.speed);
      obs.setImmovable(true);
      obs.userData = { isOverhead };
    }

    update(time, delta) {
      if (state !== 'playing') return;
      const dt = delta / 1000;
      shared.distance += shared.speed * dt;
      shared.score = Math.floor(shared.distance / 10);
      shared.speed = Math.min(BASE_SPEED + shared.distance * 0.02, BASE_SPEED * 2);

      this.ground.tilePositionX -= shared.speed * dt;

      this.obstacles.getChildren().forEach(o => {
        if (o.active && o.body) o.setVelocityX(-shared.speed);
      });

      const jump = (this.cursors.space.isDown || this.cursors.up.isDown) && this.player.body.blocked.down && !this.player.ducking;
      const duck = this.cursors.down.isDown;

      if (jump) this.player.setVelocityY(JUMP_VELOCITY);
      if (duck && this.player.body.blocked.down) {
        this.player.ducking = true;
        this.player.setSize(32, DUCK_HEIGHT);
        this.player.setOffset(0, 24);
      } else if (!duck) {
        this.player.ducking = false;
        this.player.setSize(32, 48);
        this.player.setOffset(0, 0);
      }

      this.obstacles.getChildren().forEach(o => {
        if (o.active && o.x < -50) o.disableBody(true, true);
      });
      this.scoreText.setText(`Score: ${shared.score}`);
    }
  }

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

  class GameOverScene extends Phaser.Scene {
    constructor() { super('GameOverScene'); }
    create() {
      const cx = WIDTH / 2, cy = HEIGHT / 2;
      this.cameras.main.setBackgroundColor('#1a2a1a');
      const data = this.scene.settings.data || {};
      const result = data.score || { score: 0, timeElapsed: 0 };
      const best = Math.max(result.score, parseInt(localStorage.getItem('er_best') || '0'));
      localStorage.setItem('er_best', String(best));
      const isNew = result.score >= best && result.score > 0;
      this.add.text(cx, cy - 80, 'GAME OVER', { fontSize: '40px', color: '#ff4444', fontFamily: 'Arial' }).setOrigin(0.5);
      this.add.text(cx, cy - 20, `Score: ${result.score}`, { fontSize: '24px', color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
      if (isNew) this.add.text(cx, cy + 20, 'NEW HIGH SCORE!', { fontSize: '20px', color: '#ffcc00', fontFamily: 'Arial' }).setOrigin(0.5);
      else this.add.text(cx, cy + 20, `Best: ${best}`, { fontSize: '18px', color: '#aaa', fontFamily: 'Arial' }).setOrigin(0.5);
      const p = this.add.text(cx, cy + 80, 'Press SPACE or Click to Play Again', { fontSize: '20px', color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
      this.tweens.add({ targets: p, alpha: 0.3, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.input.keyboard.once('keydown-SPACE', () => window.game.restart());
      this.input.once('pointerdown', () => window.game.restart());
    }
  }

  const game = {
    metadata: {
      title: GAME_TITLE,
      genre: '2d-endless-runner',
      engine: 'phaser3',
      supportsMultiplayer: false,
      controls: [
        { key: 'Space/Up', action: 'Jump' },
        { key: 'Down', action: 'Duck' },
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
        backgroundColor: '#000',
        physics: { default: 'arcade', arcade: { gravity: { y: GRAVITY_Y }, debug: false } },
        scene: [BootScene, IntroScene, GameScene, PauseScene, GameOverScene],
      });
      await new Promise(resolve => phaserGame.events.once('ready', resolve));
      window.parent.postMessage({ type: 'sloppy:game:ready' }, '*');
    },
    destroy() { if (phaserGame) { phaserGame.destroy(true); phaserGame = null; } },
    start() {
      shared.score = 0; shared.level = 1; shared.distance = 0; shared.speed = BASE_SPEED;
      state = 'playing';
      phaserGame.scene.stop('IntroScene');
      phaserGame.scene.stop('GameOverScene');
      phaserGame.scene.stop('PauseScene');
      phaserGame.scene.start('GameScene');
    },
    pause() { state = 'paused'; phaserGame.scene.pause('GameScene'); phaserGame.scene.launch('PauseScene'); },
    resume() { state = 'playing'; phaserGame.scene.stop('PauseScene'); phaserGame.scene.resume('GameScene'); },
    restart() { phaserGame.scene.stop('PauseScene'); phaserGame.scene.stop('GameOverScene'); game.start(); },
    renderIntroScreen() { state = 'intro'; phaserGame.scene.start('IntroScene'); },
    renderPauseScreen() { phaserGame.scene.launch('PauseScene'); },
    renderGameOverScreen(result) {
      state = 'gameover';
      phaserGame.scene.stop('GameScene');
      phaserGame.scene.start('GameOverScene', { score: result });
    },
    renderHUD() {},
    getState() { return state; },
    getScore() { return { score: shared.score, level: shared.level, timeElapsed: Math.floor(shared.distance / 100) }; },
  };

  window.SloppyGame = game;
  window.game = game;
})();
