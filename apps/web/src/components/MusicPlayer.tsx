import { useEffect, useRef } from 'react';
import { useUIStore } from '../stores/ui';

/**
 * Invisible component that manages background music playback.
 * Place once at app root — it renders no visible UI.
 * The actual toggle button lives in NavBar.
 */
export function MusicPlayer() {
  const isMusicPlaying = useUIStore((s) => s.isMusicPlaying);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.loop = true;
      audio.volume = 0.3;
      // Placeholder source — replace with actual ambient track URL
      audio.src = '';
      audioRef.current = audio;
    }

    return () => {
      audioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;

    if (isMusicPlaying) {
      audio.play().catch(() => {
        // browser blocked autoplay — user must interact first
      });
    } else {
      audio.pause();
    }
  }, [isMusicPlaying]);

  return null;
}
