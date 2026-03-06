/**
 * Engine-agnostic "juice" effects helpers. Provides screen shake, flash,
 * particle burst, and number-pop animations that generated games can use
 * to add visual polish without reimplementing these from scratch.
 *
 * Each effect has an engine-agnostic trigger API and engine-specific
 * implementations provided via the constructor options.
 */

// ---------------------------------------------------------------------------
// Canvas 2D / Phaser effects
// ---------------------------------------------------------------------------

export interface Canvas2DEffectsTarget {
  canvas: HTMLCanvasElement;
}

export class Canvas2DEffects {
  private canvas: HTMLCanvasElement;
  private shakeTimer = 0;
  private shakeIntensity = 0;
  private flashTimer = 0;
  private flashColor = 'rgba(255,255,255,0.5)';
  private particles: Particle[] = [];

  constructor(target: Canvas2DEffectsTarget) {
    this.canvas = target.canvas;
  }

  screenShake(intensity = 5, durationMs = 200): void {
    this.shakeIntensity = intensity;
    this.shakeTimer = durationMs;
  }

  screenFlash(color = 'rgba(255,255,255,0.5)', durationMs = 150): void {
    this.flashColor = color;
    this.flashTimer = durationMs;
  }

  particleBurst(x: number, y: number, count = 12, color = '#ffcc00'): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 80 + Math.random() * 120;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.4 + Math.random() * 0.3,
        size: 2 + Math.random() * 3,
        color,
      });
    }
  }

  numberPop(
    ctx: CanvasRenderingContext2D,
    value: string,
    x: number,
    y: number,
    color = '#ffffff',
  ): void {
    const pop = { text: value, x, y, vy: -60, life: 0.8, color, alpha: 1 };
    const animate = (dt: number) => {
      pop.life -= dt;
      if (pop.life <= 0) return;
      pop.y += pop.vy * dt;
      pop.alpha = Math.max(0, pop.life / 0.8);
      ctx.save();
      ctx.globalAlpha = pop.alpha;
      ctx.fillStyle = pop.color;
      ctx.font = 'bold 20px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
      requestAnimationFrame(() => animate(1 / 60));
    };
    requestAnimationFrame(() => animate(1 / 60));
  }

  /**
   * Call once per frame to update and render active effects.
   * Returns the shake offset to apply to the camera/canvas translation.
   */
  update(dt: number, ctx?: CanvasRenderingContext2D): { shakeX: number; shakeY: number } {
    let shakeX = 0;
    let shakeY = 0;

    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt * 1000;
      shakeX = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      shakeY = (Math.random() - 0.5) * 2 * this.shakeIntensity;
    }

    if (this.flashTimer > 0 && ctx) {
      this.flashTimer -= dt * 1000;
      ctx.save();
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.restore();
    }

    if (ctx) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 200 * dt; // gravity
        const alpha = p.life / p.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    return { shakeX, shakeY };
  }

  reset(): void {
    this.shakeTimer = 0;
    this.flashTimer = 0;
    this.particles = [];
  }
}

// ---------------------------------------------------------------------------
// Three.js effects
// ---------------------------------------------------------------------------

/**
 * Three.js-compatible effects that work by manipulating camera position
 * and adding temporary objects to the scene.
 */
export class ThreeJSEffects {
  private shakeTimer = 0;
  private shakeIntensity = 0;
  private flashOverlay: HTMLDivElement | null = null;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  screenShake(intensity = 0.3, durationMs = 200): void {
    this.shakeIntensity = intensity;
    this.shakeTimer = durationMs;
  }

  screenFlash(color = 'rgba(255,255,255,0.5)', durationMs = 150): void {
    if (this.flashOverlay) this.flashOverlay.remove();
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;background:${color};pointer-events:none;z-index:50;`;
    this.container.appendChild(el);
    this.flashOverlay = el;
    setTimeout(() => {
      el.remove();
      if (this.flashOverlay === el) this.flashOverlay = null;
    }, durationMs);
  }

  /**
   * Call per frame. Returns the camera offset to add to the base camera
   * position for shake effect.
   */
  update(dt: number): { shakeX: number; shakeY: number; shakeZ: number } {
    let shakeX = 0;
    let shakeY = 0;
    let shakeZ = 0;

    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt * 1000;
      shakeX = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      shakeY = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      shakeZ = (Math.random() - 0.5) * 2 * this.shakeIntensity * 0.5;
    }

    return { shakeX, shakeY, shakeZ };
  }

  reset(): void {
    this.shakeTimer = 0;
    if (this.flashOverlay) {
      this.flashOverlay.remove();
      this.flashOverlay = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}
