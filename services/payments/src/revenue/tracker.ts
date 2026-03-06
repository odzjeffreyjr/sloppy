import { generateId } from '@sloppy/shared';
import type { Database } from '@sloppy/db';
import { adImpressions } from '@sloppy/db';
import { createLogger } from '@sloppy/logger';

const log = createLogger('payments:ad-tracker');

type AdProvider = 'adinplay' | 'adsense' | 'placeholder';
type AdFormat = 'leaderboard' | 'rectangle' | 'mobile-banner' | 'interstitial' | 'rewarded-video';

export interface TrackImpressionInput {
  adProvider: AdProvider;
  format: AdFormat;
  gameId?: string;
  creatorId?: string;
}

const ESTIMATED_CPM: Record<AdFormat, number> = {
  leaderboard: 2.5,
  rectangle: 3.0,
  'mobile-banner': 1.5,
  interstitial: 8.0,
  'rewarded-video': 15.0,
};

function estimateRevenue(format: AdFormat): string {
  const cpm = ESTIMATED_CPM[format] ?? 2.0;
  return (cpm / 1000).toFixed(4);
}

/**
 * Attribution rules:
 * - Platform inventory (no gameId, e.g. store pages, feed transitions): 100% platform
 * - Game inventory (gameId present, e.g. in-game, game page): 50% creator / 50% platform
 */
function getAttributionSplit(gameId?: string): { creatorShare: number; platformShare: number } {
  if (gameId) {
    return { creatorShare: 0.5, platformShare: 0.5 };
  }
  return { creatorShare: 0, platformShare: 1.0 };
}

export function createAdTracker(db: Database) {
  return {
    async trackImpression(input: TrackImpressionInput) {
      const revenue = estimateRevenue(input.format);
      const id = generateId();

      try {
        await db.insert(adImpressions).values({
          id,
          adProvider: input.adProvider,
          format: input.format,
          gameId: input.gameId ?? null,
          creatorId: input.creatorId ?? null,
          estimatedRevenue: revenue,
        });

        log.debug(
          { id, format: input.format, revenue, gameId: input.gameId },
          'ad impression tracked',
        );

        return {
          id,
          estimatedRevenue: parseFloat(revenue),
          attribution: getAttributionSplit(input.gameId),
        };
      } catch (err) {
        log.error({ error: (err as Error).message }, 'failed to track ad impression');
        throw err;
      }
    },

    getAttributionSplit,
    estimateRevenue,
  };
}

export type AdTracker = ReturnType<typeof createAdTracker>;
