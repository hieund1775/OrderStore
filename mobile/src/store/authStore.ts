import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { CustomerProfile } from '../types';
import apiClient from '../lib/api';

interface AuthState {
  token: string | null;
  user: CustomerProfile | null;
  isLoading: boolean;

  // Actions
  initialize: () => Promise<void>;
  setAuth: (token: string, user: CustomerProfile) => Promise<void>;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isLoading: true,

  initialize: async () => {
    try {
      const storedToken = await SecureStore.getItemAsync('auth_token');
      if (storedToken) {
        set({ token: storedToken });
        await get().fetchProfile();
      }
    } catch {
      // ignore storage error
    } finally {
      set({ isLoading: false });
    }
  },

  setAuth: async (token, user) => {
    try {
      await SecureStore.setItemAsync('auth_token', token);
    } catch {
      // ignore
    }
    set({ token, user });
  },

  logout: async () => {
    try {
      await SecureStore.deleteItemAsync('auth_token');
    } catch {
      // ignore
    }
    set({ token: null, user: null });
  },

  fetchProfile: async () => {
    const { user } = get();
    if (!user?.id) return;
    try {
      const { data } = await apiClient.get<CustomerProfile>(`/users/${user.id}`);
      set({ user: data });
    } catch {
      // profile fetch failure fallback
    }
  },
}));
