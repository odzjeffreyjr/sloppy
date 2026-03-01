/** Cursor-paginated result set. */
export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export function encodeCursor(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeCursor<T = Record<string, unknown>>(cursor: string): T {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString()) as T;
}
