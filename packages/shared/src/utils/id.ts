import { nanoid } from 'nanoid';

/** Generate a collision-resistant unique ID (21 chars, URL-safe). */
export function generateId(): string {
  return nanoid();
}

/** Generate a shorter ID for user-facing references (10 chars). */
export function generateShortId(): string {
  return nanoid(10);
}
