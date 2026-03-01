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
