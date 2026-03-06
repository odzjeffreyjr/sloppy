import sharp from 'sharp';
import { createLogger } from '@sloppy/logger';

const log = createLogger('thumbnail-compositor');

const FULL_WIDTH = 1280;
const FULL_HEIGHT = 720;
const SMALL_WIDTH = 300;
const SMALL_HEIGHT = 169;

const GENRE_BADGE_COLORS: Record<string, string> = {
  '2d-platformer': '#4CAF50',
  '2d-topdown': '#2196F3',
  '2d-puzzle': '#9C27B0',
  '2d-arcade': '#FF9800',
  '2d-shooter': '#F44336',
  '2d-tower-defense': '#795548',
  '2d-endless-runner': '#00BCD4',
  '2d-rhythm': '#E91E63',
  '2d-cards': '#673AB7',
  '2d-idle': '#CDDC39',
  '2d-custom': '#607D8B',
  '3d-racing': '#FF5722',
  '3d-firstperson': '#D32F2F',
  '3d-puzzle': '#7B1FA2',
  '3d-thirdperson': '#0288D1',
  '3d-flight': '#1565C0',
  '3d-platformer': '#388E3C',
  '3d-custom': '#455A64',
};

function formatGenreLabel(genre: string): string {
  return genre
    .replace(/^(2d|3d)-/, (_, dim) => `${dim.toUpperCase()} `)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildGradientOverlay(): Buffer {
  const svg = `<svg width="${FULL_WIDTH}" height="${FULL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="black" stop-opacity="0"/>
      <stop offset="60%" stop-color="black" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.75"/>
    </linearGradient>
  </defs>
  <rect width="${FULL_WIDTH}" height="${FULL_HEIGHT}" fill="url(#grad)"/>
</svg>`;
  return Buffer.from(svg);
}

function buildTitleOverlay(title: string): Buffer {
  const escaped = escapeXml(title);
  const fontSize = title.length > 30 ? 42 : title.length > 20 ? 48 : 56;

  const svg = `<svg width="${FULL_WIDTH}" height="${FULL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <text x="48" y="${FULL_HEIGHT - 40}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="bold" fill="white" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.6))">
    ${escaped}
  </text>
</svg>`;
  return Buffer.from(svg);
}

function buildGenreBadge(genre: string): Buffer {
  const label = escapeXml(formatGenreLabel(genre));
  const bgColor = GENRE_BADGE_COLORS[genre] || '#607D8B';
  const pillWidth = Math.max(label.length * 11 + 32, 100);
  const pillHeight = 32;
  const x = FULL_WIDTH - pillWidth - 24;
  const y = 24;
  const radius = 16;

  const svg = `<svg width="${FULL_WIDTH}" height="${FULL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${x}" y="${y}" width="${pillWidth}" height="${pillHeight}" rx="${radius}" ry="${radius}" fill="${bgColor}" opacity="0.9"/>
  <text x="${x + pillWidth / 2}" y="${y + pillHeight / 2 + 5}" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="bold" fill="white" text-anchor="middle">
    ${label}
  </text>
</svg>`;
  return Buffer.from(svg);
}

function buildVignetteOverlay(): Buffer {
  const svg = `<svg width="${FULL_WIDTH}" height="${FULL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="vig" cx="50%" cy="50%" r="70%">
      <stop offset="50%" stop-color="black" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.4"/>
    </radialGradient>
  </defs>
  <rect width="${FULL_WIDTH}" height="${FULL_HEIGHT}" fill="url(#vig)"/>
</svg>`;
  return Buffer.from(svg);
}

export interface CompositorResult {
  /** Full-size thumbnail (1280×720) in WebP */
  thumbnail: Buffer;
  /** Small thumbnail (300×169) in WebP for game cards */
  thumbnailSm: Buffer;
}

/**
 * Compose a marketing-quality game thumbnail with post-processing.
 *
 * Steps:
 *   1. Resize base image to 1280×720
 *   2. Add gradient overlay at bottom for text legibility
 *   3. Add title text (bottom-left, bold) via SVG
 *   4. Add genre badge (top-right pill) via SVG
 *   5. Add subtle vignette
 *   6. Output as WebP (quality 85)
 *   7. Generate small 300×169 thumbnail for game cards
 */
export async function composeThumbnail(
  baseImage: Buffer,
  title: string,
  genre: string,
): Promise<CompositorResult> {
  try {
    const resized = sharp(baseImage).resize(FULL_WIDTH, FULL_HEIGHT, {
      fit: 'cover',
      position: 'center',
    });

    const composited = await resized
      .composite([
        { input: buildVignetteOverlay(), blend: 'over' },
        { input: buildGradientOverlay(), blend: 'over' },
        { input: buildTitleOverlay(title), blend: 'over' },
        { input: buildGenreBadge(genre), blend: 'over' },
      ])
      .webp({ quality: 85 })
      .toBuffer();

    const small = await sharp(composited)
      .resize(SMALL_WIDTH, SMALL_HEIGHT, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();

    log.info(
      { title, genre, fullSize: composited.length, smallSize: small.length },
      'Thumbnail composed',
    );

    return { thumbnail: composited, thumbnailSm: small };
  } catch (err) {
    log.error({ error: err, title }, 'Thumbnail composition failed');
    throw err;
  }
}

/**
 * Compose a fallback thumbnail from a raw Puppeteer screenshot.
 * Used when FLUX generation fails — applies the same post-processing
 * (gradient, title, genre badge, vignette) to the screenshot.
 */
export async function composeFallbackThumbnail(
  screenshotBuffer: Buffer,
  title: string,
  genre: string,
): Promise<CompositorResult> {
  return composeThumbnail(screenshotBuffer, title, genre);
}
