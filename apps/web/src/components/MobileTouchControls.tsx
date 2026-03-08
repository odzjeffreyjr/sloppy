import { useEffect, useRef, useCallback, useState, type RefObject } from 'react';

type ControlType = 'joystick' | 'd-pad' | 'tap-zones';

interface TouchLayout {
  left?: ControlType;
  right?: 'buttons' | 'none';
  actionButtonCount?: number;
  actionLabels?: string[];
}

interface TouchConfig {
  type: ControlType;
  layout: TouchLayout;
}

const GENRE_TOUCH_DEFAULTS: Record<string, TouchConfig> = {
  '2d-platformer': { type: 'd-pad', layout: { left: 'd-pad', right: 'buttons', actionButtonCount: 1, actionLabels: ['Jump'] } },
  '2d-topdown': { type: 'joystick', layout: { left: 'joystick', right: 'buttons', actionButtonCount: 2, actionLabels: ['Shoot', 'Dash'] } },
  '2d-puzzle': { type: 'tap-zones', layout: { left: 'tap-zones', right: 'none' } },
  '2d-arcade': { type: 'd-pad', layout: { left: 'd-pad', right: 'buttons', actionButtonCount: 1, actionLabels: ['Action'] } },
  '2d-shooter': { type: 'joystick', layout: { left: 'joystick', right: 'buttons', actionButtonCount: 1, actionLabels: ['Fire'] } },
  '2d-tower-defense': { type: 'tap-zones', layout: { left: 'tap-zones', right: 'none' } },
  '2d-endless-runner': { type: 'tap-zones', layout: { left: 'tap-zones', right: 'buttons', actionButtonCount: 2, actionLabels: ['Jump', 'Duck'] } },
  '2d-rhythm': { type: 'tap-zones', layout: { left: 'tap-zones', right: 'none' } },
  '2d-cards': { type: 'tap-zones', layout: { left: 'tap-zones', right: 'none' } },
  '2d-idle': { type: 'tap-zones', layout: { left: 'tap-zones', right: 'none' } },
  '3d-firstperson': { type: 'joystick', layout: { left: 'joystick', right: 'buttons', actionButtonCount: 2, actionLabels: ['Shoot', 'Jump'] } },
  '3d-thirdperson': { type: 'joystick', layout: { left: 'joystick', right: 'buttons', actionButtonCount: 1, actionLabels: ['Jump'] } },
  '3d-racing': { type: 'joystick', layout: { left: 'joystick', right: 'buttons', actionButtonCount: 2, actionLabels: ['Gas', 'Brake'] } },
  '3d-puzzle': { type: 'tap-zones', layout: { left: 'tap-zones', right: 'none' } },
  '3d-flight': { type: 'joystick', layout: { left: 'joystick', right: 'buttons', actionButtonCount: 2, actionLabels: ['Fire', 'Boost'] } },
  '3d-platformer': { type: 'joystick', layout: { left: 'joystick', right: 'buttons', actionButtonCount: 1, actionLabels: ['Jump'] } },
};

function getConfigForGenre(genre: string): TouchConfig {
  return GENRE_TOUCH_DEFAULTS[genre] ?? {
    type: 'joystick',
    layout: { left: 'joystick', right: 'buttons', actionButtonCount: 1, actionLabels: ['Action'] },
  };
}

const KEY_MAP = ['Space', 'KeyX', 'KeyZ', 'KeyC'];

function sendToIframe(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  type: string,
  key?: string,
  x?: number,
  y?: number,
  button?: number,
) {
  iframeRef.current?.contentWindow?.postMessage(
    { type: 'sloppy:touch', input: { type, key, x, y, button } },
    '*',
  );
}

const isTouchDevice = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;

interface MobileTouchControlsProps {
  genre?: string;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  visible?: boolean;
}

export function MobileTouchControls({ genre, iframeRef, visible = true }: MobileTouchControlsProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      const shorter = Math.min(window.innerWidth, window.innerHeight);
      setIsMobile(isTouchDevice() && shorter < 1024);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  if (!isMobile || !visible || !genre) return null;

  const config = getConfigForGenre(genre);

  return (
    <div
      className="absolute inset-0 z-[100] pointer-events-none"
      style={{ touchAction: 'none', userSelect: 'none' }}
    >
      {config.layout.left === 'joystick' && (
        <JoystickControl iframeRef={iframeRef} />
      )}
      {config.layout.left === 'd-pad' && (
        <DPadControl iframeRef={iframeRef} />
      )}
      {config.layout.right === 'buttons' && (
        <ActionButtons
          iframeRef={iframeRef}
          count={config.layout.actionButtonCount ?? 1}
          labels={config.layout.actionLabels ?? []}
        />
      )}
    </div>
  );
}

