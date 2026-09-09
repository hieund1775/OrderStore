import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { StaffProfile, StaffRole } from '../types';
import { staffLogin, fetchStaffProfile } from '../lib/api';

interface AuthState {
  token: string | null;
  user: StaffProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  initialize: () => Promise<void>;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setAuth: (token: string, user: StaffProfile) => Promise<void>;
  clearAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    try {
      const storedToken = await SecureStore.getItemAsync('auth_token');
      if (storedToken) {
        set({ token: storedToken, isLoading: true });
        try {
          const profile = await fetchStaffProfile();
          const user: StaffProfile = {
            id: profile.id,
            fullname: profile.fullname,
            phone: profile.phone,
            email: profile.email || null,
            role: (profile.admin_role || profile.role) as StaffRole,
            branch_id: profile.admin_branch_id ?? null,
            branch_name: profile.branch_name || null,
            email_verified_at: profile.email_verified_at || null,
          };
          set({ token: storedToken, user, isAuthenticated: true, isLoading: false });
        } catch {
          // Token invalid or expired — clear it
          await SecureStore.deleteItemAsync('auth_token');
          set({ token: null, user: null, isAuthenticated: false, isLoading: false });
        }
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  login: async (phone: string, password: string) => {
    const data = await staffLogin(phone, password);
    const user: StaffProfile = {
      id: data.user.id,
      fullname: data.user.fullname,
      phone: data.user.phone,
      email: null,
      role: data.user.role as StaffRole,
      branch_id: data.user.branch_id ?? null,
      branch_name: null,
      email_verified_at: null,
    };
    await SecureStore.setItemAsync('auth_token', data.token);
    set({ token: data.token, user, isAuthenticated: true });
  },

  setAuth: async (token: string, user: StaffProfile) => {
    await SecureStore.setItemAsync('auth_token', token);
    set({ token, user, isAuthenticated: true });
  },

  logout: async () => {
    try {
      await SecureStore.deleteItemAsync('auth_token');
    } catch { /* ignore */ }
    set({ token: null, user: null, isAuthenticated: false });
  },

  clearAuth: async () => {
    try {
      await SecureStore.deleteItemAsync('auth_token');
    } catch { /* ignore */ }
    set({ token: null, user: null, isAuthenticated: false });
  },
}));