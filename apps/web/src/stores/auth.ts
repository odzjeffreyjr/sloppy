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
import { authApi } from '../lib/api';

interface SloppyUser {
  id: string;
  email: string;
  displayName?: string;
}

interface AuthState {
  firebaseUser: FirebaseUser | null;
  user: SloppyUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (method: 'google' | 'anonymous', email?: string, password?: string) => Promise<void>;
  loginEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  syncUser: () => Promise<void>;
  _setFirebaseUser: (u: FirebaseUser | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      firebaseUser: null,
      user: null,
      isLoading: true,
      isAuthenticated: false,

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
        } catch {
          /* backend may be unavailable during dev */
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
        set({ firebaseUser: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'sloppy-auth',
      partialize: (state) => ({ user: state.user }),
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
