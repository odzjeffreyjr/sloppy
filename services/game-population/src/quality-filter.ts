import type { Logger } from './logger.js';

export interface QualityCheckResult {
  gameId: string;
  title: string;
  passed: boolean;
  reason?: string;
  action: 'publish' | 'needs_review' | 'skip';
}

interface GameDetail {
  id: string;
  title: string;
  status: string;
  storagePath: string | null;
  thumbnailUrl: string | null;
  thumbnailSmUrl: string | null;
  bundleUrl: string | null;
}

interface QualityFilterOptions {
  apiUrl: string;
  authToken: string;
  logger: Logger;
}

const MIN_BUNDLE_SIZE_BYTES = 5 * 1024; // 5KB

async function fetchGameDetail(
  apiUrl: string,
  authToken: string,
  gameId: string,
): Promise<GameDetail | null> {
  const resp = await fetch(`${apiUrl}/games/${gameId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  if (!resp.ok) return null;

  const body = (await resp.json()) as { data: GameDetail };
  return body.data;
}

async function checkBundleSize(game: GameDetail): Promise<boolean> {
  if (!game.bundleUrl) return false;

  try {
    const headResp = await fetch(game.bundleUrl, { method: 'HEAD' });
    const contentLength = headResp.headers.get('content-length');
    if (!contentLength) return true; // Can't determine size — assume OK

    return parseInt(contentLength, 10) >= MIN_BUNDLE_SIZE_BYTES;
  } catch {
    return true; // On network error, don't reject on this criterion
  }
}

async function checkTitleUniqueness(
  apiUrl: string,
  authToken: string,
  title: string,
  gameId: string,
): Promise<boolean> {
  try {
    const resp = await fetch(
      `${apiUrl}/games/search?q=${encodeURIComponent(title)}&limit=5`,
      { headers: { Authorization: `Bearer ${authToken}` } },
    );

    if (!resp.ok) return true; // Can't check — assume unique

    const body = (await resp.json()) as { data: Array<{ id: string; title: string }> };
    const duplicates = body.data.filter(
      (g) => g.id !== gameId && g.title.toLowerCase() === title.toLowerCase(),
    );
    return duplicates.length === 0;
  } catch {
    return true;
  }
}

async function publishGame(
  apiUrl: string,
  authToken: string,
  gameId: string,
): Promise<boolean> {
  const resp = await fetch(`${apiUrl}/games/${gameId}/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
  });

  return resp.ok || resp.status === 409; // 409 = already published
}

/**
 * Post-generation quality gate. Checks each successfully generated game
 * against quality criteria and auto-publishes passing games.
 */
export async function runQualityFilter(
  gameIds: Array<{ gameId: string; title: string }>,
  options: QualityFilterOptions,
): Promise<QualityCheckResult[]> {
  const { apiUrl, authToken, logger: log } = options;
  const results: QualityCheckResult[] = [];

  for (const { gameId, title } of gameIds) {
    log.info(`Quality check: "${title}" (${gameId})`);

    // Fetch game detail
    const game = await fetchGameDetail(apiUrl, authToken, gameId);
    if (!game) {
      log.warn(`  Could not fetch game ${gameId} — skipping`);
      results.push({ gameId, title, passed: false, reason: 'Game not found', action: 'skip' });
      continue;
    }

    // Check 1: Has storage path (bundle was saved)
    if (!game.storagePath) {
      log.warn(`  No storage path — needs_review`);
      results.push({ gameId, title, passed: false, reason: 'No bundle stored', action: 'needs_review' });
      continue;
    }

    // Check 2: Has thumbnail (means screenshots were captured successfully)
    if (!game.thumbnailUrl) {
      log.warn(`  No thumbnail — needs_review`);
      results.push({ gameId, title, passed: false, reason: 'No thumbnail generated', action: 'needs_review' });
      continue;
    }

    // Check 3: Bundle size above minimum
    const sizeOk = await checkBundleSize(game);
    if (!sizeOk) {
      log.warn(`  Bundle too small (<${MIN_BUNDLE_SIZE_BYTES}B) — needs_review`);
      results.push({ gameId, title, passed: false, reason: 'Bundle too small', action: 'needs_review' });
      continue;
    }

    // Check 4: Title uniqueness
    const unique = await checkTitleUniqueness(apiUrl, authToken, title, gameId);
    if (!unique) {
      log.warn(`  Duplicate title "${title}" — needs_review`);
      results.push({ gameId, title, passed: false, reason: 'Duplicate title', action: 'needs_review' });
      continue;
    }

    // All checks passed — auto-publish
    const published = await publishGame(apiUrl, authToken, gameId);
    if (published) {
      log.info(`  PUBLISHED "${title}"`);
      results.push({ gameId, title, passed: true, action: 'publish' });
    } else {
      log.warn(`  Passed quality but publish failed — needs_review`);
      results.push({ gameId, title, passed: true, reason: 'Publish API call failed', action: 'needs_review' });
    }
  }

  return results;
}
