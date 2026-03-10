import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  auth,
  onAuthStateChanged,
  loginWithGoogle,
  loginWithEmail,
  loginAnonymously,
  logout as firebaseLogout,
  type User as FirebaseUser,
} from '../lib/firebase';
import { authApi, subscriptionApi, quotaApi } from '../lib/api';

interface SloppyUser {
  id: string;
  email: string;
  displayName?: string;
}

export interface UserQuota {
  totalGames: number;
  maxGames: number;
  freeInitialGames: number;
  weeklyCreated: number;
  maxWeeklyGames: number;
  canPublish: boolean;
  maxVersionsPerGame: number;
  isPaid: boolean;
}

interface AuthState {
  firebaseUser: FirebaseUser | null;
  user: SloppyUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSubscribed: boolean;
  quota: UserQuota | null;

  login: (method: 'google' | 'anonymous', email?: string, password?: string) => Promise<void>;
  loginEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  syncUser: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  refreshQuota: () => Promise<void>;
  _setFirebaseUser: (u: FirebaseUser | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      firebaseUser: null,
      user: null,
      isLoading: true,
      isAuthenticated: false,
      isSubscribed: false,
      quota: null,

      _setFirebaseUser: (firebaseUser) => {
        set({
          firebaseUser,
          isAuthenticated: !!firebaseUser,
          isLoading: false,
        });
        if (firebaseUser) get().syncUser();
      },

      syncUser: async () => {
        try {
          const res = await authApi.sync();
          set({ user: res.data });
          get().refreshSubscription();
          get().refreshQuota();
        } catch {
          /* backend may be unavailable during dev */
        }
      },

      refreshSubscription: async () => {
        try {
          const res = await subscriptionApi.getStatus();
          set({ isSubscribed: res.data.isSubscribed });
        } catch {
          /* subscription service may be unavailable */
        }
      },

      refreshQuota: async () => {
        try {
          const res = await quotaApi.get();
          set({ quota: res.data });
        } catch {
          /* quota service may be unavailable */
        }
      },

      login: async (method) => {
        set({ isLoading: true });
        try {
          if (method === 'google') await loginWithGoogle();
          else await loginAnonymously();
        } finally {
          set({ isLoading: false });
        }
      },

      loginEmail: async (email, password) => {
        set({ isLoading: true });
        try {
          await loginWithEmail(email, password);
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        await firebaseLogout();
        set({ firebaseUser: null, user: null, isAuthenticated: false, isSubscribed: false, quota: null });
      },
    }),
    {
      name: 'sloppy-auth',
      partialize: (state) => ({ user: state.user, isSubscribed: state.isSubscribed, quota: state.quota }),
    },
  ),
);

if (auth) {
  onAuthStateChanged(auth, (firebaseUser) => {
    useAuthStore.getState()._setFirebaseUser(firebaseUser);
  });
} else {
  useAuthStore.setState({ isLoading: false });
}
