/**
 * Sloppy SDK v2 — 2D Card Battle Template (Phaser 3)
 *
 * Boilerplate: turn-based Draw/Play/Resolve/Opponent phases, procedural card
 * textures with text overlays, hand fan layout, Attack/Defense/Heal types,
 * mana system, HP bars, simple opponent AI, and all SDK v2 lifecycle methods.
 *
 * The AI fills in: card variety, visual theme, and AI behavior.
 */

(function () {
  const GAME_TITLE = 'Card Battle';
  const WIDTH = 960;
  const HEIGHT = 540;
  const CARD_W = 80;
  const CARD_H = 110;
  const MAX_HAND = 7;
  const MANA_PER_TURN = 3;
  const MAX_HP = 30;

  let phaserGame = null;
  let container;
  let state = 'idle';
  const shared = { score: 0, level: 1, playerHP: MAX_HP, opponentHP: MAX_HP, mana: 3, maxMana: 3, turn: 0 };

  class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    create() {
      const g = this.add.graphics();
      ['attack', 'defense', 'heal'].forEach((type, i) => {
        g.clear();
        const colors = [0xff4444, 0x4488ff, 0x44ff44];
        g.fillStyle(colors[i]);
        g.fillRoundedRect(0, 0, CARD_W, CARD_H, 4);
        g.lineStyle(2, 0xffffff);
        g.strokeRoundedRect(0, 0, CARD_W, CARD_H, 4);
        g.generateTexture('card_' + type, CARD_W, CARD_H);
      });
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
      this.add.text(cx, cy, 'Click — Select / Play Card', { fontSize: '18px', color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
      const best = localStorage.getItem('cards_best') || '0';
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
      shared.playerHP = MAX_HP;
      shared.opponentHP = MAX_HP;
      shared.mana = MANA_PER_TURN;
      shared.maxMana = MANA_PER_TURN;
      shared.turn = 0;
      shared.score = 0;
      this.hand = [];
      this.deck = [];
      this.phase = 'player'; // player | resolve | opponent
      this.selectedCard = null;

      this.initDeck();
      this.drawHand(5);
      this.createUI();
      this.input.keyboard.on('keydown-ESC', () => window.game.pause());
    }

    initDeck() {
      this.deck = [];
      for (let i = 0; i < 15; i++) {
        const types = ['attack', 'defense', 'heal'];
        this.deck.push({ type: types[i % 3], cost: 1, value: [5, 3, 4][i % 3] });
      }
      this.deck = Phaser.Utils.Array.Shuffle(this.deck);
    }

    drawHand(count) {
      for (let i = 0; i < count && this.deck.length > 0 && this.hand.length < MAX_HAND; i++) {
        this.hand.push(this.deck.pop());
      }
      this.layoutHand();
    }

    layoutHand() {
      this.handSprites?.forEach(s => s.destroy());
      this.handSprites = [];
      const startX = WIDTH / 2 - (this.hand.length - 1) * 45;
      this.hand.forEach((card, i) => {
        const x = startX + i * 90;
        const y = HEIGHT - 100;
        const key = 'card_' + card.type;
        const spr = this.add.image(x, y, key).setInteractive();
        const txt = this.add.text(x, y - 20, card.type[0].toUpperCase() + card.value, { fontSize: '14px', color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
        spr.on('pointerdown', () => this.playCard(i));
        spr.userData = { index: i };
        this.handSprites.push(spr, txt);
      });
    }

    playCard(index) {
      if (this.phase !== 'player') return;
      const card = this.hand[index];
      if (!card || card.cost > shared.mana) return;
      shared.mana -= card.cost;
      this.hand.splice(index, 1);
      this.phase = 'resolve';
      if (card.type === 'attack') {
        shared.opponentHP = Math.max(0, shared.opponentHP - card.value);
        shared.score += card.value * 10;
      } else if (card.type === 'defense') {
        shared.playerHP = Math.min(MAX_HP, shared.playerHP + card.value);
      } else if (card.type === 'heal') {
        shared.playerHP = Math.min(MAX_HP, shared.playerHP + card.value);
      }
      this.layoutHand();
      this.updateBars();
      if (shared.opponentHP <= 0) {
        shared.score += 500;
        window.game.renderGameOverScreen(window.game.getScore());
        return;
      }
      this.time.delayedCall(500, () => {
        this.phase = 'opponent';
        this.opponentTurn();
      });
    }

    opponentTurn() {
      const dmg = Phaser.Math.Between(2, 5);
      shared.playerHP = Math.max(0, shared.playerHP - dmg);
      this.updateBars();
      if (shared.playerHP <= 0) {
        window.game.renderGameOverScreen(window.game.getScore());
        return;
      }
      shared.turn++;
      shared.mana = Math.min(shared.maxMana + 1, MANA_PER_TURN + Math.floor(shared.turn / 2));
      shared.maxMana = shared.mana;
      this.drawHand(1);
      this.phase = 'player';
    }

    createUI() {
      this.add.text(80, 50, 'You', { fontSize: '20px', color: '#fff', fontFamily: 'Arial' });
      this.playerBarBg = this.add.rectangle(80, 85, 200, 20, 0x333333);
      this.playerBar = this.add.rectangle(80, 85, 200, 20, 0x44ff44);
      this.add.text(WIDTH - 80, 50, 'Opponent', { fontSize: '20px', color: '#fff', fontFamily: 'Arial' }).setOrigin(1, 0);
      this.oppBarBg = this.add.rectangle(WIDTH - 80, 85, 200, 20, 0x333333).setOrigin(1, 0.5);
      this.oppBar = this.add.rectangle(WIDTH - 80, 85, 200, 20, 0xff4444).setOrigin(1, 0.5);
      this.scoreText = this.add.text(WIDTH / 2, 30, '', { fontSize: '18px', color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
      this.manaText = this.add.text(80, 120, '', { fontSize: '16px', color: '#aaccff', fontFamily: 'Arial' });
    }

    updateBars() {
      this.playerBar.width = 200 * (shared.playerHP / MAX_HP);
      this.oppBar.width = Math.max(2, 200 * (shared.opponentHP / MAX_HP));
      this.manaText.setText(`Mana: ${shared.mana}/${shared.maxMana}`);
      this.scoreText.setText(`Score: ${shared.score}`);
    }

    update() {
      if (state !== 'playing') return;
      this.updateBars();
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
      const best = Math.max(scoreVal, parseInt(localStorage.getItem('cards_best') || '0'));
      localStorage.setItem('cards_best', String(best));
      const isNew = scoreVal >= best && scoreVal > 0;
      const won = shared.opponentHP <= 0;
      this.add.text(cx, cy - 80, won ? 'VICTORY!' : 'GAME OVER', { fontSize: '40px', color: won ? '#44ff44' : '#ff4444', fontFamily: 'Arial' }).setOrigin(0.5);
      this.add.text(cx, cy - 20, `Score: ${scoreVal}`, { fontSize: '24px', color: '#fff', fontFamily: 'Arial' }).setOrigin(0.5);
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
      genre: '2d-cards',
      engine: 'phaser3',
      supportsMultiplayer: false,
      controls: [{ key: 'Click', action: 'Select/Play Card' }],
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
        backgroundColor: '#000',
        scene: [BootScene, IntroScene, GameScene, PauseScene, GameOverScene],
      });
      await new Promise(resolve => phaserGame.events.once('ready', resolve));
      window.parent.postMessage({ type: 'sloppy:game:ready' }, '*');
    },
    destroy() { if (phaserGame) { phaserGame.destroy(true); phaserGame = null; } },
    start() {
      shared.score = 0; shared.level = 1; shared.playerHP = MAX_HP; shared.opponentHP = MAX_HP; shared.mana = MANA_PER_TURN; shared.maxMana = MANA_PER_TURN; shared.turn = 0;
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
    getScore() { return { score: shared.score, level: shared.level, timeElapsed: shared.turn }; },
  };

  window.SloppyGame = game;
  window.game = game;
})();