function JoystickControl({ iframeRef }: { iframeRef: RefObject<HTMLIFrameElement | null> }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const touchId = useRef<number | null>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const RADIUS = 50;
  const DEAD_ZONE = 0.15;

  const handleStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    const touch = e.changedTouches[0];
    if (!touch || touchId.current !== null) return;
    touchId.current = touch.identifier;
    const rect = baseRef.current?.getBoundingClientRect();
    if (rect) {
      startPos.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
  }, []);

  const handleMove = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier !== touchId.current) continue;

      const dx = touch.clientX - startPos.current.x;
      const dy = touch.clientY - startPos.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const clamped = Math.min(dist, RADIUS);
      const angle = Math.atan2(dy, dx);

      const nx = (clamped / RADIUS) * Math.cos(angle);
      const ny = (clamped / RADIUS) * Math.sin(angle);

      if (knobRef.current) {
        const kx = clamped * Math.cos(angle);
        const ky = clamped * Math.sin(angle);
        knobRef.current.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
      }

      if (Math.abs(nx) > DEAD_ZONE || Math.abs(ny) > DEAD_ZONE) {
        const key = Math.abs(nx) > Math.abs(ny)
          ? (nx > 0 ? 'ArrowRight' : 'ArrowLeft')
          : (ny > 0 ? 'ArrowDown' : 'ArrowUp');
        sendToIframe(iframeRef, 'touch:move', key, nx, ny);
      }
    }
  }, [iframeRef]);

  const handleEnd = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchId.current) {
        touchId.current = null;
        if (knobRef.current) {
          knobRef.current.style.transform = 'translate(-50%, -50%)';
        }
        sendToIframe(iframeRef, 'touch:release', undefined, 0, 0);
      }
    }
  }, [iframeRef]);

  return (
    <div
      ref={baseRef}
      className="absolute bottom-5 left-5 w-[120px] h-[120px] rounded-full pointer-events-auto"
      style={{
        background: 'rgba(255,255,255,0.1)',
        border: '2px solid rgba(255,255,255,0.35)',
        touchAction: 'none',
      }}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
    >
      <div
        ref={knobRef}
        className="absolute top-1/2 left-1/2 w-[50px] h-[50px] rounded-full"
        style={{
          background: 'rgba(255,255,255,0.28)',
          transform: 'translate(-50%, -50%)',
        }}
      />
    </div>
  );
}

function DPadControl({ iframeRef }: { iframeRef: RefObject<HTMLIFrameElement | null> }) {
  const activeKeys = useRef(new Set<string>());

  const press = useCallback((key: string) => {
    if (activeKeys.current.has(key)) return;
    activeKeys.current.add(key);
    const dx = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;
    const dy = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
    sendToIframe(iframeRef, 'touch:move', key, dx, dy);
  }, [iframeRef]);

  const release = useCallback((key: string) => {
    activeKeys.current.delete(key);
    sendToIframe(iframeRef, 'touch:release', key, 0, 0);
  }, [iframeRef]);

  const dirs = [
    { key: 'ArrowUp', label: '▲', className: 'top-0 left-1/2 -translate-x-1/2' },
    { key: 'ArrowDown', label: '▼', className: 'bottom-0 left-1/2 -translate-x-1/2' },
    { key: 'ArrowLeft', label: '◀', className: 'left-0 top-1/2 -translate-y-1/2' },
    { key: 'ArrowRight', label: '▶', className: 'right-0 top-1/2 -translate-y-1/2' },
  ];

  return (
    <div
      className="absolute bottom-5 left-5 w-[120px] h-[120px] pointer-events-auto"
      style={{ touchAction: 'none' }}
    >
      {dirs.map((d) => (
        <div
          key={d.key}
          className={`absolute ${d.className} w-10 h-10 rounded-lg flex items-center justify-center text-sm select-none`}
          style={{
            background: 'rgba(255,255,255,0.14)',
            border: '1px solid rgba(255,255,255,0.35)',
            color: 'rgba(255,255,255,0.35)',
            touchAction: 'none',
          }}
          onTouchStart={(e) => { e.stopPropagation(); press(d.key); }}
          onTouchEnd={(e) => { e.stopPropagation(); release(d.key); }}
          onTouchCancel={(e) => { e.stopPropagation(); release(d.key); }}
        >
          {d.label}
        </div>
      ))}
    </div>
  );
}

function ActionButtons({
  iframeRef,
  count,
  labels,
}: {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  count: number;
  labels: string[];
}) {
  const press = useCallback((idx: number) => {
    sendToIframe(iframeRef, 'touch:action', KEY_MAP[idx] ?? 'Space', undefined, undefined, idx);
  }, [iframeRef]);

  const release = useCallback((idx: number) => {
    sendToIframe(iframeRef, 'touch:release', KEY_MAP[idx] ?? 'Space', 0, 0, idx);
  }, [iframeRef]);

  return (
    <>
      {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
        <div
          key={i}
          className="absolute pointer-events-auto flex items-center justify-center rounded-full select-none"
          style={{
            bottom: `${20 + i * 68}px`,
            right: '20px',
            width: '56px',
            height: '56px',
            background: 'rgba(255,255,255,0.14)',
            border: '2px solid rgba(255,255,255,0.35)',
            color: 'rgba(255,255,255,0.35)',
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            touchAction: 'none',
          }}
          onTouchStart={(e) => { e.stopPropagation(); press(i); }}
          onTouchEnd={(e) => { e.stopPropagation(); release(i); }}
          onTouchCancel={(e) => { e.stopPropagation(); release(i); }}
        >
          {labels[i] ?? `B${i + 1}`}
        </div>
      ))}
    </>
  );
}
