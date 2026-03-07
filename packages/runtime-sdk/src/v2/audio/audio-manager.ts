/**
 * AudioManager — unified audio interface wrapping Howler.js (file-based)
 * and ZzFX (procedural) with automatic detection.
 *
 * For games with audio sprite files (ElevenLabs-generated), Howler.js handles
 * playback. For all other games, ZzFX procedural presets are used.
 *
 * The mute/unmute methods are wired to the feed's postMessage bridge so the
 * global mute toggle instantly controls all game audio.
 */

import type { ZzFXParams } from './zzfx-presets.js';
import { SFX } from './zzfx-presets.js';
import { zzfx } from './zzfx-micro.js';

export interface AudioManager {
  play(sfxKey: string): void;
  playAmbient(src: string, loop: boolean): void;
  stopAmbient(): void;
  setMasterVolume(v: number): void;
  setMusicVolume(v: number): void;
  setSFXVolume(v: number): void;
  onPause(): void;
  onResume(): void;
  onDestroy(): void;
  mute(): void;
  unmute(): void;
}

export interface AudioManagerOptions {
  /** Howler.js audio sprite sources (webm + mp3 fallback). */
  spriteSrc?: string[];
  /** Sprite map: name → [offset_ms, duration_ms]. */
  spriteMap?: Record<string, [number, number]>;
  /** Ambient music source URL. */
  ambientSrc?: string;
  /** Custom ZzFX presets to merge with defaults. */
  customPresets?: Record<string, ZzFXParams>;
}

/**
 * Detects whether Howler.js is available globally (loaded via CDN).
 */
function hasHowler(): boolean {
  return typeof (globalThis as any).Howl === 'function';
}

/**
 * Create an AudioManager that auto-detects the best playback strategy.
 *
 * - If sprite sources are provided and Howler.js is loaded → Howler mode
 * - Otherwise → ZzFX procedural mode
 */
export function createAudioManager(options: AudioManagerOptions = {}): AudioManager {
  const presets: Record<string, ZzFXParams> = { ...SFX, ...options.customPresets };

  let masterVolume = 1;
  let musicVolume = 0.5;
  let sfxVolume = 0.8;
  let isMuted = false;
  let isPaused = false;

  // Howler instances (lazy-initialized only if Howler is available + sprite provided)
  let spriteHowl: any = null;
  let ambientHowl: any = null;

  const useHowler = !!(options.spriteSrc?.length && hasHowler());

  if (useHowler && options.spriteSrc) {
    const Howl = (globalThis as any).Howl;
    spriteHowl = new Howl({
      src: options.spriteSrc,
      sprite: options.spriteMap ?? {},
      volume: sfxVolume * masterVolume,
    });
  }

  function effectiveVolume(base: number): number {
    return isMuted ? 0 : base * masterVolume;
  }

  let hasNotifiedParent = false;

  function notifyParentAudioActive(): void {
    if (hasNotifiedParent) return;
    hasNotifiedParent = true;
    try {
      if (typeof window !== 'undefined' && window.parent !== window) {
        window.parent.postMessage({ type: 'sloppy:audio-started' }, '*');
      }
    } catch (_) {}
  }

  const manager: AudioManager = {
    play(sfxKey: string): void {
      if (isMuted || isPaused) return;
      notifyParentAudioActive();

      if (useHowler && spriteHowl) {
        spriteHowl.volume(effectiveVolume(sfxVolume));
        spriteHowl.play(sfxKey);
        return;
      }

      const params = presets[sfxKey];
      if (params) {
        const adjusted = [...params] as number[];
        adjusted[0] = (adjusted[0] || 1) * effectiveVolume(sfxVolume);
        zzfx(...adjusted);
      }
    },

    playAmbient(src: string, loop = true): void {
      if (!hasHowler()) return;
      manager.stopAmbient();
      notifyParentAudioActive();

      const Howl = (globalThis as any).Howl;
      ambientHowl = new Howl({
        src: [src],
        loop,
        volume: effectiveVolume(musicVolume),
      });
      if (!isPaused) ambientHowl.play();
    },

    stopAmbient(): void {
      if (ambientHowl) {
        ambientHowl.stop();
        ambientHowl.unload();
        ambientHowl = null;
      }
    },

    setMasterVolume(v: number): void {
      masterVolume = Math.max(0, Math.min(1, v));
      if (spriteHowl) spriteHowl.volume(effectiveVolume(sfxVolume));
      if (ambientHowl) ambientHowl.volume(effectiveVolume(musicVolume));
    },

    setMusicVolume(v: number): void {
      musicVolume = Math.max(0, Math.min(1, v));
      if (ambientHowl) ambientHowl.volume(effectiveVolume(musicVolume));
    },

    setSFXVolume(v: number): void {
      sfxVolume = Math.max(0, Math.min(1, v));
      if (spriteHowl) spriteHowl.volume(effectiveVolume(sfxVolume));
    },

    onPause(): void {
      isPaused = true;
      if (spriteHowl) spriteHowl.pause();
      if (ambientHowl) ambientHowl.pause();
    },

    onResume(): void {
      isPaused = false;
      if (ambientHowl && !isMuted) ambientHowl.play();
    },

    onDestroy(): void {
      if (spriteHowl) {
        spriteHowl.unload();
        spriteHowl = null;
      }
      manager.stopAmbient();
      removeMessageListener();
    },

    mute(): void {
      isMuted = true;
      if (hasHowler()) {
        (globalThis as any).Howler?.mute(true);
      }
    },

    unmute(): void {
      isMuted = false;
      if (hasHowler()) {
        (globalThis as any).Howler?.mute(false);
      }
    },
  };

  // Wire postMessage bridge for feed mute/unmute
  function handleMessage(e: MessageEvent): void {
    if (e.data?.type === 'sloppy:mute') manager.mute();
    if (e.data?.type === 'sloppy:unmute') manager.unmute();
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('message', handleMessage);
  }

  function removeMessageListener(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('message', handleMessage);
    }
  }

  return manager;
}

