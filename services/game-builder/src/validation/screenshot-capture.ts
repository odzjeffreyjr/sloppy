import type { Page } from 'puppeteer';
import sharp from 'sharp';

const FULL_WIDTH = 1280;
const FULL_HEIGHT = 720;
const THUMB_WIDTH = 300;
const THUMB_HEIGHT = 169;

export interface ScreenshotResult {
  full: Buffer;
  thumbnail: Buffer;
}

/** Take a PNG screenshot at 1280x720 and generate a 300x169 thumbnail. */
export async function captureScreenshot(page: Page): Promise<ScreenshotResult> {
  const raw = await page.screenshot({
    type: 'png',
    clip: { x: 0, y: 0, width: FULL_WIDTH, height: FULL_HEIGHT },
  });
  const full = Buffer.from(raw);
  const thumbnail = await generateThumbnail(full);
  return { full, thumbnail };
}

/** Resize an image buffer to the card-preview thumbnail dimensions. */
export async function generateThumbnail(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize(THUMB_WIDTH, THUMB_HEIGHT, { fit: 'cover' })
    .png()
    .toBuffer();
}
