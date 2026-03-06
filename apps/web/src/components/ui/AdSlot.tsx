import { useEffect, useRef } from 'react';
import { adsApi } from '../../lib/api';

type AdFormat = 'leaderboard' | 'rectangle' | 'mobile-banner' | 'interstitial' | 'rewarded-video';
type AdProvider = 'adinplay' | 'adsense' | 'placeholder';

interface AdSlotProps {
  format: AdFormat;
  provider?: AdProvider;
  gameId?: string;
  creatorId?: string;
  className?: string;
  slotId?: string;
  onImpression?: (format: AdFormat, gameId?: string) => void;
}

const FORMAT_DIMENSIONS: Record<AdFormat, { width: number; height: number; label: string }> = {
  leaderboard: { width: 728, height: 90, label: 'Leaderboard' },
  rectangle: { width: 300, height: 250, label: 'Rectangle' },
  'mobile-banner': { width: 320, height: 50, label: 'Banner' },
  interstitial: { width: 320, height: 480, label: 'Interstitial' },
  'rewarded-video': { width: 320, height: 480, label: 'Rewarded Video' },
};

const adProvider = (import.meta.env.VITE_AD_PROVIDER as AdProvider) || 'placeholder';

const ADSENSE_SLOT_IDS: Partial<Record<AdFormat, string>> = {
  leaderboard: import.meta.env.VITE_ADSENSE_SLOT_LEADERBOARD || '',
  rectangle: import.meta.env.VITE_ADSENSE_SLOT_RECTANGLE || '',
  'mobile-banner': import.meta.env.VITE_ADSENSE_SLOT_MOBILE || '',
  interstitial: import.meta.env.VITE_ADSENSE_SLOT_INTERSTITIAL || '',
  'rewarded-video': import.meta.env.VITE_ADSENSE_SLOT_REWARDED || '',
};

const ADSENSE_CLIENT_ID = import.meta.env.VITE_ADSENSE_CLIENT_ID || '';
const ADSENSE_FALLBACK_SLOT = import.meta.env.VITE_ADSENSE_SLOT_ID || '';

let adsenseScriptLoaded = false;
let adsenseScriptLoading = false;

function loadAdSenseScript(clientId: string): void {
  if (adsenseScriptLoaded || adsenseScriptLoading || !clientId) return;
  adsenseScriptLoading = true;

  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`;
  script.onload = () => {
    adsenseScriptLoaded = true;
    adsenseScriptLoading = false;
  };
  script.onerror = () => {
    adsenseScriptLoading = false;
  };
  document.head.appendChild(script);
}

function PlaceholderAd({ format, className }: { format: AdFormat; className?: string }) {
  const dim = FORMAT_DIMENSIONS[format];
  const isOverlay = format === 'interstitial' || format === 'rewarded-video';

  if (isOverlay) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-sloppy-surface/95 border border-sloppy-border rounded-wobbly ${className ?? ''}`}
        style={{ width: dim.width, height: dim.height, maxWidth: '100%' }}
      >
        <span className="text-[10px] uppercase tracking-widest text-sloppy-text-muted/40 font-medium">
          Advertisement
        </span>
        <div className="mt-2 w-16 h-16 rounded-wobbly bg-sloppy-border/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-sloppy-text-muted/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M10 8l5 3.5-5 3.5V8z" fill="currentColor" opacity={0.3} />
          </svg>
        </div>
        <span className="mt-1 text-[9px] text-sloppy-text-muted/30">{dim.label} ({dim.width}x{dim.height})</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center bg-sloppy-surface/60 border border-dashed border-sloppy-border/40 rounded-wobbly overflow-hidden ${className ?? ''}`}
      style={{ width: '100%', maxWidth: dim.width, height: dim.height }}
    >
      <span className="text-[10px] uppercase tracking-widest text-sloppy-text-muted/40 font-medium">
        Advertisement
      </span>
    </div>
  );
}

export function AdSlot({ format, provider, gameId, creatorId, className, slotId, onImpression }: AdSlotProps) {
  const resolvedProvider = provider ?? adProvider;
  const containerRef = useRef<HTMLDivElement>(null);
  const impressionTracked = useRef(false);

  useEffect(() => {
    if (impressionTracked.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !impressionTracked.current) {
          impressionTracked.current = true;
          adsApi.trackImpression({
            adProvider: resolvedProvider,
            format,
            gameId,
            creatorId,
          });
          onImpression?.(format, gameId);
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [format, gameId, creatorId, resolvedProvider, onImpression]);

  return (
    <div ref={containerRef} className={className} data-ad-format={format} data-ad-game={gameId}>
      {resolvedProvider === 'placeholder' && (
        <PlaceholderAd format={format} />
      )}
      {resolvedProvider === 'adinplay' && (
        <AdinPlaySlot format={format} />
      )}
      {resolvedProvider === 'adsense' && (
        <AdSenseSlot format={format} slotId={slotId} />
      )}
    </div>
  );
}

function AdinPlaySlot({ format }: { format: AdFormat }) {
  const dim = FORMAT_DIMENSIONS[format];
  const slotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slotRef.current) return;
    const slotId = `adinplay-${format}-${Math.random().toString(36).slice(2, 8)}`;
    slotRef.current.id = slotId;

    try {
      (window as any).aiptag?.cmd?.display?.push(() => {
        (window as any).aipDisplayTag?.display(slotId);
      });
    } catch {
      // SDK not loaded yet
    }
  }, [format]);

  return (
    <div
      ref={slotRef}
      style={{ width: '100%', maxWidth: dim.width, height: dim.height }}
      className="flex items-center justify-center"
    />
  );
}

function AdSenseSlot({ format, slotId }: { format: AdFormat; slotId?: string }) {
  const dim = FORMAT_DIMENSIONS[format];
  const insRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  const resolvedSlot = slotId || ADSENSE_SLOT_IDS[format] || ADSENSE_FALLBACK_SLOT;

  useEffect(() => {
    if (!ADSENSE_CLIENT_ID) return;
    loadAdSenseScript(ADSENSE_CLIENT_ID);
  }, []);

  useEffect(() => {
    if (pushed.current || !insRef.current || !ADSENSE_CLIENT_ID || !resolvedSlot) return;

    const tryPush = () => {
      try {
        const adsbygoogle = (window as any).adsbygoogle || [];
        (window as any).adsbygoogle = adsbygoogle;
        adsbygoogle.push({});
        pushed.current = true;
      } catch {
        // AdSense not ready yet
      }
    };

    if (adsenseScriptLoaded) {
      tryPush();
    } else {
      const interval = setInterval(() => {
        if (adsenseScriptLoaded) {
          tryPush();
          clearInterval(interval);
        }
      }, 200);
      const timeout = setTimeout(() => clearInterval(interval), 10000);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [resolvedSlot]);

  if (!ADSENSE_CLIENT_ID || !resolvedSlot) {
    return <PlaceholderAd format={format} />;
  }

  return (
    <ins
      ref={insRef}
      className="adsbygoogle"
      style={{ display: 'block', width: '100%', maxWidth: dim.width, height: dim.height }}
      data-ad-client={ADSENSE_CLIENT_ID}
      data-ad-slot={resolvedSlot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}

export default AdSlot;
