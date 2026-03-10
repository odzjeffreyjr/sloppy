import { useEffect, useRef, useCallback } from 'react';
import { useUIStore } from '../stores/ui';

const LOBBY_TRACK = '/audio/lobby_track.mp3';
const FADE_MS = 600;
const FADE_STEPS = 15;
const LOBBY_VOLUME = 0.35;

/**
 * Plays the lobby track while `active` is true.
 * Fades in on start, fades out when `active` becomes false.
 * Pauses the main background music while playing, restoring it after.
 */
export function useLobbyMusic(active: boolean) {
  const isMuted = useUIStore((s) => s.isMuted);
  const setLobbyMusicActive = useUIStore((s) => s.setLobbyMusicActive);
  const effectiveActive = active && !isMuted;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearFade = useCallback(() => {
    if (fadeRef.current) {
      clearInterval(fadeRef.current);
      fadeRef.current = null;
    }
  }, []);

  const fadeTo = useCallback(
    (target: number, onComplete?: () => void) => {
      clearFade();
      const audio = audioRef.current;
      if (!audio) return;

      const start = audio.volume;
      const delta = target - start;
      if (Math.abs(delta) < 0.01) {
        audio.volume = target;
        onComplete?.();
        return;
      }

      let step = 0;
      fadeRef.current = setInterval(() => {
        step++;
        const progress = step / FADE_STEPS;
        audio.volume = Math.max(0, Math.min(1, start + delta * progress));
        if (step >= FADE_STEPS) {
          audio.volume = target;
          clearFade();
          onComplete?.();
        }
      }, FADE_MS / FADE_STEPS);
    },
    [clearFade],
  );

  // Create audio element once
  useEffect(() => {
    const audio = new Audio(LOBBY_TRACK);
    audio.loop = true;
    audio.volume = 0;
    audio.preload = 'auto';
    audioRef.current = audio;

    return () => {
      clearFade();
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [clearFade]);

  // Start/stop based on active flag and global mute
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (effectiveActive) {
      setLobbyMusicActive(true);
      audio.currentTime = 0;
      audio.volume = 0;
      audio.play().catch(() => {});
      fadeTo(LOBBY_VOLUME);
    } else {
      fadeTo(0, () => {
        audio.pause();
        setLobbyMusicActive(false);
      });
    }
  }, [effectiveActive, fadeTo, setLobbyMusicActive]);
}
