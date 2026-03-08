/**
 * Redeploy ALL games in scripts/games/ to production.
 *
 * Sets up infrastructure once (Cloud SQL proxy, public IP), then iterates
 * through every game directory, bumps its version, re-uploads the bundle
 * to GCS, and updates the DB record. Tears down infrastructure when done.
 *
 * Usage:
 *   pnpm tsx scripts/redeploy-all-games.ts [--publish] [--dry-run] [--skip-thumbnail] [--dev]
 *
 * Flags:
 *   --publish          Set status to "published" (default: keeps existing status)
 *   --dry-run          Print what would be deployed without making changes
 *   --skip-thumbnail   Skip thumbnail generation even if thumbnail-prompt.txt exists
 *   --dev              Upload to dev bucket only (no DB changes, no proxy needed)
 *
 * Prerequisites:
 *   - gcloud CLI (authenticated)
 *   - cloud-sql-proxy (brew install cloud-sql-proxy)
 *   - Service account key at secrets/terraform-sa.json
 */

import postgres from 'postgres';
import { Storage } from '@google-cloud/storage';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { nanoid } from 'nanoid';
import { parseArgs } from 'node:util';
import { spawn, execSync, type ChildProcess } from 'node:child_process';

const PROJECT_ID = 'sloppy-app';
const INSTANCE_CONNECTION = 'sloppy-app:us-east1:sloppy-pg-prod';
const PROXY_PORT = 5433;
const SA_KEY_PATH = path.resolve('secrets/terraform-sa.json');

const { values: args } = parseArgs({
  options: {
    publish: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'skip-thumbnail': { type: 'boolean', default: false },
    dev: { type: 'boolean', default: false },
  },
});

const PUBLISH = args.publish ?? false;
const DRY_RUN = args['dry-run'] ?? false;
const DEV_MODE = args.dev ?? false;

