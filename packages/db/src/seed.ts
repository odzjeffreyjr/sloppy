import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateId, generateSlug } from '@sloppy/shared';
import { createDatabase } from './connection.js';
import {
  users,
  games,
  favourites,
  generationLogs,
  gameCrashLogs,
  sessions,
  gameProgress,
  creatorEarnings,
  creatorStripeAccounts,
  creatorSubscriptions,
  feedEvents,
  payoutHistory,
  adImpressions,
} from './schema.js';

const SAMPLE_USERS = [
  { email: 'alice@example.com', displayName: 'Alice', firebaseUid: 'fb_alice_001' },
  { email: 'bob@example.com', displayName: 'Bob', firebaseUid: 'fb_bob_002' },
  { email: 'charlie@example.com', displayName: 'Charlie', firebaseUid: 'fb_charlie_003' },
  { email: 'diana@example.com', displayName: 'Diana', firebaseUid: 'fb_diana_004' },
  { email: 'eve@example.com', displayName: 'Eve', firebaseUid: 'fb_eve_005' },
];

interface GameConfig {
  title: string;
  engine?: string;
  genre?: string;
  supportsMultiplayer?: boolean;
  description?: string;
  resolution?: { width?: number; height?: number; scaleMode?: string };
}

function discoverLocalGames(): Array<{ dir: string; slug: string; config: GameConfig }> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const gamesRoot = path.resolve(__dirname, '../../../scripts/games');
  if (!fs.existsSync(gamesRoot)) return [];

  return fs
    .readdirSync(gamesRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => fs.existsSync(path.join(gamesRoot, d.name, 'index.html')))
    .map((d) => {
      const configPath = path.join(gamesRoot, d.name, 'config.json');
      let config: GameConfig = { title: d.name };
      if (fs.existsSync(configPath)) {
        try {
          config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        } catch { /* use defaults */ }
      }
      return { dir: d.name, slug: d.name, config };
    });
}

async function main() {
  console.log('Seeding database...');
  const db = createDatabase();

  // Clear existing data (reverse FK order to avoid constraint violations)
  await db.delete(adImpressions);
  await db.delete(payoutHistory);
  await db.delete(feedEvents);
  await db.delete(creatorEarnings);
  await db.delete(creatorSubscriptions);
  await db.delete(creatorStripeAccounts);
  await db.delete(gameProgress);
  await db.delete(sessions);
  await db.delete(gameCrashLogs);
  await db.delete(generationLogs);
  await db.delete(favourites);
  await db.delete(games);
  await db.delete(users);
  console.log('Cleared existing data.');

  // Users
  const userIds: string[] = [];
  for (const u of SAMPLE_USERS) {
    const id = generateId();
    userIds.push(id);
    await db.insert(users).values({ id, ...u });
  }
  console.log(`Seeded ${userIds.length} users.`);

  // Discover real game HTML from scripts/games/
  const localGames = discoverLocalGames();
  console.log(`Found ${localGames.length} games in scripts/games/`);

  const gameIds: string[] = [];
  for (let i = 0; i < localGames.length; i++) {
    const { slug: dirSlug, config } = localGames[i];
    const id = generateId();
    gameIds.push(id);
    const creatorId = userIds[i % userIds.length];
    const storagePath = `games/dev-${dirSlug}/v1`;

    await db
      .insert(games)
      .values({
        id,
        creatorId,
        title: config.title || dirSlug,
        description: config.description || `Play ${config.title || dirSlug}!`,
        slug: generateSlug(config.title || dirSlug),
        genre: config.genre || null,
        engine: config.engine || 'canvas2d',
        supportsMultiplayer: config.supportsMultiplayer || false,
        resolutionWidth: config.resolution?.width || 960,
        resolutionHeight: config.resolution?.height || 540,
        scaleMode: config.resolution?.scaleMode || 'fit',
        status: 'published',
        playCount: Math.floor(Math.random() * 500),
        version: 1,
        storagePath,
      })
      .onConflictDoNothing();

    console.log(`  + ${config.title || dirSlug} → ${storagePath}`);
  }
  console.log(`Seeded ${gameIds.length} games.`);

  // Favourites — each user favourites a handful of games
  let favCount = 0;
  for (const userId of userIds) {
    const count = 2 + Math.floor(Math.random() * 5);
    const shuffled = [...gameIds].sort(() => Math.random() - 0.5);
    for (let i = 0; i < count && i < shuffled.length; i++) {
      await db
        .insert(favourites)
        .values({ userId, gameId: shuffled[i] })
        .onConflictDoNothing();
      favCount++;
    }
  }
  console.log(`Seeded ${favCount} favourites.`);

  console.log('Seed complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
