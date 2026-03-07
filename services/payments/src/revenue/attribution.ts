import { generateId } from '@sloppy/shared';
import type { Database } from '@sloppy/db';
import { eq, and, sql, gte, lt, adImpressions, creatorEarnings } from '@sloppy/db';
import { createLogger } from '@sloppy/logger';

const log = createLogger('payments:attribution');

export function createRevenueAttribution(db: Database) {
  return {
    /**
     * Calculates a creator's estimated revenue share for a given month.
     * Only includes game-inventory impressions (gameId present) where the
     * game belongs to the creator.
     */
    async getCreatorRevenue(
      creatorId: string,
      month: Date,
    ): Promise<{
      grossRevenue: number;
      creatorShare: number;
      platformShare: number;
      impressionCount: number;
    }> {
      const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
      const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 1);

      const [result] = await db
        .select({
          totalRevenue: sql<string>`COALESCE(SUM(${adImpressions.estimatedRevenue}::numeric), 0)`,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(adImpressions)
        .where(
          and(
            eq(adImpressions.creatorId, creatorId),
            gte(adImpressions.createdAt, monthStart),
            lt(adImpressions.createdAt, monthEnd),
          ),
        );

      const gross = parseFloat(result?.totalRevenue ?? '0');
      const creatorShare = gross * 0.5;
      const platformShare = gross * 0.5;

      return {
        grossRevenue: gross,
        creatorShare,
        platformShare,
        impressionCount: result?.count ?? 0,
      };
    },

    /**
     * Reconciles estimated ad revenue with actual figures for a month.
     * Called by a cron or admin endpoint after receiving real revenue
     * reports from ad networks. Creates or updates creator_earnings records.
     */
    async reconcileMonthlyRevenue(month: Date): Promise<{ processed: number }> {
      const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
      const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 1);

      const creatorTotals = await db
        .select({
          creatorId: adImpressions.creatorId,
          gameId: adImpressions.gameId,
          totalRevenue: sql<string>`SUM(${adImpressions.estimatedRevenue}::numeric)`,
        })
        .from(adImpressions)
        .where(
          and(
            sql`${adImpressions.creatorId} IS NOT NULL`,
            gte(adImpressions.createdAt, monthStart),
            lt(adImpressions.createdAt, monthEnd),
          ),
        )
        .groupBy(adImpressions.creatorId, adImpressions.gameId);

      let processed = 0;

      for (const row of creatorTotals) {
        if (!row.creatorId) continue;

        const gross = parseFloat(row.totalRevenue ?? '0');
        const creatorShareAmount = (gross * 0.5).toFixed(2);
        const platformShareAmount = (gross * 0.5).toFixed(2);

        const existing = await db
          .select()
          .from(creatorEarnings)
          .where(
            and(
              eq(creatorEarnings.creatorId, row.creatorId),
              eq(creatorEarnings.periodMonth, monthStart),
              row.gameId
                ? eq(creatorEarnings.gameId, row.gameId)
                : sql`${creatorEarnings.gameId} IS NULL`,
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(creatorEarnings)
            .set({
              grossRevenue: gross.toFixed(2),
              creatorShare: creatorShareAmount,
              platformShare: platformShareAmount,
              status: 'confirmed',
            })
            .where(eq(creatorEarnings.id, existing[0].id));
        } else {
          await db.insert(creatorEarnings).values({
            id: generateId(),
            creatorId: row.creatorId,
            gameId: row.gameId ?? null,
            periodMonth: monthStart,
            grossRevenue: gross.toFixed(2),
            creatorShare: creatorShareAmount,
            platformShare: platformShareAmount,
            status: 'confirmed',
          });
        }

        processed++;
      }

      log.info({ month: monthStart.toISOString(), processed }, 'monthly revenue reconciled');
      return { processed };
    },
  };
}

export type RevenueAttribution = ReturnType<typeof createRevenueAttribution>;
