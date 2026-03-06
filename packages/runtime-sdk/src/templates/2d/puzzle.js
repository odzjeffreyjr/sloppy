/**
 * Sloppy SDK v2 — 2D Puzzle Template (Phaser 3)
 *
 * Boilerplate: grid-based system, cell-to-screen mapping, match/clear
 * mechanics, drag-and-drop interaction, win/clear conditions, multi-scene
 * setup, and all SDK v2 lifecycle methods.
 *
 * The AI fills in: specific puzzle mechanics (match-3, sliding, Sokoban,
 * etc.), visual theme, level progression, scoring rules.
 */

(function () {
  // ── Config ──────────────────────────────────────────────────────────────
  const GAME_TITLE = '2D Puzzle';
  const WIDTH = 960;
  const HEIGHT = 540;
  const GRID_COLS = 6;
  const GRID_ROWS = 6;
  const CELL_SIZE = 64;
  const COLORS = [0xff4444, 0x44aaff, 0x44ff44, 0xffaa00, 0xff44ff, 0x44ffff];

  // ── State ───────────────────────────────────────────────────────────────
  let phaserGame = null;
  let container;
  let state = 'idle';
  const shared = { score: 0, level: 1, moves: 0, time: 0 };

  // ── Boot Scene ──────────────────────────────────────────────────────────

  class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    create() {
      const g = this.add.graphics();
      COLORS.forEach((color, i) => {
        g.clear();
        g.fillStyle(color);
        g.fillRoundedRect(0, 0, CELL_SIZE - 4, CELL_SIZE - 4, 8);
        g.generateTexture('cell_' + i, CELL_SIZE - 4, CELL_SIZE - 4);
      });
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

      this.add.text(cx, cy, 'Click to swap adjacent tiles', {
        fontSize: '18px', color: '#ffffff', fontFamily: 'Arial'
      }).setOrigin(0.5);

      this.add.text(cx, cy + 30, 'Match 3+ in a row to clear!', {
        fontSize: '18px', color: '#ffffff', fontFamily: 'Arial'
      }).setOrigin(0.5);

      const prompt = this.add.text(cx, cy + 100, 'Click to Start', {
        fontSize: '22px', color: '#ffffff', fontFamily: 'Arial'
      }).setOrigin(0.5);

      this.tweens.add({
        targets: prompt, alpha: 0.3, duration: 800,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });

      this.input.once('pointerdown', () => window.game.start());
      this.input.keyboard.once('keydown-SPACE', () => window.game.start());
    }
  }

  // ── Game Scene ──────────────────────────────────────────────────────────

  class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    create() {
      this.cameras.main.setBackgroundColor('#1a1a2e');
      shared.time = 0;
      shared.moves = 0;

      this.gridOffsetX = (WIDTH - GRID_COLS * CELL_SIZE) / 2;
      this.gridOffsetY = (HEIGHT - GRID_ROWS * CELL_SIZE) / 2;

      // Initialize grid
      this.grid = [];
      this.cellSprites = [];
      for (let r = 0; r < GRID_ROWS; r++) {
        this.grid[r] = [];
        this.cellSprites[r] = [];
        for (let c = 0; c < GRID_COLS; c++) {
          const colorIdx = Phaser.Math.Between(0, COLORS.length - 1);
          this.grid[r][c] = colorIdx;
          const x = this.gridOffsetX + c * CELL_SIZE + CELL_SIZE / 2;
          const y = this.gridOffsetY + r * CELL_SIZE + CELL_SIZE / 2;
          const sprite = this.add.image(x, y, 'cell_' + colorIdx).setInteractive();
          sprite.setData('row', r);
          sprite.setData('col', c);
          this.cellSprites[r][c] = sprite;
        }
      }

      // Remove any initial matches
      while (this.findMatches().length > 0) {
        this.shuffleGrid();
      }

      this.selected = null;

      // Click handler
      this.input.on('gameobjectdown', (pointer, obj) => {
        if (state !== 'playing') return;
        const r = obj.getData('row');
        const c = obj.getData('col');

        if (!this.selected) {
          this.selected = { r, c };
          obj.setScale(1.1);
        } else {
          const sr = this.selected.r, sc = this.selected.c;
          this.cellSprites[sr][sc].setScale(1);
          // Only swap adjacent
          if ((Math.abs(sr - r) === 1 && sc === c) || (Math.abs(sc - c) === 1 && sr === r)) {
            this.swapCells(sr, sc, r, c);
            shared.moves++;
            const matches = this.findMatches();
            if (matches.length > 0) {
              this.clearMatches(matches);
            } else {
              // Swap back
              this.swapCells(sr, sc, r, c);
            }
          }
          this.selected = null;
        }
      });

      // HUD
      this.scoreText = this.add.text(16, 16, '', { fontSize: '18px', color: '#fff', fontFamily: 'Arial' }).setScrollFactor(0);
      this.movesText = this.add.text(WIDTH - 16, 16, '', { fontSize: '18px', color: '#fff', fontFamily: 'Arial' }).setOrigin(1, 0).setScrollFactor(0);
    }

    swapCells(r1, c1, r2, c2) {
      const tmp = this.grid[r1][c1];
      this.grid[r1][c1] = this.grid[r2][c2];
      this.grid[r2][c2] = tmp;
      this.updateSprite(r1, c1);
      this.updateSprite(r2, c2);
    }

    updateSprite(r, c) {
      const sprite = this.cellSprites[r][c];
      sprite.setTexture('cell_' + this.grid[r][c]);
    }

    findMatches() {
      const matches = new Set();
      // Horizontal
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS - 2; c++) {
          const v = this.grid[r][c];
          if (v === this.grid[r][c + 1] && v === this.grid[r][c + 2]) {
            matches.add(`${r},${c}`);
            matches.add(`${r},${c + 1}`);
            matches.add(`${r},${c + 2}`);
          }
        }
      }
      // Vertical
      for (let r = 0; r < GRID_ROWS - 2; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const v = this.grid[r][c];
          if (v === this.grid[r + 1][c] && v === this.grid[r + 2][c]) {
            matches.add(`${r},${c}`);
            matches.add(`${r + 1},${c}`);
            matches.add(`${r + 2},${c}`);
          }
        }
      }
      return [...matches].map(s => {
        const [r, c] = s.split(',').map(Number);
        return { r, c };
      });
    }

    clearMatches(matches) {
      shared.score += matches.length * 10;

      matches.forEach(({ r, c }) => {
        this.tweens.add({
          targets: this.cellSprites[r][c],
          scale: 0, alpha: 0, duration: 200,
          onComplete: () => {
            this.cellSprites[r][c].setScale(1).setAlpha(1);
          }
        });
      });

      this.time.delayedCall(250, () => {
        // Drop cells down
        for (const { r, c } of matches) {
          this.grid[r][c] = -1;
        }
        for (let c = 0; c < GRID_COLS; c++) {
          for (let r = GRID_ROWS - 1; r >= 0; r--) {
            if (this.grid[r][c] === -1) {
              // Find non-empty cell above
              for (let above = r - 1; above >= 0; above--) {
                if (this.grid[above][c] !== -1) {
                  this.grid[r][c] = this.grid[above][c];
                  this.grid[above][c] = -1;
                  break;
                }
              }
            }
          }
          // Fill remaining with random
          for (let r = 0; r < GRID_ROWS; r++) {
            if (this.grid[r][c] === -1) {
              this.grid[r][c] = Phaser.Math.Between(0, COLORS.length - 1);
            }
            this.updateSprite(r, c);
          }
        }

        // Chain matches
        const newMatches = this.findMatches();
        if (newMatches.length > 0) {
          this.time.delayedCall(200, () => this.clearMatches(newMatches));
        }
      });
    }

    shuffleGrid() {
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          this.grid[r][c] = Phaser.Math.Between(0, COLORS.length - 1);
          this.updateSprite(r, c);
        }
      }
    }

    update(time, delta) {
      if (state !== 'playing') return;
      shared.time += delta / 1000;
      this.scoreText.setText(`Score: ${shared.score}  Level: ${shared.level}`);
      this.movesText.setText(`Moves: ${shared.moves}`);
    }
  }

  // ── Pause Scene ─────────────────────────────────────────────────────────

  class PauseScene extends Phaser.Scene {
    constructor() { super('PauseScene'); }
    create() {
      const cx = WIDTH / 2, cy = HEIGHT / 2;
      this.add.rectangle(cx, cy, WIDTH, HEIGHT, 0x000000, 0.6);
      this.add.text(cx, cy - 30, 'PAUSED', { fontSize: '36px', color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
      const p = this.add.text(cx, cy + 30, 'Click to Resume', { fontSize: '20px', color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
      this.tweens.add({ targets: p, alpha: 0.3, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.input.once('pointerdown', () => window.game.resume());
      this.input.keyboard.once('keydown-SPACE', () => window.game.resume());
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
      const best = Math.max(result.score, parseInt(localStorage.getItem('puz_best') || '0'));
      localStorage.setItem('puz_best', String(best));

      this.add.text(cx, cy - 60, 'COMPLETE!', { fontSize: '40px', color: '#44ff44', fontFamily: 'Arial' }).setOrigin(0.5);
      this.add.text(cx, cy, `Score: ${result.score}`, { fontSize: '24px', color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
      this.add.text(cx, cy + 35, `Best: ${best}`, { fontSize: '18px', color: '#aaa', fontFamily: 'Arial' }).setOrigin(0.5);
      const p = this.add.text(cx, cy + 90, 'Click to Play Again', { fontSize: '20px', color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
      this.tweens.add({ targets: p, alpha: 0.3, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.input.once('pointerdown', () => window.game.restart());
      this.input.keyboard.once('keydown-SPACE', () => window.game.restart());
    }
  }

  // ── SDK v2 Game Object ──────────────────────────────────────────────────

  const game = {
    metadata: {
      title: GAME_TITLE,
      genre: '2d-puzzle',
      engine: 'phaser3',
      supportsMultiplayer: false,
      controls: [
        { key: 'Click', action: 'Select & Swap Tiles' },
      ],
      estimatedPlayTime: '3-10 min',
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
        scene: [BootScene, IntroScene, GameScene, PauseScene, GameOverScene],
      });

      await new Promise(resolve => phaserGame.events.once('ready', resolve));
      window.parent.postMessage({ type: 'sloppy:game:ready' }, '*');
    },

    destroy() {
      if (phaserGame) { phaserGame.destroy(true); phaserGame = null; }
    },

    start() {
      shared.score = 0; shared.level = 1; shared.moves = 0; shared.time = 0;
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
