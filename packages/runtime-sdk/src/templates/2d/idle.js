/**
 * Sloppy SDK v2 — 2D Idle Clicker Template (Phaser 3)
 *
 * Boilerplate: click target for resources, floating "+N" text on click,
 * passive generators in side panel, exponential cost scaling (1.15^level),
 * large number formatting (K/M/B/T), localStorage progress save, and all
 * SDK v2 lifecycle methods.
 *
 * The AI fills in: visual theme, generator types, and progression curve.
 */

(function () {
  const GAME_TITLE = 'Idle Clicker';
  const WIDTH = 960;
  const HEIGHT = 540;
  const SAVE_KEY = 'idle_save';
  const BASE_COST = 10;
  const COST_MULT = 1.15;

  let phaserGame = null;
  let container;
  let state = 'idle';
  const shared = { score: 0, level: 1, resources: 0, generators: [0, 0, 0], lastSave: 0 };

  function formatNum(n) {
    if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return Math.floor(n).toString();
  }

  function costFor(genIndex, level) {
    return Math.floor(BASE_COST * Math.pow(COST_MULT, level));
  }

  class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    create() {
      const g = this.add.graphics();
      g.fillStyle(0xffcc00);
      g.fillCircle(40, 40, 40);
      g.lineStyle(3, 0xffaa00);
      g.strokeCircle(40, 40, 40);
      g.generateTexture('clickTarget', 80, 80);
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
      this.add.text(cx, cy, 'Click — Generate Resources', { fontSize: '18px', color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
      const prompt = this.add.text(cx, cy + 80, 'Press SPACE or Click to Start', { fontSize: '22px', color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
      this.tweens.add({ targets: prompt, alpha: 0.3, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.input.keyboard.once('keydown-SPACE', () => window.game.start());
      this.input.once('pointerdown', () => window.game.start());
    }
  }

  class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }
    create() {
      this.cameras.main.setBackgroundColor('#1a2a1a');
      this.loadSave();

      const cx = WIDTH / 2, cy = HEIGHT / 2;
      this.target = this.add.image(cx, cy, 'clickTarget').setInteractive();
      this.target.on('pointerdown', (p) => this.onClick(p.x, p.y));

      this.resText = this.add.text(cx, cy - 100, '', { fontSize: '28px', color: '#ffcc00', fontFamily: 'Arial' }).setOrigin(0.5);
      this.genTexts = [];
      const names = ['Auto +1/s', 'Auto +5/s', 'Auto +20/s'];
      for (let i = 0; i < 3; i++) {
        const y = 120 + i * 60;
        const btn = this.add.rectangle(180, y, 140, 40, 0x4488ff).setInteractive();
        const txt = this.add.text(180, y, `${names[i]} — Cost: 0`, { fontSize: '14px', color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
        btn.on('pointerdown', () => this.buyGenerator(i));
        this.genTexts.push(txt);
      }

      this.input.keyboard.on('keydown-ESC', () => window.game.pause());
      this.saveEvent = this.time.addEvent({ delay: 5000, callback: this.saveProgress, callbackScope: this, loop: true });
    }

    onClick(x, y) {
      shared.resources += 1;
      shared.score = Math.floor(shared.resources);
      const pop = this.add.text(x, y, '+1', { fontSize: '20px', color: '#ffcc00', fontFamily: 'Arial' }).setOrigin(0.5);
      this.tweens.add({ targets: pop, y: y - 50, alpha: 0, duration: 600, onComplete: () => pop.destroy() });
    }

    buyGenerator(i) {
      const cost = costFor(i, shared.generators[i]);
      if (shared.resources < cost) return;
      shared.resources -= cost;
      shared.generators[i]++;
    }

    loadSave() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) {
          const d = JSON.parse(raw);
          shared.resources = d.resources || 0;
          shared.generators = d.generators || [0, 0, 0];
          shared.score = Math.floor(shared.resources);
        }
      } catch (_) {}
    }

    saveProgress() {
      if (state !== 'playing') return;
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({
          resources: shared.resources,
          generators: shared.generators,
          ts: Date.now(),
        }));
      } catch (_) {}
    }

    update(time, delta) {
      if (state !== 'playing') return;
      const dt = delta / 1000;
      const passive = shared.generators[0] * 1 + shared.generators[1] * 5 + shared.generators[2] * 20;
      shared.resources += passive * dt;
      shared.score = Math.floor(shared.resources);

      this.resText.setText(formatNum(shared.resources));
      for (let i = 0; i < 3; i++) {
        const c = costFor(i, shared.generators[i]);
        const names = ['Auto +1/s', 'Auto +5/s', 'Auto +20/s'];
        this.genTexts[i].setText(`${names[i]} (${shared.generators[i]}) — ${formatNum(c)}`);
      }
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
      const scoreVal = typeof result.score === 'number' ? result.score : result.score || 0;
      this.add.text(cx, cy - 40, 'Session Complete', { fontSize: '36px', color: '#ffcc00', fontFamily: 'Arial' }).setOrigin(0.5);
      this.add.text(cx, cy, `Total: ${formatNum(scoreVal)}`, { fontSize: '24px', color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
      const p = this.add.text(cx, cy + 60, 'Press SPACE or Click to Continue', { fontSize: '20px', color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
      this.tweens.add({ targets: p, alpha: 0.3, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.input.keyboard.once('keydown-SPACE', () => { window.game.restart(); });
      this.input.once('pointerdown', () => { window.game.restart(); });
    }
  }

  const game = {
    metadata: {
      title: GAME_TITLE,
      genre: '2d-idle',
      engine: 'phaser3',
      supportsMultiplayer: false,
      controls: [{ key: 'Click', action: 'Generate Resources' }],
      estimatedPlayTime: '5+ min',
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
        scene: [BootScene, IntroScene, GameScene, PauseScene, GameOverScene],
      });
      await new Promise(resolve => phaserGame.events.once('ready', resolve));
      window.parent.postMessage({ type: 'sloppy:game:ready' }, '*');
    },
    destroy() { if (phaserGame) { phaserGame.destroy(true); phaserGame = null; } },
    start() {
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
    getScore() { return { score: Math.floor(shared.resources), level: shared.level, timeElapsed: 0 }; },
  };

  window.SloppyGame = game;
  window.game = game;
})();
