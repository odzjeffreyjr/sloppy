/**
 * Touch control system for mobile game input.
 *
 * Renders semi-transparent touch controls on a CSS overlay above the game iframe.
 * Sends normalized input to the game via postMessage using the same format as
 * keyboard input, so games don't need separate touch handling.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TouchControlType = 'joystick' | 'd-pad' | 'tap-zones' | 'gesture' | 'custom';

export interface TouchLayout {
  /** Left side control (movement) */
  left?: TouchControlType;
  /** Right side control (action buttons) */
  right?: 'buttons' | 'none';
  /** Number of action buttons (1-4) */
  actionButtonCount?: number;
  /** Labels for action buttons */
  actionLabels?: string[];
}

export interface TouchControlConfig {
  type: TouchControlType;
  layout: TouchLayout;
  /** Opacity of touch controls (0-1, default 0.35) */
  opacity?: number;
  /** Size multiplier (default 1) */
  scale?: number;
}

export interface TouchInput {
  type: 'touch:move' | 'touch:action' | 'touch:release';
  /** Normalized direction (-1 to 1 for x/y) */
  x?: number;
  y?: number;
  /** Which action button (0-based) */
  button?: number;
  /** Mapped keyboard key for games that listen to keyboard events */
  key?: string;
}

interface ActiveTouch {
  id: number;
  startX: number;
  startY: number;
  region: 'left' | 'right';
}

// ---------------------------------------------------------------------------
// Genre → touch control mapping
// ---------------------------------------------------------------------------

const GENRE_TOUCH_DEFAULTS: Record<string, TouchControlConfig> = {
  '2d-platformer': {
    type: 'd-pad',
    layout: { left: 'd-pad', right: 'buttons', actionButtonCount: 1, actionLabels: ['Jump'] },
  },
  '2d-topdown': {
    type: 'joystick',
    layout: { left: 'joystick', right: 'buttons', actionButtonCount: 2, actionLabels: ['Shoot', 'Dash'] },
  },
  '2d-puzzle': {
    type: 'tap-zones',
    layout: { left: 'tap-zones', right: 'none' },
  },
  '2d-arcade': {
    type: 'd-pad',
    layout: { left: 'd-pad', right: 'buttons', actionButtonCount: 1, actionLabels: ['Action'] },
  },
  '2d-shooter': {
    type: 'joystick',
    layout: { left: 'joystick', right: 'buttons', actionButtonCount: 1, actionLabels: ['Fire'] },
  },
  '2d-tower-defense': {
    type: 'tap-zones',
    layout: { left: 'tap-zones', right: 'none' },
  },
  '2d-endless-runner': {
    type: 'tap-zones',
    layout: { left: 'tap-zones', right: 'buttons', actionButtonCount: 2, actionLabels: ['Jump', 'Duck'] },
  },
  '2d-rhythm': {
    type: 'tap-zones',
    layout: { left: 'tap-zones', right: 'none' },
  },
  '2d-cards': {
    type: 'tap-zones',
    layout: { left: 'tap-zones', right: 'none' },
  },
  '2d-idle': {
    type: 'tap-zones',
    layout: { left: 'tap-zones', right: 'none' },
  },
  '3d-firstperson': {
    type: 'joystick',
    layout: { left: 'joystick', right: 'buttons', actionButtonCount: 2, actionLabels: ['Shoot', 'Jump'] },
  },
  '3d-thirdperson': {
    type: 'joystick',
    layout: { left: 'joystick', right: 'buttons', actionButtonCount: 1, actionLabels: ['Jump'] },
  },
  '3d-racing': {
    type: 'joystick',
    layout: { left: 'joystick', right: 'buttons', actionButtonCount: 2, actionLabels: ['Gas', 'Brake'] },
  },
  '3d-puzzle': {
    type: 'tap-zones',
    layout: { left: 'tap-zones', right: 'none' },
  },
  '3d-flight': {
    type: 'joystick',
    layout: { left: 'joystick', right: 'buttons', actionButtonCount: 2, actionLabels: ['Fire', 'Boost'] },
  },
  '3d-platformer': {
    type: 'joystick',
    layout: { left: 'joystick', right: 'buttons', actionButtonCount: 1, actionLabels: ['Jump'] },
  },
};

/**
 * Returns the recommended touch control config for a given genre.
 * Falls back to joystick + 1 action button for unknown genres.
 */
export function getTouchConfigForGenre(genre: string): TouchControlConfig {
  return GENRE_TOUCH_DEFAULTS[genre] ?? {
    type: 'joystick',
    layout: { left: 'joystick', right: 'buttons', actionButtonCount: 1, actionLabels: ['Action'] },
  };
}

// ---------------------------------------------------------------------------
// Touch Controls Renderer
// ---------------------------------------------------------------------------

/**
 * Creates and manages touch control overlays.
 *
 * Call `mount(container)` to add controls to the DOM and `destroy()` to clean up.
 * The controls send normalized input via a callback and optionally dispatch
 * synthetic keyboard events into a target iframe.
 */
