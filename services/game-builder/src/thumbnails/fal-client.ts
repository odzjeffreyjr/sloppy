import { createLogger } from '@sloppy/logger';

const log = createLogger('fal-client');

const FAL_KEY = process.env.FAL_KEY || '';
const FAL_SYNC_BASE = 'https://fal.run';
const FAL_QUEUE_BASE = 'https://queue.fal.run';

const SYNC_TIMEOUT_MS = 60_000;
const QUEUE_POLL_INTERVAL_MS = 2000;
const QUEUE_MAX_POLL_MS = 30_000;
const DOWNLOAD_TIMEOUT_MS = 15_000;

interface FalQueueResponse {
  request_id: string;
  status: string;
  response_url?: string;
}

interface FalResultResponse {
  images?: Array<{ url: string; content_type?: string }>;
  error?: string;
}

/**
 * Generate a thumbnail image using fal.ai FLUX model.
 *
 * - `schnell` uses the synchronous API (fast, ~5s)
 * - `dev` uses the queue API (slower, higher quality)
 *
 * Returns the image as a Buffer, or null if generation fails.
 */
export async function generateThumbnail(
  prompt: string,
  options: {
    model?: 'schnell' | 'dev';
    referenceImageBase64?: string;
  } = {},
): Promise<Buffer | null> {
  if (!FAL_KEY) {
    log.warn('FAL_KEY not set — skipping thumbnail generation');
    return null;
  }

  const useDev = options.model === 'dev';
  const model = useDev ? 'fal-ai/flux/dev' : 'fal-ai/flux/schnell';

  const payload: Record<string, unknown> = {
    prompt,
    image_size: { width: 1280, height: 720 },
    num_images: 1,
    enable_safety_checker: false,
  };

  if (options.referenceImageBase64) {
    payload.image_url = `data:image/png;base64,${options.referenceImageBase64}`;
  }

  try {
    const imageBuffer = await callFalSync(model, payload);
    if (imageBuffer) return imageBuffer;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ error: message, model }, 'fal.ai thumbnail generation failed');
  }

  return null;
}

/**
 * Synchronous call — submit and get result in one request.
 * Best for schnell which generates in <10s.
 */
async function callFalSync(
  model: string,
  payload: Record<string, unknown>,
): Promise<Buffer | null> {
  log.info({ model }, 'Submitting synchronous fal.ai request');

  const resp = await fetch(`${FAL_SYNC_BASE}/${model}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`fal.ai sync request failed (${resp.status}): ${text}`);
  }

  const data = (await resp.json()) as FalResultResponse;

  if (data.error) {
    throw new Error(`fal.ai generation error: ${data.error}`);
  }

  if (!data.images?.length) {
    throw new Error('fal.ai returned no images');
  }

  log.info({ model }, 'fal.ai sync request succeeded');
  return downloadImage(data.images[0].url);
}

/**
 * Queue-based call — submit, poll for status, fetch result.
 * Used for slower models (dev) that exceed sync timeout.
 */
async function callFalQueue(
  model: string,
  payload: Record<string, unknown>,
): Promise<Buffer | null> {
  log.info({ model }, 'Submitting queued fal.ai request');

  const submitResp = await fetch(`${FAL_QUEUE_BASE}/${model}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
  });

  if (!submitResp.ok) {
    const text = await submitResp.text().catch(() => '');
    throw new Error(`fal.ai queue submit failed (${submitResp.status}): ${text}`);
  }

  const queueData = (await submitResp.json()) as FalQueueResponse;

  const syncResult = queueData as unknown as FalResultResponse;
  if (syncResult.images?.length) {
    return downloadImage(syncResult.images[0].url);
  }

  if (!queueData.request_id) {
    throw new Error('fal.ai queue response missing request_id');
  }

  const statusUrl = `${FAL_QUEUE_BASE}/${model}/requests/${queueData.request_id}/status`;
  const resultUrl = queueData.response_url || `${FAL_QUEUE_BASE}/${model}/requests/${queueData.request_id}`;

  log.info({ requestId: queueData.request_id }, 'Polling fal.ai queue');

  const startTime = Date.now();

  while (Date.now() - startTime < QUEUE_MAX_POLL_MS) {
    await sleep(QUEUE_POLL_INTERVAL_MS);

    const statusResp = await fetch(statusUrl, {
      headers: { 'Authorization': `Key ${FAL_KEY}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!statusResp.ok) {
      log.warn({ status: statusResp.status }, 'fal.ai status poll returned non-OK');
      continue;
    }

    const statusData = (await statusResp.json()) as { status: string; queue_position?: number };
    log.info({ queueStatus: statusData.status, position: statusData.queue_position }, 'fal.ai poll');

    if (statusData.status === 'COMPLETED') {
      const resultResp = await fetch(resultUrl, {
        headers: { 'Authorization': `Key ${FAL_KEY}` },
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      });

      if (!resultResp.ok) {
        throw new Error(`fal.ai result fetch failed (${resultResp.status})`);
      }

      const resultData = (await resultResp.json()) as FalResultResponse;

      if (resultData.error) {
        throw new Error(`fal.ai generation error: ${resultData.error}`);
      }

      if (!resultData.images?.length) {
        throw new Error('fal.ai returned no images');
      }

      log.info({ model, elapsedMs: Date.now() - startTime }, 'fal.ai queue request succeeded');
      return downloadImage(resultData.images[0].url);
    }

    if (statusData.status === 'FAILED') {
      throw new Error('fal.ai generation failed');
    }
  }

  throw new Error(`fal.ai queue timed out after ${QUEUE_MAX_POLL_MS}ms`);
}

async function downloadImage(url: string): Promise<Buffer> {
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!resp.ok) {
    throw new Error(`Failed to download generated image (${resp.status})`);
  }
  const arrayBuffer = await resp.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
