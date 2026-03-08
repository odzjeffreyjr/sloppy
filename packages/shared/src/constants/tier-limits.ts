export const TIER_LIMITS = {
  free: {
    maxGames: 2,
    weeklyGameCreations: 1,
    maxVersionsPerGame: 3,
    canPublish: false,
  },
  paid: {
    maxGames: Infinity,
    weeklyGameCreations: Infinity,
    maxVersionsPerGame: 10,
    canPublish: true,
  },
} as const;

export type TierName = keyof typeof TIER_LIMITS;
export type TierLimits = (typeof TIER_LIMITS)[TierName];
