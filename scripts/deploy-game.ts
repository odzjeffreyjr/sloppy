/**
 * Deploy a game directly to the production database and GCS bucket.
 *
 * Fully self-contained — handles everything:
 *   1. Enables Cloud SQL public IP
 *   2. Starts Cloud SQL Auth Proxy
 *   3. Creates DB records
 *   4. Uploads game bundle to GCS
 *   5. Generates thumbnail via fal.ai FLUX (if thumbnail-prompt.txt exists)
 *   6. Uploads thumbnails to GCS + updates DB
 *   7. Tears down proxy + disables public IP
 *
 * Prerequisites (installed, not running):
 *   - gcloud CLI (authenticated)
 *   - cloud-sql-proxy (brew install cloud-sql-proxy)
 *   - Service account key at secrets/terraform-sa.json
 *   - sips (macOS) for thumbnail resizing, or ImageMagick convert
 *
 * Usage:
 *   pnpm tsx scripts/deploy-game.ts \
 *     --dir scripts/games/neon-drift \
 *     --creator-name sloppy \
 *     --publish
 *
 * Environment overrides (all optional — defaults read from .env.production):
 *   DATABASE_URL, GCS_BUCKET, CDN_BASE_URL, FAL_KEY, DB_PASSWORD
 */

import postgres from 'postgres';
import { Storage } from '@google-cloud/storage';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as https from 'node:https';
import * as http from 'node:http';
import { nanoid } from 'nanoid';
import { parseArgs } from 'node:util';
import { spawn, execSync, type ChildProcess } from 'node:child_process';

// ── Config ──────────────────────────────────────────────────────────────────

const PROJECT_ID = 'sloppy-app';
const INSTANCE_CONNECTION = 'sloppy-app:us-east1:sloppy-pg-prod';
const PROXY_PORT = 5433;
const SA_KEY_PATH = path.resolve('secrets/terraform-sa.json');
const FAL_FLUX_URL = 'https://fal.run/fal-ai/flux/schnell';

const { values: args } = parseArgs({
  options: {
    dir: { type: 'string' },
    'creator-name': { type: 'string', default: 'sloppy' },
    publish: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'skip-thumbnail': { type: 'boolean', default: false },
  },
});

const GAME_DIR = args.dir;
const CREATOR_NAME = args['creator-name'] ?? 'sloppy';
const PUBLISH = args.publish ?? false;
const DRY_RUN = args['dry-run'] ?? false;
const SKIP_THUMBNAIL = args['skip-thumbnail'] ?? false;

if (!GAME_DIR) {
  console.error(
    'Usage: pnpm tsx scripts/deploy-game.ts --dir <game-directory> [--creator-name sloppy] [--publish] [--skip-thumbnail] [--dry-run]',
  );
  process.exit(1);
}

