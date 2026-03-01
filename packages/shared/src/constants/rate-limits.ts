/** Max game generations a single user can request per hour. */
export const MAX_GENERATIONS_PER_HOUR = 10;

/** Max AI tokens a single user can consume per day. */
export const MAX_TOKENS_PER_DAY = 500_000;

/** Max concurrent generation jobs per user. */
export const MAX_CONCURRENT_GENERATIONS = 2;

/** Global generation queue ceiling before overflow rejection. */
export const GLOBAL_QUEUE_LIMIT = 200;

/** General API rate limit — requests per minute per IP. */
export const API_RATE_LIMIT_RPM = 120;
