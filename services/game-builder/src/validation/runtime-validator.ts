/// <reference lib="dom" />
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createLogger } from '@sloppy/logger';
import { captureScreenshot } from './screenshot-capture.js';

const log = createLogger('runtime-validator');

const TOTAL_TIMEOUT_MS = 30_000;
const INIT_TIMEOUT_MS = 15_000;
const PLAY_SETTLE_MS = 2_000;
const GAMEOVER_SETTLE_MS = 500;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StateScreenshot {
  rendered: boolean;
  screenshot?: Buffer;
  thumbnail?: Buffer;
}

export interface RuntimeValidationResult {
  passed: boolean;
  states: {
    intro: StateScreenshot;
    playing: StateScreenshot;
    paused: StateScreenshot;
    gameover: StateScreenshot;
  };
  consoleErrors: string[];
  crashedDuring?: string;
  fps?: number;
}

// ---------------------------------------------------------------------------
// Warm browser pool (single instance, new page per validation)
// ---------------------------------------------------------------------------

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });
  }
  return browser;
}

/** Shut down the warm browser instance (call on process exit). */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeBundleToTempDir(
  files: Record<string, string>,
): Promise<string> {
  const tempDir = join(tmpdir(), `sloppy-validate-${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = join(tempDir, filePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content);
  }

  return tempDir;
}

/** Evaluate a game method in the page, returning any error message. */
async function callGameMethod(
  page: Page,
  expr: string,
): Promise<string | null> {
  return page.evaluate((code) => {
    try {
      // eslint-disable-next-line no-eval
      eval(code);
      return null;
    } catch (err: any) {
      return err?.message ?? String(err);
    }
  }, expr);
}

async function getGameState(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    try {
      return (window as any).game?.getState?.() ?? null;
    } catch {
      return null;
    }
  });
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run a Puppeteer-based runtime validation of a v2 game bundle.
 *
 * Drives the game through its full state machine
 * (init -> start -> pause -> resume -> game-over -> restart),
 * captures screenshots at each state, and collects console errors.
 */
export async function validateRuntime(
  files: Record<string, string>,
): Promise<RuntimeValidationResult> {
  const result: RuntimeValidationResult = {
    passed: false,
    states: {
      intro: { rendered: false },
      playing: { rendered: false },
      paused: { rendered: false },
      gameover: { rendered: false },
    },
    consoleErrors: [],
  };

  const tempDir = await writeBundleToTempDir(files);
  let page: Page | null = null;

  const timeout = setTimeout(() => {
    if (page) {
      page.close().catch(() => {});
      page = null;
    }
  }, TOTAL_TIMEOUT_MS);

  try {
    const browserInstance = await getBrowser();
    page = await browserInstance.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // Collect console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        result.consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      result.consoleErrors.push((err as Error).message ?? String(err));
    });

    // Set up ready-signal listener before navigation
    await page.evaluateOnNewDocument(() => {
      (window as any).__sloppyReady = false;
      window.addEventListener('message', (e: MessageEvent) => {
        if (
          e.data === 'sloppy:game:ready' ||
          (e.data && e.data.type === 'sloppy:game:ready')
        ) {
          (window as any).__sloppyReady = true;
        }
      });
    });

    // Load the game
    const fileUrl = `file://${join(tempDir, 'index.html')}`;
    await page.goto(fileUrl, {
      waitUntil: 'domcontentloaded',
      timeout: INIT_TIMEOUT_MS,
    });

    // Wait for the game to signal ready
    try {
      await page.waitForFunction(
        () => (window as any).__sloppyReady === true,
        { timeout: INIT_TIMEOUT_MS },
      );
    } catch {
      result.crashedDuring = 'init';
      result.consoleErrors.push('Timeout waiting for sloppy:game:ready');
      return result;
    }

    // Verify game object is accessible
    const hasGame = await page.evaluate(() => typeof (window as any).game === 'object');
    if (!hasGame) {
      result.crashedDuring = 'init';
      result.consoleErrors.push('window.game is not exposed');
      return result;
    }

    // -- Intro screenshot ---------------------------------------------------
    try {
      const shot = await captureScreenshot(page);
      result.states.intro = {
        rendered: true,
        screenshot: shot.full,
        thumbnail: shot.thumbnail,
      };
    } catch (err) {
      result.crashedDuring = 'intro';
      result.consoleErrors.push(`Failed to capture intro screenshot: ${(err as Error).message}`);
    }

    // -- start() -> playing -------------------------------------------------
    try {
      const err = await callGameMethod(page, 'window.game.start()');
      if (err) throw new Error(err);

      const state = await getGameState(page);
      if (state !== 'playing') {
        result.consoleErrors.push(
          `Expected state 'playing' after start(), got '${state}'`,
        );
      }

      await new Promise((r) => setTimeout(r, PLAY_SETTLE_MS));

      const shot = await captureScreenshot(page);
      result.states.playing = {
        rendered: true,
        screenshot: shot.full,
        thumbnail: shot.thumbnail,
      };
    } catch (err) {
      result.crashedDuring = 'start';
      result.consoleErrors.push(`Crashed during start: ${(err as Error).message}`);
    }

    // -- pause() -> paused --------------------------------------------------
    try {
      const err = await callGameMethod(page, 'window.game.pause()');
      if (err) throw new Error(err);

      const state = await getGameState(page);
      if (state !== 'paused') {
        result.consoleErrors.push(
          `Expected state 'paused' after pause(), got '${state}'`,
        );
      }

      const shot = await captureScreenshot(page);
      result.states.paused = {
        rendered: true,
        screenshot: shot.full,
        thumbnail: shot.thumbnail,
      };
    } catch (err) {
      result.crashedDuring = 'pause';
      result.consoleErrors.push(`Crashed during pause: ${(err as Error).message}`);
    }

    // -- resume() -> playing ------------------------------------------------
    try {
      const err = await callGameMethod(page, 'window.game.resume()');
      if (err) throw new Error(err);

      const state = await getGameState(page);
      if (state !== 'playing') {
        result.consoleErrors.push(
          `Expected state 'playing' after resume(), got '${state}'`,
        );
      }
    } catch (err) {
      result.crashedDuring = 'resume';
      result.consoleErrors.push(`Crashed during resume: ${(err as Error).message}`);
    }

    // -- game over ----------------------------------------------------------
    try {
      // Prefer a test hook; fall back to calling renderGameOverScreen directly
      const err = await callGameMethod(
        page,
        `(typeof window.game.triggerGameOver === 'function')
          ? window.game.triggerGameOver()
          : window.game.renderGameOverScreen({ score: 0, timeElapsed: 0 })`,
      );
      if (err) throw new Error(err);

      await new Promise((r) => setTimeout(r, GAMEOVER_SETTLE_MS));

      const shot = await captureScreenshot(page);
      result.states.gameover = {
        rendered: true,
        screenshot: shot.full,
        thumbnail: shot.thumbnail,
      };
    } catch (err) {
      result.crashedDuring = 'gameover';
      result.consoleErrors.push(`Crashed during gameover: ${(err as Error).message}`);
    }

    // -- restart() -> playing -----------------------------------------------
    try {
      const err = await callGameMethod(page, 'window.game.restart()');
      if (err) throw new Error(err);

      const state = await getGameState(page);
      if (state !== 'playing') {
        result.consoleErrors.push(
          `Expected state 'playing' after restart(), got '${state}'`,
        );
      }
    } catch (err) {
      result.crashedDuring = 'restart';
      result.consoleErrors.push(`Crashed during restart: ${(err as Error).message}`);
    }

    // -- Determine pass/fail ------------------------------------------------
    result.passed =
      result.states.intro.rendered &&
      result.states.playing.rendered &&
      result.states.paused.rendered &&
      result.states.gameover.rendered &&
      !result.crashedDuring;
  } catch (err) {
    log.error({ error: err }, 'Runtime validation failed unexpectedly');
    result.consoleErrors.push(`Unexpected error: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);

    if (page) {
      try { await page.close(); } catch { /* already closed by timeout */ }
    }

    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch { /* best-effort cleanup */ }
  }

  return result;
}