export class TouchControls {
  private container: HTMLElement | null = null;
  private overlay: HTMLDivElement | null = null;
  private config: TouchControlConfig;
  private onInput: (input: TouchInput) => void;
  private activeTouches = new Map<number, ActiveTouch>();
  private joystickKnob: HTMLDivElement | null = null;
  private joystickBase: HTMLDivElement | null = null;

  private readonly JOYSTICK_RADIUS = 50;
  private readonly DEAD_ZONE = 0.15;

  constructor(config: TouchControlConfig, onInput: (input: TouchInput) => void) {
    this.config = config;
    this.onInput = onInput;
  }

  mount(container: HTMLElement): void {
    this.container = container;

    this.overlay = document.createElement('div');
    Object.assign(this.overlay.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '100',
      pointerEvents: 'none',
      touchAction: 'none',
      userSelect: 'none',
      webkitUserSelect: 'none',
    });

    const scale = this.config.scale ?? 1;
    const opacity = this.config.opacity ?? 0.35;

    if (this.config.layout.left === 'joystick') {
      this.renderJoystick(this.overlay, scale, opacity);
    } else if (this.config.layout.left === 'd-pad') {
      this.renderDPad(this.overlay, scale, opacity);
    }

    if (this.config.layout.right === 'buttons') {
      this.renderActionButtons(this.overlay, scale, opacity);
    }

    container.appendChild(this.overlay);

