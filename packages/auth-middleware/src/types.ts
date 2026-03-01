export interface AuthUser {
  uid: string;
  email: string;
  displayName?: string;
  isAnonymous: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
