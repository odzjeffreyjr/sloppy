import { createLogger } from '@sloppy/logger';

const log = createLogger('fal-client');

const FAL_KEY = process.env.FAL_KEY || '';
const FAL_API_BASE = 'https://queue.fal.run';

const MAX_RETRIES = 2;
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_TIME_MS = 120_000;

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
 * - `fal-ai/flux/schnell` for batch (faster, cheaper)
 * - `fal-ai/flux-dev` for creator games (higher quality)
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

  const model = options.model === 'dev' ? 'fal-ai/flux-dev' : 'fal-ai/flux/schnell';

  const payload: Record<string, unknown> = {
    prompt,
    image_size: { width: 1280, height: 720 },
    num_images: 1,
    enable_safety_checker: false,
  };

  if (options.referenceImageBase64) {
    payload.image_url = `data:image/png;base64,${options.referenceImageBase64}`;
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const imageBuffer = await callFalApi(model, payload);
      if (imageBuffer) return imageBuffer;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn({ attempt, error: message }, 'fal.ai request failed');

      if (attempt >= MAX_RETRIES) {
        log.error({ attempts: attempt + 1 }, 'fal.ai thumbnail generation failed after all retries');
        return null;
      }

      await sleep(1000 * (attempt + 1));
    }
  }

  return null;
}

async function callFalApi(
  model: string,
  payload: Record<string, unknown>,
): Promise<Buffer | null> {
  // Submit the request to the queue
  const submitResp = await fetch(`${FAL_API_BASE}/${model}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!submitResp.ok) {
    const text = await submitResp.text().catch(() => '');
    throw new Error(`fal.ai submit failed (${submitResp.status}): ${text}`);
  }

  const queueData = (await submitResp.json()) as FalQueueResponse;

  // If the response already contains images (synchronous response), extract directly
  const syncResult = queueData as unknown as FalResultResponse;
  if (syncResult.images?.length) {
    return downloadImage(syncResult.images[0].url);
  }

  // Otherwise poll the queue for completion
  if (!queueData.request_id) {
    throw new Error('fal.ai response missing request_id');
  }

  const statusUrl = `${FAL_API_BASE}/${model}/requests/${queueData.request_id}/status`;
  const resultUrl = queueData.response_url || `${FAL_API_BASE}/${model}/requests/${queueData.request_id}`;

  const startTime = Date.now();

  while (Date.now() - startTime < MAX_POLL_TIME_MS) {
    await sleep(POLL_INTERVAL_MS);

    const statusResp = await fetch(statusUrl, {
      headers: { 'Authorization': `Key ${FAL_KEY}` },
    });

    if (!statusResp.ok) continue;

    const statusData = (await statusResp.json()) as { status: string };

    if (statusData.status === 'COMPLETED') {
      const resultResp = await fetch(resultUrl, {
        headers: { 'Authorization': `Key ${FAL_KEY}` },
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

      return downloadImage(resultData.images[0].url);
    }

    if (statusData.status === 'FAILED') {
      throw new Error('fal.ai generation failed');
    }
  }

  throw new Error('fal.ai generation timed out');
}

async function downloadImage(url: string): Promise<Buffer> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to download generated image (${resp.status})`);
  }
  const arrayBuffer = await resp.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
