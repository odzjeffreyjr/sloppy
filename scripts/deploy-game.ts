/**
 * Deploy a game directly to the production database and GCS bucket.
 *
 * Prerequisites:
 *   1. Cloud SQL Auth Proxy running:
 *      cloud-sql-proxy sloppy-app:us-east1:sloppy-pg-prod --port 5433
 *   2. gcloud auth configured (for GCS uploads)
 *
 * Usage:
 *   DATABASE_URL=postgresql://sloppy:<password>@localhost:5433/sloppy \
 *   GCS_BUCKET=sloppy-game-bundles-prod \
 *   npx tsx scripts/deploy-game.ts \
 *     --dir scripts/games/neon-drift \
 *     --creator-name sloppy \
 *     --publish
 */

import postgres from 'postgres';
import { Storage } from '@google-cloud/storage';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { nanoid } from 'nanoid';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    dir: { type: 'string' },
    'creator-name': { type: 'string', default: 'sloppy' },
    publish: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
});

const GAME_DIR = args.dir;
const CREATOR_NAME = args['creator-name'] ?? 'sloppy';
const PUBLISH = args.publish ?? false;
const DRY_RUN = args['dry-run'] ?? false;

if (!GAME_DIR) {
  console.error('Usage: npx tsx scripts/deploy-game.ts --dir <game-directory> [--creator-name sloppy] [--publish] [--dry-run]');
  process.exit(1);
}

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const GCS_BUCKET = process.env.GCS_BUCKET ?? 'sloppy-game-bundles-prod';
const CDN_BASE_URL = process.env.CDN_BASE_URL ?? `https://storage.googleapis.com/${GCS_BUCKET}`;

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
  return 'application/octet-stream';
}

async function main() {
  const absDir = path.resolve(GAME_DIR);
  console.log(`\n=== Sloppy Game Deployer ===\n`);
  console.log(`  Game dir:     ${absDir}`);
  console.log(`  Creator:      ${CREATOR_NAME}`);
  console.log(`  Publish:      ${PUBLISH}`);
  console.log(`  GCS bucket:   ${GCS_BUCKET}`);
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
  const slug = generateSlug(title);
  const gameId = nanoid();

  console.log(`  Title:        ${title}`);
  console.log(`  Slug:         ${slug}`);
  console.log(`  Game ID:      ${gameId}`);
  console.log(`  Engine:       ${config.engine || 'canvas2d'}`);
  console.log(`  Genre:        ${config.genre || 'unknown'}`);
  console.log();

  if (DRY_RUN) {
    console.log('DRY RUN — no changes made.\n');
    process.exit(0);
  }

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

    // Step 2: Create game record
    console.log(`▶ Creating game record...`);

    const status = PUBLISH ? 'published' : 'draft';
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

    // Step 3: Upload files to GCS
    console.log(`▶ Uploading files to GCS...`);

    const storage = new Storage();
    const bucket = storage.bucket(GCS_BUCKET);
    const basePath = `games/${gameId}/v1`;

    const filesToUpload: Array<{ gcsPath: string; content: string; contentType: string }> = [
      { gcsPath: `${basePath}/index.html`, content: html, contentType: 'text/html' },
      { gcsPath: `${basePath}/config.json`, content: JSON.stringify(config), contentType: 'application/json' },
      { gcsPath: `${basePath}/game.js`, content: gameJs, contentType: 'application/javascript' },
    ];

    // Upload any additional files (assets, etc.)
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && !['index.html', 'config.json'].includes(entry.name)) {
        const content = fs.readFileSync(path.join(absDir, entry.name), 'utf-8');
        filesToUpload.push({
          gcsPath: `${basePath}/${entry.name}`,
          content,
          contentType: inferContentType(entry.name),
        });
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

    // Step 4: Update game with storage path
    console.log(`▶ Updating game record with storage path...`);

    await sql`
      UPDATE games SET
        storage_path = ${basePath},
        updated_at = NOW()
      WHERE id = ${gameId}
    `;
    console.log(`  ✔ Storage path set: ${basePath}`);

    // Print summary
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
