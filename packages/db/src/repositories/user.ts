import { eq } from 'drizzle-orm';
import type { User } from '@sloppy/shared';
import { generateId } from '@sloppy/shared';
import type { Database } from '../connection.js';
import { users } from '../schema.js';
import { mapUser } from '../mappers.js';

export function createUserRepository(db: Database) {
  return {
    async create(data: {
      firebaseUid: string;
      email: string;
      displayName?: string;
    }): Promise<User> {
      const [row] = await db
        .insert(users)
        .values({
          id: generateId(),
          firebaseUid: data.firebaseUid,
          email: data.email,
          displayName: data.displayName ?? null,
        })
        .returning();
      return mapUser(row);
    },

    async upsertByFirebaseUid(data: {
      firebaseUid: string;
      email: string;
      displayName?: string;
    }): Promise<User> {
      const [row] = await db
        .insert(users)
        .values({
          id: generateId(),
          firebaseUid: data.firebaseUid,
          email: data.email,
          displayName: data.displayName ?? null,
        })
        .onConflictDoUpdate({
          target: users.firebaseUid,
          set: {
            email: data.email,
            displayName: data.displayName ?? null,
          },
        })
        .returning();
      return mapUser(row);
    },

    async findById(id: string): Promise<User | null> {
      const [row] = await db.select().from(users).where(eq(users.id, id));
      return row ? mapUser(row) : null;
    },

    async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
      const [row] = await db
        .select()
        .from(users)
        .where(eq(users.firebaseUid, firebaseUid));
      return row ? mapUser(row) : null;
    },

    async findByEmail(email: string): Promise<User | null> {
      const [row] = await db
        .select()
        .from(users)
        .where(eq(users.email, email));
      return row ? mapUser(row) : null;
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
