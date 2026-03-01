import { generateId, generateSlug } from '@sloppy/shared';
import { createDatabase } from './connection.js';
import { users, games, favourites } from './schema.js';

const SAMPLE_USERS = [
  { email: 'alice@example.com', displayName: 'Alice', firebaseUid: 'fb_alice_001' },
  { email: 'bob@example.com', displayName: 'Bob', firebaseUid: 'fb_bob_002' },
  { email: 'charlie@example.com', displayName: 'Charlie', firebaseUid: 'fb_charlie_003' },
  { email: 'diana@example.com', displayName: 'Diana', firebaseUid: 'fb_diana_004' },
  { email: 'eve@example.com', displayName: 'Eve', firebaseUid: 'fb_eve_005' },
];

const GAME_TITLES = [
  'Space Blaster', 'Pixel Runner', 'Neon Pong', 'Drift Racer', 'Block Breaker',
  'Zombie Dash', 'Sky Jumper', 'Maze Escape', 'Color Match', 'Word Scramble',
  'Tower Defense', 'Snake Plus', 'Asteroid Dodge', 'Bubble Pop', 'Memory Cards',
  'Rhythm Tap', 'Gravity Flip', 'Ice Slide', 'Gem Collector', 'Boss Rush',
];

async function main() {
  console.log('Seeding database...');
  const db = createDatabase();

  // Clear existing seed data (reverse FK order)
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

  // Games — spread across users, mix of draft/published
  const gameIds: string[] = [];
  for (let i = 0; i < GAME_TITLES.length; i++) {
    const id = generateId();
    gameIds.push(id);
    const title = GAME_TITLES[i];
    const creatorId = userIds[i % userIds.length];

    await db
      .insert(games)
      .values({
        id,
        creatorId,
        title,
        description: `A fun game called ${title}`,
        slug: generateSlug(title),
        supportsMultiplayer: i % 3 === 0,
        status: i < 16 ? 'published' : 'draft',
        playCount: Math.floor(Math.random() * 500),
        version: 1,
      })
      .onConflictDoNothing();
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
