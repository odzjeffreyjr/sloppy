export const config = {
  port: parseInt(process.env.PORT || '3003', 10),

  databaseUrl: process.env.DATABASE_URL!,

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  gcs: {
    bucket: process.env.GCS_BUCKET || 'sloppy-game-bundles',
    credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  },

  cdn: {
    baseUrl:
      process.env.CDN_BASE_URL ||
      `https://storage.googleapis.com/${process.env.GCS_BUCKET || 'sloppy-game-bundles'}`,
  },

  validation: {
    maxBundleSizeBytes: parseInt(
      process.env.MAX_BUNDLE_SIZE_BYTES || String(5 * 1024 * 1024),
      10,
    ),
  },

  playDebounce: {
    windowSeconds: parseInt(
      process.env.PLAY_DEBOUNCE_WINDOW_SECONDS || '300',
      10,
    ),
  },
};
