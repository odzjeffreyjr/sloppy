import { MAX_SLUG_LENGTH } from '../constants/game.js';

/**
 * Convert an arbitrary title string into a URL-safe slug.
 * Appends a short random suffix to avoid collisions.
 */
export function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const suffix = Math.random().toString(36).slice(2, 8);
  const slug = `${base}-${suffix}`;

  return slug.slice(0, MAX_SLUG_LENGTH);
}

/** Check whether a string is a syntactically valid slug. */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= MAX_SLUG_LENGTH;
}
