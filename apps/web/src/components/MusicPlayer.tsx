import { useEffect, useRef, useCallback } from 'react';
import { useUIStore } from '../stores/ui';

const TRACKS = ['/audio/track_1.mp3', '/audio/track_2.mp3', '/audio/track_3.mp3'];
const FADE_DURATION_MS = 800;
const FADE_STEPS = 20;
const BASE_VOLUME = 0.3;

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Invisible component that manages background music playback.
 * Plays through all three tracks in a shuffled order, looping indefinitely.
 * Fades out when the game overlay opens and fades back in when it closes.
 */
export function MusicPlayer() {
  const isMusicPlaying = useUIStore((s) => s.isMusicPlaying);
  const isMuted = useUIStore((s) => s.isMuted);
  const isGameAudioActive = useUIStore((s) => s.isGameAudioActive);
  const isLobbyMusicActive = useUIStore((s) => s.isLobbyMusicActive);
  const setGameAudioActive = useUIStore((s) => s.setGameAudioActive);
  const effectivePlaying = isMusicPlaying && !isMuted;
  const shouldYield = isGameAudioActive || isLobbyMusicActive;

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'sloppy:audio-started') {
        setGameAudioActive(true);
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setGameAudioActive]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playlistRef = useRef<string[]>(shuffled(TRACKS));
  const trackIndexRef = useRef(0);
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const targetVolumeRef = useRef(BASE_VOLUME);

  const clearFade = useCallback(() => {
    if (fadeTimerRef.current) {
      clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const fadeTo = useCallback(
    (target: number, onComplete?: () => void) => {
      clearFade();
      const audio = audioRef.current;
      if (!audio) return;

      targetVolumeRef.current = target;
      const startVol = audio.volume;
      const delta = target - startVol;
      if (Math.abs(delta) < 0.01) {
        audio.volume = target;
        onComplete?.();
        return;
      }

      let step = 0;
      fadeTimerRef.current = setInterval(() => {
        step++;
        const progress = step / FADE_STEPS;
        audio.volume = Math.max(0, Math.min(1, startVol + delta * progress));

        if (step >= FADE_STEPS) {
          audio.volume = target;
          clearFade();
          onComplete?.();
        }
      }, FADE_DURATION_MS / FADE_STEPS);
    },
    [clearFade],
  );

  const playNextTrack = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    trackIndexRef.current++;
    if (trackIndexRef.current >= playlistRef.current.length) {
      playlistRef.current = shuffled(TRACKS);
      trackIndexRef.current = 0;
    }

    audio.src = playlistRef.current[trackIndexRef.current];
    audio.volume = targetVolumeRef.current;
    audio.play().catch(() => {});
  }, []);

  // Create audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.volume = BASE_VOLUME;
    audio.preload = 'auto';
    audio.src = playlistRef.current[0];
    audio.addEventListener('ended', playNextTrack);
    audioRef.current = audio;

    return () => {
      clearFade();
      audio.removeEventListener('ended', playNextTrack);
      audio.pause();
      audio.src = '';
    };
  }, [playNextTrack, clearFade]);

  // Attempt to play; if blocked by autoplay policy, wait for user interaction
  const tryPlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !effectivePlaying) return;

    if (shouldYield) {
      audio.volume = 0;
    } else {
      audio.volume = BASE_VOLUME;
      targetVolumeRef.current = BASE_VOLUME;
    }

    audio.play().catch(() => {
      const resume = () => {
        if (audioRef.current && effectivePlaying) {
          audioRef.current.play().catch(() => {});
        }
        for (const evt of ['click', 'touchstart', 'keydown'] as const) {
          document.removeEventListener(evt, resume);
        }
      };
      for (const evt of ['click', 'touchstart', 'keydown'] as const) {
        document.addEventListener(evt, resume, { once: false });
      }
    });
  }, [effectivePlaying, shouldYield]);

  // Play / pause based on user toggle
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (effectivePlaying) {
      tryPlay();
    } else {
      clearFade();
      audio.pause();
    }
  }, [effectivePlaying, shouldYield, clearFade, tryPlay]);

  // Fade out when game overlay or lobby music takes over, fade back in when done
  useEffect(() => {
    if (!effectivePlaying) return;
    const audio = audioRef.current;
    if (!audio) return;

    if (shouldYield) {
      fadeTo(0, () => {
        audio.pause();
      });
    } else {
      audio.play().catch(() => {});
      fadeTo(BASE_VOLUME);
    }
  }, [shouldYield, effectivePlaying, fadeTo]);

  return null;
}
