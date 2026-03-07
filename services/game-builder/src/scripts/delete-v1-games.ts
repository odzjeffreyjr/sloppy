/**
 * One-time cleanup script to delete all v1 (canvas2d) games
 * from the database and GCS bucket.
 *
 * Usage: DATABASE_URL=... npx tsx src/scripts/delete-v1-games.ts [--dry-run]
 */

import { createMigrationClient } from '@sloppy/db';
import { Storage } from '@google-cloud/storage';
import { config } from '../config.js';

const DRY_RUN = process.argv.includes('--dry-run');
const sql = createMigrationClient();
const storage = new Storage();
const bucket = storage.bucket(config.gcs.bucket);

async function main() {
  console.log(`\n=== V1 Game Cleanup ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

  const v1Games = await sql`
    SELECT id, title, storage_path, engine, version, status
    FROM games
    WHERE engine = 'canvas2d' AND deleted_at IS NULL
  `;

  console.log(`Found ${v1Games.length} v1 (canvas2d) games to delete\n`);

  if (v1Games.length === 0) {
    console.log('Nothing to clean up.');
    await sql.end();
    process.exit(0);
  }

  for (const game of v1Games) {
    console.log(`  [${game.id}] "${game.title}" (engine=${game.engine}, v${game.version}, status=${game.status})`);
  }

  const gameIds = v1Games.map((g) => (g as Record<string, unknown>).id as string);

  console.log('\n--- Deleting related records ---');

  const childTables = [
    'feed_events',
    'favourites',
    'game_progress',
    'game_crash_logs',
    'sessions',
    'generation_logs',
    'creator_earnings',
    'ad_impressions',
  ];

  for (const table of childTables) {
    const col = table === 'favourites' || table === 'game_progress' ? 'game_id' : 'game_id';
    if (!DRY_RUN) {
      const result = await sql`
        DELETE FROM ${sql(table)} WHERE ${sql(col)} = ANY(${gameIds})
      `;
      console.log(`  ${table}: ${result.count} rows deleted`);
    } else {
      const result = await sql`
        SELECT count(*)::int AS count FROM ${sql(table)} WHERE ${sql(col)} = ANY(${gameIds})
      `;
      console.log(`  ${table}: ${result[0].count} rows would be deleted`);
    }
  }

  // Hard-delete game rows
  console.log(`\n--- Deleting ${v1Games.length} game rows ---`);
  if (!DRY_RUN) {
    const result = await sql`DELETE FROM games WHERE id = ANY(${gameIds})`;
    console.log(`  games: ${result.count} rows deleted`);
  } else {
    console.log(`  games: ${v1Games.length} rows would be deleted`);
  }

  // Delete GCS bundles
  console.log('\n--- Deleting GCS bundles ---');
  let gcsDeleted = 0;
  let gcsFailed = 0;

  for (const game of v1Games) {
    const prefix = game.storage_path
      ? `${game.storage_path}/`
      : `games/${game.id}/`;

    try {
      if (!DRY_RUN) {
        await bucket.deleteFiles({ prefix, force: true });
      }
      console.log(`  ${DRY_RUN ? 'Would delete' : 'Deleted'} GCS: ${prefix}`);
      gcsDeleted++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAILED GCS: ${prefix} — ${msg}`);
      gcsFailed++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Games: ${v1Games.length}`);
  console.log(`  GCS bundles: ${gcsDeleted} deleted, ${gcsFailed} failed`);
  if (DRY_RUN) {
    console.log('\n  (DRY RUN — no changes made. Remove --dry-run to execute.)\n');
  } else {
    console.log('\n  Cleanup complete.\n');
  }

  await sql.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Script failed:', err);
  await sql.end();
  process.exit(1);
});
