/**
 * Sloppy SDK v2 — 2D Rhythm Game Template (Phaser 3)
 *
 * Boilerplate: 4-lane note system, notes fall toward hit zone, BPM-based
 * procedural beat generation, timing windows (Perfect/Good/Miss), combo
 * multiplier, and all SDK v2 lifecycle methods.
 *
 * The AI fills in: visual theme, note patterns, difficulty curve, and scoring.
 */

(function () {
  const GAME_TITLE = 'Rhythm Game';
  const WIDTH = 960;
  const HEIGHT = 540;
  const LANES = 4;
  const LANE_WIDTH = WIDTH / LANES;
  const HIT_ZONE_Y = HEIGHT - 80;
  const NOTE_FALL_TIME = 2000;
  const BPM = 120;
  const BEAT_MS = 60000 / BPM;
  const PERFECT_MS = 50;
  const GOOD_MS = 100;
  const PERFECT_PTS = 300;
  const GOOD_PTS = 100;
  const GAME_DURATION_MS = 60000;

  let phaserGame = null;
  let container;
  let state = 'idle';
  const shared = { score: 0, level: 1, combo: 0, time: 0 };

  class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    create() {
      const g = this.add.graphics();
      g.fillStyle(0xff44aa);
      g.fillRect(0, 0, LANE_WIDTH - 8, 24);
      g.generateTexture('note', LANE_WIDTH - 8, 24);
      g.clear();
      g.fillStyle(0x44aaff);
      g.fillRect(0, 0, LANE_WIDTH - 4, 4);
      g.generateTexture('hitZone', LANE_WIDTH - 4, 4);
      g.destroy();
      this.scene.start('IntroScene');
    }
  }

  class IntroScene extends Phaser.Scene {
    constructor() { super('IntroScene'); }
    create() {
      state = 'intro';
      const cx = WIDTH / 2, cy = HEIGHT / 2;
      this.cameras.main.setBackgroundColor('#1a1a2e');
      this.add.text(cx, cy - 60, GAME_TITLE, { fontSize: '48px', color: '#ffcc00', fontFamily: 'Arial' }).setOrigin(0.5);
      this.add.text(cx, cy, 'D / F / J / K — Hit Notes', { fontSize: '18px', color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
      const best = localStorage.getItem('rhythm_best') || '0';
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
      this.cameras.main.setBackgroundColor('#1a1a2e');
      shared.combo = 0;
      shared.time = 0;
      this.notes = [];
      this.keys = ['D', 'F', 'J', 'K'].map((k, i) => ({
        key: this.input.keyboard.addKey(k),
        lane: i,
      }));
      this.input.keyboard.on('keydown-ESC', () => window.game.pause());

      for (let i = 0; i < LANES; i++) {
        const x = i * LANE_WIDTH + LANE_WIDTH / 2;
        this.add.image(x, HIT_ZONE_Y, 'hitZone').setOrigin(0.5);
      }

      this.nextSpawnTime = 0;
      this.missCheckEvent = this.time.addEvent({ delay: 100, callback: this.checkMisses, callbackScope: this, loop: true });
      this.scoreText = this.add.text(16, 16, '', { fontSize: '18px', color: '#fff', fontFamily: 'Arial' }).setScrollFactor(0);
      this.comboText = this.add.text(WIDTH - 16, 16, '', { fontSize: '18px', color: '#ffcc00', fontFamily: 'Arial' }).setOrigin(1, 0).setScrollFactor(0);
    }

    spawnNote() {
      const lane = Phaser.Math.Between(0, LANES - 1);
      const x = lane * LANE_WIDTH + LANE_WIDTH / 2;
      const note = this.add.image(x, -20, 'note').setOrigin(0.5);
      this.tweens.add({
        targets: note,
        y: HIT_ZONE_Y,
        duration: NOTE_FALL_TIME,
        ease: 'Linear',
      });
      note.userData = { lane, spawnTime: this.time.now };
      this.notes.push(note);
    }

    checkMisses() {
      if (state !== 'playing') return;
      this.notes = this.notes.filter(n => {
        if (!n.active) return false;
        const past = n.y - HIT_ZONE_Y;
        if (past > 80) {
          n.destroy();
          shared.combo = 0;
          return false;
        }
        return true;
      });
    }

    hitLane(lane) {
      let bestNote = null;
      let bestDist = Infinity;
      this.notes.forEach(n => {
        if (n.userData.lane !== lane || !n.active) return;
        const dist = Math.abs(n.y - HIT_ZONE_Y);
        if (dist < bestDist && dist < 120) {
          bestDist = dist;
          bestNote = n;
        }
      });
      if (!bestNote) return;
      const pts = bestDist <= PERFECT_MS ? PERFECT_PTS : bestDist <= GOOD_MS ? GOOD_PTS : 0;
      if (pts > 0) {
        shared.combo++;
        shared.score += pts * (1 + Math.min(shared.combo - 1, 10) * 0.1);
        bestNote.destroy();
        this.notes = this.notes.filter(n => n !== bestNote);
      }
    }

    update(time, delta) {
      if (state !== 'playing') return;
      shared.time += delta / 1000;
      if (shared.time * 1000 >= GAME_DURATION_MS) {
        window.game.renderGameOverScreen(window.game.getScore());
        return;
      }
      if (time >= this.nextSpawnTime) {
        this.spawnNote();
        this.nextSpawnTime = time + BEAT_MS * (0.5 + Math.random() * 0.5);
      }
      this.keys.forEach(({ key, lane }) => {
        if (Phaser.Input.Keyboard.JustDown(key)) this.hitLane(lane);
      });
      this.scoreText.setText(`Score: ${Math.floor(shared.score)} | ${Math.max(0, 60 - Math.floor(shared.time))}s`);
      this.comboText.setText(`Combo: ${shared.combo}x`);
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
      this.cameras.main.setBackgroundColor('#1a1a2e');
      const data = this.scene.settings.data || {};
      const result = data.score || { score: 0, timeElapsed: 0 };
      const scoreVal = typeof result.score === 'number' ? result.score : result.score || 0;
      const best = Math.max(scoreVal, parseInt(localStorage.getItem('rhythm_best') || '0'));
      localStorage.setItem('rhythm_best', String(best));
      const isNew = scoreVal >= best && scoreVal > 0;
      this.add.text(cx, cy - 80, 'GAME OVER', { fontSize: '40px', color: '#ff4444', fontFamily: 'Arial' }).setOrigin(0.5);
      this.add.text(cx, cy - 20, `Score: ${Math.floor(scoreVal)}`, { fontSize: '24px', color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
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
      genre: '2d-rhythm',
      engine: 'phaser3',
      supportsMultiplayer: false,
      controls: [{ key: 'D/F/J/K', action: 'Hit Notes' }],
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
        scene: [BootScene, IntroScene, GameScene, PauseScene, GameOverScene],
      });
      await new Promise(resolve => phaserGame.events.once('ready', resolve));
      window.parent.postMessage({ type: 'sloppy:game:ready' }, '*');
    },
    destroy() { if (phaserGame) { phaserGame.destroy(true); phaserGame = null; } },
    start() {
      shared.score = 0; shared.level = 1; shared.combo = 0; shared.time = 0;
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
    getScore() { return { score: Math.floor(shared.score), level: shared.level, timeElapsed: Math.floor(shared.time) }; },
  };

  window.SloppyGame = game;
  window.game = game;
})();