function loadEnvProduction(): Record<string, string> {
  const envPath = path.resolve('.env.production');
  if (!fs.existsSync(envPath)) return {};
  const vars: Record<string, string> = {};
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    vars[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return vars;
}

const prodEnv = loadEnvProduction();
const DB_PASSWORD = process.env.DB_PASSWORD || prodEnv.DB_PASSWORD;
const DB_URL =
  process.env.DATABASE_URL ||
  `postgresql://sloppy:${DB_PASSWORD}@127.0.0.1:${PROXY_PORT}/sloppy`;
const GCS_BUCKET = process.env.GCS_BUCKET || prodEnv.GCS_BUCKET || 'sloppy-game-bundles-prod';
const CDN_BASE_URL =
  process.env.CDN_BASE_URL || `https://storage.googleapis.com/${GCS_BUCKET}`;
const FAL_KEY = process.env.FAL_KEY || prodEnv.FAL_KEY || '';

if (!DB_PASSWORD && !process.env.DATABASE_URL) {
  console.error(
    'DB_PASSWORD not found in environment or .env.production, and no DATABASE_URL override set.',
  );
  process.exit(1);
}

// ── Infrastructure helpers ──────────────────────────────────────────────────

function runGcloud(gcloudArgs: string[]): string {
  const cmd = `gcloud ${gcloudArgs.join(' ')}`;
  console.log(`  $ ${cmd}`);
  return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function enablePublicIp(): void {
  console.log(`▶ Enabling public IP on Cloud SQL instance...`);
  runGcloud([
    'sql', 'instances', 'patch', 'sloppy-pg-prod',
    `--project=${PROJECT_ID}`, '--assign-ip', '--quiet',
  ]);
  console.log(`  ✔ Public IP enabled`);
}

function disablePublicIp(): void {
  console.log(`▶ Disabling public IP on Cloud SQL instance...`);
  try {
    runGcloud([
      'sql', 'instances', 'patch', 'sloppy-pg-prod',
      `--project=${PROJECT_ID}`, '--no-assign-ip', '--quiet',
    ]);
    console.log(`  ✔ Public IP disabled`);
  } catch (err) {
    console.warn(`  ⚠ Failed to disable public IP (non-fatal):`, (err as Error).message);
  }
}

function startProxy(): ChildProcess {
  console.log(`▶ Starting Cloud SQL Auth Proxy on port ${PROXY_PORT}...`);

  if (!fs.existsSync(SA_KEY_PATH)) {
    console.error(`  ✗ Service account key not found at ${SA_KEY_PATH}`);
    process.exit(1);
  }

  const proxy = spawn('cloud-sql-proxy', [INSTANCE_CONNECTION, `--port=${PROXY_PORT}`], {
    env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: SA_KEY_PATH },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  proxy.stderr?.on('data', (d: Buffer) => {
    const msg = d.toString();
    if (msg.includes('Error') || msg.includes('error')) {
      console.error(`  [proxy] ${msg.trim()}`);
    }
  });

  return proxy;
}

async function waitForProxy(timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const test = postgres(DB_URL, { max: 1, connect_timeout: 2 });
      await test`SELECT 1`;
      await test.end();
      console.log(`  ✔ Proxy ready (${Date.now() - start}ms)`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Cloud SQL proxy did not become ready within ${timeoutMs}ms`);
}

function killProxy(proxy: ChildProcess): void {
  if (proxy && !proxy.killed) {
    proxy.kill('SIGTERM');
    console.log(`  ✔ Proxy stopped`);
  }
}

// ── Thumbnail helpers ───────────────────────────────────────────────────────

function httpRequest(url: string, options: https.RequestOptions, body?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString()));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, dest).then(resolve, reject);
        return;
      }
      const ws = fs.createWriteStream(dest);
      res.pipe(ws);
      ws.on('finish', () => { ws.close(); resolve(); });
    });
    req.on('error', reject);
  });
}

async function generateThumbnail(promptPath: string, gameDir: string): Promise<{
  thumbnailPath: string;
  thumbnailSmPath: string;
} | null> {
  if (!FAL_KEY) {
    console.warn(`  ⚠ FAL_KEY not set — skipping thumbnail generation`);
    return null;
  }

  const prompt = fs.readFileSync(promptPath, 'utf-8').trim();
  if (!prompt) {
    console.warn(`  ⚠ thumbnail-prompt.txt is empty — skipping`);
    return null;
  }

  console.log(`  Calling fal.ai FLUX...`);
  const reqBody = JSON.stringify({
    prompt,
    image_size: { width: 1280, height: 720 },
    num_images: 1,
  });

  const response = await httpRequest(FAL_FLUX_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(reqBody).toString(),
    },
  }, reqBody);

  const result = JSON.parse(response);
  if (!result.images || !result.images[0]?.url) {
    console.warn(`  ⚠ fal.ai returned no image — skipping thumbnail`);
    console.warn(`  Response: ${response.slice(0, 200)}`);
    return null;
  }

  const imageUrl = result.images[0].url;
  const thumbnailPath = path.join(gameDir, 'thumbnail.jpg');
  const thumbnailSmPath = path.join(gameDir, 'thumbnail_sm.jpg');

  console.log(`  Downloading full-size thumbnail...`);
  await downloadFile(imageUrl, thumbnailPath);

  console.log(`  Creating small thumbnail (600px wide)...`);
  fs.copyFileSync(thumbnailPath, thumbnailSmPath);
  try {
    execSync(`sips --resampleWidth 600 "${thumbnailSmPath}"`, { stdio: 'pipe' });
  } catch {
    try {
      execSync(`convert "${thumbnailSmPath}" -resize 600x "${thumbnailSmPath}"`, { stdio: 'pipe' });
    } catch {
      console.warn(`  ⚠ Could not resize thumbnail (no sips or convert) — using full-size as small`);
    }
  }

  const fullSize = fs.statSync(thumbnailPath).size;
  const smSize = fs.statSync(thumbnailSmPath).size;
  console.log(`  ✔ Thumbnails generated (${Math.round(fullSize / 1024)}KB + ${Math.round(smSize / 1024)}KB)`);

  return { thumbnailPath, thumbnailSmPath };
}

// ── Deploy helpers ──────────────────────────────────────────────────────────

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`.slice(0, 80);
}

function inferContentType(filePath: string): string {
  if (filePath.endsWith('.html')) return 'text/html';
  if (filePath.endsWith('.js')) return 'application/javascript';
  if (filePath.endsWith('.json')) return 'application/json';
  if (filePath.endsWith('.css')) return 'text/css';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const absDir = path.resolve(GAME_DIR);
  console.log(`\n=== Sloppy Game Deployer ===\n`);
  console.log(`  Game dir:     ${absDir}`);
  console.log(`  Creator:      ${CREATOR_NAME}`);
  console.log(`  Publish:      ${PUBLISH}`);
  console.log(`  GCS bucket:   ${GCS_BUCKET}`);
  console.log(`  Thumbnails:   ${SKIP_THUMBNAIL ? 'skip' : 'auto'}`);
  console.log(`  Dry run:      ${DRY_RUN}`);
  console.log();

  // Validate game files
  const configPath = path.join(absDir, 'config.json');
  const htmlPath = path.join(absDir, 'index.html');

  if (!fs.existsSync(configPath)) {
    console.error('Missing config.json in game directory');
    process.exit(1);
  }
  if (!fs.existsSync(htmlPath)) {
    console.error('Missing index.html in game directory');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const html = fs.readFileSync(htmlPath, 'utf-8');

  // Extract inline JS for game.js
  const scripts: string[] = [];
  const re = /<script(?:\s[^>]*)?>([^]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const tag = match[0];
    if (tag.includes(' src=')) continue;
    scripts.push(match[1]);
  }
  const gameJs = scripts.join('\n');

  if (!gameJs.trim()) {
    console.error('No inline <script> found in index.html');
    process.exit(1);
  }

  const title = config.title || 'Untitled Game';
  const description = config.description || `A ${config.genre || 'fun'} game`;

  console.log(`  Title:        ${title}`);
  console.log(`  Engine:       ${config.engine || 'canvas2d'}`);
  console.log(`  Genre:        ${config.genre || 'unknown'}`);
  console.log();

  if (DRY_RUN) {
    console.log('DRY RUN — no changes made.\n');
    process.exit(0);
  }

  // ── Step 0: Generate thumbnail if prompt exists and no thumbnail yet ──
  const promptPath = path.join(absDir, 'thumbnail-prompt.txt');
  const existingThumb = path.join(absDir, 'thumbnail.jpg');
  let thumbnailGenerated = false;

  if (!SKIP_THUMBNAIL && fs.existsSync(promptPath) && !fs.existsSync(existingThumb)) {
    console.log(`▶ Generating thumbnail from prompt...`);
    const result = await generateThumbnail(promptPath, absDir);
    if (result) thumbnailGenerated = true;
  } else if (fs.existsSync(existingThumb)) {
    console.log(`  ℹ Thumbnail already exists — will upload`);
    // Ensure small version exists
    const smPath = path.join(absDir, 'thumbnail_sm.jpg');
    if (!fs.existsSync(smPath)) {
      fs.copyFileSync(existingThumb, smPath);
      try { execSync(`sips --resampleWidth 600 "${smPath}"`, { stdio: 'pipe' }); } catch {}
    }
  }

  // ── Infrastructure setup ──
  enablePublicIp();
  const proxy = startProxy();

  try {
    await waitForProxy();

    const sql = postgres(DB_URL, { max: 1 });

    try {
      // Step 1: Ensure creator user exists
      console.log(`▶ Ensuring user "${CREATOR_NAME}" exists...`);

      const firebaseUid = `system_${CREATOR_NAME}`;
      const email = `${CREATOR_NAME}@sloppygames.io`;

      let userId: string;
      const existingUser = await sql`
        SELECT id FROM users WHERE firebase_uid = ${firebaseUid}
      `;

      if (existingUser.length > 0) {
        userId = existingUser[0].id as string;
        console.log(`  ✔ User exists: ${userId}`);
      } else {
        userId = nanoid();
        await sql`
          INSERT INTO users (id, firebase_uid, email, display_name)
          VALUES (${userId}, ${firebaseUid}, ${email}, ${CREATOR_NAME})
        `;
        console.log(`  ✔ User created: ${userId}`);
      }

      // Step 2: Find existing game or create new one
      console.log(`▶ Looking up existing game "${title}"...`);

      const status = PUBLISH ? 'published' : 'draft';
      const existingGame = await sql`
        SELECT id, slug, version, storage_path FROM games WHERE title = ${title} LIMIT 1
      `;

      let gameId: string;
      let slug: string;
      let newVersion: number;
      let oldStoragePath: string | null = null;

      if (existingGame.length > 0) {
        gameId = existingGame[0].id as string;
        slug = existingGame[0].slug as string;
        const oldVersion = (existingGame[0].version as number) || 1;
        newVersion = oldVersion + 1;
        oldStoragePath = existingGame[0].storage_path as string | null;

        console.log(`  ✔ Found existing game: ${slug} (v${oldVersion} → v${newVersion})`);

        await sql`
          UPDATE games SET
            description = ${description},
            genre = ${config.genre || null},
            engine = ${config.engine || 'canvas2d'},
            supports_multiplayer = ${config.supportsMultiplayer || false},
            version = ${newVersion},
            status = ${status},
            updated_at = NOW()
          WHERE id = ${gameId}
        `;
        console.log(`  ✔ Game record updated (status: ${status})`);
      } else {
        gameId = nanoid();
        slug = generateSlug(title);
        newVersion = 1;

        console.log(`  ℹ No existing game found — creating new record`);
        console.log(`  Slug:  ${slug}`);
        console.log(`  ID:    ${gameId}`);

        await sql`
          INSERT INTO games (
            id, creator_id, title, description, slug,
            genre, engine, supports_multiplayer, version, status,
            play_count, favourite_count
          ) VALUES (
            ${gameId}, ${userId}, ${title}, ${description}, ${slug},
            ${config.genre || null}, ${config.engine || 'canvas2d'},
            ${config.supportsMultiplayer || false}, 1, ${status},
            0, 0
          )
        `;
        console.log(`  ✔ Game record created (status: ${status})`);
      }

      // Step 3: Upload files to GCS
      console.log(`▶ Uploading game files to GCS...`);

      const storage = new Storage({
        keyFilename: SA_KEY_PATH,
      });
      const bucket = storage.bucket(GCS_BUCKET);
      const basePath = `games/${gameId}/v${newVersion}`;

      // Delete old version files from GCS if upgrading
      if (oldStoragePath && oldStoragePath !== basePath) {
        console.log(`  Cleaning up old version: ${oldStoragePath}`);
        try {
          const [oldFiles] = await bucket.getFiles({ prefix: oldStoragePath });
          for (const f of oldFiles) {
            await f.delete();
          }
          console.log(`  ✔ Deleted ${oldFiles.length} old files`);
        } catch (err) {
          console.warn(`  ⚠ Failed to clean old files (non-fatal):`, (err as Error).message);
        }
      }

      const filesToUpload: Array<{ gcsPath: string; content: Buffer | string; contentType: string }> = [
        { gcsPath: `${basePath}/index.html`, content: html, contentType: 'text/html' },
        { gcsPath: `${basePath}/config.json`, content: JSON.stringify(config), contentType: 'application/json' },
        { gcsPath: `${basePath}/game.js`, content: gameJs, contentType: 'application/javascript' },
      ];

      // Upload any additional files (assets, etc.) — but not thumbnails yet
      const skipFiles = new Set(['index.html', 'config.json', 'thumbnail.jpg', 'thumbnail_sm.jpg']);
      const entries = fs.readdirSync(absDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && !skipFiles.has(entry.name)) {
          const fullPath = path.join(absDir, entry.name);
          const ct = inferContentType(entry.name);
          const isBinary = ct.startsWith('image/');
          const content = isBinary
            ? fs.readFileSync(fullPath)
            : fs.readFileSync(fullPath, 'utf-8');
          filesToUpload.push({ gcsPath: `${basePath}/${entry.name}`, content, contentType: ct });
        }
      }

      for (const file of filesToUpload) {
        const gcsFile = bucket.file(file.gcsPath);
        await gcsFile.save(Buffer.from(file.content), {
          metadata: {
            contentType: file.contentType,
            cacheControl: 'public, max-age=31536000, immutable',
          },
          resumable: false,
        });
        console.log(`  ✔ Uploaded: ${file.gcsPath}`);
      }

      // Step 4: Upload thumbnails to GCS if they exist
      const thumbPath = path.join(absDir, 'thumbnail.jpg');
      const thumbSmPath = path.join(absDir, 'thumbnail_sm.jpg');
      let thumbnailUrl: string | null = null;
      let thumbnailSmUrl: string | null = null;

      if (fs.existsSync(thumbPath)) {
        console.log(`▶ Uploading thumbnails to GCS...`);

        for (const { localPath, gcsName } of [
          { localPath: thumbPath, gcsName: 'thumbnail.jpg' },
          { localPath: thumbSmPath, gcsName: 'thumbnail_sm.jpg' },
        ]) {
          if (!fs.existsSync(localPath)) continue;
          const gcsFile = bucket.file(`${basePath}/${gcsName}`);
          await gcsFile.save(fs.readFileSync(localPath), {
            metadata: {
              contentType: 'image/jpeg',
              cacheControl: 'public, max-age=31536000, immutable',
            },
            resumable: false,
          });
          console.log(`  ✔ Uploaded: ${basePath}/${gcsName}`);
        }

        thumbnailUrl = `${CDN_BASE_URL}/${basePath}/thumbnail.jpg`;
        thumbnailSmUrl = fs.existsSync(thumbSmPath)
          ? `${CDN_BASE_URL}/${basePath}/thumbnail_sm.jpg`
          : thumbnailUrl;
      }

      // Step 5: Update game record with storage path + thumbnail URLs
      console.log(`▶ Updating game record...`);

      if (thumbnailUrl) {
        await sql`
          UPDATE games SET
            storage_path = ${basePath},
            thumbnail_url = ${thumbnailUrl},
            thumbnail_sm_url = ${thumbnailSmUrl},
            updated_at = NOW()
          WHERE id = ${gameId}
        `;
        console.log(`  ✔ Storage path + thumbnail URLs set`);
      } else {
        await sql`
          UPDATE games SET
            storage_path = ${basePath},
            updated_at = NOW()
          WHERE id = ${gameId}
        `;
        console.log(`  ✔ Storage path set: ${basePath}`);
      }

      // Print summary
      console.log(`\n=== Deployment Complete ===\n`);
      console.log(`  Game ID:      ${gameId}`);
      console.log(`  Slug:         ${slug}`);
      console.log(`  Version:      v${newVersion}${oldStoragePath ? ' (updated)' : ' (new)'}`);
      console.log(`  Status:       ${status}`);
      console.log(`  Bundle URL:   ${CDN_BASE_URL}/${basePath}/index.html`);
      if (thumbnailUrl) {
        console.log(`  Thumbnail:    ${thumbnailUrl}`);
      }
      console.log(`  Game page:    https://sloppygames.io/game/${slug}`);
      console.log();
    } finally {
      await sql.end();
    }
  } finally {
    // ── Infrastructure teardown (always runs) ──
    console.log(`\n▶ Tearing down infrastructure...`);
    killProxy(proxy);
    disablePublicIp();
  }
}

main().catch(async (err) => {
  console.error('Deployment failed:', err);
  process.exit(1);
});