/**
 * Returns the AudioManager factory as an inline JavaScript string for
 * injection into generated game HTML. Includes postMessage bridge wiring.
 */
export function getAudioManagerInlineSource(): string {
  return `// Sloppy AudioManager — auto-detects Howler.js vs ZzFX
function createAudioManager(opts) {
  opts = opts || {};
  let masterVol = 1, musicVol = 0.5, sfxVol = 0.8, muted = false, paused = false;
  let spriteHowl = null, ambientHowl = null, notified = false;
  const useHowler = !!(opts.spriteSrc && opts.spriteSrc.length && typeof Howl === 'function');
  if (useHowler) spriteHowl = new Howl({ src: opts.spriteSrc, sprite: opts.spriteMap || {}, volume: sfxVol });
  function ev(base) { return muted ? 0 : base * masterVol; }
  function notifyParent() { if (notified) return; notified = true; try { if (window.parent !== window) window.parent.postMessage({ type: 'sloppy:audio-started' }, '*'); } catch(e){} }
  const mgr = {
    play(key) {
      if (muted || paused) return;
      notifyParent();
      if (useHowler && spriteHowl) { spriteHowl.volume(ev(sfxVol)); spriteHowl.play(key); return; }
      const p = typeof SFX !== 'undefined' && SFX[key];
      if (p) { const a = [...p]; a[0] = (a[0] || 1) * ev(sfxVol); zzfx(...a); }
    },
    playAmbient(src, loop) {
      if (typeof Howl !== 'function') return;
      mgr.stopAmbient();
      notifyParent();
      ambientHowl = new Howl({ src: [src], loop: loop !== false, volume: ev(musicVol) });
      if (!paused) ambientHowl.play();
    },
    stopAmbient() { if (ambientHowl) { ambientHowl.stop(); ambientHowl.unload(); ambientHowl = null; } },
    setMasterVolume(v) { masterVol = Math.max(0, Math.min(1, v)); if (spriteHowl) spriteHowl.volume(ev(sfxVol)); if (ambientHowl) ambientHowl.volume(ev(musicVol)); },
    setMusicVolume(v) { musicVol = Math.max(0, Math.min(1, v)); if (ambientHowl) ambientHowl.volume(ev(musicVol)); },
    setSFXVolume(v) { sfxVol = Math.max(0, Math.min(1, v)); if (spriteHowl) spriteHowl.volume(ev(sfxVol)); },
    onPause() { paused = true; if (spriteHowl) spriteHowl.pause(); if (ambientHowl) ambientHowl.pause(); },
    onResume() { paused = false; if (ambientHowl && !muted) ambientHowl.play(); },
    onDestroy() { if (spriteHowl) { spriteHowl.unload(); spriteHowl = null; } mgr.stopAmbient(); window.removeEventListener('message', onMsg); },
    mute() { muted = true; if (typeof Howler !== 'undefined') Howler.mute(true); },
    unmute() { muted = false; if (typeof Howler !== 'undefined') Howler.mute(false); }
  };
  function onMsg(e) { if (e.data && e.data.type === 'sloppy:mute') mgr.mute(); if (e.data && e.data.type === 'sloppy:unmute') mgr.unmute(); }
  window.addEventListener('message', onMsg);
  return mgr;
}`;
}
