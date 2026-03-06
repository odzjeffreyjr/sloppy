import { Storage } from '@google-cloud/storage';
import { config } from '../config.js';

let storage: Storage | null = null;

function getStorage(): Storage {
  if (!storage) {
    storage = new Storage();
  }
  return storage;
}

function getBucket() {
  return getStorage().bucket(config.gcs.bucket);
}

export interface BundleFile {
  path: string;
  content: string | Buffer;
  contentType: string;
}

/**
 * Upload all files for a game version to GCS.
 * Returns the base storage path (e.g. `games/{gameId}/v{version}/`).
 */
export async function uploadBundle(
  gameId: string,
  version: number,
  files: BundleFile[],
): Promise<string> {
  const basePath = `games/${gameId}/v${version}`;
  const bucket = getBucket();

  await Promise.all(
    files.map(async (file) => {
      const gcsPath = `${basePath}/${file.path}`;
      const gcsFile = bucket.file(gcsPath);

      await gcsFile.save(
        typeof file.content === 'string'
          ? Buffer.from(file.content)
          : file.content,
        {
          metadata: {
            contentType: file.contentType,
            cacheControl: 'public, max-age=31536000, immutable',
          },
          resumable: false,
        },
      );
    }),
  );

  return basePath;
}

/** Build the public CDN URL for a file within a game bundle. */
export function getBundleUrl(storagePath: string, filePath = 'index.html'): string {
  return `${config.cdn.baseUrl}/${storagePath}/${filePath}`;
}

/** Delete all files for a game version from GCS. */
export async function deleteBundle(storagePath: string): Promise<void> {
  const bucket = getBucket();
  await bucket.deleteFiles({ prefix: `${storagePath}/` });
}

/** Fetch a single file's contents from GCS. */
export async function fetchBundleFile(
  storagePath: string,
  filePath: string,
): Promise<Buffer> {
  const bucket = getBucket();
  const [contents] = await bucket
    .file(`${storagePath}/${filePath}`)
    .download();
  return contents;
}

// ---------------------------------------------------------------------------
// Audio file uploads
// ---------------------------------------------------------------------------

export interface AudioFile {
  name: string;
  data: Buffer;
  mimeType: string;
}

/**
 * Upload audio files for a game version to GCS.
 * Stored under games/{gameId}/v{version}/audio/
 * Returns a map of audio name → public CDN URL.
 */
export async function uploadAudioFiles(
  gameId: string,
  version: number,
  audioFiles: AudioFile[],
): Promise<Record<string, string>> {
  const basePath = `games/${gameId}/v${version}/audio`;
  const bucket = getBucket();
  const urls: Record<string, string> = {};

  await Promise.all(
    audioFiles.map(async (file) => {
      const gcsPath = `${basePath}/${file.name}`;
      const gcsFile = bucket.file(gcsPath);

      await gcsFile.save(file.data, {
        metadata: {
          contentType: file.mimeType,
          cacheControl: 'public, max-age=31536000, immutable',
        },
        resumable: false,
      });

      urls[file.name] = `${config.cdn.baseUrl}/${gcsPath}`;
    }),
  );

  return urls;
}

// ---------------------------------------------------------------------------
// Thumbnail uploads
// ---------------------------------------------------------------------------

export interface ThumbnailFiles {
  /** Full-size thumbnail (1280×720) in WebP */
  thumbnail: Buffer;
  /** Small thumbnail (300×169) in WebP for game cards */
  thumbnailSm: Buffer;
}

/**
 * Upload thumbnail images for a game version to GCS.
 * Stored as games/{gameId}/v{version}/thumbnail.webp and thumbnail_sm.webp.
 * Returns { thumbnailUrl, thumbnailSmUrl }.
 */
export async function uploadThumbnails(
  gameId: string,
  version: number,
  thumbnails: ThumbnailFiles,
): Promise<{ thumbnailUrl: string; thumbnailSmUrl: string }> {
  const basePath = `games/${gameId}/v${version}`;
  const bucket = getBucket();

  const uploads: Array<{ path: string; data: Buffer }> = [
    { path: `${basePath}/thumbnail.webp`, data: thumbnails.thumbnail },
    { path: `${basePath}/thumbnail_sm.webp`, data: thumbnails.thumbnailSm },
  ];

  await Promise.all(
    uploads.map(async ({ path, data }) => {
      const gcsFile = bucket.file(path);
      await gcsFile.save(data, {
        metadata: {
          contentType: 'image/webp',
          cacheControl: 'public, max-age=31536000, immutable',
        },
        resumable: false,
      });
    }),
  );

  return {
    thumbnailUrl: `${config.cdn.baseUrl}/${basePath}/thumbnail.webp`,
    thumbnailSmUrl: `${config.cdn.baseUrl}/${basePath}/thumbnail_sm.webp`,
  };
}

// ---------------------------------------------------------------------------
// Screenshot uploads
// ---------------------------------------------------------------------------

export interface ScreenshotFiles {
  intro?: Buffer;
  playing?: Buffer;
  paused?: Buffer;
  gameover?: Buffer;
}

/**
 * Upload runtime-validation screenshots to GCS.
 * Returns a map of screenshot name → public CDN URL.
 */
export async function uploadScreenshots(
  gameId: string,
  version: number,
  screenshots: ScreenshotFiles,
): Promise<Record<string, string>> {
  const basePath = `games/${gameId}/v${version}/screenshots`;
  const bucket = getBucket();
  const urls: Record<string, string> = {};

  const entries = Object.entries(screenshots).filter(
    (entry): entry is [string, Buffer] => entry[1] != null,
  );

  await Promise.all(
    entries.map(async ([name, buffer]) => {
      const gcsPath = `${basePath}/${name}.png`;
      const gcsFile = bucket.file(gcsPath);

      await gcsFile.save(buffer, {
        metadata: {
          contentType: 'image/png',
          cacheControl: 'public, max-age=31536000, immutable',
        },
        resumable: false,
      });

      urls[name] = `${config.cdn.baseUrl}/${gcsPath}`;
    }),
  );

  return urls;
}