    this.overlay.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.overlay.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.overlay.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    this.overlay.addEventListener('touchcancel', this.handleTouchEnd, { passive: false });
  }

  destroy(): void {
    if (this.overlay) {
      this.overlay.removeEventListener('touchstart', this.handleTouchStart);
      this.overlay.removeEventListener('touchmove', this.handleTouchMove);
      this.overlay.removeEventListener('touchend', this.handleTouchEnd);
      this.overlay.removeEventListener('touchcancel', this.handleTouchEnd);
      this.overlay.remove();
      this.overlay = null;
    }
    this.activeTouches.clear();
    this.container = null;
    this.joystickKnob = null;
    this.joystickBase = null;
  }

  // -- Renderers --

  private renderJoystick(parent: HTMLElement, scale: number, opacity: number): void {
    const baseSize = 120 * scale;
    const knobSize = 50 * scale;

    const base = document.createElement('div');
    Object.assign(base.style, {
      position: 'absolute',
      bottom: `${20 * scale}px`,
      left: `${20 * scale}px`,
      width: `${baseSize}px`,
      height: `${baseSize}px`,
      borderRadius: '50%',
      background: `rgba(255,255,255,${opacity * 0.3})`,
      border: `2px solid rgba(255,255,255,${opacity})`,
      pointerEvents: 'auto',
      touchAction: 'none',
    });

    const knob = document.createElement('div');
    Object.assign(knob.style, {
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: `${knobSize}px`,
      height: `${knobSize}px`,
      borderRadius: '50%',
      background: `rgba(255,255,255,${opacity * 0.8})`,
      transform: 'translate(-50%, -50%)',
      transition: 'none',
    });

    base.appendChild(knob);
    parent.appendChild(base);

    this.joystickBase = base;
    this.joystickKnob = knob;
  }

  private renderDPad(parent: HTMLElement, scale: number, opacity: number): void {
    const size = 120 * scale;
    const btnSize = 40 * scale;

    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      position: 'absolute',
      bottom: `${20 * scale}px`,
      left: `${20 * scale}px`,
      width: `${size}px`,
      height: `${size}px`,
      pointerEvents: 'auto',
      touchAction: 'none',
    });

    const dirs = [
      { key: 'ArrowUp', label: '\u25B2', x: (size - btnSize) / 2, y: 0 },
      { key: 'ArrowDown', label: '\u25BC', x: (size - btnSize) / 2, y: size - btnSize },
      { key: 'ArrowLeft', label: '\u25C0', x: 0, y: (size - btnSize) / 2 },
      { key: 'ArrowRight', label: '\u25B6', x: size - btnSize, y: (size - btnSize) / 2 },
    ];

    for (const dir of dirs) {
      const btn = document.createElement('div');
      Object.assign(btn.style, {
        position: 'absolute',
        left: `${dir.x}px`,
        top: `${dir.y}px`,
        width: `${btnSize}px`,
        height: `${btnSize}px`,
        borderRadius: '8px',
        background: `rgba(255,255,255,${opacity * 0.4})`,
        border: `1px solid rgba(255,255,255,${opacity})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${14 * scale}px`,
        color: `rgba(255,255,255,${opacity})`,
        pointerEvents: 'auto',
        touchAction: 'none',
      });
      btn.textContent = dir.label;
      btn.dataset.key = dir.key;
      wrapper.appendChild(btn);
    }

    parent.appendChild(wrapper);
  }

  private renderActionButtons(parent: HTMLElement, scale: number, opacity: number): void {
    const count = this.config.layout.actionButtonCount ?? 1;
    const labels = this.config.layout.actionLabels ?? [];
    const btnSize = 56 * scale;
    const gap = 12 * scale;

    const keyMap = ['Space', 'KeyX', 'KeyZ', 'KeyC'];

    for (let i = 0; i < Math.min(count, 4); i++) {
      const btn = document.createElement('div');
      const bottomOffset = 20 * scale + i * (btnSize + gap);

      Object.assign(btn.style, {
        position: 'absolute',
        bottom: `${bottomOffset}px`,
        right: `${20 * scale}px`,
        width: `${btnSize}px`,
        height: `${btnSize}px`,
        borderRadius: '50%',
        background: `rgba(255,255,255,${opacity * 0.4})`,
        border: `2px solid rgba(255,255,255,${opacity})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${11 * scale}px`,
        fontWeight: '700',
        color: `rgba(255,255,255,${opacity})`,
        pointerEvents: 'auto',
        touchAction: 'none',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      });
      btn.textContent = labels[i] ?? `B${i + 1}`;
      btn.dataset.action = String(i);
      btn.dataset.key = keyMap[i] ?? 'Space';
      parent.appendChild(btn);
    }
  }

  // -- Touch handlers --

  private handleTouchStart = (e: TouchEvent): void => {
    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const target = touch.target as HTMLElement;

      // Check action buttons — track touch so we send release on touchend
      if (target.dataset.action != null) {
        this.activeTouches.set(touch.identifier, {
          id: touch.identifier,
          startX: touch.clientX,
          startY: touch.clientY,
          region: 'right',
        });
        this.onInput({
          type: 'touch:action',
          button: parseInt(target.dataset.action, 10),
          key: target.dataset.key,
        });
        this.flashElement(target);
        continue;
      }

      // Check d-pad buttons — track touch so we send release on touchend
      if (target.dataset.key) {
        const key = target.dataset.key;
        const dx = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;
        const dy = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
        this.activeTouches.set(touch.identifier, {
          id: touch.identifier,
          startX: touch.clientX,
          startY: touch.clientY,
          region: 'left',
        });
        this.onInput({ type: 'touch:move', x: dx, y: dy, key });
        this.flashElement(target);
        continue;
      }

      // Joystick region (left half of overlay)
      if (!this.overlay) continue;
      const rect = this.overlay.getBoundingClientRect();
      const relX = touch.clientX - rect.left;
      const region = relX < rect.width / 2 ? 'left' : 'right';

      this.activeTouches.set(touch.identifier, {
        id: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
        region,
      });
    }
  };

  private handleTouchMove = (e: TouchEvent): void => {
    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const active = this.activeTouches.get(touch.identifier);
      if (!active || active.region !== 'left') continue;

      const dx = touch.clientX - active.startX;
      const dy = touch.clientY - active.startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = this.JOYSTICK_RADIUS;

      const clampedDist = Math.min(dist, maxDist);
      const angle = Math.atan2(dy, dx);

      const nx = (clampedDist / maxDist) * Math.cos(angle);
      const ny = (clampedDist / maxDist) * Math.sin(angle);

      // Update joystick knob position
      if (this.joystickKnob) {
        const knobOffset = clampedDist;
        const knobX = knobOffset * Math.cos(angle);
        const knobY = knobOffset * Math.sin(angle);
        this.joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
      }

      if (Math.abs(nx) > this.DEAD_ZONE || Math.abs(ny) > this.DEAD_ZONE) {
        let key: string | undefined;
        if (Math.abs(nx) > Math.abs(ny)) {
          key = nx > 0 ? 'ArrowRight' : 'ArrowLeft';
        } else {
          key = ny > 0 ? 'ArrowDown' : 'ArrowUp';
        }
        this.onInput({ type: 'touch:move', x: nx, y: ny, key });
      }
    }
  };

  private handleTouchEnd = (e: TouchEvent): void => {
    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const active = this.activeTouches.get(touch.identifier);
      if (active) {
        this.activeTouches.delete(touch.identifier);
        this.onInput({ type: 'touch:release', x: 0, y: 0 });
      }
    }

    // Reset joystick knob
    if (this.joystickKnob) {
      this.joystickKnob.style.transform = 'translate(-50%, -50%)';
    }
  };

  private flashElement(el: HTMLElement): void {
    const original = el.style.background;
    el.style.background = 'rgba(255,255,255,0.6)';
    setTimeout(() => {
      el.style.background = original;
    }, 100);
  }
}

/**
 * Returns the touch controls inline source for injection into game HTML.
 * The Technical Planner agent uses this to determine appropriate touch controls.
 */
export function getTouchControlsInlineSource(): string {
  return `
// Sloppy Touch Controls Bridge
(function() {
  if (!('ontouchstart' in window)) return;

  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'sloppy:touch') {
      var input = e.data.input;
      if (!input) return;

      if (input.key) {
        var evType = input.type === 'touch:release' ? 'keyup' : 'keydown';
        var evt = new KeyboardEvent(evType, {
          key: input.key,
          code: input.key,
          bubbles: true,
          cancelable: true,
        });
        document.dispatchEvent(evt);
      }
    }
  });
})();
`;
}
