import { EventSource } from 'eventsource';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GameConcept } from './brainstorm-agent.js';
import type { Logger } from './logger.js';

export interface BatchRunnerOptions {
  apiUrl: string;
  authToken: string;
  delayMs: number;
  maxConcurrent: number;
  resumeFile?: string;
  logger: Logger;
}

export interface GenerationResult {
  concept: GameConcept;
  status: 'success' | 'failed' | 'skipped';
  gameId?: string;
  error?: string;
  durationMs: number;
}

interface CompletedRecord {
  completedGameIds: string[];
  completedTitles: string[];
}

function loadResumeState(resumeFile: string): CompletedRecord {
  try {
    if (fs.existsSync(resumeFile)) {
      return JSON.parse(fs.readFileSync(resumeFile, 'utf-8'));
    }
  } catch {
    // Corrupted file — start fresh
  }
  return { completedGameIds: [], completedTitles: [] };
}

function saveResumeState(resumeFile: string, state: CompletedRecord): void {
  fs.mkdirSync(path.dirname(resumeFile), { recursive: true });
  fs.writeFileSync(resumeFile, JSON.stringify(state, null, 2));
}

class Semaphore {
  private queue: Array<() => void> = [];
  private running = 0;

  constructor(private readonly maxConcurrent: number) {}

  async acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.running++;
        resolve();
      });
    });
  }

  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) next();
  }
}

async function submitGeneration(
  apiUrl: string,
  authToken: string,
  concept: GameConcept,
): Promise<{ sessionId: string }> {
  const prompt = [
    `Create a ${concept.genre} game called "${concept.title}".`,
    concept.tagline,
    `Core mechanic: ${concept.coreMechanic}`,
    `Unique twist: ${concept.uniqueTwist}`,
    `Visual style: ${concept.visualStyle}`,
  ].join(' ');

  const resp = await fetch(`${apiUrl}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ prompt }),
  });

  if (resp.status === 429) {
    throw new RateLimitError('Rate limited by API');
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Generate endpoint returned ${resp.status}: ${text}`);
  }

  const body = (await resp.json()) as { data: { sessionId: string } };
  return { sessionId: body.data.sessionId };
}

class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

function waitForCompletion(
  apiUrl: string,
  authToken: string,
  sessionId: string,
  timeoutMs = 300_000,
): Promise<{ gameId?: string; error?: string }> {
  return new Promise((resolve, reject) => {
    const url = `${apiUrl}/generate/${sessionId}/status`;
    const es = new EventSource(url, {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          headers: {
            ...init?.headers,
            Authorization: `Bearer ${authToken}`,
          },
        }),
    });

    const timer = setTimeout(() => {
      es.close();
      reject(new Error(`Generation timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Record<string, unknown>;

        if (data.error) {
          clearTimeout(timer);
          es.close();
          resolve({ error: String(data.error) });
          return;
        }

        if (data.completed || data.type === 'complete') {
          clearTimeout(timer);
          es.close();
          resolve({ gameId: (data.gameId as string) || undefined });
          return;
        }

        if (data.type === 'failed') {
          clearTimeout(timer);
          es.close();
          resolve({ error: String(data.reason ?? 'Generation failed') });
          return;
        }
      } catch {
        // Ignore unparseable heartbeats
      }
    };

    es.onerror = (err: Event & { message?: string; code?: number }) => {
      clearTimeout(timer);
      es.close();
      reject(new Error(`SSE connection error: ${err.message ?? `code ${err.code ?? 'unknown'}`}`));
    };
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs a batch of game concepts through the generation pipeline.
 * Respects concurrency limits, rate limiting with exponential backoff,
 * and supports resume from a previous interrupted run.
 */
export async function runBatch(
  concepts: GameConcept[],
  options: BatchRunnerOptions,
): Promise<GenerationResult[]> {
  const {
    apiUrl,
    authToken,
    delayMs,
    maxConcurrent,
    resumeFile,
    logger: log,
  } = options;

  const resumeState = resumeFile
    ? loadResumeState(resumeFile)
    : { completedGameIds: [], completedTitles: [] };

  const semaphore = new Semaphore(maxConcurrent);
  const results: GenerationResult[] = [];
  let backoffMs = 1000;
  const maxBackoffMs = 120_000;

  const tasks = concepts.map((concept, idx) => async () => {
    // Skip already-completed concepts on resume
    if (resumeState.completedTitles.includes(concept.title)) {
      log.info(`[${idx + 1}/${concepts.length}] Skipping "${concept.title}" (already completed)`);
      results.push({
        concept,
        status: 'skipped',
        durationMs: 0,
      });
      return;
    }

    await semaphore.acquire();
    const startTime = Date.now();

    try {
      log.info(`[${idx + 1}/${concepts.length}] Generating "${concept.title}" (${concept.genre})...`);

      let sessionId: string;

      // Submit with retry on rate limit
      while (true) {
        try {
          const result = await submitGeneration(apiUrl, authToken, concept);
          sessionId = result.sessionId;
          backoffMs = 1000;
          break;
        } catch (err) {
          if (err instanceof RateLimitError) {
            log.warn(`Rate limited — backing off ${backoffMs / 1000}s...`);
            await delay(backoffMs);
            backoffMs = Math.min(backoffMs * 2, maxBackoffMs);
            continue;
          }
          throw err;
        }
      }

      log.info(`  Session: ${sessionId} — waiting for completion...`);

      const completion = await waitForCompletion(apiUrl, authToken, sessionId);
      const durationMs = Date.now() - startTime;

      if (completion.error) {
        log.error(`  FAILED "${concept.title}": ${completion.error} (${Math.round(durationMs / 1000)}s)`);
        results.push({ concept, status: 'failed', error: completion.error, durationMs });
      } else {
        log.info(`  SUCCESS "${concept.title}" → ${completion.gameId} (${Math.round(durationMs / 1000)}s)`);
        results.push({ concept, status: 'success', gameId: completion.gameId, durationMs });

        // Update resume state
        if (completion.gameId) {
          resumeState.completedGameIds.push(completion.gameId);
        }
        resumeState.completedTitles.push(concept.title);
        if (resumeFile) {
          saveResumeState(resumeFile, resumeState);
        }
      }

      // Delay before next submission
      if (idx < concepts.length - 1) {
        await delay(delayMs);
      }
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const message = err instanceof Error ? err.message : String(err);
      log.error(`  ERROR "${concept.title}": ${message} (${Math.round(durationMs / 1000)}s)`);
      results.push({ concept, status: 'failed', error: message, durationMs });
    } finally {
      semaphore.release();
    }
  });

  // Execute all tasks (semaphore controls concurrency)
  await Promise.all(tasks.map((task) => task()));

  return results;
}