function loadEnvFile(filename: string): Record<string, string> {
  const envPath = path.resolve(filename);
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

const prodEnv = loadEnvFile('.env.production');
const devEnv = loadEnvFile('.env');

const DB_PASSWORD = process.env.DB_PASSWORD || prodEnv.DB_PASSWORD;
const DB_URL =
  process.env.DATABASE_URL ||
  `postgresql://sloppy:${DB_PASSWORD}@127.0.0.1:${PROXY_PORT}/sloppy`;
const GCS_BUCKET = DEV_MODE
  ? (process.env.GCS_BUCKET || devEnv.GCS_BUCKET || 'sloppy-game-bundles-dev')
  : (process.env.GCS_BUCKET || prodEnv.GCS_BUCKET || 'sloppy-game-bundles-prod');

// ── Infrastructure ──────────────────────────────────────────────────────────

function runGcloud(gcloudArgs: string[]): string {
  const cmd = `gcloud ${gcloudArgs.join(' ')}`;
  return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function enablePublicIp(): void {
  console.log('▶ Enabling public IP on Cloud SQL instance...');
  runGcloud([
    'sql', 'instances', 'patch', 'sloppy-pg-prod',
    `--project=${PROJECT_ID}`, '--assign-ip', '--quiet',
  ]);
  console.log('  ✔ Public IP enabled');
}

function disablePublicIp(): void {
  console.log('▶ Disabling public IP on Cloud SQL instance...');
  try {
    runGcloud([
      'sql', 'instances', 'patch', 'sloppy-pg-prod',
      `--project=${PROJECT_ID}`, '--no-assign-ip', '--quiet',
    ]);
    console.log('  ✔ Public IP disabled');
  } catch (err) {
    console.warn('  ⚠ Failed to disable public IP (non-fatal):', (err as Error).message);
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
    console.log('  ✔ Proxy stopped');
  }
}

// ── Deploy helpers ──────────────────────────────────────────────────────────

function extractInlineJs(html: string): string {
  const scripts: string[] = [];
  const re = /<script(?:\s[^>]*)?>([^]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const tag = match[0];
    if (tag.includes(' src=')) continue;
    scripts.push(match[1]);
  }
  return scripts.join('\n');
}

interface DeployResult {
  name: string;
  status: 'success' | 'skipped' | 'failed';
  message: string;
}

async function deployGameDev(
  storage: Storage,
  gameDirName: string,
  gamesDir: string,
): Promise<DeployResult> {
  const gameDir = path.join(gamesDir, gameDirName);
  const htmlPath = path.join(gameDir, 'index.html');

  if (!fs.existsSync(htmlPath)) {
    return { name: gameDirName, status: 'skipped', message: 'no index.html' };
  }

  const bucket = storage.bucket(GCS_BUCKET);
  const gcsBase = `games/dev-${gameDirName}/v1`;

  const html = fs.readFileSync(htmlPath, 'utf-8');
  await bucket.file(`${gcsBase}/index.html`).save(Buffer.from(html), {
    metadata: { contentType: 'text/html', cacheControl: 'no-cache' },
    resumable: false,
  });

  const configPath = path.join(gameDir, 'config.json');
  if (fs.existsSync(configPath)) {
    await bucket.file(`${gcsBase}/config.json`).save(fs.readFileSync(configPath), {
      metadata: { contentType: 'application/json', cacheControl: 'no-cache' },
      resumable: false,
    });
  }

  return { name: gameDirName, status: 'success', message: `→ gs://${GCS_BUCKET}/${gcsBase}` };
}

async function deployGameProd(
  sql: postgres.Sql,
  storage: Storage,
  gameDirName: string,
  gamesDir: string,
): Promise<DeployResult> {
  const gameDir = path.join(gamesDir, gameDirName);
  const htmlPath = path.join(gameDir, 'index.html');
  const configPath = path.join(gameDir, 'config.json');

  if (!fs.existsSync(htmlPath) || !fs.existsSync(configPath)) {
    return { name: gameDirName, status: 'skipped', message: 'missing index.html or config.json' };
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const gameJs = extractInlineJs(html);
  const title = config.title || 'Untitled Game';

  const existingGame = await sql`
    SELECT id, slug, version, storage_path, status FROM games WHERE title = ${title} LIMIT 1
  `;

  if (existingGame.length === 0) {
    return { name: gameDirName, status: 'skipped', message: `no DB record for "${title}" — use deploy-game.ts for first deploy` };
  }

  const game = existingGame[0];
  const gameId = game.id as string;
  const slug = game.slug as string;
  const oldVersion = (game.version as number) || 1;
  const newVersion = oldVersion + 1;
  const oldStoragePath = game.storage_path as string | null;
  const existingStatus = game.status as string;
  const status = PUBLISH ? 'published' : existingStatus;

  const bucket = storage.bucket(GCS_BUCKET);
  const basePath = `games/${gameId}/v${newVersion}`;

  if (oldStoragePath && oldStoragePath !== basePath) {
    try {
      const [oldFiles] = await bucket.getFiles({ prefix: oldStoragePath });
      for (const f of oldFiles) await f.delete();
    } catch {}
  }

  const filesToUpload: Array<{ gcsPath: string; content: Buffer | string; contentType: string }> = [
    { gcsPath: `${basePath}/index.html`, content: html, contentType: 'text/html' },
    { gcsPath: `${basePath}/config.json`, content: JSON.stringify(config), contentType: 'application/json' },
    { gcsPath: `${basePath}/game.js`, content: gameJs, contentType: 'application/javascript' },
  ];

  const thumbPath = path.join(gameDir, 'thumbnail.jpg');
  const thumbSmPath = path.join(gameDir, 'thumbnail_sm.jpg');
  if (fs.existsSync(thumbPath)) {
    filesToUpload.push({ gcsPath: `${basePath}/thumbnail.jpg`, content: fs.readFileSync(thumbPath), contentType: 'image/jpeg' });
  }
  if (fs.existsSync(thumbSmPath)) {
    filesToUpload.push({ gcsPath: `${basePath}/thumbnail_sm.jpg`, content: fs.readFileSync(thumbSmPath), contentType: 'image/jpeg' });
  }

  for (const file of filesToUpload) {
    await bucket.file(file.gcsPath).save(Buffer.from(file.content), {
      metadata: { contentType: file.contentType, cacheControl: 'public, max-age=31536000, immutable' },
      resumable: false,
    });
  }

  const thumbUrl = fs.existsSync(thumbPath)
    ? `https://storage.googleapis.com/${GCS_BUCKET}/${basePath}/thumbnail.jpg`
    : null;
  const thumbSmUrl = fs.existsSync(thumbSmPath)
    ? `https://storage.googleapis.com/${GCS_BUCKET}/${basePath}/thumbnail_sm.jpg`
    : thumbUrl;

  if (thumbUrl) {
    await sql`
      UPDATE games SET
        version = ${newVersion}, storage_path = ${basePath}, status = ${status},
        thumbnail_url = ${thumbUrl}, thumbnail_sm_url = ${thumbSmUrl}, updated_at = NOW()
      WHERE id = ${gameId}
    `;
  } else {
    await sql`
      UPDATE games SET
        version = ${newVersion}, storage_path = ${basePath}, status = ${status}, updated_at = NOW()
      WHERE id = ${gameId}
    `;
  }

  return {
    name: gameDirName,
    status: 'success',
    message: `${slug} v${oldVersion}→v${newVersion} → gs://${GCS_BUCKET}/${basePath}`,
  };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const gamesDir = path.resolve('scripts/games');
  const gameDirs = fs.readdirSync(gamesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  console.log('\n┌──────────────────────────────────────────┐');
  console.log('│    Sloppy — Batch Game Redeployer         │');
  console.log('└──────────────────────────────────────────┘\n');
  console.log(`  Mode:         ${DEV_MODE ? 'DEV' : 'PRODUCTION'}`);
  console.log(`  Games found:  ${gameDirs.length}`);
  console.log(`  GCS bucket:   ${GCS_BUCKET}`);
  console.log(`  Publish:      ${PUBLISH}`);
  console.log(`  Dry run:      ${DRY_RUN}\n`);

  if (DRY_RUN) {
    console.log('Games that would be deployed:');
    gameDirs.forEach((g) => console.log(`  • ${g}`));
    console.log('\nDRY RUN — no changes made.\n');
    process.exit(0);
  }

  const storage = new Storage({
    keyFilename: fs.existsSync(SA_KEY_PATH) ? SA_KEY_PATH : undefined,
  });

  if (DEV_MODE) {
    console.log('▶ Deploying all games to dev bucket...\n');
    const results: DeployResult[] = [];

    for (const gameDirName of gameDirs) {
      const result = await deployGameDev(storage, gameDirName, gamesDir);
      results.push(result);
      const icon = result.status === 'success' ? '✔' : result.status === 'skipped' ? '⊘' : '✖';
      console.log(`  ${icon}  ${result.name} — ${result.message}`);
    }

    printSummary(results);
    return;
  }

  // Production mode
  if (!DB_PASSWORD && !process.env.DATABASE_URL) {
    console.error('DB_PASSWORD not found in environment or .env.production');
    process.exit(1);
  }

  enablePublicIp();
  const proxy = startProxy();

  try {
    await waitForProxy();
    const sql = postgres(DB_URL, { max: 1 });

    try {
      console.log('\n▶ Deploying all games to production...\n');
      const results: DeployResult[] = [];

      for (const gameDirName of gameDirs) {
        try {
          const result = await deployGameProd(sql, storage, gameDirName, gamesDir);
          results.push(result);
          const icon = result.status === 'success' ? '✔' : result.status === 'skipped' ? '⊘' : '✖';
          console.log(`  ${icon}  ${result.name} — ${result.message}`);
        } catch (err) {
          const msg = (err as Error).message;
          results.push({ name: gameDirName, status: 'failed', message: msg });
          console.log(`  ✖  ${gameDirName} — FAILED: ${msg}`);
        }
      }

      printSummary(results);
    } finally {
      await sql.end();
    }
  } finally {
    console.log('\n▶ Tearing down infrastructure...');
    killProxy(proxy);
    disablePublicIp();
  }
}

function printSummary(results: DeployResult[]): void {
  const succeeded = results.filter((r) => r.status === 'success').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const failed = results.filter((r) => r.status === 'failed').length;

  console.log('\n┌──────────────────────────────────────────┐');
  console.log('│    Batch Redeploy Complete                │');
  console.log('└──────────────────────────────────────────┘\n');
  console.log(`  ✔ Succeeded:  ${succeeded}`);
  console.log(`  ⊘ Skipped:    ${skipped}`);
  console.log(`  ✖ Failed:     ${failed}`);
  console.log(`  Total:        ${results.length}\n`);

  if (failed > 0) {
    console.log('  Failed games:');
    results.filter((r) => r.status === 'failed').forEach((r) => {
      console.log(`    • ${r.name}: ${r.message}`);
    });
    console.log();
  }
}

main().catch((err) => {
  console.error('Batch deployment failed:', err);
  process.exit(1);
});
