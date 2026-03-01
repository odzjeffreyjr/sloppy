import { getIdToken } from './firebase';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export function reportGameCrash(
  gameId: string,
  errorMessage: string,
  stackTrace?: string,
): void {
  getIdToken()
    .then((token) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      return fetch(`${BASE_URL}/api/v1/games/${gameId}/crash`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ errorMessage, stackTrace }),
      });
    })
    .catch(() => {
      // Crash reporting is best-effort
    });

  console.warn('[sloppy] game crash detected', { gameId, errorMessage });
}
