export type { AuthUser } from './types.js';
export {
  authenticateRequest,
  requireAuth,
  optionalAuth,
} from './middleware.js';
export { getFirebaseApp, getFirebaseAuth } from './firebase.js';
