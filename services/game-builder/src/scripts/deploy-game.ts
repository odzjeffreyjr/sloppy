/**
 * Deploy a game directly to production database and GCS.
 *
 * Prerequisites:
 *   1. Cloud SQL Auth Proxy running on port 5433:
 *      cloud-sql-proxy sloppy-app:us-east1:sloppy-pg-prod --port 5433
 *   2. gcloud auth configured (Application Default Credentials)
 *
 * Usage (from repo root):
 *   DATABASE_URL=postgresql://sloppy:<password>@localhost:5433/sloppy \
 *   GCS_BUCKET=sloppy-game-bundles-prod \
 *   npx tsx services/game-builder/src/scripts/deploy-game.ts \
 *     --dir scripts/games/neon-drift \
 *     --creator sloppy \
 *     --publish
 */

import { createMigrationClient } from '@sloppy/db';
import { Storage } from '@google-cloud/storage';
import * as fs from 'node:fs';
import * as path from 'node:path';

const args = process.argv.slice(2);

function getArg(name: string, fallback?: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return fallback;
}

const GAME_DIR = getArg('dir');
const CREATOR_NAME = getArg('creator', 'sloppy')!;
const PUBLISH = args.includes('--publish');
const DRY_RUN = args.includes('--dry-run');

if (!GAME_DIR) {
  console.error('Usage: npx tsx deploy-game.ts --dir <game-dir> [--creator sloppy] [--publish] [--dry-run]');
  process.exit(1);
}

const GCS_BUCKET = process.env.GCS_BUCKET || 'sloppy-game-bundles-prod';
const CDN_BASE_URL = `https://storage.googleapis.com/${GCS_BUCKET}`;

function generateId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let id = '';
  const bytes = new Uint8Array(21);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 21; i++) id += chars[bytes[i] & 63];
  return id;
}

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

async function main() {
  const absDir = path.resolve(GAME_DIR!);

  const configPath = path.join(absDir, 'config.json');
  const htmlPath = path.join(absDir, 'index.html');

  if (!fs.existsSync(configPath)) {
    console.error(`Missing config.json in ${absDir}`);
    process.exit(1);
  }
  if (!fs.existsSync(htmlPath)) {
    console.error(`Missing index.html in ${absDir}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const html = fs.readFileSync(htmlPath, 'utf-8');

  const scripts: string[] = [];
  const re = /<script(?:\s[^>]*)?>([^]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    if (match[0].includes(' src=')) continue;
    scripts.push(match[1]);
  }
  const gameJs = scripts.join('\n');

  if (!gameJs.trim()) {
    console.error('No inline <script> found in index.html');
    process.exit(1);
  }

  const title = config.title || 'Untitled Game';
  const description = config.description || `Dodge neon obstacles in this fast-paced arcade game. Survive as long as you can!`;
  const gameId = generateId();
  const slug = generateSlug(title);
  const status = PUBLISH ? 'published' : 'draft';

  console.log(`\n=== Sloppy Game Deployer ===\n`);
  console.log(`  Title:      ${title}`);
  console.log(`  Game ID:    ${gameId}`);
  console.log(`  Slug:       ${slug}`);
  console.log(`  Engine:     ${config.engine || 'canvas2d'}`);
  console.log(`  Genre:      ${config.genre || '-'}`);
  console.log(`  Status:     ${status}`);
  console.log(`  Creator:    ${CREATOR_NAME}`);
  console.log(`  GCS:        ${GCS_BUCKET}`);
  console.log(`  Dry run:    ${DRY_RUN}`);
  console.log();

  if (DRY_RUN) {
    console.log('DRY RUN — no changes made.\n');
    process.exit(0);
  }

  const sql = createMigrationClient();

  try {
    // Step 1: Ensure creator user exists
    console.log(`▶ Ensuring user "${CREATOR_NAME}" exists...`);

    const firebaseUid = `system_${CREATOR_NAME}`;
    const email = `${CREATOR_NAME}@sloppygames.io`;

    const existingUser = await sql`
      SELECT id FROM users WHERE firebase_uid = ${firebaseUid} LIMIT 1
    `;

    let userId: string;
    if (existingUser.length > 0) {
      userId = existingUser[0].id as string;
      console.log(`  ✔ User exists: ${userId}`);
    } else {
      userId = generateId();
      await sql`
        INSERT INTO users (id, firebase_uid, email, display_name)
        VALUES (${userId}, ${firebaseUid}, ${email}, ${CREATOR_NAME})
      `;
      console.log(`  ✔ User created: ${userId}`);
    }

    // Step 2: Create game record
    console.log(`▶ Creating game record...`);

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
    console.log(`  ✔ Game record created`);

    // Step 3: Upload files to GCS
    console.log(`▶ Uploading files to GCS...`);

    const storage = new Storage();
    const bucket = storage.bucket(GCS_BUCKET);
    const basePath = `games/${gameId}/v1`;

    const filesToUpload = [
      { gcsPath: `${basePath}/index.html`, content: html, contentType: 'text/html' },
      { gcsPath: `${basePath}/config.json`, content: JSON.stringify(config), contentType: 'application/json' },
      { gcsPath: `${basePath}/game.js`, content: gameJs, contentType: 'application/javascript' },
    ];

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

    // Step 4: Update game with storage path
    console.log(`▶ Updating game with storage path...`);

    await sql`
      UPDATE games SET
        storage_path = ${basePath},
        updated_at = NOW()
      WHERE id = ${gameId}
    `;
    console.log(`  ✔ Storage path set`);

    // Summary
    console.log(`\n=== Deployment Complete ===\n`);
    console.log(`  Game ID:      ${gameId}`);
    console.log(`  Slug:         ${slug}`);
    console.log(`  Status:       ${status}`);
    console.log(`  Bundle URL:   ${CDN_BASE_URL}/${basePath}/index.html`);
    console.log(`  Game page:    https://sloppygames.io/game/${slug}`);
    console.log();

  } finally {
    await sql.end();
  }
}

main().catch(async (err) => {
  console.error('Deployment failed:', err);
  process.exit(1);
});
