/**
 * Base helper for rendering UI screens (intro, pause, game-over) on top of
 * a game canvas. Works with both Canvas 2D / Phaser (draws on a canvas
 * context) and Three.js (creates an HTML overlay div).
 *
 * Generated games are not required to use this class — it's provided as a
 * convenience so the AI can inherit common patterns instead of reimplementing
 * them from scratch.
 */

export interface ScreenStyle {
  fontFamily?: string;
  titleSize?: number;
  bodySize?: number;
  color?: string;
  accentColor?: string;
  overlayColor?: string;
}

const DEFAULT_STYLE: Required<ScreenStyle> = {
  fontFamily: 'Arial, sans-serif',
  titleSize: 48,
  bodySize: 24,
  color: '#ffffff',
  accentColor: '#ffcc00',
  overlayColor: 'rgba(0, 0, 0, 0.7)',
};

/**
 * Canvas-based screen renderer. Draws directly onto a 2D canvas context.
 * Suitable for Phaser 3 games that use a Phaser Graphics object or a
 * dedicated overlay canvas.
 */
export class CanvasScreenRenderer {
  private style: Required<ScreenStyle>;

  constructor(style?: ScreenStyle) {
    this.style = { ...DEFAULT_STYLE, ...style };
  }

  drawOverlay(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = this.style.overlayColor;
    ctx.fillRect(0, 0, width, height);
  }

  drawCenteredText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    fontSize: number,
    color?: string,
  ): void {
    ctx.fillStyle = color ?? this.style.color;
    ctx.font = `bold ${fontSize}px ${this.style.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  drawTitle(ctx: CanvasRenderingContext2D, title: string, cx: number, cy: number): void {
    this.drawCenteredText(ctx, title, cx, cy, this.style.titleSize, this.style.accentColor);
  }

  drawPrompt(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number): void {
    this.drawCenteredText(ctx, text, cx, cy, this.style.bodySize, this.style.color);
  }

  drawButton(
    ctx: CanvasRenderingContext2D,
    label: string,
    cx: number,
    cy: number,
    paddingX = 30,
    paddingY = 12,
  ): { x: number; y: number; w: number; h: number } {
    ctx.font = `bold ${this.style.bodySize}px ${this.style.fontFamily}`;
    const measured = ctx.measureText(label);
    const w = measured.width + paddingX * 2;
    const h = this.style.bodySize + paddingY * 2;
    const x = cx - w / 2;
    const y = cy - h / 2;

    ctx.fillStyle = this.style.accentColor;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy);

    return { x, y, w, h };
  }
}

/**
 * HTML overlay-based screen renderer. Creates absolutely-positioned HTML
 * elements on top of the WebGL canvas. Ideal for Three.js games.
 */
export class HtmlScreenRenderer {
  private container: HTMLElement;
  private overlay: HTMLDivElement | null = null;
  private style: Required<ScreenStyle>;

  constructor(container: HTMLElement, style?: ScreenStyle) {
    this.container = container;
    this.style = { ...DEFAULT_STYLE, ...style };
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }
  }

  show(content: string): HTMLDivElement {
    this.hide();
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:absolute;top:0;left:0;width:100%;height:100%;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      background:${this.style.overlayColor};
      color:${this.style.color};font-family:${this.style.fontFamily};
      z-index:100;pointer-events:auto;user-select:none;
    `;
    overlay.innerHTML = content;
    this.container.appendChild(overlay);
    this.overlay = overlay;
    return overlay;
  }

  showTitle(title: string, subtitle?: string, prompt?: string): HTMLDivElement {
    let html = `<div style="font-size:${this.style.titleSize}px;font-weight:bold;color:${this.style.accentColor};margin-bottom:16px;">${title}</div>`;
    if (subtitle) {
      html += `<div style="font-size:${this.style.bodySize}px;margin-bottom:24px;">${subtitle}</div>`;
    }
    if (prompt) {
      html += `<div style="font-size:${this.style.bodySize - 4}px;opacity:0.8;animation:pulse 1.5s ease-in-out infinite;">${prompt}</div>`;
      html += `<style>@keyframes pulse{0%,100%{opacity:0.8}50%{opacity:0.4}}</style>`;
    }
    return this.show(html);
  }

  showButton(label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      padding:12px 32px;font-size:${this.style.bodySize}px;font-weight:bold;
      background:${this.style.accentColor};color:#000;border:none;border-radius:8px;
      cursor:pointer;font-family:${this.style.fontFamily};margin-top:16px;
    `;
    btn.addEventListener('click', onClick);
    if (this.overlay) this.overlay.appendChild(btn);
    return btn;
  }

  hide(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  destroy(): void {
    this.hide();
  }
}
